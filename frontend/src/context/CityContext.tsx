import { createContext, useContext, useState, useCallback } from 'react';
import type { ReactNode } from 'react';

// ── City Config ────────────────────────────────────────────────────────────────

export interface CityConfig {
  id: string;
  name: string;
  flag: string;
  lat: number;
  lon: number;
  zoom: number;
  pitch: number;
  bearing: number;
  buildings: 'geojson' | '3d-tiles';
  tilesUrl?: string;
  geojsonUrl?: string;
  pincodeUrl?: string;
  groundwaterUrl?: string;
  landcoverUrl?: string;
  features: string[];
  timezone: string;
  // Meta
  population?: string;
  area?: string;
  status?: 'NOMINAL' | 'MAINTENANCE' | 'ALERT';
}

export const CITIES: Record<string, CityConfig> = {
  helsinki: {
    id: 'helsinki',
    name: 'Helsinki',
    flag: '🇫🇮',
    lat: 60.1699,
    lon: 24.9384,
    zoom: 13.5,
    pitch: 55,
    bearing: -10,
    buildings: '3d-tiles',
    tilesUrl: 'https://kartta.hel.fi/3d/mesh/Helsinki_2024/tileset.json',
    features: ['weather', 'air-quality', 'city-bikes'],
    timezone: 'Europe/Helsinki',
    population: '658,864',
    area: '213.8 km²',
    status: 'NOMINAL',
  },
  ahmedabad: {
    id: 'ahmedabad',
    name: 'Ahmedabad',
    flag: '🇮🇳',
    lat: 23.0225,
    lon: 72.5714,
    zoom: 13,
    pitch: 50,
    bearing: 10,
    buildings: 'geojson',
    geojsonUrl: '/buildings_lod1.json',
    pincodeUrl: '/ahmedabad_pincodes.json',
    groundwaterUrl: '/ahmedabad_groundwater_zones.json',
    landcoverUrl: '/landcover_ahmedabad.json',
    features: ['weather', 'air-quality', 'openaq'],
    timezone: 'Asia/Kolkata',
    population: '8,253,000',
    area: '464 km²',
    status: 'NOMINAL',
  },
};

// ── Context ────────────────────────────────────────────────────────────────────

interface SelectedLocation {
  lat: number;
  lon: number;
  label?: string;
}

export type ActiveLayer = 'buildings' | 'demographics' | 'groundwater' | 'landcover' | 'metro' | 'brts' | 'bus';

interface CityContextValue {
  city: CityConfig;
  setCity: (id: string) => void;
  selectedLocation: SelectedLocation;
  setSelectedLocation: (loc: SelectedLocation) => void;
  timeOfDay: number;
  setTimeOfDay: (t: number) => void;
  activeLayer: ActiveLayer;
  setActiveLayer: (layer: ActiveLayer) => void;
}

const CityContext = createContext<CityContextValue | null>(null);

export function CityProvider({ children }: { children: ReactNode }) {
  const [cityId, setCityId] = useState<string>('ahmedabad');
  const [selectedLocation, setSelectedLocation] = useState<SelectedLocation>({
    lat: 23.0225,
    lon: 72.5714,
    label: 'Ahmedabad City Center',
  });
  
  const [timeOfDay, setTimeOfDay] = useState<number>(new Date().getHours() + new Date().getMinutes() / 60);
  const [activeLayer, setActiveLayer] = useState<ActiveLayer>('buildings');

  const setCity = useCallback((id: string) => {
    if (CITIES[id]) {
      setCityId(id);
      const cfg = CITIES[id];
      setSelectedLocation({ lat: cfg.lat, lon: cfg.lon, label: cfg.name + ' City Center' });
    }
  }, []);

  return (
    <CityContext.Provider value={{ city: CITIES[cityId], setCity, selectedLocation, setSelectedLocation, timeOfDay, setTimeOfDay, activeLayer, setActiveLayer }}>
      {children}
    </CityContext.Provider>
  );
}

export function useCityContext(): CityContextValue {
  const ctx = useContext(CityContext);
  if (!ctx) throw new Error('useCityContext must be used inside CityProvider');
  return ctx;
}
