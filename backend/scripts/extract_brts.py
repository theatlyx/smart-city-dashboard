import json

# BRTS keywords from user's route description
brts_stations = [
    "Shivranjani", "AEC", "Akhbar nagar", "Ranip", "Wadaj", "Dudheswer", "Delhi Darwaja", 
    "Kalupur", "MEMCO", "Naroda", "Soni ni Chal", "Expressway Junction", "Vatva", "Narol", 
    "Dani Limda", "Dharnidhar", "Nehru nagar", "Rakhiyal", "Gomtipur", "Sarangpur", 
    "Geeta Mandir", "Jamalpur", "Kankaria", "Maninagar", "Shah Alam", "Gujarat University", 
    "CG Road", "Law Garden", "Gandhi Gram", "Ellis Bridge", "Dana Pith", "Astodia", 
    "Jodhpur cross Rd", "ISRO", "ISKCON", "SG Highway", "ISRO Colony", "Bopal", 
    "Bhuyangdev", "Sattadhar", "Sola Flyover", "Science City"
]

def get_centroid(coords):
    if not coords or not coords[0]:
        return None
    # Handle Polygon (nested list) or Point (simple list)
    if isinstance(coords[0][0], list):
        # Polygon
        points = coords[0]
        avg_lon = sum(p[0] for p in points) / len(points)
        avg_lat = sum(p[1] for p in points) / len(points)
        return [avg_lon, avg_lat]
    else:
        # Point
        return coords

def extract_brts():
    input_path = "/Users/rezpa/Desktop/Projects/smart-city-dashboard/Data/export.geojson"
    found_stations = {}
    
    with open(input_path, 'r') as f:
        # We'll read line by line if possible or load the whole thing
        # Since it's 143MB, we can load it in memory once if we have enough RAM
        data = json.load(f)
        
        for feature in data['features']:
            name = feature['properties'].get('name', '')
            if not name:
                continue
            
            # Check if name contains any of our BRTS station keywords
            for keyword in brts_stations:
                if keyword.lower() in name.lower():
                    # Check if it's a transit feature
                    is_transit = False
                    props = feature['properties']
                    if (props.get('amenity') == 'bus_station' or 
                        props.get('public_transport') in ['platform', 'station', 'stop_position'] or
                        'brts' in name.lower() or
                        props.get('operator') == 'Ahmedabad Janmarg Limited'):
                        is_transit = True
                    
                    if is_transit:
                        coords = get_centroid(feature['geometry']['coordinates'])
                        if coords:
                            # Store only the best match (e.g. the one explicitly saying BRTS)
                            if keyword not in found_stations or 'brts' in name.lower():
                                found_stations[keyword] = {
                                    'name': name,
                                    'lat': coords[1],
                                    'lon': coords[0]
                                }
    
    return list(found_stations.values())

if __name__ == "__main__":
    results = extract_brts()
    with open("/Users/rezpa/Desktop/Projects/smart-city-dashboard/Data/extracted_brts_stations.json", "w") as f:
        json.dump(results, f, indent=2)
    print(f"Extracted {len(results)} BRTS stations.")
