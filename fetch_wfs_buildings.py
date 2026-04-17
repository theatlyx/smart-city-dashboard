import urllib.request
import urllib.parse
import json

# WFS GetFeature request for Helsinki buildings
# We use SRSNAME=EPSG:4326 to get coordinates in WGS84
# Let's target the Kalasatama area
bbox = "24.97,60.18,24.99,60.19" # min_lon, min_lat, max_lon, max_lat
url = f"https://kartta.hel.fi/3d/citydb-wfs/wfs?SERVICE=WFS&VERSION=2.0.0&REQUEST=GetFeature&TYPENAMES=bldg:Building&BBOX={bbox},urn:ogc:def:crs:EPSG::4326&SRSNAME=urn:ogc:def:crs:EPSG::4326&OUTPUTFORMAT=application/json"

print("Fetching buildings from Helsinki WFS API...")
req = urllib.request.Request(url, headers={'User-Agent': 'Mozilla/5.0'})

try:
    with urllib.request.urlopen(req) as response:
        data = response.read()
        print(f"Received {len(data)} bytes")
        
        # Save to file to inspect
        with open("wfs_output.json", "wb") as f:
            f.write(data)
            
        geojson = json.loads(data.decode('utf-8'))
        features = geojson.get("features", [])
        print(f"Successfully retrieved {len(features)} buildings from WFS API")
        
except urllib.error.HTTPError as e:
    print(f"Failed to fetch WFS data. HTTP {e.code}")
    print(e.read().decode('utf-8'))
except Exception as e:
    print(f"Failed to fetch WFS data: {e}")
