import { runSshScript } from './ssh2-run.mjs';

async function main() {
  const script = `
echo "=== MOTION AND ASSETS ==="
find /opt/gsa-tv/cache/media/1/ -name "*.mp4" -o -name "*.webm" -o -name "*.png" | grep -v "/live-recordings/" | head -n 40
`;
  const res = await runSshScript(script);
  console.log(res.stdout);
}

main().catch(console.error);
