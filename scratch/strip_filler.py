import json

path = '/opt/gsa-tv/playlists/1/2026/09/2026-09-15.json'
with open(path, 'r') as f:
    data = json.load(f)

old_len = len(data['program'])
new_programs = []
for p in data['program']:
    if 'filler' not in p.get('source', '') and 'Continuidade' not in p.get('title', ''):
        new_programs.append(p)

data['program'] = new_programs

with open(path, 'w') as f:
    json.dump(data, f, indent=2)

print(f"Reduced from {old_len} to {len(new_programs)} items.")
