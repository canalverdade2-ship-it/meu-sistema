import fs from 'node:fs';
import path from 'node:path';
import { Client } from 'ssh2';

const VPS_HOST = '147.15.43.141';
const VPS_USER = 'opc';
const VPS_KEY_PATH = 'C:/Users/Adriano Farias/Downloads/CLOUD/ssh-key-2026-07-30.key';

async function main() {
  const conn = new Client();
  const privateKey = fs.readFileSync(VPS_KEY_PATH);

  await new Promise((resolve, reject) => {
    conn.on('ready', resolve);
    conn.on('error', reject);
    conn.connect({
      host: VPS_HOST,
      port: 22,
      username: VPS_USER,
      privateKey
    });
  });

  console.log('SSH Connection Established.');

  const localScriptPath = 'infrastructure/gsa-tv/scripts/night-production.py';
  const remoteScriptPath = '/opt/gsa-tv/bin/night-production.py';
  const localAutoScript = 'infrastructure/gsa-tv/scripts/autonomous-script.cjs';
  const remoteAutoScript = '/opt/gsa-tv/bin/autonomous-script.cjs';
  const localRenderScript = 'infrastructure/gsa-tv/scripts/render-generic-program.py';
  const remoteRenderScript = '/opt/gsa-tv/bin/render-generic-program.py';

  const transfer = (local, remote) => new Promise((resolve, reject) => {
    const tmpRemote = '/tmp/' + path.basename(local);
    conn.sftp((err, sftp) => {
      if (err) return reject(err);
      sftp.fastPut(local, tmpRemote, { mode: 0o755 }, (err) => {
        if (err) return reject(err);
        conn.exec(`sudo mv ${tmpRemote} ${remote} && sudo chmod +x ${remote}`, (err, stream) => {
          if (err) return reject(err);
          stream.on('close', code => code === 0 ? resolve() : reject(new Error('mv failed'))).stderr.on('data', d => console.error(d.toString()));
        });
      });
    });
  });

  console.log('Transferring scripts...');
  await transfer(localScriptPath, remoteScriptPath);
  await transfer(localAutoScript, remoteAutoScript);
  await transfer(localRenderScript, remoteRenderScript);
  console.log('Scripts transferred.');
  conn.end();
}

main().catch(console.error);
