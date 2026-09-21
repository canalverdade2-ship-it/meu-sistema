import { runSshScript } from './ssh2-run.mjs';

const script = `
cat /usr/local/bin/ffprobe
cat /usr/local/bin/ffmpeg
`;

const res = await runSshScript(script);
console.log(res.stdout);
