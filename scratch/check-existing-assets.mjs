import { runSshScript } from './ssh2-run.mjs';

async function main() {
  const script = `
ls -la /media/1/news/gsa-news-2026-09-01/video/
ls -la /media/1/filler/ 2>/dev/null || true
ls -la /media/1/identity/ 2>/dev/null || true
find /opt/gsa-tv/cache/media -name "*veo*" -o -name "*opening*" 2>/dev/null || true
`;
  const res = await runSshScript(script);
  console.log(res.stdout);
}

main().catch(console.error);
