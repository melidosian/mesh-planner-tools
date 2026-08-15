import { FREQUENCY_PRESETS } from '../config';
import type { Repeater } from '../state/types';
import { buildRepeaterFields, formatRepeaterSummary, readRepeaterFields, type RepeaterFieldValues } from './repeaterFieldsForm';

export interface ControlPanelState {
  repeaters: Repeater[];
  selectedIds: string[];
  frequencyHz: number;
  outOfCoverage: ReadonlySet<string>;
  pendingLatLon: { lat: number; lon: number } | null;
  defaultRepeaterValues: Omit<RepeaterFieldValues, 'name'>;
}

export interface ControlPanelCallbacks {
  onAddRepeater(data: RepeaterFieldValues): void;
  onUpdateRepeater(id: string, patch: RepeaterFieldValues): void;
  onDeleteRepeater(id: string): void;
  onToggleSelect(id: string): void;
  onFrequencyChange(hz: number): void;
  onAnalyze(): void;
  onCancelAdd(): void;
  onExport(): void;
  onImportFile(file: File): void;
}

export class ControlPanel {
  private expandedIds = new Set<string>();
  private lastState: ControlPanelState | null = null;

  constructor(
    private container: HTMLElement,
    private callbacks: ControlPanelCallbacks,
  ) {}

  render(state: ControlPanelState): void {
    this.lastState = state;
    this.container.innerHTML = '';
    this.container.appendChild(this.renderAddForm(state));
    this.container.appendChild(this.renderRepeaterList(state));
    this.container.appendChild(this.renderLinkControls(state));
    this.container.appendChild(this.renderImportExport());
  }

  private rerender(): void {
    if (this.lastState) this.render(this.lastState);
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

    const { rows, inputs } = buildRepeaterFields({
      name: `Repeater ${state.repeaters.length + 1}`,
      ...state.defaultRepeaterValues,
    });
    for (const row of rows) form.appendChild(row);

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
      const values = readRepeaterFields(inputs);
      if (!values) return;
      this.callbacks.onAddRepeater(values);
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
      list.appendChild(this.renderRepeaterItem(repeater, state));
    }

    wrap.appendChild(list);
    return wrap;
  }

  private renderRepeaterItem(repeater: Repeater, state: ControlPanelState): HTMLElement {
    const selected = state.selectedIds.includes(repeater.id);
    const outOfCoverage = state.outOfCoverage.has(repeater.id);
    const expanded = this.expandedIds.has(repeater.id);

    const item = document.createElement('li');
    item.className = `repeater-item${selected ? ' selected' : ''}${outOfCoverage ? ' out-of-coverage' : ''}`;

    const header = document.createElement('div');
    header.className = 'repeater-item-header';

    const body = document.createElement('div');
    body.className = 'repeater-item-body';

    const label = document.createElement('button');
    label.type = 'button';
    label.className = 'repeater-select';
    label.textContent = `${repeater.name}${outOfCoverage ? ' (no DEM coverage)' : ''}`;
    label.addEventListener('click', () => this.callbacks.onToggleSelect(repeater.id));
    body.appendChild(label);

    const summary = document.createElement('p');
    summary.className = 'repeater-summary';
    summary.textContent = formatRepeaterSummary(repeater);
    body.appendChild(summary);

    header.appendChild(body);

    const editToggle = document.createElement('button');
    editToggle.type = 'button';
    editToggle.className = 'repeater-edit-toggle';
    editToggle.textContent = expanded ? 'Done' : 'Edit';
    editToggle.addEventListener('click', () => {
      if (expanded) this.expandedIds.delete(repeater.id);
      else this.expandedIds.add(repeater.id);
      this.rerender();
    });
    header.appendChild(editToggle);

    const del = document.createElement('button');
    del.type = 'button';
    del.className = 'repeater-delete';
    del.textContent = '✕';
    del.title = 'Delete repeater';
    del.addEventListener('click', () => this.callbacks.onDeleteRepeater(repeater.id));
    header.appendChild(del);

    item.appendChild(header);

    if (expanded) {
      item.appendChild(this.renderEditForm(repeater));
    }

    return item;
  }

  private renderEditForm(repeater: Repeater): HTMLElement {
    const form = document.createElement('form');
    form.className = 'repeater-edit-form';

    const { rows, inputs } = buildRepeaterFields(repeater);
    for (const row of rows) form.appendChild(row);

    const actions = document.createElement('div');
    actions.className = 'form-actions';
    const save = document.createElement('button');
    save.type = 'submit';
    save.textContent = 'Save';
    actions.appendChild(save);
    form.appendChild(actions);

    form.addEventListener('submit', (e) => {
      e.preventDefault();
      const values = readRepeaterFields(inputs);
      if (!values) return;
      this.callbacks.onUpdateRepeater(repeater.id, values);
      this.expandedIds.delete(repeater.id);
      this.rerender();
    });

    return form;
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
