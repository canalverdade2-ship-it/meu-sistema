import {runSshScript} from './ssh2-run.mjs';
const sh=String.raw`set -euo pipefail
for f in /home/opc/gsa-ai/set_voice_current.js /home/opc/gsa-ai/fill_vids_narrations.js /home/opc/gsa-ai/create_vids_project.js /home/opc/gsa-ai/vids_create_project.js; do if [ -f "$f" ]; then echo "=== $f ==="; sed -n '1,240p' "$f"; fi; done
`;
const r=await runSshScript(sh,60000);process.stdout.write(r.stdout);if(r.stderr)process.stderr.write(r.stderr);
