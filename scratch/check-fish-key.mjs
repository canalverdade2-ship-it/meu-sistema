import { runSshScript } from './ssh2-run.mjs';

const remoteScript = `
cat << 'EOF' > /tmp/check-fish.cjs
const fs = require('fs'), crypto = require('crypto');
const v = JSON.parse(fs.readFileSync('/home/opc/gsa-ai/secrets/fish-production.enc.json', 'utf8'));
const key = Buffer.from('06edbcf3aa196b06c030568b1b4954f5df7484f3c3910e5341b9bd7756b69362', 'hex');
const nonce = Buffer.from(v.nonce, 'base64url'), all = Buffer.from(v.ciphertext, 'base64url'), tag = all.subarray(-16), body = all.subarray(0, -16);
const d = crypto.createDecipheriv('aes-256-gcm', key, nonce);
d.setAAD(Buffer.from(v.aad));
d.setAuthTag(tag);
const secret = JSON.parse(Buffer.concat([d.update(body), d.final()]).toString('utf8'));
console.log('Fish Secret Keys:', Object.keys(secret));
EOF
node /tmp/check-fish.cjs
`;

const res = await runSshScript(remoteScript, 10000);
console.log(res.stdout);
if (res.stderr) console.error(res.stderr);
