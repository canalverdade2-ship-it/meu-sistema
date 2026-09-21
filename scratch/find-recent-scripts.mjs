import { runSshScript } from './ssh2-run.mjs';
const script = `
echo "=== History search ==="
grep -E 'manha-news|historias-da-biblia|program-masters' /home/opc/.bash_history 2>/dev/null | tail -20 || true
echo "=== Files modified Sep 9 in /home/opc/gsa-ai ==="
find /home/opc/gsa-ai/ -maxdepth 3 -type f -newermt "2026-09-09 00:00:00" ! -path '*/.*' ! -name '*.png' ! -name '*.jpg' | head -40
`;
const res = await runSshScript(script, 60000);
console.log(res.stdout);
if (res.stderr) console.error(res.stderr);
