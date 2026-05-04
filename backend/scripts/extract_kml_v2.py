import xml.etree.ElementTree as ET
import json
import os

def get_centroid(coords_text):
    points = []
    for pair in coords_text.strip().split():
        parts = pair.split(',')
        if len(parts) >= 2:
            points.append((float(parts[0]), float(parts[1])))
    if not points:
        return None
    avg_lon = sum(p[0] for p in points) / len(points)
    avg_lat = sum(p[1] for p in points) / len(points)
    return avg_lat, avg_lon

def extract_kml_transit(file_path):
    # Namespaces are tricky in KML. We'll use a wild card for tags.
    context = ET.iterparse(file_path, events=('end',))
    stations = []
    
    for event, elem in context:
        tag = elem.tag.split('}')[-1]
        if tag == 'Placemark':
            name = ""
            name_elem = elem.find('.//{http://www.opengis.net/kml/2.2}name')
            if name_elem is not None:
                name = name_elem.text or ""
            
            extended = elem.find('.//{http://www.opengis.net/kml/2.2}ExtendedData')
            metadata = {}
            if extended is not None:
                for data in extended.findall('.//{http://www.opengis.net/kml/2.2}Data'):
                    val_elem = data.find('.//{http://www.opengis.net/kml/2.2}value')
                    if val_elem is not None:
                        metadata[data.get('name')] = val_elem.text
            
            # Search criteria
            metadata_str = " ".join(str(v) for v in metadata.values()).lower()
            name_lower = name.lower()
            
            is_transit = False
            keywords = ['metro', 'brts', 'station', 'railway', 'bus_stop', 'bus_station']
            if any(k in name_lower for k in keywords) or any(k in metadata_str for k in keywords):
                is_transit = True
            
            if is_transit:
                lat, lon = None, None
                # Check Point
                point = elem.find('.//{http://www.opengis.net/kml/2.2}Point')
                if point is not None:
                    coords = point.find('.//{http://www.opengis.net/kml/2.2}coordinates')
                    if coords is not None:
                        parts = coords.text.strip().split(',')
                        if len(parts) >= 2:
                            lon, lat = float(parts[0]), float(parts[1])
                
                # Check Polygon or LineString if Point not found
                if lat is None:
                    geom = elem.find('.//{http://www.opengis.net/kml/2.2}Polygon') or elem.find('.//{http://www.opengis.net/kml/2.2}LineString')
                    if geom is not None:
                        coords = geom.find('.//{http://www.opengis.net/kml/2.2}coordinates')
                        if coords is not None:
                            res = get_centroid(coords.text)
                            if res:
                                lat, lon = res
                
                if lat is not None:
                    stations.append({
                        'name': name,
                        'lat': lat,
                        'lon': lon,
                        'metadata': metadata
                    })
            
            elem.clear()
    
    return stations

if __name__ == "__main__":
    kml_path = "/Users/rezpa/Desktop/Projects/smart-city-dashboard/Data/export.kml"
    output_path = "/Users/rezpa/Desktop/Projects/smart-city-dashboard/Data/kml_transit_v2.json"
    if os.path.exists(kml_path):
        print(f"Processing {kml_path}...")
        results = extract_kml_transit(kml_path)
        with open(output_path, "w") as f:
            json.dump(results, f, indent=2)
        print(f"Extracted {len(results)} points to {output_path}")
    else:
        print(f"File {kml_path} not found")
