import {
  DEFAULT_ANTENNA_GAIN_DBI,
  DEFAULT_ANTENNA_HEIGHT_M,
  DEFAULT_CABLE_LOSS_DB,
  DEFAULT_FREQUENCY_HZ,
  DEFAULT_RX_SENSITIVITY_DBM,
  DEFAULT_TX_POWER_DBM,
} from './config';
import { findTile } from './elevation/demIndex';
import { DemCoverageError } from './elevation/demReader';
import { analyzeLink } from './los/losAnalysis';
import { MapView } from './map/mapView';
import { repeaterStore } from './state/repeaterStore';
import type { Repeater } from './state/types';
import { ControlPanel } from './ui/controlPanel';
import { ElevationChart } from './ui/elevationChart';
import { exportRepeatersToFile, readRepeatersFromFile } from './ui/importExport';
import { LinkMatrix, type MatrixRow } from './ui/linkMatrix';
import type { RepeaterFieldValues } from './ui/repeaterFieldsForm';
import { ResultsPanel } from './ui/resultsPanel';

export class App {
  private mapView: MapView;
  private controlPanel: ControlPanel;
  private resultsPanel: ResultsPanel;
  private chart: ElevationChart;
  private linkMatrix: LinkMatrix;

  private selectedIds: string[] = [];
  private frequencyHz = DEFAULT_FREQUENCY_HZ;
  private outOfCoverage = new Set<string>();
  private pendingLatLon: { lat: number; lon: number } | null = null;
  private matrixRows: MatrixRow[] | null = null;
  private matrixComputing = false;
  private panelOpen = false;

  constructor() {
    this.mapView = new MapView('map');
    this.resultsPanel = new ResultsPanel(document.getElementById('results-panel')!);
    this.chart = new ElevationChart(document.getElementById('elevation-chart') as HTMLCanvasElement);
    this.linkMatrix = new LinkMatrix(document.getElementById('matrix-panel')!, {
      onComputeAll: () => void this.runMatrixAnalysis(),
      onSelectPair: (aId, bId) => this.selectPairAndAnalyze(aId, bId),
    });
    this.controlPanel = new ControlPanel(document.getElementById('control-panel')!, {
      onAddRepeater: (data) => this.handleAddRepeater(data),
      onUpdateRepeater: (id, patch) => repeaterStore.update(id, patch),
      onDeleteRepeater: (id) => this.handleDeleteRepeater(id),
      onToggleSelect: (id) => this.toggleSelect(id),
      onFrequencyChange: (hz) => {
        this.frequencyHz = hz;
      },
      onAnalyze: () => void this.runAnalysis(),
      onCancelAdd: () => {
        this.pendingLatLon = null;
        this.render();
      },
      onExport: () => exportRepeatersToFile(repeaterStore.getAll()),
      onImportFile: (file) => void this.handleImportFile(file),
    });

    this.mapView.onMapClick((lat, lon) => {
      this.pendingLatLon = { lat, lon };
      this.setPanelOpen(true);
      this.render();
    });
    this.mapView.onMarkerClick((id) => this.toggleSelect(id));
    this.mapView.onMarkerDrag((id, lat, lon) => repeaterStore.update(id, { lat, lon }));

    document.getElementById('panel-toggle')!.addEventListener('click', () => this.togglePanel());
    document.getElementById('panel-close')!.addEventListener('click', () => this.setPanelOpen(false));
    document.getElementById('panel-backdrop')!.addEventListener('click', () => this.setPanelOpen(false));

    repeaterStore.subscribe(() => {
      this.matrixRows = null;
      void this.refreshCoverage();
    });

    void this.refreshCoverage();
    this.render();
  }

  private togglePanel(): void {
    this.setPanelOpen(!this.panelOpen);
  }

  private setPanelOpen(open: boolean): void {
    this.panelOpen = open;
    document.body.classList.toggle('panel-open', open);
  }

  private toggleSelect(id: string): void {
    if (this.selectedIds.includes(id)) {
      this.selectedIds = this.selectedIds.filter((x) => x !== id);
    } else {
      this.selectedIds = [...this.selectedIds, id].slice(-2);
    }
    this.mapView.clearResult();
    this.resultsPanel.clear();
    this.render();
  }

  private selectPairAndAnalyze(repeaterAId: string, repeaterBId: string): void {
    this.selectedIds = [repeaterAId, repeaterBId];
    this.setPanelOpen(true);
    this.render();
    void this.runAnalysis();
  }

