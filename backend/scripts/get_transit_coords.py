import requests
import json
import time

stations = [
    "Motera Stadium Metro Station, Ahmedabad",
    "Sabarmati Metro Station, Ahmedabad",
    "AEC Metro Station, Ahmedabad",
    "Sabarmati Railway Station Metro Station, Ahmedabad",
    "Ranip Metro Station, Ahmedabad",
    "Vadaj Metro Station, Ahmedabad",
    "Vijay Nagar Metro Station, Ahmedabad",
    "Usmanpura Metro Station, Ahmedabad",
    "Old High Court Metro Station, Ahmedabad",
    "Gandhigram Metro Station, Ahmedabad",
    "Paldi Metro Station, Ahmedabad",
    "Shreyas Metro Station, Ahmedabad",
    "Rajiv Nagar Metro Station, Ahmedabad",
    "Jivraj Park Metro Station, Ahmedabad",
    "APMC Metro Station, Ahmedabad",
    "Thaltej Gam Metro Station, Ahmedabad",
    "Thaltej Metro Station, Ahmedabad",
    "Doordarshan Kendra Metro Station, Ahmedabad",
    "Gurukul Road Metro Station, Ahmedabad",
    "Gujarat University Metro Station, Ahmedabad",
    "Commerce Six Road Metro Station, Ahmedabad",
    "Stadium Metro Station, Ahmedabad",
    "Shahpur Metro Station, Ahmedabad",
    "Gheekanta Metro Station, Ahmedabad",
    "Kalupur Railway Station Metro Station, Ahmedabad",
    "Kankaria East Metro Station, Ahmedabad",
    "Apparel Park Metro Station, Ahmedabad",
    "Amraiwadi Metro Station, Ahmedabad",
    "Rabari Colony Metro Station, Ahmedabad",
    "Vastral Metro Station, Ahmedabad",
    "Nirant Cross Road Metro Station, Ahmedabad",
    "Vastral Gam Metro Station, Ahmedabad",
    "Shivranjani BRTS, Ahmedabad",
    "ISKCON BRTS, Ahmedabad",
    "Bopal BRTS, Ahmedabad",
    "Science City BRTS, Ahmedabad",
    "Chandkheda BRTS, Ahmedabad",
    "RTO Circle BRTS, Ahmedabad"
]

results = []
for station in stations:
    try:
        r = requests.get(f"https://nominatim.openstreetmap.org/search?q={station}&format=json", headers={'User-Agent': 'SmartCityDashboard/1.0'})
        data = r.json()
        if data:
            results.append({
                "name": station.split(",")[0],
                "lat": float(data[0]["lat"]),
                "lon": float(data[0]["lon"])
            })
            print(f"Found {station}: {data[0]['lat']}, {data[0]['lon']}")
        else:
            print(f"Not found: {station}")
        time.sleep(1) # Respect rate limit
    except Exception as e:
        print(f"Error for {station}: {e}")

with open("transit_coords.json", "w") as f:
    json.dump(results, f, indent=2)
