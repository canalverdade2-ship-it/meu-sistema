#!/usr/bin/env bash
set -e
echo "=== PLAYLIST FILES IN /opt/gsa-tv/playlists/1/ ==="
ls -la /opt/gsa-tv/playlists/1/

echo "=== EXTRACTING MEDIA FROM PLAYLISTS 2026-09-09 and 2026-09-10 ==="
python3 - << 'PYEOF'
import json, glob, os

playlists = ['/opt/gsa-tv/playlists/1/2026-09-09.json', '/opt/gsa-tv/playlists/1/2026-09-10.json']
files = set()

for p in playlists:
    if not os.path.exists(p):
        print(f"File not found: {p}")
        continue
    with open(p, 'r') as f:
        data = json.load(f)
    print(f"Loaded {p}")

    def walk(obj):
        if isinstance(obj, dict):
            for k, v in obj.items():
                if isinstance(v, str):
                    if '/' in v and (v.startswith('/') or v.endswith(('.mp4', '.mov', '.ts', '.png', '.jpg', '.m3u8', '.webm', '.wav', '.mp3'))):
                        files.add(v)
                walk(v)
        elif isinstance(obj, list):
            for item in obj:
                walk(item)

    walk(data)

print(f"Total referenced media files found in playlists: {len(files)}")
for f in sorted(files):
    print("PLAYLIST_REF:", f, "EXISTS:", os.path.exists(f))
PYEOF
