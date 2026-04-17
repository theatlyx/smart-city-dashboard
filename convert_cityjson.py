import json

def process_cityjson(input_file, output_file):
    with open(input_file, 'r') as f:
        cj = json.load(f)
        
    vertices = cj.get('vertices', [])
    transform = cj.get('transform', {'scale': [1, 1, 1], 'translate': [0, 0, 0]})
    scale = transform['scale']
    translate = transform['translate']
    
    def get_vertex(idx):
        v = vertices[idx]
        return [
            (v[0] * scale[0]) + translate[0],
            (v[1] * scale[1]) + translate[1],
            (v[2] * scale[2]) + translate[2]
        ]

    features = []
    
    for obj_id, obj in cj.get('CityObjects', {}).items():
        if obj['type'] != 'Building':
            continue
            
        for geom in obj.get('geometry', []):
            if geom['type'] == 'Solid':
                boundaries = geom['boundaries']
                semantics = geom.get('semantics', {})
                
                # semantics['values'] typically maps directly to boundaries in Solid
                # boundaries is a list of shells, where shell 0 is exterior.
                # shell is a list of surfaces, and each surface is a list of rings (ring 0 is exterior)
                # Let's flatten this out:
                # Solid -> [Shells] -> [Surfaces] -> [Rings] -> [Vertex Indices]
                for shell_idx, shell in enumerate(boundaries):
                    for srf_idx, surface in enumerate(shell):
                        # Determine surface type
                        surface_type = 'WallSurface'
                        if 'values' in semantics and shell_idx < len(semantics['values']) and srf_idx < len(semantics['values'][shell_idx]):
                            val_idx = semantics['values'][shell_idx][srf_idx]
                            if val_idx is not None and 'surfaces' in semantics and val_idx < len(semantics['surfaces']):
                                surface_type = semantics['surfaces'][val_idx]['type']
                        
                        # Process exterior ring
                        if len(surface) > 0:
                            ring = surface[0]
                            polygon_coords = [get_vertex(idx) for idx in ring]
                            # Close the polygon if not closed
                            if polygon_coords[0] != polygon_coords[-1]:
                                polygon_coords.append(polygon_coords[0])
                                
                            color = [200, 200, 200] # Default
                            if surface_type == 'RoofSurface':
                                color = [100, 100, 110]
                            elif surface_type == 'WallSurface':
                                color = [220, 220, 220]
                            elif surface_type == 'GroundSurface':
                                color = [50, 50, 50]
                                
                            feature = {
                                "type": "Feature",
                                "properties": {
                                    "buildingId": obj_id,
                                    "surfaceType": surface_type,
                                    "color": color
                                },
                                "geometry": {
                                    "type": "Polygon",
                                    "coordinates": [polygon_coords]
                                }
                            }
                            features.append(feature)

    out_geojson = {
        "type": "FeatureCollection",
        "features": features
    }
    
    with open(output_file, 'w') as f:
        json.dump(out_geojson, f)
    
    print(f"Successfully created {output_file} with {len(features)} 3D polygons.")

if __name__ == '__main__':
    process_cityjson('wfs_output.json', 'smart-city-dashboard/frontend/public/buildings.json')
