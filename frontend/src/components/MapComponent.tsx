import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import DeckGL from '@deck.gl/react';
import { GeoJsonLayer, ScatterplotLayer, IconLayer, TextLayer } from '@deck.gl/layers';
import { AmbientLight, _SunLight as SunLight, LightingEffect } from '@deck.gl/core';
import { Tile3DLayer } from '@deck.gl/geo-layers';
import { Tiles3DLoader } from '@loaders.gl/3d-tiles';
import { Map } from 'react-map-gl/maplibre';
import 'maplibre-gl/dist/maplibre-gl.css';
import { useCityContext } from '../context/CityContext';

const MAP_STYLE = 'https://basemaps.cartocdn.com/gl/dark-matter-gl-style/style.json';
const API_BASE = import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:8000';

// ── Types ──────────────────────────────────────────────────────────────────────
interface BikeStation { id: string; name: string; latitude: number; longitude: number; free_bikes: number; empty_slots: number; total_slots: number; }
interface AQStation { id: number; name: string; latitude: number; longitude: number; parameters: Record<string, { value: number | null; unit: string }>; }
interface Aircraft { icao24: string; callsign: string; country: string; longitude: number; latitude: number; altitude: number | null; on_ground: boolean; velocity: number | null; heading: number | null; vertical_rate: number | null; }

type TooltipType = 'bike' | 'aq' | 'aircraft';
interface HoverInfo { x: number; y: number; type: TooltipType; data: any; }

// ── Helpers ────────────────────────────────────────────────────────────────────
function bikeColor(s: BikeStation): [number, number, number, number] {
  if (s.free_bikes <= 0) return [244, 63, 94, 230];
  const r = s.total_slots > 0 ? s.free_bikes / s.total_slots : 0;
  return r < 0.3 ? [251, 191, 36, 220] : [52, 211, 153, 220];
}

// Bounding box around a city center for aircraft queries
function cityBBox(lat: number, lon: number, deg = 0.6) {
  return { lamin: lat - deg, lomin: lon - deg, lamax: lat + deg, lomax: lon + deg };
}

