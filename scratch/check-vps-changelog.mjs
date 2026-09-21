import { runSshScript } from './ssh2-run.mjs';

async function main() {
  const script = `
ls -la /home/opc/gsa-ai/GSA_TV_MEMORY_CHANGELOG.md 2>/dev/null || ls -la /opt/gsa-tv/*CHANGELOG* 2>/dev/null || echo "Sem changelog em gsa-ai"
`;
  const res = await runSshScript(script);
  console.log(res.stdout);
}

main().catch(console.error);
