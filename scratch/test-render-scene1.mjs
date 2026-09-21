import { runSshScript } from './ssh2-run.mjs';

async function testOneScene() {
  const script = `
DUR=$(sudo docker exec gsa-tv-ffplayout ffprobe -v error -show_entries format=duration -of default=noprint_wrappers=1:nokey=1 /media/1/news/gsa-ta-na-rede-2026-09-02/audio/cena01_abertura.wav)
echo "Obtained duration: $DUR"

sudo docker exec gsa-tv-ffplayout ffmpeg -y -hide_banner -loglevel info \
  -ss 10 -t "$DUR" \
  -i /media/1/news/gsa-news-2026-09-01-v2/motion/tecnologia.webm \
  -i /media/1/identity/gsa-tv-logo-transparent.png \
  -i /media/1/news/gsa-ta-na-rede-2026-09-02/audio/cena01_abertura.wav \
  -filter_complex "[0:v]scale=1920:1080:force_original_aspect_ratio=increase,crop=1920:1080,fps=30[bg]; \
   [1:v]scale=170:-1[logo]; \
   [bg][logo]overlay=W-w-30:30[v0]; \
   [v0]drawbox=x=0:y=830:w=1920:h=175:color=0x06162a@0.88:t=fill, \
   drawbox=x=0:y=830:w=1920:h=5:color=0xc99a3b@1:t=fill, \
   drawbox=x=0:y=955:w=1920:h=45:color=0x0b1d33@0.95:t=fill, \
   drawtext=fontfile=/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf:textfile=/media/1/news/gsa-ta-na-rede-2026-09-02/graphics/cena01_abertura_title.txt:expansion=none:fontcolor=0xe2b354:fontsize=24:x=60:y=850, \
   drawtext=fontfile=/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf:textfile=/media/1/news/gsa-ta-na-rede-2026-09-02/graphics/cena01_abertura_headline.txt:expansion=none:fontcolor=white:fontsize=32:x=60:y=890, \
   drawtext=fontfile=/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf:textfile=/media/1/news/gsa-ta-na-rede-2026-09-02/graphics/cena01_abertura_ticker.txt:expansion=none:fontcolor=white:fontsize=18:x=60:y=967[outv]" \
  -map "[outv]" -map 2:a:0 \
  -c:v libx264 -preset fast -crf 20 -pix_fmt yuv420p \
  -c:a aac -b:a 192k -ar 48000 -ac 2 \
  -t "$DUR" \
  /media/1/news/gsa-ta-na-rede-2026-09-02/video/cena01_abertura.mp4

ls -lh /opt/gsa-tv/cache/media/1/news/gsa-ta-na-rede-2026-09-02/video/cena01_abertura.mp4
`;

  const res = await runSshScript(script);
  console.log('STDOUT:\n', res.stdout);
  console.log('STDERR:\n', res.stderr);
}

testOneScene().catch(console.error);
