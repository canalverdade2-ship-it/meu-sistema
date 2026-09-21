import { runSshScript } from './ssh2-run.mjs';
const result = await runSshScript(`sudo docker exec gsa-tv-control-plane sh -lc "sed -n '3610,3905p' /app/src/app.js"`,180000);
process.stdout.write(result.stdout); if(result.stderr) process.stderr.write(result.stderr);
