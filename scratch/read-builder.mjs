import { runSshScript } from './ssh2-run.mjs';

const cmd = `
cat /home/opc/gsa-program-builder/builder.py | head -n 80
`;

try {
  const res = await runSshScript(cmd, 60000);
  console.log(res.stdout);
  if (res.stderr) console.error('STDERR:', res.stderr);
} catch (e) {
  console.error('ERROR:', e);
}
