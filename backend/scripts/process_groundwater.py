import pandas as pd
import json
import os
import glob
import math

def process_groundwater_data(input_dir, output_file):
    print(f"Scanning directory: {input_dir}")
    excel_files = glob.glob(os.path.join(input_dir, "*.xlsx"))
    print(f"Found {len(excel_files)} Excel files.")
    
    stations = []
    
    for file_path in excel_files:
        try:
            # Sheet 0 has metadata (Lat, Lon, Station Name)
            # The structure is Key in col 0, Value in col 1
            meta_df = pd.read_excel(file_path, sheet_name=0)
            
            # Find the rows where column 0 equals 'Latitude', 'Longitude', 'Station Name'
            lat, lon, name = None, None, None
            for idx, row in meta_df.iterrows():
                key = str(row.iloc[0]).strip()
                val = row.iloc[1]
                if key == 'Latitude':
                    lat = float(val)
                elif key == 'Longitude':
                    lon = float(val)
                elif key == 'Station Name':
                    name = str(val).strip()
                    
            if lat is None or lon is None or math.isnan(lat) or math.isnan(lon):
                print(f"Skipping {os.path.basename(file_path)}: Missing coordinates.")
                continue
                
            # Sheet 1 has time-series data
            raw_data_df = pd.read_excel(file_path, sheet_name=1)
            
            header_idx = -1
            for idx, row in raw_data_df.iterrows():
                if any('Data Time' in str(cell) for cell in row.values):
                    header_idx = idx
                    break
                    
            if header_idx == -1:
                print(f"Skipping {os.path.basename(file_path)}: Could not find 'Data Time' header row.")
                continue
                
            # Now read again with the correct header
            data_df = pd.read_excel(file_path, sheet_name=1, header=header_idx+1)
            
            # The columns should be 'Data Time' and 'Data Value'
            if 'Data Time' not in data_df.columns or 'Data Value' not in data_df.columns:
                print(f"Skipping {os.path.basename(file_path)}: Columns named {data_df.columns}")
                continue
                
            time_series = []
            for idx, row in data_df.iterrows():
                dt = row['Data Time']
                val = row['Data Value']
                
                if pd.isna(dt) or pd.isna(val):
                    continue
                    
                time_series.append({
                    "date": str(dt).split('T')[0],
                    "level": float(val)
                })
                
            # Sort chronologically
            time_series.sort(key=lambda x: x['date'])
            
            if not time_series:
                print(f"Skipping {os.path.basename(file_path)}: No valid time series data.")
                continue
                
            # Get latest depth
            latest_depth = time_series[-1]['level']
            # Get earliest depth
            earliest_depth = time_series[0]['level']
            # Calculate change (positive means water dropped deeper, negative means water rose)
            change = latest_depth - earliest_depth
            
            stations.append({
                "name": name if name else os.path.basename(file_path).replace('.xlsx', ''),
                "lat": lat,
                "lon": lon,
                "latest_depth": latest_depth,
                "change": change,
                "history": time_series
            })
            
        except Exception as e:
            print(f"Error processing {os.path.basename(file_path)}: {e}")
            
    print(f"Successfully processed {len(stations)} stations.")
    
    with open(output_file, 'w', encoding='utf-8') as f:
        json.dump(stations, f)
    print(f"Saved to {output_file}")

if __name__ == "__main__":
    input_directory = "/Users/rezpa/.gemini/antigravity/scratch/data/Groundlevelwaterdataahmedabad"
    output_path = "/Users/rezpa/.gemini/antigravity/scratch/smart-city-dashboard/frontend/public/ahmedabad_groundwater.json"
    process_groundwater_data(input_directory, output_path)
