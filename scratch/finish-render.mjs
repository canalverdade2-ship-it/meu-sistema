import { runSshScript } from './ssh2-run.mjs';

async function finishRender() {
  const script = `
set -e
BDIR="/media/1/news/gsa-ta-na-rede-2026-09-02"
HOST_BDIR="/opt/gsa-tv/cache/media/1/news/gsa-ta-na-rede-2026-09-02"
LOGO="/media/1/identity/gsa-tv-logo-transparent.png"
BG_VIDEO="/media/1/news/gsa-news-2026-09-01-v2/motion/tecnologia.webm"

# Render scene 5
DUR=$(sudo docker exec gsa-tv-ffplayout ffprobe -v error -show_entries format=duration -of default=noprint_wrappers=1:nokey=1 "$BDIR/audio/cena05_encerramento.wav")
echo "Renderizando cena 05 (duracao: $DUR s)..."

sudo docker exec gsa-tv-ffplayout ffmpeg -y -hide_banner -loglevel error \
  -ss 340 -t "$DUR" \
  -i "$BG_VIDEO" \
  -i "$LOGO" \
  -i "$BDIR/audio/cena05_encerramento.wav" \
  -filter_complex "[0:v]scale=1920:1080:force_original_aspect_ratio=increase,crop=1920:1080,fps=30[bg]; \
   [1:v]scale=170:-1[logo]; \
   [bg][logo]overlay=W-w-30:30[v0]; \
   [v0]drawbox=x=0:y=830:w=1920:h=175:color=0x06162a@0.90:t=fill, \
   drawbox=x=0:y=830:w=1920:h=5:color=0xc99a3b@1:t=fill, \
   drawbox=x=0:y=955:w=1920:h=45:color=0x0b1d33@0.95:t=fill, \
   drawtext=fontfile=/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf:textfile=$BDIR/graphics/cena05_encerramento_title.txt:expansion=none:fontcolor=0xe2b354:fontsize=24:x=60:y=850, \
   drawtext=fontfile=/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf:textfile=$BDIR/graphics/cena05_encerramento_headline.txt:expansion=none:fontcolor=white:fontsize=32:x=60:y=890, \
   drawtext=fontfile=/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf:textfile=$BDIR/graphics/cena05_encerramento_ticker.txt:expansion=none:fontcolor=white:fontsize=18:x=60:y=967[outv]" \
  -map "[outv]" -map 2:a:0 \
  -c:v libx264 -preset fast -crf 20 -pix_fmt yuv420p \
  -c:a aac -b:a 192k -ar 48000 -ac 2 \
  -t "$DUR" \
  "$BDIR/video/cena05_encerramento.mp4"

echo "OK: cena05_encerramento.mp4 gerado!"

echo "Concatenando todas as 5 cenas..."
cat << 'EOF' > "$HOST_BDIR/video/concat_real.txt"
file '/media/1/news/gsa-ta-na-rede-2026-09-02/video/cena01_abertura.mp4'
file '/media/1/news/gsa-ta-na-rede-2026-09-02/video/cena02_seguranca_ia.mp4'
file '/media/1/news/gsa-ta-na-rede-2026-09-02/video/cena03_agentes_redes.mp4'
file '/media/1/news/gsa-ta-na-rede-2026-09-02/video/cena04_meta_oculos.mp4'
file '/media/1/news/gsa-ta-na-rede-2026-09-02/video/cena05_encerramento.mp4'
EOF

sudo docker exec gsa-tv-ffplayout ffmpeg -y -hide_banner -loglevel error \
  -f concat -safe 0 -i "$BDIR/video/concat_real.txt" \
  -c:v copy -c:a copy \
  "$BDIR/video/gsa-ta-na-rede-final.mp4"

FINAL_DUR=$(sudo docker exec gsa-tv-ffplayout ffprobe -v error -show_entries format=duration -of default=noprint_wrappers=1:nokey=1 "$BDIR/video/gsa-ta-na-rede-final.mp4")
FINAL_DUR_INT=$(echo "$FINAL_DUR" | cut -d'.' -f1)

echo "=== MASTER FINAL GERADO! DURAÇÃO: $FINAL_DUR s ($FINAL_DUR_INT segundos) ==="

# Registra no PostgreSQL
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
  \${FINAL_DUR_INT:-118},
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
    current_stage = 'Programa completo finalizado! Pronto para exibição na TV.',
    finished_at = now()
WHERE job_type = 'ai_flow_vids_generate'
  AND payload->>'preset_id' = 'gsa_ta_na_rede';
"

echo "TUDO FINALIZADO COM SUCESSO!"
`;

  const res = await runSshScript(script);
  console.log(res.stdout);
  if (res.stderr) console.error(res.stderr);
}

finishRender().catch(console.error);
