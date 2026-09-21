import { runSshScript } from './ssh2-run.mjs';

async function testFilter() {
  const script = `
VDIR="/media/1/news/gsa-ta-na-rede-2026-09-02/viral_raw"
LOGO="/media/1/identity/gsa-tv-logo-transparent.png"
OUT="/opt/gsa-tv/cache/media/1/news/gsa-ta-na-rede-2026-09-02/test_frame.jpg"

sudo docker exec gsa-tv-ffplayout ffmpeg -y -hide_banner -loglevel error \
  -ss 2 -i "$VDIR/viral_vertical_01.mp4" \
  -i "$LOGO" \
  -filter_complex "[0:v]scale=1920:1080:force_original_aspect_ratio=increase,crop=1920:1080,boxblur=25:5,eq=brightness=-0.15[bg]; \
   [0:v]scale=-1:1000[main]; \
   [bg][main]overlay=(W-w)/2:40[v0]; \
   [1:v]scale=160:-1[logo]; \
   [v0][logo]overlay=W-w-30:30[v1]; \
   [v1]drawbox=x=0:y=840:w=1920:h=160:color=0x06162a@0.90:t=fill, \
   drawbox=x=0:y=840:w=1920:h=5:color=0xc99a3b@1:t=fill, \
   drawtext=fontfile=/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf:text='GSA TÁ NA REDE • VIRAL DA SEMANA':fontcolor=0xe2b354:fontsize=24:x=60:y=860, \
   drawtext=fontfile=/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf:text='O VÍDEO QUE BATEU MILHÕES DE VIEWS NO TIKTOK':fontcolor=white:fontsize=32:x=60:y=895, \
   drawtext=fontfile=/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf:text='GSA TV • OS VÍDEOS MAIS COMPARTILHADOS DAS REDES SOCIAIS':fontcolor=0x94a3b8:fontsize=18:x=60:y=960, \
   drawbox=x=60:y=100:w=300:h=54:color=0x06162a@0.85:t=fill, \
   drawbox=x=60:y=100:w=5:h=54:color=0xc99a3b@1:t=fill, \
   drawtext=fontfile=/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf:text='GSA TÁ NA REDE':fontcolor=white:fontsize=20:x=80:y=118, \
   drawbox=x=1540:y=100:w=320:h=54:color=0x06162a@0.85:t=fill, \
   drawbox=x=1855:y=100:w=5:h=54:color=0xc99a3b@1:t=fill, \
   drawtext=fontfile=/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf:text='VIRAL DA WEB':fontcolor=0xe2b354:fontsize=20:x=1565:y=118[outv]" \
  -map "[outv]" -vframes 1 /media/1/news/gsa-ta-na-rede-2026-09-02/test_frame.jpg

ls -lh "$OUT"
`;

  const res = await runSshScript(script);
  console.log(res.stdout);
  if (res.stderr) console.error(res.stderr);
}

testFilter().catch(console.error);
