import { describe, expect, it } from 'vitest';
import { computeLinkBudget, freeSpacePathLossDb, receivedPowerDbm } from '../../src/los/linkBudget';
import type { Repeater } from '../../src/state/types';

describe('freeSpacePathLossDb', () => {
  it('matches the standard 32.44 shortcut-constant formula at 2.4GHz, 10km', () => {
    const distanceKm = 10;
    const freqMHz = 2400;
    // Standard shortcut: FSPL(dB) = 20log10(d_km) + 20log10(f_MHz) + 32.44
    const shortcut = 20 * Math.log10(distanceKm) + 20 * Math.log10(freqMHz) + 32.44;

    const fspl = freeSpacePathLossDb(10_000, 2.4e9);
    expect(fspl).toBeCloseTo(shortcut, 0);
  });

  it('increases by ~6dB when distance doubles', () => {
    const a = freeSpacePathLossDb(1000, 2.4e9);
    const b = freeSpacePathLossDb(2000, 2.4e9);
    expect(b - a).toBeCloseTo(20 * Math.log10(2), 6);
  });

  it('increases by ~6dB when frequency doubles', () => {
    const a = freeSpacePathLossDb(10_000, 900e6);
    const b = freeSpacePathLossDb(10_000, 1.8e9);
    expect(b - a).toBeCloseTo(20 * Math.log10(2), 6);
  });
});

describe('receivedPowerDbm', () => {
  it('sums gains and subtracts losses in dB', () => {
    // 20 + 8 - 1 - 100 + 8 - 1 = -66
    const received = receivedPowerDbm(20, 8, 1, 8, 1, 100);
    expect(received).toBeCloseTo(-66, 6);
  });
});

function makeRepeater(overrides: Partial<Repeater>): Repeater {
  return {
    id: 'r',
    name: 'r',
    lat: 45,
    lon: -89,
    antennaHeightM: 10,
    txPowerDbm: 20,
    antennaGainDbi: 8,
    cableLossDb: 1,
    rxSensitivityDbm: -89,
    ...overrides,
  };
}

describe('computeLinkBudget', () => {
  it('is viable when received power comfortably clears both sensitivities', () => {
    const a = makeRepeater({ id: 'a' });
    const b = makeRepeater({ id: 'b' });
    const budget = computeLinkBudget(a, b, 2000, 2.4e9);
    expect(budget.viable).toBe(true);
    expect(budget.aToB.marginDb).toBeGreaterThan(0);
    expect(budget.bToA.marginDb).toBeGreaterThan(0);
  });

  it('is not viable when distance pushes received power below sensitivity', () => {
    const a = makeRepeater({ id: 'a' });
    const b = makeRepeater({ id: 'b' });
    const budget = computeLinkBudget(a, b, 500_000, 2.4e9);
    expect(budget.viable).toBe(false);
    expect(budget.aToB.marginDb).toBeLessThan(0);
  });

  it('computes each direction using the correct endpoint equipment', () => {
    const weak = makeRepeater({ id: 'weak', txPowerDbm: 0 });
    const strong = makeRepeater({ id: 'strong', txPowerDbm: 30 });
    const budget = computeLinkBudget(weak, strong, 5000, 2.4e9);
    // weak -> strong uses weak's low tx power; strong -> weak uses strong's high tx power.
    expect(budget.bToA.receivedPowerDbm).toBeGreaterThan(budget.aToB.receivedPowerDbm);
    expect(budget.bToA.receivedPowerDbm - budget.aToB.receivedPowerDbm).toBeCloseTo(30, 6);
  });

  it('is asymmetric when only sensitivity differs between endpoints', () => {
    const sensitive = makeRepeater({ id: 'sensitive', rxSensitivityDbm: -95 });
    const deaf = makeRepeater({ id: 'deaf', rxSensitivityDbm: -70 });
    const budget = computeLinkBudget(sensitive, deaf, 5000, 2.4e9);
    // Same received power both ways (symmetric tx/gain), but margin differs
    // because it's compared against the *receiving* side's sensitivity.
    expect(budget.aToB.receivedPowerDbm).toBeCloseTo(budget.bToA.receivedPowerDbm, 6);
    expect(budget.aToB.marginDb).not.toBeCloseTo(budget.bToA.marginDb, 6);
  });
});
