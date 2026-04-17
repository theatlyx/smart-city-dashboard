import React, { useCallback, useEffect, useMemo, useState } from 'react';
import DeckGL from '@deck.gl/react';
import { ScatterplotLayer } from '@deck.gl/layers';
import { Tile3DLayer } from '@deck.gl/geo-layers';
import { Tiles3DLoader } from '@loaders.gl/3d-tiles';
import { Map } from 'react-map-gl/maplibre';
import 'maplibre-gl/dist/maplibre-gl.css';

const INITIAL_VIEW_STATE = {
  longitude: 24.979, // Kalasatama
  latitude: 60.187,
  zoom: 15.5,
  pitch: 60,
  bearing: 20
};

// Use Carto dark matter as a free dark basemap
const MAP_STYLE = 'https://basemaps.cartocdn.com/gl/dark-matter-gl-style/style.json';

interface BikeStation {
  id: string;
  name: string;
  latitude: number;
  longitude: number;
  free_bikes: number;
  empty_slots: number;
  total_slots: number;
}

interface CityBikesResponse {
  stations: BikeStation[];
}

const API_BASE = import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:8000';

function stationColor(station: BikeStation): [number, number, number, number] {
  if (station.free_bikes <= 0) return [255, 59, 48, 230];
  const ratio = station.total_slots > 0 ? station.free_bikes / station.total_slots : 0;
  if (ratio < 0.3) return [255, 159, 10, 220];
  return [52, 211, 153, 220];
}

export default function MapComponent() {
  const [stations, setStations] = useState<BikeStation[]>([]);

  const fetchStations = useCallback(async () => {
    try {
      const response = await fetch(`${API_BASE}/api/city-bikes`);
      if (!response.ok) {
        throw new Error(`City bikes request failed: ${response.status}`);
      }
      const payload = (await response.json()) as CityBikesResponse;
      setStations(payload.stations ?? []);
    } catch (error) {
      console.error('Failed to fetch city bike stations', error);
    }
  }, []);

  useEffect(() => {
    fetchStations();
    const intervalId = window.setInterval(fetchStations, 60_000);
    return () => window.clearInterval(intervalId);
  }, [fetchStations]);

  const layers = useMemo(
    () => [
      new Tile3DLayer({
        id: 'helsinki-reality-mesh',
        data: 'https://kartta.hel.fi/3d/mesh/Helsinki_2024/tileset.json',
        loader: Tiles3DLoader,
      }),
      new ScatterplotLayer<BikeStation>({
        id: 'city-bike-stations',
        data: stations,
        getPosition: (d) => [d.longitude, d.latitude],
        getFillColor: (d) => stationColor(d),
        getLineColor: [255, 255, 255, 180],
        lineWidthMinPixels: 1,
        stroked: true,
        filled: true,
        opacity: 0.95,
        radiusMinPixels: 5,
        radiusMaxPixels: 22,
        getRadius: (d) => 50 + (d.total_slots || 0) * 1.8,
        pickable: true,
      }),
    ],
    [stations],
  );

  return (
    <div className="absolute inset-0 z-0">
      <DeckGL
        initialViewState={INITIAL_VIEW_STATE}
        controller={true}
        layers={layers}
        getCursor={({ isDragging }) => (isDragging ? 'grabbing' : 'grab')}
      >
        <Map
          mapStyle={MAP_STYLE}
          interactive={false}
        />
      </DeckGL>
    </div>
  );
}
