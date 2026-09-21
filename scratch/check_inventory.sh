set -euo pipefail
echo "=== PLAYLIST REFERENCES ==="
python3 - << 'EOF'
import json, glob

files = set()
for p in ['/opt/gsa-tv/playlists/1/2026-09-09.json', '/opt/gsa-tv/playlists/1/2026-09-10.json']:
    try:
        with open(p) as f:
            data = json.load(f)
        def walk(o):
            if isinstance(o, dict):
                for k, v in o.items():
                    if k in ('src', 'source', 'path', 'file', 'uri') and isinstance(v, str):
                        files.add(v)
                    else:
                        walk(v)
            elif isinstance(o, list):
                for item in o:
                    walk(item)
        walk(data)
    except Exception as e:
        print(f"Error reading {p}: {e}")

for s in sorted(files):
    print(s)
EOF

echo ""
echo "=== DISK USAGE BY DIRECTORY ==="
du -sh /opt/gsa-tv/cache/media/* 2>/dev/null || true
du -sh /opt/gsa-tv/fallback 2>/dev/null || true
du -sh /opt/gsa-tv/backups 2>/dev/null || true
du -sh /home/opc/gsa-ai/* 2>/dev/null || true
du -sh /var/lib/docker 2>/dev/null || sudo du -sh /var/lib/docker 2>/dev/null || true

echo ""
echo "=== TOP 30 LARGEST FILES IN /opt/gsa-tv AND /home/opc ==="
find /opt/gsa-tv /home/opc -type f -exec du -h {} + 2>/dev/null | sort -rh | head -n 30
