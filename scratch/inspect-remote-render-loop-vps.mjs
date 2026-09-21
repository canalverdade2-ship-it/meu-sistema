import { runSshScript } from './ssh2-run.mjs';
const result = await runSshScript(`set -eu
cd /opt/gsa-tv/control-plane
grep -n -A35 -B8 'for (const layer of' src/app.js | head -n 80
grep -n -A8 -B8 'live_badge' src/app.js || true
`);
process.stdout.write(result.stdout);
