import requests
import json
import os

OVERPASS_URL = "http://overpass-api.de/api/interpreter"

def fetch_landcover(lat, lon, radius=5000):
    query = f"""
    [out:json][timeout:90];
    (
      way(around:{radius},{lat},{lon})["leisure"];
      way(around:{radius},{lat},{lon})["natural"];
      way(around:{radius},{lat},{lon})["landuse"];
    );
    out geom;
    """
    
    import subprocess
    print(f"Fetching landcover data for ({lat}, {lon}) within {radius}m...")
    try:
        result = subprocess.run(
            ['curl', '-s', '-d', f"data={query}", OVERPASS_URL],
            capture_output=True, text=True, check=True
        )
        data = json.loads(result.stdout)
    except Exception as e:
        print(f"Error fetching data with curl: {e}")
        return None
    
    geojson = {
        "type": "FeatureCollection",
        "features": []
    }
    
    for element in data.get('elements', []):
        tags = element.get('tags', {})
        feature_type = "green"
        if tags.get('natural') == 'water' or tags.get('landuse') == 'reservoir':
            feature_type = "water"
        elif tags.get('leisure') == 'park' or tags.get('landuse') == 'grass':
            feature_type = "green"
            
        geom = element.get('geometry')
        if not geom: continue
        
        coords = [[pt['lon'], pt['lat']] for pt in geom]
        if len(coords) < 3: continue
        
        if coords[0] != coords[-1]:
            coords.append(coords[0])
            
        feature = {
            "type": "Feature",
            "properties": {
                "id": element['id'],
                "type": feature_type,
                "name": tags.get('name', 'Unnamed'),
                "landuse": tags.get('landuse', tags.get('leisure', tags.get('natural', 'unknown')))
            },
            "geometry": {
                "type": "Polygon",
                "coordinates": [coords]
            }
        }
        geojson['features'].append(feature)
        
    return geojson

if __name__ == "__main__":
    LAT, LON = 23.0225, 72.5714
    RADIUS = 5000
    
    landcover = fetch_landcover(LAT, LON, RADIUS)
    
    if landcover:
        output_path = "frontend/public/landcover_ahmedabad.json"
        with open(output_path, "w") as f:
            json.dump(landcover, f, indent=2)
        print(f"Successfully saved {len(landcover['features'])} landcover features to {output_path}")
