ls -la /home/opc/gsa-program-builder/cache/bumpers/
echo "=== FFPROBE ON BUMPERS ==="
for f in /home/opc/gsa-program-builder/cache/bumpers/*.wav; do
  [ -e "$f" ] || continue
  echo "--- FILE: $f ---"
  ffprobe -v error -show_entries format=duration,size,bit_rate:stream=codec_name,sample_rate,channels -of json "$f"
done
