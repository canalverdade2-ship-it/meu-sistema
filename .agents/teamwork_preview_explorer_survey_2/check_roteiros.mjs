import { runSshScript } from '../../scratch/ssh2-run.mjs';

async function main() {
  const script = `
echo "=== ROTEIROS SOURCES JSON ==="
cat /home/opc/gsa-ai/work/roteiros-2026-09-15/production-sources.json 2>/dev/null

echo "=== ROTEIROS DIRECTORY ==="
ls -la /home/opc/gsa-ai/work/roteiros-2026-09-15/ 2>/dev/null
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
