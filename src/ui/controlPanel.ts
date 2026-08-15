import { FREQUENCY_PRESETS } from '../config';
import type { Repeater } from '../state/types';

export interface ControlPanelState {
  repeaters: Repeater[];
  selectedIds: string[];
  frequencyHz: number;
  outOfCoverage: ReadonlySet<string>;
  pendingLatLon: { lat: number; lon: number } | null;
  defaultAntennaHeightM: number;
}

export interface ControlPanelCallbacks {
  onAddRepeater(data: { name: string; antennaHeightM: number }): void;
  onUpdateRepeater(id: string, patch: Partial<Pick<Repeater, 'name' | 'antennaHeightM'>>): void;
  onDeleteRepeater(id: string): void;
  onToggleSelect(id: string): void;
  onFrequencyChange(hz: number): void;
  onAnalyze(): void;
  onCancelAdd(): void;
  onExport(): void;
  onImportFile(file: File): void;
}

export class ControlPanel {
  constructor(
    private container: HTMLElement,
    private callbacks: ControlPanelCallbacks,
  ) {}

  render(state: ControlPanelState): void {
    this.container.innerHTML = '';
    this.container.appendChild(this.renderAddForm(state));
    this.container.appendChild(this.renderRepeaterList(state));
    this.container.appendChild(this.renderLinkControls(state));
    this.container.appendChild(this.renderImportExport());
  }

  private renderAddForm(state: ControlPanelState): HTMLElement {
    const wrap = document.createElement('div');
    wrap.className = 'panel-section';

    if (!state.pendingLatLon) {
      const hint = document.createElement('p');
      hint.className = 'hint';
      hint.textContent = 'Click the map to add a repeater.';
      wrap.appendChild(hint);
      return wrap;
    }

    const { lat, lon } = state.pendingLatLon;
    const title = document.createElement('h3');
    title.textContent = 'New repeater';
    wrap.appendChild(title);

    const coords = document.createElement('p');
    coords.className = 'hint';
    coords.textContent = `${lat.toFixed(5)}, ${lon.toFixed(5)}`;
    wrap.appendChild(coords);

    const form = document.createElement('form');
    form.className = 'repeater-form';

    const nameLabel = document.createElement('label');
    nameLabel.textContent = 'Name';
    const nameInput = document.createElement('input');
    nameInput.name = 'name';
    nameInput.required = true;
    nameInput.value = `Repeater ${state.repeaters.length + 1}`;
    nameLabel.appendChild(nameInput);
    form.appendChild(nameLabel);

    const heightLabel = document.createElement('label');
    heightLabel.textContent = 'Antenna height (m AGL)';
    const heightInput = document.createElement('input');
    heightInput.name = 'antennaHeightM';
    heightInput.type = 'number';
    heightInput.min = '0';
    heightInput.step = '0.5';
    heightInput.value = String(state.defaultAntennaHeightM);
    heightInput.required = true;
    heightLabel.appendChild(heightInput);
    form.appendChild(heightLabel);

    const actions = document.createElement('div');
    actions.className = 'form-actions';
    const submit = document.createElement('button');
    submit.type = 'submit';
    submit.textContent = 'Add';
    const cancel = document.createElement('button');
    cancel.type = 'button';
    cancel.textContent = 'Cancel';
    cancel.addEventListener('click', () => this.callbacks.onCancelAdd());
    actions.append(submit, cancel);
    form.appendChild(actions);

    form.addEventListener('submit', (e) => {
      e.preventDefault();
      const name = nameInput.value.trim();
      const antennaHeightM = Number(heightInput.value);
      if (!name || Number.isNaN(antennaHeightM)) return;
      this.callbacks.onAddRepeater({ name, antennaHeightM });
    });

    wrap.appendChild(form);
    return wrap;
  }

