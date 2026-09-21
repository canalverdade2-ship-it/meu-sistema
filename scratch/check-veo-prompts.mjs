import { runSshScript } from './ssh2-run.mjs';

async function main() {
  const script = `
cat /opt/gsa-tv/cache/media/1/news/gsa-news-2026-09-01/work/veo-prompt-opening.txt 2>/dev/null || true
echo "---"
cat /home/opc/gsa-ai/flow_generate_studio_master.js 2>/dev/null || true
`;
  const res = await runSshScript(script);
  console.log(res.stdout);
}

main().catch(console.error);
