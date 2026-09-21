import { runSshScript } from '../../scratch/ssh2-run.mjs';

async function main() {
  const script = `
echo "=== LS -LA /opt/gsa-tv/runtime/ ==="
ls -la /opt/gsa-tv/runtime/
echo "=== LS -LA /opt/gsa-tv/runtime/production/ ==="
ls -la /opt/gsa-tv/runtime/production/

echo "=== NIGHT-PRODUCTION PROCESS FDs (PID 3804468) ==="
ls -l /proc/3804468/fd/ 2>/dev/null

echo "=== NIGHT-PRODUCTION PROCESS CMDLINE ==="
tr '\\0' ' ' < /proc/3804468/cmdline 2>/dev/null
echo ""

echo "=== NIGHT-PRODUCTION.PY ARGPARSE & LOGGING CODE ==="
grep -n -C 5 -E "log|execution|date|broadcast" /opt/gsa-tv/bin/night-production.py | head -50
`;

  try {
    const res = await runSshScript(script);
    console.log(res.stdout);
    if (res.stderr) console.error("STDERR:", res.stderr);
  } catch (err) {
    console.error("ERROR:", err);
  }
}

main();
