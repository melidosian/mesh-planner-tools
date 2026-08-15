import { fromUrl, type GeoTIFFImage } from 'geotiff';
import type { DemTileMeta, ProfileSample } from '../state/types';
import type { PathPoint } from '../los/pathSampler';
import { findTile, findTilesForBbox } from './demIndex';
import {
  bilinearInterpolate,
  lonLatToPixel,
  pixelToLonLat,
  type RasterWindow,
  type TileGeoRef,
} from './elevationSampler';

export class DemCoverageError extends Error {
  constructor(lat: number, lon: number) {
    super(`No elevation data available for ${lat.toFixed(4)}, ${lon.toFixed(4)} (outside Wisconsin coverage)`);
    this.name = 'DemCoverageError';
  }
}

interface TileHandle {
  image: GeoTIFFImage;
  geoRef: TileGeoRef;
  noDataValue: number | null;
}

const tileHandleCache = new Map<string, Promise<TileHandle>>();

function tileUrl(tile: DemTileMeta): string {
  return `${import.meta.env.BASE_URL}dem/tiles/${tile.file}`;
}

async function openTile(tile: DemTileMeta): Promise<TileHandle> {
  let handlePromise = tileHandleCache.get(tile.id);
  if (!handlePromise) {
    handlePromise = (async () => {
      const geotiff = await fromUrl(tileUrl(tile));
      const image = await geotiff.getImage();
      const noDataRaw = image.getGDALNoData();
      return {
        image,
        geoRef: {
          bbox: tile.bbox,
          widthPx: image.getWidth(),
          heightPx: image.getHeight(),
        },
        noDataValue: noDataRaw === null || noDataRaw === undefined ? null : Number(noDataRaw),
      };
    })();
    tileHandleCache.set(tile.id, handlePromise);
  }
  return handlePromise;
}

/**
 * Reads a single tight raster window covering all given fractional pixel
 * coordinates (padded by 1px for bilinear neighbor access, clamped to the
 * tile bounds), then bilinear-interpolates each point against it. This is
 * the batching that keeps DEM reads to one small HTTP range request per
 * tile per query, instead of one request per sample point.
 */
async function readWindowAndInterpolate(
  handle: TileHandle,
  pixelCoords: { px: number; py: number }[],
): Promise<(number | null)[]> {
  const { geoRef, noDataValue, image } = handle;

  let minPx = Infinity;
  let minPy = Infinity;
  let maxPx = -Infinity;
  let maxPy = -Infinity;
  for (const { px, py } of pixelCoords) {
    minPx = Math.min(minPx, px);
    minPy = Math.min(minPy, py);
    maxPx = Math.max(maxPx, px);
    maxPy = Math.max(maxPy, py);
  }

  const x0 = Math.max(0, Math.floor(minPx) - 1);
  const y0 = Math.max(0, Math.floor(minPy) - 1);
  const x1 = Math.min(geoRef.widthPx, Math.ceil(maxPx) + 2);
  const y1 = Math.min(geoRef.heightPx, Math.ceil(maxPy) + 2);

  const rasters = await image.readRasters({ window: [x0, y0, x1, y1] });
  const band = rasters[0] as ArrayLike<number>;

  const window: RasterWindow = {
    originPx: x0,
    originPy: y0,
    width: x1 - x0,
    height: y1 - y0,
    data: band,
    noDataValue,
  };

  return pixelCoords.map(({ px, py }) =>
    bilinearInterpolate(window, px - window.originPx, py - window.originPy),
  );
}

function fillGaps(elevations: (number | null)[]): number[] {
  const filled = [...elevations];
  const n = filled.length;

  // Fill interior gaps by linear interpolation between nearest valid neighbors.
  let i = 0;
  while (i < n) {
    if (filled[i] !== null) {
      i++;
      continue;
    }
    let j = i;
    while (j < n && filled[j] === null) j++;
    const before = i > 0 ? filled[i - 1] : null;
    const after = j < n ? filled[j] : null;
    for (let k = i; k < j; k++) {
      if (before !== null && after !== null) {
        const t = (k - i + 1) / (j - i + 1);
        filled[k] = before + (after - before) * t;
      } else {
        filled[k] = before ?? after ?? 0;
      }
    }
    i = j;
  }

  return filled as number[];
}

/**
 * Annotates great-circle path points with terrain elevation, batching reads
 * per DEM tile so a link crossing 1-3 tiles issues 1-3 windowed reads total.
 */
