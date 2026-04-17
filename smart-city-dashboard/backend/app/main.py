import httpx
from fastapi import FastAPI, HTTPException
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

# In-memory cache for 60 seconds
cache = TTLCache(maxsize=100, ttl=60)

HELSINKI_LAT = 60.1699
HELSINKI_LON = 24.9384
REQUEST_TIMEOUT_SECONDS = 12.0
SHORT_FORECAST_HOURS = 12


async def fetch_json(url: str, error_detail: str) -> dict:
    try:
        async with httpx.AsyncClient(timeout=REQUEST_TIMEOUT_SECONDS) as client:
            response = await client.get(url)
            response.raise_for_status()
            return response.json()
    except httpx.HTTPStatusError as exc:
        raise HTTPException(status_code=exc.response.status_code, detail=error_detail) from exc
    except httpx.RequestError as exc:
        raise HTTPException(status_code=502, detail=f"{error_detail}: upstream request failed") from exc

@app.get("/health")
def health_check():
    return {"status": "healthy", "service": "smart-city-api"}

@app.get("/")
def read_root():
    return {"message": "Welcome to Smart City API. Go to /docs for Swagger UI."}

@app.get("/api/weather")
async def get_weather():
    if "weather" in cache:
        return cache["weather"]

    url = (
        "https://api.open-meteo.com/v1/forecast"
        f"?latitude={HELSINKI_LAT}&longitude={HELSINKI_LON}"
        "&timezone=Europe%2FHelsinki"
        "&current=temperature_2m,relative_humidity_2m,precipitation,wind_speed_10m"
        "&hourly=temperature_2m,precipitation_probability"
        "&forecast_hours=24"
    )
    data = await fetch_json(url, "Failed to fetch weather data")

    times = data.get("hourly", {}).get("time", [])[:SHORT_FORECAST_HOURS]
    temperatures = data.get("hourly", {}).get("temperature_2m", [])[:SHORT_FORECAST_HOURS]
    precipitation_probability = data.get("hourly", {}).get("precipitation_probability", [])[:SHORT_FORECAST_HOURS]
    forecast = [
        {
            "time": hour,
            "temperature_2m": temperatures[idx] if idx < len(temperatures) else None,
            "precipitation_probability": precipitation_probability[idx] if idx < len(precipitation_probability) else None,
        }
        for idx, hour in enumerate(times)
    ]

    result = {
        "location": {"lat": HELSINKI_LAT, "lon": HELSINKI_LON, "name": "Helsinki"},
        "units": {
            "temperature_2m": data.get("current_units", {}).get("temperature_2m", "C"),
            "relative_humidity_2m": data.get("current_units", {}).get("relative_humidity_2m", "%"),
            "wind_speed_10m": data.get("current_units", {}).get("wind_speed_10m", "km/h"),
            "precipitation": data.get("current_units", {}).get("precipitation", "mm"),
            "precipitation_probability": data.get("hourly_units", {}).get("precipitation_probability", "%"),
        },
        "current": data.get("current", {}),
        "forecast": forecast,
        "source": "open-meteo",
    }
    cache["weather"] = result
    return result

@app.get("/api/air-quality")
async def get_air_quality():
    if "air_quality" in cache:
        return cache["air_quality"]

    url = (
        "https://air-quality-api.open-meteo.com/v1/air-quality"
        f"?latitude={HELSINKI_LAT}&longitude={HELSINKI_LON}"
        "&timezone=Europe%2FHelsinki"
        "&current=pm10,pm2_5,carbon_monoxide"
        "&hourly=pm10,pm2_5,carbon_monoxide"
        "&forecast_hours=24"
    )
    data = await fetch_json(url, "Failed to fetch air quality data")

    times = data.get("hourly", {}).get("time", [])[:SHORT_FORECAST_HOURS]
    pm25 = data.get("hourly", {}).get("pm2_5", [])[:SHORT_FORECAST_HOURS]
    pm10 = data.get("hourly", {}).get("pm10", [])[:SHORT_FORECAST_HOURS]
    co = data.get("hourly", {}).get("carbon_monoxide", [])[:SHORT_FORECAST_HOURS]
    forecast = [
        {
            "time": hour,
            "pm2_5": pm25[idx] if idx < len(pm25) else None,
            "pm10": pm10[idx] if idx < len(pm10) else None,
            "carbon_monoxide": co[idx] if idx < len(co) else None,
        }
        for idx, hour in enumerate(times)
    ]

    result = {
        "location": {"lat": HELSINKI_LAT, "lon": HELSINKI_LON, "name": "Helsinki"},
        "units": {
            "pm2_5": data.get("current_units", {}).get("pm2_5", "ug/m3"),
            "pm10": data.get("current_units", {}).get("pm10", "ug/m3"),
            "carbon_monoxide": data.get("current_units", {}).get("carbon_monoxide", "ug/m3"),
        },
        "current": data.get("current", {}),
        "forecast": forecast,
        "source": "open-meteo-air-quality",
    }
    cache["air_quality"] = result
    return result

@app.get("/api/city-bikes")
async def get_city_bikes():
    if "city_bikes" in cache:
        return cache["city_bikes"]

    url = "https://api.citybik.es/v2/networks/citybikes-helsinki"
    data = await fetch_json(url, "Failed to fetch city bikes data")

    stations = []
    for s in data.get("network", {}).get("stations", []):
        free_bikes = s.get("free_bikes") or 0
        empty_slots = s.get("empty_slots") or 0
        total_slots = s.get("extra", {}).get("slots", free_bikes + empty_slots)
        stations.append(
            {
                "id": s.get("id"),
                "name": s.get("name"),
                "latitude": s.get("latitude"),
                "longitude": s.get("longitude"),
                "free_bikes": free_bikes,
                "empty_slots": empty_slots,
                "total_slots": total_slots,
                "timestamp": s.get("timestamp"),
            }
        )

    result = {
        "network": data.get("network", {}).get("name", "Helsinki City Bikes"),
        "stations": stations,
        "updated": data.get("network", {}).get("stations", [{}])[0].get("timestamp"),
    }
    cache["city_bikes"] = result
    return result
