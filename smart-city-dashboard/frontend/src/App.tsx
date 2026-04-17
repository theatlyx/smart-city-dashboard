import React from 'react';
import MapComponent from './components/MapComponent';
import DashboardLayout from './components/DashboardLayout';

function App() {
  return (
    <div className="relative w-full h-screen overflow-hidden text-slate-200">
      <MapComponent />
      <DashboardLayout />
    </div>
  );
}

export default App;
