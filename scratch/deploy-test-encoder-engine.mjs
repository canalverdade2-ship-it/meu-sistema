import fs from 'node:fs';
import path from 'node:path';
import { Client } from 'ssh2';
import { readInfraKey, runSshScript } from './ssh2-run.mjs';

const root = path.resolve('infrastructure/gsa-tv/services/encoder-engine');
const files = ['Dockerfile', 'package.json', 'src/app.js', 'encoder-client.js'];
function upload() {
  return new Promise((resolve, reject) => {
    const conn = new Client();
    conn.on('ready', () => conn.sftp((error, sftp) => {
      if (error) return reject(error);
      let pending = files.length;
      for (const rel of files) {
        const remote = `/tmp/gsa-encoder-${rel.replaceAll('/', '-')}`;
        sftp.fastPut(path.join(root, rel), remote, (err) => {
          if (err) { conn.end(); reject(err); return; }
          if (--pending === 0) { conn.end(); resolve(); }
        });
      }
    }));
    conn.on('error', reject);
    conn.connect({ host: '147.15.43.141', port: 22, username: 'opc', privateKey: readInfraKey(), readyTimeout: 15000 });
  });
}

await upload();
const script = String.raw`set -euo pipefail
sudo install -d -o root -g root -m 0755 /opt/gsa-tv/encoder-engine/src
sudo install -o root -g root -m 0644 /tmp/gsa-encoder-Dockerfile /opt/gsa-tv/encoder-engine/Dockerfile
sudo install -o root -g root -m 0644 /tmp/gsa-encoder-package.json /opt/gsa-tv/encoder-engine/package.json
sudo install -o root -g root -m 0644 /tmp/gsa-encoder-src-app.js /opt/gsa-tv/encoder-engine/src/app.js
sudo install -o root -g root -m 0755 /tmp/gsa-encoder-encoder-client.js /opt/gsa-tv/encoder-engine/encoder-client.js
sudo docker build -t gsa-tv/encoder-engine:1.0.0 /opt/gsa-tv/encoder-engine
sudo docker run --rm --entrypoint node gsa-tv/encoder-engine:1.0.0 --check /app/src/app.js
sudo docker run --rm -v /opt/gsa-tv/encoder-engine/encoder-client.js:/client.js:ro --entrypoint node node:20-bookworm-slim --check /client.js
sudo docker image inspect gsa-tv/encoder-engine:1.0.0 --format 'image|{{.Id}}'
`;
const result = await runSshScript(script, 240000);
process.stdout.write(result.stdout);
if (result.stderr) process.stderr.write(result.stderr);