export async function annotateProfileWithElevation(
  points: PathPoint[],
): Promise<ProfileSample[]> {
  const tileForPoint: (DemTileMeta | null)[] = await Promise.all(
    points.map((p) => findTile(p.lat, p.lon)),
  );

  const missingIndex = tileForPoint.findIndex((t) => t === null);
  if (missingIndex !== -1) {
    const p = points[missingIndex];
    throw new DemCoverageError(p.lat, p.lon);
  }

  const tiles = tileForPoint as DemTileMeta[];
  const indicesByTile = new Map<string, number[]>();
  for (let i = 0; i < tiles.length; i++) {
    const id = tiles[i].id;
    const list = indicesByTile.get(id) ?? [];
    list.push(i);
    indicesByTile.set(id, list);
  }

  const elevations: (number | null)[] = new Array(points.length).fill(null);

  for (const indices of indicesByTile.values()) {
    const tile = tiles[indices[0]];
    const handle = await openTile(tile);
    const pixelCoords = indices.map((i) => lonLatToPixel(handle.geoRef, points[i].lon, points[i].lat));
    const values = await readWindowAndInterpolate(handle, pixelCoords);
    indices.forEach((i, k) => {
      elevations[i] = values[k];
    });
  }

  const filledElevations = fillGaps(elevations);

  return points.map((p, i) => ({
    distanceM: p.distanceM,
    lat: p.lat,
    lon: p.lon,
    elevationM: filledElevations[i],
  }));
}

export interface GridPoint {
  lat: number;
  lon: number;
  elevationM: number;
}

const METERS_PER_DEGREE_LAT = 111_320;

/**
 * Samples terrain elevation on a roughly-regular grid within a bbox, at
 * approximately targetSpacingM between samples. Used for scanning an area
 * (rather than a single path) for high points, e.g. relay-site search.
 * Reads each intersecting tile's full-resolution window once, then
 * subsamples in JS with a computed stride -- no extra HTTP requests beyond
 * one windowed read per tile.
 */
export async function sampleElevationGrid(
  bbox: [number, number, number, number],
  targetSpacingM: number,
): Promise<GridPoint[]> {
  const [minLon, minLat, maxLon, maxLat] = bbox;
  const tiles = await findTilesForBbox(bbox);
  const points: GridPoint[] = [];

  for (const tile of tiles) {
    const handle = await openTile(tile);
    const { geoRef, noDataValue, image } = handle;
    const [tMinLon, tMinLat, tMaxLon, tMaxLat] = geoRef.bbox;

    const clampedMinLon = Math.max(minLon, tMinLon);
    const clampedMaxLon = Math.min(maxLon, tMaxLon);
    const clampedMinLat = Math.max(minLat, tMinLat);
    const clampedMaxLat = Math.min(maxLat, tMaxLat);
    if (clampedMinLon >= clampedMaxLon || clampedMinLat >= clampedMaxLat) continue;

    const topLeft = lonLatToPixel(geoRef, clampedMinLon, clampedMaxLat);
    const bottomRight = lonLatToPixel(geoRef, clampedMaxLon, clampedMinLat);
    const x0 = Math.max(0, Math.floor(topLeft.px));
    const y0 = Math.max(0, Math.floor(topLeft.py));
    const x1 = Math.min(geoRef.widthPx, Math.ceil(bottomRight.px));
    const y1 = Math.min(geoRef.heightPx, Math.ceil(bottomRight.py));
    if (x1 <= x0 || y1 <= y0) continue;

    const rasters = await image.readRasters({ window: [x0, y0, x1, y1] });
    const band = rasters[0] as ArrayLike<number>;
    const width = x1 - x0;
    const height = y1 - y0;

    const pixelWidthDeg = (tMaxLon - tMinLon) / geoRef.widthPx;
    const pixelHeightDeg = (tMaxLat - tMinLat) / geoRef.heightPx;
    const midLatRad = (((clampedMinLat + clampedMaxLat) / 2) * Math.PI) / 180;
    const pixelWidthM = pixelWidthDeg * METERS_PER_DEGREE_LAT * Math.cos(midLatRad);
    const pixelHeightM = pixelHeightDeg * METERS_PER_DEGREE_LAT;
    const strideX = Math.max(1, Math.round(targetSpacingM / pixelWidthM));
    const strideY = Math.max(1, Math.round(targetSpacingM / pixelHeightM));

    for (let py = 0; py < height; py += strideY) {
      for (let px = 0; px < width; px += strideX) {
        const value = band[py * width + px];
        if (noDataValue !== null && value === noDataValue) continue;
        const { lat, lon } = pixelToLonLat(geoRef, x0 + px, y0 + py);
        points.push({ lat, lon, elevationM: value });
      }
    }
  }

  return points;
}
