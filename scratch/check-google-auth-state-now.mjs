import { runSshScript } from './ssh2-run.mjs';
const remote=String.raw`pkill -f '/home/opc/gsa-ai/restore-google-session.js' || true
curl -fsS http://127.0.0.1:9228/json/list > /tmp/gsa-tabs.json
python3 - <<'PY'
import json
d=json.load(open('/tmp/gsa-tabs.json'))
for x in d:
 u=x.get('url',''); t=x.get('title','')
 if 'google' in u or 'labs.google' in u: print(('AUTH_PENDING' if 'accounts.google' in u else 'AUTH_OK')+' | '+t+' | '+u.split('?')[0])
PY`;
const r=await runSshScript(remote,30000);process.stdout.write(r.stdout);if(r.stderr)process.stderr.write(r.stderr);
