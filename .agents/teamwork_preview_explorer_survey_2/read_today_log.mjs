import { runSshScript } from '../../scratch/ssh2-run.mjs';

async function main() {
  const script = `
echo "=== CAT /opt/gsa-tv/runtime/production/2026-09-15-execution.log ==="
cat /opt/gsa-tv/runtime/production/2026-09-15-execution.log

echo ""
echo "=== CAT /opt/gsa-tv/runtime/production/2026-09-15.json ==="
cat /opt/gsa-tv/runtime/production/2026-09-15.json

echo ""
echo "=== CURRENT PROCESS TREE (night-production) ==="
pstree -ap 3870456 2>/dev/null || ps -ef | grep -E "3870456|daily-scripts|gsa" | grep -v grep
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
