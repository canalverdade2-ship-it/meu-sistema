import { runSshScript } from './ssh2-run.mjs';
const r=await runSshScript(`set -euo pipefail
sudo find /opt/gsa-tv/control-plane -maxdepth 3 -type f -printf '%m %u:%g %p\n' | sort
echo '=== SOURCE LEGACY REFERENCES ==='
sudo grep -nE 'encoder-client|encoderEngineRequest|/v1/ensure' /opt/gsa-tv/control-plane/src/app.js | head -n 80 || true
echo '=== DOCKERFILES ==='
sudo find /opt/gsa-tv/control-plane -maxdepth 2 -type f -iname 'Dockerfile*' -exec sh -c 'echo ---$1; cat "$1"' _ {} \;
`,180000);
process.stdout.write(r.stdout); if(r.stderr)process.stderr.write(r.stderr);
