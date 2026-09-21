import { runSshScript } from './ssh2-run.mjs';

async function main() {
  const script = `
grep -rn "media-gsa-manha-news-2026-09-04-draft-qc-v1" /home/opc/ /opt/gsa-tv/ 2>/dev/null | head -15
`;
  const res = await runSshScript(script);
  console.log(res.stdout);
}

main().catch(console.error);
