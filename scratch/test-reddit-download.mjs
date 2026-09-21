import { runSshScript } from './ssh2-run.mjs';

async function main() {
  const script = `
VDIR="/opt/gsa-tv/cache/media/1/news/gsa-ta-na-rede-2026-09-02/viral_raw"
mkdir -p "$VDIR"

echo "=== BAIXANDO VIRAIS DO REDDIT COM YT-DLP ==="
yt-dlp "https://www.reddit.com/r/AnimalsBeingDerps/hot/" \
  --playlist-end 2 \
  -o "$VDIR/viral_reddit_%(id)s.%(ext)s" \
  --max-filesize 20M || true

ls -lh "$VDIR"
`;
  const res = await runSshScript(script);
  console.log('OUTPUT:\n', res.stdout);
  if (res.stderr) console.error('STDERR:\n', res.stderr);
}

main().catch(console.error);
