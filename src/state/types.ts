export interface Repeater {
  id: string;
  name: string;
  lat: number;
  lon: number;
  /** Antenna height above ground level, in meters. */
  antennaHeightM: number;
}

export interface DemTileMeta {
  id: string;
  file: string;
  /** [minLon, minLat, maxLon, maxLat] */
  bbox: [number, number, number, number];
}

export interface DemManifest {
  tiles: DemTileMeta[];
}

export interface ProfileSample {
  distanceM: number;
  lat: number;
  lon: number;
  elevationM: number;
}

export interface ObstructionPoint {
  distanceM: number;
  lat: number;
  lon: number;
  elevationM: number;
  /**
   * How far the terrain intrudes past the required Fresnel clearance line,
   * in meters. Positive means obstructed.
   */
  intrusionM: number;
}

export interface LinkResult {
  repeaterAId: string;
  repeaterBId: string;
  frequencyHz: number;
  distanceM: number;
  profile: ProfileSample[];
  /** Antenna-top height above sea level at each endpoint, in meters (terrain + AGL height). */
  antennaTopAM: number;
  antennaTopBM: number;
  /** True only if the first Fresnel zone stays sufficiently clear along the whole path. */
  clear: boolean;
  /** True if terrain physically crosses the direct sightline (worse than a Fresnel intrusion). */
  hardBlocked: boolean;
  /** Point of greatest Fresnel-clearance violation; null if the link is clear. */
  worstObstruction: ObstructionPoint | null;
  /** Highest terrain elevation anywhere along the path — a candidate relay site. */
  highestPoint: ObstructionPoint;
}

export interface ExportedState {
  schemaVersion: 1;
  repeaters: Repeater[];
}
