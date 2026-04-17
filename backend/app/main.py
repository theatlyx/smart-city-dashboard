import httpx
import asyncio
from fastapi import FastAPI, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware
from cachetools import TTLCache

app = FastAPI(title="Smart City Dashboard API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Cache: key = (endpoint, rounded_lat, rounded_lon) → 90-second TTL
cache = TTLCache(maxsize=200, ttl=90)

REQUEST_TIMEOUT = 12.0
SHORT_FORECAST_HOURS = 12

# ── Defaults ───────────────────────────────────────────────────────────────────
CITY_DEFAULTS = {
    "helsinki": {"lat": 60.1699, "lon": 24.9384, "tz": "Europe/Helsinki"},
    "ahmedabad": {"lat": 23.0225, "lon": 72.5714, "tz": "Asia/Kolkata"},
}


def cache_key(endpoint: str, lat: float, lon: float) -> str:
    return f"{endpoint}|{round(lat, 2)}|{round(lon, 2)}"


async def fetch_json(url: str, detail: str) -> dict:
    try:
        async with httpx.AsyncClient(timeout=REQUEST_TIMEOUT) as client:
            r = await client.get(url)
            r.raise_for_status()
            return r.json()
    except httpx.HTTPStatusError as e:
        raise HTTPException(status_code=e.response.status_code, detail=detail) from e
    except httpx.RequestError as e:
        raise HTTPException(status_code=502, detail=f"{detail}: upstream error") from e


# ── Health ─────────────────────────────────────────────────────────────────────

@app.get("/health")
def health():
    return {"status": "healthy", "service": "smart-city-api"}


@app.get("/")
def root():
    return {"message": "Smart City API — /docs for Swagger"}


# ── Weather ────────────────────────────────────────────────────────────────────

@app.get("/api/weather")
async def get_weather(
    lat: float = Query(default=60.1699, description="Latitude"),
    lon: float = Query(default=24.9384, description="Longitude"),
    tz: str = Query(default="auto", description="Timezone"),
):
    key = cache_key("weather", lat, lon)
    if key in cache:
        return cache[key]

    url = (
        "https://api.open-meteo.com/v1/forecast"
        f"?latitude={lat}&longitude={lon}"
        f"&timezone={tz}"
        "&current=temperature_2m,relative_humidity_2m,apparent_temperature,precipitation,wind_speed_10m,wind_direction_10m"
        "&hourly=temperature_2m,precipitation_probability,wind_speed_10m"
        "&daily=temperature_2m_max,temperature_2m_min,precipitation_sum,precipitation_probability_max,weathercode,sunrise,sunset,wind_speed_10m_max"
        "&forecast_days=7"
    )
    data = await fetch_json(url, "Failed to fetch weather")

    times = data.get("hourly", {}).get("time", [])[:SHORT_FORECAST_HOURS]
    temps = data.get("hourly", {}).get("temperature_2m", [])[:SHORT_FORECAST_HOURS]
    precip = data.get("hourly", {}).get("precipitation_probability", [])[:SHORT_FORECAST_HOURS]
    wind = data.get("hourly", {}).get("wind_speed_10m", [])[:SHORT_FORECAST_HOURS]

    daily_raw = data.get("daily", {})
    daily_times = daily_raw.get("time", [])
    daily = [
        {
            "date": daily_times[i],
            "temp_max": daily_raw.get("temperature_2m_max", [])[i] if i < len(daily_raw.get("temperature_2m_max", [])) else None,
            "temp_min": daily_raw.get("temperature_2m_min", [])[i] if i < len(daily_raw.get("temperature_2m_min", [])) else None,
            "precipitation_sum": daily_raw.get("precipitation_sum", [])[i] if i < len(daily_raw.get("precipitation_sum", [])) else None,
            "precipitation_probability_max": daily_raw.get("precipitation_probability_max", [])[i] if i < len(daily_raw.get("precipitation_probability_max", [])) else None,
            "weathercode": daily_raw.get("weathercode", [])[i] if i < len(daily_raw.get("weathercode", [])) else None,
            "sunrise": daily_raw.get("sunrise", [])[i] if i < len(daily_raw.get("sunrise", [])) else None,
            "sunset": daily_raw.get("sunset", [])[i] if i < len(daily_raw.get("sunset", [])) else None,
            "wind_speed_max": daily_raw.get("wind_speed_10m_max", [])[i] if i < len(daily_raw.get("wind_speed_10m_max", [])) else None,
        }
        for i in range(len(daily_times))
    ]

    result = {
        "location": {"lat": lat, "lon": lon},
        "current": data.get("current", {}),
        "forecast": [
            {
                "time": t,
                "temperature_2m": temps[i] if i < len(temps) else None,
                "precipitation_probability": precip[i] if i < len(precip) else None,
                "wind_speed_10m": wind[i] if i < len(wind) else None,
            }
            for i, t in enumerate(times)
        ],
        "daily": daily,
        "source": "open-meteo",
    }
    cache[key] = result
    return result


# ── Aircraft (OpenSky Network) ────────────────────────────────────────────────

@app.get("/api/aircraft")
async def get_aircraft(
    lamin: float = Query(..., description="Min latitude"),
    lomin: float = Query(..., description="Min longitude"),
    lamax: float = Query(..., description="Max latitude"),
    lomax: float = Query(..., description="Max longitude"),
):
    key = f"aircraft|{round(lamin,1)},{round(lomin,1)}"
    if key in cache:
        return cache[key]

    url = f"https://opensky-network.org/api/states/all?lamin={lamin}&lomin={lomin}&lamax={lamax}&lomax={lomax}"
    data = await fetch_json(url, "Failed to fetch aircraft data")

    aircraft = []
    for s in (data.get("states") or []):
        if s[5] is None or s[6] is None:   # skip if no position
            continue
        aircraft.append({
            "icao24":   s[0],
            "callsign": (s[1] or "").strip() or "Unknown",
            "country":  s[2],
            "longitude": s[5],
            "latitude":  s[6],
            "altitude":  s[7],   # baro altitude metres
            "on_ground": s[8],
            "velocity":  s[9],   # m/s
            "heading":   s[10],  # true track degrees
            "vertical_rate": s[11],
            "geo_altitude":  s[13],
        })

    result = {
        "aircraft": aircraft,
        "count": len(aircraft),
        "timestamp": data.get("time"),
    }
    cache[key] = result
    return result


# ── Solar Potential (PVGIS EU Commission) ──────────────────────────────────────

@app.get("/api/solar")
async def get_solar(
    lat: float = Query(..., description="Latitude"),
    lon: float = Query(..., description="Longitude"),
    peak_power: float = Query(default=1.0, description="Peak power kWp"),
):
    key = f"solar|{round(lat,3)}|{round(lon,3)}"
    if key in cache:
        return cache[key]

    url = (
        "https://re.jrc.ec.europa.eu/api/v5_3/PVcalc"
        f"?lat={lat}&lon={lon}&peakpower={peak_power}&loss=14&outputformat=json"
    )
    data = await fetch_json(url, "Failed to fetch solar data")

    outputs = data.get("outputs", {})
    totals = outputs.get("totals", {}).get("fixed", {})
    monthly = outputs.get("monthly", {}).get("fixed", [])

    # WMO weather code labels
    MONTH_NAMES = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"]

    result = {
        "location": {"lat": lat, "lon": lon},
        "annual_kwh": totals.get("E_y"),
        "daily_avg_kwh": totals.get("E_d"),
        "peak_power_kw": peak_power,
        "monthly": [
            {
                "month": MONTH_NAMES[int(m.get("month", 1)) - 1],
                "kwh": round(m.get("E_m", 0), 1),
                "irradiance": round(m.get("H(i)_d", 0), 2),
            }
            for m in monthly
        ],
        "source": "PVGIS EU Commission",
    }
    cache[key] = result
    return result


@app.get("/api/air-quality")
async def get_air_quality(
    lat: float = Query(default=60.1699, description="Latitude"),
    lon: float = Query(default=24.9384, description="Longitude"),
    tz: str = Query(default="auto", description="Timezone"),
):
    key = cache_key("aq", lat, lon)
    if key in cache:
        return cache[key]

    url = (
        "https://air-quality-api.open-meteo.com/v1/air-quality"
        f"?latitude={lat}&longitude={lon}"
        f"&timezone={tz}"
        "&current=pm10,pm2_5,carbon_monoxide,nitrogen_dioxide,sulphur_dioxide,ozone,european_aqi,us_aqi"
        "&hourly=pm10,pm2_5,european_aqi,us_aqi"
        "&forecast_hours=24"
    )
    data = await fetch_json(url, "Failed to fetch air quality")

    times = data.get("hourly", {}).get("time", [])[:SHORT_FORECAST_HOURS]
    pm25 = data.get("hourly", {}).get("pm2_5", [])[:SHORT_FORECAST_HOURS]
    pm10 = data.get("hourly", {}).get("pm10", [])[:SHORT_FORECAST_HOURS]
    eu_aqi = data.get("hourly", {}).get("european_aqi", [])[:SHORT_FORECAST_HOURS]

    result = {
        "location": {"lat": lat, "lon": lon},
        "current": data.get("current", {}),
        "forecast": [
            {
                "time": t,
                "pm2_5": pm25[i] if i < len(pm25) else None,
                "pm10": pm10[i] if i < len(pm10) else None,
                "european_aqi": eu_aqi[i] if i < len(eu_aqi) else None,
            }
            for i, t in enumerate(times)
        ],
        "source": "open-meteo-air-quality",
    }
    cache[key] = result
    return result


# ── City Bikes (Helsinki) ──────────────────────────────────────────────────────

@app.get("/api/city-bikes")
async def get_city_bikes():
    if "city_bikes" in cache:
        return cache["city_bikes"]

    data = await fetch_json("https://api.citybik.es/v2/networks/citybikes-helsinki", "Failed to fetch city bikes")

    stations = []
    for s in data.get("network", {}).get("stations", []):
        free = s.get("free_bikes") or 0
        empty = s.get("empty_slots") or 0
        total = s.get("extra", {}).get("slots", free + empty)
        stations.append({
            "id": s.get("id"),
            "name": s.get("name"),
            "latitude": s.get("latitude"),
            "longitude": s.get("longitude"),
            "free_bikes": free,
            "empty_slots": empty,
            "total_slots": total,
            "timestamp": s.get("timestamp"),
        })

    result = {
        "network": data.get("network", {}).get("name", "Helsinki City Bikes"),
        "stations": stations,
    }
    cache["city_bikes"] = result
    return result


# ── AQ Stations (multi-point grid scan via Open-Meteo) ─────────────────────────
# OpenAQ v3 requires a paid key. Instead we query Open-Meteo AQ for a 3×3
# grid of points around the city center — gives realistic neighbourhood variation.

CITY_CENTERS: dict[str, tuple[float, float]] = {
    "ahmedabad": (23.0225, 72.5714),
    "mumbai": (19.0760, 72.8777),
    "delhi": (28.6139, 77.2090),
    "bangalore": (12.9716, 77.5946),
    "helsinki": (60.1699, 24.9384),
}

# Named neighbourhoods for Ahmedabad to make the UI informative
AHMEDABAD_POINTS = [
    ("Maninagar",        23.000, 72.601),
    ("Sabarmati",        23.079, 72.567),
    ("Navrangpura",      23.036, 72.557),
    ("Gota",             23.101, 72.527),
    ("Vatva (Industrial)", 22.960, 72.642),
    ("Bopal",            23.035, 72.470),
]

@app.get("/api/openaq")
async def get_openaq(
    city: str = Query(default="Ahmedabad", description="City name"),
):
    key = f"aq_grid|{city.lower()}"
    if key in cache:
        return cache[key]

    city_lower = city.lower()
    if city_lower == "ahmedabad":
        points = AHMEDABAD_POINTS
    elif city_lower in CITY_CENTERS:
        clat, clon = CITY_CENTERS[city_lower]
        # Build a small 3-point grid
        offsets = [(-0.04, -0.04), (0.0, 0.0), (0.04, 0.04)]
        points = [(f"{city} Zone {i+1}", clat+dlat, clon+dlon) for i, (dlat, dlon) in enumerate(offsets)]
    else:
        points = [(city, 23.0225, 72.5714)]

    async def fetch_point(name: str, lat: float, lon: float):
        url = (
            "https://air-quality-api.open-meteo.com/v1/air-quality"
            f"?latitude={lat}&longitude={lon}"
            "&current=pm10,pm2_5,nitrogen_dioxide,sulphur_dioxide,ozone,carbon_monoxide"
        )
        try:
            async with httpx.AsyncClient(timeout=10.0) as client:
                r = await client.get(url)
                if r.is_success:
                    d = r.json().get("current", {})
                    return {
                        "id": f"{lat:.3f},{lon:.3f}",
                        "name": name,
                        "city": city,
                        "latitude": lat,
                        "longitude": lon,
                        "parameters": {
                            "pm2_5": {"value": d.get("pm2_5"), "unit": "µg/m³"},
                            "pm10":  {"value": d.get("pm10"),  "unit": "µg/m³"},
                            "no2":   {"value": d.get("nitrogen_dioxide"), "unit": "µg/m³"},
                            "so2":   {"value": d.get("sulphur_dioxide"),  "unit": "µg/m³"},
                        },
                        "source": "open-meteo-aq",
                    }
        except Exception:
            pass
        return None

    tasks = [fetch_point(name, lat, lon) for name, lat, lon in points]
    results = await asyncio.gather(*tasks)
    stations = [r for r in results if r is not None]

    result = {"city": city, "stations": stations, "source": "open-meteo-aq"}
    cache[key] = result
    return result


# ── Cities metadata ────────────────────────────────────────────────────────────

@app.get("/api/cities")
def get_cities():
    return {
        "cities": [
            {
                "id": "helsinki",
                "name": "Helsinki, Finland",
                "lat": 60.1699,
                "lon": 24.9384,
                "zoom": 13.5,
                "pitch": 55,
                "bearing": -10,
                "buildings": "3d-tiles",
                "tilesUrl": "https://kartta.hel.fi/3d/mesh/Helsinki_2024/tileset.json",
                "features": ["weather", "air-quality", "city-bikes"],
                "timezone": "Europe/Helsinki",
            },
            {
                "id": "ahmedabad",
                "name": "Ahmedabad, India",
                "lat": 23.0225,
                "lon": 72.5714,
                "zoom": 13,
                "pitch": 50,
                "bearing": 10,
                "buildings": "geojson",
                "geojsonUrl": "/buildings_ahmedabad.json",
                "features": ["weather", "air-quality", "openaq"],
                "timezone": "Asia/Kolkata",
            },
        ]
    }
