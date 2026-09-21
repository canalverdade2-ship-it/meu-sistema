import { runSshScript } from './ssh2-run.mjs';

const script = `
sudo sed -i 's/1.7.2/1.8.7/g' /usr/local/bin/ffprobe
sudo sed -i 's/1.7.9/1.8.7/g' /usr/local/bin/ffmpeg

last_ts=$(tail -n 1 /opt/gsa-tv/runtime/hls/program.m3u8)
echo "Probing: $last_ts"
ffprobe -v error -show_entries format=duration -show_streams -select_streams v:0 -of json /opt/gsa-tv/runtime/hls/$last_ts
`;

const res = await runSshScript(script);
console.log(res.stdout);
