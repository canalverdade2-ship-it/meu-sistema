import fs from 'fs';
import path from 'path';
import { runSshScript } from './ssh2-run.mjs';

const FISH_API_KEY = '__FISH_API_KEY_FROM_SECURE_VAULT__';
const VOICE_ID = '5c8a9b5d0b2549c7ada853529199ebe5'; // Impacto Comercial aprovada

const VIRAL_SEGMENTS = [
  {
    id: 'seg01_abertura',
    type: 'bumper',
    videoFile: '/media/1/news/gsa-news-2026-09-01-v2/video/vinheta-veo.mp4',
    title: 'GSA TÁ NA REDE • OS VÍDEOS QUE BOMBARAM NA WEB',
    headline: 'COMEÇA AGORA O SEU GIRO PELOS VIRAIS DA INTERNET',
    ticker: 'GSA TV • REDE 24 HORAS • OS VÍDEOS MAIS COMPARTILHADOS DO TIKTOK, INSTAGRAM E WHATSAPP',
    text: 'Fala galera conectada! Tá no ar o GSA Tá na Rede, o programa que reúne os vídeos mais engraçados, bizarros e comentados que viralizaram na internet! Se prepara que o feed hoje tá daquele jeito! Solta o primeiro!',
  },
  {
    id: 'seg02_pet_flagrante',
    type: 'vertical_viral',
    videoFile: '/media/1/news/gsa-ta-na-rede-2026-09-02/viral_raw/viral_vertical_01.mp4',
    title: 'GSA TÁ NA REDE • VIRAL DA SEMANA',
    headline: 'O FLAGRANTE MAIS ENGRAÇADO DO TIKTOK',
    ticker: 'FLAGRANTE NO CELULAR: A REAÇÃO HILÁRIA QUE BATEU MAIS DE 5 MILHÕES DE LIKES',
    text: 'E começamos com esse flagrante espetacular de pura cara de pau! Olha a reação desse cidadão de quatro patas quando o dono chega e pega ele no pulo. Ele finge demência total como quem diz: quem fez isso não fui eu! Já bateu mais de cinco milhões de curtidas nas redes!',
  },
  {
    id: 'seg03_preguica_master',
    type: 'vertical_viral',
    videoFile: '/media/1/news/gsa-ta-na-rede-2026-09-02/viral_raw/viral_vertical_02.mp4',
    title: 'GSA TÁ NA REDE • MEME DO DIA',
    headline: 'QUANDO A PREGUIÇA VENCE A BATALHA NA SEGUNDA-FEIRA',
    ticker: 'MEME VIZINHO: O VÍDEO QUE VIROU SÍMBOLO DA PREGUIÇA EM TODOS OS GRUPOS DE MENSAGEM',
    text: 'Agora diz a verdade se você não acorda exatamente assim pra trabalhar na segunda-feira! Esse guerreiro simplesmente desistiu de levantar do sofá e virou o símbolo oficial da preguiça mundial. Esse vídeo rodou em todos os grupos de WhatsApp essa semana!',
  },
  {
    id: 'seg04_desafio_fail',
    type: 'vertical_viral',
    videoFile: '/media/1/news/gsa-ta-na-rede-2026-09-02/viral_raw/funny_pet2.mp4',
    title: 'GSA TÁ NA REDE • DEU RUIM',
    headline: 'O VÍDEO QUE VIROU PIADA NAS REDES',
    ticker: 'TENTATIVA HILÁRIA DE GRAVAR PRO FEED VIRALIZA NAS PLATAFORMAS',
    text: 'E pra fechar o nosso giro viral, olha o que acontece quando a pessoa tenta inventar moda na frente da câmera pro feed do Instagram! A internet não perdoa ninguém e a gafe já rendeu milhares de remixes e comentários. É rir pra não chorar!',
  },
  {
    id: 'seg05_encerramento',
    type: 'bumper',
    videoFile: '/media/1/news/gsa-news-2026-09-01-v2/video/vinheta-veo.mp4',
    title: 'GSA TÁ NA REDE • ATÉ A PRÓXIMA',
    headline: 'MANDE SEU VÍDEO VIRAL PARA A REDAÇÃO DA GSA TV',
    ticker: 'USE A HASHTAG #GSATANAREDE • A SEGUIR: PROGRAMAÇÃO ESPECIAL 24 HORAS NO AR',
    text: 'E esse foi o GSA Tá na Rede de hoje! Viu algum vídeo épico ou mandaram aquele meme inacreditável no seu grupo? Marca a gente nas redes sociais com a hashtag GSA Tá na Rede! A seguir, continue curtindo a nossa programação aqui na GSA TV. Valeu e até a próxima!',
  }
];

