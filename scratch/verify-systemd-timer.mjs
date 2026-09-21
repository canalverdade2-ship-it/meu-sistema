import { runSshScript } from './ssh2-run.mjs';

const cmd = `
sudo systemctl daemon-reload
sudo systemctl enable --now gsa-tv-night-factory.timer
sudo systemctl is-active gsa-tv-night-factory.timer
sudo systemctl is-enabled gsa-tv-night-factory.timer
systemctl list-timers | grep -E "gsa-tv|ACTIVATES"
`;

try {
  const res = await runSshScript(cmd, 30000);
  console.log(res.stdout);
  if (res.stderr) console.error('STDERR:', res.stderr);
} catch (e) {
  console.error('ERROR:', e);
}
