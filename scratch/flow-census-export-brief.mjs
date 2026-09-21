import { runSshScript } from './ssh2-run.mjs';
const result=await runSshScript(`set -e
base=/home/opc/gsa-ai/work/identity-flow-20260907
pgrep -af '[f]low-export-census.cjs' || true
tail -n 30 "$base/export-census.log" 2>/dev/null || true
python3 - <<'PY'
import json,os
p='/home/opc/gsa-ai/work/identity-flow-20260907/export-ac1da.json'
if os.path.exists(p):
 d=json.load(open(p));print('COUNT',len(d),'URL',sum(bool(x.get('video_url')) for x in d.values()),'OPEN',sum(x.get('kind')=='opening' for x in d.values()),'CLOSE',sum(x.get('kind')=='closing' for x in d.values()))
PY
`,30000);
process.stdout.write(result.stdout||'');
