import { runSshScript } from './ssh2-run.mjs';

const cmd = `
cat /home/opc/gsa-program-builder/full-integration-test-api.json
`;

try {
  const res = await runSshScript(cmd, 30000);
  console.log(res.stdout);
  if (res.stderr) console.error('STDERR:', res.stderr);
} catch (e) {
  console.error('ERROR:', e);
}
