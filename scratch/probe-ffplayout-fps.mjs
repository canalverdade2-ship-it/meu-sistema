import { runSshScript } from './ssh2-run.mjs';

const script = `
ffprobe -v error -select_streams v:0 -show_entries stream=r_frame_rate,avg_frame_rate,duration -of json http://127.0.0.1:8787/public/1/live/stream.m3u8
`;

const res = await runSshScript(script);
console.log(res.stdout);