export default function MapComponent({ onSolarRequest }: { onSolarRequest?: (lat: number, lon: number) => void }) {
  const { city, selectedLocation, setSelectedLocation, timeOfDay, activeLayer } = useCityContext();
  const [bikeStations, setBikeStations] = useState<BikeStation[]>([]);
  const [aqStations, setAqStations] = useState<AQStation[]>([]);
  const [aircraft, setAircraft] = useState<Aircraft[]>([]);
  const [hoverInfo, setHoverInfo] = useState<HoverInfo | null>(null);

  // Controlled view state — user interactions update it, city switches fly to new center
  const [viewState, setViewState] = useState({
    longitude: city.lon, latitude: city.lat,
    zoom: city.zoom, pitch: city.pitch, bearing: city.bearing,
    transitionDuration: 0,
  });

  const prevCityId = useRef(city.id);
  useEffect(() => {
    if (city.id !== prevCityId.current) {
      prevCityId.current = city.id;
      setViewState(vs => ({ ...vs, longitude: city.lon, latitude: city.lat, zoom: city.zoom, pitch: city.pitch, bearing: city.bearing, transitionDuration: 1500 }));
    }
  }, [city]);

  // City bikes
  useEffect(() => {
    if (!city.features.includes('city-bikes')) { setBikeStations([]); return; }
    const load = async () => { try { const r = await fetch(`${API_BASE}/api/city-bikes`); if (r.ok) setBikeStations((await r.json()).stations ?? []); } catch { /**/ } };
    load();
    const id = setInterval(load, 60_000);
    return () => clearInterval(id);
  }, [city]);

  // AQ stations (Ahmedabad)
  useEffect(() => {
    if (!city.features.includes('openaq')) { setAqStations([]); return; }
    const load = async () => { try { const r = await fetch(`${API_BASE}/api/openaq?city=${encodeURIComponent(city.name)}`); if (r.ok) setAqStations((await r.json()).stations?.filter((s: AQStation) => s.latitude != null) ?? []); } catch { /**/ } };
    load();
  }, [city]);

  // Aircraft — poll every 20s
  useEffect(() => {
    const load = async () => {
      try {
        const bb = cityBBox(city.lat, city.lon);
        const r = await fetch(`${API_BASE}/api/aircraft?lamin=${bb.lamin}&lomin=${bb.lomin}&lamax=${bb.lamax}&lomax=${bb.lomax}`);
        if (r.ok) setAircraft((await r.json()).aircraft ?? []);
      } catch { /**/ }
    };
    load();
    const id = setInterval(load, 20_000);
    return () => clearInterval(id);
  }, [city]);

  const handleMapClick = useCallback((info: { coordinate?: number[] | null }) => {
    if (!info.coordinate) return;
    const [lon, lat] = info.coordinate;
    const roundedLat = Math.round(lat * 10000) / 10000;
    const roundedLon = Math.round(lon * 10000) / 10000;
    setSelectedLocation({ lat: roundedLat, lon: roundedLon, label: `${roundedLat.toFixed(4)}°N, ${roundedLon.toFixed(4)}°E` });
    onSolarRequest?.(roundedLat, roundedLon);
  }, [setSelectedLocation, onSolarRequest]);

  const layers = useMemo(() => {
    const result: any[] = [];

    if (activeLayer === 'buildings') {
      // 3D Buildings
      if (city.buildings === '3d-tiles' && city.tilesUrl) {
        result.push(new Tile3DLayer({ id: 'reality-mesh', data: city.tilesUrl, loader: Tiles3DLoader, pickable: false }));
      } else if (city.buildings === 'geojson' && city.geojsonUrl) {
        result.push(new GeoJsonLayer({
          id: 'buildings-geojson', data: city.geojsonUrl, extruded: true,
          getElevation: (f: any) => f.properties?.height ?? 8,
          getFillColor: (f: any) => { const c = f.properties?.color ?? [160, 140, 130]; return [...c, 255]; },
          getLineColor: [255, 255, 255, 15], lineWidthMinPixels: 0, pickable: false,
          material: { ambient: 0.3, diffuse: 0.8, shininess: 20, specularColor: [200, 200, 200] },
        }));
      }
    } else if (activeLayer === 'demographics' && city.pincodeUrl) {
      // Demographics/Zoning Layer
      result.push(new GeoJsonLayer({
        id: 'demographics-geojson', data: city.pincodeUrl, extruded: false,
        getFillColor: (f: any) => {
          // Generate a consistent but distinct color based on pincode string
          const code = f.properties?.PIN_Code ?? '0';
          const hash = code.split('').reduce((a:number,b:string)=>(((a<<5)-a)+b.charCodeAt(0))|0,0);
          return [Math.abs((hash * 13) % 200) + 55, Math.abs((hash * 47) % 200) + 55, Math.abs((hash * 97) % 200) + 55, 120];
        },
        getLineColor: [255, 255, 255, 200], lineWidthMinPixels: 2, pickable: true,
        onHover: ({ object, x, y }: any) => {
          setHoverInfo(object ? { type: 'pincode', data: object.properties, x, y } : null);
        }
      }));
    }

    // City bikes
    if (bikeStations.length > 0) {
      result.push(new ScatterplotLayer<BikeStation>({
        id: 'bike-stations', data: bikeStations,
        getPosition: (d) => [d.longitude, d.latitude, 8],
        getFillColor: bikeColor, getLineColor: [255, 255, 255, 150],
        lineWidthMinPixels: 1, stroked: true, filled: true,
        radiusMinPixels: 5, radiusMaxPixels: 20,
        getRadius: (d) => 40 + (d.total_slots || 0) * 2, pickable: true,
        onHover: ({ object, x, y }) => setHoverInfo(object ? { x, y, type: 'bike', data: object } : null),
      }));
    }

    // AQ stations
    if (aqStations.length > 0) {
      result.push(new ScatterplotLayer<AQStation>({
        id: 'aq-stations', data: aqStations,
        getPosition: (d) => [d.longitude, d.latitude, 15],
        getFillColor: (d) => {
          const pm25 = d.parameters?.pm25?.value ?? d.parameters?.pm2_5?.value;
          if (pm25 == null) return [150, 150, 150, 200];
          if (pm25 <= 30) return [52, 211, 153, 230];
          if (pm25 <= 60) return [251, 191, 36, 230];
          if (pm25 <= 90) return [249, 115, 22, 230];
          return [244, 63, 94, 230];
        },
        getLineColor: [255, 255, 255, 180], lineWidthMinPixels: 2, stroked: true, filled: true,
        radiusMinPixels: 8, radiusMaxPixels: 28, getRadius: 150, pickable: true,
        onHover: ({ object, x, y }) => setHoverInfo(object ? { x, y, type: 'aq', data: object } : null),
      }));
    }

    // Aircraft — ScatterplotLayer for bodies + TextLayer for callsigns
    const airborne = aircraft.filter(a => !a.on_ground);
    if (airborne.length > 0) {
      result.push(new ScatterplotLayer<Aircraft>({
        id: 'aircraft', data: airborne,
        getPosition: (d) => [d.longitude, d.latitude, (d.altitude ?? 1000)],
        getFillColor: [147, 197, 253, 240],  // sky blue
        getLineColor: [255, 255, 255, 200],
        lineWidthMinPixels: 1, stroked: true, filled: true,
        radiusMinPixels: 5, radiusMaxPixels: 12, getRadius: 200,
        pickable: true,
        onHover: ({ object, x, y }) => setHoverInfo(object ? { x, y, type: 'aircraft', data: object } : null),
      }));
      result.push(new TextLayer<Aircraft>({
        id: 'aircraft-labels', data: airborne,
        getPosition: (d) => [d.longitude, d.latitude, (d.altitude ?? 1000) + 100],
        getText: (d) => d.callsign || '',
        getSize: 11, getColor: [200, 230, 255, 200],
        getAngle: (d) => -(d.heading ?? 0),
        fontFamily: 'monospace',
        background: true,
        getBackgroundColor: [10, 20, 40, 180],
        backgroundPadding: [3, 1, 3, 1],
        pickable: false,
      }));
    }

    return result;
  }, [city, bikeStations, aqStations, aircraft, activeLayer]);

  const lightingEffect = useMemo(() => {
    const ambientLight = new AmbientLight({ color: [255, 255, 255], intensity: 0.8 });
    const date = new Date();
    date.setHours(Math.floor(timeOfDay), Math.floor((timeOfDay % 1) * 60), 0, 0);
    const sunLight = new SunLight({
      timestamp: date.getTime(),
      color: [255, 255, 255],
      intensity: 2.5,
    });
    return new LightingEffect({ ambientLight, sunLight });
  }, [timeOfDay]);

  return (
    <div className="absolute inset-0 z-0">
      <DeckGL
        viewState={viewState}
        onViewStateChange={({ viewState: vs }: any) => setViewState(vs)}
        controller={true}
        layers={layers}
        effects={[lightingEffect]}
        onClick={handleMapClick}
        getCursor={({ isDragging }) => (isDragging ? 'grabbing' : 'crosshair')}
      >
        <Map mapStyle={MAP_STYLE} interactive={false} />
      </DeckGL>

      {/* Tooltip */}
      {hoverInfo && (
        <div style={{ position: 'absolute', left: hoverInfo.x + 16, top: hoverInfo.y - 10, pointerEvents: 'none', background: 'rgba(10, 15, 30, 0.96)', border: '1px solid rgba(255,255,255,0.12)', borderRadius: 12, padding: '12px 16px', fontSize: 12, color: '#e2e8f0', backdropFilter: 'blur(16px)', minWidth: 190, zIndex: 100, boxShadow: '0 8px 32px rgba(0,0,0,0.6)' }}>
          {hoverInfo.type === 'bike' && <BikeTooltip station={hoverInfo.data} />}
          {hoverInfo.type === 'aq' && <AQTooltip station={hoverInfo.data} />}
          {hoverInfo.type === 'aircraft' && <AircraftTooltip ac={hoverInfo.data} />}
          {hoverInfo.type === 'pincode' && <PincodeTooltip props={hoverInfo.data} />}
        </div>
      )}

      {/* Aircraft count badge */}
      {aircraft.filter(a => !a.on_ground).length > 0 && (
        <div style={{ position: 'absolute', bottom: 80, right: 20, background: 'rgba(10,20,40,0.85)', border: '1px solid rgba(147,197,253,0.3)', borderRadius: 20, padding: '5px 12px', fontSize: 11, color: '#93c5fd', backdropFilter: 'blur(8px)', pointerEvents: 'none', display: 'flex', alignItems: 'center', gap: 6 }}>
          <span style={{ animation: 'pulse 2s infinite', display: 'inline-block', width: 6, height: 6, borderRadius: '50%', background: '#93c5fd' }} />
          {aircraft.filter(a => !a.on_ground).length} aircraft overhead
        </div>
      )}

      {/* Map hint */}
      <div style={{ position: 'absolute', bottom: 80, left: '50%', transform: 'translateX(-50%)', background: 'rgba(10,15,30,0.7)', borderRadius: 20, padding: '5px 14px', fontSize: 11, color: '#64748b', backdropFilter: 'blur(8px)', border: '1px solid rgba(255,255,255,0.06)', pointerEvents: 'none' }}>
        Click map → weather, air quality &amp; solar potential for that location
      </div>

      <style>{`@keyframes pulse{0%,100%{opacity:1}50%{opacity:0.4}}`}</style>
    </div>
  );
}

