import { runSshScript } from './ssh2-run.mjs';

async function renderFullProgram() {
  const script = `
cat << 'EOSCRIPT' > /tmp/render_gsa_ta_na_rede.sh
#!/bin/bash
set -e

BDIR="/media/1/news/gsa-ta-na-rede-2026-09-02"
LOGO="/media/1/identity/gsa-tv-logo-transparent.png"
BG_VIDEO="/media/1/news/gsa-news-2026-09-01-v2/motion/tecnologia.webm"

echo "=== RENDERIZANDO CENAS DO GSA TÁ NA REDE ==="

render_scene() {
  SCENE_ID="\\$1"
  OFFSET="\\$2"
  
  # Mede duracao exata do audio
  DUR=\\$(sudo docker exec gsa-tv-ffplayout ffprobe -v error -show_entries format=duration -of default=noprint_wrappers=1:nokey=1 "\\$BDIR/audio/\\$SCENE_ID.wav")
  echo ">>> Renderizando \\$SCENE_ID (Duracao: \\$DUR s, Offset B-roll: \\$OFFSET s)..."
  
  sudo docker exec gsa-tv-ffplayout ffmpeg -y -hide_banner -loglevel error \\
    -ss "\\$OFFSET" -t "\\$DUR" \\
    -i "\\$BG_VIDEO" \\
    -i "\\$LOGO" \\
    -i "\\$BDIR/audio/\\$SCENE_ID.wav" \\
    -filter_complex "[0:v]scale=1920:1080:force_original_aspect_ratio=increase,crop=1920:1080,fps=30[bg]; \\
     [1:v]scale=170:-1[logo]; \\
     [bg][logo]overlay=W-w-30:30[v0]; \\
     [v0]drawbox=x=0:y=830:w=1920:h=175:color=0x06162a@0.90:t=fill, \\
     drawbox=x=0:y=830:w=1920:h=5:color=0xc99a3b@1:t=fill, \\
     drawbox=x=0:y=955:w=1920:h=45:color=0x0b1d33@0.95:t=fill, \\
     drawtext=fontfile=/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf:textfile=\\$BDIR/graphics/\\${SCENE_ID}_title.txt:expansion=none:fontcolor=0xe2b354:fontsize=24:x=60:y=850, \\
     drawtext=fontfile=/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf:textfile=\\$BDIR/graphics/\\${SCENE_ID}_headline.txt:expansion=none:fontcolor=white:fontsize=32:x=60:y=890, \\
     drawtext=fontfile=/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf:textfile=\\$BDIR/graphics/\\${SCENE_ID}_ticker.txt:expansion=none:fontcolor=white:fontsize=18:x=60:y=967[outv]" \\
    -map "[outv]" -map 2:a:0 \\
    -c:v libx264 -preset fast -crf 20 -pix_fmt yuv420p \\
    -c:a aac -b:a 192k -ar 48000 -ac 2 \\
    -t "\\$DUR" \\
    "\\$BDIR/video/\\$SCENE_ID.mp4"
  
  echo "OK: \\$SCENE_ID.mp4 gerado!"
}

render_scene "cena01_abertura" 10
render_scene "cena02_seguranca_ia" 85
render_scene "cena03_agentes_redes" 165
render_scene "cena04_meta_oculos" 250
render_scene "cena05_encerramento" 340

echo "=== CONCATENANDO NO MASTER FINAL ==="
cat << 'EOF' > /opt/gsa-tv/cache/media/1/news/gsa-ta-na-rede-2026-09-02/video/concat.txt
file '/media/1/news/gsa-ta-na-rede-2026-09-02/video/cena01_abertura.mp4'
file '/media/1/news/gsa-ta-na-rede-2026-09-02/video/cena02_seguranca_ia.mp4'
file '/media/1/news/gsa-ta-na-rede-2026-09-02/video/cena03_agentes_redes.mp4'
file '/media/1/news/gsa-ta-na-rede-2026-09-02/video/cena04_meta_oculos.mp4'
file '/media/1/news/gsa-ta-na-rede-2026-09-02/video/cena05_encerramento.mp4'
EOF

sudo docker exec gsa-tv-ffplayout ffmpeg -y -hide_banner -loglevel error \\
  -f concat -safe 0 -i "\\$BDIR/video/concat.txt" \\
  -c:v copy -c:a copy \\
  "\\$BDIR/video/gsa-ta-na-rede-final.mp4"

FINAL_DUR=\\$(sudo docker exec gsa-tv-ffplayout ffprobe -v error -show_entries format=duration -of default=noprint_wrappers=1:nokey=1 "\\$BDIR/video/gsa-ta-na-rede-final.mp4")
FINAL_DUR_INT=\\$(echo "\\$FINAL_DUR" | cut -d'.' -f1)

echo "=== MASTER FINAL CONCLUÍDO! DURAÇÃO: \\$FINAL_DUR s ==="

psql "postgresql://supabase_admin:GSA_SENHA_FORTE_2026@127.0.0.1:5433/gsahub" -c "
DELETE FROM public.gsa_tv_media_items WHERE id LIKE 'media-ai-gsa-gsa_ta_na_rede-%' OR id = 'media-gsa-ta-na-rede-2026-09-02-final';

INSERT INTO public.gsa_tv_media_items (
  id,
  channel_id,
  title,
  original_filename,
  duration_s,
  video_codec,
  video_width,
  video_height,
  video_fps,
  audio_codec,
  audio_sample_rate,
  audio_channels,
  state,
  rights_ok,
  drive_path,
  media_kind,
  source_type,
  ai_generated,
  approval_state,
  metadata
) VALUES (
  'media-gsa-ta-na-rede-2026-09-02-final',
  'ch-main',
  'GSA Tá na Rede — Edição Oficial (Tecnologia, IA & Virais)',
  'gsa-ta-na-rede-final.mp4',
  \\${FINAL_DUR_INT:-118},
  'h264',
  1920,
  1080,
  30.00,
  'aac',
  48000,
  2,
  'ready',
  true,
  '/media/1/news/gsa-ta-na-rede-2026-09-02/video/gsa-ta-na-rede-final.mp4',
  'program',
  'ai',
  true,
  'approved',
  jsonb_build_object(
    'theme', 'viral_tech',
    'preset_id', 'gsa_ta_na_rede',
    'voice', 'Impacto Comercial (5c8a9b5d)',
    'format', '1080p30 H.264 stereo 48kHz',
    'scenes', 5
  )
);

UPDATE public.gsa_tv_jobs
SET status = 'completed',
    progress = 100,
    current_stage = 'Produção completa finalizada! O programa está disponível na Biblioteca.',
    finished_at = now()
WHERE job_type = 'ai_flow_vids_generate'
  AND payload->>'preset_id' = 'gsa_ta_na_rede';
"

echo "=== TUDO FINALIZADO COM SUCESSO NO BANCO ==="
EOSCRIPT

bash /tmp/render_gsa_ta_na_rede.sh
rm -f /tmp/render_gsa_ta_na_rede.sh
`;

  const res = await runSshScript(script);
  console.log('OUTPUT:\n', res.stdout);
  if (res.stderr) console.error('STDERR:\n', res.stderr);
}

renderFullProgram().catch(console.error);
