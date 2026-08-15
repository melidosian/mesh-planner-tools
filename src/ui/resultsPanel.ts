import type { LinkResult, Repeater } from '../state/types';
import type { RelaySearchResult } from '../los/relaySearch';

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

export interface ResultsPanelCallbacks {
  onFindRelay(): void;
}

export class ResultsPanel {
  private relaySection: HTMLElement | null = null;

  constructor(
    private container: HTMLElement,
    private callbacks: ResultsPanelCallbacks,
  ) {
    this.clear();
  }

  clear(): void {
    this.container.innerHTML = '<p class="hint">Select two repeaters and click "Analyze line-of-sight".</p>';
    this.relaySection = null;
  }

  showLoading(): void {
    this.container.innerHTML = '<p class="hint">Analyzing…</p>';
    this.relaySection = null;
  }

  showError(message: string): void {
    this.container.innerHTML = `<p class="error">${message}</p>`;
    this.relaySection = null;
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

    this.relaySection = document.createElement('div');
    this.relaySection.className = 'relay-section';
    if (!result.clear) {
      const findBtn = document.createElement('button');
      findBtn.type = 'button';
      findBtn.textContent = 'Find repeater site nearby';
      findBtn.addEventListener('click', () => this.callbacks.onFindRelay());
      this.relaySection.appendChild(findBtn);
    }
    this.container.appendChild(this.relaySection);
  }

  showRelaySearching(): void {
    if (!this.relaySection) return;
    this.relaySection.innerHTML = '<p class="hint">Searching nearby terrain for a relay site…</p>';
  }

  showRelayError(message: string): void {
    if (!this.relaySection) return;
    this.relaySection.innerHTML = `<p class="error">${message}</p>`;
  }

  showRelayResult(search: RelaySearchResult, repeaterA: Repeater, repeaterB: Repeater): void {
    if (!this.relaySection) return;
    this.relaySection.innerHTML = '';

    if (!search.candidate) {
      this.relaySection.innerHTML =
        '<p class="hint">No elevation data available in the surrounding area to search for a relay site.</p>';
      return;
    }

    const { candidate } = search;

    const title = document.createElement('h4');
    title.textContent = search.bothClearFound ? 'Candidate relay site found' : 'Best nearby candidate (still not fully clear)';
    this.relaySection.appendChild(title);

    const loc = document.createElement('p');
    loc.className = 'hint';
    loc.textContent = formatPoint(candidate.elevationM, candidate.lat, candidate.lon);
    this.relaySection.appendChild(loc);

    const legs = document.createElement('p');
    const legStatus = (leg: LinkResult) => (leg.clear ? 'Clear' : 'Obstructed');
    legs.innerHTML = `<strong>${repeaterA.name} → relay:</strong> ${legStatus(candidate.legA)}<br><strong>relay → ${repeaterB.name}:</strong> ${legStatus(candidate.legB)}`;
    this.relaySection.appendChild(legs);

    if (!search.bothClearFound) {
      const note = document.createElement('p');
      note.className = 'hint';
      note.textContent = `Tested ${search.candidatesTested} nearby high points; none fully cleared both legs. This is the closest one found.`;
      this.relaySection.appendChild(note);
    }
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

    const scroll = document.createElement('div');
    scroll.className = 'table-scroll';
    scroll.appendChild(table);
    wrap.appendChild(scroll);

    return wrap;
  }
}
