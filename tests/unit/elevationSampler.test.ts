import { describe, expect, it } from 'vitest';
import { bilinearInterpolate, lonLatToPixel, type RasterWindow, type TileGeoRef } from '../../src/elevation/elevationSampler';

describe('lonLatToPixel', () => {
  const geoRef: TileGeoRef = { bbox: [-90, 44, -89, 45], widthPx: 100, heightPx: 100 };

  it('maps the top-left corner (minLon, maxLat) to pixel (0,0)', () => {
    const { px, py } = lonLatToPixel(geoRef, -90, 45);
    expect(px).toBeCloseTo(0, 6);
    expect(py).toBeCloseTo(0, 6);
  });

  it('maps the bottom-right corner (maxLon, minLat) to pixel (width,height)', () => {
    const { px, py } = lonLatToPixel(geoRef, -89, 44);
    expect(px).toBeCloseTo(100, 6);
    expect(py).toBeCloseTo(100, 6);
  });

  it('maps the center to the center pixel', () => {
    const { px, py } = lonLatToPixel(geoRef, -89.5, 44.5);
    expect(px).toBeCloseTo(50, 6);
    expect(py).toBeCloseTo(50, 6);
  });
});

describe('bilinearInterpolate', () => {
  function makeWindow(data: number[], noDataValue: number | null = null): RasterWindow {
    return { originPx: 0, originPy: 0, width: 2, height: 2, data, noDataValue };
  }

  it('returns the exact corner value at integer pixel coords', () => {
    const window = makeWindow([10, 20, 30, 40]); // [ (0,0)=10 (1,0)=20 / (0,1)=30 (1,1)=40 ]
    expect(bilinearInterpolate(window, 0, 0)).toBeCloseTo(10);
    expect(bilinearInterpolate(window, 1, 0)).toBeCloseTo(20);
    expect(bilinearInterpolate(window, 0, 1)).toBeCloseTo(30);
    expect(bilinearInterpolate(window, 1, 1)).toBeCloseTo(40);
  });

  it('averages all four corners at the center', () => {
    const window = makeWindow([10, 20, 30, 40]);
    expect(bilinearInterpolate(window, 0.5, 0.5)).toBeCloseTo((10 + 20 + 30 + 40) / 4);
  });

  it('interpolates linearly along a single axis', () => {
    const window = makeWindow([0, 10, 0, 10]);
    expect(bilinearInterpolate(window, 0.25, 0)).toBeCloseTo(2.5);
  });

  it('excludes nodata corners and renormalizes the remaining weights', () => {
    const window = makeWindow([10, -9999, 30, 40], -9999);
    // At the center, corner (1,0) is nodata; remaining three corners average with
    // renormalized weights: (10*0.25 + 30*0.25 + 40*0.25) / 0.75 = 26.67
    const value = bilinearInterpolate(window, 0.5, 0.5)!;
    expect(value).toBeCloseTo((10 * 0.25 + 30 * 0.25 + 40 * 0.25) / 0.75, 4);
  });

  it('returns null when every corner is nodata', () => {
    const window = makeWindow([-9999, -9999, -9999, -9999], -9999);
    expect(bilinearInterpolate(window, 0.5, 0.5)).toBeNull();
  });
});
