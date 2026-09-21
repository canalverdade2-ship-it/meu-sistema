sudo bash -s << 'EOF'
echo "=== 1. RTMP STREAM AND PROCESS STATUS ==="
ps aux | grep "[r]tmp://a.rtmp.youtube.com" || echo "NO FFMPEG RTMP PROCESS FOUND!"
echo ""
echo "=== DOCKER CONTAINERS ==="
docker ps --format "table {{.Names}}\t{{.Status}}\t{{.Ports}}"
echo ""

echo "=== 2. PLAYLIST MEDIA INTEGRITY CHECK ==="
python3 - << 'PY_EOF'
import json, os, glob

for pl in sorted(glob.glob('/opt/gsa-tv/playlists/1/*.json')):
    print(f"--- Playlist: {pl} ---")
    try:
        with open(pl) as f:
            data = json.load(f)
        items = []
        if isinstance(data, dict):
            items = data.get('program', []) or data.get('items', [])
        elif isinstance(data, list):
            items = data
        missing = []
        found = 0
        for it in items:
            source = it.get('source') or it.get('path') or it.get('file')
            if source:
                host_source = source
                if host_source.startswith('/media/'):
                    host_source = '/opt/gsa-tv/cache' + host_source
                if not os.path.exists(host_source):
                    missing.append(source)
                else:
                    found += 1
        print(f"Total items: {len(items)}, Found: {found}, Missing: {len(missing)}")
        if missing:
            print("MISSING ITEMS:")
            for m in sorted(set(missing)):
                print("  -", m)
    except Exception as e:
        print("Error parsing playlist:", e)
PY_EOF

echo ""
echo "=== 3. ACTIVE SCHEDULED PROGRAM MASTERS CHECK ==="
ls -lh /opt/gsa-tv/cache/media/1/program-masters/gsa-manha-news-20260909-30m.mp4
ls -lh /opt/gsa-tv/cache/media/1/program-masters/gsa-historias-da-biblia-o-filho-prodigo-30m.mp4
ls -lh /opt/gsa-tv/cache/media/1/filler/gsa-tv-filler-600.mp4
ls -lh /opt/gsa-tv/fallback/

echo ""
echo "=== 4. FFPLAYOUT LOGS (LATEST 20 LINES) ==="
docker logs --tail 20 gsa-tv-ffplayout
EOF
