# 🏙️ Smart City Digital Twin Dashboard

A high-performance, open-source 3D Smart City Dashboard capable of visualizing multi-city data with photorealistic reality meshes, extruded satellite footprints, and real-time geospatial intelligence.

Currently configured with digital twins for **Helsinki, Finland** and **Ahmedabad, India**.

![Dashboard Preview](https://kartta.hel.fi/3d/assets/img/helsinki3d.jpg) *(Replace with actual screenshot)*

## ✨ Key Features

- **Multi-City Architecture**: Seamlessly switch between cities with entirely different data profiles, API features, and 3D rendering modes.
- **Photorealistic 3D Rendering**: 
  - **Helsinki**: Streams the official 2024 Helsinki 3D reality mesh via 3D Tiles.
  - **Ahmedabad**: Renders >80,000 extruded building footprints dynamically from OpenStreetMap.
- **Hyper-Local Climate Data**: Click anywhere on the map to fetch precise, location-aware weather and air quality for that exact latitude and longitude via Open-Meteo.
- **Live Aviation Tracking**: Real-time aircraft positions, altitudes, and headings via the OpenSky Network.
- **Solar Potential Estimation**: Interactive rooftop solar generation estimates (kWh/yr) using satellite irradiance data from PVGIS (EU Commission).
- **Public Infrastructure Monitoring**:
  - Live city bike station capacities (Helsinki).
  - Live CPCB Air Quality sensor network monitoring (Ahmedabad).
- **Automated Alerts**: Adapts to the selected city to automatically warn about low bike stocks, poor air quality, and other actionable events.
- **Dark Mode UI**: A highly polished, responsive, and reactive dashboard built with React and Tailwind CSS.

## 🛠️ Tech Stack

**Frontend:**
- React 18 + Vite
- [Deck.gl](https://deck.gl/) (GeoJsonLayer, Tile3DLayer, ScatterplotLayer)
- MapLibre GL JS
- Recharts (Time-series data visualization)
- Tailwind CSS & Lucide Icons

**Backend:**
- FastAPI (Python 3)
- Uvicorn
- Cachetools (90s TTL memory caching to prevent API rate limits)

**Data Sources (100% Free & Open):**
- [Open-Meteo](https://open-meteo.com/) (Weather & AQ)
- [OpenAQ](https://openaq.org/) (Real-world AQ sensors)
- [OpenSky Network](https://opensky-network.org/) (Aviation)
- [PVGIS](https://joint-research-centre.ec.europa.eu/photovoltaic-geographical-information-system-pvgis_en) (Solar Potential)
- [CityBik.es](http://api.citybik.es/v2/) (Mobility)
- [OpenStreetMap](https://www.openstreetmap.org/) (Building footprints via Overpass)

## 🚀 Quick Start

### 1. Start the Backend (FastAPI)
The backend acts as a caching proxy for the various external APIs to ensure you don't hit rate limits.

```bash
cd backend
python -m venv venv
source venv/bin/activate  # On Windows use `venv\Scripts\activate`
pip install fastapi uvicorn requests cachetools
uvicorn app.main:app --reload --port 8000
```

### 2. Start the Frontend (React + Vite)
```bash
cd frontend
npm install
npm run dev
```

Open `http://localhost:5173` in your browser.

## 🌍 Adding a New City

The architecture is highly modular. To add a new city:
1. Open `frontend/src/context/CityContext.tsx`.
2. Add a new entry to the `CITIES` object with coordinates, zoom level, building rendering mode (`3d-tiles` or `geojson`), and supported `features` (e.g., `['weather', 'openaq']`).
3. If using OSM footprints (`geojson`), run the automated pipeline script:
   ```bash
   python backend/scripts/fetch_ahmedabad_buildings.py
   ```
   (Modify the bounding box for your target city).

## 📄 License
MIT License
