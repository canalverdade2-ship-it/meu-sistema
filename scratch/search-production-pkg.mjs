import { runSshScript } from './ssh2-run.mjs';

const cmd = `
grep -rn "prepare_production_packages" /opt/gsa-tv/control-plane/src/ || true
grep -rn "8770" /opt/gsa-tv/control-plane/src/ || true
grep -rn "8770" /home/opc/gsa-ai/ || true
`;

try {
  const res = await runSshScript(cmd, 60000);
  console.log(res.stdout);
  if (res.stderr) console.error('STDERR:', res.stderr);
} catch (e) {
  console.error('ERROR:', e);
}
