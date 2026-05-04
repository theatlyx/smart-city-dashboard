import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import DeckGL from '@deck.gl/react';
import { GeoJsonLayer, ScatterplotLayer, TextLayer } from '@deck.gl/layers';
import { AmbientLight, _SunLight as SunLight, LightingEffect, DirectionalLight } from '@deck.gl/core';
import { Tile3DLayer } from '@deck.gl/geo-layers';
import { Tiles3DLoader } from '@loaders.gl/3d-tiles';
import { Map } from 'react-map-gl/maplibre';
import 'maplibre-gl/dist/maplibre-gl.css';
import { useCityContext } from '../context/CityContext';
import { LineChart, Line, XAxis, YAxis, Tooltip as RechartsTooltip, ResponsiveContainer } from 'recharts';
import { Bike, Plane, Radio, Map as MapIcon, Info, Droplets, Activity, Zap, Sun, X, Video, RefreshCw } from 'lucide-react';
import { PathLayer } from '@deck.gl/layers';
import { PathStyleExtension } from '@deck.gl/extensions';

const MAP_STYLE = 'https://basemaps.cartocdn.com/gl/dark-matter-gl-style/style.json';
const API_BASE = import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:8000';

// ── Types ──────────────────────────────────────────────────────────────────────
interface BikeStation { id: string; name: string; latitude: number; longitude: number; free_bikes: number; empty_slots: number; total_slots: number; }
interface AQStation { id: number; name: string; latitude: number; longitude: number; parameters: Record<string, { value: number | null; unit: string }>; }
interface Aircraft { icao24: string; callsign: string; country: string; longitude: number; latitude: number; altitude: number | null; on_ground: boolean; velocity: number | null; heading: number | null; vertical_rate: number | null; }

type TooltipType = 'bike' | 'aq' | 'aircraft' | 'pincode' | 'groundwater' | 'building' | 'landcover' | 'ground';
interface MapInfo { x: number; y: number; type: TooltipType; data: any; coordinate?: number[]; }

// ── Helpers ────────────────────────────────────────────────────────────────────
function bikeColor(s: BikeStation): [number, number, number, number] {
  if (s.free_bikes <= 0) return [255, 51, 102, 230]; // neon-red
  const r = s.total_slots > 0 ? s.free_bikes / s.total_slots : 0;
  return r < 0.3 ? [250, 204, 21, 220] : [0, 255, 102, 220]; // neon-yellow : neon-green
}

function cityBBox(lat: number, lon: number, deg = 0.6) {
  return { lamin: lat - deg, lomin: lon - deg, lamax: lat + deg, lomax: lon + deg };
}

