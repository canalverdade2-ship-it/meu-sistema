import { runSshScript } from '../../scratch/ssh2-run.mjs';

async function main() {
  const script = `
echo "=== FINDING 2026-09-15 FILES ==="
find /opt/gsa-tv /home/opc /tmp /var/log -name "*2026-09-15*" 2>/dev/null

echo "=== FINDING RECENT EXECUTION LOGS ==="
find /opt/gsa-tv /home/opc -name "*execution*.log" 2>/dev/null

echo "=== LS -LA /opt/gsa-tv/logs/ ==="
ls -lat /opt/gsa-tv/logs/ 2>/dev/null | head -30

echo "=== LS -LAT /opt/gsa-tv/ ==="
ls -lat /opt/gsa-tv/ 2>/dev/null | head -20
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
