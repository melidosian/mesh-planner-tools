import { EFFECTIVE_EARTH_RADIUS_M } from '../config';

/**
 * Height, in meters, that the earth's surface "bulges up" at a point between
 * two ends of a path, due to earth curvature (partially offset by
 * atmospheric refraction, captured by the 4/3-effective-radius model).
 *
 * @param d1 distance from the first endpoint to this point, in meters
 * @param d2 distance from this point to the second endpoint, in meters
 */
export function earthCurvatureBulgeM(d1: number, d2: number): number {
  return (d1 * d2) / (2 * EFFECTIVE_EARTH_RADIUS_M);
}
