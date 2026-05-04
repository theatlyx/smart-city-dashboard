import requests
import json

def fetch_ahmedabad_buildings():
    lat, lon = 23.0225, 72.5714
    radius = 700  # small radius for stability
    
    overpass_url = "https://overpass-api.de/api/interpreter"
    overpass_query = f"""[out:json][timeout:60];(way["building"](around:{radius},{lat},{lon});relation["building"](around:{radius},{lat},{lon}););out body;>;out skel qt;"""
    
    print(f"Fetching buildings for Ahmedabad within {radius}m radius...")
    headers = {
        'User-Agent': 'SmartCityDashboard/1.0 (https://github.com/theatlyx/smart-city-dashboard)'
    }
    response = requests.get(overpass_url, params={'data': overpass_query}, headers=headers)
    
    if response.status_code != 200:
        print(f"Error: {response.status_code}")
        print(response.text)
        return

    try:
        data = response.json()
    except Exception as e:
        print(f"Failed to decode JSON: {e}")
        print("Response text starts with:")
        print(response.text[:500])
        return
    
    # Convert Overpass JSON to GeoJSON
    elements = data.get('elements', [])
    nodes = {e['id']: (e['lon'], e['lat']) for e in elements if e['type'] == 'node'}
    
    features = []
    
    for element in elements:
        if element['type'] == 'way' and 'tags' in element:
            way_nodes = element.get('nodes', [])
            if not way_nodes:
                continue
                
            coordinates = [nodes[node_id] for node_id in way_nodes if node_id in nodes]
            if len(coordinates) < 3:
                continue
                
            # Close the polygon
            if coordinates[0] != coordinates[-1]:
                coordinates.append(coordinates[0])
                
            tags = element.get('tags', {})
            
            # Extract height or levels
            height = tags.get('height')
            if height:
                try:
                    # Clean up height string (e.g., "12 m" -> 12)
                    height = float(''.join(filter(lambda x: x.isdigit() or x == '.', height)))
                except ValueError:
                    height = 12.0
            else:
                levels = tags.get('building:levels')
                if levels:
                    try:
                        height = float(levels) * 3.8
                    except ValueError:
                        height = 12.0
                else:
                    height = 12.0 # Default LOD1 height
            
            features.append({
                "type": "Feature",
                "properties": {
                    "id": element['id'],
                    "name": tags.get('name', 'Building'),
                    "type": tags.get('building', 'yes'),
                    "height": height,
                    "levels": tags.get('building:levels'),
                    "color": [74, 85, 104] # Slate blue
                },
                "geometry": {
                    "type": "Polygon",
                    "coordinates": [coordinates]
                }
            })
            
    geojson = {
        "type": "FeatureCollection",
        "features": features
    }
    
    output_path = "frontend/public/buildings_ahmedabad.json"
    with open(output_path, "w") as f:
        json.dump(geojson, f)
        
    print(f"Successfully saved {len(features)} buildings to {output_path}")

if __name__ == "__main__":
    fetch_ahmedabad_buildings()
