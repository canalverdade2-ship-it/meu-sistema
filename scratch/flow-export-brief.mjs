import { runSshScript } from './ssh2-run.mjs';
const result=await runSshScript(`set -e
base=/home/opc/gsa-ai/work/identity-flow-20260907
pgrep -af '[f]low-export-project.cjs' || true
tail -n 30 "$base/export-ac1da.log" 2>/dev/null || true
if test -f "$base/export-ac1da.json"; then
python3 - <<'PY'
import json
p='/home/opc/gsa-ai/work/identity-flow-20260907/export-ac1da.json'
d=json.load(open(p));print('COUNT',len(d),'WITH_URL',sum(bool(v.get('video_url')) for v in d.values()),'KINDS',sum(v.get('kind')=='opening' for v in d.values()),sum(v.get('kind')=='closing' for v in d.values()))
PY
fi
`,30000);
process.stdout.write(result.stdout||'');
