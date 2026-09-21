import { Client } from 'ssh2';
import { readInfraKey, runSshScript } from './ssh2-run.mjs';

const appPath = '/opt/gsa-tv/control-plane/src/app.js';
const composePath = '/opt/gsa-tv/control-plane/compose.yml';
const oldBlock = `    "-c:a",
    "aac",
    "-b:a",
    "192k",
    "-ar",
    "48000",
    "-ac",
    "2",
    "-af",
    "aresample=48000:first_pts=0,alimiter=limit=0.89:attack=5:release=50:level=false",`;
const newBlock = `    "-c:a",
    "copy",`;

function prepare() {
  return new Promise((resolve, reject) => {
    const conn = new Client();
    conn.on('ready', () => conn.sftp((err, sftp) => {
      if (err) return reject(err);
      const read = p => new Promise((res, rej) => sftp.readFile(p, (e, b) => e ? rej(e) : res(b.toString('utf8'))));
      const write = (p, body) => new Promise((res, rej) => sftp.writeFile(p, body, { mode: 0o644 }, e => e ? rej(e) : res()));
      Promise.all([read(appPath), read(composePath)]).then(async ([app, compose]) => {
        if (!app.includes(oldBlock)) throw new Error('Expected encoded-audio block not found');
        const nextApp = app.replace(oldBlock, newBlock);
        if (nextApp.includes(oldBlock) || !nextApp.includes(newBlock)) throw new Error('Audio-copy replacement validation failed');
        const nextCompose = compose.replace('gsa-tv/control-plane:1.8.3', 'gsa-tv/control-plane:1.8.4');
        await write('/tmp/gsa-app-audio-copy.js', nextApp);
        await write('/tmp/gsa-compose-audio-copy.yml', nextCompose);
        conn.end(); resolve();
      }).catch(e => { conn.end(); reject(e); });
    }));
    conn.on('error', reject);
    conn.connect({ host: '147.15.43.141', port: 22, username: 'opc', privateKey: readInfraKey(), readyTimeout: 15000 });
  });
}

await prepare();
const result = await runSshScript(`set -e
stamp=$(date -u +%Y%m%dT%H%M%SZ)
sudo cp /opt/gsa-tv/control-plane/src/app.js /opt/gsa-tv/control-plane/src/app.js.before-audio-bitstream-copy-$stamp
sudo cp /opt/gsa-tv/control-plane/compose.yml /opt/gsa-tv/control-plane/compose.yml.before-audio-bitstream-copy-$stamp
sudo install -o root -g root -m 0644 /tmp/gsa-app-audio-copy.js /opt/gsa-tv/control-plane/src/app.js
sudo install -o root -g root -m 0644 /tmp/gsa-compose-audio-copy.yml /opt/gsa-tv/control-plane/compose.yml
rm -f /tmp/gsa-app-audio-copy.js /tmp/gsa-compose-audio-copy.yml
sudo sed -n '762,790p' /opt/gsa-tv/control-plane/src/app.js
sudo grep -n 'image:' /opt/gsa-tv/control-plane/compose.yml | head -n 2
`, 30000);
process.stdout.write(result.stdout || '');
