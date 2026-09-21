import { runSshScript } from './ssh2-run.mjs';

async function main() {
  const script = `ls -lh /opt/gsa-tv/cache/media/1/news/gsa-news-2026-09-02-v2/video/`;
  const res = await runSshScript(script);
  console.log('OUTPUT:\n', res.stdout);
}

main().catch(console.error);
