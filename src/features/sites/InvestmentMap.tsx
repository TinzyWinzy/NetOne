import { useEffect, useRef, useState } from 'react';
import * as maplibregl from 'maplibre-gl';
import type { StyleSpecification } from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
import { decisionState, observation } from '../../domain/portfolio';
import type { Period, Site } from '../../domain/portfolio';
const STYLE: StyleSpecification = { version: 8, sources: { osm: { type: 'raster', tiles: ['https://tile.openstreetmap.org/{z}/{x}/{y}.png'], tileSize: 256, attribution: '© OpenStreetMap contributors' } }, layers: [{ id: 'osm', type: 'raster', source: 'osm' }] };
export default function InvestmentMap({ sites, period, onSelect }: { sites: Site[]; period: Period; onSelect: (site: Site) => void }) {
  const container = useRef<HTMLDivElement>(null);
  const map = useRef<maplibregl.Map | null>(null);
  const [mode, setMode] = useState('utilisation');
  const [error, setError] = useState(false);
  useEffect(() => {
    if (!container.current) return;
    let instance: maplibregl.Map;
    try {
      instance = new maplibregl.Map({ container: container.current, style: STYLE, center: [30, -19], zoom: 5, attributionControl: { compact: true } });
    } catch { setError(true); return; }
    instance.on('error', () => setError(true));
    instance.addControl(new maplibregl.NavigationControl(), 'top-right');
    map.current = instance;
    return () => { instance.remove(); map.current = null; };
  }, []);
  useEffect(() => {
    const instance = map.current;
    if (!instance) return;
    const bounds = new maplibregl.LngLatBounds();
    const markers = sites.map(site => {
      const row = observation(site, period);
      const color = mode === 'reliability' ? row.availability < 98 ? '#b45309' : '#16746b'
        : mode === 'quality' ? row.quality === 'COMPLETE' ? '#16746b' : '#b45309'
        : row.utilisation === null ? '#64748b' : row.utilisation >= 80 ? '#b45309' : '#16746b';
      const button = document.createElement('button');
      button.className = 'tower-marker';
      button.style.background = color;
      button.setAttribute('aria-label', `Open ${site.id}, ${site.region}, ${decisionState(site, row)}`);
      button.title = `${site.id} · ${site.name}`;
      button.onclick = () => onSelect(site);
      bounds.extend([site.longitude, site.latitude]);
      return new maplibregl.Marker({ element: button }).setLngLat([site.longitude, site.latitude]).addTo(instance);
    });
    if (sites.length) instance.fitBounds(bounds, { padding: 50, duration: 0, maxZoom: 11 });
    return () => markers.forEach(marker => marker.remove());
  }, [sites, period, mode, onSelect]);
  return <section className="panel" aria-label="Investment map"><div className="section-heading"><h3>Geographic evidence</h3><label>Colour by <select value={mode} onChange={event => setMode(event.target.value)}><option value="utilisation">Utilisation</option><option value="reliability">Reliability</option><option value="quality">Evidence quality</option></select></label></div><p className="subtle">Amber: capacity ≥80%, availability below 98%, or incomplete evidence in the selected mode. Teal: other observed values. Grey: unavailable utilisation.</p><div ref={container} className="investment-map" />{error && <p role="status" className="data-notice">Map imagery is unavailable. The site table below contains the same filtered evidence.</p>}<p className="subtle">Fictional regional site locations. Click a marker to open its investment case; use the site table for keyboard access. Background tiles require internet.</p></section>;
}
