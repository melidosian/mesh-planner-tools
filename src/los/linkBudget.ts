import { SPEED_OF_LIGHT_M_S } from '../config';
import type { DirectionalLinkBudget, LinkBudget, Repeater } from '../state/types';

/**
 * Free-space path loss (Friis transmission equation), in dB.
 *
 * FSPL = 20*log10(d) + 20*log10(f) + 20*log10(4*pi/c), derived directly in
 * SI units (distance in meters, frequency in Hz) rather than the common
 * "20log10(d_km) + 20log10(f_MHz) + 32.44" shortcut, to avoid unit-
 * conversion mistakes. The two are cross-checked against each other in
 * unit tests.
 */
export function freeSpacePathLossDb(distanceM: number, frequencyHz: number): number {
  const constantDb = 20 * Math.log10((4 * Math.PI) / SPEED_OF_LIGHT_M_S);
  return 20 * Math.log10(distanceM) + 20 * Math.log10(frequencyHz) + constantDb;
}

/**
 * Estimated received power at one end of a link, in dBm, given the
 * transmitting side's power/gain/cable-loss, the receiving side's
 * gain/cable-loss, and the path loss between them.
 */
export function receivedPowerDbm(
  txPowerDbm: number,
  txAntennaGainDbi: number,
  txCableLossDb: number,
  rxAntennaGainDbi: number,
  rxCableLossDb: number,
  pathLossDb: number,
): number {
  return txPowerDbm + txAntennaGainDbi - txCableLossDb - pathLossDb + rxAntennaGainDbi - rxCableLossDb;
}

function directionalBudget(
  tx: Repeater,
  rx: Repeater,
  pathLossDb: number,
): DirectionalLinkBudget {
  const receivedPowerDbmValue = receivedPowerDbm(
    tx.txPowerDbm,
    tx.antennaGainDbi,
    tx.cableLossDb,
    rx.antennaGainDbi,
    rx.cableLossDb,
    pathLossDb,
  );
  return {
    receivedPowerDbm: receivedPowerDbmValue,
    marginDb: receivedPowerDbmValue - rx.rxSensitivityDbm,
  };
}

/**
 * Full link budget between two repeaters at a given distance/frequency,
 * using each repeater's own power/gain/cable-loss/sensitivity config.
 * Computed independently in each direction since the two ends' equipment
 * can differ.
 */
export function computeLinkBudget(repeaterA: Repeater, repeaterB: Repeater, distanceM: number, frequencyHz: number): LinkBudget {
  const pathLossDb = freeSpacePathLossDb(distanceM, frequencyHz);
  const aToB = directionalBudget(repeaterA, repeaterB, pathLossDb);
  const bToA = directionalBudget(repeaterB, repeaterA, pathLossDb);
  return {
    pathLossDb,
    aToB,
    bToA,
    viable: aToB.marginDb >= 0 && bToA.marginDb >= 0,
  };
}
