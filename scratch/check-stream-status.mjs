import { runSshScript } from './ssh2-run.mjs';

const cmd = `
TOKEN="e54c08df5a3b42c2967395833b9c7104b3c9e0cb5e0f6c67f8277e5ea2895b0b"
echo '=== ENCODER STATUS VIA CONTROL PLANE ==='
curl -s -H "Authorization: Bearer $TOKEN" http://127.0.0.1:9202/encoder/status
echo ""
echo '=== ENCODER DIRECT STATUS (PORT 9210) ==='
curl -s -H "Authorization: Bearer $TOKEN" http://127.0.0.1:9210/v1/status
echo ""
echo '=== YOUTUBE RTMP CONNECTION ==='
ss -tnp | grep 1935 || echo "No RTMP connection!"
echo ""
echo '=== CURRENT TIME ==='
date
date -u
`;

try {
  const res = await runSshScript(cmd, 30000);
  console.log(res.stdout);
  if (res.stderr) console.error('STDERR:', res.stderr);
} catch (e) {
  console.error('ERROR:', e);
}
