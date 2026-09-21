import { runSshScript } from './ssh2-run.mjs';

const script = `
cat /opt/gsa-tv/runtime/hls/program.m3u8
latest_ts=$(tail -n 2 /opt/gsa-tv/runtime/hls/program.m3u8 | head -n 1)
echo "Latest ts: $latest_ts"
ffprobe -v error -select_streams v:0 -show_entries stream=r_frame_rate,avg_frame_rate,duration -show_packets -of compact /opt/gsa-tv/runtime/hls/$latest_ts 2>/dev/null | head -n 5
`;

const res = await runSshScript(script);
console.log(res.stdout);
