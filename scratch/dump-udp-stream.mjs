import { runSshScript } from './ssh2-run.mjs';

async function main() {
  const script = `
echo "=== GRAVANDO 5 SEGUNDOS DO UDP LOCAL ==="
sudo docker run --rm --network host gsa-tv/control-plane:1.6.39 ffmpeg -hide_banner -nostdin -t 5 -i "udp://127.0.0.1:12345?fifo_size=1000000&overrun_nonfatal=1" -c copy /tmp/test_dump.ts 2>&1 | tail -10
sudo docker run --rm -v /tmp:/tmp gsa-tv/control-plane:1.6.39 ffprobe -v error -show_entries stream=codec_name,codec_type,r_frame_rate,duration -of json /tmp/test_dump.ts
`;
  const res = await runSshScript(script);
  console.log(res.stdout);
  if (res.stderr) console.error(res.stderr);
}

main().catch(console.error);
