import { runSshScript } from './ssh2-run.mjs';

const script = `
curl -s http://127.0.0.1:8787/public/1/live/stream.m3u8
`;

const res = await runSshScript(script);
console.log(res.stdout);
