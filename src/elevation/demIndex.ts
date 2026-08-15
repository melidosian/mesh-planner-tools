import { DEM_MANIFEST_URL } from '../config';
import type { DemManifest, DemTileMeta } from '../state/types';

let manifestPromise: Promise<DemManifest> | null = null;

function loadManifest(): Promise<DemManifest> {
  if (!manifestPromise) {
    manifestPromise = fetch(DEM_MANIFEST_URL).then((res) => {
      if (!res.ok) {
        throw new Error(`Failed to load DEM manifest: HTTP ${res.status}`);
      }
      return res.json() as Promise<DemManifest>;
    });
  }
  return manifestPromise;
}

function containsPoint(bbox: DemTileMeta['bbox'], lat: number, lon: number): boolean {
  const [minLon, minLat, maxLon, maxLat] = bbox;
  return lon >= minLon && lon <= maxLon && lat >= minLat && lat <= maxLat;
}

function bboxesOverlap(a: DemTileMeta['bbox'], b: DemTileMeta['bbox']): boolean {
  const [aMinLon, aMinLat, aMaxLon, aMaxLat] = a;
  const [bMinLon, bMinLat, bMaxLon, bMaxLat] = b;
  return aMinLon <= bMaxLon && aMaxLon >= bMinLon && aMinLat <= bMaxLat && aMaxLat >= bMinLat;
}

/** Finds the DEM tile covering a given lat/lon, if any. Linear scan is fine for ~40 tiles. */
export async function findTile(lat: number, lon: number): Promise<DemTileMeta | null> {
  const manifest = await loadManifest();
  return manifest.tiles.find((tile) => containsPoint(tile.bbox, lat, lon)) ?? null;
}

/** Finds all DEM tiles intersecting a [minLon, minLat, maxLon, maxLat] bbox. */
export async function findTilesForBbox(bbox: DemTileMeta['bbox']): Promise<DemTileMeta[]> {
  const manifest = await loadManifest();
  return manifest.tiles.filter((tile) => bboxesOverlap(tile.bbox, bbox));
}
