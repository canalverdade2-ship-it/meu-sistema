import { runSshScript } from './ssh2-run.mjs';

const cmd = `
echo '=== 1. /home/opc/gsa-ai/work/night-factory-20260910/ ==='
ls -la /home/opc/gsa-ai/work/night-factory-20260910/
echo '=== 2. GSA_TV_MEMORY_CHANGELOG.md ==='
tail -n 40 /home/opc/gsa-ai/GSA_TV_MEMORY_CHANGELOG.md || true
echo '=== 3. grep prepare_production_packages in control-plane ==='
grep -rn "prepare_production_packages" /opt/gsa-tv/control-plane/src/
echo '=== 4. builder.py rest of code ==='
tail -n +81 /home/opc/gsa-program-builder/builder.py | head -n 80
`;

try {
  const res = await runSshScript(cmd, 30000);
  console.log(res.stdout);
  if (res.stderr) console.error('STDERR:', res.stderr);
} catch (e) {
  console.error('ERROR:', e);
}
