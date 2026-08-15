import { FRESNEL_CLEARANCE_FRACTION } from '../config';
import { annotateProfileWithElevation } from '../elevation/demReader';
import type { LinkResult, ObstructionPoint, ProfileSample, Repeater } from '../state/types';
import { earthCurvatureBulgeM } from './earthCurvature';
import { fresnelZoneRadiusM } from './fresnel';
import { sampleGreatCirclePath } from './pathSampler';

function toObstructionPoint(sample: ProfileSample, intrusionM: number): ObstructionPoint {
  return {
    distanceM: sample.distanceM,
    lat: sample.lat,
    lon: sample.lon,
    elevationM: sample.elevationM,
    intrusionM,
  };
}

/**
 * Computes LOS/Fresnel clearance for a link, given an already-fetched
 * elevation profile. Pure and synchronous, so re-running with a different
 * frequency (or antenna height) needs no DEM I/O.
 */
export function analyzeProfile(
  profile: ProfileSample[],
  antennaHeightAM: number,
  antennaHeightBM: number,
  frequencyHz: number,
): {
  clear: boolean;
  hardBlocked: boolean;
  worstObstruction: ObstructionPoint | null;
  highestPoint: ObstructionPoint;
} {
  const first = profile[0];
  const last = profile[profile.length - 1];
  const totalDistanceM = last.distanceM - first.distanceM;
  const hA = first.elevationM + antennaHeightAM;
  const hB = last.elevationM + antennaHeightBM;

  let hardBlocked = false;
  let worstObstruction: ObstructionPoint | null = null;
  let worstIntrusion = -Infinity;

  let highestPoint = toObstructionPoint(first, 0);

  for (const sample of profile) {
    if (sample.elevationM > highestPoint.elevationM) {
      highestPoint = toObstructionPoint(sample, 0);
    }

    const d1 = sample.distanceM - first.distanceM;
    const d2 = last.distanceM - sample.distanceM;
    if (d1 <= 0 || d2 <= 0) continue; // endpoints can't obstruct themselves

    const bulgeM = earthCurvatureBulgeM(d1, d2);
    const adjustedTerrainM = sample.elevationM + bulgeM;

    const t = d1 / totalDistanceM;
    const losHeightM = hA + (hB - hA) * t;

    const f1RadiusM = fresnelZoneRadiusM(frequencyHz, d1, d2);
    const requiredClearHeightM = losHeightM - FRESNEL_CLEARANCE_FRACTION * f1RadiusM;

    const intrusionM = adjustedTerrainM - requiredClearHeightM;
    if (intrusionM > worstIntrusion) {
      worstIntrusion = intrusionM;
      worstObstruction = toObstructionPoint(sample, intrusionM);
    }

    if (adjustedTerrainM > losHeightM) {
      hardBlocked = true;
    }
  }

  const clear = worstIntrusion <= 0;

  return {
    clear,
    hardBlocked,
    worstObstruction: clear ? null : worstObstruction,
    highestPoint,
  };
}

/**
 * Full link analysis between two repeaters: samples the great-circle path,
 * fetches terrain elevation from local DEM tiles, and evaluates LOS/Fresnel
 * clearance. Throws DemCoverageError if either repeater (or a point along
 * the path) falls outside the local DEM coverage area.
 */
export async function analyzeLink(
  repeaterA: Repeater,
  repeaterB: Repeater,
  frequencyHz: number,
): Promise<LinkResult> {
  const pathPoints = sampleGreatCirclePath(repeaterA.lat, repeaterA.lon, repeaterB.lat, repeaterB.lon);
  const profile = await annotateProfileWithElevation(pathPoints);

  const { clear, hardBlocked, worstObstruction, highestPoint } = analyzeProfile(
    profile,
    repeaterA.antennaHeightM,
    repeaterB.antennaHeightM,
    frequencyHz,
  );

  return {
    repeaterAId: repeaterA.id,
    repeaterBId: repeaterB.id,
    frequencyHz,
    distanceM: profile[profile.length - 1].distanceM,
    profile,
    antennaTopAM: profile[0].elevationM + repeaterA.antennaHeightM,
    antennaTopBM: profile[profile.length - 1].elevationM + repeaterB.antennaHeightM,
    clear,
    hardBlocked,
    worstObstruction,
    highestPoint,
  };
}