export default function MapComponent({ onSolarRequest }: { onSolarRequest?: (lat: number, lon: number) => void }) {
  const { city, setSelectedLocation, timeOfDay, activeLayer } = useCityContext();
  const [bikeStations, setBikeStations] = useState<BikeStation[]>([]);
  const [aqStations, setAqStations] = useState<AQStation[]>([]);
  const [aircraft, setAircraft] = useState<Aircraft[]>([]);
  const [groundwater, setGroundwater] = useState<any>(null);
  const [landcover, setLandcover] = useState<any>(null);
  const [hoverInfo, setHoverInfo] = useState<MapInfo | null>(null);
  const [clickInfo, setClickInfo] = useState<MapInfo | null>(null);
  const [isOrbiting, setIsOrbiting] = useState(false);

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

  useEffect(() => {
    if (!city.features.includes('city-bikes')) { setBikeStations([]); return; }
    const load = async () => { try { const r = await fetch(`${API_BASE}/api/city-bikes`); if (r.ok) setBikeStations((await r.json()).stations ?? []); } catch { /**/ } };
    load();
    const id = setInterval(load, 60_000);
    return () => clearInterval(id);
  }, [city]);

  useEffect(() => {
    if (!city.features.includes('openaq')) { setAqStations([]); return; }
    const load = async () => { try { const r = await fetch(`${API_BASE}/api/openaq?city=${encodeURIComponent(city.name)}`); if (r.ok) setAqStations((await r.json()).stations?.filter((s: AQStation) => s.latitude != null) ?? []); } catch { /**/ } };
    load();
  }, [city]);

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

  useEffect(() => {
    if (city.groundwaterUrl) {
      fetch(city.groundwaterUrl).then(r => r.json()).then(data => setGroundwater(data)).catch(console.error);
    } else {
      setGroundwater(null);
    }
  }, [city.groundwaterUrl]);

  useEffect(() => {
    if (city.landcoverUrl) {
      fetch(city.landcoverUrl).then(r => r.json()).then(data => setLandcover(data)).catch(console.error);
    } else {
      setLandcover(null);
    }
  }, [city.landcoverUrl]);

  // Cinematic Orbit Logic
  const orbitFrameRef = useRef<number>(0);
  useEffect(() => {
    if (!isOrbiting) {
      cancelAnimationFrame(orbitFrameRef.current);
      return;
    }
    const animate = () => {
      setViewState(vs => ({
        ...vs,
        bearing: (vs.bearing + 0.2) % 360,
        transitionDuration: 0,
      }));
      orbitFrameRef.current = requestAnimationFrame(animate);
    };
    orbitFrameRef.current = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(orbitFrameRef.current);
  }, [isOrbiting]);

  const transitData = useMemo(() => {
    if (city.id !== 'ahmedabad') return { paths: [], stations: [] };
    
    const stations = [
      // METRO STATIONS (KML GROUND TRUTH)
      { name: 'APMC', position: [72.537201, 22.997729], type: 'metro', line: 'red' },
      { name: 'Jivraj', position: [72.53355, 23.005481], type: 'metro', line: 'red' },
      { name: 'Rajivnagar', position: [72.53673, 23.009701], type: 'metro', line: 'red' },
      { name: 'Shreyas', position: [72.549295, 23.013778], type: 'metro', line: 'red' },
      { name: 'Paldi', position: [72.562385, 23.018566], type: 'metro', line: 'red' },
      { name: 'Gandhigram', position: [72.56892, 23.027234], type: 'metro', line: 'red' },
      { name: 'Old High Court', position: [72.566988, 23.037622], type: 'metro', line: 'both', junction: true },
      { name: 'Usmanpura', position: [72.565015, 23.045889], type: 'metro', line: 'red' },
      { name: 'Vijaynagar', position: [72.562468, 23.056222], type: 'metro', line: 'red' },
      { name: 'Vadaj', position: [72.565822, 23.06773], type: 'metro', line: 'red' },
      { name: 'Ranip', position: [72.574009, 23.067675], type: 'metro', line: 'red' },
      { name: 'Sabarmati Rly Stn', position: [72.586695, 23.069729], type: 'metro', line: 'red' },
      { name: 'AEC', position: [72.593291, 23.075157], type: 'metro', line: 'red' },
      { name: 'Sabarmati', position: [72.592206, 23.085675], type: 'metro', line: 'red' },
      { name: 'Motera Stadium', position: [72.596655, 23.096694], type: 'metro', line: 'red' },

      { name: 'Thaltej Gam', position: [72.5070294, 23.0501558], type: 'metro', line: 'blue' },
      { name: 'Thaltej', position: [72.515931, 23.0497376], type: 'metro', line: 'blue' },
      { name: 'Doordarshan Kendra', position: [72.524867, 23.048086], type: 'metro', line: 'blue' },
      { name: 'Gurukul Road', position: [72.53505, 23.046007], type: 'metro', line: 'blue' },
      { name: 'Gujarat University', position: [72.543374, 23.044902], type: 'metro', line: 'blue' },
      { name: 'Commerce Six Road', position: [72.552968, 23.040691], type: 'metro', line: 'blue' },
      { name: 'S P Stadium', position: [72.561807, 23.039854], type: 'metro', line: 'blue' },
      { name: 'Shahpur', position: [72.581776, 23.039222], type: 'metro', line: 'blue' },
      { name: 'Gheekanta', position: [72.586332, 23.028383], type: 'metro', line: 'blue' },
      { name: 'Kalupur Rly Stn', position: [72.602903, 23.024785], type: 'metro', line: 'blue' },
      { name: 'Kankaria East', position: [72.606984, 23.015185], type: 'metro', line: 'blue' },
      { name: 'Apparel Park', position: [72.61746, 23.01085], type: 'metro', line: 'blue' },
      { name: 'Amraiwadi', position: [72.628641, 23.007846], type: 'metro', line: 'blue' },
      { name: 'Rabari Colony', position: [72.635463, 23.005513], type: 'metro', line: 'blue' },
      { name: 'Vastral', position: [72.646869, 23.003801], type: 'metro', line: 'blue' },
      { name: 'Nirant Cross Road', position: [72.658886, 22.99981], type: 'metro', line: 'blue' },
      { name: 'Vastral Gam', position: [72.667415, 22.997218], type: 'metro', line: 'blue' },

      // Phase 2
      { name: 'GNLU', position: [72.647375, 23.154344], type: 'metro', line: 'red' },
      { name: 'GIFT City', position: [72.685575, 23.153264], type: 'metro', line: 'red' },
      { name: 'Mahatma Mandir', position: [72.633664, 23.233654], type: 'metro', line: 'red' },

      // NEW BRTS STATIONS
      { name: 'Helmet Cross Road', position: [72.5427, 23.0449], type: 'brts' },
      { name: 'Parasnagar', position: [72.5430, 23.0556], type: 'brts' },
      { name: 'Ashok Vatika', position: [72.4956, 23.0280], type: 'brts' },
      { name: 'Jaintilal Park', position: [72.4909, 23.0285], type: 'brts' },
      { name: 'Swagat Bunglows', position: [72.4857, 23.0279], type: 'brts' },
      { name: 'Ambli Gam', position: [72.4820, 23.0264], type: 'brts' },
      { name: 'Maninagar BRTS', position: [72.6064, 22.9972], type: 'brts' },
      { name: 'Kankaria Lake', position: [72.5990, 23.0032], type: 'brts' },
      { name: 'Dani Limda', position: [72.5774, 22.9965], type: 'brts' },
      
      // BUS STATIONS (AMTS/GSRTC)
      { name: 'Gita Mandir (GSRTC)', position: [72.5914, 23.0140], type: 'bus' },
      { name: 'Ranip (GSRTC)', position: [72.5751, 23.0680], type: 'bus' },
      { name: 'Lal Darwaja (AMTS)', position: [72.5786, 23.0242], type: 'bus' },
      { name: 'Paldi Bus Stand', position: [72.5646, 23.0141], type: 'bus' },
      { name: 'Kalupur Bus Stop', position: [72.5985, 23.0219], type: 'bus' },
      { name: 'Navrangpura', position: [72.5642, 23.0356], type: 'bus' },
      { name: 'Airport Circle', position: [72.6167, 23.0814], type: 'bus' },
      { name: 'Vasna Bus Station', position: [72.5473, 23.0023], type: 'bus' },
      { name: 'Nava Vadej', position: [72.5707, 23.0551], type: 'bus' },
      { name: 'Chandkheda Depot', position: [72.5832, 23.1151], type: 'bus' }
    ];

    const paths = [
      // METRO PATHS (KML GROUND TRUTH)
      {
        id: 'red-line', type: 'metro', color: [239, 68, 68],
        path: [
          [72.537201, 22.997729], [72.53355, 23.005481], [72.53673, 23.009701], [72.549295, 23.013778], [72.562385, 23.018566], 
          [72.56892, 23.027234], [72.566988, 23.037622], [72.565015, 23.045889], [72.562468, 23.056222], [72.565822, 23.06773], 
          [72.574009, 23.067675], [72.586695, 23.069729], [72.593291, 23.075157], [72.592206, 23.085675], [72.596655, 23.096694]
        ]
      },
      {
        id: 'blue-line', type: 'metro', color: [59, 130, 246],
        path: [
          [72.5070294, 23.0501558], [72.515931, 23.0497376], [72.524867, 23.048086], [72.53505, 23.046007], [72.543374, 23.044902], 
          [72.552968, 23.040691], [72.561807, 23.039854], [72.566988, 23.037622], [72.581776, 23.039222], [72.586332, 23.028383], 
          [72.602903, 23.024785], [72.606984, 23.015185], [72.61746, 23.01085], [72.628641, 23.007846], [72.635463, 23.005513], 
          [72.646869, 23.003801], [72.658886, 22.99981], [72.667415, 22.997218]
        ]
      },
      {
        id: 'red-phase2-main', type: 'metro', color: [239, 68, 68],
        path: [
          [72.596655, 23.096694], [72.603409, 23.105794], [72.608569, 23.11431], [72.61591, 23.12023], [72.622327, 23.125338], 
          [72.630952, 23.132206], [72.638453, 23.141811], [72.643825, 23.147469], [72.647375, 23.154344], [72.648367, 23.166206], 
          [72.647333, 23.178853], [72.643363, 23.185698], [72.639748, 23.192418], [72.643387, 23.205186], [72.651751, 23.210558], 
          [72.658712, 23.214883], [72.664241, 23.223491], [72.659482, 23.228877], [72.650208, 23.233805], [72.641564, 23.238425], [72.633664, 23.233654]
        ]
      },
      {
        id: 'red-gift-branch', type: 'metro', color: [239, 68, 68],
        path: [
          [72.647375, 23.154344], [72.6613292, 23.1547969], [72.685575, 23.153264]
        ]
      },
      {
        id: 'b-inner', type: 'brts', color: [34, 197, 94],
        path: [
          [72.5085, 23.0271], [72.5311, 23.0243], [72.5367, 23.0191], [72.5486, 23.0084], [72.5623, 23.0191]
        ]
      },
      { 
        id: 'b-circle', type: 'brts', color: [34, 197, 94], 
        path: [
          [72.5313, 23.0243], [72.5435, 23.0240], [72.5486, 23.0084], [72.5663, 23.0063], 
          [72.5956, 23.0256], [72.6557, 23.0771], [72.5739, 23.0677], [72.5468, 23.0528], 
          [72.5313, 23.0243]
        ] 
      },
      {
        id: 'b-sola', type: 'brts', color: [34, 197, 94],
        path: [
          [72.5847, 23.0963], [72.5739, 23.0677], [72.5468, 23.0528], [72.5430, 23.0556], [72.5200, 23.0600], [72.4800, 23.0700]
        ]
      },
      {
        id: 'b-bopal', type: 'brts', color: [34, 197, 94],
        path: [
          [72.5085, 23.0271], [72.4956, 23.0280], [72.4909, 23.0285], [72.4857, 23.0279], [72.4820, 23.0264], [72.4779, 23.0258]
        ]
      },
      {
        id: 'bus-main', type: 'bus', color: [251, 191, 36],
        path: [
          [72.5786, 23.0242], [72.5646, 23.0141], [72.5473, 23.0023]
        ]
      },
      {
        id: 'bus-north', type: 'bus', color: [251, 191, 36],
        path: [
          [72.5985, 23.0219], [72.5642, 23.0356], [72.5707, 23.0551], [72.5751, 23.0680], [72.5832, 23.1151]
        ]
      }
    ];

    return { paths, stations };
  }, [city]);

  const handleMapClick = useCallback((info: { coordinate?: number[] | null, object?: any, x?: number, y?: number }) => {
    if (!info.coordinate || info.x === undefined || info.y === undefined) {
      setClickInfo(null);
      return;
    }
    const [lon, lat] = info.coordinate;
    const roundedLat = Math.round(lat * 10000) / 10000;
    const roundedLon = Math.round(lon * 10000) / 10000;
    
    let type: TooltipType = 'ground';
    if (info.object) {
      if (info.object.type === 'metro') type = 'building';
      else if (info.object.type === 'brts') type = 'building';
      else if (info.object.type === 'bus') type = 'building';
      else if (info.object.properties?.landuse) type = 'landcover';
      else if (info.object.properties?.Office_Name) type = 'groundwater';
      else if (info.object.properties?.pincode) type = 'pincode';
      else if (info.object.properties) type = 'building';
      else if (info.object.icao24) type = 'aircraft';
      else if (info.object.total_slots) type = 'bike';
    }

    setClickInfo({ 
      x: info.x, 
      y: info.y, 
      type, 
      data: info.object?.properties || info.object || {},
      coordinate: [roundedLon, roundedLat]
    });
  }, []);

  const layers = useMemo(() => {
    const layers_to_render: any[] = [];

    if (activeLayer === 'buildings') {
      if (city.buildings === '3d-tiles' && city.tilesUrl) {
        (layers_to_render as any).push(new Tile3DLayer({ id: 'reality-mesh', data: city.tilesUrl, loader: Tiles3DLoader, pickable: false }));
      } else if (city.buildings === 'geojson' && city.geojsonUrl) {
        const buildingsLayer = new (GeoJsonLayer as any)({
          id: 'buildings-geojson', 
          data: city.geojsonUrl, 
          extruded: true,
          wireframe: true,
          getElevation: (f: any) => {
            const h = f.properties?.height ?? f.properties?.['building:height'];
            if (h) return parseFloat(h);
            const l = f.properties?.['building:levels'] ?? f.properties?.levels;
            if (l) return parseFloat(l) * 3.5;
            return 12;
          },
          elevationScale: 1.0,
          getFillColor: (f: any): [number, number, number, number] => { 
            const levels = parseFloat(f.properties?.['building:levels'] ?? f.properties?.levels ?? '1');
            if (levels > 20) return [51, 65, 85, 255];  // Slate 700 (Tall)
            if (levels > 10) return [71, 85, 105, 255]; // Slate 600 (Mid)
            if (levels > 5) return [100, 116, 139, 255]; // Slate 500 (Low)
            return [148, 163, 184, 255];                // Slate 400 (Base)
          },
          getLineColor: [255, 255, 255, 50], 
          lineWidthMinPixels: 0.5, 
          pickable: true,
          autoHighlight: true,
          highlightColor: [0, 210, 255, 120],
          material: { ambient: 0.35, diffuse: 0.6, shininess: 32, specularColor: [150, 150, 150] },
          onHover: ({ object, x, y }: any) => {
            if (object && x !== undefined && y !== undefined) {
              setHoverInfo({ type: 'building', data: object.properties, x, y });
            } else {
              setHoverInfo(null);
            }
          }
        });
        (layers_to_render as any).push(buildingsLayer);
      }
    } else if (activeLayer === 'demographics' && city.pincodeUrl) {
      (layers_to_render as any).push(new (GeoJsonLayer as any)({
        id: 'demographics-geojson',
        data: city.pincodeUrl,
        filled: true,
        extruded: true,
        wireframe: true,
        getElevation: (f: any) => (f.properties?.population_density || 500) / 10,
        getFillColor: (f: any) => {
          const density = f.properties?.population_density || 5000;
          if (density > 15000) return [239, 68, 68, 180];
          if (density > 10000) return [249, 115, 22, 180];
          if (density > 5000) return [234, 179, 8, 180];
          return [59, 130, 246, 180];
        },
        getLineColor: [255, 255, 255, 50],
        pickable: true,
        onHover: ({ object, x, y }: any) => {
          setHoverInfo(object && x !== undefined && y !== undefined ? { type: 'pincode', data: object.properties, x, y } : null);
        }
      }));
    } else if (activeLayer === 'groundwater' && groundwater) {
      (layers_to_render as any).push(new (GeoJsonLayer as any)({
        id: 'groundwater-choropleth',
        data: groundwater,
        extruded: true,
        pickable: true,
        getElevation: (f: any) => Math.max(10, Math.abs(f.properties?.gw_change ?? 0) * 120),
        getFillColor: (f: any) => {
          const change = f.properties?.gw_change ?? 0;
          return change > 0 ? [255, 51, 102, 180] : [0, 255, 102, 180];
        },
        getLineColor: [255, 255, 255, 40],
        lineWidthMinPixels: 1,
        material: { ambient: 0.4, diffuse: 0.7, shininess: 50, specularColor: [255, 255, 255] },
        onHover: ({ object, x, y }: any) => {
          setHoverInfo(object && x !== undefined && y !== undefined ? { type: 'groundwater', data: object.properties, x, y } : null);
        }
      }));
    } else if (activeLayer === 'landcover' && landcover) {
      (layers_to_render as any).push(new (GeoJsonLayer as any)({
        id: 'landcover-geojson',
        data: landcover,
        filled: true,
        extruded: false,
        getFillColor: (f: any) => {
          return f.properties.type === 'water' ? [30, 144, 255, 180] : [34, 197, 94, 180];
        },
        pickable: true,
        onHover: ({ object, x, y }: any) => {
          setHoverInfo(object && x !== undefined && y !== undefined ? { type: 'building', data: object.properties, x, y } : null);
        }
      }));
    }

    if (bikeStations.length > 0) {
      (layers_to_render as any).push(new ScatterplotLayer<BikeStation>({
        id: 'bike-stations', data: bikeStations,
        getPosition: (d) => [d.longitude, d.latitude, 10],
        getFillColor: bikeColor, getLineColor: [255, 255, 255, 200],
        lineWidthMinPixels: 1.5, stroked: true, filled: true,
        radiusMinPixels: 6, radiusMaxPixels: 24,
        getRadius: (d) => 50 + (d.total_slots || 0) * 3, pickable: true,
        onHover: ({ object, x, y }) => setHoverInfo(object && x !== undefined && y !== undefined ? { x, y, type: 'bike', data: object } : null),
      }));
    }

    if (aqStations.length > 0) {
      (layers_to_render as any).push(new ScatterplotLayer<AQStation>({
        id: 'aq-stations', data: aqStations,
        getPosition: (d) => [d.longitude, d.latitude, 20],
        getFillColor: (d) => {
          const pm25 = d.parameters?.pm25?.value ?? d.parameters?.pm2_5?.value;
          if (pm25 == null) return [100, 116, 139, 200];
          if (pm25 <= 30) return [0, 255, 102, 230];
          if (pm25 <= 60) return [250, 204, 21, 230];
          if (pm25 <= 90) return [249, 115, 22, 230];
          return [255, 51, 102, 230];
        },
        getLineColor: [255, 255, 255, 220], lineWidthMinPixels: 2, stroked: true, filled: true,
        radiusMinPixels: 10, radiusMaxPixels: 32, getRadius: 180, pickable: true,
        onHover: ({ object, x, y }) => setHoverInfo(object && x !== undefined && y !== undefined ? { x, y, type: 'aq', data: object } : null),
      }));
    }

    const airborne = aircraft.filter(a => !a.on_ground);
    if (airborne.length > 0) {
      (layers_to_render as any).push(new ScatterplotLayer<Aircraft>({
        id: 'aircraft', data: airborne,
        getPosition: (d) => [d.longitude, d.latitude, (d.altitude ?? 1000)],
        getFillColor: [0, 210, 255, 240], 
        getLineColor: [255, 255, 255, 220],
        lineWidthMinPixels: 1.5, stroked: true, filled: true,
        radiusMinPixels: 7, radiusMaxPixels: 14, getRadius: 250,
        pickable: true,
        onHover: ({ object, x, y }) => setHoverInfo(object && x !== undefined && y !== undefined ? { x, y, type: 'aircraft', data: object } : null),
      }));
    }

    if (activeLayer === 'metro' || activeLayer === 'brts' || activeLayer === 'bus') {
      const filteredPaths = transitData.paths.filter((p: any) => p.type === activeLayer);
      const filteredStations = transitData.stations.filter((s: any) => s.type === activeLayer);

      if (filteredPaths.length > 0) {
        (layers_to_render as any).push(new PathLayer({
          id: 'transit-flow',
          data: filteredPaths,
          getPath: (d: any) => d.path,
          getColor: (d: any) => d.color,
          getWidth: 12,
          widthMinPixels: 4,
          capRounded: true,
          jointRounded: true,
          extensions: [new PathStyleExtension({ dash: true })],
          getDashArray: [8, 4],
          dashJustified: true,
          dashOffset: (Date.now() / 200) % 12,
          updateTriggers: { dashOffset: [Date.now()] }
        }));
      }

      if (filteredStations.length > 0) {
        (layers_to_render as any).push(new ScatterplotLayer({
          id: 'transit-stations-outer',
          data: filteredStations,
          getPosition: (d: any) => d.position,
          getFillColor: [255, 255, 255],
          getRadius: (d: any) => d.junction ? 22 : 16,
          radiusMinPixels: 6,
          stroked: false,
        }));

        (layers_to_render as any).push(new ScatterplotLayer({
          id: 'transit-stations-inner',
          data: filteredStations,
          getPosition: (d: any) => d.position,
          getFillColor: (d: any) => {
            if (d.line === 'red') return [239, 68, 68];
            if (d.line === 'blue') return [59, 130, 246];
            if (d.line === 'both') return [255, 165, 0];
            if (d.type === 'brts') return [34, 197, 94];
            return [251, 191, 36]; // bus color
          },
          getRadius: (d: any) => d.junction ? 14 : 10,
          radiusMinPixels: 4,
          stroked: false,
          pickable: true,
        }));

        (layers_to_render as any).push(new TextLayer({
          id: 'transit-labels',
          data: filteredStations,
          getPosition: (d: any) => d.position,
          getText: (d: any) => d.name,
          getSize: (d: any) => d.junction ? 16 : 11,
          getColor: [255, 255, 255],
          getTextAnchor: 'start',
          getAlignmentBaseline: 'center',
          getPixelOffset: [25, 0],
          outlineWidth: 3,
          outlineColor: [0, 0, 0, 180],
          fontFamily: 'Inter, sans-serif',
          fontWeight: 900,
          characterSet: 'auto'
        }));
      }
    }

    if (airborne.length > 0) {
      (layers_to_render as any).push(new TextLayer<Aircraft>({
        id: 'aircraft-labels', data: airborne,
        getPosition: (d) => [d.longitude, d.latitude, (d.altitude ?? 1000) + 150],
        getText: (d) => d.callsign || '',
        getSize: 12, getColor: [255, 255, 255, 240],
        getAngle: (d) => -(d.heading ?? 0),
        fontFamily: 'Inter, monospace', fontWeight: 800,
        background: true,
        getBackgroundColor: [15, 23, 42, 200],
        backgroundPadding: [4, 2, 4, 2],
        pickable: false,
      }));
    }

    return layers_to_render;
  }, [city, bikeStations, aqStations, aircraft, activeLayer, groundwater, landcover, transitData, timeOfDay]);

  const lightingEffect = useMemo(() => {
    const ambientLight = new AmbientLight({ color: [255, 255, 255], intensity: 1.2 });
    const date = new Date();
    date.setHours(Math.floor(timeOfDay), Math.floor((timeOfDay % 1) * 60), 0, 0);
    const sunLight = new SunLight({
      timestamp: date.getTime(),
      color: [255, 255, 255],
      intensity: 2.5,
    });
    const directionalLight = new DirectionalLight({
      color: [255, 255, 255],
      intensity: 0.8,
      direction: [0, 0, -1]
    });
    return new LightingEffect({ ambientLight, sunLight, directionalLight });
  }, [timeOfDay]);

  return (
    <div className="absolute inset-0 z-0">
      {hoverInfo && !clickInfo && (
        <div 
          className="absolute z-10 pointer-events-none p-6 rounded-2xl border border-white/10 glass-panel shadow-2xl min-w-[320px] backdrop-blur-xl"
          style={{ left: (hoverInfo.x || 0) + 15, top: (hoverInfo.y || 0) + 15 }}
        >
          {hoverInfo.type === 'bike' && <BikeTooltip station={hoverInfo.data} />}
          {hoverInfo.type === 'aq' && <AQTooltip station={hoverInfo.data} />}
          {hoverInfo.type === 'aircraft' && <AircraftTooltip ac={hoverInfo.data} />}
          {hoverInfo.type === 'pincode' && <PincodeTooltip props={hoverInfo.data} />}
          {hoverInfo.type === 'groundwater' && <GroundwaterTooltip data={hoverInfo.data} />}
          {hoverInfo.type === 'building' && <BuildingTooltip data={hoverInfo.data} />}
        </div>
      )}

      {clickInfo && (
        <div 
          className="absolute z-20 p-6 rounded-2xl border border-neon-blue/30 glass-panel shadow-[0_0_50px_rgba(0,210,255,0.2)] min-w-[340px] animate-in fade-in zoom-in duration-200"
          style={{ left: (clickInfo.x || 0) + 15, top: (clickInfo.y || 0) + 15 }}
        >
          <div className="absolute top-4 right-4 cursor-pointer text-slate-500 hover:text-white transition-colors" onClick={() => setClickInfo(null)}>
            <X size={18} />
          </div>
          <ActionMenu 
            info={clickInfo} 
            onSolar={() => {
              if (!clickInfo.coordinate) return;
              const [lon, lat] = clickInfo.coordinate;
              setSelectedLocation({ lat, lon, label: `${lat.toFixed(4)}°N, ${lon.toFixed(4)}°E` });
              onSolarRequest?.(lat, lon);
              setClickInfo(null);
            }} 
            onOrbit={() => {
              setIsOrbiting(!isOrbiting);
              setClickInfo(null);
            }}
            isOrbiting={isOrbiting}
          />
        </div>
      )}

      <DeckGL
        viewState={viewState}
        onViewStateChange={({ viewState }: any) => {
          setViewState(viewState);
          if (isOrbiting) setIsOrbiting(false);
        }}
        controller={true}
        layers={layers}
        effects={[lightingEffect]}
        onClick={handleMapClick}
      >
        <Map mapStyle={MAP_STYLE} interactive={false} />
      </DeckGL>

      {/* Aircraft count badge */}
      {aircraft.filter(a => !a.on_ground).length > 0 && (
        <div className="absolute bottom-24 right-6 glass-panel px-4 py-2 rounded-full border-neon-blue/30 text-neon-blue text-[10px] font-black uppercase tracking-widest flex items-center gap-3 shadow-neon-blue/20">
          <span className="w-2 h-2 bg-neon-blue rounded-full pulse-glow" />
          {aircraft.filter(a => !a.on_ground).length} Targets Tracking
        </div>
      )}

      {/* Map hint */}
      <div className="absolute bottom-24 left-1/2 -translate-x-1/2 glass-panel px-5 py-2 rounded-full border-white/5 text-slate-500 text-[10px] font-bold uppercase tracking-widest flex items-center gap-2">
        <Info size={14} className="text-neon-blue opacity-50" />
        Analyze map for hyper-local environmental telemetry
      </div>
    </div>
  );
}

