import { runSshScript } from './ssh2-run.mjs';

async function main() {
  const script = `
    echo "=== /usr/local/bin/ffmpeg ==="
    cat /usr/local/bin/ffmpeg || true
    echo "\n=== /usr/local/bin/ffprobe ==="
    cat /usr/local/bin/ffprobe || true
  `;
  const res = await runSshScript(script);
  console.log(res.stdout);
}

main().catch(console.error);
