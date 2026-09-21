import fs from 'fs';
import { runSshScript } from './ssh2-run.mjs';

async function main() {
  console.log('=== RENDERIZANDO VINHETA TELEVISIVA EXCLUSIVA DO GSA TÁ NA REDE ===');

  const vpsScript = `
VDIR="/opt/gsa-tv/cache/media/1/identity/vinhetas"
LOGO="/media/1/identity/gsa-tv-logo-transparent.png"
IMG="/media/1/identity/vinhetas/ta_na_rede_flow_master.png"
AUDIO="/media/1/identity/vinhetas/vinheta_ta_na_rede_audio.wav"

# Renderiza vinheta com Ken Burns dinâmico de zoom acelerado (efeito clássico de vinheta de TV)
# Zoom de 1.0 para 1.15 suave em 225 frames (7.5 segundos a 30fps)
sudo docker exec gsa-tv-ffplayout ffmpeg -y -hide_banner -loglevel error \
  -loop 1 -i "$IMG" \
  -i "$LOGO" \
  -i "$AUDIO" \
  -filter_complex "[0:v]scale=1920:1080:force_original_aspect_ratio=increase,crop=1920:1080, \
   zoompan=z='min(zoom+0.0006,1.15)':x='iw/2-(iw/zoom/2)':y='ih/2-(ih/zoom/2)':d=225:s=1920x1080:fps=30, \
   eq=contrast=1.08:saturation=1.12[bg]; \
   [1:v]scale=180:-1[logo]; \
   [bg][logo]overlay=W-w-35:35[outv]" \
  -map "[outv]" -map 2:a:0 \
  -c:v libx264 -preset fast -crf 18 -pix_fmt yuv420p \
  -c:a aac -b:a 256k -ar 48000 -ac 2 \
  -t 7.5 \
  /media/1/identity/vinhetas/vinheta-gsa-ta-na-rede-tv.mp4

# Extrai frame de preview aos 4 segundos
sudo docker exec gsa-tv-ffplayout ffmpeg -y -hide_banner -loglevel error \
  -ss 4 -i /media/1/identity/vinhetas/vinheta-gsa-ta-na-rede-tv.mp4 \
  -vframes 1 /media/1/identity/vinhetas/preview_ta_na_rede_tv_final.jpg

base64 -w 0 /opt/gsa-tv/cache/media/1/identity/vinhetas/preview_ta_na_rede_tv_final.jpg
`;

  const res = await runSshScript(vpsScript);
  const buf = Buffer.from(res.stdout.trim().split('\n').pop(), 'base64');
  fs.writeFileSync('public/cast/vinheta_ta_na_rede_tv_exclusive.jpg', buf);
  console.log('Saved public/cast/vinheta_ta_na_rede_tv_exclusive.jpg:', buf.length, 'bytes');
}

main().catch(console.error);
