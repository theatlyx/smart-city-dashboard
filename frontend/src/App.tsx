import { useState } from 'react';
import { CityProvider } from './context/CityContext';
import MapComponent from './components/MapComponent';
import DashboardLayout from './components/DashboardLayout';

function App() {
  const [solarCoords, setSolarCoords] = useState<{ lat: number; lon: number } | null>(null);
  return (
    <CityProvider>
      <div className="relative w-full h-screen overflow-hidden text-slate-200">
        <MapComponent onSolarRequest={(lat, lon) => setSolarCoords({ lat, lon })} />
        <DashboardLayout solarCoords={solarCoords} onCloseSolar={() => setSolarCoords(null)} />
      </div>
    </CityProvider>
  );
}

export default App;
