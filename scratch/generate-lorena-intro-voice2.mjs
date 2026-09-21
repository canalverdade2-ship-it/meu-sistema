import { runSshScript } from './ssh2-run.mjs';

const remoteScript = `
node -e "
const fs = require('fs'), crypto = require('crypto'), https = require('https');
const v = JSON.parse(fs.readFileSync('/home/opc/gsa-ai/secrets/fish-production.enc.json', 'utf8'));
const key = Buffer.from('06edbcf3aa196b06c030568b1b4954f5df7484f3c3910e5341b9bd7756b69362', 'hex');
const nonce = Buffer.from(v.nonce, 'base64url'), all = Buffer.from(v.ciphertext, 'base64url'), tag = all.subarray(-16), body = all.subarray(0, -16);
const d = crypto.createDecipheriv('aes-256-gcm', key, nonce);
d.setAAD(Buffer.from(v.aad));
d.setAuthTag(tag);
const apiKey = JSON.parse(Buffer.concat([d.update(body), d.final()]).toString('utf8')).api_key;

const text = 'Olá! Sejam muito bem-vindos ao GSA Sabor! Eu sou a Chef Lorena Prado e hoje preparei um cardápio especial repleto de receitas incríveis para você. Fiquem conosco e bom apetite!';

const reqData = JSON.stringify({
  text: text,
  reference_id: '17b4cb89ff8e41bbb3f4ab59ea48df9e',
  format: 'mp3',
  normalize: true,
  latency: 'normal',
  prosody: { speed: 1.0, volume: 0, normalize_loudness: true }
});

const req = https.request({
  hostname: 'api.fish.audio',
  path: '/v1/tts',
  method: 'POST',
  headers: {
    'Authorization': 'Bearer ' + apiKey,
    'Content-Type': 'application/json',
    'model': 's2.1-pro-free',
    'Content-Length': Buffer.byteLength(reqData)
  }
}, res => {
  console.log('Fish Status:', res.statusCode);
  const chunks = [];
  res.on('data', c => chunks.push(c));
  res.on('end', () => {
    const buf = Buffer.concat(chunks);
    fs.writeFileSync('/home/opc/gsa-ai/qc/chef-lorena-intro-voice.mp3', buf);
    console.log('SUCCESS! Saved /home/opc/gsa-ai/qc/chef-lorena-intro-voice.mp3, size:', buf.length);
  });
});
req.on('error', e => console.error('Fish Req Error:', e.message));
req.write(reqData);
req.end();
"
`;

const res = await runSshScript(remoteScript, 30000);
console.log(res.stdout);
if (res.stderr) console.error(res.stderr);
