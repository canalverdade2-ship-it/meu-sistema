import { runSshScript } from './ssh2-run.mjs';

async function main() {
  const script = `
# Test yt-dlp on a public test video or TikTok
yt-dlp --dump-json "https://www.tiktok.com/@tiktok/video/7106594312292453678" 2>&1 | head -n 30 || true
`;
  const res = await runSshScript(script);
  console.log('Result:\n', res.stdout);
}

main().catch(console.error);
