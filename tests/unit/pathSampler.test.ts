import { describe, expect, it } from 'vitest';
import { sampleGreatCirclePath } from '../../src/los/pathSampler';
import { haversineDistanceM } from '../../src/utils/geo';

describe('sampleGreatCirclePath', () => {
  it('starts and ends at the given endpoints', () => {
    const points = sampleGreatCirclePath(45.0, -89.0, 45.2, -89.3);
    expect(points[0].lat).toBeCloseTo(45.0, 6);
    expect(points[0].lon).toBeCloseTo(-89.0, 6);
    expect(points[points.length - 1].lat).toBeCloseTo(45.2, 6);
    expect(points[points.length - 1].lon).toBeCloseTo(-89.3, 6);
  });

  it('has monotonically increasing distance matching the total haversine distance', () => {
    const lat1 = 44.5;
    const lon1 = -90.0;
    const lat2 = 45.3;
    const lon2 = -88.9;
    const points = sampleGreatCirclePath(lat1, lon1, lat2, lon2);
    const total = haversineDistanceM(lat1, lon1, lat2, lon2);

    expect(points[points.length - 1].distanceM).toBeCloseTo(total, 3);
    for (let i = 1; i < points.length; i++) {
      expect(points[i].distanceM).toBeGreaterThan(points[i - 1].distanceM);
    }
  });

  it('interpolates along the same meridian for points sharing a longitude', () => {
    const points = sampleGreatCirclePath(44.0, -89.5, 46.0, -89.5);
    for (const p of points) {
      expect(p.lon).toBeCloseTo(-89.5, 4);
    }
  });

  it('returns a single point for coincident endpoints', () => {
    const points = sampleGreatCirclePath(45.0, -89.0, 45.0, -89.0);
    expect(points).toHaveLength(1);
    expect(points[0].distanceM).toBe(0);
  });
});
