import json
import requests
import time
import os
import sys
from tqdm import tqdm

# Configuration
API_KEY = "69f8f4c758104696334701tzqc0c339"
GEOJSON_PATH = "frontend/public/buildings_lod1.json"
OUTPUT_PATH = "frontend/public/buildings_lod1_enriched.json"
CHUNK_SIZE = 50  # API allows multiple IDs per request
SAVE_INTERVAL = 1000 # Save progress every N buildings

def format_osm_id(osm_id):
    """Converts OSM IDs from GeoJSON format (relation/123) to API format (R123)."""
    if not osm_id: return None
    osm_id = str(osm_id)
    if '/' in osm_id:
        type_prefix, numeric_id = osm_id.split('/')
        return f"{type_prefix[0].upper()}{numeric_id}"
    return osm_id

def enrich():
    print("🏙️ Starting GeoJSON Name Enrichment Script")
    
    # Load data
    source_path = OUTPUT_PATH if os.path.exists(OUTPUT_PATH) else GEOJSON_PATH
    if not os.path.exists(source_path):
        print(f"❌ Error: {source_path} not found.")
        return

    print(f"📂 Loading data from {source_path}...")
    with open(source_path, 'r') as f:
        data = json.load(f)

    features = data.get('features', [])
    print(f"📊 Total buildings in dataset: {len(features)}")

    # Identify buildings that need enrichment (no name, has ID)
    to_enrich = []
    for i, feat in enumerate(features):
        props = feat.get('properties', {})
        # Only enrich if name is missing and we have an ID to look up
        if not props.get('name') and (props.get('@id') or props.get('osm_id')):
            to_enrich.append(i)

    # Apply limit if provided
    limit = None
    for arg in sys.argv:
        if arg.startswith('--limit='):
            limit = int(arg.split('=')[1])
    
    if limit:
        print(f"⚠️ Limit applied: Only processing first {limit} buildings.")
        to_enrich = to_enrich[:limit]

    if not to_enrich:
        print("✅ No buildings found that require name enrichment.")
        return

    print(f"🎯 Found {len(to_enrich)} buildings targeting for enrichment.")
    print(f"⏱️ Estimated time: ~{len(to_enrich) // CHUNK_SIZE + 1} seconds (using batch lookup)")

    # Process in chunks
    try:
        for i in tqdm(range(0, len(to_enrich), CHUNK_SIZE), desc="Enriching Buildings"):
            chunk_indices = to_enrich[i:i + CHUNK_SIZE]
            chunk_ids = []
            index_map = {} # Map formatted_id -> original_index for updating
            
            for idx in chunk_indices:
                feat = features[idx]
                osm_id = feat['properties'].get('@id') or feat['properties'].get('osm_id')
                formatted = format_osm_id(osm_id)
                if formatted:
                    chunk_ids.append(formatted)
                    index_map[formatted] = idx

            if not chunk_ids: continue

            ids_param = ",".join(chunk_ids)
            url = f"https://geocode.maps.co/lookup?osm_ids={ids_param}&api_key={API_KEY}"
            
            try:
                resp = requests.get(url, timeout=10)
                if resp.status_code == 200:
                    results = resp.json()
                    # API returns list of objects
                    for res in results:
                        # Construct ID to match our map (e.g., R + 12345)
                        res_id = f"{res.get('osm_type')}{res.get('osm_id')}"
                        if res_id in index_map:
                            idx = index_map[res_id]
                            # Extract meaningful name
                            name = res.get('localname') or res.get('display_name', '').split(',')[0]
                            if name and not name.isdigit(): # Basic filter for numeric "names"
                                features[idx]['properties']['name'] = name
                                # Optional: Add full address for completeness
                                features[idx]['properties']['addr:full'] = res.get('display_name')
                
                elif resp.status_code == 429:
                    tqdm.write("\n⚠️ Rate limited. Cooling down for 10 seconds...")
                    time.sleep(10)
                else:
                    tqdm.write(f"\n❌ API Error: {resp.status_code}")

            except Exception as e:
                tqdm.write(f"\n❌ Request failed: {e}")

            # Rate limit compliance (5 req/sec burst, but 1 req/sec sustained)
            # We use 1.2s to stay well within safety limits for 100k records
            time.sleep(1.2)

            # Periodically save progress
            if i > 0 and i % SAVE_INTERVAL < CHUNK_SIZE:
                with open(OUTPUT_PATH, 'w') as f:
                    json.dump(data, f)

    except KeyboardInterrupt:
        print("\n🛑 Script interrupted by user. Saving current progress...")
    finally:
        # Final save
        print(f"💾 Saving final dataset to {OUTPUT_PATH}...")
        with open(OUTPUT_PATH, 'w') as f:
            json.dump(data, f)
        print("✨ Task complete.")

if __name__ == "__main__":
    enrich()
