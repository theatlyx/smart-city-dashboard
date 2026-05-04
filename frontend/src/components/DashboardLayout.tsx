import { useCallback, useEffect, useMemo, useState } from 'react';
import { Activity, Wind, Droplets, Thermometer, Bike, RefreshCw, ChevronDown, Sun, X, Calendar, CloudRain, ShieldCheck, Zap, Cpu, Navigation, Send, Video } from 'lucide-react';
import { XAxis, YAxis, Tooltip, ResponsiveContainer, AreaChart, Area } from 'recharts';
import { useCityContext, CITIES } from '../context/CityContext';

const API_BASE = import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:8000';

function aqiLabel(pm25: number) {
  if (pm25 <= 12) return { label: 'Good', color: '#34d399', bg: 'rgba(52,211,153,0.12)', glow: 'shadow-[0_0_15px_rgba(52,211,153,0.3)]' };
  if (pm25 <= 35) return { label: 'Moderate', color: '#fbbf24', bg: 'rgba(251,191,36,0.12)', glow: 'shadow-[0_0_15px_rgba(251,191,36,0.3)]' };
  if (pm25 <= 55) return { label: 'Unhealthy (Sensitive)', color: '#f97316', bg: 'rgba(249,115,22,0.12)', glow: 'shadow-[0_0_15px_rgba(249,115,22,0.3)]' };
  if (pm25 <= 150) return { label: 'Unhealthy', color: '#f43f5e', bg: 'rgba(244,63,94,0.12)', glow: 'shadow-[0_0_15px_rgba(244,63,94,0.3)]' };
  return { label: 'Hazardous', color: '#7c3aed', bg: 'rgba(124,58,237,0.12)', glow: 'shadow-[0_0_15px_rgba(124,58,237,0.3)]' };
}

function fmt(timeStr: string) {
  return new Date(timeStr).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false });
}

const tip = { 
  backgroundColor: 'rgba(15, 23, 42, 0.9)', 
  border: '1px solid rgba(255,255,255,0.1)', 
  borderRadius: '12px', 
  fontSize: '11px',
  backdropFilter: 'blur(8px)',
  boxShadow: '0 4px 12px rgba(0,0,0,0.5)'
};

