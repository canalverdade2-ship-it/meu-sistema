#!/usr/bin/env bash
set -euo pipefail

IMAGE="${IMAGE:-gsa-tv/ffplayout:2.1.0-arm64-poc}"
MEDIA_DIR="${MEDIA_DIR:-/opt/gsa-tv/cache/incoming}"
BENCHMARK_SECONDS="${BENCHMARK_SECONDS:-120}"

docker run --rm \
  --network none \
  --read-only \
  --tmpfs /tmp:size=256m,mode=1777 \
  --security-opt no-new-privileges \
  --cap-drop ALL \
  --cpus 3 \
  --memory 6g \
  --volume "${MEDIA_DIR}:/media:ro" \
  --entrypoint ffmpeg \
  "${IMAGE}" \
  -hide_banner -nostdin -benchmark \
  -stream_loop -1 -i /media/gsa-tv-test-720p30.mp4 \
  -t "${BENCHMARK_SECONDS}" \
  -vf "scale=1280:720:force_original_aspect_ratio=decrease,pad=1280:720:(ow-iw)/2:(oh-ih)/2:black,fps=30,format=yuv420p" \
  -af "aresample=48000" \
  -c:v libx264 -preset veryfast -profile:v high -level 4.1 \
  -b:v 4500k -maxrate 4500k -bufsize 9000k \
  -g 60 -keyint_min 60 -sc_threshold 0 \
  -c:a aac -b:a 128k -ar 48000 -ac 2 \
  -f null -

