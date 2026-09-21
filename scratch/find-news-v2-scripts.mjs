import { runSshScript } from './ssh2-run.mjs';

async function main() {
  const script = `
find /opt/gsa-tv/cache/media/1/news/gsa-news-2026-09-02-v2/ -name "*.sh" -o -name "*.js" -o -name "*.json" -o -name "*.txt" | head -30
`;
  const res = await runSshScript(script);
  console.log(res.stdout);
}

main().catch(console.error);
