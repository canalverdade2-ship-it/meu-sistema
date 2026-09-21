import { runSshScript } from './ssh2-run.mjs';
const script=String.raw`set -euo pipefail
echo '=== workdir ==='
sudo find /tmp/gsa-tv-editorial -maxdepth 2 -type f -printf '%P|%s\n' 2>/dev/null | sort | head -40 || true
`;
const r=await runSshScript(script,60000);process.stdout.write(r.stdout);if(r.stderr)process.stderr.write(r.stderr);
