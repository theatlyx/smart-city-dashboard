import json

def get_center(geometry):
    if geometry['type'] == 'Point':
        return geometry['coordinates']
    elif geometry['type'] == 'Polygon':
        coords = geometry['coordinates'][0]
        lon = sum(c[0] for c in coords) / len(coords)
        lat = sum(c[1] for c in coords) / len(coords)
        return [lon, lat]
    elif geometry['type'] == 'LineString':
        coords = geometry['coordinates']
        lon = sum(c[0] for c in coords) / len(coords)
        lat = sum(c[1] for c in coords) / len(coords)
        return [lon, lat]
    return None

with open('Data/export.geojson', 'r') as f:
    data = json.load(f)

metro_stations = []
brts_stations = []

for feature in data['features']:
    props = feature.get('properties', {})
    name = props.get('name')
    if not name:
        continue
    
    # Metro Stations
    if props.get('railway') == 'station' or props.get('operator') == 'Gujarat Metro Rail Corporation Limited':
        center = get_center(feature['geometry'])
        if center:
            metro_stations.append({
                "name": name,
                "position": center,
                "type": "metro",
                "line": "blue" if "Blue" in props.get('color', '') or "Blue" in props.get('route', '') else "red"
            })
            
    # BRTS Stations
    if props.get('operator') == 'Ahmedabad Janmarg Limited' or props.get('network') == 'Ahmedabad BRTS':
        center = get_center(feature['geometry'])
        if center:
            brts_stations.append({
                "name": name,
                "position": center,
                "type": "brts"
            })

# Deduplicate by name
def deduplicate(stations):
    seen = {}
    for s in stations:
        if s['name'] not in seen:
            seen[s['name']] = s
    return list(seen.values())

metro_stations = deduplicate(metro_stations)
brts_stations = deduplicate(brts_stations)

with open('Data/extracted_transit.json', 'w') as f:
    json.dump({"metro": metro_stations, "brts": brts_stations}, f, indent=2)

print(f"Extracted {len(metro_stations)} metro stations and {len(brts_stations)} BRTS stations.")
