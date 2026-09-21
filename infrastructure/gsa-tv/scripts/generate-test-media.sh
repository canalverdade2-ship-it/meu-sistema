#!/usr/bin/env bash
set -euo pipefail

IMAGE="${IMAGE:-gsa-tv/ffplayout:2.1.0-arm64-poc}"
MEDIA_DIR="${MEDIA_DIR:-/opt/gsa-tv/cache/incoming}"
DURATION="${DURATION:-30}"

docker run --rm \
  --network none \
  --read-only \
  --tmpfs /tmp:size=256m,mode=1777 \
  --security-opt no-new-privileges \
  --cap-drop ALL \
  --cpus 3 \
  --memory 6g \
  --volume "${MEDIA_DIR}:/media" \
  --entrypoint ffmpeg \
  "${IMAGE}" \
  -hide_banner -nostdin -y \
  -f lavfi -i "testsrc2=size=1280x720:rate=30" \
  -f lavfi -i "sine=frequency=1000:sample_rate=48000" \
  -t "${DURATION}" \
  -c:v libx264 -preset veryfast -profile:v high -level 4.1 \
  -pix_fmt yuv420p -b:v 4500k -maxrate 4500k -bufsize 9000k \
  -g 60 -keyint_min 60 -sc_threshold 0 \
  -c:a aac -b:a 128k -ar 48000 -ac 2 \
  -movflags +faststart \
  /media/gsa-tv-test-720p30.mp4

