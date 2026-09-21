import { runSshScript } from './ssh2-run.mjs';

const cmd = `
find /home/opc/gsa-program-builder/ -name "*.json" -not -path "*/cache/*" -not -path "*/jobs/*"
`;

try {
  const res = await runSshScript(cmd, 30000);
  console.log(res.stdout);
  if (res.stderr) console.error('STDERR:', res.stderr);
} catch (e) {
  console.error('ERROR:', e);
}
