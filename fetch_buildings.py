import urllib.request
import urllib.parse
import json

# Helsinki center bounding box: min_lon, min_lat, max_lon, max_lat
bbox = "60.16,24.92,60.18,24.95"
overpass_url = "http://overpass-api.de/api/interpreter"

# Query to get buildings in the bounding box, output as JSON
overpass_query = f"""
[out:json];
(
  way["building"]({bbox});
  relation["building"]({bbox});
);
out body;
>;
out skel qt;
"""

print("Fetching buildings from Overpass API...")
data = urllib.parse.urlencode({'data': overpass_query}).encode('utf-8')
req = urllib.request.Request(overpass_url, data=data)
with urllib.request.urlopen(req) as response:
    data = json.loads(response.read().decode('utf-8'))

# Convert Overpass JSON to GeoJSON
import sys

elements = data['elements']
nodes = {el['id']: (el['lon'], el['lat']) for el in elements if el['type'] == 'node'}

features = []
for el in elements:
    if el['type'] == 'way' and 'tags' in el and 'building' in el['tags']:
        coords = [nodes[node_id] for node_id in el['nodes'] if node_id in nodes]
        if len(coords) < 3:
            continue
        # Close the polygon
        if coords[0] != coords[-1]:
            coords.append(coords[0])
        
        # Estimate height
        height = 15 # default
        if 'height' in el['tags']:
            try:
                height = float(el['tags']['height'].replace('m', ''))
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
                "name": el['tags'].get('name', 'Unknown')
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

print(f"Saved {len(features)} buildings to {output_path}")
