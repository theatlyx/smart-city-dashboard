import re

with open('src/components/DashboardLayout.tsx', 'r') as f:
    content = f.read()

content = content.replace('<AreaChart data={aqChart} aspect={2.5}>', '<AreaChart data={aqChart}>')
content = content.replace('<ResponsiveContainer width="100%" height="100%">\n                      <AreaChart', '<ResponsiveContainer width="100%" height="100%" aspect={2.5}>\n                      <AreaChart')
content = content.replace(', Layers', '')

with open('src/components/DashboardLayout.tsx', 'w') as f:
    f.write(content)
