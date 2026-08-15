import type { ExportedState, Repeater } from '../state/types';

export function exportRepeatersToFile(repeaters: Repeater[]): void {
  const payload: ExportedState = { schemaVersion: 1, repeaters };
  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `mesh-repeaters-${new Date().toISOString().slice(0, 10)}.json`;
  a.click();
  URL.revokeObjectURL(url);
}

function isValidRepeater(value: unknown): value is Repeater {
  if (typeof value !== 'object' || value === null) return false;
  const r = value as Record<string, unknown>;
  return (
    typeof r.id === 'string' &&
    typeof r.name === 'string' &&
    typeof r.lat === 'number' &&
    typeof r.lon === 'number' &&
    typeof r.antennaHeightM === 'number'
  );
}

export async function readRepeatersFromFile(file: File): Promise<Repeater[]> {
  const text = await file.text();
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    throw new Error('That file is not valid JSON.');
  }

  const candidate = parsed as Partial<ExportedState>;
  if (candidate.schemaVersion !== 1 || !Array.isArray(candidate.repeaters)) {
    throw new Error('Unrecognized repeater file format.');
  }
  if (!candidate.repeaters.every(isValidRepeater)) {
    throw new Error('Repeater file contains invalid entries.');
  }

  return candidate.repeaters;
}