export default function DashboardLayout({ solarCoords, onCloseSolar }: { solarCoords: any, onCloseSolar: () => void }) {
  const { city, setCity, selectedLocation, timeOfDay: _timeOfDay, setTimeOfDay: _setTimeOfDay, activeLayer, setActiveLayer } = useCityContext();
  const [weather, setWeather] = useState<any>(null);
  const [airQuality, setAirQuality] = useState<any>(null);
  const [cityBikes, setCityBikes] = useState<any>(null);
  const [_openaq, setOpenaq] = useState<any>(null);
  const [solarData, setSolarData] = useState<any>(null);
  const [_loading, setLoading] = useState(true);
  const [solarLoading, setSolarLoading] = useState(false);
  const [_lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [activeMode, setActiveMode] = useState<'OVERVIEW' | 'URBAN' | 'SOLAR' | 'AI'>('OVERVIEW');
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
      setActiveMode('SOLAR'); // Auto-switch to solar mode when a request is made
      try {
        const r = await fetch(`${API_BASE}/api/solar?lat=${solarCoords.lat}&lon=${solarCoords.lon}`);
        if (r.ok) setSolarData(await r.json());
      } catch { }
      finally { setSolarLoading(false); }
    };
    fetchSolar();
  }, [solarCoords]);

  const aqChart = useMemo(() => (airQuality?.forecast ?? []).map((p: any) => ({ time: fmt(p.time), pm25: p.pm2_5 })), [airQuality]);

  const bikes = useMemo(() => {
    const s = cityBikes?.stations ?? [];
    return { total: s.reduce((a: number, x: any) => a + (x.free_bikes || 0), 0), empty: s.filter((x: any) => x.free_bikes <= 0).length, low: s.filter((x: any) => x.free_bikes > 0 && x.free_bikes / (x.total_slots || 1) < 0.3).length, count: s.length };
  }, [cityBikes]);

  const aqi = airQuality?.current?.pm2_5 != null ? aqiLabel(airQuality.current.pm2_5) : null;
  const cur = weather?.current ?? {};
  const daily = weather?.daily ?? [];

  return (
    <div className="absolute inset-0 pointer-events-none p-4 flex flex-col gap-3 animate-fade-in">
      {/* Header */}
      <header className="glass-panel pointer-events-auto px-8 py-5 flex items-center justify-between rounded-3xl border-white/10 shadow-2xl backdrop-blur-3xl">
        <div className="flex items-center gap-8">
          <div className="flex items-center gap-4">
            <div className="w-16 h-16 glass-panel rounded-2xl flex items-center justify-center text-4xl shadow-neon-blue/20 border-white/20">
              {city.flag}
            </div>
            <div>
              <div className="flex items-center gap-3 mb-1">
                <h1 className="text-3xl font-black text-white tracking-tighter uppercase leading-none">{city.name}</h1>
                <div className={`px-2.5 py-1 rounded-md text-[10px] font-black tracking-widest border animate-pulse ${city.status === 'NOMINAL' ? 'bg-neon-green/10 border-neon-green/30 text-neon-green' : 'bg-neon-red/10 border-neon-red/30 text-neon-red'}`}>
                  {city.status}
                </div>
              </div>
              <div className="flex items-center gap-2 text-[10px] text-slate-500 font-bold uppercase tracking-widest">
                <Activity size={14} className="text-neon-blue" />
                Live Digital Twin Instance
              </div>
            </div>
          </div>

          <div className="h-12 w-px bg-white/10 hidden md:block" />

          <div className="hidden lg:flex gap-10">
            <div className="flex flex-col">
              <span className="text-[10px] text-slate-500 font-black tracking-widest uppercase mb-1">Total Population</span>
              <span className="text-lg font-black text-white">{city.population || 'N/A'}</span>
            </div>
            <div className="flex flex-col">
              <span className="text-[10px] text-slate-500 font-black tracking-widest uppercase mb-1">Sensor Coverage</span>
              <span className="text-lg font-black text-white">{city.area || 'N/A'}</span>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-6">
          <div className="relative group">
            <button 
              onClick={() => setCityDropdown(d => !d)} 
              className="flex items-center gap-3 bg-slate-800/50 hover:bg-slate-800/80 border border-white/10 rounded-full px-4 py-2 text-white transition-all cursor-pointer text-xs font-bold pointer-events-auto"
            >
              <span className="text-lg leading-none">{city.flag}</span> 
              <span className="tracking-widest uppercase">Node Selection</span>
              <ChevronDown size={14} className={`transition-transform duration-300 ${cityDropdown ? 'rotate-180' : ''}`} />
            </button>
            {cityDropdown && (
              <div className="absolute top-[calc(100%+12px)] right-0 w-64 glass-panel border border-white/10 rounded-3xl overflow-hidden shadow-2xl animate-fade-in z-50 pointer-events-auto">
                {Object.values(CITIES).map(c => (
                  <button
                    key={c.id}
                    onClick={() => { setCity(c.id); setCityDropdown(false); onCloseSolar(); }}
                    className={`w-full p-5 flex items-center gap-4 transition-all hover:bg-white/5 border-b border-white/5 last:border-0 ${city.id === c.id ? 'bg-white/5' : ''}`}
                  >
                    <span className="text-2xl">{c.flag}</span>
                    <div className="text-left">
                      <div className="text-sm font-black text-white uppercase tracking-tight">{c.name}</div>
                      <div className="text-[10px] text-slate-500 font-bold">{c.timezone}</div>
                    </div>
                    {city.id === c.id && <div className="ml-auto w-2 h-2 bg-neon-blue rounded-full pulse-glow" />}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      </header>

      {/* Body */}
      <div className="flex-1 flex gap-4 overflow-hidden">
        {/* Main Side Panel */}
        <aside className="w-[420px] flex flex-col gap-4 pointer-events-auto overflow-y-auto no-scrollbar pb-10 pr-2">
          
          {activeMode === 'OVERVIEW' && (
            <>
              {/* Atmospheric HUD */}
              <section className="glass-panel p-6 rounded-[2.5rem] border-white/10 shadow-xl">
                <div className="flex items-center justify-between mb-6">
                  <div className="flex items-center gap-3">
                    <div className="p-2.5 rounded-xl bg-neon-blue/10 text-neon-blue"><ShieldCheck size={20} /></div>
                    <div>
                      <div className="text-sm font-black text-white tracking-tight uppercase">Atmospheric Status</div>
                      <div className="text-[9px] text-slate-500 font-black uppercase tracking-widest flex items-center gap-2">
                         <span className="w-1.5 h-1.5 bg-neon-green rounded-full animate-pulse" />
                         Satellite Uplink Active
                      </div>
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3 mb-6">
                  {[
                    { icon: <Thermometer size={16} />, label: 'Temperature', value: cur.temperature_2m ?? '--', unit: '°C', color: 'text-neon-red' },
                    { icon: <Droplets size={16} />, label: 'Humidity', value: cur.relative_humidity_2m ?? '--', unit: '%', color: 'text-sky-400' },
                    { icon: <Wind size={16} />, label: 'Wind Velocity', value: cur.wind_speed_10m ?? '--', unit: 'km/h', color: 'text-neon-blue' },
                    { icon: <CloudRain size={16} />, label: 'Precipitation', value: cur.precipitation ?? '--', unit: 'mm', color: 'text-blue-400' },
                  ].map(({ icon, label, value, unit, color }) => (
                    <div key={label} className="bg-white/5 rounded-2xl p-4 border border-white/5 group hover:border-white/10 transition-all">
                      <div className={`mb-2 ${color} opacity-80 group-hover:opacity-100 transition-opacity`}>{icon}</div>
                      <div className="text-[9px] text-slate-500 font-bold uppercase tracking-widest mb-1">{label}</div>
                      <div className="text-xl font-black text-white leading-none">
                        {value}<span className="text-[10px] text-slate-500 font-bold ml-1">{unit}</span>
                      </div>
                    </div>
                  ))}
                </div>

                <div className="space-y-2">
                  <div className="text-[10px] text-slate-500 font-black uppercase tracking-widest mb-3 flex items-center gap-2">
                    <Calendar size={12} /> 7-Day Atmospheric Trend
                  </div>
                  {daily.slice(0, 5).map((d: any, i: number) => (
                    <div key={d.date} className="flex justify-between items-center bg-white/5 px-4 py-3 rounded-xl border border-transparent hover:border-white/5 transition-all">
                      <div className="text-[11px] font-bold w-12 text-slate-300">{i === 0 ? 'Today' : new Date(d.date).toLocaleDateString('en-US', { weekday: 'short' })}</div>
                      <div className="flex items-center gap-1.5 text-[10px] text-slate-500 font-bold w-12">
                        <CloudRain size={12} className={d.precipitation_probability_max > 30 ? 'text-blue-400' : 'text-slate-600'} />
                        {d.precipitation_probability_max}%
                      </div>
                      <div className="flex items-center gap-3 font-bold text-[11px]">
                        <span className="text-slate-500">{Math.round(d.temp_min)}°</span>
                        <span className="text-white w-6 text-right">{Math.round(d.temp_max)}°</span>
                      </div>
                    </div>
                  ))}
                </div>
              </section>

              {/* Air Quality Index */}
              <section className="glass-panel p-6 rounded-[2.5rem] border-white/10 shadow-xl">
                 <div className="flex justify-between items-center mb-6">
                    <h2 className="text-sm font-black uppercase tracking-tight text-white">Air Quality Analytics</h2>
                    <div className="flex items-center gap-1.5 px-3 py-1 bg-neon-orange/10 border border-neon-orange/20 rounded-full">
                      <span className="w-1.5 h-1.5 bg-neon-orange rounded-full pulse-glow" />
                      <span className="text-[9px] font-black text-neon-orange uppercase tracking-widest">Live Sensors</span>
                    </div>
                  </div>
                  
                  {aqi && (
                    <div className={`rounded-2xl p-5 transition-all flex justify-between items-center border border-white/5 ${aqi.glow}`} style={{ backgroundColor: aqi.bg }}>
                      <div>
                        <div className="text-3xl font-black tracking-tighter" style={{ color: aqi.color }}>{aqi.label}</div>
                        <div className="text-[9px] text-slate-500 font-black uppercase mt-1 tracking-widest">Bio-Safety Assessment</div>
                      </div>
                      <div className="text-right space-y-1">
                        <div className="text-[10px] font-black text-slate-400 uppercase tracking-widest">PM2.5 <span className="text-white ml-1">{airQuality?.current?.pm2_5 ?? '--'}</span></div>
                        <div className="text-[10px] font-black text-slate-400 uppercase tracking-widest">PM10 <span className="text-white ml-1">{airQuality?.current?.pm10 ?? '--'}</span></div>
                      </div>
                    </div>
                  )}

                  <div className="h-28 mt-6">
                    <div className="text-[9px] text-slate-500 font-black uppercase tracking-widest mb-3">24-Hour Concentration Curve</div>
                    <ResponsiveContainer width="100%" height="100%" minWidth={0}>
                      <AreaChart data={aqChart}>
                        <defs>
                          <linearGradient id="colorPm" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%" stopColor="#f97316" stopOpacity={0.3}/>
                            <stop offset="95%" stopColor="#f97316" stopOpacity={0}/>
                          </linearGradient>
                        </defs>
                        <XAxis dataKey="time" hide />
                        <YAxis hide domain={['auto', 'auto']} />
                        <Tooltip contentStyle={tip} />
                        <Area type="monotone" dataKey="pm25" stroke="#f97316" strokeWidth={3} fillOpacity={1} fill="url(#colorPm)" name="PM2.5" />
                      </AreaChart>
                    </ResponsiveContainer>
                  </div>
              </section>
            </>
          )}

          {activeMode === 'URBAN' && <UrbanFlowPanel city={city} bikes={bikes} groundwater={city.groundwaterUrl} setActiveLayer={setActiveLayer} activeLayer={activeLayer} />}
          {activeMode === 'SOLAR' && <SolarAnalyticsPanel solarData={solarData} loading={solarLoading} onClose={onCloseSolar} />}
          {activeMode === 'AI' && <AIAnalyticsPanel city={city} />}
          
        </aside>

        {/* Map Spacer */}
        <div className="flex-1 relative overflow-hidden rounded-[3rem] border border-white/5">
          {/* HUD decorative elements */}
          <div className="absolute top-0 left-0 w-32 h-32 border-t-2 border-l-2 border-white/10 pointer-events-none rounded-tl-[3rem] z-10" />
          <div className="absolute top-0 right-0 w-32 h-32 border-t-2 border-r-2 border-white/10 pointer-events-none rounded-tr-[3rem] z-10" />
          <div className="absolute bottom-0 left-0 w-32 h-32 border-b-2 border-l-2 border-white/10 pointer-events-none rounded-bl-[3rem] z-10" />
          <div className="absolute bottom-0 right-0 w-32 h-32 border-b-2 border-r-2 border-white/10 pointer-events-none rounded-br-[3rem] z-10" />
          
          <div className="absolute top-1/2 left-4 -translate-y-1/2 flex flex-col gap-1 z-10 opacity-30 pointer-events-none">
             {[...Array(20)].map((_, i) => <div key={i} className="w-1 h-1 bg-white rounded-full" />)}
          </div>
        </div>

        {/* Command Nav Rail */}
        <nav className="w-20 glass-panel pointer-events-auto rounded-[2.5rem] border-white/10 flex flex-col items-center py-10 gap-8 shadow-[0_0_50px_rgba(0,0,0,0.5)] backdrop-blur-3xl self-start">
          {[
            { id: 'OVERVIEW', icon: <Activity size={24} />, label: 'System', color: 'neon-blue' },
            { id: 'URBAN', icon: <Navigation size={24} />, label: 'Urban', color: 'neon-green' },
            { id: 'SOLAR', icon: <Zap size={24} />, label: 'Energy', color: 'neon-yellow' },
            { id: 'AI', icon: <Cpu size={24} />, label: 'AI Core', color: 'neon-purple' },
          ].map(mode => (
            <button
              key={mode.id}
              onClick={() => setActiveMode(mode.id as any)}
              className={`w-14 h-14 rounded-2xl flex flex-col items-center justify-center gap-1.5 transition-all duration-300 relative group ${
                activeMode === mode.id 
                  ? `bg-${mode.color}/20 text-${mode.color} border border-${mode.color}/30 shadow-[0_0_30px_rgba(0,0,0,0.3)]` 
                  : 'text-slate-600 hover:text-white hover:bg-white/5'
              }`}
            >
              {mode.icon}
              <span className={`text-[8px] font-black uppercase tracking-[0.2em] transition-opacity ${activeMode === mode.id ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'}`}>
                {mode.label}
              </span>
              {activeMode === mode.id && (
                <div className={`absolute -left-1 top-4 w-1 h-6 bg-${mode.color} rounded-r-full shadow-[0_0_15px_rgba(0,0,0,0.5)]`} />
              )}
            </button>
          ))}
          
          <div className="mt-auto flex flex-col items-center gap-6">
             <div className="w-8 h-[1px] bg-white/10" />
             <button className="text-slate-600 hover:text-white transition-colors">
                <ShieldCheck size={20} />
             </button>
          </div>
        </nav>
      </div>
    </div>
  );
}

// ── Operation Mode Panels ──────────────────────────────────────────────────────

function UrbanFlowPanel({ city: _city, bikes, groundwater, setActiveLayer, activeLayer }: { city: any, bikes: any, groundwater: any, setActiveLayer: (l: any) => void, activeLayer: string }) {
  return (
    <div className="space-y-4 animate-in slide-in-from-left duration-300">
      <section className="glass-panel p-6 rounded-[2.5rem] border-white/10 shadow-xl">
        <h2 className="text-sm font-black uppercase tracking-tight text-white mb-6">Urban Topology Control</h2>
        <div className="space-y-3">
          {[
            { id: 'buildings', label: 'LOD1 Reality Mesh', icon: <Activity size={16} />, color: 'neon-blue' },
            { id: 'demographics', label: 'Zoning & Demographics', icon: <ShieldCheck size={16} />, color: 'neon-purple' },
            { id: 'landcover', label: 'Bio-Topology (Parks/Water)', icon: <Sun size={16} />, color: 'neon-green' },
            { id: 'metro', label: 'Metro Rail Network', icon: <Zap size={16} />, color: 'neon-red' },
            { id: 'brts', label: 'BRTS Transit Loop', icon: <Video size={16} />, color: 'neon-green' },
            { id: 'bus', label: 'Bus Network (AMTS/GSRTC)', icon: <Activity size={16} />, color: 'neon-yellow' },
            { id: 'groundwater', label: 'Hydro-Geological Mapping', icon: <Droplets size={16} />, color: 'neon-blue' },
          ].filter(l => l.id !== 'groundwater' || groundwater).map(layer => (
            <button 
              key={layer.id}
              onClick={() => setActiveLayer(layer.id)}
              className={`w-full flex items-center justify-between p-4 rounded-2xl border transition-all ${
                activeLayer === layer.id 
                  ? `bg-${layer.color}/10 border-${layer.color}/30 text-${layer.color}` 
                  : 'bg-white/5 border-white/5 text-slate-500 hover:border-white/10 hover:text-slate-300'
              }`}
            >
              <div className="flex items-center gap-3">
                {layer.icon}
                <span className="text-[11px] font-black uppercase tracking-widest">{layer.label}</span>
              </div>
              <div className={`w-2 h-2 rounded-full ${activeLayer === layer.id ? `bg-${layer.color} animate-pulse` : 'bg-slate-800'}`} />
            </button>
          ))}
        </div>
      </section>

      <section className="glass-panel p-6 rounded-[2.5rem] border-white/10 shadow-xl">
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-sm font-black uppercase tracking-tight text-white">Transit Logistics</h2>
          <div className="text-[9px] font-black text-neon-green uppercase tracking-widest flex items-center gap-2">
            <span className="w-1.5 h-1.5 bg-neon-green rounded-full animate-pulse" />
            Active Fleet
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
           <div className="bg-white/5 rounded-2xl p-5 border border-white/5">
              <div className="flex items-center gap-2 text-slate-500 mb-3 text-[9px] font-black uppercase tracking-widest">
                 <Bike size={14} className="text-neon-green" /> Smart Bikes
              </div>
              <div className="text-3xl font-black text-white leading-none mb-1">{bikes.total}</div>
              <div className="text-[9px] text-slate-500 font-bold uppercase">Free Units Available</div>
           </div>
           <div className="bg-white/5 rounded-2xl p-5 border border-white/5">
              <div className="flex items-center gap-2 text-slate-500 mb-3 text-[9px] font-black uppercase tracking-widest">
                 <Navigation size={14} className="text-neon-blue" /> BRTS / Metro
              </div>
              <div className="text-3xl font-black text-white leading-none mb-1">04</div>
              <div className="text-[9px] text-slate-500 font-bold uppercase">Transit Corridors</div>
           </div>
        </div>
      </section>
    </div>
  );
}

function SolarAnalyticsPanel({ solarData, loading, onClose }: any) {
  return (
    <section className="glass-panel p-6 rounded-[2.5rem] border-neon-yellow/30 shadow-2xl animate-in slide-in-from-left duration-500">
      <div className="flex justify-between items-start mb-8">
        <div className="flex items-center gap-4">
          <div className="p-3 rounded-2xl bg-neon-yellow/10 text-neon-yellow"><Zap size={24} /></div>
          <div>
            <h2 className="text-lg font-black text-white tracking-tight uppercase leading-none mb-1">Solar Potential</h2>
            <p className="text-[10px] text-slate-500 font-black uppercase tracking-widest">Photovoltaic Yield Simulation</p>
          </div>
        </div>
        <button onClick={onClose} className="p-2 hover:bg-white/5 rounded-xl transition-colors text-slate-500 hover:text-white"><X size={20} /></button>
      </div>

      {loading ? (
        <div className="h-64 flex flex-col items-center justify-center gap-4">
          <RefreshCw size={32} className="text-neon-yellow animate-spin" />
          <div className="text-[10px] text-slate-500 font-black uppercase tracking-[0.3em] animate-pulse">Running Physics Model...</div>
        </div>
      ) : solarData ? (
        <div className="space-y-6">
          <div className="grid grid-cols-2 gap-4">
            <div className="bg-white/5 rounded-2xl p-5 border border-white/5">
              <div className="text-[9px] text-slate-500 font-black uppercase tracking-widest mb-3">Optimal Panel Tilt</div>
              <div className="text-3xl font-black text-white leading-none mb-1">{solarData.slope?.toFixed(1)}°</div>
              <div className="text-[10px] text-neon-yellow font-bold uppercase tracking-tight">Geo-Azi: {solarData.azimuth?.toFixed(1)}°</div>
            </div>
            <div className="bg-white/5 rounded-2xl p-5 border border-white/5">
              <div className="text-[9px] text-slate-500 font-black uppercase tracking-widest mb-3">Annual Yield</div>
              <div className="text-3xl font-black text-white leading-none mb-1">{(solarData.annual_energy / 1000).toFixed(1)}</div>
              <div className="text-[10px] text-slate-500 font-bold uppercase tracking-tight">MWh / kWp</div>
            </div>
          </div>

          <div className="h-40 bg-white/5 rounded-2xl p-5 border border-white/5">
             <div className="text-[9px] text-slate-500 font-black uppercase tracking-widest mb-4">Monthly Production Profile</div>
             <ResponsiveContainer width="100%" height="100%" minWidth={0}>
                <AreaChart data={solarData.monthly_energy?.map((v: number, i: number) => ({ m: i+1, v }))}>
                   <Area type="monotone" dataKey="v" stroke="#facc15" strokeWidth={3} fill="#facc15" fillOpacity={0.1} />
                   <XAxis dataKey="m" hide />
                   <YAxis hide />
                   <Tooltip contentStyle={tip} />
                </AreaChart>
             </ResponsiveContainer>
          </div>

          <div className="p-4 bg-neon-green/5 border border-neon-green/20 rounded-2xl flex items-center gap-4">
             <div className="w-12 h-12 rounded-xl bg-neon-green/10 flex items-center justify-center text-neon-green">
                <Sun size={24} />
             </div>
             <div>
                <div className="text-xs font-black text-white uppercase">Carbon Offset Potential</div>
                <div className="text-[10px] text-neon-green font-bold uppercase">Estimated {(solarData.annual_energy * 0.4 / 1000).toFixed(1)} Tons CO2 eq / Year</div>
             </div>
          </div>
        </div>
      ) : (
        <div className="p-10 text-center text-slate-600 text-xs font-bold uppercase tracking-widest border-2 border-dashed border-white/5 rounded-3xl">
          Select a structural entity to initiate analysis
        </div>
      )}
    </section>
  );
}

function AIAnalyticsPanel({ city }: any) {
  const [msg, setMsg] = useState('');
  return (
    <section className="glass-panel p-6 rounded-[2.5rem] border-neon-purple/30 shadow-2xl h-[calc(100vh-180px)] flex flex-col animate-in slide-in-from-left duration-500">
      <div className="flex items-center gap-4 mb-8">
        <div className="p-3 rounded-2xl bg-neon-purple/10 text-neon-purple"><Cpu size={24} /></div>
        <div>
          <h2 className="text-lg font-black text-white tracking-tight uppercase leading-none mb-1">AI Urban Consultant</h2>
          <p className="text-[10px] text-slate-500 font-black uppercase tracking-widest">Neural Analysis Core v4.0</p>
        </div>
      </div>

      <div className="flex-1 space-y-6 overflow-y-auto no-scrollbar mb-6">
         <div className="flex gap-4">
            <div className="w-8 h-8 rounded-lg bg-neon-purple/20 flex items-center justify-center text-neon-purple shrink-0">
               <Cpu size={16} />
            </div>
            <div className="bg-white/5 border border-white/10 p-4 rounded-2xl rounded-tl-none max-w-[85%]">
               <p className="text-xs text-slate-300 leading-relaxed font-bold">
                  System Initialized. I have access to {city.name}'s real-time environmental sensors, groundwater historical data, and building mesh. 
                  How can I assist with your urban planning simulation?
               </p>
            </div>
         </div>
      </div>

      <div className="relative">
         <input 
            type="text" 
            placeholder="Query the Digital Twin..."
            className="w-full bg-white/5 border border-white/10 rounded-2xl py-4 pl-5 pr-14 text-xs font-bold text-white placeholder:text-slate-600 focus:outline-none focus:border-neon-purple/50 transition-all pointer-events-auto"
            value={msg}
            onChange={(e) => setMsg(e.target.value)}
         />
         <button className="absolute right-3 top-2 w-10 h-10 bg-neon-purple/20 text-neon-purple rounded-xl flex items-center justify-center hover:bg-neon-purple/30 transition-all pointer-events-auto">
            <Send size={18} />
         </button>
      </div>
    </section>
  );
}
