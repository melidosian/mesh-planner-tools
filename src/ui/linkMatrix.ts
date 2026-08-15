import type { Repeater } from '../state/types';

export type MatrixRowStatus = 'pending' | 'clear' | 'obstructed' | 'no-coverage' | 'error';

export interface MatrixRow {
  repeaterAId: string;
  repeaterBId: string;
  status: MatrixRowStatus;
  distanceKm?: number;
  /** Worse of the two directions' link-budget margin, in dB. */
  marginDb?: number;
}

export interface LinkMatrixCallbacks {
  onComputeAll(): void;
  onSelectPair(repeaterAId: string, repeaterBId: string): void;
}

const STATUS_LABELS: Record<MatrixRowStatus, string> = {
  pending: 'Computing…',
  clear: 'Clear',
  obstructed: 'Obstructed',
  'no-coverage': 'No DEM coverage',
  error: 'Error',
};

export class LinkMatrix {
  constructor(
    private container: HTMLElement,
    private callbacks: LinkMatrixCallbacks,
  ) {}

  render(repeaters: Repeater[], rows: MatrixRow[] | null, computing: boolean): void {
    this.container.innerHTML = '';

    const title = document.createElement('h2');
    title.textContent = 'Network overview';
    this.container.appendChild(title);

    if (repeaters.length < 2) {
      const hint = document.createElement('p');
      hint.className = 'hint';
      hint.textContent = 'Add at least two repeaters to see an all-pairs overview.';
      this.container.appendChild(hint);
      return;
    }

    const button = document.createElement('button');
    button.type = 'button';
    button.textContent = computing ? 'Computing…' : rows ? 'Recompute all links' : 'Compute all links';
    button.disabled = computing;
    button.addEventListener('click', () => this.callbacks.onComputeAll());
    this.container.appendChild(button);

    if (!rows) return;

    this.container.appendChild(this.renderTable(repeaters, rows));
  }

  private renderTable(repeaters: Repeater[], rows: MatrixRow[]): HTMLElement {
    const nameById = new Map(repeaters.map((r) => [r.id, r.name]));

    const table = document.createElement('table');
    table.className = 'link-matrix-table';
    table.innerHTML = '<thead><tr><th>Link</th><th>Distance</th><th>Status</th><th>Worst margin</th></tr></thead>';

    const tbody = document.createElement('tbody');
    for (const row of rows) {
      const nameA = nameById.get(row.repeaterAId) ?? '?';
      const nameB = nameById.get(row.repeaterBId) ?? '?';
      const distance = row.distanceKm !== undefined ? `${row.distanceKm.toFixed(2)} km` : '—';
      const margin = row.marginDb !== undefined ? `${row.marginDb >= 0 ? '+' : ''}${row.marginDb.toFixed(1)} dB` : '—';

      const tr = document.createElement('tr');
      tr.className = 'matrix-row';
      tr.innerHTML = `<td>${nameA} ↔ ${nameB}</td><td>${distance}</td><td><span class="status-pill ${row.status}">${STATUS_LABELS[row.status]}</span></td><td>${margin}</td>`;
      tr.addEventListener('click', () => this.callbacks.onSelectPair(row.repeaterAId, row.repeaterBId));
      tbody.appendChild(tr);
    }
    table.appendChild(tbody);
    return table;
  }
}
