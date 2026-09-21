import { runSshScript } from './ssh2-run.mjs';

async function main() {
  const script = `
    for s in $(ls -t /opt/gsa-tv/runtime/hls/*.ts | head -n 5); do
      echo "=== $s ==="
      /usr/local/bin/ffprobe -v error -count_frames -select_streams v:0 -show_entries stream=r_frame_rate,avg_frame_rate,nb_read_frames,duration -of default=noprint_wrappers=1 "$s"
    done
  `;
  const res = await runSshScript(script);
  console.log(res.stdout);
  if (res.stderr) console.error(res.stderr);
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