function BikeTooltip({ station }: { station: BikeStation }) {
  const pct = station.total_slots > 0 ? station.free_bikes / station.total_slots : 0;
  const color = station.free_bikes <= 0 ? '#f43f5e' : pct < 0.3 ? '#fbbf24' : '#34d399';
  return (<>
    <div style={{ fontWeight: 700, fontSize: 13, color: '#fff', marginBottom: 8 }}>🚲 {station.name}</div>
    <div style={{ display: 'flex', flexDirection: 'column', gap: 4, color: '#94a3b8' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between' }}><span>Available</span><span style={{ color, fontWeight: 700 }}>{station.free_bikes} bikes</span></div>
      <div style={{ display: 'flex', justifyContent: 'space-between' }}><span>Empty docks</span><span>{station.empty_slots}</span></div>
      <div style={{ display: 'flex', justifyContent: 'space-between' }}><span>Capacity</span><span>{station.total_slots}</span></div>
    </div>
    <div style={{ marginTop: 10, height: 5, borderRadius: 3, background: '#1e293b' }}>
      <div style={{ height: '100%', width: `${pct * 100}%`, background: color, borderRadius: 3 }} />
    </div>
  </>);
}

function AQTooltip({ station }: { station: AQStation }) {
  const pm25 = station.parameters?.pm25?.value ?? station.parameters?.pm2_5?.value;
  return (<>
    <div style={{ fontWeight: 700, fontSize: 13, color: '#fff', marginBottom: 6 }}>📡 {station.name}</div>
    <div style={{ display: 'flex', flexDirection: 'column', gap: 4, color: '#94a3b8' }}>
      {pm25 != null && <div style={{ display: 'flex', justifyContent: 'space-between' }}><span>PM2.5</span><span style={{ color: pm25 > 60 ? '#f43f5e' : pm25 > 30 ? '#fbbf24' : '#34d399', fontWeight: 700 }}>{pm25} µg/m³</span></div>}
      {station.parameters?.pm10?.value != null && <div style={{ display: 'flex', justifyContent: 'space-between' }}><span>PM10</span><span>{station.parameters.pm10.value} µg/m³</span></div>}
    </div>
  </>);
}

function AircraftTooltip({ ac }: { ac: Aircraft }) {
  const alt = ac.altitude != null ? `${Math.round(ac.altitude)} m` : 'Unknown';
  const spd = ac.velocity != null ? `${Math.round(ac.velocity * 3.6)} km/h` : '--';
  const hdg = ac.heading != null ? `${Math.round(ac.heading)}°` : '--';
  const vr = ac.vertical_rate != null ? (ac.vertical_rate > 0.5 ? '↑ Climbing' : ac.vertical_rate < -0.5 ? '↓ Descending' : '→ Level') : '--';
  return (<>
    <div style={{ fontWeight: 700, fontSize: 13, color: '#93c5fd', marginBottom: 8 }}>✈ {ac.callsign}</div>
    <div style={{ display: 'flex', flexDirection: 'column', gap: 5, color: '#94a3b8', fontSize: 11 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 16 }}><span>Altitude</span><span style={{ color: '#e2e8f0' }}>{alt}</span></div>
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 16 }}><span>Speed</span><span style={{ color: '#e2e8f0' }}>{spd}</span></div>
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 16 }}><span>Heading</span><span style={{ color: '#e2e8f0' }}>{hdg}</span></div>
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 16 }}><span>Status</span><span style={{ color: '#93c5fd' }}>{vr}</span></div>
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 16 }}><span>Country</span><span>{ac.country}</span></div>
    </div>
  </>);
}

function PincodeTooltip({ props }: { props: any }) {
  return (<>
    <div style={{ fontWeight: 700, fontSize: 13, color: '#a78bfa', marginBottom: 8 }}>📍 Pincode: {props.PIN_Code ?? 'Unknown'}</div>
    <div style={{ display: 'flex', flexDirection: 'column', gap: 5, color: '#94a3b8', fontSize: 11 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 16 }}><span>Office</span><span style={{ color: '#e2e8f0', textAlign: 'right' }}>{props.Office_Name ?? '--'}</span></div>
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 16 }}><span>Type</span><span style={{ color: '#e2e8f0' }}>{props.Office_Type ?? '--'}</span></div>
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 16 }}><span>Division</span><span style={{ color: '#e2e8f0', textAlign: 'right' }}>{props.Division_Name ?? '--'}</span></div>
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 16 }}><span>Region</span><span style={{ color: '#e2e8f0' }}>{props.Region_Name ?? '--'}</span></div>
    </div>
  </>);
}
