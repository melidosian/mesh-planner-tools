import type { LinkResult, Repeater } from '../state/types';

function formatDistanceKm(distanceM: number): string {
  return `${(distanceM / 1000).toFixed(2)} km`;
}

function formatPoint(elevationM: number, lat: number, lon: number): string {
  return `${elevationM.toFixed(0)} m elevation at ${lat.toFixed(5)}, ${lon.toFixed(5)}`;
}

function formatDbm(value: number): string {
  return `${value >= 0 ? '+' : ''}${value.toFixed(1)} dBm`;
}

function formatMargin(value: number): string {
  return `${value >= 0 ? '+' : ''}${value.toFixed(1)} dB`;
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

    this.container.appendChild(this.renderLinkBudget(result, repeaterA, repeaterB));
  }

  private renderLinkBudget(result: LinkResult, repeaterA: Repeater, repeaterB: Repeater): HTMLElement {
    const { linkBudget } = result;
    const wrap = document.createElement('div');
    wrap.className = 'link-budget';

    const title = document.createElement('h4');
    title.textContent = 'Estimated link budget';
    wrap.appendChild(title);

    if (!result.clear) {
      const caveat = document.createElement('p');
      caveat.className = 'hint';
      caveat.textContent =
        'Assumes free-space propagation — with the path obstructed, real-world signal will be worse than this predicts.';
      wrap.appendChild(caveat);
    }

    const pathLoss = document.createElement('p');
    pathLoss.className = 'hint';
    pathLoss.textContent = `Free-space path loss: ${linkBudget.pathLossDb.toFixed(1)} dB`;
    wrap.appendChild(pathLoss);

    const table = document.createElement('table');
    table.className = 'link-budget-table';
    table.innerHTML = `
      <thead>
        <tr><th>Direction</th><th>Received</th><th>Margin</th></tr>
      </thead>
    `;
    const tbody = document.createElement('tbody');

    const rows: [string, { receivedPowerDbm: number; marginDb: number }][] = [
      [`${repeaterA.name} → ${repeaterB.name}`, linkBudget.aToB],
      [`${repeaterB.name} → ${repeaterA.name}`, linkBudget.bToA],
    ];
    for (const [label, direction] of rows) {
      const tr = document.createElement('tr');
      tr.className = direction.marginDb >= 0 ? 'viable' : 'not-viable';
      tr.innerHTML = `<td>${label}</td><td>${formatDbm(direction.receivedPowerDbm)}</td><td>${formatMargin(direction.marginDb)}</td>`;
      tbody.appendChild(tr);
    }
    table.appendChild(tbody);
    wrap.appendChild(table);

    return wrap;
  }
}
