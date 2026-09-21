import { runSshScript } from './ssh2-run.mjs';

const remoteScript = `
node -e "
const fs = require('fs'), crypto = require('crypto');
const v = JSON.parse(fs.readFileSync('/home/opc/gsa-ai/secrets/google-production.enc.json', 'utf8'));
const key = Buffer.from('06edbcf3aa196b06c030568b1b4954f5df7484f3c3910e5341b9bd7756b69362', 'hex');
const nonce = Buffer.from(v.nonce, 'base64url'), all = Buffer.from(v.ciphertext, 'base64url'), tag = all.subarray(-16), body = all.subarray(0, -16);
const d = crypto.createDecipheriv('aes-256-gcm', key, nonce);
d.setAAD(Buffer.from(v.aad));
d.setAuthTag(tag);
const cred = JSON.parse(Buffer.concat([d.update(body), d.final()]).toString('utf8'));
console.log('Cred email:', cred.email);
console.log('Cred password length:', cred.password.length);
console.log('Cred password hint:', cred.password.slice(0, 3) + '***' + cred.password.slice(-2));
"
`;

const res = await runSshScript(remoteScript, 30000);
console.log(res.stdout);
if (res.stderr) console.error(res.stderr);
