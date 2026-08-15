import {
  DEFAULT_ANTENNA_GAIN_DBI,
  DEFAULT_CABLE_LOSS_DB,
  DEFAULT_RELAY_ANTENNA_HEIGHT_M,
  DEFAULT_RX_SENSITIVITY_DBM,
  DEFAULT_TX_POWER_DBM,
  RELAY_MAX_CANDIDATES_TO_TEST,
  RELAY_MAX_DETOUR_RATIO,
  RELAY_MIN_CANDIDATE_SPACING_M,
  RELAY_SEARCH_CORRIDOR_HALF_WIDTH_M,
  RELAY_SEARCH_GRID_SPACING_M,
} from '../config';
import { sampleElevationGrid, type GridPoint } from '../elevation/demReader';
import type { LinkResult, Repeater } from '../state/types';
import { crossTrackDistanceM, haversineDistanceM } from '../utils/geo';
import { analyzeLink } from './losAnalysis';

export interface RelayCandidate {
  lat: number;
  lon: number;
  elevationM: number;
  /** repeaterA -> candidate */
  legA: LinkResult;
  /** candidate -> repeaterB */
  legB: LinkResult;
  bothClear: boolean;
}

export interface RelaySearchResult {
  /** Best candidate found, or null if the search area had no usable terrain data. */
  candidate: RelayCandidate | null;
  candidatesTested: number;
  bothClearFound: boolean;
}

function metersPerDegree(lat: number): { lat: number; lon: number } {
  const latRad = (lat * Math.PI) / 180;
  return { lat: 111_320, lon: 111_320 * Math.cos(latRad) };
}

/** Bounding box around A and B, padded by padM in every direction. */
export function buildSearchBbox(
  a: Pick<Repeater, 'lat' | 'lon'>,
  b: Pick<Repeater, 'lat' | 'lon'>,
  padM: number,
): [number, number, number, number] {
  const midLat = (a.lat + b.lat) / 2;
  const m = metersPerDegree(midLat);
  const padLat = padM / m.lat;
  const padLon = padM / m.lon;
  return [
    Math.min(a.lon, b.lon) - padLon,
    Math.min(a.lat, b.lat) - padLat,
    Math.max(a.lon, b.lon) + padLon,
    Math.max(a.lat, b.lat) + padLat,
  ];
}

/**
 * Filters grid points to those within corridorHalfWidthM of the direct A-B
 * line AND within maxDetourRatio of the direct distance (i.e. distance
 * A-candidate + candidate-B isn't much more than distance A-B) -- ranks by
 * elevation, and picks up to maxCandidates well-separated peaks (skipping
 * any within minSpacingM of an already-picked, higher candidate).
 *
 * The detour bound matters more than it might look: a tall hill well past
 * one endpoint can have near-zero perpendicular offset from the line's
 * bearing extended, so a cross-track-only filter lets it through even
 * though routing through it roughly doubles the total path -- not "nearby
 * the path" in any useful sense, and a real relay site shouldn't add a lot
 * of extra distance/loss versus the direct link. Pure and DEM-free, so
 * it's the testable core of the search.
 */
export function selectCandidatePoints(
  gridPoints: GridPoint[],
  a: Pick<Repeater, 'lat' | 'lon'>,
  b: Pick<Repeater, 'lat' | 'lon'>,
  corridorHalfWidthM: number,
  minSpacingM: number,
  maxCandidates: number,
  maxDetourRatio: number,
): GridPoint[] {
  const totalDistanceM = haversineDistanceM(a.lat, a.lon, b.lat, b.lon);

  const inCorridor = gridPoints.filter((p) => {
    const crossTrack = crossTrackDistanceM(p.lat, p.lon, a.lat, a.lon, b.lat, b.lon);
    if (Math.abs(crossTrack) > corridorHalfWidthM) return false;
    const detourM = haversineDistanceM(a.lat, a.lon, p.lat, p.lon) + haversineDistanceM(p.lat, p.lon, b.lat, b.lon);
    return detourM <= totalDistanceM * maxDetourRatio;
  });

  const sorted = [...inCorridor].sort((x, y) => y.elevationM - x.elevationM);

  const selected: GridPoint[] = [];
  for (const point of sorted) {
    if (selected.length >= maxCandidates) break;
    const tooClose = selected.some((s) => haversineDistanceM(s.lat, s.lon, point.lat, point.lon) < minSpacingM);
    if (!tooClose) selected.push(point);
  }
  return selected;
}

function makeCandidateRepeater(point: GridPoint, antennaHeightM: number): Repeater {
  return {
    id: 'candidate-relay',
    name: 'Candidate relay',
    lat: point.lat,
    lon: point.lon,
    antennaHeightM,
    txPowerDbm: DEFAULT_TX_POWER_DBM,
    antennaGainDbi: DEFAULT_ANTENNA_GAIN_DBI,
    cableLossDb: DEFAULT_CABLE_LOSS_DB,
    rxSensitivityDbm: DEFAULT_RX_SENSITIVITY_DBM,
  };
}

/** How obstructed a leg is: 0 if clear, otherwise the worst Fresnel intrusion in meters. */
function legBadness(leg: LinkResult): number {
  return leg.clear ? 0 : (leg.worstObstruction?.intrusionM ?? 0);
}

/**
 * Searches a corridor around the direct path between two repeaters for a
 * high point that would give clear LOS to both -- a candidate relay site.
 * Tests candidates highest-elevation-first and stops at the first one that
 * clears both legs; if none do, returns the least-obstructed candidate
 * tested as a best-effort suggestion.
 */
export async function findRelayCandidate(
  repeaterA: Repeater,
  repeaterB: Repeater,
  frequencyHz: number,
  relayAntennaHeightM: number = DEFAULT_RELAY_ANTENNA_HEIGHT_M,
): Promise<RelaySearchResult> {
  const bbox = buildSearchBbox(repeaterA, repeaterB, RELAY_SEARCH_CORRIDOR_HALF_WIDTH_M);
  const gridPoints = await sampleElevationGrid(bbox, RELAY_SEARCH_GRID_SPACING_M);

  const candidates = selectCandidatePoints(
    gridPoints,
    repeaterA,
    repeaterB,
    RELAY_SEARCH_CORRIDOR_HALF_WIDTH_M,
    RELAY_MIN_CANDIDATE_SPACING_M,
    RELAY_MAX_CANDIDATES_TO_TEST,
    RELAY_MAX_DETOUR_RATIO,
  );

  let best: RelayCandidate | null = null;
  let bestBadness = Infinity;
  let bothClearFound = false;

  for (const point of candidates) {
    const candidateRepeater = makeCandidateRepeater(point, relayAntennaHeightM);
    let legA: LinkResult;
    let legB: LinkResult;
    try {
      [legA, legB] = await Promise.all([
        analyzeLink(repeaterA, candidateRepeater, frequencyHz),
        analyzeLink(candidateRepeater, repeaterB, frequencyHz),
      ]);
    } catch {
      // A path to/from this candidate clipped outside DEM coverage -- skip it.
      continue;
    }

    const bothClear = legA.clear && legB.clear;
    const badness = legBadness(legA) + legBadness(legB);

    if (bothClear) {
      best = { lat: point.lat, lon: point.lon, elevationM: point.elevationM, legA, legB, bothClear };
      bothClearFound = true;
      break;
    }

    if (badness < bestBadness) {
      bestBadness = badness;
      best = { lat: point.lat, lon: point.lon, elevationM: point.elevationM, legA, legB, bothClear };
    }
  }

  return { candidate: best, candidatesTested: candidates.length, bothClearFound };
}
