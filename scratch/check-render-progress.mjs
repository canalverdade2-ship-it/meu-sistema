import { runSshScript } from './ssh2-run.mjs';

async function main() {
  const script = `
ls -lh /opt/gsa-tv/cache/media/1/news/gsa-ta-na-rede-2026-09-02/video/
`;
  const res = await runSshScript(script);
  console.log(res.stdout);
}

main().catch(console.error);
