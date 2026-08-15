import { describe, expect, it } from 'vitest';
import { buildSearchBbox, selectCandidatePoints } from '../../src/los/relaySearch';
import type { GridPoint } from '../../src/elevation/demReader';

// A due-north line, matching the geometry used in crossTrackDistance.test.ts.
const A = { lat: 44.0, lon: -89.0 };
const B = { lat: 45.0, lon: -89.0 };
const DEFAULT_DETOUR_RATIO = 1.4;

function offsetLon(lat: number, meters: number): number {
  const metersPerDegreeLon = 111_320 * Math.cos((lat * Math.PI) / 180);
  return -89.0 + meters / metersPerDegreeLon;
}

describe('buildSearchBbox', () => {
  it('produces a bbox that contains both endpoints and extends beyond them by the pad', () => {
    const bbox = buildSearchBbox(A, B, 5000);
    const [minLon, minLat, maxLon, maxLat] = bbox;
    expect(minLat).toBeLessThan(A.lat);
    expect(maxLat).toBeGreaterThan(B.lat);
    expect(minLon).toBeLessThan(A.lon);
    expect(maxLon).toBeGreaterThan(A.lon);
  });
});

describe('selectCandidatePoints', () => {
  it('excludes points outside the corridor half-width', () => {
    const points: GridPoint[] = [
      { lat: 44.5, lon: offsetLon(44.5, 3000), elevationM: 400 }, // inside a 5km corridor
      { lat: 44.5, lon: offsetLon(44.5, 20000), elevationM: 900 }, // way outside, even though higher
    ];
    const selected = selectCandidatePoints(points, A, B, 5000, 100, 10, DEFAULT_DETOUR_RATIO);
    expect(selected).toHaveLength(1);
    expect(selected[0].elevationM).toBe(400);
  });

  it('ranks by elevation, highest first', () => {
    const points: GridPoint[] = [
      { lat: 44.3, lon: offsetLon(44.3, 1000), elevationM: 300 },
      { lat: 44.6, lon: offsetLon(44.6, -1000), elevationM: 500 },
      { lat: 44.8, lon: offsetLon(44.8, 500), elevationM: 400 },
    ];
    const selected = selectCandidatePoints(points, A, B, 5000, 1, 10, DEFAULT_DETOUR_RATIO);
    expect(selected.map((p) => p.elevationM)).toEqual([500, 400, 300]);
  });

  it('suppresses lower candidates within minSpacingM of a higher one', () => {
    const points: GridPoint[] = [
      { lat: 44.5, lon: offsetLon(44.5, 0), elevationM: 500 },
      // ~200m away from the point above -- should be suppressed by an 800m min spacing.
      { lat: 44.5018, lon: offsetLon(44.5, 0), elevationM: 480 },
      // Far away (~50km north) -- should survive.
      { lat: 44.95, lon: offsetLon(44.95, 0), elevationM: 300 },
    ];
    const selected = selectCandidatePoints(points, A, B, 5000, 800, 10, DEFAULT_DETOUR_RATIO);
    expect(selected).toHaveLength(2);
    expect(selected.map((p) => p.elevationM)).toEqual([500, 300]);
  });

  it('excludes a point that would roughly double the path length, even with near-zero cross-track distance', () => {
    const points: GridPoint[] = [
      // On the line's bearing, but ~33km past B -- passes the cross-track
      // check (it's right on the extended bearing) but detours the total
      // path from ~111km to ~178km (ratio 1.6), well past a 1.4x cap. This
      // is the real bug this filter catches: a tall, far-off hill that
      // looks "on the line" but isn't actually a sane relay site.
      { lat: 45.3, lon: offsetLon(45.3, 0), elevationM: 900 },
      // Actually between A and B, and a much smaller detour.
      { lat: 44.5, lon: offsetLon(44.5, 0), elevationM: 400 },
    ];
    const selected = selectCandidatePoints(points, A, B, 5000, 1, 10, DEFAULT_DETOUR_RATIO);
    expect(selected).toHaveLength(1);
    expect(selected[0].elevationM).toBe(400);
  });

  it('caps the result at maxCandidates', () => {
    const points: GridPoint[] = Array.from({ length: 20 }, (_, i) => ({
      lat: 44.0 + i * 0.04,
      lon: offsetLon(44.0 + i * 0.04, 0),
      elevationM: 300 + i,
    }));
    const selected = selectCandidatePoints(points, A, B, 5000, 1, 5, DEFAULT_DETOUR_RATIO);
    expect(selected).toHaveLength(5);
  });
});
