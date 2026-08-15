import { describe, expect, it } from 'vitest';
import { crossTrackDistanceM } from '../../src/utils/geo';

describe('crossTrackDistanceM', () => {
  it('is ~0 for a point on the line itself', () => {
    // Line running due north; midpoint of the line is on the line.
    const value = crossTrackDistanceM(44.5, -89.0, 44.0, -89.0, 45.0, -89.0);
    expect(Math.abs(value)).toBeLessThan(1);
  });

  it('is ~0 at the line start and end points', () => {
    expect(Math.abs(crossTrackDistanceM(44.0, -89.0, 44.0, -89.0, 45.0, -89.0))).toBeLessThan(1);
    expect(Math.abs(crossTrackDistanceM(45.0, -89.0, 44.0, -89.0, 45.0, -89.0))).toBeLessThan(1);
  });

  it('reports ~5km for a point offset 5km perpendicular from a due-north line', () => {
    // Line running due north at lon -89.0. Offset a point east by 5km at
    // the midpoint latitude (44.5N), using a flat-earth approximation to
    // construct the offset -- the formula under test is exact, so this
    // just needs to land close.
    const midLat = 44.5;
    const metersPerDegreeLon = 111_320 * Math.cos((midLat * Math.PI) / 180);
    const offsetLon = -89.0 + 5000 / metersPerDegreeLon;

    const value = crossTrackDistanceM(midLat, offsetLon, 44.0, -89.0, 45.0, -89.0);
    expect(Math.abs(value)).toBeGreaterThan(4900);
    expect(Math.abs(value)).toBeLessThan(5100);
  });

  it('reports opposite signs for points on opposite sides of the line', () => {
    const midLat = 44.5;
    const metersPerDegreeLon = 111_320 * Math.cos((midLat * Math.PI) / 180);
    const eastLon = -89.0 + 3000 / metersPerDegreeLon;
    const westLon = -89.0 - 3000 / metersPerDegreeLon;

    const east = crossTrackDistanceM(midLat, eastLon, 44.0, -89.0, 45.0, -89.0);
    const west = crossTrackDistanceM(midLat, westLon, 44.0, -89.0, 45.0, -89.0);
    expect(Math.sign(east)).not.toBe(Math.sign(west));
  });
});
