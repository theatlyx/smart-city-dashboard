import xml.etree.ElementTree as ET
import json
import os

def extract_kml_transit(file_path):
    context = ET.iterparse(file_path, events=('end',))
    stations = []
    
    for event, elem in context:
        if elem.tag.endswith('Placemark'):
            name = ""
            name_elem = elem.find('{http://www.opengis.net/kml/2.2}name')
            if name_elem is not None:
                name = name_elem.text
            
            extended = elem.find('{http://www.opengis.net/kml/2.2}ExtendedData')
            metadata = {}
            if extended is not None:
                for data in extended.findall('{http://www.opengis.net/kml/2.2}Data'):
                    val = data.find('{http://www.opengis.net/kml/2.2}value')
                    if val is not None:
                        metadata[data.get('name')] = val.text
            
            is_transit = False
            if name and ('Metro' in name or 'Station' in name or 'BRTS' in name):
                is_transit = True
            if metadata.get('railway') == 'station' or metadata.get('amenity') == 'bus_station' or metadata.get('operator') == 'Ahmedabad Metro':
                is_transit = True
            
            if is_transit:
                point = elem.find('{http://www.opengis.net/kml/2.2}Point')
                if point is not None:
                    coords = point.find('{http://www.opengis.net/kml/2.2}coordinates')
                    if coords is not None:
                        try:
                            parts = coords.text.strip().split(',')
                            if len(parts) >= 2:
                                lon, lat = parts[0], parts[1]
                                stations.append({
                                    'name': name,
                                    'lat': float(lat),
                                    'lon': float(lon),
                                    'metadata': metadata
                                })
                        except:
                            pass
            
            elem.clear()
    
    return stations

if __name__ == "__main__":
    kml_path = "/Users/rezpa/Desktop/Projects/smart-city-dashboard/Data/export.kml"
    output_path = "/Users/rezpa/Desktop/Projects/smart-city-dashboard/Data/kml_transit.json"
    if os.path.exists(kml_path):
        results = extract_kml_transit(kml_path)
        with open(output_path, "w") as f:
            json.dump(results, f, indent=2)
        print(f"Extracted {len(results)} points to {output_path}")
    else:
        print(f"File {kml_path} not found")
