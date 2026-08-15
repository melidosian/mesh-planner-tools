/** Mean earth radius in meters. */
export const EARTH_RADIUS_M = 6_371_000;

/** Standard atmosphere effective earth-radius factor (k-factor). */
export const REFRACTION_K = 4 / 3;

/** Effective earth radius used for curvature bulge correction. */
export const EFFECTIVE_EARTH_RADIUS_M = REFRACTION_K * EARTH_RADIUS_M;

/** Speed of light in vacuum, m/s. */
export const SPEED_OF_LIGHT_M_S = 299_792_458;

/**
 * Fraction of the first Fresnel zone that must stay clear of terrain for a
 * link to be considered usable. 0.6 (60%) is the standard RF engineering
 * rule of thumb.
 */
export const FRESNEL_CLEARANCE_FRACTION = 0.6;

/** Default antenna height above ground level for new repeaters, in meters. */
export const DEFAULT_ANTENNA_HEIGHT_M = 10;

/** Default radio transmit power for new repeaters, in dBm (~100mW). */
export const DEFAULT_TX_POWER_DBM = 20;

/** Default antenna gain for new repeaters, in dBi (typical panel/sector antenna). */
export const DEFAULT_ANTENNA_GAIN_DBI = 8;

/** Default feedline/connector loss for new repeaters, in dB. */
export const DEFAULT_CABLE_LOSS_DB = 1;

/** Default receiver sensitivity for new repeaters, in dBm (typical 802.11 low-MCS sensitivity). */
export const DEFAULT_RX_SENSITIVITY_DBM = -89;

/** Target spacing between path samples, in meters (matches DEM resolution). */
export const SAMPLE_SPACING_TARGET_M = 30;

/** Hard cap on the number of samples taken along a path. */
export const MAX_SAMPLES = 2000;

export interface FrequencyPreset {
  label: string;
  hz: number;
}

/** Common bands used by amateur mesh radio networks (e.g. AREDN). */
export const FREQUENCY_PRESETS: FrequencyPreset[] = [
  { label: '900 MHz', hz: 900e6 },
  { label: '2.4 GHz', hz: 2.4e9 },
  { label: '3.6 GHz', hz: 3.6e9 },
  { label: '5.8 GHz', hz: 5.8e9 },
];

export const DEFAULT_FREQUENCY_HZ = 2.4e9;

export const DEM_MANIFEST_URL = `${import.meta.env.BASE_URL}dem/manifest.json`;

export const REPEATER_STORE_KEY = 'mesh-planner:repeaters:v1';
