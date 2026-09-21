import { runSshScript } from './ssh2-run.mjs';

const cmd = `
cat /etc/systemd/system/gsa-tv-signoff.service || true
echo "---"
cat /etc/systemd/system/gsa-tv-signoff.timer || true
`;

try {
  const res = await runSshScript(cmd, 30000);
  console.log(res.stdout);
  if (res.stderr) console.error('STDERR:', res.stderr);
} catch (e) {
  console.error('ERROR:', e);
}
