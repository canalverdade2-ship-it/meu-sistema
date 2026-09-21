import { runSshScript } from './ssh2-run.mjs';

const cmd = `
sudo cat /opt/gsa-tv/cache/media/1/production/night-test-agro-before-20260910.json | head -n 40
`;

try {
  const res = await runSshScript(cmd, 30000);
  console.log(res.stdout);
  if (res.stderr) console.error('STDERR:', res.stderr);
} catch (e) {
  console.error('ERROR:', e);
}
