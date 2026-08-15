import {
  DEFAULT_ANTENNA_GAIN_DBI,
  DEFAULT_ANTENNA_HEIGHT_M,
  DEFAULT_CABLE_LOSS_DB,
  DEFAULT_RX_SENSITIVITY_DBM,
  DEFAULT_TX_POWER_DBM,
} from '../config';
import type { Repeater } from './types';

export type RawRepeater = Partial<Repeater> & Pick<Repeater, 'id' | 'name' | 'lat' | 'lon'>;

/**
 * Backfills RF config fields with defaults, for repeaters saved to
 * localStorage or exported to JSON before those fields existed.
 */
export function normalizeRepeater(raw: RawRepeater): Repeater {
  return {
    id: raw.id,
    name: raw.name,
    lat: raw.lat,
    lon: raw.lon,
    antennaHeightM: raw.antennaHeightM ?? DEFAULT_ANTENNA_HEIGHT_M,
    txPowerDbm: raw.txPowerDbm ?? DEFAULT_TX_POWER_DBM,
    antennaGainDbi: raw.antennaGainDbi ?? DEFAULT_ANTENNA_GAIN_DBI,
    cableLossDb: raw.cableLossDb ?? DEFAULT_CABLE_LOSS_DB,
    rxSensitivityDbm: raw.rxSensitivityDbm ?? DEFAULT_RX_SENSITIVITY_DBM,
  };
}
