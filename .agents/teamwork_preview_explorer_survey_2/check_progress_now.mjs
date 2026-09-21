import { runSshScript } from '../../scratch/ssh2-run.mjs';

async function main() {
  const script = `
echo "=== LOG FILE SIZE & MODIFICATION TIME ==="
ls -l /opt/gsa-tv/runtime/production/2026-09-15-execution.log

echo ""
echo "=== TAIL LOG ==="
tail -n 50 /opt/gsa-tv/runtime/production/2026-09-15-execution.log

echo ""
echo "=== STATE JSON ==="
cat /opt/gsa-tv/runtime/production/2026-09-15.json

echo ""
echo "=== RUNNING PROCESSES ==="
ps -ef | grep -E "video_assembler|ffmpeg|night-production|gsa-tts-engine" | grep -v grep
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
