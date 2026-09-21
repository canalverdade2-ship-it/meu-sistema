import { runSshScript } from './ssh2-run.mjs';
const r=await runSshScript(`set -euo pipefail
sudo docker exec gsa-tv-control-plane sh -lc "grep -n 'ENCODER_ENGINE\|encoderEngine\|/v1/ensure\|engineEnsure' /app/src/app.js"
`,180000);
process.stdout.write(r.stdout); if(r.stderr)process.stderr.write(r.stderr);
