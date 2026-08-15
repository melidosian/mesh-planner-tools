import { describe, expect, it } from 'vitest';
import { earthCurvatureBulgeM } from '../../src/los/earthCurvature';

describe('earthCurvatureBulgeM', () => {
  it('matches the standard 4/3-earth bulge formula at 10km/10km', () => {
    // h = d1*d2 / (2 * k * R) with k=4/3, R=6371000 => ~5.89m
    const bulge = earthCurvatureBulgeM(10_000, 10_000);
    expect(bulge).toBeCloseTo(5.888, 1);
  });

  it('is zero at either endpoint', () => {
    expect(earthCurvatureBulgeM(0, 20_000)).toBe(0);
    expect(earthCurvatureBulgeM(20_000, 0)).toBe(0);
  });

  it('is symmetric in its two arguments', () => {
    expect(earthCurvatureBulgeM(3000, 7000)).toBeCloseTo(earthCurvatureBulgeM(7000, 3000), 10);
  });
});
