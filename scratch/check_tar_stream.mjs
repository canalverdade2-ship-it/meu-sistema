import { runSshScript } from './ssh2-run.mjs';

const cmd = `
ps aux | grep -E 'tar|gzip|ffmpeg' | grep -v grep | head -n 10
echo "--- STREAM PROCESSES ---"
pgrep -fl ffmpeg
`;

const res = await runSshScript(cmd, 30000);
console.log(res.stdout);