async function generateAudio(text, outputFile) {
  console.log(`Gerando locução divertida no Fish Audio (${text.slice(0, 35)}...)...`);
  const res = await fetch('https://api.fish.audio/v1/tts', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${FISH_API_KEY}`,
      'Content-Type': 'application/json',
      'model': 's2.1-pro-free',
    },
    body: JSON.stringify({
      text,
      reference_id: VOICE_ID,
      format: 'mp3',
    }),
  });

  if (!res.ok) throw new Error(`Erro TTS: ${res.status}`);
  const buffer = Buffer.from(await res.arrayBuffer());
  fs.writeFileSync(outputFile, buffer);
  console.log(`✅ Áudio gravado: ${outputFile}`);
}

async function main() {
  console.log('=== PRODUZINDO GSA TÁ NA REDE (VÍDEOS VIRAIS & BORDAS DE TV) ===');
  const tempDir = path.resolve('scratch/gsa_ta_na_rede_virals');
  fs.mkdirSync(tempDir, { recursive: true });

  // 1. Gera áudios
  for (const seg of VIRAL_SEGMENTS) {
    const mp3File = path.join(tempDir, `${seg.id}.mp3`);
    await generateAudio(seg.text, mp3File);
  }

  // 2. Envia para a VPS
  console.log('\nSincronizando áudios e textos na VPS...');
  for (const seg of VIRAL_SEGMENTS) {
    const mp3File = path.join(tempDir, `${seg.id}.mp3`);
    const mp3Base64 = fs.readFileSync(mp3File).toString('base64');

    const vpsScript = `
BDIR="/opt/gsa-tv/cache/media/1/news/gsa-ta-na-rede-2026-09-02"
mkdir -p "$BDIR/audio" "$BDIR/video" "$BDIR/graphics"
echo "${mp3Base64}" | base64 -d > "$BDIR/audio/${seg.id}.mp3"

sudo docker exec gsa-tv-ffplayout ffmpeg -y -hide_banner -loglevel error \
  -i "/media/1/news/gsa-ta-na-rede-2026-09-02/audio/${seg.id}.mp3" \
  -ar 48000 -ac 2 "/media/1/news/gsa-ta-na-rede-2026-09-02/audio/${seg.id}.wav"

cat << 'EOF' > "$BDIR/graphics/${seg.id}_title.txt"
${seg.title}
EOF

cat << 'EOF' > "$BDIR/graphics/${seg.id}_headline.txt"
${seg.headline}
EOF

cat << 'EOF' > "$BDIR/graphics/${seg.id}_ticker.txt"
${seg.ticker}
EOF
`;
    await runSshScript(vpsScript);
    console.log(`✅ Segmento ${seg.id} preparado na VPS.`);
  }

  // 3. Monta o script de renderização completo na VPS
  console.log('\nCriando script de renderização com bordas de TV...');
  const renderScriptContent = `#!/bin/bash
set -e
BDIR="/media/1/news/gsa-ta-na-rede-2026-09-02"
HOST_BDIR="/opt/gsa-tv/cache/media/1/news/gsa-ta-na-rede-2026-09-02"
LOGO="/media/1/identity/gsa-tv-logo-transparent.png"

sudo chmod -R 777 "$HOST_BDIR"

echo "=== RENDERIZANDO SEGMENTOS DO GSA TÁ NA REDE ==="

# 1. ABERTURA (Bumper dinâmico)
DUR1=$(sudo docker exec gsa-tv-ffplayout ffprobe -v error -show_entries format=duration -of default=noprint_wrappers=1:nokey=1 "$BDIR/audio/seg01_abertura.wav")
echo "Renderizando seg01_abertura ($DUR1 s)..."
sudo docker exec gsa-tv-ffplayout ffmpeg -y -hide_banner -loglevel error \
  -stream_loop -1 -i /media/1/news/gsa-news-2026-09-01-v2/video/vinheta-veo.mp4 \
  -i "$LOGO" \
  -i "$BDIR/audio/seg01_abertura.wav" \
  -filter_complex "[0:v]scale=1920:1080:force_original_aspect_ratio=increase,crop=1920:1080,fps=30[bg]; \
   [1:v]scale=170:-1[logo]; \
   [bg][logo]overlay=W-w-30:30[v0]; \
   [v0]drawbox=x=0:y=830:w=1920:h=175:color=0x06162a@0.90:t=fill, \
   drawbox=x=0:y=830:w=1920:h=5:color=0xc99a3b@1:t=fill, \
   drawbox=x=0:y=955:w=1920:h=45:color=0x0b1d33@0.95:t=fill, \
   drawtext=fontfile=/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf:textfile=$BDIR/graphics/seg01_abertura_title.txt:expansion=none:fontcolor=0xe2b354:fontsize=24:x=60:y=850, \
   drawtext=fontfile=/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf:textfile=$BDIR/graphics/seg01_abertura_headline.txt:expansion=none:fontcolor=white:fontsize=32:x=60:y=890, \
   drawtext=fontfile=/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf:textfile=$BDIR/graphics/seg01_abertura_ticker.txt:expansion=none:fontcolor=white:fontsize=18:x=60:y=967[outv]" \
  -map "[outv]" -map 2:a:0 \
  -c:v libx264 -preset fast -crf 20 -pix_fmt yuv420p \
  -c:a aac -b:a 192k -ar 48000 -ac 2 \
  -t "$DUR1" "$BDIR/video/seg01_abertura.mp4"

# 2. VIRAL 1 (Vídeo vertical com bordas laterais de TV)
DUR2=$(sudo docker exec gsa-tv-ffplayout ffprobe -v error -show_entries format=duration -of default=noprint_wrappers=1:nokey=1 "$BDIR/audio/seg02_pet_flagrante.wav")
echo "Renderizando seg02_pet_flagrante ($DUR2 s)..."
sudo docker exec gsa-tv-ffplayout ffmpeg -y -hide_banner -loglevel error \
  -stream_loop -1 -i "$BDIR/viral_raw/viral_vertical_01.mp4" \
  -i "$LOGO" \
  -i "$BDIR/audio/seg02_pet_flagrante.wav" \
  -filter_complex "[0:v]scale=1920:1080:force_original_aspect_ratio=increase,crop=1920:1080,boxblur=25:5,eq=brightness=-0.15[bg]; \
   [0:v]scale=-1:1000[main]; \
   [bg][main]overlay=(W-w)/2:40[v0]; \
   [1:v]scale=160:-1[logo]; \
   [v0][logo]overlay=W-w-30:30[v1]; \
   [v1]drawbox=x=60:y=80:w=300:h=54:color=0x06162a@0.85:t=fill, \
   drawbox=x=60:y=80:w=5:h=54:color=0xc99a3b@1:t=fill, \
   drawtext=fontfile=/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf:text='GSA TÁ NA REDE':fontcolor=white:fontsize=20:x=80:y=98, \
   drawbox=x=1540:y=80:w=320:h=54:color=0x06162a@0.85:t=fill, \
   drawbox=x=1855:y=80:w=5:h=54:color=0xc99a3b@1:t=fill, \
   drawtext=fontfile=/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf:text='VIRAL DA WEB':fontcolor=0xe2b354:fontsize=20:x=1565:y=98, \
   drawbox=x=0:y=830:w=1920:h=175:color=0x06162a@0.90:t=fill, \
   drawbox=x=0:y=830:w=1920:h=5:color=0xc99a3b@1:t=fill, \
   drawbox=x=0:y=955:w=1920:h=45:color=0x0b1d33@0.95:t=fill, \
   drawtext=fontfile=/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf:textfile=$BDIR/graphics/seg02_pet_flagrante_title.txt:expansion=none:fontcolor=0xe2b354:fontsize=24:x=60:y=850, \
   drawtext=fontfile=/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf:textfile=$BDIR/graphics/seg02_pet_flagrante_headline.txt:expansion=none:fontcolor=white:fontsize=32:x=60:y=890, \
   drawtext=fontfile=/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf:textfile=$BDIR/graphics/seg02_pet_flagrante_ticker.txt:expansion=none:fontcolor=white:fontsize=18:x=60:y=967[outv]" \
  -map "[outv]" -map 2:a:0 \
  -c:v libx264 -preset fast -crf 20 -pix_fmt yuv420p \
  -c:a aac -b:a 192k -ar 48000 -ac 2 \
  -t "$DUR2" "$BDIR/video/seg02_pet_flagrante.mp4"

# 3. VIRAL 2 (Vídeo vertical com bordas de TV)
DUR3=$(sudo docker exec gsa-tv-ffplayout ffprobe -v error -show_entries format=duration -of default=noprint_wrappers=1:nokey=1 "$BDIR/audio/seg03_preguica_master.wav")
echo "Renderizando seg03_preguica_master ($DUR3 s)..."
sudo docker exec gsa-tv-ffplayout ffmpeg -y -hide_banner -loglevel error \
  -stream_loop -1 -i "$BDIR/viral_raw/viral_vertical_02.mp4" \
  -i "$LOGO" \
  -i "$BDIR/audio/seg03_preguica_master.wav" \
  -filter_complex "[0:v]scale=1920:1080:force_original_aspect_ratio=increase,crop=1920:1080,boxblur=25:5,eq=brightness=-0.15[bg]; \
   [0:v]scale=-1:1000[main]; \
   [bg][main]overlay=(W-w)/2:40[v0]; \
   [1:v]scale=160:-1[logo]; \
   [v0][logo]overlay=W-w-30:30[v1]; \
   [v1]drawbox=x=60:y=80:w=300:h=54:color=0x06162a@0.85:t=fill, \
   drawbox=x=60:y=80:w=5:h=54:color=0xc99a3b@1:t=fill, \
   drawtext=fontfile=/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf:text='GSA TÁ NA REDE':fontcolor=white:fontsize=20:x=80:y=98, \
   drawbox=x=1540:y=80:w=320:h=54:color=0x06162a@0.85:t=fill, \
   drawbox=x=1855:y=80:w=5:h=54:color=0xc99a3b@1:t=fill, \
   drawtext=fontfile=/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf:text='VIRAL DA WEB':fontcolor=0xe2b354:fontsize=20:x=1565:y=98, \
   drawbox=x=0:y=830:w=1920:h=175:color=0x06162a@0.90:t=fill, \
   drawbox=x=0:y=830:w=1920:h=5:color=0xc99a3b@1:t=fill, \
   drawbox=x=0:y=955:w=1920:h=45:color=0x0b1d33@0.95:t=fill, \
   drawtext=fontfile=/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf:textfile=$BDIR/graphics/seg03_preguica_master_title.txt:expansion=none:fontcolor=0xe2b354:fontsize=24:x=60:y=850, \
   drawtext=fontfile=/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf:textfile=$BDIR/graphics/seg03_preguica_master_headline.txt:expansion=none:fontcolor=white:fontsize=32:x=60:y=890, \
   drawtext=fontfile=/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf:textfile=$BDIR/graphics/seg03_preguica_master_ticker.txt:expansion=none:fontcolor=white:fontsize=18:x=60:y=967[outv]" \
  -map "[outv]" -map 2:a:0 \
  -c:v libx264 -preset fast -crf 20 -pix_fmt yuv420p \
  -c:a aac -b:a 192k -ar 48000 -ac 2 \
  -t "$DUR3" "$BDIR/video/seg03_preguica_master.mp4"

# 4. VIRAL 3 (Vídeo viral divertido com bordas de TV)
DUR4=$(sudo docker exec gsa-tv-ffplayout ffprobe -v error -show_entries format=duration -of default=noprint_wrappers=1:nokey=1 "$BDIR/audio/seg04_desafio_fail.wav")
echo "Renderizando seg04_desafio_fail ($DUR4 s)..."
sudo docker exec gsa-tv-ffplayout ffmpeg -y -hide_banner -loglevel error \
  -stream_loop -1 -i "$BDIR/viral_raw/funny_pet2.mp4" \
  -i "$LOGO" \
  -i "$BDIR/audio/seg04_desafio_fail.wav" \
  -filter_complex "[0:v]scale=1920:1080:force_original_aspect_ratio=increase,crop=1920:1080,boxblur=25:5,eq=brightness=-0.15[bg]; \
   [0:v]scale=-1:1000[main]; \
   [bg][main]overlay=(W-w)/2:40[v0]; \
   [1:v]scale=160:-1[logo]; \
   [v0][logo]overlay=W-w-30:30[v1]; \
   [v1]drawbox=x=60:y=80:w=300:h=54:color=0x06162a@0.85:t=fill, \
   drawbox=x=60:y=80:w=5:h=54:color=0xc99a3b@1:t=fill, \
   drawtext=fontfile=/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf:text='GSA TÁ NA REDE':fontcolor=white:fontsize=20:x=80:y=98, \
   drawbox=x=1540:y=80:w=320:h=54:color=0x06162a@0.85:t=fill, \
   drawbox=x=1855:y=80:w=5:h=54:color=0xc99a3b@1:t=fill, \
   drawtext=fontfile=/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf:text='VIRAL DA WEB':fontcolor=0xe2b354:fontsize=20:x=1565:y=98, \
   drawbox=x=0:y=830:w=1920:h=175:color=0x06162a@0.90:t=fill, \
   drawbox=x=0:y=830:w=1920:h=5:color=0xc99a3b@1:t=fill, \
   drawbox=x=0:y=955:w=1920:h=45:color=0x0b1d33@0.95:t=fill, \
   drawtext=fontfile=/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf:textfile=$BDIR/graphics/seg04_desafio_fail_title.txt:expansion=none:fontcolor=0xe2b354:fontsize=24:x=60:y=850, \
   drawtext=fontfile=/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf:textfile=$BDIR/graphics/seg04_desafio_fail_headline.txt:expansion=none:fontcolor=white:fontsize=32:x=60:y=890, \
   drawtext=fontfile=/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf:textfile=$BDIR/graphics/seg04_desafio_fail_ticker.txt:expansion=none:fontcolor=white:fontsize=18:x=60:y=967[outv]" \
  -map "[outv]" -map 2:a:0 \
  -c:v libx264 -preset fast -crf 20 -pix_fmt yuv420p \
  -c:a aac -b:a 192k -ar 48000 -ac 2 \
  -t "$DUR4" "$BDIR/video/seg04_desafio_fail.mp4"

# 5. ENCERRAMENTO
DUR5=$(sudo docker exec gsa-tv-ffplayout ffprobe -v error -show_entries format=duration -of default=noprint_wrappers=1:nokey=1 "$BDIR/audio/seg05_encerramento.wav")
echo "Renderizando seg05_encerramento ($DUR5 s)..."
sudo docker exec gsa-tv-ffplayout ffmpeg -y -hide_banner -loglevel error \
  -stream_loop -1 -i /media/1/news/gsa-news-2026-09-01-v2/video/vinheta-veo.mp4 \
  -i "$LOGO" \
  -i "$BDIR/audio/seg05_encerramento.wav" \
  -filter_complex "[0:v]scale=1920:1080:force_original_aspect_ratio=increase,crop=1920:1080,fps=30[bg]; \
   [1:v]scale=170:-1[logo]; \
   [bg][logo]overlay=W-w-30:30[v0]; \
   [v0]drawbox=x=0:y=830:w=1920:h=175:color=0x06162a@0.90:t=fill, \
   drawbox=x=0:y=830:w=1920:h=5:color=0xc99a3b@1:t=fill, \
   drawbox=x=0:y=955:w=1920:h=45:color=0x0b1d33@0.95:t=fill, \
   drawtext=fontfile=/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf:textfile=$BDIR/graphics/seg05_encerramento_title.txt:expansion=none:fontcolor=0xe2b354:fontsize=24:x=60:y=850, \
   drawtext=fontfile=/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf:textfile=$BDIR/graphics/seg05_encerramento_headline.txt:expansion=none:fontcolor=white:fontsize=32:x=60:y=890, \
   drawtext=fontfile=/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf:textfile=$BDIR/graphics/seg05_encerramento_ticker.txt:expansion=none:fontcolor=white:fontsize=18:x=60:y=967[outv]" \
  -map "[outv]" -map 2:a:0 \
  -c:v libx264 -preset fast -crf 20 -pix_fmt yuv420p \
  -c:a aac -b:a 192k -ar 48000 -ac 2 \
  -t "$DUR5" "$BDIR/video/seg05_encerramento.mp4"

echo "=== CONCATENANDO PROGRAMA MASTER ==="
cat << 'EOF' > "$HOST_BDIR/video/concat_virais.txt"
file '/media/1/news/gsa-ta-na-rede-2026-09-02/video/seg01_abertura.mp4'
file '/media/1/news/gsa-ta-na-rede-2026-09-02/video/seg02_pet_flagrante.mp4'
file '/media/1/news/gsa-ta-na-rede-2026-09-02/video/seg03_preguica_master.mp4'
file '/media/1/news/gsa-ta-na-rede-2026-09-02/video/seg04_desafio_fail.mp4'
file '/media/1/news/gsa-ta-na-rede-2026-09-02/video/seg05_encerramento.mp4'
EOF

sudo docker exec gsa-tv-ffplayout ffmpeg -y -hide_banner -loglevel error \
  -f concat -safe 0 -i "$BDIR/video/concat_virais.txt" \
  -c:v copy -c:a copy \
  "$BDIR/video/gsa-ta-na-rede-final.mp4"

FINAL_DUR=$(sudo docker exec gsa-tv-ffplayout ffprobe -v error -show_entries format=duration -of default=noprint_wrappers=1:nokey=1 "$BDIR/video/gsa-ta-na-rede-final.mp4")
FINAL_DUR_INT=$(echo "$FINAL_DUR" | cut -d'.' -f1)

echo "=== MASTER VIRAL CONCLUÍDO! DURAÇÃO: $FINAL_DUR s ==="

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
  'GSA Tá na Rede — Edição Oficial (Os Melhores Vídeos Virais da Internet)',
  'gsa-ta-na-rede-final.mp4',
  \${FINAL_DUR_INT:-95},
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
    'theme', 'virais_internet',
    'preset_id', 'gsa_ta_na_rede',
    'voice', 'Impacto Comercial (5c8a9b5d)',
    'format', '1080p30 H.264 stereo 48kHz com bordas laterais de TV',
    'scenes', 5
  )
);

UPDATE public.gsa_tv_jobs
SET status = 'completed',
    progress = 100,
    current_stage = 'Edição de Vídeos Virais finalizada com sucesso! Disponível na Biblioteca.',
    finished_at = now()
WHERE job_type = 'ai_flow_vids_generate'
  AND payload->>'preset_id' = 'gsa_ta_na_rede';
"

echo "=== TUDO PRONTO COM SUCESSO! ==="
`;

  fs.writeFileSync('scratch/render_virais.sh', renderScriptContent);
  const base64 = Buffer.from(renderScriptContent).toString('base64');
  console.log('Enviando script de renderização dos virais para a VPS...');
  await runSshScript(`echo "${base64}" | base64 -d > /tmp/render_virais.sh && chmod +x /tmp/render_virais.sh`);

  console.log('Disparando renderização completa dos vídeos virais...');
  const renderRes = await runSshScript('bash /tmp/render_virais.sh && rm -f /tmp/render_virais.sh');
  console.log('OUTPUT:\n', renderRes.stdout);
  if (renderRes.stderr) console.error('STDERR:\n', renderRes.stderr);
  console.log('🎉 PROGRAMA DE VÍDEOS VIRAIS CONCLUÍDO COM SUCESSO!');
}

main().catch(console.error);
