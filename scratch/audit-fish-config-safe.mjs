import { runSshScript } from './ssh2-run.mjs';
const remote=String.raw`python3 - <<'PY'
import re
for p in ['/home/opc/gsa-ai/GSA_TV_MEMORY_CHANGELOG.md','/home/opc/gsa-ai/GSA_TV_MEMORY_MASTER.md']:
 s=open(p,encoding='utf-8',errors='ignore').read()
 lines=[x for x in s.splitlines() if re.search(r'fish',x,re.I)]
 for x in lines:
  x=re.sub(r'(?i)(token|key|senha|password)(\s*[:=]\s*)\S+',r'\1\2<redacted>',x)
  x=re.sub(r'Bearer\s+\S+','Bearer <redacted>',x,flags=re.I)
  print(p,':',x[:500])
print('candidate_secret_present', bool(re.search(r'fish.{0,200}(token|key|senha|password)',open('/home/opc/gsa-ai/GSA_TV_MEMORY_CHANGELOG.md',encoding='utf-8',errors='ignore').read(),re.I|re.S)))
PY`;
const r=await runSshScript(remote,30000);process.stdout.write(r.stdout);
