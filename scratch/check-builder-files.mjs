import { runSshScript } from './ssh2-run.mjs';

const cmd = `
ls -la /home/opc/gsa-program-builder/
ls -la /home/opc/gsa-program-builder/jobs/ 2>/dev/null || true
`;

try {
  const res = await runSshScript(cmd, 30000);
  console.log(res.stdout);
  if (res.stderr) console.error('STDERR:', res.stderr);
} catch (e) {
  console.error('ERROR:', e);
}
