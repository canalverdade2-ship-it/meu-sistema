import fs from 'fs';
import { runSshScript } from './ssh2-run.mjs';

async function main() {
  console.log('=== ATUALIZANDO PRONÚNCIA PARA G.S.A. NAS DUAS OPÇÕES ===');

  const mp3Path = 'public/cast/test_gsa_dot.mp3';
  const base64Audio = fs.readFileSync(mp3Path).toString('base64');

  const script = `
VDIR="/opt/gsa-tv/cache/media/1/identity/vinhetas"
echo "${base64Audio}" | base64 -d > "$VDIR/vinheta_ta_na_rede_gsa_dot.mp3"

# Converte para WAV 48kHz estéreo
sudo docker exec gsa-tv-ffplayout ffmpeg -y -hide_banner -loglevel error \
  -i /media/1/identity/vinhetas/vinheta_ta_na_rede_gsa_dot.mp3 \
  -ar 48000 -ac 2 /media/1/identity/vinhetas/vinheta_ta_na_rede_gsa_dot.wav

DUR=$(sudo docker exec gsa-tv-ffplayout ffprobe -v error -show_entries format=duration -of default=noprint_wrappers=1:nokey=1 /media/1/identity/vinhetas/vinheta_ta_na_rede_gsa_dot.wav)
echo "Duração do áudio com G.S.A.: $DUR s"

AUDIO_VOX="/media/1/identity/vinhetas/vinheta_ta_na_rede_gsa_dot.wav"

# -------------------------------------------------------------
# 1. REMIX ÁUDIO OPÇÃO 1 (Tech Premium)
# -------------------------------------------------------------
sudo docker exec gsa-tv-ffplayout ffmpeg -y -hide_banner -loglevel error \
  -i "$AUDIO_VOX" \
  -f lavfi -i "sine=f=55:d=2.0:r=48000,adelay=800|800,afade=t=out:st=1.2:d=1.5" \
  -f lavfi -i "anoisesrc=d=8.4:c=pink:r=48000:a=0.08,lowpass=f=600,afade=t=in:st=0:d=1.5,afade=t=out:st=7.2:d=1.2" \
  -filter_complex \
  "[0:a]adelay=900|900,volume=1.4[vox]; \
   [1:a]volume=1.2[sub]; \
   [2:a]volume=0.4[pad]; \
   [vox][sub][pad]amix=inputs=3:duration=first:dropout_transition=2,volume=1.1,alimiter=limit=0.96[aout1]" \
  -map "[aout1]" -c:a pcm_s16le -ar 48000 -ac 2 /media/1/identity/vinhetas/audio_opt1.wav

# Re-render Vídeo Opção 1 (Tech Premium)
sudo docker exec gsa-tv-ffplayout ffmpeg -y -hide_banner \
  -loop 1 -i /media/1/identity/vinhetas/opt1_premium_art.jpg \
  -i /media/1/identity/vinhetas/audio_opt1.wav \
  -filter_complex \
  "[0:v]scale=1920:1080:force_original_aspect_ratio=increase,crop=1920:1080,fps=30, \
   zoompan=z='min(zoom+0.0006,1.14)':x='iw/2-(iw/zoom/2)':y='ih/2-(ih/zoom/2)':d=255:s=1920x1080:fps=30, \
   eq=contrast=1.05:saturation=1.08:brightness=0.01, \
   fade=t=in:st=0:d=0.8:color=black, \
   fade=t=out:st=7.6:d=0.8:color=black[outv1]" \
  -map "[outv1]" -map 1:a:0 \
  -c:v libx264 -preset fast -crf 17 -pix_fmt yuv420p \
  -c:a aac -b:a 256k -ar 48000 -ac 2 \
  -t 8.4 \
  /media/1/identity/vinhetas/vinheta-ta-na-rede-opcao1-premium.mp4

echo "Opcao 1 regravada com pronúncia G.S.A.!"

# -------------------------------------------------------------
# 2. REMIX ÁUDIO OPÇÃO 2 (Kinetic Broadcast)
# -------------------------------------------------------------
sudo docker exec gsa-tv-ffplayout ffmpeg -y -hide_banner -loglevel error \
  -i "$AUDIO_VOX" \
  -f lavfi -i "sine=f=120:d=1.5:r=48000,adelay=600|600,afade=t=out:st=1.0:d=0.8" \
  -f lavfi -i "anoisesrc=d=8.4:c=pink:r=48000:a=0.15,bandpass=f=2000:w=1200,afade=t=in:st=0:d=0.6,afade=t=out:st=0.8:d=0.4" \
  -filter_complex \
  "[0:a]adelay=700|700,volume=1.45[vox2]; \
   [1:a]volume=1.1[sub2]; \
   [2:a]volume=0.6[zap]; \
   [vox2][sub2][zap]amix=inputs=3:duration=first:dropout_transition=2,volume=1.12,alimiter=limit=0.96[aout2]" \
  -map "[aout2]" -c:a pcm_s16le -ar 48000 -ac 2 /media/1/identity/vinhetas/audio_opt2.wav

# Re-render Vídeo Opção 2 (Kinetic)
sudo docker exec gsa-tv-ffplayout ffmpeg -y -hide_banner \
  -loop 1 -i /media/1/identity/vinhetas/opt2_kinetic_art.jpg \
  -i /media/1/identity/vinhetas/audio_opt2.wav \
  -filter_complex \
  "[0:v]scale=1920:1080:force_original_aspect_ratio=increase,crop=1920:1080,fps=30, \
   zoompan=z='if(lte(on,18), 0.45+0.60*(on/18), 1.02+0.02*sin(on*0.18))':x='iw/2-(iw/zoom/2)':y='ih/2-(ih/zoom/2)':d=255:s=1920x1080:fps=30, \
   drawbox=x=0:y=0:w=1920:h=1080:color=white@0.85:t=fill:enable='between(t,0.55,0.70)', \
   fade=t=out:st=7.7:d=0.7:color=white[outv2]" \
  -map "[outv2]" -map 1:a:0 \
  -c:v libx264 -preset fast -crf 17 -pix_fmt yuv420p \
  -c:a aac -b:a 256k -ar 48000 -ac 2 \
  -t 8.4 \
  /media/1/identity/vinhetas/vinheta-ta-na-rede-opcao2-kinetic.mp4

echo "Opcao 2 regravada com pronúncia G.S.A.!"

# Atualiza duração no banco de dados
psql "postgresql://supabase_admin:GSA_SENHA_FORTE_2026@127.0.0.1:5433/gsahub" -c "
UPDATE public.gsa_tv_media_items
SET duration_s = 8.4, updated_at = NOW()
WHERE id IN ('media-vinheta-ta-na-rede-opt1', 'media-vinheta-ta-na-rede-opt2');
"
echo "=== PRONÚNCIA ATUALIZADA COM SUCESSO! ==="
`;

  const res = await runSshScript(script);
  console.log(res.stdout);
  if (res.stderr) console.error(res.stderr);
}

main().catch(console.error);
