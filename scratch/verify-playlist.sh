sudo python3 /opt/gsa-tv/bin/night-production.py --compile-ready --date 2026-09-15
python3 -c "
import json
from pathlib import Path

p_path = Path('/opt/gsa-tv/playlists/1/2026-09-15.json')
if not p_path.exists():
    print('ERROR: Playlist file does not exist:', p_path)
    exit(1)

p = json.load(open(p_path))
entries = p.get('program', [])
total = sum(float(e['out']) - float(e.get('in', 0)) for e in entries)
print('Date:', p.get('date'))
print('Entries count:', len(entries))
print('Total duration (s):', total)
print('Expected duration (s): 86400')
print('Duration difference:', abs(total - 86400))
missing = [e for e in entries if not e.get('uri')]
print('Entries missing uri:', len(missing))
"
