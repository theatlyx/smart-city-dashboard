import json
import os
import sys

# Bounding box for Ahmedabad
# lat: 22.8 to 23.2, lon: 72.4 to 72.8
MIN_LAT = 22.8
MAX_LAT = 23.2
MIN_LON = 72.4
MAX_LON = 72.8

def intersects_bbox(feature):
    geom = feature.get('geometry')
    if not geom:
        return False
        
    coords = geom.get('coordinates', [])
    geom_type = geom.get('type', '')
    
    # Flatten all coordinates to find min/max
    def extract_and_swap_points(arr):
        if len(arr) == 2 and isinstance(arr[0], (int, float)):
            # India Lat is 8-37, Lon is 68-97
            # If the first number is < 40, it's Latitude.
            if arr[0] < 40:
                # Source is [lat, lon], we must yield and swap it in the array!
                lat, lon = arr[0], arr[1]
                arr[0], arr[1] = lon, lat # Modify in place for output
                yield lon, lat
            else:
                yield arr[0], arr[1]
        else:
            for item in arr:
                yield from extract_and_swap_points(item)
                
    intersects = False
    for lon, lat in extract_and_swap_points(coords):
        if MIN_LON <= lon <= MAX_LON and MIN_LAT <= lat <= MAX_LAT:
            intersects = True
            
    return intersects

def process_file(input_path, output_path):
    print(f"Loading massive GeoJSON from {input_path} (this might take a moment)...")
    try:
        with open(input_path, 'r', encoding='utf-8') as f:
            data = json.load(f)
    except Exception as e:
        print(f"Error loading {input_path}: {e}")
        sys.exit(1)
        
    features = data.get('features', [])
    print(f"Loaded {len(features)} total features.")
    
    filtered_features = []
    for f in features:
        if intersects_bbox(f):
            filtered_features.append(f)
            
    print(f"Found {len(filtered_features)} features intersecting Ahmedabad bounding box.")
    
    output_data = {
        "type": "FeatureCollection",
        "features": filtered_features
    }
    
    print(f"Saving to {output_path}...")
    with open(output_path, 'w', encoding='utf-8') as f:
        json.dump(output_data, f)
    print("Done!")

if __name__ == "__main__":
    input_file = "/Users/rezpa/.gemini/antigravity/scratch/data/Pincode Boundary.geojson"
    output_file = "/Users/rezpa/.gemini/antigravity/scratch/smart-city-dashboard/frontend/public/ahmedabad_pincodes.json"
    
    if not os.path.exists(input_file):
        print(f"Input file not found: {input_file}")
        sys.exit(1)
        
    process_file(input_file, output_file)
