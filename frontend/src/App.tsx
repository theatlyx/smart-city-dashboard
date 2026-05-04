import { useState } from 'react';
import { CityProvider } from './context/CityContext';
import MapComponent from './components/MapComponent';
import DashboardLayout from './components/DashboardLayout';

function App() {
  const [solarCoords, setSolarCoords] = useState<{ lat: number; lon: number } | null>(null);
  const [isBooting, setIsBooting] = useState(true);

  // Simulate a futuristic boot sequence
  useState(() => {
    const timer = setTimeout(() => setIsBooting(false), 2000);
    return () => clearTimeout(timer);
  });

  return (
    <CityProvider>
      <div className="relative w-full h-screen overflow-hidden text-slate-200 bg-slate-950 font-sans selection:bg-neon-blue/30 selection:text-white">
        {isBooting && (
          <div className="absolute inset-0 z-[1000] bg-slate-950 flex flex-col items-center justify-center animate-fade-in">
            <div className="relative w-64 h-64 flex items-center justify-center">
              <div className="absolute inset-0 border-2 border-neon-blue/20 rounded-full animate-ping" />
              <div className="absolute inset-4 border border-neon-blue/40 rounded-full animate-spin-slow" />
              <div className="absolute inset-8 border-t-2 border-neon-blue rounded-full animate-spin" />
              <div className="text-neon-blue animate-pulse flex flex-col items-center gap-2">
                <span className="text-4xl font-black tracking-tighter">DT-OS</span>
                <span className="text-[10px] font-black tracking-[0.4em] uppercase">Booting Kernel</span>
              </div>
            </div>
            <div className="mt-12 w-48 h-1 bg-slate-900 rounded-full overflow-hidden border border-white/5">
              <div className="h-full bg-neon-blue animate-shimmer w-full" />
            </div>
          </div>
        )}
        
        <MapComponent onSolarRequest={(lat, lon) => setSolarCoords({ lat, lon })} />
        <DashboardLayout solarCoords={solarCoords} onCloseSolar={() => setSolarCoords(null)} />
        
        {/* HUD Overlay Vignette */}
        <div className="absolute inset-0 pointer-events-none shadow-[inset_0_0_150px_rgba(0,0,0,0.5)] z-[1]" />
      </div>
    </CityProvider>
  );
}

export default App;
