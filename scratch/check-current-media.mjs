import { runSshScript } from './ssh2-run.mjs';

const script = `
curl -s http://127.0.0.1:8787/api/control/1/media/current || true
echo ""
pass=$(sudo cat /opt/gsa-tv/control-plane/secrets/ffplayout-admin-password)
tok=$(curl -s -X POST http://127.0.0.1:8787/auth/login -H "Content-Type: application/json" -d "{\\"username\\":\\"admin\\",\\"password\\":\\"$pass\\"}" | jq -r .access)
echo "Current media:"
curl -s -H "Authorization: Bearer $tok" http://127.0.0.1:8787/api/control/1/media/current | jq .
`;

const res = await runSshScript(script);
console.log(res.stdout);
