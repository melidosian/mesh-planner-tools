import { describe, expect, it } from 'vitest';
import { fresnelZoneRadiusM } from '../../src/los/fresnel';

describe('fresnelZoneRadiusM', () => {
  it('matches the standard 17.31 shortcut-constant formula at 2.4GHz, 5km/5km', () => {
    const d1Km = 5;
    const d2Km = 5;
    const totalKm = d1Km + d2Km;
    const freqGHz = 2.4;
    // Standard shortcut: F1(m) = 17.31 * sqrt(d1*d2 / (f_GHz * D)), distances in km.
    const shortcut = 17.31 * Math.sqrt((d1Km * d2Km) / (freqGHz * totalKm));

    const radius = fresnelZoneRadiusM(2.4e9, 5000, 5000);
    expect(radius).toBeCloseTo(shortcut, 0);
  });

  it('is zero when total distance is zero', () => {
    expect(fresnelZoneRadiusM(2.4e9, 0, 0)).toBe(0);
  });

  it('shrinks as frequency increases', () => {
    const low = fresnelZoneRadiusM(900e6, 5000, 5000);
    const high = fresnelZoneRadiusM(5.8e9, 5000, 5000);
    expect(high).toBeLessThan(low);
  });
});
