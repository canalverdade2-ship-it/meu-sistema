import fs from 'node:fs';
import path from 'node:path';
import { Client } from 'ssh2';
import { readInfraKey } from './ssh2-run.mjs';

const [mode, localArg, remote] = process.argv.slice(2);
if (!['get','put'].includes(mode) || !localArg || !remote) throw new Error('Usage: get|put local remote');
const local = path.resolve(localArg);
await new Promise((resolve, reject) => {
  const conn = new Client();
  conn.on('ready', () => conn.sftp((error, sftp) => {
    if (error) return reject(error);
    const done = (err) => { conn.end(); err ? reject(err) : resolve(); };
    mode === 'get' ? sftp.fastGet(remote, local, done) : sftp.fastPut(local, remote, done);
  }));
  conn.on('error', reject);
  conn.connect({host:'147.15.43.141',port:22,username:'opc',privateKey:readInfraKey(),readyTimeout:15000});
});
console.log(`${mode} ok: ${local} (${fs.statSync(local).size} bytes)`);
