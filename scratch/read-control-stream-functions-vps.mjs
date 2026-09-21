import { runSshScript } from './ssh2-run.mjs';
const r=await runSshScript(`set -euo pipefail
sudo docker exec gsa-tv-control-plane sh -lc "grep -nE '^async function (startStream|stopStream|pauseStream|resumeStream)|^function (startStream|stopStream)' /app/src/app.js"
sudo docker exec gsa-tv-control-plane sh -lc "sed -n '410,500p;900,1085p;1085,1135p' /app/src/app.js"
`,180000);
process.stdout.write(r.stdout); if(r.stderr)process.stderr.write(r.stderr);
