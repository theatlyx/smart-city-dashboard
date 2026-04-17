import json
import math
from shapely.geometry import shape, Point

def calculate_distance(lat1, lon1, lat2, lon2):
    # Quick equirectangular approximation is fine for small distances
    # Convert to radians
    lat1, lon1, lat2, lon2 = map(math.radians, [lat1, lon1, lat2, lon2])
    
    R = 6371 # Earth radius in km
    x = (lon2 - lon1) * math.cos(0.5 * (lat2 + lat1))
    y = lat2 - lat1
    return R * math.sqrt(x*x + y*y)

def join_data(pincode_path, groundwater_path, output_path):
    print("Loading datasets...")
    with open(pincode_path, 'r') as f:
        pincodes = json.load(f)
        
    with open(groundwater_path, 'r') as f:
        gw_data = json.load(f)
        
    print(f"Loaded {len(pincodes['features'])} pincode boundaries and {len(gw_data)} groundwater sensors.")
    
    # Assign each pincode the data from its nearest groundwater sensor
    for feature in pincodes['features']:
        polygon = shape(feature['geometry'])
        centroid = polygon.centroid
        p_lat, p_lon = centroid.y, centroid.x
        
        nearest_sensor = None
        min_dist = float('inf')
        
        for sensor in gw_data:
            s_lat, s_lon = sensor['lat'], sensor['lon']
            dist = calculate_distance(p_lat, p_lon, s_lat, s_lon)
            if dist < min_dist:
                min_dist = dist
                nearest_sensor = sensor
                
        # Inject groundwater properties into the pincode feature
        if nearest_sensor:
            feature['properties']['gw_sensor_name'] = nearest_sensor['name']
            feature['properties']['gw_latest_depth'] = nearest_sensor['latest_depth']
            feature['properties']['gw_change'] = nearest_sensor['change']
            feature['properties']['gw_history'] = nearest_sensor['history']
            feature['properties']['gw_distance_km'] = round(min_dist, 2)
            
    with open(output_path, 'w') as f:
        json.dump(pincodes, f)
        
    print(f"Saved merged GeoJSON to {output_path}")

if __name__ == "__main__":
    pincode_file = "/Users/rezpa/.gemini/antigravity/scratch/smart-city-dashboard/frontend/public/ahmedabad_pincodes.json"
    gw_file = "/Users/rezpa/.gemini/antigravity/scratch/smart-city-dashboard/frontend/public/ahmedabad_groundwater.json"
    out_file = "/Users/rezpa/.gemini/antigravity/scratch/smart-city-dashboard/frontend/public/ahmedabad_groundwater_zones.json"
    join_data(pincode_file, gw_file, out_file)
