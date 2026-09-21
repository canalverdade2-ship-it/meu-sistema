import { runSshScript } from './ssh2-run.mjs';

async function main() {
  const script = `
    cnt=$(find /opt/gsa-tv/cache/media/1/identity/audio -type f | grep -E '\\.(mp3|wav)$' | wc -l)
    echo "TOTAL VALID AUDIO TRACKS: $cnt"
  `;
  const res = await runSshScript(script);
  console.log(res.stdout);
}

main().catch(console.error);