function BikeTooltip({ station }: { station: BikeStation }) {
  const pct = station.total_slots > 0 ? station.free_bikes / station.total_slots : 0;
  const color = station.free_bikes <= 0 ? 'text-neon-red' : pct < 0.3 ? 'text-neon-yellow' : 'text-neon-green';
  const bgColor = station.free_bikes <= 0 ? 'bg-neon-red' : pct < 0.3 ? 'bg-neon-yellow' : 'bg-neon-green';
  
  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <div className={`p-2 rounded-lg bg-white/5 ${color}`}><Bike size={18} /></div>
        <div className="font-black text-white tracking-tight">{station.name}</div>
      </div>
      <div className="space-y-2 text-[11px] font-bold uppercase tracking-tighter">
        <div className="flex justify-between">
          <span className="text-slate-500">Available Units</span>
          <span className={color}>{station.free_bikes} Bikes</span>
        </div>
        <div className="flex justify-between">
          <span className="text-slate-500">Service Docks</span>
          <span className="text-slate-300">{station.empty_slots}</span>
        </div>
      </div>
      <div className="h-1.5 w-full bg-slate-900 rounded-full overflow-hidden border border-white/5">
        <div className={`h-full ${bgColor} transition-all duration-1000`} style={{ width: `${pct * 100}%` }} />
      </div>
    </div>
  );
}

