import fs from 'node:fs';
import path from 'node:path';
import { Client } from 'ssh2';
import { readInfraKey } from './ssh2-run.mjs';

const [remotePath, localPath] = process.argv.slice(2);
if (!remotePath || !localPath) throw new Error('Uso: node download-vps-file.mjs REMOTO LOCAL');
fs.mkdirSync(path.dirname(localPath), { recursive: true });
const conn = new Client();
conn.on('ready', () => conn.sftp((error, sftp) => {
  if (error) throw error;
  sftp.fastGet(remotePath, localPath, (downloadError) => {
    conn.end();
    if (downloadError) throw downloadError;
    console.log(localPath);
  });
}));
conn.connect({ host: '147.15.43.141', port: 22, username: 'opc', privateKey: readInfraKey(), readyTimeout: 15000 });
