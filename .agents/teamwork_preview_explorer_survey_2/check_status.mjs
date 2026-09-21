import { runSshScript } from '../../scratch/ssh2-run.mjs';

async function main() {
  const script = `
echo "=== LOG CONTENT ==="
cat /opt/gsa-tv/runtime/production/2026-09-15-execution.log

echo ""
echo "=== STATE JSON ==="
cat /opt/gsa-tv/runtime/production/2026-09-15.json

echo ""
echo "=== RUNNING PROCESSES ==="
ps -ef | grep -E "python|ffmpeg|night" | grep -v grep
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
