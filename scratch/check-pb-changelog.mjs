import { runSshScript } from './ssh2-run.mjs';

const cmd = `
sed -n '2350,2400p' /home/opc/gsa-ai/GSA_TV_MEMORY_CHANGELOG.md.bak-20260908
`;

try {
  const res = await runSshScript(cmd, 30000);
  console.log(res.stdout);
  if (res.stderr) console.error('STDERR:', res.stderr);
} catch (e) {
  console.error('ERROR:', e);
}
