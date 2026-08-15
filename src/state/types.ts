export interface Repeater {
  id: string;
  name: string;
  lat: number;
  lon: number;
  /** Antenna height above ground level, in meters. */
  antennaHeightM: number;
  /** Radio transmit power, in dBm. */
  txPowerDbm: number;
  /** Antenna gain, in dBi. */
  antennaGainDbi: number;
  /** Feedline/connector loss between radio and antenna, in dB. */
  cableLossDb: number;
  /** Receiver sensitivity threshold of the radio at this repeater, in dBm. */
  rxSensitivityDbm: number;
}

export interface DirectionalLinkBudget {
  /** Estimated received power at the far end, in dBm (free-space path loss model). */
  receivedPowerDbm: number;
  /** receivedPowerDbm minus the receiving repeater's rxSensitivityDbm; positive means viable. */
  marginDb: number;
}

export interface LinkBudget {
  /** Free-space path loss over the link distance at the analysis frequency, in dB. */
  pathLossDb: number;
  /** Budget for repeaterA transmitting to repeaterB. */
  aToB: DirectionalLinkBudget;
  /** Budget for repeaterB transmitting to repeaterA. */
  bToA: DirectionalLinkBudget;
  /** True only if both directions clear their respective receiver's sensitivity threshold. */
  viable: boolean;
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
  /**
   * Estimated link budget from each repeater's power/gain/cable-loss/
   * sensitivity config, using free-space path loss. Most accurate when
   * `clear` is true — an obstructed path will perform worse than this
   * predicts, since it doesn't model diffraction/knife-edge loss.
   */
  linkBudget: LinkBudget;
}

export interface ExportedState {
  schemaVersion: 1;
  repeaters: Repeater[];
}
