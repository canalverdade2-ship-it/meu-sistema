import fs from 'node:fs';
import path from 'node:path';
import { Client } from 'ssh2';
import { readInfraKey } from './ssh2-run.mjs';

const remoteDir = '/home/opc/gsa-ai/qc/fish-voices/auditions-2026-09-05';
const localDir = path.resolve('artifacts/gsa-tv/painel-audicao-vozes-2026-09-05');
fs.mkdirSync(localDir, { recursive: true });

const conn = new Client();
conn.on('ready', () => {
  conn.sftp((error, sftp) => {
    if (error) throw error;
    sftp.readdir(remoteDir, async (listError, entries) => {
      if (listError) throw listError;
      const files = entries.filter((entry) => entry.filename.endsWith('.mp3') || entry.filename.endsWith('.html') || entry.filename === 'manifest.json');
      try {
        for (const entry of files) {
          await new Promise((resolve, reject) => {
            sftp.fastGet(`${remoteDir}/${entry.filename}`, path.join(localDir, entry.filename), (downloadError) => downloadError ? reject(downloadError) : resolve());
          });
        }
        console.log(`${files.length} arquivos copiados para ${localDir}`);
        conn.end();
      } catch (downloadError) {
        console.error(downloadError);
        conn.end();
        process.exitCode = 1;
      }
    });
  });
});
conn.on('error', (error) => { console.error(error); process.exitCode = 1; });
conn.connect({ host: '147.15.43.141', port: 22, username: 'opc', privateKey: readInfraKey(), readyTimeout: 15000 });
