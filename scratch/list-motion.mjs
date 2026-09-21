import { runSshScript } from './ssh2-run.mjs';

async function main() {
  const script = `
ls -lh /opt/gsa-tv/cache/media/1/news/gsa-news-2026-09-01-v2/motion/
`;
  const res = await runSshScript(script);
  console.log(res.stdout);
}

main().catch(console.error);
