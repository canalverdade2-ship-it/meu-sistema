import fs from 'fs';
import path from 'path';
import { runSshScript } from './ssh2-run.mjs';

const FISH_API_KEY = '__FISH_API_KEY_FROM_SECURE_VAULT__';
const VOICE_ID = '5c8a9b5d0b2549c7ada853529199ebe5'; // Impacto Comercial

const VINHETAS = [
  {
    id: 'media-vinheta-gsa-ta-na-rede',
    filename: 'vinheta-gsa-ta-na-rede.mp4',
    title: 'Vinheta Oficial — GSA Tá na Rede',
    programName: 'GSA TÁ NA REDE',
    subtitle: 'VÍDEOS VIRAIS • MEMES • TENDÊNCIAS DA INTERNET',
    bgVideo: '/media/1/news/gsa-ta-na-rede-2026-09-02/viral_raw/viral_vertical_01.mp4',
    isVerticalBg: true,
    text: 'GSA Tá na Rede! Os vídeos que bombam, memes e tudo o que viralizou na internet, agora na sua GSA TV!',
  },
  {
    id: 'media-vinheta-gsa-news',
    filename: 'vinheta-gsa-news.mp4',
    title: 'Vinheta Oficial — GSA News (Edição Principal)',
    programName: 'GSA NEWS',
    subtitle: 'JORNALISMO COM CREDIBILIDADE • REDE 24 HORAS',
    bgVideo: '/media/1/news/gsa-news-2026-09-01-v2/video/vinheta-veo.mp4',
    isVerticalBg: false,
    text: 'GSA News! A informação com credibilidade, agilidade e profundidade no seu canal de notícias. GSA TV!',
  },
  {
    id: 'media-vinheta-gsa-boletim-financeiro',
    filename: 'vinheta-gsa-boletim-financeiro.mp4',
    title: 'Vinheta Oficial — GSA Mercado',
    programName: 'GSA BOLETIM FINANCEIRO',
    subtitle: 'MERCADO DE CAPITAIS • COTAÇÕES • ECONOMIA & NEGÓCIOS',
    bgVideo: '/media/1/news/gsa-news-2026-09-01-v2/motion/comercio.webm',
    isVerticalBg: false,
    text: 'GSA Mercado! Cotações, mercado de capitais, economia e as análises que movimentam o seu negócio!',
  },
  {
    id: 'media-vinheta-gsa-manha-news',
    filename: 'vinheta-gsa-manha-news.mp4',
    title: 'Vinheta Oficial — GSA Manhã News',
    programName: 'GSA MANHÃ NEWS',
    subtitle: 'A SUA PRIMEIRA EDIÇÃO DO DIA • NOTÍCIAS & TEMPO',
    bgVideo: '/media/1/news/gsa-news-2026-09-01-v2/motion/clima.webm',
    isVerticalBg: false,
    text: 'GSA Manhã News! Os primeiros destaques do dia, agronegócio, previsão do tempo e serviços para começar bem informado!',
  }
];