function AQTooltip({ station }: { station: AQStation }) {
  const pm25 = station.parameters?.pm25?.value ?? station.parameters?.pm2_5?.value;
  const aq = pm25 != null ? (pm25 > 90 ? 'text-neon-red' : pm25 > 60 ? 'text-neon-orange' : pm25 > 30 ? 'text-neon-yellow' : 'text-neon-green') : 'text-slate-500';
  
  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <div className={`p-2 rounded-lg bg-white/5 ${aq}`}><Radio size={18} /></div>
        <div className="font-black text-white tracking-tight">{station.name}</div>
      </div>
      <div className="grid grid-cols-2 gap-3">
        {pm25 != null && (
          <div className="bg-white/5 rounded-xl p-3 border border-white/5">
            <div className="text-[9px] text-slate-500 font-black uppercase mb-1">PM2.5</div>
             <div className={`text-lg font-black ${aq}`}>{(pm25 || 0).toFixed(1)}</div>
          </div>
        )}
        {station.parameters?.pm10?.value != null && (
          <div className="bg-white/5 rounded-xl p-3 border border-white/5">
            <div className="text-[9px] text-slate-500 font-black uppercase mb-1">PM10</div>
             <div className="text-lg font-black text-white">{(station.parameters.pm10.value || 0).toFixed(1)}</div>
          </div>
        )}
      </div>
    </div>
  );
}

