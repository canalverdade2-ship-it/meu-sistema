import { runSshScript } from './ssh2-run.mjs';
const remote = String.raw`sudo docker exec gsa-tv-control-plane sh -lc "sed -n '1,155p' /app/src/gemini.js"`;
const result = await runSshScript(remote, 30000);
process.stdout.write(result.stdout);
if (result.stderr) process.stderr.write(result.stderr);
