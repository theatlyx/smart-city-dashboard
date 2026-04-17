import urllib.request
import urllib.parse
import json

# Fetching buildings via Overpass using french instance
bbox = "60.165,24.935,60.170,24.945"
overpass_url = "https://overpass.openstreetmap.fr/api/interpreter"

overpass_query = f"""
[out:json][timeout:25];
(
  way["building"]({bbox});
  relation["building"]({bbox});
);
out body;
>;
out skel qt;
"""

print("Fetching real buildings from French Overpass API...")
data = urllib.parse.urlencode({'data': overpass_query}).encode('utf-8')
headers = {'User-Agent': 'SmartCityDashboard/1.0'}
req = urllib.request.Request(overpass_url, data=data, headers=headers)

try:
    with urllib.request.urlopen(req) as response:
        data = json.loads(response.read().decode('utf-8'))
        
    elements = data['elements']
    nodes = {el['id']: (el['lon'], el['lat']) for el in elements if el['type'] == 'node'}

    features = []
    for el in elements:
        if el['type'] == 'way' and 'tags' in el and 'building' in el['tags']:
            coords = [nodes[node_id] for node_id in el['nodes'] if node_id in nodes]
            if len(coords) < 3:
                continue
            if coords[0] != coords[-1]:
                coords.append(coords[0])
            
            height = 15 # default
            if 'height' in el['tags']:
                try:
                    h_str = el['tags']['height'].replace('m', '').replace(',', '.')
                    height = float(h_str)
                except:
                    pass
            elif 'building:levels' in el['tags']:
                try:
                    height = float(el['tags']['building:levels']) * 3.5
                except:
                    pass
                    
            feature = {
                "type": "Feature",
                "properties": {
                    "height": height,
                    "name": el['tags'].get('name', 'Building')
                },
                "geometry": {
                    "type": "Polygon",
                    "coordinates": [coords]
                }
            }
            features.append(feature)

    geojson = {
        "type": "FeatureCollection",
        "features": features
    }

    output_path = "/Users/rezpa/.gemini/antigravity/scratch/smart-city-dashboard/frontend/public/buildings.json"
    with open(output_path, "w") as f:
        json.dump(geojson, f)

    print(f"Successfully saved {len(features)} real buildings to {output_path}")

except Exception as e:
    print(f"Failed to fetch buildings: {e}")
