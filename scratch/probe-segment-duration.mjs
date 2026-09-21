import { runSshScript } from './ssh2-run.mjs';

const script = `
cat /opt/gsa-tv/runtime/hls/program.m3u8

first_ts=$(grep -E "\\.ts$" /opt/gsa-tv/runtime/hls/program.m3u8 | head -n 1)
last_ts=$(grep -E "\\.ts$" /opt/gsa-tv/runtime/hls/program.m3u8 | tail -n 1)

echo "First TS: $first_ts"
ffprobe -v error -show_entries format=duration -of default=noprint_wrappers=1:nokey=1 /opt/gsa-tv/runtime/hls/$first_ts

echo "Last TS: $last_ts"
ffprobe -v error -show_entries format=duration -of default=noprint_wrappers=1:nokey=1 /opt/gsa-tv/runtime/hls/$last_ts

echo "Number of packets in $last_ts:"
ffprobe -v error -select_streams v:0 -show_entries stream=nb_frames -of default=noprint_wrappers=1 /opt/gsa-tv/runtime/hls/$last_ts
ffprobe -v error -select_streams v:0 -count_packets -show_entries stream=nb_read_packets -of default=noprint_wrappers=1 /opt/gsa-tv/runtime/hls/$last_ts
`;

const res = await runSshScript(script);
console.log(res.stdout);
