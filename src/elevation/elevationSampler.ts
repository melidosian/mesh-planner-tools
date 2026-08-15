export interface TileGeoRef {
  /** [minLon, minLat, maxLon, maxLat] */
  bbox: [number, number, number, number];
  widthPx: number;
  heightPx: number;
}

export interface PixelCoord {
  px: number;
  py: number;
}

/**
 * Converts a lon/lat to fractional pixel coordinates within a tile's full
 * raster, given the tile's bbox and dimensions. Assumes a north-up raster
 * (row 0 = maxLat, as produced by the DEM pipeline), matching standard
 * GeoTIFF row ordering.
 */
export function lonLatToPixel(geoRef: TileGeoRef, lon: number, lat: number): PixelCoord {
  const [minLon, minLat, maxLon, maxLat] = geoRef.bbox;
  const pixelWidthDeg = (maxLon - minLon) / geoRef.widthPx;
  const pixelHeightDeg = (maxLat - minLat) / geoRef.heightPx;
  return {
    px: (lon - minLon) / pixelWidthDeg,
    py: (maxLat - lat) / pixelHeightDeg,
  };
}

export interface RasterWindow {
  /** Pixel x/y of this window's top-left corner, in the full tile's raster space. */
  originPx: number;
  originPy: number;
  width: number;
  height: number;
  /** Row-major elevation data, length === width * height. */
  data: ArrayLike<number>;
  noDataValue: number | null;
}

/**
 * Bilinear-interpolates an elevation value at fractional pixel coordinates
 * (in the *window's* local pixel space, i.e. already offset by the window's
 * origin) within a raster window. Corners equal to the nodata value are
 * excluded and the remaining corners' weights are renormalized; returns
 * null only if all four corners are nodata.
 */
export function bilinearInterpolate(
  window: RasterWindow,
  px: number,
  py: number,
): number | null {
  const { width, height, data, noDataValue } = window;

  const x0 = Math.min(Math.max(Math.floor(px), 0), width - 1);
  const y0 = Math.min(Math.max(Math.floor(py), 0), height - 1);
  const x1 = Math.min(x0 + 1, width - 1);
  const y1 = Math.min(y0 + 1, height - 1);
  const fx = Math.min(Math.max(px - x0, 0), 1);
  const fy = Math.min(Math.max(py - y0, 0), 1);

  const corners: Array<{ value: number; weight: number }> = [
    { value: data[y0 * width + x0], weight: (1 - fx) * (1 - fy) },
    { value: data[y0 * width + x1], weight: fx * (1 - fy) },
    { value: data[y1 * width + x0], weight: (1 - fx) * fy },
    { value: data[y1 * width + x1], weight: fx * fy },
  ];

  let weightedSum = 0;
  let weightTotal = 0;
  for (const { value, weight } of corners) {
    if (noDataValue !== null && value === noDataValue) continue;
    weightedSum += value * weight;
    weightTotal += weight;
  }

  if (weightTotal === 0) return null;
  return weightedSum / weightTotal;
}
