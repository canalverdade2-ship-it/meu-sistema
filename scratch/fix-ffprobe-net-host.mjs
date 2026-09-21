import { runSshScript } from './ssh2-run.mjs';

const script = `
sudo sed -i 's/docker run --rm -i/docker run --rm --net host -i/g' /usr/local/bin/ffprobe
sudo sed -i 's/docker run --rm -i/docker run --rm --net host -i/g' /usr/local/bin/ffmpeg

cat /usr/local/bin/ffprobe

ffprobe -v error -select_streams v:0 -show_entries stream=r_frame_rate,avg_frame_rate,duration -of json http://127.0.0.1:8787/public/1/live/stream.m3u8
`;

const res = await runSshScript(script);
console.log(res.stdout);
