import { runSshScript } from './ssh2-run.mjs';

const cmd = `
cat /opt/gsa-tv/control-plane/src/production-package.js
`;

try {
  const res = await runSshScript(cmd, 30000);
  console.log(res.stdout);
  if (res.stderr) console.error('STDERR:', res.stderr);
} catch (e) {
  console.error('ERROR:', e);
}
