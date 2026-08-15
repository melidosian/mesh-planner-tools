export interface RepeaterFieldValues {
  name: string;
  antennaHeightM: number;
  txPowerDbm: number;
  antennaGainDbi: number;
  cableLossDb: number;
  rxSensitivityDbm: number;
}

interface RepeaterFieldInputs {
  name: HTMLInputElement;
  antennaHeightM: HTMLInputElement;
  txPowerDbm: HTMLInputElement;
  antennaGainDbi: HTMLInputElement;
  cableLossDb: HTMLInputElement;
  rxSensitivityDbm: HTMLInputElement;
}

function numberField(labelText: string, name: string, value: number, step: string, min?: string): { row: HTMLElement; input: HTMLInputElement } {
  const label = document.createElement('label');
  label.textContent = labelText;
  const input = document.createElement('input');
  input.name = name;
  input.type = 'number';
  input.step = step;
  if (min !== undefined) input.min = min;
  input.value = String(value);
  input.required = true;
  label.appendChild(input);
  return { row: label, input };
}

/**
 * Builds the shared set of labeled inputs (name + all RF config fields)
 * used by both the "add repeater" form and the per-repeater edit form.
 */
export function buildRepeaterFields(values: RepeaterFieldValues): { rows: HTMLElement[]; inputs: RepeaterFieldInputs } {
  const nameLabel = document.createElement('label');
  nameLabel.textContent = 'Name';
  const nameInput = document.createElement('input');
  nameInput.name = 'name';
  nameInput.required = true;
  nameInput.value = values.name;
  nameLabel.appendChild(nameInput);

  const height = numberField('Antenna height (m AGL)', 'antennaHeightM', values.antennaHeightM, '0.5', '0');
  const txPower = numberField('TX power (dBm)', 'txPowerDbm', values.txPowerDbm, '0.5');
  const antennaGain = numberField('Antenna gain (dBi)', 'antennaGainDbi', values.antennaGainDbi, '0.5', '0');
  const cableLoss = numberField('Cable loss (dB)', 'cableLossDb', values.cableLossDb, '0.1', '0');
  const rxSensitivity = numberField('RX sensitivity (dBm)', 'rxSensitivityDbm', values.rxSensitivityDbm, '0.5');

  return {
    rows: [nameLabel, height.row, txPower.row, antennaGain.row, cableLoss.row, rxSensitivity.row],
    inputs: {
      name: nameInput,
      antennaHeightM: height.input,
      txPowerDbm: txPower.input,
      antennaGainDbi: antennaGain.input,
      cableLossDb: cableLoss.input,
      rxSensitivityDbm: rxSensitivity.input,
    },
  };
}

/** Reads and validates the current values from a set of built inputs; null if anything is invalid. */
export function readRepeaterFields(inputs: RepeaterFieldInputs): RepeaterFieldValues | null {
  const name = inputs.name.value.trim();
  const antennaHeightM = Number(inputs.antennaHeightM.value);
  const txPowerDbm = Number(inputs.txPowerDbm.value);
  const antennaGainDbi = Number(inputs.antennaGainDbi.value);
  const cableLossDb = Number(inputs.cableLossDb.value);
  const rxSensitivityDbm = Number(inputs.rxSensitivityDbm.value);

  if (!name) return null;
  if ([antennaHeightM, txPowerDbm, antennaGainDbi, cableLossDb, rxSensitivityDbm].some(Number.isNaN)) return null;

  return { name, antennaHeightM, txPowerDbm, antennaGainDbi, cableLossDb, rxSensitivityDbm };
}

/** One-line summary of a repeater's RF config, for compact list display. */
export function formatRepeaterSummary(values: RepeaterFieldValues): string {
  return `${values.antennaHeightM}m AGL · ${values.txPowerDbm}dBm · ${values.antennaGainDbi}dBi gain · ${values.cableLossDb}dB cable · ${values.rxSensitivityDbm}dBm sens.`;
}
