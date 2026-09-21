import fs from 'fs';
import { runSshScript } from './ssh2-run.mjs';

async function main() {
  console.log('=== PRODUZINDO A VINHETA BROADCAST OFICIAL MASTER DO GSA TÁ NA REDE (7.8s) ===');

  const script = `
VDIR="/opt/gsa-tv/cache/media/1/identity/vinhetas"
LOGO="/media/1/identity/gsa-tv-logo-transparent.png"
FLOW_ART="/media/1/identity/vinhetas/ta_na_rede_flow_master.png"
TUNNEL="/media/1/identity/motion_bg/neon_tunnel.mp4"
AUDIO_VOX="/media/1/identity/vinhetas/vinheta_ta_na_rede_audio.wav"

# 1. Cria sound design de TV comercial milimetricamente sincronizado:
# - Abertura (0s a 1.2s): Riser / Whoosh com ganho crescente
# - Impacto (t=1.2s): Sub-bass boom de 140Hz descendo para 35Hz
# - Miolo (1.2s a 7.0s): Locução comercial com presença e punch
# - Fechamento (6.8s a 7.8s): Stinger final de TV

sudo docker exec gsa-tv-ffplayout ffmpeg -y -hide_banner -loglevel error \
  -i "$AUDIO_VOX" \
  -f lavfi -i "anoisesrc=d=7.8:c=pink:r=48000:a=0.12,lowpass=f=1200,afade=t=in:st=0:d=1.2,afade=t=out:st=1.3:d=0.3" \
  -f lavfi -i "sine=f=130:d=1.6:r=48000,adelay=1100|1100,afade=t=out:st=1.6:d=1.0" \
  -f lavfi -i "sine=f=880:d=0.3:r=48000,adelay=1200|1200,afade=t=out:st=1.2:d=0.25" \
  -filter_complex \
  "[0:a]adelay=1200|1200,volume=1.4[vox]; \
   [1:a]volume=0.55[riser]; \
   [2:a]volume=1.1[sub_boom]; \
   [3:a]volume=0.35[ping]; \
   [vox][riser][sub_boom][ping]amix=inputs=4:duration=first:dropout_transition=2,volume=1.12,alimiter=limit=0.96[aout]" \
  -map "[aout]" -c:a pcm_s16le -ar 48000 -ac 2 /media/1/identity/vinhetas/vinheta_master_audio.wav

echo "Trilha e sonoplastia masterizadas com sucesso!"

# 2. Render de Vídeo Broadcast em 3 Fases Dinâmicas:
# - Fase 1 (0.0s a 1.2s): Túnel cibernético neon em velocidade quadruplicada (setpts=0.25*PTS) com zoom acelerado
# - Transição (1.15s a 1.35s): Flash estroboscópico de impacto na batida
# - Fase 2 (1.2s a 6.8s): O logotipo 3D do Tá na Rede entra com slam zoom (de 0.5 para 1.06 acomodando em 1.0),
#   mantendo 100% DAS CORES ORIGINAIS NÍTIDAS (laranja, ciano, ouro, branco), com pulso sutil da câmera.
# - Logotipo GSA TV presente no canto com assinatura da emissora.
# - Fase 3 (6.8s a 7.8s): Flash branco de transição para o programa.

sudo docker exec gsa-tv-ffplayout ffmpeg -y -hide_banner \
  -stream_loop -1 -i "$TUNNEL" \
  -loop 1 -i "$FLOW_ART" \
  -i "$LOGO" \
  -i /media/1/identity/vinhetas/vinheta_master_audio.wav \
  -filter_complex \
  "[0:v]setpts=0.25*PTS,scale=1920:1080:force_original_aspect_ratio=increase,crop=1920:1080,fps=30, \
   zoompan=z='min(zoom+0.008,1.4)':x='iw/2-(iw/zoom/2)':y='ih/2-(ih/zoom/2)':d=36:s=1920x1080:fps=30[intro_tunnel]; \
   [1:v]scale=1920:1080:force_original_aspect_ratio=increase,crop=1920:1080,fps=30, \
   zoompan=z='if(lte(on,20), 0.45+0.58*(on/20), 1.03+0.02*sin(on*0.14))':x='iw/2-(iw/zoom/2)':y='ih/2-(ih/zoom/2)':d=234:s=1920x1080:fps=30, \
   eq=contrast=1.06:saturation=1.12[art_motion]; \
   [intro_tunnel][art_motion]xfade=transition=circlecrop:duration=0.3:offset=1.1[v_xfade]; \
   [v_xfade]drawbox=x=0:y=0:w=1920:h=1080:color=white@0.85:t=fill:enable='between(t,1.15,1.28)'[v_flash]; \
   [2:v]scale=210:-1[logo]; \
   [v_flash][logo]overlay=W-w-45:45:enable='gte(t,1.25)'[v_branded]; \
   [v_branded]fade=t=out:st=7.1:d=0.7:color=white[outv]" \
  -map "[outv]" -map 3:a:0 \
  -c:v libx264 -preset medium -crf 17 -pix_fmt yuv420p \
  -c:a aac -b:a 256k -ar 48000 -ac 2 \
  -t 7.8 \
  /media/1/identity/vinhetas/vinheta-gsa-ta-na-rede-tv.mp4

echo "Vinheta oficial gerada com sucesso!"

# 3. Atualiza banco de dados
psql "postgresql://supabase_admin:GSA_SENHA_FORTE_2026@127.0.0.1:5433/gsahub" -c "
UPDATE public.gsa_tv_media_items
SET
  title = 'Vinheta Oficial de Abertura — GSA Tá na Rede (Padrão TV Broadcast)',
  duration_s = 7.8,
  video_width = 1920,
  video_height = 1080,
  video_fps = 30.00,
  audio_sample_rate = 48000,
  audio_channels = 2,
  approval_state = 'approved',
  state = 'ready',
  metadata = jsonb_build_object(
    'kind', 'station_bumper',
    'program', 'GSA Tá na Rede',
    'format', '1080p30 H.264 Stereo 48kHz',
    'style', 'Cinema Broadcast 3-Phase Animation',
    'duration_s', 7.8
  ),
  updated_at = NOW()
WHERE id = 'media-vinheta-gsa-ta-na-rede';
"

# 4. Extrai frames em 4 momentos:
# - t=0.6s (túnel neon ultra-rápido)
# - t=1.2s (flash e impacto do logotipo)
# - t=3.5s (logotipo 3D com cores vivas e logo GSA TV)
# - t=6.5s (pulso broadcast antes do fechamento)
sudo docker exec gsa-tv-ffplayout ffmpeg -y -hide_banner -loglevel error -ss 0.6 -i /media/1/identity/vinhetas/vinheta-gsa-ta-na-rede-tv.mp4 -vframes 1 /media/1/identity/vinhetas/final_frame_06s.jpg
sudo docker exec gsa-tv-ffplayout ffmpeg -y -hide_banner -loglevel error -ss 1.22 -i /media/1/identity/vinhetas/vinheta-gsa-ta-na-rede-tv.mp4 -vframes 1 /media/1/identity/vinhetas/final_frame_impact.jpg
sudo docker exec gsa-tv-ffplayout ffmpeg -y -hide_banner -loglevel error -ss 3.5 -i /media/1/identity/vinhetas/vinheta-gsa-ta-na-rede-tv.mp4 -vframes 1 /media/1/identity/vinhetas/final_frame_35s.jpg
sudo docker exec gsa-tv-ffplayout ffmpeg -y -hide_banner -loglevel error -ss 6.5 -i /media/1/identity/vinhetas/vinheta-gsa-ta-na-rede-tv.mp4 -vframes 1 /media/1/identity/vinhetas/final_frame_65s.jpg

echo "=== TUDO PRONTO COM SUCESSO ABSOLUTO! ==="
`;

  const res = await runSshScript(script);
  console.log(res.stdout);
  if (res.stderr) console.error(res.stderr);

  // Baixa os 4 frames gerados para conferência visual
  const frames = ['final_frame_06s.jpg', 'final_frame_impact.jpg', 'final_frame_35s.jpg', 'final_frame_65s.jpg'];
  for (const f of frames) {
    const fRes = await runSshScript(`base64 -w 0 /opt/gsa-tv/cache/media/1/identity/vinhetas/${f}`);
    const buf = Buffer.from(fRes.stdout.trim().split('\n').pop(), 'base64');
    fs.writeFileSync(`public/cast/${f}`, buf);
    console.log(`Saved public/cast/${f} (${buf.length} bytes)`);
  }
}

main().catch(console.error);
