import fs from 'fs';
import { runSshScript } from './ssh2-run.mjs';

async function main() {
  console.log('=== CORRIGINDO CAMINHOS E RENDERIZANDO AS 2 OPÇÕES COM PRECISÃO ===');

  const script = `
VDIR="/opt/gsa-tv/cache/media/1/identity/vinhetas"
sudo chmod -R 777 "$VDIR"

AUDIO_VOX="/media/1/identity/vinhetas/vinheta_ta_na_rede_audio.wav"

# -------------------------------------------------------------
# 1. RENDER OPÇÃO 1: TECH PREMIUM & VIDRO (Elegância Broadcast GSA TV)
# -------------------------------------------------------------
sudo docker exec gsa-tv-ffplayout ffmpeg -y -hide_banner -loglevel error \
  -i "$AUDIO_VOX" \
  -f lavfi -i "sine=f=55:d=2.0:r=48000,adelay=800|800,afade=t=out:st=1.2:d=1.5" \
  -f lavfi -i "anoisesrc=d=7.8:c=pink:r=48000:a=0.08,lowpass=f=600,afade=t=in:st=0:d=1.5,afade=t=out:st=6.5:d=1.2" \
  -filter_complex \
  "[0:a]adelay=900|900,volume=1.4[vox]; \
   [1:a]volume=1.2[sub]; \
   [2:a]volume=0.4[pad]; \
   [vox][sub][pad]amix=inputs=3:duration=first:dropout_transition=2,volume=1.1,alimiter=limit=0.96[aout1]" \
  -map "[aout1]" -c:a pcm_s16le -ar 48000 -ac 2 /media/1/identity/vinhetas/audio_opt1.wav

echo "Audio Opcao 1 gerado!"

sudo docker exec gsa-tv-ffplayout ffmpeg -y -hide_banner \
  -loop 1 -i /media/1/identity/vinhetas/opt1_premium_art.jpg \
  -i /media/1/identity/vinhetas/audio_opt1.wav \
  -filter_complex \
  "[0:v]scale=1920:1080:force_original_aspect_ratio=increase,crop=1920:1080,fps=30, \
   zoompan=z='min(zoom+0.0007,1.14)':x='iw/2-(iw/zoom/2)':y='ih/2-(ih/zoom/2)':d=234:s=1920x1080:fps=30, \
   eq=contrast=1.05:saturation=1.08:brightness=0.01, \
   fade=t=in:st=0:d=0.8:color=black, \
   fade=t=out:st=7.0:d=0.8:color=black[outv1]" \
  -map "[outv1]" -map 1:a:0 \
  -c:v libx264 -preset medium -crf 17 -pix_fmt yuv420p \
  -c:a aac -b:a 256k -ar 48000 -ac 2 \
  -t 7.8 \
  /media/1/identity/vinhetas/vinheta-ta-na-rede-opcao1-premium.mp4

echo "Video Opcao 1 renderizado com sucesso!"

# -------------------------------------------------------------
# 2. RENDER OPÇÃO 2: KINETIC BROADCAST (Digital, Pop & Eletrizante)
# -------------------------------------------------------------
sudo docker exec gsa-tv-ffplayout ffmpeg -y -hide_banner -loglevel error \
  -i "$AUDIO_VOX" \
  -f lavfi -i "sine=f=120:d=1.5:r=48000,adelay=600|600,afade=t=out:st=1.0:d=0.8" \
  -f lavfi -i "anoisesrc=d=7.8:c=pink:r=48000:a=0.15,bandpass=f=2000:w=1200,afade=t=in:st=0:d=0.6,afade=t=out:st=0.8:d=0.4" \
  -filter_complex \
  "[0:a]adelay=700|700,volume=1.45[vox2]; \
   [1:a]volume=1.1[sub2]; \
   [2:a]volume=0.6[zap]; \
   [vox2][sub2][zap]amix=inputs=3:duration=first:dropout_transition=2,volume=1.12,alimiter=limit=0.96[aout2]" \
  -map "[aout2]" -c:a pcm_s16le -ar 48000 -ac 2 /media/1/identity/vinhetas/audio_opt2.wav

echo "Audio Opcao 2 gerado!"

sudo docker exec gsa-tv-ffplayout ffmpeg -y -hide_banner \
  -loop 1 -i /media/1/identity/vinhetas/opt2_kinetic_art.jpg \
  -i /media/1/identity/vinhetas/audio_opt2.wav \
  -filter_complex \
  "[0:v]scale=1920:1080:force_original_aspect_ratio=increase,crop=1920:1080,fps=30, \
   zoompan=z='if(lte(on,18), 0.45+0.60*(on/18), 1.02+0.02*sin(on*0.18))':x='iw/2-(iw/zoom/2)':y='ih/2-(ih/zoom/2)':d=234:s=1920x1080:fps=30, \
   drawbox=x=0:y=0:w=1920:h=1080:color=white@0.85:t=fill:enable='between(t,0.55,0.70)', \
   fade=t=out:st=7.1:d=0.7:color=white[outv2]" \
  -map "[outv2]" -map 1:a:0 \
  -c:v libx264 -preset medium -crf 17 -pix_fmt yuv420p \
  -c:a aac -b:a 256k -ar 48000 -ac 2 \
  -t 7.8 \
  /media/1/identity/vinhetas/vinheta-ta-na-rede-opcao2-kinetic.mp4

echo "Video Opcao 2 renderizado com sucesso!"

ls -lh /opt/gsa-tv/cache/media/1/identity/vinhetas/vinheta-ta-na-rede-opcao*.mp4
`;

  const res = await runSshScript(script);
  console.log(res.stdout);
  if (res.stderr) console.error(res.stderr);
}

main().catch(console.error);
