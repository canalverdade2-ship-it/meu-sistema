import { runSshScript } from './ssh2-run.mjs';

const cmd = `
head -n 25 /opt/gsa-tv/bin/gsa-tv-night-factory.sh
`;

try {
  const res = await runSshScript(cmd, 30000);
  console.log(res.stdout);
  if (res.stderr) console.error('STDERR:', res.stderr);
} catch (e) {
  console.error('ERROR:', e);
}
