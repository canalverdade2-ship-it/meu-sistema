#!/bin/bash
echo "=== 1. TIMERS ==="
systemctl list-timers --all | grep gsa-tv

echo "=== 2. gsa-tv-night-factory.sh ==="
ls -la /opt/gsa-tv/bin/gsa-tv-night-factory.sh
bash -n /opt/gsa-tv/bin/gsa-tv-night-factory.sh
echo "Sintaxe: $?"
head -80 /opt/gsa-tv/bin/gsa-tv-night-factory.sh

echo "=== 3. gsa-tv-night-controller.sh ==="
grep -A5 'stop' /opt/gsa-tv/bin/gsa-tv-night-controller.sh

echo "=== 4. CONTROL PLANE ==="
sudo docker exec gsa-tv-control-plane grep -n 'time.*06:00\|rollover' /app/src/editorial-production.js | head -10
sudo docker exec gsa-tv-control-plane grep -n '1920\|1080' /app/src/app.js | head -10
sudo docker inspect gsa-tv-control-plane --format '{{json .Mounts}}' | python3 -m json.tool | grep -A3 src
curl -s http://127.0.0.1:9202/health
echo

echo "=== 5. DATABASE ==="
export PGPASSWORD="GSA_SENHA_FORTE_2026"
psql -h 127.0.0.1 -p 5433 -U supabase_admin -d gsahub -c "SELECT count(*) as total_blocks, count(media_item_id) as blocks_with_media, count(*) - count(media_item_id) as blocks_without_media FROM public.gsa_tv_program_blocks WHERE schedule_version_id = '003801b7-5f2d-4da3-a531-915ce52a27f3';"
psql -h 127.0.0.1 -p 5433 -U supabase_admin -d gsahub -c "SELECT * FROM public.gsa_tv_program_blocks WHERE schedule_version_id = '003801b7-5f2d-4da3-a531-915ce52a27f3' AND media_item_id IS NULL;"

echo "=== 6. PLAYLIST ==="
ls -la /opt/gsa-tv/playlists/1/2026-09-10.json
head -c 500 /opt/gsa-tv/playlists/1/2026-09-10.json
echo ""
cat /opt/gsa-tv/playlists/1/2026-09-10.json | python3 -c "import json,sys; d=json.load(sys.stdin); print('entries:', len(d.get('items', d.get('blocks', d.get('entries', [])))))"

echo "=== 7. MASTERS ==="
ls -lah /opt/gsa-tv/cache/media/1/program-masters/
ffprobe -v error -show_entries stream=codec_name,width,height -show_entries format=duration -of csv /opt/gsa-tv/cache/media/1/program-masters/gsa-tv-fallback-1080p30.mp4

echo "=== 8. FILLER ==="
ffprobe -v error -show_streams -of json /opt/gsa-tv/cache/media/1/filler/gsa-tv-filler-600.mp4 | python3 -c "import json,sys; d=json.load(sys.stdin); types=[s['codec_type'] for s in d['streams']]; print('streams:', types); print('HAS VIDEO:', 'video' in types)"

echo "=== 9. YOUTUBE STREAM ==="
ss -tnp | grep 1935
curl -s http://127.0.0.1:9210/health
echo
docker top gsa-tv-encoder-engine | grep ffmpeg

echo "=== 10. SYSTEMD ==="
systemctl cat gsa-tv-night-factory
systemctl cat gsa-tv-night-stop
systemctl cat gsa-tv-morning-start