async function generateAudio(text, outputFile) {
  console.log(`Gerando áudio da vinheta (${text.slice(0, 35)}...)...`);
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
  console.log('=== PRODUZINDO PACOTE DAS 4 VINHETAS PRINCIPAIS DA GSA TV ===');
  const tempDir = path.resolve('scratch/vinhetas_build');
  fs.mkdirSync(tempDir, { recursive: true });

  // 1. Grava áudios de todas as vinhetas
  for (const v of VINHETAS) {
    const mp3 = path.join(tempDir, `${v.id}.mp3`);
    await generateAudio(v.text, mp3);
  }

  // 2. Envia para a VPS
  console.log('\nSincronizando áudios e grafismos na VPS...');
  for (const v of VINHETAS) {
    const mp3 = path.join(tempDir, `${v.id}.mp3`);
    const mp3Base64 = fs.readFileSync(mp3).toString('base64');

    const vpsScript = `
mkdir -p /opt/gsa-tv/cache/media/1/identity/vinhetas
echo "${mp3Base64}" | base64 -d > /opt/gsa-tv/cache/media/1/identity/vinhetas/${v.id}.mp3

sudo docker exec gsa-tv-ffplayout ffmpeg -y -hide_banner -loglevel error \
  -i "/media/1/identity/vinhetas/${v.id}.mp3" \
  -ar 48000 -ac 2 "/media/1/identity/vinhetas/${v.id}.wav"

cat << 'EOF' > /opt/gsa-tv/cache/media/1/identity/vinhetas/${v.id}_name.txt
${v.programName}
EOF

cat << 'EOF' > /opt/gsa-tv/cache/media/1/identity/vinhetas/${v.id}_sub.txt
${v.subtitle}
EOF
`;
    await runSshScript(vpsScript);
    console.log(`✅ Arquivos de ${v.programName} sincronizados na VPS.`);
  }

  // 3. Monta script de renderização das vinhetas na VPS
  console.log('\nCriando script de renderização broadcast das vinhetas...');
  let bashCommands = `#!/bin/bash
set -e
BDIR="/media/1/identity/vinhetas"
LOGO="/media/1/identity/gsa-tv-logo-transparent.png"
sudo chmod -R 777 /opt/gsa-tv/cache/media/1/identity/vinhetas

`;

  for (const v of VINHETAS) {
    let filter;
    if (v.isVerticalBg) {
      // Blur no fundo + vídeo central + lower third de vinheta
      filter = `[0:v]scale=1920:1080:force_original_aspect_ratio=increase,crop=1920:1080,boxblur=25:5,eq=brightness=-0.10[bg]; \\
[0:v]scale=-1:1000[main]; \\
[bg][main]overlay=(W-w)/2:40[v0]; \\
[1:v]scale=180:-1[logo]; \\
[v0][logo]overlay=W-w-40:40[v1]; \\
[v1]drawbox=x=0:y=780:w=1920:h=220:color=0x06162a@0.92:t=fill, \\
drawbox=x=0:y=780:w=1920:h=6:color=0xc99a3b@1:t=fill, \\
drawbox=x=0:y=920:w=1920:h=45:color=0x0b1d33@0.95:t=fill, \\
drawtext=fontfile=/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf:textfile=$BDIR/${v.id}_name.txt:expansion=none:fontcolor=0xe2b354:fontsize=42:x=(w-text_w)/2:y=820, \\
drawtext=fontfile=/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf:textfile=$BDIR/${v.id}_sub.txt:expansion=none:fontcolor=white:fontsize=20:x=(w-text_w)/2:y=932[outv]`;
    } else {
      // Horizontal vídeo com vinheta central impactante
      filter = `[0:v]scale=1920:1080:force_original_aspect_ratio=increase,crop=1920:1080,fps=30[bg]; \\
[1:v]scale=180:-1[logo]; \\
[bg][logo]overlay=W-w-40:40[v0]; \\
[v0]drawbox=x=0:y=780:w=1920:h=220:color=0x06162a@0.92:t=fill, \\
drawbox=x=0:y=780:w=1920:h=6:color=0xc99a3b@1:t=fill, \\
drawbox=x=0:y=920:w=1920:h=45:color=0x0b1d33@0.95:t=fill, \\
drawtext=fontfile=/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf:textfile=$BDIR/${v.id}_name.txt:expansion=none:fontcolor=0xe2b354:fontsize=42:x=(w-text_w)/2:y=820, \\
drawtext=fontfile=/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf:textfile=$BDIR/${v.id}_sub.txt:expansion=none:fontcolor=white:fontsize=20:x=(w-text_w)/2:y=932[outv]`;
    }

    bashCommands += `
DUR=$(sudo docker exec gsa-tv-ffplayout ffprobe -v error -show_entries format=duration -of default=noprint_wrappers=1:nokey=1 "$BDIR/${v.id}.wav")
echo ">>> Renderizando vinheta ${v.programName} (duracao: $DUR s)..."

sudo docker exec gsa-tv-ffplayout ffmpeg -y -hide_banner -loglevel error \\
  -stream_loop -1 -i "${v.bgVideo}" \\
  -i "$LOGO" \\
  -i "$BDIR/${v.id}.wav" \\
  -filter_complex "${filter}" \\
  -map "[outv]" -map 2:a:0 \\
  -c:v libx264 -preset fast -crf 19 -pix_fmt yuv420p \\
  -c:a aac -b:a 192k -ar 48000 -ac 2 \\
  -t "$DUR" \\
  "$BDIR/${v.filename}"

echo "OK: ${v.filename} gerado!"
DUR_INT=$(echo "$DUR" | cut -d'.' -f1)

# Cadastra no PostgreSQL
psql "postgresql://supabase_admin:GSA_SENHA_FORTE_2026@127.0.0.1:5433/gsahub" -c "
DELETE FROM public.gsa_tv_media_items WHERE id = '${v.id}';

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
  '${v.id}',
  'ch-main',
  '${v.title}',
  '${v.filename}',
  12,
  'h264',
  1920,
  1080,
  30.00,
  'aac',
  48000,
  2,
  'ready',
  true,
  '/media/1/identity/vinhetas/${v.filename}',
  'identity',
  'ai',
  true,
  'approved',
  jsonb_build_object(
    'kind', 'station_bumper',
    'program', '${v.programName}',
    'voice', 'Impacto Comercial (5c8a9b5d)',
    'format', '1080p30 H.264 stereo 48kHz'
  )
);
"
`;
  }

  bashCommands += `\necho "=== TODAS AS 4 VINHETAS FORAM RENDERIZADAS E REGISTRADAS COM SUCESSO! ==="\n`;

  fs.writeFileSync('scratch/render_vinhetas.sh', bashCommands);
  const b64 = Buffer.from(bashCommands).toString('base64');
  await runSshScript(`echo "${b64}" | base64 -d > /tmp/render_vinhetas.sh && chmod +x /tmp/render_vinhetas.sh`);

  console.log('Disparando renderização na VPS...');
  const renderRes = await runSshScript('bash /tmp/render_vinhetas.sh && rm -f /tmp/render_vinhetas.sh');
  console.log('OUTPUT:\n', renderRes.stdout);
  if (renderRes.stderr) console.error('STDERR:\n', renderRes.stderr);
  console.log('🎉 PACOTE DE VINHETAS CONCLUÍDO COM SUCESSO!');
}

main().catch(console.error);
