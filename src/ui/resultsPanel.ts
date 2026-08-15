import type { LinkResult, Repeater } from '../state/types';

function formatDistanceKm(distanceM: number): string {
  return `${(distanceM / 1000).toFixed(2)} km`;
}

function formatPoint(elevationM: number, lat: number, lon: number): string {
  return `${elevationM.toFixed(0)} m elevation at ${lat.toFixed(5)}, ${lon.toFixed(5)}`;
}

export class ResultsPanel {
  constructor(private container: HTMLElement) {
    this.clear();
  }

  clear(): void {
    this.container.innerHTML = '<p class="hint">Select two repeaters and click "Analyze line-of-sight".</p>';
  }

  showLoading(): void {
    this.container.innerHTML = '<p class="hint">Analyzing…</p>';
  }

  showError(message: string): void {
    this.container.innerHTML = `<p class="error">${message}</p>`;
  }

  showResult(result: LinkResult, repeaterA: Repeater, repeaterB: Repeater): void {
    this.container.innerHTML = '';

    const badge = document.createElement('div');
    badge.className = `los-badge ${result.clear ? 'clear' : 'obstructed'}`;
    badge.textContent = result.clear ? 'Clear line-of-sight' : 'Obstructed';
    this.container.appendChild(badge);

    const summary = document.createElement('p');
    summary.className = 'hint';
    summary.textContent = `${repeaterA.name} ↔ ${repeaterB.name} · ${formatDistanceKm(result.distanceM)}`;
    this.container.appendChild(summary);

    if (!result.clear && result.worstObstruction) {
      const obstruction = document.createElement('p');
      const kind = result.hardBlocked ? 'Direct path blocked' : 'Fresnel zone intrusion';
      obstruction.innerHTML = `<strong>${kind}:</strong> ${formatPoint(
        result.worstObstruction.elevationM,
        result.worstObstruction.lat,
        result.worstObstruction.lon,
      )} (intrudes ${result.worstObstruction.intrusionM.toFixed(1)} m)`;
      this.container.appendChild(obstruction);
    }

    const highest = document.createElement('p');
    highest.innerHTML = `<strong>Highest point along path:</strong> ${formatPoint(
      result.highestPoint.elevationM,
      result.highestPoint.lat,
      result.highestPoint.lon,
    )}`;
    this.container.appendChild(highest);
  }
}
