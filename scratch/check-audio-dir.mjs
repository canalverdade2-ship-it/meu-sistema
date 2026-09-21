import { runSshScript } from './ssh2-run.mjs';

async function main() {
  const script = `
ls -la /opt/gsa-tv/cache/media/1/news/gsa-ta-na-rede-2026-09-02/
ls -la /opt/gsa-tv/cache/media/1/news/gsa-ta-na-rede-2026-09-02/audio/ 2>/dev/null || true
`;
  const res = await runSshScript(script);
  console.log(res.stdout);
}

main().catch(console.error);
