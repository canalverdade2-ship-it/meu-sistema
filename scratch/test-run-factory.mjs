import { runSshScript } from './ssh2-run.mjs';

const cmd = `
sudo /opt/gsa-tv/bin/gsa-tv-night-factory.sh
`;

try {
  const res = await runSshScript(cmd, 60000);
  console.log(res.stdout);
  if (res.stderr) console.error('STDERR:', res.stderr);
} catch (e) {
  console.error('ERROR:', e);
}
