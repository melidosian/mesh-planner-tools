import L from 'leaflet';

function dotIcon(color: string, sizePx = 18, label?: string): L.DivIcon {
  const half = sizePx / 2;
  return L.divIcon({
    className: 'mesh-marker',
    html: `<div class="mesh-marker-dot" style="width:${sizePx}px;height:${sizePx}px;background:${color};">${label ?? ''}</div>`,
    iconSize: [sizePx, sizePx],
    iconAnchor: [half, half],
  });
}

export const repeaterIcon = (): L.DivIcon => dotIcon('#2563eb');
export const repeaterOutOfCoverageIcon = (): L.DivIcon => dotIcon('#9ca3af');
export const obstructionIcon = (): L.DivIcon => dotIcon('#dc2626', 16, '&#9888;');
export const highestPointIcon = (): L.DivIcon => dotIcon('#16a34a', 16, '&#9650;');
export const relayCandidateIcon = (): L.DivIcon => dotIcon('#9333ea', 20, '&#128225;');
