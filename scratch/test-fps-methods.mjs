import { runSshScript } from './ssh2-run.mjs';

const script = `
echo "=== FFPROBE ON HLS ==="
ffprobe -v error -select_streams v:0 -show_entries stream=r_frame_rate,avg_frame_rate -of default=noprint_wrappers=1 /opt/gsa-tv/runtime/hls/program.m3u8

echo "=== FFMPEG PROBE 2 SECONDS ==="
ffmpeg -nostdin -t 2 -i /opt/gsa-tv/runtime/hls/program.m3u8 -f null - 2>&1 | grep -i "fps=" || true

echo "=== CAT HLS PLAYLIST ==="
cat /opt/gsa-tv/runtime/hls/program.m3u8
`;

const res = await runSshScript(script);
console.log(res.stdout);