  private renderRepeaterList(state: ControlPanelState): HTMLElement {
    const wrap = document.createElement('div');
    wrap.className = 'panel-section';

    const title = document.createElement('h3');
    title.textContent = `Repeaters (${state.repeaters.length})`;
    wrap.appendChild(title);

    if (state.repeaters.length === 0) {
      const p = document.createElement('p');
      p.className = 'hint';
      p.textContent = 'None yet.';
      wrap.appendChild(p);
      return wrap;
    }

    const list = document.createElement('ul');
    list.className = 'repeater-list';

    for (const repeater of state.repeaters) {
      const selected = state.selectedIds.includes(repeater.id);
      const outOfCoverage = state.outOfCoverage.has(repeater.id);

      const item = document.createElement('li');
      item.className = `repeater-item${selected ? ' selected' : ''}${outOfCoverage ? ' out-of-coverage' : ''}`;

      const label = document.createElement('button');
      label.type = 'button';
      label.className = 'repeater-select';
      label.textContent = `${repeater.name}${outOfCoverage ? ' (no DEM coverage)' : ''}`;
      label.addEventListener('click', () => this.callbacks.onToggleSelect(repeater.id));
      item.appendChild(label);

      const heightInput = document.createElement('input');
      heightInput.type = 'number';
      heightInput.min = '0';
      heightInput.step = '0.5';
      heightInput.value = String(repeater.antennaHeightM);
      heightInput.title = 'Antenna height (m AGL)';
      heightInput.addEventListener('change', () => {
        const value = Number(heightInput.value);
        if (!Number.isNaN(value)) this.callbacks.onUpdateRepeater(repeater.id, { antennaHeightM: value });
      });
      item.appendChild(heightInput);

      const del = document.createElement('button');
      del.type = 'button';
      del.className = 'repeater-delete';
      del.textContent = '✕';
      del.title = 'Delete repeater';
      del.addEventListener('click', () => this.callbacks.onDeleteRepeater(repeater.id));
      item.appendChild(del);

      list.appendChild(item);
    }

    wrap.appendChild(list);
    return wrap;
  }

  private renderLinkControls(state: ControlPanelState): HTMLElement {
    const wrap = document.createElement('div');
    wrap.className = 'panel-section';

    const title = document.createElement('h3');
    title.textContent = 'Check link';
    wrap.appendChild(title);

    const hint = document.createElement('p');
    hint.className = 'hint';
    hint.textContent =
      state.selectedIds.length === 2
        ? 'Two repeaters selected.'
        : `Select ${2 - state.selectedIds.length} more repeater(s) (click a marker or the list).`;
    wrap.appendChild(hint);

    const freqLabel = document.createElement('label');
    freqLabel.textContent = 'Frequency ';
    const select = document.createElement('select');
    for (const preset of FREQUENCY_PRESETS) {
      const opt = document.createElement('option');
      opt.value = String(preset.hz);
      opt.textContent = preset.label;
      if (preset.hz === state.frequencyHz) opt.selected = true;
      select.appendChild(opt);
    }
    select.addEventListener('change', () => this.callbacks.onFrequencyChange(Number(select.value)));
    freqLabel.appendChild(select);
    wrap.appendChild(freqLabel);

    const button = document.createElement('button');
    button.type = 'button';
    button.textContent = 'Analyze line-of-sight';
    button.disabled = state.selectedIds.length !== 2;
    button.addEventListener('click', () => this.callbacks.onAnalyze());
    wrap.appendChild(button);

    return wrap;
  }

  private renderImportExport(): HTMLElement {
    const wrap = document.createElement('div');
    wrap.className = 'panel-section';

    const exportBtn = document.createElement('button');
    exportBtn.type = 'button';
    exportBtn.textContent = 'Export repeaters (JSON)';
    exportBtn.addEventListener('click', () => this.callbacks.onExport());
    wrap.appendChild(exportBtn);

    const importLabel = document.createElement('label');
    importLabel.className = 'file-input-label';
    importLabel.textContent = 'Import repeaters (JSON)';
    const importInput = document.createElement('input');
    importInput.type = 'file';
    importInput.accept = 'application/json';
    importInput.addEventListener('change', () => {
      const file = importInput.files?.[0];
      if (file) this.callbacks.onImportFile(file);
      importInput.value = '';
    });
    importLabel.appendChild(importInput);
    wrap.appendChild(importLabel);

    return wrap;
  }
}
