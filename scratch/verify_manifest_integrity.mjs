import fs from 'node:fs';
import { runSshScript } from './ssh2-run.mjs';

const remoteCode = `
const fs = require('fs');
const crypto = require('crypto');
const dir = '/home/opc/gsa-ai/work/identity-flow-20260907/masters-final';
const manifestPath = dir + '/manifest.json';
const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));

console.log('Manifest entries:', manifest.length);

let errors = 0;
let checked = 0;

for (const item of manifest) {
  const req = ['program', 'piece_type', 'source', 'sha256', 'approved_at'];
  for (const r of req) {
    if (!item[r]) {
      console.error('Missing key ' + r, item);
      errors++;
    }
  }
}

const files = fs.readdirSync(dir).filter(f => f.endsWith('.mp4'));
console.log('MP4 files on disk:', files.length);

const diskHashes = {};
for (const f of files) {
  const buf = fs.readFileSync(dir + '/' + f);
  const hash = crypto.createHash('sha256').update(buf).digest('hex');
  diskHashes[hash] = f;
}

for (const item of manifest) {
  const foundFile = diskHashes[item.sha256];
  if (!foundFile) {
    console.error('Hash mismatch for ' + item.program + ' ' + item.piece_type + ': ' + item.sha256);
    errors++;
  } else {
    checked++;
  }
}

console.log('Checked:', checked, 'Errors:', errors);
if (errors === 0 && checked === 50) {
  console.log('ALL_50_HASHES_MATCH_PERFECTLY');
} else {
  console.error('VERIFICATION_FAILED');
}
`;

const enc = Buffer.from(remoteCode).toString('base64');
const res = await runSshScript(`node -e "eval(Buffer.from('${enc}', 'base64').toString('utf8'))"`, 60000);
console.log(res.stdout);
if (res.stderr) console.error(res.stderr);