function AircraftTooltip({ ac }: { ac: Aircraft }) {
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-lg bg-neon-blue/10 text-neon-blue"><Plane size={18} /></div>
          <div className="font-black text-white tracking-tight">{ac.callsign || 'IDENT_REQ'}</div>
        </div>
        <div className="text-[9px] font-black text-slate-500 px-2 py-1 bg-white/5 rounded-md border border-white/5 uppercase">
          {ac.icao24}
        </div>
      </div>
      
      <div className="grid grid-cols-2 gap-3">
        {[
          { label: 'Altitude', val: ac.altitude != null ? `${Math.round(ac.altitude)}m` : 'N/A' },
          { label: 'Velocity', val: ac.velocity != null ? `${Math.round(ac.velocity * 3.6)}km/h` : 'N/A' },
          { label: 'Heading', val: ac.heading != null ? `${Math.round(ac.heading)}°` : 'N/A' },
          { label: 'V-Rate', val: ac.vertical_rate != null ? (ac.vertical_rate > 0.5 ? 'CLIMB' : ac.vertical_rate < -0.5 ? 'DESCENT' : 'LEVEL') : 'STABLE' },
        ].map(i => (
          <div key={i.label} className="bg-white/5 rounded-xl p-3 border border-white/5">
            <div className="text-[9px] text-slate-500 font-black uppercase mb-1">{i.label}</div>
            <div className="text-xs font-black text-slate-200">{i.val}</div>
          </div>
        ))}
      </div>
      <div className="text-[9px] text-slate-600 font-bold uppercase tracking-widest text-center border-t border-white/5 pt-3">
        Registry: {ac.country}
      </div>
    </div>
  );
}

