import json

path = '/opt/gsa-tv/playlists/1/2026/09/2026-09-15.json'
with open(path, 'r') as f:
    data = json.load(f)

base_programs = [p for p in data['program'] if 'filler' not in p.get('source', '')]

new_programs = []
for i in range(6):
    for p in base_programs:
        new_programs.append(p)

data['program'] = new_programs

with open(path, 'w') as f:
    json.dump(data, f, indent=2)

print(f"Created continuous looped playlist with {len(new_programs)} items.")
