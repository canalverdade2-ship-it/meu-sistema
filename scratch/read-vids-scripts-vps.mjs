import { runSshScript } from './ssh2-run.mjs';
const r=await runSshScript(`set -euo pipefail
for f in /home/opc/gsa-ai/create_vids_02sep.js /home/opc/gsa-ai/fill_vids_narrations.js /home/opc/gsa-ai/set_voice_current.js /home/opc/gsa-ai/edit_narration_script_mode.js; do echo "===== $f ====="; sed -n '1,280p' "$f"; done
`,180000);
process.stdout.write(r.stdout); if(r.stderr)process.stderr.write(r.stderr);
