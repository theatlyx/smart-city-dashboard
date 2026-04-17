import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Activity, MapPin, Bell, User, CloudSun, Search, AlertCircle } from 'lucide-react';
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts';

interface WeatherForecastPoint {
  time: string;
  temperature_2m: number | null;
  precipitation_probability: number | null;
}

interface WeatherResponse {
  current: {
    temperature_2m: number;
    relative_humidity_2m: number;
    wind_speed_10m: number;
    precipitation: number;
    time: string;
  };
  forecast: WeatherForecastPoint[];
}

interface AirQualityForecastPoint {
  time: string;
  pm2_5: number | null;
  pm10: number | null;
  carbon_monoxide: number | null;
}

interface AirQualityResponse {
  current: {
    pm2_5: number;
    pm10: number;
    carbon_monoxide: number;
    time: string;
  };
  forecast: AirQualityForecastPoint[];
}

interface CityBikeStation {
  id: string;
  free_bikes: number;
  empty_slots: number;
}

interface CityBikesResponse {
  stations: CityBikeStation[];
}

const API_BASE = import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:8000';

export default function DashboardLayout() {
  const [weather, setWeather] = useState<WeatherResponse | null>(null);
  const [airQuality, setAirQuality] = useState<AirQualityResponse | null>(null);
  const [cityBikes, setCityBikes] = useState<CityBikesResponse | null>(null);

  const fetchDashboardData = useCallback(async () => {
    try {
      const [weatherResponse, airQualityResponse, cityBikesResponse] = await Promise.all([
        fetch(`${API_BASE}/api/weather`),
        fetch(`${API_BASE}/api/air-quality`),
        fetch(`${API_BASE}/api/city-bikes`),
      ]);
      if (!weatherResponse.ok || !airQualityResponse.ok || !cityBikesResponse.ok) {
        throw new Error('One or more dashboard API requests failed.');
      }

      const weatherPayload = (await weatherResponse.json()) as WeatherResponse;
      const airQualityPayload = (await airQualityResponse.json()) as AirQualityResponse;
      const cityBikesPayload = (await cityBikesResponse.json()) as CityBikesResponse;

      setWeather(weatherPayload);
      setAirQuality(airQualityPayload);
      setCityBikes(cityBikesPayload);
    } catch (error) {
      console.error('Failed to fetch dashboard data', error);
    }
  }, []);

  useEffect(() => {
    fetchDashboardData();
    const intervalId = window.setInterval(fetchDashboardData, 60_000);
    return () => window.clearInterval(intervalId);
  }, [fetchDashboardData]);

  const bikeSummary = useMemo(() => {
    const stations = cityBikes?.stations ?? [];
    const stationCount = stations.length;
    const totalBikes = stations.reduce((sum, station) => sum + (station.free_bikes || 0), 0);
    const zeroBikeStations = stations.reduce((sum, station) => sum + (station.free_bikes <= 0 ? 1 : 0), 0);
    return { stationCount, totalBikes, zeroBikeStations };
  }, [cityBikes]);

  const weatherChartData = useMemo(
    () =>
      (weather?.forecast ?? []).map((point) => ({
        time: new Date(point.time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        temperature: point.temperature_2m,
      })),
    [weather],
  );

  const airQualityChartData = useMemo(
    () =>
      (airQuality?.forecast ?? []).map((point) => ({
        time: new Date(point.time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        pm25: point.pm2_5,
      })),
    [airQuality],
  );

  return (
    <div className="absolute inset-0 pointer-events-none p-4 flex flex-col justify-between">
      {/* Top Header */}
      <header className="glass-panel flex items-center justify-between px-6 py-3 pointer-events-auto shadow-2xl">
        <div className="flex items-center gap-2">
          <Activity className="text-[var(--color-neon-blue)] w-6 h-6" />
          <h1 className="font-bold text-lg tracking-wider">Smart City Platform</h1>
        </div>
        
        <nav className="flex gap-8 text-sm font-medium">
          <a href="#" className="text-slate-400 hover:text-white transition">Overview</a>
          <a href="#" className="text-white border-b-2 border-[var(--color-neon-blue)] pb-1">Monitoring</a>
          <a href="#" className="text-slate-400 hover:text-white transition">Predictive AI</a>
          <a href="#" className="text-slate-400 hover:text-white transition">Management</a>
        </nav>

        <div className="flex items-center gap-6 text-sm">
          <div className="flex items-center gap-2 bg-slate-800/50 px-3 py-1.5 rounded-full border border-slate-700">
            <MapPin className="w-4 h-4 text-slate-400" />
            <span>Helsinki</span>
          </div>
          <div className="flex items-center gap-2">
            <CloudSun className="w-5 h-5 text-yellow-400" />
            <span>
              {weather?.current?.temperature_2m !== undefined
                ? `${Math.round(weather.current.temperature_2m)}°C, Live`
                : 'Loading weather...'}
            </span>
          </div>
          <Bell className="w-5 h-5 text-slate-400 cursor-pointer hover:text-white transition" />
          <div className="w-8 h-8 rounded-full bg-blue-600 flex items-center justify-center">
            <User className="w-4 h-4" />
          </div>
        </div>
      </header>

      {/* Main Content Area */}
      <main className="flex-1 flex justify-between mt-4 overflow-hidden gap-4">
        
        {/* Left Panel */}
        <aside className="w-80 flex flex-col gap-4 pointer-events-auto overflow-y-auto hide-scrollbar">
          <div className="glass-panel p-4 flex flex-col gap-4">
            <div className="flex justify-between items-center">
              <h2 className="font-semibold flex items-center gap-2 text-sm text-slate-300">
                <Search className="w-4 h-4" /> Live Weather
              </h2>
              <span className="text-xs bg-cyan-500/20 text-cyan-300 px-2 py-0.5 rounded-full flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-cyan-400"></span>
                Open-Meteo
              </span>
            </div>
            <div className="bg-slate-800/40 rounded-lg p-3 text-xs flex flex-col gap-2">
              <div className="flex justify-between">
                <span className="text-slate-400">Temperature</span>
                <span>{weather?.current?.temperature_2m ?? '--'} C</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">Humidity</span>
                <span>{weather?.current?.relative_humidity_2m ?? '--'} %</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">Wind Speed</span>
                <span>{weather?.current?.wind_speed_10m ?? '--'} km/h</span>
              </div>
            </div>

            <div className="mt-2">
              <h3 className="text-xs font-semibold text-slate-400 mb-2">SHORT TERM TEMPERATURE FORECAST</h3>
              <div className="h-32 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={weatherChartData}>
                    <XAxis dataKey="time" fontSize={10} tickLine={false} axisLine={false} />
                    <YAxis hide />
                    <Tooltip contentStyle={{ backgroundColor: '#0f172a', border: 'none', borderRadius: '8px' }} />
                    <Line type="monotone" dataKey="temperature" stroke="var(--color-neon-blue)" strokeWidth={2} dot={false} />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>
        </aside>

        {/* Right Panel */}
        <aside className="w-80 flex flex-col gap-4 pointer-events-auto overflow-y-auto hide-scrollbar">
          <div className="glass-panel p-4 flex flex-col gap-3">
            <h2 className="font-semibold text-sm text-slate-300">City Bike Status</h2>
            
            <div className="flex gap-2 text-xs mb-2">
              <div className="flex-1 border-t-2 border-emerald-400 pt-1">
                <div className="font-bold">{bikeSummary.totalBikes}</div>
                <div className="text-slate-400">Bikes Available</div>
              </div>
              <div className="flex-1 border-t-2 border-yellow-500 pt-1">
                <div className="font-bold">{bikeSummary.zeroBikeStations}</div>
                <div className="text-slate-400">Empty Stations</div>
              </div>
            </div>

            <div className="bg-red-500/10 border border-red-500/20 p-3 rounded-lg text-sm">
              <div className="flex items-center gap-2 text-[var(--color-neon-red)] font-semibold mb-1">
                <AlertCircle className="w-4 h-4" /> Air Quality (Current)
              </div>
              <p className="text-xs text-slate-400">
                PM2.5: {airQuality?.current?.pm2_5 ?? '--'} ug/m3 | PM10: {airQuality?.current?.pm10 ?? '--'} ug/m3
              </p>
              <div className="text-[10px] text-slate-500 mt-2">Live feed (Open-Meteo AQ)</div>
            </div>

            <div className="bg-yellow-500/10 border border-yellow-500/20 p-3 rounded-lg text-sm">
              <div className="flex items-center gap-2 text-yellow-500 font-semibold mb-1">
                <AlertCircle className="w-4 h-4" /> City Bike Network
              </div>
              <p className="text-xs text-slate-400">Active stations monitored: {bikeSummary.stationCount}</p>
              <div className="text-[10px] text-slate-500 mt-2">Live feed (CityBik.es)</div>
            </div>

            <div className="mt-2">
              <h3 className="text-xs font-semibold text-slate-400 mb-2">SHORT TERM PM2.5 FORECAST</h3>
              <div className="h-32 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={airQualityChartData}>
                    <XAxis dataKey="time" fontSize={10} tickLine={false} axisLine={false} />
                    <YAxis hide />
                    <Tooltip contentStyle={{ backgroundColor: '#0f172a', border: 'none', borderRadius: '8px' }} />
                    <Line type="monotone" dataKey="pm25" stroke="#f59e0b" strokeWidth={2} dot={false} />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>
        </aside>
      </main>

      {/* Bottom Panel (Timeline) */}
      <footer className="glass-panel mt-4 p-4 pointer-events-auto flex items-center justify-between">
         <div className="text-xs text-slate-400 flex items-center gap-4 w-full">
            <div className="font-semibold text-white">Vehicle Distribution</div>
            <div className="flex-1 h-8 flex items-end justify-between px-4 opacity-50">
               {/* Dummy barcode/timeline effect */}
               {[...Array(40)].map((_, i) => (
                  <div key={i} className="w-1 bg-[var(--color-neon-blue)] rounded-t-sm" style={{ height: `${Math.random() * 100}%` }}></div>
               ))}
            </div>
         </div>
      </footer>
    </div>
  );
}
