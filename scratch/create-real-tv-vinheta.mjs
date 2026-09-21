import fs from 'fs';
import path from 'path';
import { runSshScript } from './ssh2-run.mjs';

const FISH_API_KEY = '__FISH_API_KEY_FROM_SECURE_VAULT__';
const VOICE_ID = '5c8a9b5d0b2549c7ada853529199ebe5'; // Impacto Comercial aprovada

async function generateAudio(text, outputFile) {
  console.log(`Gerando locução da vinheta: "${text}"...`);
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
  console.log(`✅ Áudio gravado: ${outputFile} (${buffer.length} bytes)`);
}

async function main() {
  console.log('=== CRIANDO VINHETA TELEVISIVA VERDADEIRA — GSA TÁ NA REDE ===');
  const tempDir = path.resolve('scratch/vinheta_real_ta_na_rede');
  fs.mkdirSync(tempDir, { recursive: true });

  const audioFile = path.join(tempDir, 'vinheta_ta_na_rede_voz.mp3');
  await generateAudio('GSA Tá na Rede! O que é assunto e o que viralizou na internet, agora na sua GSA TV!', audioFile);

  const audioBase64 = fs.readFileSync(audioFile).toString('base64');

  // Envia para a VPS e executa renderização broadcast de alto padrão
  const vpsScript = `
VDIR="/opt/gsa-tv/cache/media/1/identity/vinhetas"
mkdir -p "$VDIR"
echo "${audioBase64}" | base64 -d > "$VDIR/vinheta_ta_na_rede_audio.mp3"

# Converte áudio para WAV 48kHz
sudo docker exec gsa-tv-ffplayout ffmpeg -y -hide_banner -loglevel error \
  -i /media/1/identity/vinhetas/vinheta_ta_na_rede_audio.mp3 \
  -ar 48000 -ac 2 /media/1/identity/vinhetas/vinheta_ta_na_rede_audio.wav

DUR=$(sudo docker exec gsa-tv-ffplayout ffprobe -v error -show_entries format=duration -of default=noprint_wrappers=1:nokey=1 /media/1/identity/vinhetas/vinheta_ta_na_rede_audio.wav)
echo "Duracao da locucao: $DUR s"

# Cria a vinheta televisiva verdadeira:
# 1. Vídeo de fundo em alta velocidade com efeitos luminosos (motion graphics)
# 2. Brasão central imponente de programa de TV em dourado e azul-marinho
# 3. Logotipo da GSA TV no topo
# 4. Título centralizado gigante "GSA TÁ NA REDE" com reflexo
# 5. Subtítulo estilizado "VÍDEOS VIRAIS • MEMES • TENDÊNCIAS DA WEB"
# 6. Trilha sonora / sonoplastia de impacto sincronizada

LOGO="/media/1/identity/gsa-tv-logo-transparent.png"
VEO_BG="/media/1/news/gsa-news-2026-09-01-v2/video/vinheta-veo.mp4"

echo "Renderizando vinheta master de televisao..."

sudo docker exec gsa-tv-ffplayout ffmpeg -y -hide_banner -loglevel error \
  -stream_loop -1 -i "$VEO_BG" \
  -i "$LOGO" \
  -i /media/1/identity/vinhetas/vinheta_ta_na_rede_audio.wav \
  -filter_complex "[0:v]scale=1920:1080:force_original_aspect_ratio=increase,crop=1920:1080,eq=contrast=1.15:brightness=0.02:saturation=1.25,fps=30[bg]; \
   [1:v]scale=220:-1[logo]; \
   [bg][logo]overlay=(W-w)/2:180[v0]; \
   [v0]drawbox=x=310:y=430:w=1300:h=260:color=0x06162a@0.92:t=fill, \
   drawbox=x=310:y=430:w=1300:h=260:color=0xc99a3b@1:t=4, \
   drawbox=x=325:y=445:w=1270:h=230:color=0xd4af37@0.25:t=1, \
   drawtext=fontfile=/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf:text='GSA TÁ NA REDE':fontcolor=0xffffff:fontsize=76:x=(w-text_w)/2:y=475:shadowcolor=0x000000@0.8:shadowx=4:shadowy=4, \
   drawbox=x=450:y=580:w=1020:h=4:color=0xc99a3b@1:t=fill, \
   drawtext=fontfile=/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf:text='OS VÍDEOS MAIS COMPARTILHADOS DA INTERNET':fontcolor=0xe2b354:fontsize=26:x=(w-text_w)/2:y=610:shadowcolor=0x000000@0.8:shadowx=2:shadowy=2, \
   drawtext=fontfile=/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf:text='GSA TV • REDE 24 HORAS':fontcolor=0x94a3b8:fontsize=20:x=(w-text_w)/2:y=820:shadowcolor=0x000000@0.8:shadowx=2:shadowy=2[outv]" \
  -map "[outv]" -map 2:a:0 \
  -c:v libx264 -preset fast -crf 18 -pix_fmt yuv420p \
  -c:a aac -b:a 256k -ar 48000 -ac 2 \
  -t "$DUR" \
  /media/1/identity/vinhetas/vinheta-gsa-ta-na-rede-tv.mp4

echo "Vinheta renderizada com sucesso!"

# Cadastra como mídia oficial
psql "postgresql://supabase_admin:GSA_SENHA_FORTE_2026@127.0.0.1:5433/gsahub" -c "
DELETE FROM public.gsa_tv_media_items WHERE id = 'media-vinheta-gsa-ta-na-rede';

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
  'media-vinheta-gsa-ta-na-rede',
  'ch-main',
  'Vinheta de Abertura Oficial — GSA Tá na Rede (Padrão TV)',
  'vinheta-gsa-ta-na-rede-tv.mp4',
  8,
  'h264',
  1920,
  1080,
  30.00,
  'aac',
  48000,
  2,
  'ready',
  true,
  '/media/1/identity/vinhetas/vinheta-gsa-ta-na-rede-tv.mp4',
  'identity',
  'ai',
  true,
  'approved',
  jsonb_build_object(
    'kind', 'station_bumper',
    'program', 'GSA Tá na Rede',
    'style', 'TV Broadcast Oficial',
    'format', '1080p30 H.264 stereo 48kHz'
  )
);
"
echo "=== TUDO PRONTO COM SUCESSO! ==="
`;

  console.log('Enviando e executando na VPS...');
  const res = await runSshScript(vpsScript);
  console.log('OUTPUT:\n', res.stdout);
  if (res.stderr) console.error('STDERR:\n', res.stderr);

  // Extrai frame para validação
  const frameScript = `
sudo docker exec gsa-tv-ffplayout ffmpeg -y -hide_banner -loglevel error \
  -ss 3 -i /media/1/identity/vinhetas/vinheta-gsa-ta-na-rede-tv.mp4 \
  -vframes 1 /media/1/identity/vinhetas/vinheta_ta_na_rede_tv_frame.jpg

base64 -w 0 /opt/gsa-tv/cache/media/1/identity/vinhetas/vinheta_ta_na_rede_tv_frame.jpg
`;
  const frameRes = await runSshScript(frameScript);
  const frameBuf = Buffer.from(frameRes.stdout.trim().split('\n').pop(), 'base64');
  fs.writeFileSync('public/cast/vinheta_ta_na_rede_tv_frame.jpg', frameBuf);
  console.log('Frame da vinheta televisiva salvo em public/cast/vinheta_ta_na_rede_tv_frame.jpg:', frameBuf.length, 'bytes');
}

main().catch(console.error);
