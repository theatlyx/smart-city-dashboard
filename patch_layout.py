import re

with open('frontend/src/components/DashboardLayout.tsx', 'r') as f:
    content = f.read()

content = content.replace('<BarChart data={weatherData.forecast} aspect={2.5}>', '<BarChart data={weatherData.forecast}>')
content = content.replace('<ResponsiveContainer width="100%" height="100%">\n                  <BarChart data={weatherData.forecast}>', '<ResponsiveContainer width="100%" height="100%" aspect={2.5}>\n                  <BarChart data={weatherData.forecast}>')

content = content.replace('<AreaChart data={solarData.monthly_energy?.map((v: number, i: number) => ({ m: i+1, v }))} aspect={2.5}>', '<AreaChart data={solarData.monthly_energy?.map((v: number, i: number) => ({ m: i+1, v }))}>')
content = content.replace('<ResponsiveContainer width="100%" height="100%">\n                  <AreaChart', '<ResponsiveContainer width="100%" height="100%" aspect={2.5}>\n                  <AreaChart')

with open('frontend/src/components/DashboardLayout.tsx', 'w') as f:
    f.write(content)

with open('frontend/src/components/MapComponent.tsx', 'r') as f:
    content = f.read()

content = content.replace(', FillStyleExtension', '')

with open('frontend/src/components/MapComponent.tsx', 'w') as f:
    f.write(content)

print("Patched DashboardLayout.tsx and MapComponent.tsx")
