import { runSshScript } from './ssh2-run.mjs';

const remoteScript = `
python3 -c "
import urllib.request, json
with open('/opt/gsa-tv/control-plane/secrets/ffplayout-admin-password') as f:
    pw = f.read().strip()
login = urllib.request.Request('http://127.0.0.1:8787/auth/login', data=json.dumps({'username': 'admin', 'password': pw}).encode(), headers={'Content-Type': 'application/json'})
with urllib.request.urlopen(login) as r:
    tok = json.loads(r.read().decode())['access']
req = urllib.request.Request('http://127.0.0.1:8787/api/control/1/status', headers={'Authorization': f'Bearer {tok}'})
with urllib.request.urlopen(req) as r:
    print('STATUS:', r.read().decode())
"
`;

const res = await runSshScript(remoteScript, 10000);
console.log(res.stdout);
if (res.stderr) console.error(res.stderr);
