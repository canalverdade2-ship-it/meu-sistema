FILES=(
  "/opt/gsa-tv/cache/media/1/entertainment/desenhos/classic-cartoons-sunday-special-1080p.mp4"
  "/opt/gsa-tv/cache/media/1/entertainment/pipoca/sessao-pipoca-nostalgia-aventura-1080p.mp4"
  "/opt/gsa-tv/cache/media/1/program-masters/gsa-historias-da-biblia-o-filho-prodigo-30m.mp4"
  "/opt/gsa-tv/cache/media/1/entertainment/cinema/doa-1949-classic-noir-1080p.mp4"
  "/opt/gsa-tv/cache/media/1/production/autonomous/2026-09-14/pilot-reflection-02/script.mp4"
  "/opt/gsa-tv/cache/media/1/filler/gsa-tv-filler-600.mp4"
)

echo "=== CHECKING PHYSICAL MEDIA INTEGRITY WITH FFPROBE ==="
for f in "${FILES[@]}"; do
  echo "File: $f"
  if [ ! -f "$f" ]; then
    echo "  ERROR: File does not exist!"
    exit 1
  fi
  DUR=$(ffprobe -v error -show_entries format=duration -of default=noprint_wrappers=1:nokey=1 "$f")
  RES=$(ffprobe -v error -select_streams v:0 -show_entries stream=width,height,codec_name -of csv=p=0 "$f")
  SIZE=$(ls -lh "$f" | awk '{print $5}')
  echo "  Duration: ${DUR}s | Video: $RES | Size: $SIZE"
done
echo "All 6 physical files verified OK!"
