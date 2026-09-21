import { runSshScript } from './ssh2-run.mjs';

async function main() {
  const script = `
cat /opt/gsa-tv/cache/media/1/news/gsa-news-2026-09-02-v2/video/tmp/concat_v12.txt
`;
  const res = await runSshScript(script);
  console.log(res.stdout);
}

main().catch(console.error);
