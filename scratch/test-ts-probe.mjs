import { runSshScript } from './ssh2-run.mjs';

const script = `
latest_ts=$(tail -n 1 /opt/gsa-tv/runtime/hls/program.m3u8)
echo "Latest ts: $latest_ts"
packets=$(ffprobe -v error -select_streams v:0 -count_packets -show_entries stream=nb_read_packets -of default=noprint_wrappers=1:nokey=1 /opt/gsa-tv/runtime/hls/$latest_ts 2>/dev/null || true)
echo "Video packets: $packets"
duration=$(ffprobe -v error -show_entries format=duration -of default=noprint_wrappers=1:nokey=1 /opt/gsa-tv/runtime/hls/$latest_ts 2>/dev/null || true)
echo "Duration: $duration"
`;

const res = await runSshScript(script);
console.log(res.stdout);
