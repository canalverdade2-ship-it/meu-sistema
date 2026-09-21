import { runSshScript } from './ssh2-run.mjs';

async function main() {
  const script = `
    echo "=== ENCODER LOGS SINCE 16:45 GMT ==="
    sudo docker logs --since 30m gsa-tv-encoder-engine 2>&1 | grep -v 'producer_chunk' | head -n 40 || true

    echo "\n=== FFPLAYOUT LOGS SINCE 16:45 GMT ==="
    sudo docker logs --since 30m gsa-tv-ffplayout 2>&1 | grep -E 'WARN|ERROR|drop|lag|drift' | head -n 40 || true
  `;
  const res = await runSshScript(script);
  console.log(res.stdout);
  if (res.stderr) console.error(res.stderr);
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
