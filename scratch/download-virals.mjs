import { runSshScript } from './ssh2-run.mjs';

async function testDownloadVirals() {
  const script = `
VDIR="/opt/gsa-tv/cache/media/1/news/gsa-ta-na-rede-2026-09-02/viral_raw"
mkdir -p "$VDIR"

echo "=== BUSCANDO 3 VÍDEOS VIRAIS ENGRAÇADOS NO YOUTUBE SHORTS ==="
yt-dlp "ytsearch3:funny cat dog viral shorts" \
  --max-filesize 15M \
  -f "bestvideo[height<=1080]+bestaudio/best[height<=1080]/best" \
  --merge-output-format mp4 \
  -o "$VDIR/viral_%(id)s.%(ext)s" \
  --no-playlist \
  --playlist-end 3 \
  --print "filename" || true

ls -lh "$VDIR"
`;

  console.log('Buscando e baixando vídeos virais com yt-dlp...');
  const res = await runSshScript(script);
  console.log('OUTPUT:\n', res.stdout);
  if (res.stderr) console.error('STDERR:\n', res.stderr);
}

testDownloadVirals().catch(console.error);
