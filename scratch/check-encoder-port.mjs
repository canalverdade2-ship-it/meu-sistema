import { runSshScript } from './ssh2-run.mjs';

const cmd = `
sudo ss -tulpn | grep 9210 || true
sudo systemctl list-units | grep -i encoder || true
`;

try {
  const res = await runSshScript(cmd, 30000);
  console.log(res.stdout);
  if (res.stderr) console.error('STDERR:', res.stderr);
} catch (e) {
  console.error('ERROR:', e);
}
