import { describe, expect, it } from 'vitest';
import { analyzeProfile } from '../../src/los/losAnalysis';
import type { ProfileSample } from '../../src/state/types';

// A 2km link, 30m towers on flat 300m terrain, 2.4GHz — chosen so the
// baseline case is comfortably clear (short enough that the Fresnel zone
// and earth-curvature bulge are small relative to a 30m tower).
const DISTANCE_M = 2000;
const BASE_ELEVATION_M = 300;
const ANTENNA_HEIGHT_M = 30;
const FREQUENCY_HZ = 2.4e9;

function buildProfile(midElevationM: number): ProfileSample[] {
  return [
    { distanceM: 0, lat: 45.0, lon: -89.0, elevationM: BASE_ELEVATION_M },
    { distanceM: DISTANCE_M / 2, lat: 45.009, lon: -89.0, elevationM: midElevationM },
    { distanceM: DISTANCE_M, lat: 45.018, lon: -89.0, elevationM: BASE_ELEVATION_M },
  ];
}

describe('analyzeProfile', () => {
  it('reports a clear link over flat terrain with adequate tower height', () => {
    const result = analyzeProfile(buildProfile(BASE_ELEVATION_M), ANTENNA_HEIGHT_M, ANTENNA_HEIGHT_M, FREQUENCY_HZ);
    expect(result.clear).toBe(true);
    expect(result.hardBlocked).toBe(false);
    expect(result.worstObstruction).toBeNull();
  });

  it('reports Fresnel-zone obstruction (not hard-blocked) for a hill below the direct line', () => {
    // LOS line at the midpoint is 330m; a 327m hill sits below the direct
    // line but eats into the required 60% Fresnel clearance.
    const result = analyzeProfile(buildProfile(327), ANTENNA_HEIGHT_M, ANTENNA_HEIGHT_M, FREQUENCY_HZ);
    expect(result.clear).toBe(false);
    expect(result.hardBlocked).toBe(false);
    expect(result.worstObstruction).not.toBeNull();
    expect(result.worstObstruction!.intrusionM).toBeGreaterThan(0);
  });

  it('reports a hard block for a hill crossing the direct line', () => {
    const result = analyzeProfile(buildProfile(332), ANTENNA_HEIGHT_M, ANTENNA_HEIGHT_M, FREQUENCY_HZ);
    expect(result.clear).toBe(false);
    expect(result.hardBlocked).toBe(true);
    expect(result.worstObstruction).not.toBeNull();
  });

  it('identifies the highest terrain point along the path regardless of obstruction status', () => {
    const result = analyzeProfile(buildProfile(500), ANTENNA_HEIGHT_M, ANTENNA_HEIGHT_M, FREQUENCY_HZ);
    expect(result.highestPoint.elevationM).toBe(500);
    expect(result.highestPoint.distanceM).toBe(DISTANCE_M / 2);
  });
});
