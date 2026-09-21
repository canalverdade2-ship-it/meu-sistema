import fs from 'node:fs';
import { Client } from 'ssh2';
import { readInfraKey } from './ssh2-run.mjs';

const [remotePath, localPath] = process.argv.slice(2);
if (!remotePath || !localPath) throw new Error('Uso: node scratch/fetch-vps-file.mjs REMOTO LOCAL');

await new Promise((resolve, reject) => {
  const conn = new Client();
  conn.on('ready', () => conn.sftp((error, sftp) => {
    if (error) return reject(error);
    sftp.fastGet(remotePath, localPath, (copyError) => {
      conn.end();
      if (copyError) reject(copyError);
      else resolve();
    });
  }));
  conn.on('error', reject);
  conn.connect({ host: '147.15.43.141', port: 22, username: 'opc', privateKey: readInfraKey(), readyTimeout: 15000 });
});

process.stdout.write(`${fs.statSync(localPath).size}\n`);
