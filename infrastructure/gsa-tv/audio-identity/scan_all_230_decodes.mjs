import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { Client } from 'ssh2';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const SSH_KEY_PATH = 'C:/Users/Adriano Farias/Downloads/CLOUD/ssh-key-2026-07-30.key';
const privateKey = fs.readFileSync(SSH_KEY_PATH);

const remoteScript = `
const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');

const BASE = '/opt/gsa-tv/cache/media/1/identity/audio';
const cats = ['news', 'viral', 'faith', 'lifestyle', 'sfx'];
let total = 0, clean = 0;
const errors = [];

for (const c of cats) {
  const dir = path.join(BASE, c);
  const files = fs.readdirSync(dir).filter(f => f.endsWith('.mp3') || f.endsWith('.wav'));
  for (const f of files) {
    total++;
    const p = path.join(dir, f);
    const res = spawnSync('ffmpeg', ['-v', 'error', '-i', p, '-f', 'null', '-'], { encoding: 'utf8', timeout: 30000 });
    const err = (res.stderr || '').trim();
    if (err.length > 0) {
      errors.push({ file: c + '/' + f, error: err });
      console.log('[DECODE_ERR] ' + c + '/' + f + ' -> ' + err.replace(/\\n/g, ' | '));
    } else {
      clean++;
    }
  }
}
console.log('SCAN SUMMARY: total=' + total + ', clean=' + clean + ', errors=' + errors.length);
fs.writeFileSync('/tmp/all_decode_errors.json', JSON.stringify(errors, null, 2));
`;

const conn = new Client();
conn.on('ready', () => {
  const b64 = Buffer.from(remoteScript).toString('base64');
  conn.exec(`echo '${b64}' | base64 -d > /tmp/scan230.js && node /tmp/scan230.js`, (err, stream) => {
    if (err) throw err;
    stream.on('data', d => process.stdout.write(d));
    stream.stderr.on('data', d => process.stderr.write(d));
    stream.on('close', code => {
      conn.end();
      process.exit(code);
    });
  });
}).connect({
  host: '147.15.43.141',
  port: 22,
  username: 'opc',
  privateKey
});
