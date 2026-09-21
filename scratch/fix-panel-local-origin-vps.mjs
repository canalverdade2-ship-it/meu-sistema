import { Client } from 'ssh2';
import { readInfraKey, runSshScript } from './ssh2-run.mjs';

const envPath = '/opt/gsa-tv/control-plane/.env';
function prepare() {
  return new Promise((resolve, reject) => {
    const conn = new Client();
    conn.on('ready', () => conn.sftp((err, sftp) => {
      if (err) return reject(err);
      sftp.readFile(envPath, (readErr, buf) => {
        if (readErr) { conn.end(); return reject(readErr); }
        const body = buf.toString('utf8');
        const origin = 'http://10.0.2.189:3000';
        const match = body.match(/^ALLOWED_ORIGINS=(.*)$/m);
        if (!match) { conn.end(); return reject(new Error('ALLOWED_ORIGINS not found')); }
        const values = match[1].split(',').map(x => x.trim()).filter(Boolean);
        if (!values.includes(origin)) values.push(origin);
        const updated = body.replace(/^ALLOWED_ORIGINS=.*$/m, `ALLOWED_ORIGINS=${values.join(',')}`);
        sftp.writeFile('/tmp/gsa-control-plane-env-local-origin', updated, { mode: 0o600 }, writeErr => {
          conn.end();
          if (writeErr) reject(writeErr); else resolve();
        });
      });
    }));
    conn.on('error', reject);
    conn.connect({ host: '147.15.43.141', port: 22, username: 'opc', privateKey: readInfraKey(), readyTimeout: 15000 });
  });
}

await prepare();
const result = await runSshScript(`set -e
stamp=$(date -u +%Y%m%dT%H%M%SZ)
sudo cp /opt/gsa-tv/control-plane/.env /opt/gsa-tv/control-plane/.env.before-local-origin-$stamp
sudo install -o root -g root -m 0600 /tmp/gsa-control-plane-env-local-origin /opt/gsa-tv/control-plane/.env
rm -f /tmp/gsa-control-plane-env-local-origin
cd /opt/gsa-tv/control-plane
outer_before=$(sudo docker top gsa-tv-encoder-engine -eo pid,args | grep 'pipe:0' | grep 'rtmp://' | awk '{print $1}' | head -n 1)
sudo docker compose up -d --no-deps --force-recreate control-plane
sleep 3
outer_after=$(sudo docker top gsa-tv-encoder-engine -eo pid,args | grep 'pipe:0' | grep 'rtmp://' | awk '{print $1}' | head -n 1)
echo "control_plane=$(sudo docker inspect gsa-tv-control-plane --format '{{.Config.Image}}|{{.State.Status}}')"
sudo docker inspect gsa-tv-control-plane --format '{{range .Config.Env}}{{println .}}{{end}}' | grep '^ALLOWED_ORIGINS='
echo "outer_preserved=$([ "$outer_before" = "$outer_after" ] && echo true || echo false)"
echo "rtmp_publishers=$(sudo docker top gsa-tv-encoder-engine -eo pid,args | grep -c '[a]\.rtmp\.youtube\.com/live2' || true)"
curl -ski -X OPTIONS 'https://api.147-15-43-141.nip.io/gsa-tv/live-console/snapshot' -H 'Origin: http://10.0.2.189:3000' -H 'Access-Control-Request-Method: GET' -H 'Access-Control-Request-Headers: x-gsa-session-id,x-gsa-session-token' | head -n 16
`, 60000);
process.stdout.write(result.stdout || '');
process.stderr.write(result.stderr || '');
