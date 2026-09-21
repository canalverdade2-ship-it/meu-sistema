import { runSshScript } from './ssh2-run.mjs';
const r=await runSshScript(`set -euo pipefail
sudo docker exec gsa-tv-control-plane sh -lc "sed -n '1000,1085p;4725,4830p' /app/src/app.js"
`,180000);
process.stdout.write(r.stdout); if(r.stderr)process.stderr.write(r.stderr);
