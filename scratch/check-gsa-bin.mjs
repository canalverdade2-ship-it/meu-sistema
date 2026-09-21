import { runSshScript } from './ssh2-run.mjs';

async function main() {
  const script = `
ls -la /home/opc/gsa-ai/bin/
cat /home/opc/gsa-ai/bin/gsa-news-finalize.sh 2>/dev/null || true
`;
  const res = await runSshScript(script);
  console.log(res.stdout);
}

main().catch(console.error);
