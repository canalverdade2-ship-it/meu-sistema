import { runSshScript } from './ssh2-run.mjs';

async function main() {
  const script = `
    echo "=== ENCODER LOGS ==="
    sudo docker logs --tail 40 gsa-tv-encoder-engine

    echo "\n=== FFPLAYOUT LOGS ==="
    sudo docker logs --tail 30 gsa-tv-ffplayout

    echo "\n=== HLS DIRECTORY SEGMENTS ==="
    ls -lt /opt/gsa-tv/runtime/hls/ | head -n 15

    echo "\n=== PROBE A SEGMENT ==="
    latest_ts=$(ls -t /opt/gsa-tv/runtime/hls/*.ts 2>/dev/null | head -n 2 | tail -n 1)
    if [ -n "$latest_ts" ]; then
      echo "Probing $latest_ts"
      /usr/local/bin/ffprobe -v error -show_entries format=duration -of default=noprint_wrappers=1:nokey=1 "$latest_ts" || true
      /usr/local/bin/ffprobe -v error -select_streams v:0 -show_entries stream=r_frame_rate,avg_frame_rate,nb_frames -of default=noprint_wrappers=1 "$latest_ts" || true
    fi
  `;
  const res = await runSshScript(script);
  console.log(res.stdout);
  if (res.stderr) console.error(res.stderr);
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
