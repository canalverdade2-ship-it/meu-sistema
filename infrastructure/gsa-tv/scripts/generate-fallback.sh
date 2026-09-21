#!/usr/bin/env bash
set -euo pipefail

IMAGE="${IMAGE:-gsa-tv/ffplayout:2.1.0-arm64}"
FALLBACK_DIR="${FALLBACK_DIR:-/opt/gsa-tv/fallback}"
DURATION="${DURATION:-30}"

docker run --rm \
  --network none \
  --read-only \
  --tmpfs /tmp:size=256m,mode=1777 \
  --security-opt no-new-privileges \
  --cap-drop ALL \
  --cpus 3 \
  --memory 6g \
  --volume "${FALLBACK_DIR}:/fallback" \
  --entrypoint ffmpeg \
  "${IMAGE}" \
  -hide_banner -nostdin -y \
  -f lavfi -i "color=c=0x0b1220:size=1280x720:rate=30" \
  -f lavfi -i "anullsrc=channel_layout=stereo:sample_rate=48000" \
  -t "${DURATION}" \
  -vf "drawtext=fontfile=/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf:text='GSA TV':fontcolor=white:fontsize=78:x=(w-text_w)/2:y=(h-text_h)/2-70,drawtext=fontfile=/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf:text='Voltamos em instantes':fontcolor=0xb8c4d9:fontsize=34:x=(w-text_w)/2:y=(h-text_h)/2+45" \
  -c:v libx264 -preset veryfast -profile:v high -level 4.1 \
  -pix_fmt yuv420p -b:v 4500k -maxrate 4500k -bufsize 9000k \
  -g 60 -keyint_min 60 -sc_threshold 0 \
  -c:a aac -b:a 128k -ar 48000 -ac 2 \
  -movflags +faststart -shortest \
  /fallback/gsa-tv-fallback-720p30.mp4

