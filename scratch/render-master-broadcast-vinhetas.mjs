import fs from 'fs';
import { runSshScript } from './ssh2-run.mjs';

async function main() {
  console.log('=== PRODUZINDO AS 2 VINHETAS DEFINITIVAS DE PADRÃO TELEVISIVO ===');

  const voxBase64 = fs.readFileSync('public/cast/vox_esta_no_ar.mp3').toString('base64');

  const script = `
VDIR="/opt/gsa-tv/cache/media/1/identity/vinhetas"
SDIR="/opt/gsa-tv/cache/media/1/identity/sfx"

echo "${voxBase64}" | base64 -d > "$VDIR/vox_esta_no_ar.mp3"

# -------------------------------------------------------------
# 1. ÁUDIO OPÇÃO 1: SOUND DESIGN BROADCAST 100% INSTRUMENTAL
# -------------------------------------------------------------
# Mix do whoosh de abertura + revelação cinematográfica + sting final de emissora
sudo docker exec gsa-tv-ffplayout ffmpeg -y -hide_banner -loglevel error \
  -i /media/1/identity/sfx/whoosh_air.mp3 \
  -i /media/1/identity/sfx/cinematic_reveal.mp3 \
  -i /media/1/identity/sfx/broadcast_sting.mp3 \
  -filter_complex \
  "[0:a]volume=1.2[whoosh]; \
   [1:a]volume=1.3[reveal]; \
   [2:a]adelay=1800|1800,volume=1.4[sting]; \
   [whoosh][reveal][sting]amix=inputs=3:duration=longest:dropout_transition=2,volume=1.15,alimiter=limit=0.96[aout1]" \
  -map "[aout1]" -c:a pcm_s16le -ar 48000 -ac 2 /media/1/identity/vinhetas/audio_master_opt1.wav

# VÍDEO OPÇÃO 1: TECH PREMIUM (6.5s)
sudo docker exec gsa-tv-ffplayout ffmpeg -y -hide_banner \
  -loop 1 -i /media/1/identity/vinhetas/opt1_premium_art.jpg \
  -i /media/1/identity/vinhetas/audio_master_opt1.wav \
  -filter_complex \
  "[0:v]scale=1920:1080:force_original_aspect_ratio=increase,crop=1920:1080,fps=30, \
   zoompan=z='min(zoom+0.0008,1.15)':x='iw/2-(iw/zoom/2)':y='ih/2-(ih/zoom/2)':d=195:s=1920x1080:fps=30, \
   eq=contrast=1.06:saturation=1.1:brightness=0.01, \
   fade=t=in:st=0:d=0.7:color=black, \
   fade=t=out:st=5.8:d=0.7:color=black[outv1]" \
  -map "[outv1]" -map 1:a:0 \
  -c:v libx264 -preset fast -crf 17 -pix_fmt yuv420p \
  -c:a aac -b:a 256k -ar 48000 -ac 2 \
  -t 6.5 \
  /media/1/identity/vinhetas/vinheta-ta-na-rede-opcao1-premium.mp4

echo "Opcao 1 renderizada!"

# -------------------------------------------------------------
# 2. ÁUDIO OPÇÃO 2: KINETIC POP + "ESTÁ NO AR: TÁ NA REDE!"
# -------------------------------------------------------------
sudo docker exec gsa-tv-ffplayout ffmpeg -y -hide_banner -loglevel error \
  -i /media/1/identity/sfx/electronic_logo.mp3 \
  -i /media/1/identity/vinhetas/vox_esta_no_ar.mp3 \
  -i /media/1/identity/sfx/broadcast_sting.mp3 \
  -filter_complex \
  "[0:a]volume=1.1[sfx_elec]; \
   [1:a]adelay=900|900,volume=1.5[vox_call]; \
   [2:a]adelay=2800|2800,volume=1.2[sfx_end]; \
   [sfx_elec][vox_call][sfx_end]amix=inputs=3:duration=longest:dropout_transition=2,volume=1.15,alimiter=limit=0.96[aout2]" \
  -map "[aout2]" -c:a pcm_s16le -ar 48000 -ac 2 /media/1/identity/vinhetas/audio_master_opt2.wav

# VÍDEO OPÇÃO 2: KINETIC BROADCAST (6.5s)
sudo docker exec gsa-tv-ffplayout ffmpeg -y -hide_banner \
  -loop 1 -i /media/1/identity/vinhetas/opt2_kinetic_art.jpg \
  -i /media/1/identity/vinhetas/audio_master_opt2.wav \
  -filter_complex \
  "[0:v]scale=1920:1080:force_original_aspect_ratio=increase,crop=1920:1080,fps=30, \
   zoompan=z='if(lte(on,16), 0.45+0.60*(on/16), 1.02+0.02*sin(on*0.18))':x='iw/2-(iw/zoom/2)':y='ih/2-(ih/zoom/2)':d=195:s=1920x1080:fps=30, \
   drawbox=x=0:y=0:w=1920:h=1080:color=white@0.85:t=fill:enable='between(t,0.50,0.65)', \
   fade=t=out:st=5.8:d=0.7:color=white[outv2]" \
  -map "[outv2]" -map 1:a:0 \
  -c:v libx264 -preset fast -crf 17 -pix_fmt yuv420p \
  -c:a aac -b:a 256k -ar 48000 -ac 2 \
  -t 6.5 \
  /media/1/identity/vinhetas/vinheta-ta-na-rede-opcao2-kinetic.mp4

echo "Opcao 2 renderizada!"

# -------------------------------------------------------------
# 3. ATUALIZA METADADOS NO BANCO DE DADOS
# -------------------------------------------------------------
psql "postgresql://supabase_admin:GSA_SENHA_FORTE_2026@127.0.0.1:5433/gsahub" -c "
UPDATE public.gsa_tv_media_items
SET duration_s = 6.5, updated_at = NOW()
WHERE id IN ('media-vinheta-ta-na-rede-opt1', 'media-vinheta-ta-na-rede-opt2');
"
echo "=== PRONTO! AS 2 VINHETAS FORAM REGRAVADAS COM ÁUDIO DE EMISSORA REAL! ==="
`;

  const res = await runSshScript(script);
  console.log(res.stdout);
  if (res.stderr) console.error(res.stderr);
}

main().catch(console.error);
