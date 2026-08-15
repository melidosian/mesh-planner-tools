import L from 'leaflet';
import type { ObstructionPoint, ProfileSample, Repeater } from '../state/types';
import {
  highestPointIcon,
  obstructionIcon,
  relayCandidateIcon,
  repeaterIcon,
  repeaterOutOfCoverageIcon,
} from './markers';

// Rough geographic center of Wisconsin.
const WI_CENTER: L.LatLngTuple = [44.6, -89.7];
const WI_INITIAL_ZOOM = 7;

export type MapClickHandler = (lat: number, lon: number) => void;
export type MarkerDragHandler = (id: string, lat: number, lon: number) => void;
export type MarkerClickHandler = (id: string) => void;

export class MapView {
  private map: L.Map;
  private repeaterMarkers = new Map<string, L.Marker>();
  private pathLine: L.Polyline | null = null;
  private resultMarkers: L.Marker[] = [];
  private relayLines: L.Polyline[] = [];
  private relayMarker: L.Marker | null = null;

  private mapClickHandler: MapClickHandler | null = null;
  private markerDragHandler: MarkerDragHandler | null = null;
  private markerClickHandler: MarkerClickHandler | null = null;

  constructor(containerId: string) {
    this.map = L.map(containerId).setView(WI_CENTER, WI_INITIAL_ZOOM);
    L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
      maxZoom: 19,
    }).addTo(this.map);

    this.map.on('click', (e: L.LeafletMouseEvent) => {
      this.mapClickHandler?.(e.latlng.lat, e.latlng.lng);
    });
  }

  onMapClick(handler: MapClickHandler): void {
    this.mapClickHandler = handler;
  }

  onMarkerDrag(handler: MarkerDragHandler): void {
    this.markerDragHandler = handler;
  }

  onMarkerClick(handler: MarkerClickHandler): void {
    this.markerClickHandler = handler;
  }

  /** Adds/updates/removes repeater markers to match the given list. */
  syncRepeaters(repeaters: Repeater[], outOfCoverage: ReadonlySet<string>, selectedIds: ReadonlySet<string>): void {
    const currentIds = new Set(repeaters.map((r) => r.id));
    for (const id of [...this.repeaterMarkers.keys()]) {
      if (!currentIds.has(id)) {
        this.repeaterMarkers.get(id)!.remove();
        this.repeaterMarkers.delete(id);
      }
    }

    for (const repeater of repeaters) {
      const icon = outOfCoverage.has(repeater.id) ? repeaterOutOfCoverageIcon() : repeaterIcon();
      let marker = this.repeaterMarkers.get(repeater.id);
      if (!marker) {
        marker = L.marker([repeater.lat, repeater.lon], { draggable: true, icon }).addTo(this.map);
        marker.on('dragend', () => {
          const pos = marker!.getLatLng();
          this.markerDragHandler?.(repeater.id, pos.lat, pos.lng);
        });
        marker.on('click', () => this.markerClickHandler?.(repeater.id));
        this.repeaterMarkers.set(repeater.id, marker);
      } else {
        marker.setLatLng([repeater.lat, repeater.lon]);
        marker.setIcon(icon);
      }
      const selected = selectedIds.has(repeater.id);
      marker.bindTooltip(`${repeater.name}${selected ? ' (selected)' : ''}`);
    }
  }

  showLinkResult(
    profile: ProfileSample[],
    clear: boolean,
    worstObstruction: ObstructionPoint | null,
    highestPoint: ObstructionPoint,
  ): void {
    this.clearResult();

    const latlngs: L.LatLngTuple[] = profile.map((p) => [p.lat, p.lon]);
    this.pathLine = L.polyline(latlngs, { color: clear ? '#16a34a' : '#dc2626', weight: 3 }).addTo(this.map);

    if (worstObstruction) {
      const marker = L.marker([worstObstruction.lat, worstObstruction.lon], { icon: obstructionIcon() }).addTo(
        this.map,
      );
      marker.bindTooltip(`Obstruction: ${worstObstruction.elevationM.toFixed(0)}m elevation`);
      this.resultMarkers.push(marker);
    }

    const marker = L.marker([highestPoint.lat, highestPoint.lon], { icon: highestPointIcon() }).addTo(this.map);
    marker.bindTooltip(`Highest point: ${highestPoint.elevationM.toFixed(0)}m elevation`);
    this.resultMarkers.push(marker);

    this.map.fitBounds(this.pathLine.getBounds().pad(0.2));
  }

  clearResult(): void {
    if (this.pathLine) {
      this.pathLine.remove();
      this.pathLine = null;
    }
    for (const marker of this.resultMarkers) marker.remove();
    this.resultMarkers = [];
    this.clearRelayCandidate();
  }

  showRelayCandidate(
    candidate: { lat: number; lon: number; elevationM: number },
    legAProfile: ProfileSample[],
    legBProfile: ProfileSample[],
    legAClear: boolean,
    legBClear: boolean,
  ): void {
    this.clearRelayCandidate();

    const legAColor = legAClear ? '#16a34a' : '#dc2626';
    const legBColor = legBClear ? '#16a34a' : '#dc2626';
    const legALine = L.polyline(
      legAProfile.map((p) => [p.lat, p.lon]),
      { color: legAColor, weight: 3, dashArray: '2 8' },
    ).addTo(this.map);
    const legBLine = L.polyline(
      legBProfile.map((p) => [p.lat, p.lon]),
      { color: legBColor, weight: 3, dashArray: '2 8' },
    ).addTo(this.map);
    this.relayLines = [legALine, legBLine];

    this.relayMarker = L.marker([candidate.lat, candidate.lon], { icon: relayCandidateIcon() }).addTo(this.map);
    this.relayMarker.bindTooltip(`Candidate relay: ${candidate.elevationM.toFixed(0)}m elevation`);

    const bounds = legALine.getBounds().extend(legBLine.getBounds());
    this.map.fitBounds(bounds.pad(0.2));
  }

  clearRelayCandidate(): void {
    for (const line of this.relayLines) line.remove();
    this.relayLines = [];
    if (this.relayMarker) {
      this.relayMarker.remove();
      this.relayMarker = null;
    }
  }
}
