import { EARTH_RADIUS_M } from '../config';

const toRad = (deg: number): number => (deg * Math.PI) / 180;
const toDeg = (rad: number): number => (rad * 180) / Math.PI;

/** Great-circle distance between two lat/lon points, in meters. */
export function haversineDistanceM(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number,
): number {
  const phi1 = toRad(lat1);
  const phi2 = toRad(lat2);
  const dPhi = toRad(lat2 - lat1);
  const dLambda = toRad(lon2 - lon1);
  const a =
    Math.sin(dPhi / 2) ** 2 +
    Math.cos(phi1) * Math.cos(phi2) * Math.sin(dLambda / 2) ** 2;
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return EARTH_RADIUS_M * c;
}

/** Initial bearing from point 1 to point 2, in radians. */
export function bearingRad(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const phi1 = toRad(lat1);
  const phi2 = toRad(lat2);
  const dLambda = toRad(lon2 - lon1);
  const y = Math.sin(dLambda) * Math.cos(phi2);
  const x = Math.cos(phi1) * Math.sin(phi2) - Math.sin(phi1) * Math.cos(phi2) * Math.cos(dLambda);
  return Math.atan2(y, x);
}

/**
 * Perpendicular distance, in meters, from a point to the great circle
 * running through two line-defining points (not clamped to the segment
 * between them). Positive/negative indicates which side of the line.
 */
export function crossTrackDistanceM(
  pointLat: number,
  pointLon: number,
  lineStartLat: number,
  lineStartLon: number,
  lineEndLat: number,
  lineEndLon: number,
): number {
  const angularDistance13 = haversineDistanceM(lineStartLat, lineStartLon, pointLat, pointLon) / EARTH_RADIUS_M;
  const bearing13 = bearingRad(lineStartLat, lineStartLon, pointLat, pointLon);
  const bearing12 = bearingRad(lineStartLat, lineStartLon, lineEndLat, lineEndLon);
  return Math.asin(Math.sin(angularDistance13) * Math.sin(bearing13 - bearing12)) * EARTH_RADIUS_M;
}

export { toRad, toDeg };
