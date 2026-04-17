import React, { createContext, useContext, useState, useCallback, ReactNode } from 'react';

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
  features: string[];
  timezone: string;
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
    geojsonUrl: '/buildings_ahmedabad.json',
    features: ['weather', 'air-quality', 'openaq'],
    timezone: 'Asia/Kolkata',
  },
};

// ── Context ────────────────────────────────────────────────────────────────────

interface SelectedLocation {
  lat: number;
  lon: number;
  label?: string;
}

interface CityContextValue {
  city: CityConfig;
  setCity: (id: string) => void;
  selectedLocation: SelectedLocation;
  setSelectedLocation: (loc: SelectedLocation) => void;
}

const CityContext = createContext<CityContextValue | null>(null);

export function CityProvider({ children }: { children: ReactNode }) {
  const [cityId, setCityId] = useState<string>('helsinki');
  const [selectedLocation, setSelectedLocation] = useState<SelectedLocation>({
    lat: 60.1699,
    lon: 24.9384,
    label: 'Helsinki City Center',
  });

  const setCity = useCallback((id: string) => {
    if (CITIES[id]) {
      setCityId(id);
      const cfg = CITIES[id];
      setSelectedLocation({ lat: cfg.lat, lon: cfg.lon, label: cfg.name + ' City Center' });
    }
  }, []);

  return (
    <CityContext.Provider value={{ city: CITIES[cityId], setCity, selectedLocation, setSelectedLocation }}>
      {children}
    </CityContext.Provider>
  );
}

export function useCityContext(): CityContextValue {
  const ctx = useContext(CityContext);
  if (!ctx) throw new Error('useCityContext must be used inside CityProvider');
  return ctx;
}
