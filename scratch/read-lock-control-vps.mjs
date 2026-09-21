import { runSshScript } from './ssh2-run.mjs';
const r=await runSshScript(`sudo docker exec gsa-tv-control-plane sh -lc "grep -nF 'acquireEncoderLock' /app/src/app.js; grep -nF 'releaseEncoderLock' /app/src/app.js; sed -n '180,250p' /app/src/app.js"`,180000);
process.stdout.write(r.stdout); if(r.stderr)process.stderr.write(r.stderr);
