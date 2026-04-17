import json
import random

center_lon = 24.9384
center_lat = 60.1699

features = []
# Create a 20x20 grid of buildings
for i in range(-10, 10):
    for j in range(-10, 10):
        if random.random() < 0.3:
            continue # skip some to make it look like a real city
            
        lon = center_lon + i * 0.002 + random.uniform(-0.0005, 0.0005)
        lat = center_lat + j * 0.001 + random.uniform(-0.0002, 0.0002)
        
        # 4 corners
        w = 0.0006
        h = 0.0003
        
        coords = [
            [lon - w, lat - h],
            [lon + w, lat - h],
            [lon + w, lat + h],
            [lon - w, lat + h],
            [lon - w, lat - h]
        ]
        
        height = random.randint(15, 60)
        # Add a few skyscrapers
        if random.random() < 0.05:
            height = random.randint(80, 150)
            
        features.append({
            "type": "Feature",
            "properties": {
                "height": height
            },
            "geometry": {
                "type": "Polygon",
                "coordinates": [coords]
            }
        })

geojson = {
    "type": "FeatureCollection",
    "features": features
}

output_path = "/Users/rezpa/.gemini/antigravity/scratch/smart-city-dashboard/frontend/public/buildings.json"
with open(output_path, "w") as f:
    json.dump(geojson, f)

print(f"Generated {len(features)} buildings")
