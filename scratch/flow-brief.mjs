import { runSshScript } from './ssh2-run.mjs';
const result = await runSshScript(`set -e
python3 - <<'PY'
import json
p='/home/opc/gsa-ai/work/identity-flow-20260907/slow-state.json'
d=json.load(open(p))
print('done',len(d.get('done',[])),'failed',d.get('failed',[]),'complete',d.get('generation_complete'), 'updated',d.get('updated_at'))
print('tail_done',d.get('done',[])[-6:])
PY
tail -n 15 /home/opc/gsa-ai/work/identity-flow-20260907/slow-run.log
echo PROCESS
pgrep -af '[f]low-slow-complete.cjs' || true
`,30000);
process.stdout.write(result.stdout||'');
