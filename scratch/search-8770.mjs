import { runSshScript } from './ssh2-run.mjs';

const cmd = `
grep -rn "8770" /opt/gsa-tv/bin/ || true
grep -rn "8770" /opt/gsa-tv/control-plane/ || true
grep -rn "8770" /home/opc/gsa-ai/ || true
`;

try {
  const res = await runSshScript(cmd, 30000);
  console.log(res.stdout);
  if (res.stderr) console.error('STDERR:', res.stderr);
} catch (e) {
  console.error('ERROR:', e);
}
