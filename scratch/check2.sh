#!/bin/bash
echo "=== 6b. PLAYLIST ENTRIES ==="
cat /opt/gsa-tv/playlists/1/2026-09-10.json | python3 -c "import json,sys; d=json.load(sys.stdin); print('keys:', d.keys()); print('entries:', len(d.get('program', [])))"

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
