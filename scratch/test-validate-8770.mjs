import { runSshScript } from './ssh2-run.mjs';

const cmd = `
curl -s -X POST -H "Content-Type: application/json" -d @/home/opc/gsa-program-builder/examples/teste-curto-gsa-agro.json http://127.0.0.1:8770/validate
`;

try {
  const res = await runSshScript(cmd, 30000);
  console.log(res.stdout);
  if (res.stderr) console.error('STDERR:', res.stderr);
} catch (e) {
  console.error('ERROR:', e);
}
