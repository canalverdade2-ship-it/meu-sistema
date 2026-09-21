for f in /home/opc/gsa-program-builder/cache/bumpers/*.wav; do
  [ -e "$f" ] || continue
  echo "=== FILE: $(basename "$f") ==="
  docker run --rm -i --user 1000:1000 -v /opt:/opt -v /home:/home -v /tmp:/tmp gsa-tv/control-plane:1.8.7 ffprobe -v error -show_entries format=duration,size,bit_rate:stream=codec_name,sample_rate,channels -of json "$f"
done
