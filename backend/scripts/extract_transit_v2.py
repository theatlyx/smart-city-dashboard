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

# List of known BRTS station names to help identification if tags are missing
known_brts = [
    "Shivranjani", "Nehrunagar", "Anjali", "Dani Limda", "Narol", "Soni ni Chal", 
    "Naroda", "Kalupur", "Delhi Darwaja", "Vadaj", "Ranip", "AEC", "RTO Circle", 
    "ISKCON", "Bopal", "Science City", "Chandkheda", "Akhbar Nagar", "Dudheshwar",
    "Memco", "Expressway Junction", "Vatva", "Dharnidhar"
]

for feature in data['features']:
    props = feature.get('properties', {})
    name = props.get('name', '')
    if not name:
        continue
    
    center = get_center(feature['geometry'])
    if not center:
        continue

    # Metro Identification
    is_metro = (
        props.get('railway') == 'station' or 
        "Metro" in name or 
        props.get('operator') == 'Gujarat Metro Rail Corporation Limited'
    )
    
    if is_metro:
        line = "blue"
        if "Red" in props.get('color', '') or "Red" in props.get('route', ''): line = "red"
        # Heuristic for red line based on longitude
        if center[0] < 72.58 and center[1] < 23.08: line = "red" 
        
        metro_stations.append({
            "name": name,
            "position": center,
            "type": "metro",
            "line": line
        })
            
    # BRTS Identification
    is_brts = (
        props.get('operator') == 'Ahmedabad Janmarg Limited' or 
        props.get('network') == 'Ahmedabad BRTS' or
        props.get('amenity') == 'bus_station' or
        any(k in name for k in known_brts)
    )
    
    if is_brts and not is_metro:
        brts_stations.append({
            "name": name,
            "position": center,
            "type": "brts"
        })

# Deduplicate
def deduplicate(stations):
    seen = {}
    for s in stations:
        # Normalize name
        n = s['name'].replace(' BRTS', '').strip()
        if n not in seen:
            seen[n] = s
    return list(seen.values())

metro_stations = deduplicate(metro_stations)
brts_stations = deduplicate(brts_stations)

with open('Data/extracted_transit_v2.json', 'w') as f:
    json.dump({"metro": metro_stations, "brts": brts_stations}, f, indent=2)

print(f"Extracted {len(metro_stations)} metro stations and {len(brts_stations)} BRTS stations.")
