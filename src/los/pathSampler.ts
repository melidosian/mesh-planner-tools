import { MAX_SAMPLES, SAMPLE_SPACING_TARGET_M } from '../config';
import { haversineDistanceM, toDeg, toRad } from '../utils/geo';

export interface PathPoint {
  distanceM: number;
  lat: number;
  lon: number;
}

/**
 * Samples points along the great-circle path between two lat/lon points,
 * including both endpoints, spaced roughly SAMPLE_SPACING_TARGET_M apart
 * (capped at MAX_SAMPLES total, so very long paths sample more coarsely
 * rather than growing unbounded).
 */
export function sampleGreatCirclePath(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number,
): PathPoint[] {
  const totalDistanceM = haversineDistanceM(lat1, lon1, lat2, lon2);

  if (totalDistanceM === 0) {
    return [{ distanceM: 0, lat: lat1, lon: lon1 }];
  }

  const targetCount = Math.ceil(totalDistanceM / SAMPLE_SPACING_TARGET_M);
  const sampleCount = Math.max(1, Math.min(MAX_SAMPLES, targetCount));

  const phi1 = toRad(lat1);
  const lambda1 = toRad(lon1);
  const phi2 = toRad(lat2);
  const lambda2 = toRad(lon2);

  const angularDistance =
    2 *
    Math.asin(
      Math.sqrt(
        Math.sin((phi2 - phi1) / 2) ** 2 +
          Math.cos(phi1) * Math.cos(phi2) * Math.sin((lambda2 - lambda1) / 2) ** 2,
      ),
    );
  const sinDelta = Math.sin(angularDistance);

  const points: PathPoint[] = [];
  for (let i = 0; i <= sampleCount; i++) {
    const t = i / sampleCount;

    let lat: number;
    let lon: number;
    if (sinDelta === 0) {
      // Coincident or antipodal-degenerate points: interpolate linearly.
      lat = toDeg(phi1 + (phi2 - phi1) * t);
      lon = toDeg(lambda1 + (lambda2 - lambda1) * t);
    } else {
      const a = Math.sin((1 - t) * angularDistance) / sinDelta;
      const b = Math.sin(t * angularDistance) / sinDelta;
      const x = a * Math.cos(phi1) * Math.cos(lambda1) + b * Math.cos(phi2) * Math.cos(lambda2);
      const y = a * Math.cos(phi1) * Math.sin(lambda1) + b * Math.cos(phi2) * Math.sin(lambda2);
      const z = a * Math.sin(phi1) + b * Math.sin(phi2);
      lat = toDeg(Math.atan2(z, Math.sqrt(x * x + y * y)));
      lon = toDeg(Math.atan2(y, x));
    }

    points.push({ distanceM: totalDistanceM * t, lat, lon });
  }

  return points;
}