function PincodeTooltip({ props }: { props: any }) {
  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <div className="p-2 rounded-lg bg-neon-purple/10 text-neon-purple"><MapIcon size={18} /></div>
        <div>
          <div className="font-black text-white tracking-tight leading-none mb-1">Zone Mapping</div>
          <div className="text-[10px] text-neon-purple font-black">ID: {props.PIN_Code}</div>
        </div>
      </div>
      <div className="space-y-2">
        {[
          { l: 'District', v: props.Office_Name },
          { l: 'Category', v: props.Office_Type },
          { l: 'Region', v: props.Region_Name },
        ].map(i => (
          <div key={i.l} className="flex justify-between items-center text-[10px] font-bold uppercase py-2 border-b border-white/5 last:border-0">
            <span className="text-slate-500">{i.l}</span>
            <span className="text-slate-200 max-w-[140px] text-right truncate">{i.v}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function GroundwaterTooltip({ data }: { data: any }) {
  const isRising = (data.gw_change ?? 0) < 0;
  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-lg bg-blue-500/10 text-blue-400"><Droplets size={20} /></div>
          <div>
            <div className="font-black text-white tracking-tight">{data.Office_Name}</div>
            <div className="text-[10px] text-slate-500 font-black uppercase tracking-widest">Hydrological Profile</div>
          </div>
        </div>
        <div className={`px-3 py-1 rounded-full text-[9px] font-black uppercase tracking-widest border ${isRising ? 'bg-neon-green/10 border-neon-green/30 text-neon-green' : 'bg-neon-red/10 border-neon-red/30 text-neon-red'}`}>
          {isRising ? 'Water Level Rise' : 'Water Level Drop'}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="bg-white/5 rounded-xl p-4 border border-white/5">
          <div className="text-[9px] text-slate-500 font-black uppercase mb-1 tracking-widest">Current Depth</div>
           <div className="text-2xl font-black text-white leading-none">{(data.gw_latest_depth || 0).toFixed(1)}<span className="text-xs text-slate-500 ml-1">m</span></div>
        </div>
        <div className="bg-white/5 rounded-xl p-4 border border-white/5">
          <div className="text-[9px] text-slate-500 font-black uppercase mb-1 tracking-widest">Delta (25Y)</div>
          <div className={`text-2xl font-black leading-none ${isRising ? 'text-neon-green' : 'text-neon-red'}`}>
             {isRising ? '+' : '-'}{Math.abs(data.gw_change || 0).toFixed(1)}<span className="text-xs opacity-50 ml-1">m</span>
          </div>
        </div>
      </div>

      <div className="h-28 w-full mt-2">
        <div className="text-[9px] text-slate-600 font-black uppercase tracking-widest mb-3 text-center">Historical Aquifer Saturation Trend</div>
        <ResponsiveContainer width="100%" height="100%" minWidth={0}>
          <LineChart data={data.gw_history ?? []}>
            <XAxis dataKey="date" hide />
            <YAxis hide reversed />
            <RechartsTooltip 
              contentStyle={{ 
                backgroundColor: 'rgba(15, 23, 42, 0.9)', 
                border: '1px solid rgba(255, 255, 255, 0.1)',
                borderRadius: '12px',
                fontSize: '10px',
                fontWeight: 'bold',
                color: '#fff'
              }} 
            />
            <Line type="monotone" dataKey="level" stroke="#3b82f6" strokeWidth={3} dot={false} />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

function BuildingTooltip({ data }: { data: any }) {
  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <div className="p-2 rounded-lg bg-slate-500/10 text-slate-400"><Activity size={20} /></div>
        <div>
          <div className="font-black text-white tracking-tight uppercase">{data.name || 'Structural Entity'}</div>
          <div className="text-[10px] text-slate-500 font-black uppercase tracking-widest">Asset ID: {data.id || 'N/A'}</div>
        </div>
      </div>
      
      <div className="grid grid-cols-2 gap-3">
        <div className="bg-white/5 rounded-xl p-3 border border-white/5">
          <div className="text-[8px] text-slate-500 font-black uppercase mb-1 tracking-widest">Elevation</div>
          <div className="text-xl font-black text-white leading-none">{(data.height || 0).toFixed(1)}<span className="text-[10px] text-slate-500 ml-1">m</span></div>
        </div>
        <div className="bg-white/5 rounded-xl p-3 border border-white/5">
          <div className="text-[8px] text-slate-500 font-black uppercase mb-1 tracking-widest">Building Type</div>
          <div className="text-xl font-black text-white leading-none truncate uppercase text-[10px]">{data.type || 'N/A'}</div>
        </div>
      </div>

      <div className="flex items-center gap-2 px-3 py-2 bg-neon-blue/5 border border-neon-blue/20 rounded-lg">
        <div className="w-1.5 h-1.5 bg-neon-blue rounded-full pulse-glow" />
        <span className="text-[9px] font-black text-neon-blue uppercase tracking-widest">Structural Integrity Verified</span>
      </div>
    </div>
  );
}

function ActionMenu({ info, onSolar, onOrbit, isOrbiting }: { info: MapInfo, onSolar: () => void, onOrbit: () => void, isOrbiting: boolean }) {
  const isBuilding = info.type === 'building';
  
  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <div className={`p-2 rounded-lg ${isBuilding ? 'bg-neon-blue/10 text-neon-blue' : 'bg-neon-green/10 text-neon-green'}`}>
          {isBuilding ? <Activity size={20} /> : <MapIcon size={20} />}
        </div>
        <div>
          <div className="font-black text-white tracking-tight uppercase text-sm">
            {isBuilding ? (info.data.name || 'Structural Entity') : 'Geo-Spatial Coordinate'}
          </div>
          <div className="text-[10px] text-slate-500 font-black uppercase tracking-widest">
            {isBuilding ? `Asset ID: ${info.data.id || 'N/A'}` : `LAT: ${info.coordinate?.[1]?.toFixed(5) || '0'} | LON: ${info.coordinate?.[0]?.toFixed(5) || '0'}`}
          </div>
        </div>
      </div>

      <div className="space-y-2">
        {isBuilding && (
          <div className="bg-white/5 border border-white/10 rounded-xl p-4 mb-4">
             <div className="grid grid-cols-2 gap-4">
                <div>
                  <div className="text-[8px] text-slate-500 font-black uppercase tracking-widest mb-1">Height</div>
                   <div className="text-lg font-black text-white">{(info.data.height || 0).toFixed(1)}m</div>
                </div>
                <div>
                  <div className="text-[8px] text-slate-500 font-black uppercase tracking-widest mb-1">Function</div>
                  <div className="text-lg font-black text-white truncate text-sm uppercase">{info.data.type || 'N/A'}</div>
                </div>
             </div>
          </div>
        )}

        <button 
          className="w-full flex items-center justify-between p-4 rounded-xl bg-neon-blue/10 border border-neon-blue/30 hover:bg-neon-blue/20 hover:border-neon-blue/50 transition-all group relative overflow-hidden"
          onClick={onSolar}
        >
          <div className="absolute inset-0 bg-gradient-to-r from-neon-blue/0 via-neon-blue/5 to-neon-blue/0 translate-x-[-100%] group-hover:translate-x-[100%] transition-transform duration-1000" />
          <div className="flex items-center gap-3 relative z-10">
            <div className="p-2 rounded-lg bg-neon-blue/20 text-neon-blue group-hover:scale-110 transition-transform">
              <Sun size={20} />
            </div>
            <div className="text-left">
              <div className="text-[11px] font-black text-white uppercase tracking-tight">Solar Potential</div>
              <div className="text-[9px] text-neon-blue font-bold uppercase">Generate Simulation</div>
            </div>
          </div>
          <Zap size={16} className="text-neon-blue group-hover:animate-pulse relative z-10" />
        </button>

        <button 
          className={`w-full flex items-center justify-between p-4 rounded-xl border transition-all group ${isOrbiting ? 'bg-neon-purple/20 border-neon-purple/50' : 'bg-white/5 border-white/10 hover:bg-white/10 hover:border-white/20'}`}
          onClick={onOrbit}
        >
          <div className="flex items-center gap-3">
            <div className={`p-2 rounded-lg ${isOrbiting ? 'bg-neon-purple/20 text-neon-purple animate-pulse' : 'bg-slate-500/10 text-slate-400 group-hover:text-white transition-colors'}`}>
              <Video size={18} />
            </div>
            <div className="text-left">
              <div className="text-[11px] font-black text-white uppercase tracking-tight">Drone Mode</div>
              <div className="text-[9px] text-slate-500 font-bold uppercase">{isOrbiting ? 'Deactivate Orbit' : 'Cinematic Inspection'}</div>
            </div>
          </div>
          <RefreshCw size={14} className={`text-slate-600 ${isOrbiting ? 'animate-spin' : ''}`} />
        </button>
      </div>

      <div className="pt-4 border-t border-white/5">
        <div className="text-[8px] text-slate-600 font-black uppercase tracking-[0.3em] text-center flex items-center justify-center gap-2">
           <span className="w-1 h-1 bg-neon-green rounded-full animate-pulse" />
           SCANNING ACTIVE SELECTION
        </div>
      </div>
    </div>
  );
}
