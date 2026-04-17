import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Activity, MapPin, Bell, User, Wind, Droplets, Thermometer, Bike, AlertTriangle, RefreshCw, ChevronDown, Sun, X, Calendar, CloudRain } from 'lucide-react';
import { AreaChart, Area, LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts';
import { useCityContext, CITIES } from '../context/CityContext';

const API_BASE = import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:8000';

function aqiLabel(pm25: number) {
  if (pm25 <= 12) return { label: 'Good', color: '#34d399', bg: 'rgba(52,211,153,0.12)' };
  if (pm25 <= 35) return { label: 'Moderate', color: '#fbbf24', bg: 'rgba(251,191,36,0.12)' };
  if (pm25 <= 55) return { label: 'Unhealthy (Sensitive)', color: '#f97316', bg: 'rgba(249,115,22,0.12)' };
  if (pm25 <= 150) return { label: 'Unhealthy', color: '#f43f5e', bg: 'rgba(244,63,94,0.12)' };
  return { label: 'Hazardous', color: '#7c3aed', bg: 'rgba(124,58,237,0.12)' };
}

function fmt(timeStr: string) {
  return new Date(timeStr).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false });
}

const tip = { backgroundColor: '#0f172a', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 8, fontSize: 11 };

export default function DashboardLayout({ solarCoords, onCloseSolar }: { solarCoords: any, onCloseSolar: () => void }) {
  const { city, setCity, selectedLocation, timeOfDay, setTimeOfDay } = useCityContext();
  const [weather, setWeather] = useState<any>(null);
  const [airQuality, setAirQuality] = useState<any>(null);
  const [cityBikes, setCityBikes] = useState<any>(null);
  const [openaq, setOpenaq] = useState<any>(null);
  const [solarData, setSolarData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [solarLoading, setSolarLoading] = useState(false);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [cityDropdown, setCityDropdown] = useState(false);

  const fetchAll = useCallback(async () => {
    try {
      const { lat, lon } = selectedLocation;
      const tz = city.timezone;
      const promises: Promise<any>[] = [
        fetch(`${API_BASE}/api/weather?lat=${lat}&lon=${lon}&tz=${tz}`).then(r => r.ok ? r.json() : null),
        fetch(`${API_BASE}/api/air-quality?lat=${lat}&lon=${lon}&tz=${tz}`).then(r => r.ok ? r.json() : null),
      ];
      if (city.features.includes('city-bikes')) promises.push(fetch(`${API_BASE}/api/city-bikes`).then(r => r.ok ? r.json() : null));
      if (city.features.includes('openaq')) promises.push(fetch(`${API_BASE}/api/openaq?city=${encodeURIComponent(city.name)}`).then(r => r.ok ? r.json() : null));
      
      const [w, aq, ...rest] = await Promise.all(promises);
      if (w) setWeather(w);
      if (aq) setAirQuality(aq);
      if (city.features.includes('city-bikes') && rest[0]) setCityBikes(rest[0]);
      if (city.features.includes('openaq') && rest[0]) setOpenaq(rest[0]);
      setLastUpdated(new Date());
    } catch (e) { console.error(e); }
    finally { setLoading(false); }
  }, [selectedLocation, city]);

  useEffect(() => { fetchAll(); const id = setInterval(fetchAll, 60_000); return () => clearInterval(id); }, [fetchAll]);

  useEffect(() => {
    if (!solarCoords) { setSolarData(null); return; }
    const fetchSolar = async () => {
      setSolarLoading(true);
      try {
        const r = await fetch(`${API_BASE}/api/solar?lat=${solarCoords.lat}&lon=${solarCoords.lon}`);
        if (r.ok) setSolarData(await r.json());
      } catch { }
      finally { setSolarLoading(false); }
    };
    fetchSolar();
  }, [solarCoords]);

  const wxChart = useMemo(() => (weather?.forecast ?? []).map((p: any) => ({ time: fmt(p.time), temp: p.temperature_2m, rain: p.precipitation_probability })), [weather]);
  const aqChart = useMemo(() => (airQuality?.forecast ?? []).map((p: any) => ({ time: fmt(p.time), pm25: p.pm2_5 })), [airQuality]);

  const bikes = useMemo(() => {
    const s = cityBikes?.stations ?? [];
    return { total: s.reduce((a: number, x: any) => a + (x.free_bikes || 0), 0), empty: s.filter((x: any) => x.free_bikes <= 0).length, low: s.filter((x: any) => x.free_bikes > 0 && x.free_bikes / (x.total_slots || 1) < 0.3).length, count: s.length };
  }, [cityBikes]);

  const aqi = airQuality?.current?.pm2_5 != null ? aqiLabel(airQuality.current.pm2_5) : null;
  const cur = weather?.current ?? {};
  const daily = weather?.daily ?? [];

  return (
    <div className="absolute inset-0 pointer-events-none p-4 flex flex-col" style={{ gap: 12 }}>
      {/* Header */}
      <header className="glass-panel pointer-events-auto" style={{ padding: '10px 20px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <Activity size={20} style={{ color: '#00d2ff' }} />
          <h1 style={{ fontSize: 15, fontWeight: 700, letterSpacing: '0.08em', margin: 0 }}>SMART CITY DIGITAL TWIN</h1>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 12, fontSize: 12 }}>
          {/* City Switcher */}
          <div style={{ position: 'relative' }}>
            <button onClick={() => setCityDropdown(d => !d)} style={{ display: 'flex', alignItems: 'center', gap: 6, background: 'rgba(51,65,85,0.8)', border: '1px solid rgba(255,255,255,0.12)', borderRadius: 20, padding: '5px 14px', color: '#e2e8f0', cursor: 'pointer', fontSize: 12, fontWeight: 600 }}>
              <span>{city.flag}</span> {city.name} <ChevronDown size={12} />
            </button>
            {cityDropdown && (
              <div style={{ position: 'absolute', top: '110%', right: 0, background: '#0f172a', border: '1px solid rgba(255,255,255,0.12)', borderRadius: 10, overflow: 'hidden', zIndex: 200, minWidth: 180 }}>
                {Object.values(CITIES).map(c => (
                  <button key={c.id} onClick={() => { setCity(c.id); setCityDropdown(false); onCloseSolar(); }} style={{ display: 'flex', alignItems: 'center', gap: 10, width: '100%', padding: '10px 16px', background: c.id === city.id ? 'rgba(0,210,255,0.1)' : 'transparent', border: 'none', color: c.id === city.id ? '#00d2ff' : '#e2e8f0', cursor: 'pointer', fontSize: 12, textAlign: 'left' }}>
                    <span style={{ fontSize: 18 }}>{c.flag}</span>
                    <div>
                      <div style={{ fontWeight: 600 }}>{c.name}</div>
                      <div style={{ fontSize: 10, color: '#64748b' }}>{c.features.join(' · ')}</div>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 5, background: 'rgba(51,65,85,0.5)', borderRadius: 20, padding: '4px 12px', border: '1px solid rgba(255,255,255,0.08)' }}>
            <MapPin size={11} style={{ color: '#94a3b8' }} />
            <span style={{ color: '#94a3b8' }}>{selectedLocation.label}</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
            <Thermometer size={14} style={{ color: '#fbbf24' }} />
            <span style={{ fontWeight: 600 }}>{cur.temperature_2m != null ? `${cur.temperature_2m}°C` : '--'}</span>
          </div>
          {loading && <RefreshCw size={13} style={{ color: '#64748b', animation: 'spin 1s linear infinite' }} />}
        </div>
      </header>

      {/* Body */}
      <div style={{ flex: 1, display: 'flex', gap: 12, overflow: 'hidden' }}>
        {/* Left Panel */}
        <aside className="pointer-events-auto" style={{ width: 300, display: 'flex', flexDirection: 'column', gap: 10, overflowY: 'auto', paddingRight: 4 }}>
          {/* Weather */}
          <div className="glass-panel" style={{ padding: 14 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
              <h2 style={{ margin: 0, fontSize: 12, fontWeight: 600, display: 'flex', alignItems: 'center', gap: 6 }}><Thermometer size={13} /> Live Weather</h2>
              <span style={{ fontSize: 10, color: '#00d2ff', background: 'rgba(0,210,255,0.1)', border: '1px solid rgba(0,210,255,0.25)', borderRadius: 20, padding: '2px 8px' }}>● Open-Meteo</span>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6, marginBottom: 12 }}>
              {[
                { icon: <Thermometer size={14} />, label: 'Temp', value: cur.temperature_2m ?? '--', unit: '°C' },
                { icon: <Droplets size={14} />, label: 'Humidity', value: cur.relative_humidity_2m ?? '--', unit: '%' },
                { icon: <Wind size={14} />, label: 'Wind', value: cur.wind_speed_10m ?? '--', unit: 'km/h' },
                { icon: <CloudRain size={14} />, label: 'Precip', value: cur.precipitation ?? '--', unit: 'mm' },
              ].map(({ icon, label, value, unit }) => (
                <div key={label} style={{ background: 'rgba(30,41,59,0.7)', borderRadius: 8, padding: '8px 10px', display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span style={{ color: '#60a5fa' }}>{icon}</span>
                  <div>
                    <div style={{ fontSize: 9, color: '#64748b', textTransform: 'uppercase' }}>{label}</div>
                    <div style={{ fontSize: 16, fontWeight: 700 }}>{value}<span style={{ fontSize: 10, color: '#94a3b8', marginLeft: 2 }}>{unit}</span></div>
                  </div>
                </div>
              ))}
            </div>
            
            {/* 7-Day Forecast */}
            <div style={{ fontSize: 10, color: '#475569', marginBottom: 6, marginTop: 12, textTransform: 'uppercase', letterSpacing: '0.06em', display: 'flex', alignItems: 'center', gap: 4 }}><Calendar size={11} /> 7-Day Forecast</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              {daily.slice(0, 7).map((d: any, i: number) => {
                const date = new Date(d.date);
                const dayName = i === 0 ? 'Today' : i === 1 ? 'Tmw' : date.toLocaleDateString('en-US', { weekday: 'short' });
                return (
                  <div key={d.date} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'rgba(30,41,59,0.4)', padding: '6px 10px', borderRadius: 6, fontSize: 11 }}>
                    <div style={{ width: 45, fontWeight: 600, color: i === 0 ? '#00d2ff' : '#e2e8f0' }}>{dayName}</div>
                    <div style={{ display: 'flex', gap: 4, width: 40, color: '#93c5fd' }}>
                      <CloudRain size={12} /> {d.precipitation_probability_max}%
                    </div>
                    <div style={{ display: 'flex', gap: 8, fontWeight: 500, width: 60, justifyContent: 'flex-end' }}>
                      <span style={{ color: '#94a3b8' }}>{Math.round(d.temp_min)}°</span>
                      <span style={{ color: '#fff' }}>{Math.round(d.temp_max)}°</span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* AQI */}
          <div className="glass-panel" style={{ padding: 14 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
              <h2 style={{ margin: 0, fontSize: 12, fontWeight: 600 }}>Air Quality Index</h2>
              <span style={{ fontSize: 10, color: '#00d2ff', background: 'rgba(0,210,255,0.1)', border: '1px solid rgba(0,210,255,0.25)', borderRadius: 20, padding: '2px 8px' }}>● Open-Meteo AQ</span>
            </div>
            {aqi && (
              <div style={{ background: aqi.bg, border: `1px solid ${aqi.color}40`, borderRadius: 8, padding: '10px 12px', marginBottom: 10, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                  <div style={{ fontSize: 20, fontWeight: 800, color: aqi.color }}>{aqi.label}</div>
                  <div style={{ fontSize: 9, color: '#64748b', marginTop: 2 }}>WHO Air Quality Standard</div>
                </div>
                <div style={{ textAlign: 'right', fontSize: 11, color: '#94a3b8', lineHeight: 1.9 }}>
                  <div>PM2.5 <b style={{ color: '#e2e8f0' }}>{airQuality?.current?.pm2_5 ?? '--'}</b> µg/m³</div>
                  <div>PM10 <b style={{ color: '#e2e8f0' }}>{airQuality?.current?.pm10 ?? '--'}</b> µg/m³</div>
                </div>
              </div>
            )}
            <div style={{ fontSize: 10, color: '#475569', marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.06em' }}>PM2.5 Forecast</div>
            <div style={{ height: 75 }}>
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={aqChart}>
                  <XAxis dataKey="time" fontSize={9} tickLine={false} axisLine={false} interval={3} />
                  <YAxis hide />
                  <Tooltip contentStyle={tip} />
                  <Line type="monotone" dataKey="pm25" stroke="#f97316" strokeWidth={1.5} dot={false} name="PM2.5 µg/m³" />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>
        </aside>

        <div style={{ flex: 1, position: 'relative' }}>
          {/* Solar Panel Overlay */}
          {solarCoords && (
            <div className="glass-panel pointer-events-auto" style={{ position: 'absolute', top: 10, left: '50%', transform: 'translateX(-50%)', width: 340, padding: 16, zIndex: 50, border: '1px solid rgba(250,204,21,0.3)', background: 'rgba(15,23,42,0.95)' }}>
              <button onClick={onCloseSolar} style={{ position: 'absolute', top: 12, right: 12, background: 'none', border: 'none', color: '#94a3b8', cursor: 'pointer' }}><X size={16} /></button>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12, color: '#facc15' }}>
                <Sun size={18} />
                <h2 style={{ margin: 0, fontSize: 14, fontWeight: 700 }}>Solar Potential Estimate</h2>
              </div>
              <div style={{ fontSize: 11, color: '#94a3b8', marginBottom: 12 }}>
                Location: {solarCoords.lat.toFixed(4)}°N, {solarCoords.lon.toFixed(4)}°E
              </div>
              
              {solarLoading ? (
                <div style={{ padding: '20px 0', textAlign: 'center', color: '#64748b', fontSize: 12 }}><RefreshCw size={14} className="animate-spin inline-block mr-2" /> Analyzing PVGIS satellite data...</div>
              ) : solarData ? (
                <>
                  <div style={{ background: 'rgba(250,204,21,0.1)', borderRadius: 8, padding: '12px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                    <div>
                      <div style={{ fontSize: 10, color: '#facc15', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 2 }}>Annual Generation</div>
                      <div style={{ fontSize: 24, fontWeight: 800, color: '#fff' }}>{Math.round(solarData.annual_kwh)} <span style={{ fontSize: 12, fontWeight: 500, color: '#94a3b8' }}>kWh / yr</span></div>
                    </div>
                    <div style={{ textAlign: 'right' }}>
                      <div style={{ fontSize: 10, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 2 }}>Daily Avg</div>
                      <div style={{ fontSize: 16, fontWeight: 600, color: '#e2e8f0' }}>{solarData.daily_avg_kwh?.toFixed(1)} <span style={{ fontSize: 10, color: '#94a3b8' }}>kWh</span></div>
                    </div>
                  </div>
                  <div style={{ fontSize: 10, color: '#64748b', marginBottom: 8 }}>Estimated for a standard 1 kWp roof installation.</div>
                  <div style={{ display: 'flex', alignItems: 'flex-end', gap: 2, height: 70, marginTop: 15, borderBottom: '1px solid rgba(255,255,255,0.1)' }}>
                    {solarData.monthly.map((m: any) => {
                      // Dynamically scale based on max month (approx 200 max)
                      const maxKwh = Math.max(...solarData.monthly.map((m: any) => m.kwh));
                      const scale = maxKwh > 0 ? (m.kwh / maxKwh) * 100 : 0;
                      return (
                        <div key={m.month} style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'flex-end', alignItems: 'center', gap: 4, height: '100%' }}>
                          <div style={{ width: '100%', background: '#facc15', borderRadius: '3px 3px 0 0', height: `calc(${scale}% - 14px)`, minHeight: 2, opacity: 0.8 }} title={`${m.kwh} kWh`} />
                          <div style={{ fontSize: 8, color: '#64748b', height: 10 }}>{m.month[0]}</div>
                        </div>
                      );
                    })}
                  </div>
                </>
              ) : (
                <div style={{ color: '#f43f5e', fontSize: 12 }}>Failed to load solar data.</div>
              )}
            </div>
          )}

          {/* Time Travel Slider */}
          <div className="glass-panel pointer-events-auto" style={{ position: 'absolute', bottom: 30, left: '50%', transform: 'translateX(-50%)', width: 400, padding: '12px 20px', zIndex: 50, display: 'flex', alignItems: 'center', gap: 15, background: 'rgba(15,23,42,0.85)', backdropFilter: 'blur(12px)', borderRadius: 30, border: '1px solid rgba(255,255,255,0.1)' }}>
            <Sun size={18} style={{ color: timeOfDay >= 6 && timeOfDay <= 19 ? '#fbbf24' : '#64748b' }} />
            <input 
              type="range" 
              min="0" max="23.99" step="0.1" 
              value={timeOfDay} 
              onChange={(e) => setTimeOfDay(parseFloat(e.target.value))}
              style={{ flex: 1, accentColor: '#00d2ff', cursor: 'ew-resize' }}
            />
            <div style={{ fontSize: 13, fontWeight: 700, width: 45, textAlign: 'right', color: '#e2e8f0', fontFamily: 'monospace' }}>
              {Math.floor(timeOfDay).toString().padStart(2, '0')}:{Math.floor((timeOfDay % 1) * 60).toString().padStart(2, '0')}
            </div>
          </div>
        </div>

        {/* Right Panel */}
        <aside className="pointer-events-auto" style={{ width: 300, display: 'flex', flexDirection: 'column', gap: 10, overflowY: 'auto', paddingRight: 4 }}>
          {/* City Bikes */}
          {city.features.includes('city-bikes') && (
            <div className="glass-panel" style={{ padding: 14 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
                <h2 style={{ margin: 0, fontSize: 12, fontWeight: 600, display: 'flex', alignItems: 'center', gap: 6 }}><Bike size={13} /> City Bikes</h2>
                <span style={{ fontSize: 10, color: '#00d2ff', background: 'rgba(0,210,255,0.1)', border: '1px solid rgba(0,210,255,0.25)', borderRadius: 20, padding: '2px 8px' }}>● CityBik.es</span>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 6, marginBottom: 10 }}>
                {[{ label: 'Bikes Live', value: bikes.total, color: '#34d399' }, { label: 'Low Stock', value: bikes.low, color: '#fbbf24' }, { label: 'Empty', value: bikes.empty, color: '#f43f5e' }].map(({ label, value, color }) => (
                  <div key={label} style={{ background: 'rgba(30,41,59,0.7)', borderRadius: 8, padding: '8px', borderTop: `2px solid ${color}` }}>
                    <div style={{ fontSize: 20, fontWeight: 700, color }}>{value}</div>
                    <div style={{ fontSize: 9, color: '#64748b', marginTop: 2 }}>{label}</div>
                  </div>
                ))}
              </div>
              <div style={{ fontSize: 10, color: '#475569', marginBottom: 5 }}>{bikes.count} stations total</div>
              <div style={{ height: 6, borderRadius: 3, background: '#1e293b', display: 'flex', overflow: 'hidden' }}>
                {bikes.count > 0 && <>
                  <div style={{ width: `${((bikes.count - bikes.low - bikes.empty) / bikes.count) * 100}%`, background: '#34d399' }} />
                  <div style={{ width: `${(bikes.low / bikes.count) * 100}%`, background: '#fbbf24' }} />
                  <div style={{ width: `${(bikes.empty / bikes.count) * 100}%`, background: '#f43f5e' }} />
                </>}
              </div>
            </div>
          )}

          {/* OpenAQ real sensors */}
          {city.features.includes('openaq') && (
            <div className="glass-panel" style={{ padding: 14 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
                <h2 style={{ margin: 0, fontSize: 12, fontWeight: 600 }}>CPCB Sensor Network</h2>
                <span style={{ fontSize: 10, color: '#f97316', background: 'rgba(249,115,22,0.1)', border: '1px solid rgba(249,115,22,0.25)', borderRadius: 20, padding: '2px 8px' }}>● OpenAQ</span>
              </div>
              {openaq?.stations?.length > 0 ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  {openaq.stations.slice(0, 4).map((st: any) => {
                    const pm25 = st.parameters?.pm25?.value ?? st.parameters?.pm2_5?.value;
                    const aq = pm25 != null ? aqiLabel(pm25) : null;
                    return (
                      <div key={st.id} style={{ background: 'rgba(30,41,59,0.6)', borderRadius: 8, padding: '8px 10px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <div>
                          <div style={{ fontSize: 11, fontWeight: 600, color: '#e2e8f0' }}>{st.name}</div>
                          <div style={{ fontSize: 9, color: '#64748b' }}>{st.city}</div>
                        </div>
                        {aq && <div style={{ fontSize: 13, fontWeight: 700, color: aq.color }}>{pm25?.toFixed(1)} <span style={{ fontSize: 9, color: '#64748b' }}>µg/m³</span></div>}
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div style={{ fontSize: 11, color: '#475569', textAlign: 'center', padding: '16px 0' }}>Loading CPCB sensor data…</div>
              )}
            </div>
          )}

          {/* Alerts */}
          <div className="glass-panel" style={{ padding: 14 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 10 }}>
              <AlertTriangle size={13} style={{ color: '#f97316' }} />
              <h2 style={{ margin: 0, fontSize: 12, fontWeight: 600 }}>Live Alerts</h2>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>
              {airQuality?.current?.pm2_5 > 35 && (
                <div style={{ background: 'rgba(249,115,22,0.1)', border: '1px solid rgba(249,115,22,0.25)', borderRadius: 8, padding: '8px 10px', fontSize: 11 }}>
                  <div style={{ color: '#f97316', fontWeight: 600, marginBottom: 2 }}>⚠ Air Quality Degraded</div>
                  <div style={{ color: '#94a3b8' }}>PM2.5 at {airQuality.current.pm2_5} µg/m³ — sensitive groups advised.</div>
                </div>
              )}
              {bikes.empty > 20 && (
                <div style={{ background: 'rgba(244,63,94,0.08)', border: '1px solid rgba(244,63,94,0.2)', borderRadius: 8, padding: '8px 10px', fontSize: 11 }}>
                  <div style={{ color: '#f43f5e', fontWeight: 600, marginBottom: 2 }}>🚲 High Bike Demand</div>
                  <div style={{ color: '#94a3b8' }}>{bikes.empty} stations empty across the network.</div>
                </div>
              )}
              {(!airQuality || airQuality?.current?.pm2_5 <= 35) && bikes.empty <= 20 && (
                <div style={{ background: 'rgba(52,211,153,0.07)', border: '1px solid rgba(52,211,153,0.18)', borderRadius: 8, padding: '8px 10px', fontSize: 11 }}>
                  <div style={{ color: '#34d399', fontWeight: 600 }}>✓ All Systems Normal</div>
                  <div style={{ color: '#64748b', marginTop: 2, fontSize: 10 }}>No active alerts for {city.name}</div>
                </div>
              )}
            </div>
          </div>

          {/* Map Legend */}
          <div className="glass-panel" style={{ padding: 14 }}>
            <div style={{ fontSize: 11, fontWeight: 600, color: '#64748b', marginBottom: 10, textTransform: 'uppercase', letterSpacing: '0.06em' }}>Map Legend</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 7, fontSize: 11, color: '#94a3b8' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}><span style={{ width: 10, height: 10, borderRadius: '50%', background: '#93c5fd', display: 'inline-block', boxShadow: '0 0 6px #93c5fd' }} /> Aircraft overhead</div>
              {city.features.includes('city-bikes') && <>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}><span style={{ width: 10, height: 10, borderRadius: '50%', background: '#34d399', display: 'inline-block' }} /> Bike station — available</div>
              </>}
              {city.features.includes('openaq') && <>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}><span style={{ width: 10, height: 10, borderRadius: '50%', background: '#34d399', display: 'inline-block' }} /> CPCB sensor — good AQ</div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}><span style={{ width: 10, height: 10, borderRadius: '50%', background: '#f43f5e', display: 'inline-block' }} /> CPCB sensor — poor AQ</div>
              </>}
            </div>
          </div>
        </aside>
      </div>

      {/* Footer */}
      <footer className="glass-panel pointer-events-auto" style={{ padding: '7px 20px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: 11, color: '#475569' }}>
        <div style={{ display: 'flex', gap: 20, alignItems: 'center' }}>
          <span style={{ color: '#34d399', display: 'flex', alignItems: 'center', gap: 5 }}>
            <span style={{ width: 6, height: 6, background: '#34d399', borderRadius: '50%', display: 'inline-block', animation: 'pulse 2s infinite' }} /> All APIs Connected
          </span>
          <span>{city.flag} {city.name} · {selectedLocation.lat.toFixed(4)}°N {selectedLocation.lon.toFixed(4)}°E</span>
        </div>
        <div style={{ display: 'flex', gap: 20 }}>
          <span>Open-Meteo · PVGIS · OpenSky · {city.features.includes('city-bikes') ? 'CityBik.es' : 'OpenAQ'} · OSM</span>
          {lastUpdated && <span>Synced {lastUpdated.toLocaleTimeString()}</span>}
        </div>
      </footer>

      <style>{`
        @keyframes pulse { 0%,100%{opacity:1}50%{opacity:0.4} }
        @keyframes spin { from{transform:rotate(0deg)}to{transform:rotate(360deg)} }
      `}</style>
    </div>
  );
}
