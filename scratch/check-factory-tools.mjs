import { runSshScript } from './ssh2-run.mjs';
const script = `
echo "=== Check populate_all_programs_v2.py ==="
head -n 50 /home/opc/gsa-ai/populate_all_programs_v2.py
echo "=== Check gsa-agro-master-manifest.json ==="
cat /home/opc/gsa-ai/work/gsa-agro-master-manifest.json
echo "=== Check render-engine or render scripts ==="
ls -la /home/opc/gsa-ai/render-engine/ /home/opc/gsa-ai/render-engine-v2/ 2>/dev/null || true
echo "=== Check program masters dir ==="
ls -la /opt/gsa-tv/cache/media/program-masters /opt/gsa-tv/cache/media/1/ 2>/dev/null || true
`;
const res = await runSshScript(script, 60000);
console.log(res.stdout);
if (res.stderr) console.error(res.stderr);
