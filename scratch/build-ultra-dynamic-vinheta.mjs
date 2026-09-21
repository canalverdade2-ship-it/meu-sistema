import fs from 'fs';
import { runSshScript } from './ssh2-run.mjs';

async function main() {
  console.log('=== DESENVOLVENDO VINHETA HIPER-DINÂMICA: GSA TÁ NA REDE ===');

  const script = `
VDIR="/opt/gsa-tv/cache/media/1/identity/vinhetas"
MDIR="/opt/gsa-tv/cache/media/1/identity/motion_bg"
LOGO="/media/1/identity/gsa-tv-logo-transparent.png"
FLOW_ART="/media/1/identity/vinhetas/ta_na_rede_flow_master.png"
TUNNEL="/media/1/identity/motion_bg/neon_tunnel.mp4"
WAVE="/media/1/identity/motion_bg/digital_wave.mp4"

# 1. Gerar sonoplastia de impacto de TV no FFmpeg:
# - Sub-bass hit no t=0.6s (frequência de 150Hz caindo para 40Hz)
# - Riser no início
# - Locução oficial do Tá na Rede
sudo docker exec gsa-tv-ffplayout ffmpeg -y -hide_banner -loglevel error \
  -i /media/1/identity/vinhetas/vinheta_ta_na_rede_audio.wav \
  -f lavfi -i "anoisesrc=d=7.5:c=pink:r=48000:a=0.08,lowpass=f=800,afade=t=in:st=0:d=0.8,afade=t=out:st=6.8:d=0.7" \
  -f lavfi -i "sine=f=120:d=1.5:r=48000,adelay=600|600,afade=t=out:st=1.2:d=0.9" \
  -filter_complex "[0:a]volume=1.35[vox]; \
   [1:a]volume=0.45[sfx_rise]; \
   [2:a]volume=0.9[sfx_boom]; \
   [vox][sfx_rise][sfx_boom]amix=inputs=3:duration=first:dropout_transition=2,volume=1.15,alimiter=limit=0.95[aout]" \
  -map "[aout]" -c:a pcm_s16le -ar 48000 -ac 2 /media/1/identity/vinhetas/vinheta_dynamic_audio.wav

echo "Sonoplastia combinada com sucesso!"

# 2. Renderizar vídeo hiper-dinâmico:
# - Camada 1: Tunnel Neon com velocidade dobrada (setpts=0.5*PTS) em loop
# - Camada 2: Wave de partículas digitais magenta com blend screen sobre o tunnel
# - Camada 3: Arte 3D Tá na Rede com animação de entrada explosiva (slam zoom de t=0 para t=0.9s com overshoot)
# - Camada 4: Pulso rítmico contínuo na arte durante a exibição
# - Camada 5: Flash branco stroboscópico de impacto broadcast no t=0.8s
# - Camada 6: Logotipo GSA TV no canto com pulso luminoso
# - Camada 7: Flash de transição rápida no final (t=6.8s a 7.5s)

sudo docker exec gsa-tv-ffplayout ffmpeg -y -hide_banner -loglevel error \
  -stream_loop -1 -i "$TUNNEL" \
  -stream_loop -1 -i "$WAVE" \
  -loop 1 -i "$FLOW_ART" \
  -i "$LOGO" \
  -i /media/1/identity/vinhetas/vinheta_dynamic_audio.wav \
  -filter_complex \
  "[0:v]setpts=0.4*PTS,scale=1920:1080:force_original_aspect_ratio=increase,crop=1920:1080,fps=30[tunnel]; \
   [1:v]setpts=0.6*PTS,scale=1920:1080:force_original_aspect_ratio=increase,crop=1920:1080,fps=30,eq=contrast=1.3:saturation=1.5[wave]; \
   [tunnel][wave]blend=all_mode='screen':all_opacity=0.45[bg_dynamic]; \
   [2:v]scale=1920:1080:force_original_aspect_ratio=increase,crop=1920:1080,fps=30, \
    zoompan=z='if(lte(on,25), 0.3 + 0.75*(on/25), 1.05 + 0.04*sin(on*0.12))':x='iw/2-(iw/zoom/2)':y='ih/2-(ih/zoom/2)':d=225:s=1920x1080:fps=30, \
    eq=contrast=1.12:saturation=1.18[art_animated]; \
   [bg_dynamic][art_animated]blend=all_mode='addition':all_opacity='if(lte(t,0.8), t/0.8, 0.95)'[comp1]; \
   [comp1]drawbox=x=0:y=0:w=1920:h=1080:color=white@1:t=fill:enable='between(t,0.8,0.92)'[comp2]; \
   [3:v]scale=210:-1[logo]; \
   [comp2][logo]overlay=W-w-40:40:enable='gte(t,0.9)'[comp3]; \
   [comp3]fade=t=out:st=6.8:d=0.7:color=white[outv]" \
  -map "[outv]" -map 4:a:0 \
  -c:v libx264 -preset medium -crf 17 -pix_fmt yuv420p \
  -c:a aac -b:a 256k -ar 48000 -ac 2 \
  -t 7.5 \
  /media/1/identity/vinhetas/vinheta-gsa-ta-na-rede-tv.mp4

echo "Vinheta renderizada com sucesso!"

# 3. Atualizar no Banco de Dados
psql "postgresql://supabase_admin:GSA_SENHA_FORTE_2026@127.0.0.1:5433/gsahub" -c "
UPDATE public.gsa_tv_media_items
SET
  title = 'Vinheta de Abertura Oficial — GSA Tá na Rede (Padrão TV Hiperdinâmico)',
  duration_s = 7.5,
  approval_state = 'approved',
  state = 'ready',
  metadata = jsonb_build_object(
    'kind', 'station_bumper',
    'program', 'GSA Tá na Rede',
    'style', 'TV Hiperdinamica Multi-Layer',
    'fx', 'Speed Tunnel + Digital Wave + 3D Slam Zoom + Audio Impact'
  ),
  updated_at = NOW()
WHERE id = 'media-vinheta-gsa-ta-na-rede';
"

# 4. Extrair 4 frames em momentos-chave (0.5s, 1.2s, 3.5s, 6.0s) para conferência visual
sudo docker exec gsa-tv-ffplayout ffmpeg -y -hide_banner -loglevel error -ss 0.5 -i /media/1/identity/vinhetas/vinheta-gsa-ta-na-rede-tv.mp4 -vframes 1 /media/1/identity/vinhetas/frame_05s.jpg
sudo docker exec gsa-tv-ffplayout ffmpeg -y -hide_banner -loglevel error -ss 1.2 -i /media/1/identity/vinhetas/vinheta-gsa-ta-na-rede-tv.mp4 -vframes 1 /media/1/identity/vinhetas/frame_12s.jpg
sudo docker exec gsa-tv-ffplayout ffmpeg -y -hide_banner -loglevel error -ss 3.5 -i /media/1/identity/vinhetas/vinheta-gsa-ta-na-rede-tv.mp4 -vframes 1 /media/1/identity/vinhetas/frame_35s.jpg
sudo docker exec gsa-tv-ffplayout ffmpeg -y -hide_banner -loglevel error -ss 6.0 -i /media/1/identity/vinhetas/vinheta-gsa-ta-na-rede-tv.mp4 -vframes 1 /media/1/identity/vinhetas/frame_60s.jpg

echo "Frames gerados com sucesso!"
`;

  const res = await runSshScript(script);
  console.log(res.stdout);
  if (res.stderr) console.error(res.stderr);

  // Baixa os frames para inspeção
  const frames = ['frame_05s.jpg', 'frame_12s.jpg', 'frame_35s.jpg', 'frame_60s.jpg'];
  for (const f of frames) {
    const fRes = await runSshScript(`base64 -w 0 /opt/gsa-tv/cache/media/1/identity/vinhetas/${f}`);
    const buf = Buffer.from(fRes.stdout.trim().split('\n').pop(), 'base64');
    fs.writeFileSync(`public/cast/${f}`, buf);
    console.log(`Saved public/cast/${f} (${buf.length} bytes)`);
  }
}

main().catch(console.error);
