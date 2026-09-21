import { runSshScript } from './ssh2-run.mjs';
const r=await runSshScript(`set -euo pipefail
sudo docker inspect gsa-tv-encoder-engine --format '{{json .NetworkSettings.Ports}} {{json .Config.ExposedPorts}} {{json .Config.Env}}'
sudo docker exec gsa-tv-encoder-engine sh -lc "sed -n '1,270p' /app/src/app.js"
`,180000);
process.stdout.write(r.stdout); if(r.stderr)process.stderr.write(r.stderr);
