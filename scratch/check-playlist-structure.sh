python3 -c "
import json
p = json.load(open('/opt/gsa-tv/playlists/1/2026-09-15.json'))
entries = p.get('program', [])
print('First 3 entries:')
for e in entries[:3]:
    print(json.dumps(e, indent=2))
print('Keys in first entry:', list(entries[0].keys()) if entries else [])
"
