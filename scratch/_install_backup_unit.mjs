import { runSshScript } from './ssh2-run.mjs';
const script = `sudo install -m 0644 -o root -g root /tmp/gsa-tv-backup.service /etc/systemd/system/gsa-tv-backup.service
sudo systemctl daemon-reload
sudo systemctl enable --now gsa-tv-backup.timer
sudo systemctl start gsa-tv-backup.service
sudo systemctl status gsa-tv-backup.service --no-pager | head -20
sudo systemctl status gsa-tv-backup.timer --no-pager | head -15
`;
const r = await runSshScript(script, 1200000);
process.stdout.write(r.stdout);
if (r.stderr) process.stderr.write(r.stderr);
