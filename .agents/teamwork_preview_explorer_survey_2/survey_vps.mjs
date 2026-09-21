import { runSshScript } from '../../scratch/ssh2-run.mjs';

async function main() {
  const script = `
echo "=== FINDING 2026-09-15 FILES ==="
find /opt/gsa-tv /home/opc /tmp -name "*2026-09-15*" 2>/dev/null

echo "=== LS -LA /opt/gsa-tv/logs/ ==="
ls -la /opt/gsa-tv/logs/ 2>/dev/null

echo "=== LS -LA /opt/gsa-tv/ ==="
ls -la /opt/gsa-tv/ 2>/dev/null

echo "=== RUNNING PROCESSES (python / night / gsa) ==="
ps aux | grep -E "python|night|gsa" | grep -v grep
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
