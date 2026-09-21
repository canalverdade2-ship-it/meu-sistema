import fs from 'fs';
import { runSshScript } from './ssh2-run.mjs';

async function main() {
  console.log('=== ATUALIZANDO AS DUAS OPÇÕES COM AS NOVAS FONTES FONÉTICAS ===');

  const audio1 = fs.readFileSync('public/cast/teste_1_ge_esse_a.mp3').toString('base64');
  const audio2 = fs.readFileSync('public/cast/teste_3_ta_na_rede_gsa_tv.mp3').toString('base64');

  const script = `
VDIR="/opt/gsa-tv/cache/media/1/identity/vinhetas"
echo "${audio1}" | base64 -d > "$VDIR/vox_phonetic_1.mp3"
echo "${audio2}" | base64 -d > "$VDIR/vox_phonetic_2.mp3"

# Converte para WAV 48k
sudo docker exec gsa-tv-ffplayout ffmpeg -y -hide_banner -loglevel error -i /media/1/identity/vinhetas/vox_phonetic_1.mp3 -ar 48000 -ac 2 /media/1/identity/vinhetas/vox_phonetic_1.wav
sudo docker exec gsa-tv-ffplayout ffmpeg -y -hide_banner -loglevel error -i /media/1/identity/vinhetas/vox_phonetic_2.mp3 -ar 48000 -ac 2 /media/1/identity/vinhetas/vox_phonetic_2.wav

DUR1=$(sudo docker exec gsa-tv-ffplayout ffprobe -v error -show_entries format=duration -of default=noprint_wrappers=1:nokey=1 /media/1/identity/vinhetas/vox_phonetic_1.wav)
DUR2=$(sudo docker exec gsa-tv-ffplayout ffprobe -v error -show_entries format=duration -of default=noprint_wrappers=1:nokey=1 /media/1/identity/vinhetas/vox_phonetic_2.wav)
echo "DUR1: $DUR1 s | DUR2: $DUR2 s"

# -------------------------------------------------------------
# 1. OPÇÃO 1 (Tech Premium): Com "Gê, Esse, Á, Tá na Rede..."
# -------------------------------------------------------------
sudo docker exec gsa-tv-ffplayout ffmpeg -y -hide_banner -loglevel error \
  -i /media/1/identity/vinhetas/vox_phonetic_1.wav \
  -f lavfi -i "sine=f=55:d=2.0:r=48000,adelay=800|800,afade=t=out:st=1.2:d=1.5" \
  -f lavfi -i "anoisesrc=d=8.8:c=pink:r=48000:a=0.08,lowpass=f=600,afade=t=in:st=0:d=1.5,afade=t=out:st=7.8:d=1.0" \
  -filter_complex \
  "[0:a]adelay=900|900,volume=1.4[vox]; \
   [1:a]volume=1.2[sub]; \
   [2:a]volume=0.4[pad]; \
   [vox][sub][pad]amix=inputs=3:duration=first:dropout_transition=2,volume=1.1,alimiter=limit=0.96[aout1]" \
  -map "[aout1]" -c:a pcm_s16le -ar 48000 -ac 2 /media/1/identity/vinhetas/audio_opt1.wav

sudo docker exec gsa-tv-ffplayout ffmpeg -y -hide_banner \
  -loop 1 -i /media/1/identity/vinhetas/opt1_premium_art.jpg \
  -i /media/1/identity/vinhetas/audio_opt1.wav \
  -filter_complex \
  "[0:v]scale=1920:1080:force_original_aspect_ratio=increase,crop=1920:1080,fps=30, \
   zoompan=z='min(zoom+0.0006,1.14)':x='iw/2-(iw/zoom/2)':y='ih/2-(ih/zoom/2)':d=264:s=1920x1080:fps=30, \
   eq=contrast=1.05:saturation=1.08:brightness=0.01, \
   fade=t=in:st=0:d=0.8:color=black, \
   fade=t=out:st=8.0:d=0.8:color=black[outv1]" \
  -map "[outv1]" -map 1:a:0 \
  -c:v libx264 -preset fast -crf 17 -pix_fmt yuv420p \
  -c:a aac -b:a 256k -ar 48000 -ac 2 \
  -t 8.8 \
  /media/1/identity/vinhetas/vinheta-ta-na-rede-opcao1-premium.mp4

# -------------------------------------------------------------
# 2. OPÇÃO 2 (Kinetic Broadcast): Com "Tá na Rede! ... agora na Gê Esse Á TV!"
# -------------------------------------------------------------
sudo docker exec gsa-tv-ffplayout ffmpeg -y -hide_banner -loglevel error \
  -i /media/1/identity/vinhetas/vox_phonetic_2.wav \
  -f lavfi -i "sine=f=120:d=1.5:r=48000,adelay=600|600,afade=t=out:st=1.0:d=0.8" \
  -f lavfi -i "anoisesrc=d=7.5:c=pink:r=48000:a=0.15,bandpass=f=2000:w=1200,afade=t=in:st=0:d=0.6,afade=t=out:st=0.8:d=0.4" \
  -filter_complex \
  "[0:a]adelay=700|700,volume=1.45[vox2]; \
   [1:a]volume=1.1[sub2]; \
   [2:a]volume=0.6[zap]; \
   [vox2][sub2][zap]amix=inputs=3:duration=first:dropout_transition=2,volume=1.12,alimiter=limit=0.96[aout2]" \
  -map "[aout2]" -c:a pcm_s16le -ar 48000 -ac 2 /media/1/identity/vinhetas/audio_opt2.wav

sudo docker exec gsa-tv-ffplayout ffmpeg -y -hide_banner \
  -loop 1 -i /media/1/identity/vinhetas/opt2_kinetic_art.jpg \
  -i /media/1/identity/vinhetas/audio_opt2.wav \
  -filter_complex \
  "[0:v]scale=1920:1080:force_original_aspect_ratio=increase,crop=1920:1080,fps=30, \
   zoompan=z='if(lte(on,18), 0.45+0.60*(on/18), 1.02+0.02*sin(on*0.18))':x='iw/2-(iw/zoom/2)':y='ih/2-(ih/zoom/2)':d=225:s=1920x1080:fps=30, \
   drawbox=x=0:y=0:w=1920:h=1080:color=white@0.85:t=fill:enable='between(t,0.55,0.70)', \
   fade=t=out:st=6.8:d=0.7:color=white[outv2]" \
  -map "[outv2]" -map 1:a:0 \
  -c:v libx264 -preset fast -crf 17 -pix_fmt yuv420p \
  -c:a aac -b:a 256k -ar 48000 -ac 2 \
  -t 7.5 \
  /media/1/identity/vinhetas/vinheta-ta-na-rede-opcao2-kinetic.mp4

# Atualiza durações no banco
psql "postgresql://supabase_admin:GSA_SENHA_FORTE_2026@127.0.0.1:5433/gsahub" -c "
UPDATE public.gsa_tv_media_items SET duration_s = 8.8, updated_at = NOW() WHERE id = 'media-vinheta-ta-na-rede-opt1';
UPDATE public.gsa_tv_media_items SET duration_s = 7.5, updated_at = NOW() WHERE id = 'media-vinheta-ta-na-rede-opt2';
"
echo "=== OPÇÕES 1 E 2 RENDERIZADAS COM FONÉTICA PURA! ==="
`;

  const res = await runSshScript(script);
  console.log(res.stdout);
  if (res.stderr) console.error(res.stderr);
}

main().catch(console.error);
