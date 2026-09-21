import { runSshScript } from './ssh2-run.mjs';

const result = await runSshScript(`set -e
base=/home/opc/gsa-ai/work/identity-flow-20260907
echo '---FILES---'
find "$base" -maxdepth 1 -type f -printf '%f %s bytes %TY-%Tm-%Td %TH:%TM:%TS\\n' | sort
echo '---STATE-SUMMARY---'
python3 - <<'PY'
import json
p='/home/opc/gsa-ai/work/identity-flow-20260907/slow-state.json'
d=json.load(open(p))
print('type=',type(d).__name__)
if isinstance(d,dict):
  print('keys=',sorted(d.keys()))
  for k,v in d.items():
    if isinstance(v,(str,int,float,bool)) or v is None: print(f'{k}={v}')
    elif isinstance(v,list): print(f'{k}: list[{len(v)}] tail={v[-5:]}')
    elif isinstance(v,dict): print(f'{k}: dict[{len(v)}]')
PY
echo '---LOG-TAIL---'
tail -n 35 "$base/slow-run.log" 2>/dev/null || true
echo '---PROCESS---'
pgrep -af 'flow-slow-complete|identity-flow' || true
echo '---SCRIPT-SIGNALS---'
grep -nE 'process\\.argv|slow-state|slow-run|setTimeout|sleep|PROGRAM|program|completed|pending|launch|connectOverCDP|credits|for \\(|while \\(' "$base/flow-slow-complete.cjs" | head -n 120
`, 30000);

process.stdout.write(result.stdout || '');
process.stderr.write(result.stderr || '');
