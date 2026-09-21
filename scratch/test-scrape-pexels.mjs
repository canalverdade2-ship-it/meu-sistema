import { runSshScript } from './ssh2-run.mjs';

async function main() {
  const script = `
curl -s -L -A "Mozilla/5.0 (Windows NT 10.0; Win64; x64)" "https://www.pexels.com/search/videos/funny%20cat/" | grep -oE 'https://[^\"]+video-files[^\"]+\.mp4' | head -n 10 || true
`;
  const res = await runSshScript(script);
  console.log('Result:\n', res.stdout);
}

main().catch(console.error);
