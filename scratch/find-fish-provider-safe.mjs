import { runSshScript } from './ssh2-run.mjs';
const remote=String.raw`python3 - <<'PY'
import os,re
for root,ds,fs in os.walk('/home/opc'):
 if any(x in root for x in ['/node_modules/','/.cache/','/cache/']): ds[:]=[]; continue
 for f in fs:
  if f.endswith(('.env','.json','.toml','.yaml','.yml','.js','.mjs','.py','.md')):
   p=os.path.join(root,f)
   try:s=open(p,encoding='utf-8',errors='ignore').read()
   except:continue
   if re.search(r'fish.?audio|fish.?speech|api\.fish',s,re.I): print(p)
PY
sudo docker exec gsa-tv-control-plane sh -lc "env | cut -d= -f1 | grep -i fish || true"`;
const r=await runSshScript(remote,60000);process.stdout.write(r.stdout);
