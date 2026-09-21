import { Client } from 'ssh2';
import { readInfraKey, runSshScript } from './ssh2-run.mjs';

const appPath = '/opt/gsa-tv/control-plane/src/app.js';
const composePath = '/opt/gsa-tv/control-plane/compose.yml';
const oldFilter = 'aresample=48000:async=1:min_hard_comp=0.100:first_pts=0,alimiter=limit=0.89:attack=5:release=50:level=false';
const newFilter = 'aresample=48000:first_pts=0,alimiter=limit=0.89:attack=5:release=50:level=false';

function editRemote() {
  return new Promise((resolve, reject) => {
    const conn = new Client();
    conn.on('ready', () => conn.sftp((err, sftp) => {
      if (err) return reject(err);
      const read = (path) => new Promise((res, rej) => sftp.readFile(path, (e, b) => e ? rej(e) : res(b.toString('utf8'))));
      const write = (path, body) => new Promise((res, rej) => sftp.writeFile(path, body, { mode: 0o644 }, e => e ? rej(e) : res()));
      Promise.all([read(appPath), read(composePath)]).then(async ([app, compose]) => {
        if (!app.includes(oldFilter) && !app.includes(newFilter)) throw new Error('Audio filter marker not found');
        const updatedApp = app.includes(oldFilter) ? app.replace(oldFilter, newFilter) : app;
        const updatedCompose = compose.replace('gsa-tv/control-plane:1.8.2', 'gsa-tv/control-plane:1.8.3');
        await write('/tmp/gsa-app-audio-clock-fix.js', updatedApp);
        await write('/tmp/gsa-compose-audio-clock-fix.yml', updatedCompose);
        conn.end();
        resolve();
      }).catch(e => { conn.end(); reject(e); });
    }));
    conn.on('error', reject);
    conn.connect({ host: '147.15.43.141', port: 22, username: 'opc', privateKey: readInfraKey(), readyTimeout: 15000 });
  });
}

await editRemote();
const result = await runSshScript(`set -e
stamp=$(date -u +%Y%m%dT%H%M%SZ)
sudo cp /opt/gsa-tv/control-plane/src/app.js /opt/gsa-tv/control-plane/src/app.js.before-audio-clock-fix-$stamp
sudo cp /opt/gsa-tv/control-plane/compose.yml /opt/gsa-tv/control-plane/compose.yml.before-audio-clock-fix-$stamp
sudo install -o root -g root -m 0644 /tmp/gsa-app-audio-clock-fix.js /opt/gsa-tv/control-plane/src/app.js
sudo install -o root -g root -m 0644 /tmp/gsa-compose-audio-clock-fix.yml /opt/gsa-tv/control-plane/compose.yml
rm -f /tmp/gsa-app-audio-clock-fix.js /tmp/gsa-compose-audio-clock-fix.yml
sudo grep -n 'aresample=48000' /opt/gsa-tv/control-plane/src/app.js | head -n 3
sudo grep -n 'image:' /opt/gsa-tv/control-plane/compose.yml | head -n 3
`, 30000);
process.stdout.write(result.stdout || '');
