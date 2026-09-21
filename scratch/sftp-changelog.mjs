import fs from 'node:fs';
import { Client } from 'ssh2';
import { readInfraKey } from './ssh2-run.mjs';

const mode = process.argv[2];
const local = new URL('./GSA_TV_MEMORY_CHANGELOG.remote.md', import.meta.url);
const remote = '/home/opc/gsa-ai/GSA_TV_MEMORY_CHANGELOG.md';

await new Promise((resolve, reject) => {
  const conn = new Client();
  conn.on('ready', () => conn.sftp((error, sftp) => {
    if (error) return reject(error);
    const done = (err) => { conn.end(); err ? reject(err) : resolve(); };
    if (mode === 'get') sftp.fastGet(remote, local, done);
    else if (mode === 'put') sftp.fastPut(local, remote, done);
    else done(new Error('Use get or put'));
  }));
  conn.on('error', reject);
  conn.connect({host:'147.15.43.141',port:22,username:'opc',privateKey:readInfraKey(),readyTimeout:15000});
});
console.log(`${mode} ok: ${fs.statSync(local).size} bytes`);
