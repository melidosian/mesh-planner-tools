import {
  CategoryScale,
  Chart,
  Filler,
  Legend,
  LinearScale,
  LineController,
  LineElement,
  PointElement,
  Tooltip,
} from 'chart.js';
import { FRESNEL_CLEARANCE_FRACTION } from '../config';
import { earthCurvatureBulgeM } from '../los/earthCurvature';
import { fresnelZoneRadiusM } from '../los/fresnel';
import type { LinkResult } from '../state/types';

Chart.register(CategoryScale, LinearScale, LineController, LineElement, PointElement, Filler, Tooltip, Legend);

export class ElevationChart {
  private chart: Chart | null = null;

  constructor(private canvas: HTMLCanvasElement) {}

  render(result: LinkResult): void {
    const { profile, frequencyHz, antennaTopAM, antennaTopBM } = result;
    const first = profile[0];
    const last = profile[profile.length - 1];
    const totalDistanceM = last.distanceM - first.distanceM;

    const labels = profile.map((s) => (s.distanceM / 1000).toFixed(2));
    const terrain = profile.map((s) => s.elevationM);
    const losLine: number[] = [];
    const fresnelLower: number[] = [];

    for (const sample of profile) {
      const d1 = sample.distanceM - first.distanceM;
      const d2 = last.distanceM - sample.distanceM;
      const t = totalDistanceM === 0 ? 0 : d1 / totalDistanceM;
      const losHeight = antennaTopAM + (antennaTopBM - antennaTopAM) * t;
      const bulge = d1 > 0 && d2 > 0 ? earthCurvatureBulgeM(d1, d2) : 0;
      const f1 = d1 > 0 && d2 > 0 ? fresnelZoneRadiusM(frequencyHz, d1, d2) : 0;
      losLine.push(losHeight);
      fresnelLower.push(losHeight - FRESNEL_CLEARANCE_FRACTION * f1 - bulge);
    }

    this.chart?.destroy();
    this.chart = new Chart(this.canvas, {
      type: 'line',
      data: {
        labels,
        datasets: [
          {
            label: 'Terrain',
            data: terrain,
            borderColor: '#78716c',
            backgroundColor: 'rgba(120,113,108,0.25)',
            fill: 'origin',
            pointRadius: 0,
            tension: 0.1,
          },
          {
            label: 'Line of sight',
            data: losLine,
            borderColor: '#2563eb',
            borderDash: [6, 4],
            pointRadius: 0,
            fill: false,
          },
          {
            label: '60% Fresnel clearance floor',
            data: fresnelLower,
            borderColor: '#f59e0b',
            pointRadius: 0,
            fill: false,
          },
        ],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        scales: {
          x: { title: { display: true, text: 'Distance (km)' } },
          y: { title: { display: true, text: 'Elevation (m)' } },
        },
        plugins: {
          legend: { position: 'bottom' },
        },
      },
    });
  }
}
