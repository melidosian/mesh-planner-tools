import { SPEED_OF_LIGHT_M_S } from '../config';

/**
 * Radius of the first Fresnel zone at a point along a path, in meters.
 *
 * F1 = sqrt(lambda * d1 * d2 / (d1 + d2)), derived directly from the
 * wavelength (SI units throughout) rather than the common
 * "17.31 * sqrt(d1*d2/(f*D))" shortcut constant, to avoid unit-conversion
 * mistakes. The two are cross-checked against each other in unit tests.
 *
 * @param frequencyHz radio frequency in Hz
 * @param d1 distance from the first endpoint to this point, in meters
 * @param d2 distance from this point to the second endpoint, in meters
 */
export function fresnelZoneRadiusM(
  frequencyHz: number,
  d1: number,
  d2: number,
): number {
  const wavelengthM = SPEED_OF_LIGHT_M_S / frequencyHz;
  const totalDistanceM = d1 + d2;
  if (totalDistanceM <= 0) return 0;
  return Math.sqrt((wavelengthM * d1 * d2) / totalDistanceM);
}
