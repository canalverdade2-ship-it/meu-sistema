python3 -c "
import json
from pathlib import Path

ROOT = Path('/opt/gsa-tv')
MEDIA = ROOT / 'cache/media/1'

p = json.load(open('/opt/gsa-tv/playlists/1/2026-09-15.json'))
entries = p.get('program', [])
total = sum(float(e['out']) - float(e.get('in', 0)) for e in entries)

missing_source = [e for e in entries if not e.get('source')]
missing_files = []
titles = {}
for e in entries:
    src = e.get('source', '')
    titles[e.get('title', 'Unknown')] = titles.get(e.get('title', 'Unknown'), 0) + 1
    if src.startswith('/media/1/'):
        fp = MEDIA / src[len('/media/1/'):]
    else:
        fp = Path(src)
    if not fp.exists():
        missing_files.append((e.get('title'), src))

print('=== 2026-09-15 PLAYLIST AUDIT ===')
print('Date:', p.get('date'))
print('Total entries:', len(entries))
print('Total duration (s):', round(total, 6))
print('Expected duration (s): 86400')
print('Missing source field:', len(missing_source))
print('Missing files on disk:', len(missing_files))
print('Distinct titles count:', len(titles))
print('\nBreakdown by title:')
for t, count in sorted(titles.items(), key=lambda x: -x[1]):
    print(f'  - {t}: {count} block(s)')

ta_in_playlist = [e for e in entries if 'rede' in e.get('title', '').lower()]
print('\nGSA Ta na Rede in playlist:')
for e in ta_in_playlist:
    print(' ', e)
"
