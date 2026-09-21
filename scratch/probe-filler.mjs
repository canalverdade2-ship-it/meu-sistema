import { runSshScript } from './ssh2-run.mjs';

const script = `
ffprobe -v error -select_streams v:0 -show_entries stream=r_frame_rate,avg_frame_rate,duration -of json /opt/gsa-tv/cache/media/1/filler/gsa-tv-filler-600.mp4
`;

const res = await runSshScript(script);
console.log(res.stdout);
