import { runSshScript } from './ssh2-run.mjs';

const cmd = `
sed -n '419,485p' /home/opc/gsa-program-builder/builder.py
`;

try {
  const res = await runSshScript(cmd, 30000);
  console.log(res.stdout);
  if (res.stderr) console.error('STDERR:', res.stderr);
} catch (e) {
  console.error('ERROR:', e);
}