  private handleAddRepeater(data: RepeaterFieldValues): void {
    if (!this.pendingLatLon) return;
    repeaterStore.add({ ...data, lat: this.pendingLatLon.lat, lon: this.pendingLatLon.lon });
    this.pendingLatLon = null;
  }

  private handleDeleteRepeater(id: string): void {
    repeaterStore.remove(id);
    this.selectedIds = this.selectedIds.filter((x) => x !== id);
  }

  private async handleImportFile(file: File): Promise<void> {
    try {
      const repeaters = await readRepeatersFromFile(file);
      repeaterStore.replaceAll(repeaters);
      this.selectedIds = [];
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Failed to import file.');
    }
  }

  private async refreshCoverage(): Promise<void> {
    const repeaters = repeaterStore.getAll();
    const flags = await Promise.all(
      repeaters.map(async (r) => {
        const tile = await findTile(r.lat, r.lon).catch(() => null);
        return [r.id, tile === null] as const;
      }),
    );
    this.outOfCoverage = new Set(flags.filter(([, out]) => out).map(([id]) => id));
    this.render();
  }

  private async runAnalysis(): Promise<void> {
    if (this.selectedIds.length !== 2) return;
    const [aId, bId] = this.selectedIds;
    const repeaterA = repeaterStore.getById(aId);
    const repeaterB = repeaterStore.getById(bId);
    if (!repeaterA || !repeaterB) return;

    this.resultsPanel.showLoading();
    try {
      const result = await analyzeLink(repeaterA, repeaterB, this.frequencyHz);
      this.resultsPanel.showResult(result, repeaterA, repeaterB);
      this.mapView.showLinkResult(result.profile, result.clear, result.worstObstruction, result.highestPoint);
      this.chart.render(result);
    } catch (err) {
      if (err instanceof DemCoverageError) {
        this.resultsPanel.showError(err.message);
      } else {
        this.resultsPanel.showError('Failed to analyze link. See console for details.');
        console.error(err);
      }
    }
  }

  private async computeMatrixRow(repeaterA: Repeater, repeaterB: Repeater): Promise<MatrixRow> {
    try {
      const result = await analyzeLink(repeaterA, repeaterB, this.frequencyHz);
      return {
        repeaterAId: repeaterA.id,
        repeaterBId: repeaterB.id,
        status: result.clear ? 'clear' : 'obstructed',
        distanceKm: result.distanceM / 1000,
        marginDb: Math.min(result.linkBudget.aToB.marginDb, result.linkBudget.bToA.marginDb),
      };
    } catch (err) {
      return {
        repeaterAId: repeaterA.id,
        repeaterBId: repeaterB.id,
        status: err instanceof DemCoverageError ? 'no-coverage' : 'error',
      };
    }
  }

  private async runMatrixAnalysis(): Promise<void> {
    const repeaters = repeaterStore.getAll();
    const pairs: [Repeater, Repeater][] = [];
    for (let i = 0; i < repeaters.length; i++) {
      for (let j = i + 1; j < repeaters.length; j++) {
        pairs.push([repeaters[i], repeaters[j]]);
      }
    }

    const rows: MatrixRow[] = pairs.map(([a, b]) => ({ repeaterAId: a.id, repeaterBId: b.id, status: 'pending' }));
    this.matrixRows = rows;
    this.matrixComputing = true;
    this.render();

    for (let k = 0; k < pairs.length; k++) {
      const [a, b] = pairs[k];
      rows[k] = await this.computeMatrixRow(a, b);
      this.matrixRows = rows;
      this.render();
    }

    this.matrixComputing = false;
    this.render();
  }

  private render(): void {
    const repeaters = repeaterStore.getAll();
    this.mapView.syncRepeaters(repeaters, this.outOfCoverage, new Set(this.selectedIds));
    this.controlPanel.render({
      repeaters,
      selectedIds: this.selectedIds,
      frequencyHz: this.frequencyHz,
      outOfCoverage: this.outOfCoverage,
      pendingLatLon: this.pendingLatLon,
      defaultRepeaterValues: {
        antennaHeightM: DEFAULT_ANTENNA_HEIGHT_M,
        txPowerDbm: DEFAULT_TX_POWER_DBM,
        antennaGainDbi: DEFAULT_ANTENNA_GAIN_DBI,
        cableLossDb: DEFAULT_CABLE_LOSS_DB,
        rxSensitivityDbm: DEFAULT_RX_SENSITIVITY_DBM,
      },
    });
    this.linkMatrix.render(repeaters, this.matrixRows, this.matrixComputing);
  }
}
