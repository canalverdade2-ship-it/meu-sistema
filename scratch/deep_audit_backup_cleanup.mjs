import { runSshScript } from './ssh2-run.mjs';

const cmd = String.raw`sudo bash -s << 'BASH_EOF'
echo "=== 1. RTMP & STREAM STATUS ==="
echo "FFMPEG RTMP process:"
pgrep -fl "rtmp://a.rtmp.youtube.com" || echo "NO FFMPEG RTMP FOUND!"
echo "Docker containers:"
docker ps --format "table {{.Names}}\t{{.Status}}\t{{.Ports}}"

echo "=== 2. PLAYLIST MEDIA AUDIT ==="
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
            print("MISSING ITEMS:", set(missing))
    except Exception as e:
        print("Error parsing playlist:", e)
PY_EOF

echo "=== 3. ESSENTIAL DIRECTORY CONTENTS ==="
echo "--- /opt/gsa-tv/cache/media/1/identity/ ---"
ls -lh /opt/gsa-tv/cache/media/1/identity/ 2>/dev/null || echo "MISSING"

echo "--- /opt/gsa-tv/cache/media/1/filler/ ---"
ls -lh /opt/gsa-tv/cache/media/1/filler/ 2>/dev/null || echo "MISSING"

echo "--- /opt/gsa-tv/fallback/ ---"
ls -lh /opt/gsa-tv/fallback/ 2>/dev/null || echo "MISSING"

echo "--- /opt/gsa-tv/cache/media/1/program-masters/ ---"
ls -lh /opt/gsa-tv/cache/media/1/program-masters/ 2>/dev/null || echo "MISSING"

echo "--- /opt/gsa-tv/runtime/gsa-tv-live-badge.txt ---"
cat /opt/gsa-tv/runtime/gsa-tv-live-badge.txt 2>/dev/null || echo "MISSING"
echo ""

echo "=== 4. CHECK FOR REMAINING NON-ESSENTIAL FILES ==="
echo "--- /home/opc/gsa-ai/ ---"
du -sh /home/opc/gsa-ai/* 2>/dev/null || true

echo "--- /opt/gsa-tv/cache/media/1/ subdirectories ---"
du -sh /opt/gsa-tv/cache/media/1/* 2>/dev/null || true

echo "--- /opt/gsa-tv/cache/media/ ---"
ls -la /opt/gsa-tv/cache/media/ 2>/dev/null || true

echo "--- /tmp disk hogs (>50MB) ---"
find /tmp -type f -size +50M 2>/dev/null || true

echo "--- /home/opc/ disk hogs (>100MB) ---"
find /home/opc -maxdepth 3 -type f -size +100M 2>/dev/null || true

echo "=== 5. BACKUP DIRECTORY & PERMISSIONS ==="
ls -lah /opt/gsa-tv/backups/
ls -lah /opt/gsa-tv/backups/full/
ls -lah /opt/gsa-tv/backups/full/20260910T015950Z/
BASH_EOF
`;

const res = await runSshScript(cmd, 60000);
console.log(res.stdout);
if (res.stderr) console.error(res.stderr);
