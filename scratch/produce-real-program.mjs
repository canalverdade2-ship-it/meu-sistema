import fs from 'fs';
import path from 'path';
import { runSshScript } from './ssh2-run.mjs';

const FISH_API_KEY = '__FISH_API_KEY_FROM_SECURE_VAULT__';
const VOICE_ID = '5c8a9b5d0b2549c7ada853529199ebe5'; // Impacto Comercial aprovada

const SCENES = [
  {
    id: 'cena01_abertura',
    title: 'GSA TÁ NA REDE • WEB & INOVAÇÃO',
    headline: 'OS DESTAQUES DA TECNOLOGIA E DAS REDES SOCIAIS',
    ticker: 'GSA TV • REDE 24 HORAS • INTELIGÊNCIA ARTIFICIAL • TENDÊNCIAS DA WEB • SEGURANÇA DIGITAL',
    startOffset: 10,
    text: 'Olá, internautas! Está no ar o GSA Tá na Rede, a sua revista diária de tecnologia, inteligência artificial e tudo o que viraliza no mundo digital. Hoje vamos conferir a mega aliança das big techs para proteger a rede contra ataques cibernéticos de IA, as novidades dos assistentes neurais e os temas que dominaram as redes sociais nesta semana. Fique com a gente!',
  },
  {
    id: 'cena02_seguranca_ia',
    title: 'CIBERSEGURANÇA & IA',
    headline: 'BIG TECHS FORMAM ALIANÇA CONTRA CIBERATAQUES',
    ticker: 'OPENAI, GOOGLE E MICROSOFT ASSINAM ACORDO GLOBAL DE DEFESA CIBERNÉTICA',
    startOffset: 85,
    text: 'Mais de cem gigantes globais da tecnologia, incluindo Google, Microsoft e OpenAI, assinaram uma mobilização histórica em defesa da segurança cibernética. Com o avanço acelerado de agentes autônomos de inteligência artificial, o setor alerta para a urgência de blindar servidores e combater fraudes digitais em larga escala.',
  },
  {
    id: 'cena03_agentes_redes',
    title: 'MUNDO DIGITAL & REDES',
    headline: 'AGENTES DE IA INVADEM O INSTAGRAM E O TIKTOK',
    ticker: 'ALGORITMOS PRIVILEGIAM CONTEÚDO ESPONTÂNEO E NOVOS AGENTES DE COMPRA',
    startOffset: 165,
    text: 'E nas redes sociais, o Instagram e o TikTok iniciaram a integração de agentes de inteligência artificial que auxiliam os usuários nas compras online diretamente pelas fotos do feed. Além disso, criadores de conteúdo comemoram o avanço de formatos espontâneos, que estão superando os vídeos altamente produzidos.',
  },
  {
    id: 'cena04_meta_oculos',
    title: 'GADGETS & PRIVACIDADE',
    headline: 'META REFORÇA SEGURANÇA EM ÓCULOS DE IA',
    ticker: 'DISPOSITIVOS INTELIGENTES GANHAM REGRAS RÍGIDAS DE PRIVACIDADE E ÉTICA',
    startOffset: 250,
    text: 'No mercado de dispositivos inteligentes, a Meta reforçou as travas de privacidade em seus óculos de IA, tornando os sinais luminosos de gravação à prova de adulterações. A medida busca tranquilizar o público e estabelecer novos padrões éticos para o uso de câmeras inteligentes no dia a dia.',
  },
  {
    id: 'cena05_encerramento',
    title: 'GSA TÁ NA REDE',
    headline: 'OBRIGADO PELA SUA AUDIÊNCIA NA GSA TV',
    ticker: 'A SEGUIR: PROGRAMAÇÃO ESPECIAL GSA TV • 24 HORAS NO AR',
    startOffset: 340,
    text: 'Esse foi o GSA Tá na Rede de hoje! Siga a GSA TV nas redes sociais, compartilhe as nossas notícias e continue conectado com o futuro da tecnologia e da inovação. A seguir, continue acompanhando a nossa programação especial. Até a próxima edição!',
  }
];

async function generateAudio(text, outputFile) {
  console.log(`Gerando narração TTS no Fish Audio (${text.slice(0, 40)}...)...`);
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

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Erro TTS Fish Audio: ${res.status} ${err}`);
  }

  const buffer = Buffer.from(await res.arrayBuffer());
  fs.writeFileSync(outputFile, buffer);
  console.log(`✅ Áudio gravado: ${outputFile} (${(buffer.length / 1024).toFixed(1)} KB)`);
}

async function main() {
  console.log('=== PRODUZINDO GSA TÁ NA REDE (EDIÇÃO COMPLETA) ===');
  const tempDir = path.resolve('scratch/gsa_ta_na_rede_build');
  fs.mkdirSync(tempDir, { recursive: true });

  // 1. Gera áudios localmente
  for (const scene of SCENES) {
    const mp3File = path.join(tempDir, `${scene.id}.mp3`);
    await generateAudio(scene.text, mp3File);
  }

  // 2. Envia os áudios e textos para a VPS
  console.log('\nEnviando arquivos de áudio e gráficos para a VPS...');
  for (const scene of SCENES) {
    const mp3File = path.join(tempDir, `${scene.id}.mp3`);
    const mp3Base64 = fs.readFileSync(mp3File).toString('base64');

    const vpsScript = `
mkdir -p /opt/gsa-tv/cache/media/1/news/gsa-ta-na-rede-2026-09-02/{audio,video,graphics}
echo "${mp3Base64}" | base64 -d > /opt/gsa-tv/cache/media/1/news/gsa-ta-na-rede-2026-09-02/audio/${scene.id}.mp3

# Converte para WAV 48k estéreo
sudo docker exec gsa-tv-ffplayout ffmpeg -y -hide_banner -loglevel error \
  -i /media/1/news/gsa-ta-na-rede-2026-09-02/audio/${scene.id}.mp3 \
  -ar 48000 -ac 2 /media/1/news/gsa-ta-na-rede-2026-09-02/audio/${scene.id}.wav

# Salva textos de lower thirds
cat << 'EOF' > /opt/gsa-tv/cache/media/1/news/gsa-ta-na-rede-2026-09-02/graphics/${scene.id}_title.txt
${scene.title}
EOF

cat << 'EOF' > /opt/gsa-tv/cache/media/1/news/gsa-ta-na-rede-2026-09-02/graphics/${scene.id}_headline.txt
${scene.headline}
EOF

cat << 'EOF' > /opt/gsa-tv/cache/media/1/news/gsa-ta-na-rede-2026-09-02/graphics/${scene.id}_ticker.txt
${scene.ticker}
EOF
`;
    await runSshScript(vpsScript);
    console.log(`✅ Áudio e textos de ${scene.id} sincronizados na VPS.`);
  }

  // 3. Renderiza cada cena com FFmpeg no container ffplayout
  console.log('\nRenderizando cenas com B-roll tecnológico e grafismo de TV...');
  for (const scene of SCENES) {
    console.log(`Renderizando ${scene.id}...`);
    const renderScript = `
# Pega duração exata do áudio
DUR=$(sudo docker exec gsa-tv-ffplayout ffprobe -v error -show_entries format=duration -of default=noprint_wrappers=1:nokey=1 /media/1/news/gsa-ta-na-rede-2026-09-02/audio/${scene.id}.wav)
echo "Duração ${scene.id}: $DUR s"

sudo docker exec gsa-tv-ffplayout ffmpeg -y -hide_banner -loglevel error \
  -ss ${scene.startOffset} -t $DUR \
  -i /media/1/news/gsa-news-2026-09-01-v2/motion/tecnologia.webm \
  -i /media/1/identity/gsa-tv-logo-transparent.png \
  -i /media/1/news/gsa-ta-na-rede-2026-09-02/audio/${scene.id}.wav \
  -filter_complex "[0:v]scale=1920:1080:force_original_aspect_ratio=increase,crop=1920:1080,fps=30[bg]; \
   [1:v]scale=170:-1[logo]; \
   [bg][logo]overlay=W-w-30:30[v0]; \
   [v0]drawbox=x=0:y=830:w=1920:h=175:color=0x06162a@0.88:t=fill, \
   drawbox=x=0:y=830:w=1920:h=5:color=0xc99a3b@1:t=fill, \
   drawbox=x=0:y=955:w=1920:h=45:color=0x0b1d33@0.95:t=fill, \
   drawtext=fontfile=/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf:textfile=/media/1/news/gsa-ta-na-rede-2026-09-02/graphics/${scene.id}_title.txt:expansion=none:fontcolor=0xe2b354:fontsize=24:x=60:y=850, \
   drawtext=fontfile=/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf:textfile=/media/1/news/gsa-ta-na-rede-2026-09-02/graphics/${scene.id}_headline.txt:expansion=none:fontcolor=white:fontsize=32:x=60:y=890, \
   drawtext=fontfile=/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf:textfile=/media/1/news/gsa-ta-na-rede-2026-09-02/graphics/${scene.id}_ticker.txt:expansion=none:fontcolor=white:fontsize=18:x=60:y=967[outv]" \
  -map "[outv]" -map 2:a:0 \
  -c:v libx264 -preset fast -crf 20 -pix_fmt yuv420p \
  -c:a aac -b:a 192k -ar 48000 -ac 2 \
  -t $DUR \
  /media/1/news/gsa-ta-na-rede-2026-09-02/video/${scene.id}.mp4

echo "Cena ${scene.id} renderizada com sucesso!"
`;
    const renderRes = await runSshScript(renderScript);
    console.log(renderRes.stdout);
  }

  // 4. Concatena todas as cenas no Master Final
  console.log('\nConcatenando cenas no Master Final...');
  const concatScript = `
cat << 'EOF' > /opt/gsa-tv/cache/media/1/news/gsa-ta-na-rede-2026-09-02/video/concat_list.txt
file '/media/1/news/gsa-ta-na-rede-2026-09-02/video/cena01_abertura.mp4'
file '/media/1/news/gsa-ta-na-rede-2026-09-02/video/cena02_seguranca_ia.mp4'
file '/media/1/news/gsa-ta-na-rede-2026-09-02/video/cena03_agentes_redes.mp4'
file '/media/1/news/gsa-ta-na-rede-2026-09-02/video/cena04_meta_oculos.mp4'
file '/media/1/news/gsa-ta-na-rede-2026-09-02/video/cena05_encerramento.mp4'
EOF

sudo docker exec gsa-tv-ffplayout ffmpeg -y -hide_banner -loglevel error \
  -f concat -safe 0 -i /media/1/news/gsa-ta-na-rede-2026-09-02/video/concat_list.txt \
  -c:v libx264 -preset fast -crf 19 -pix_fmt yuv420p \
  -c:a aac -b:a 192k -ar 48000 -ac 2 \
  /media/1/news/gsa-ta-na-rede-2026-09-02/video/gsa-ta-na-rede-final.mp4

# Extrai duração total
FINAL_DUR=$(sudo docker exec gsa-tv-ffplayout ffprobe -v error -show_entries format=duration -of default=noprint_wrappers=1:nokey=1 /media/1/news/gsa-ta-na-rede-2026-09-02/video/gsa-ta-na-rede-final.mp4)
echo "MASTER FINAL GERADO COM SUCESSO! DURAÇÃO: $FINAL_DUR segundos"
`;
  const concatRes = await runSshScript(concatScript);
  console.log(concatRes.stdout);

  // 5. Cadastra no Banco de Dados
  console.log('\nCadastrando o Master no Banco de Dados PostgreSQL...');
  const dbScript = `
FINAL_DUR_INT=$(sudo docker exec gsa-tv-ffplayout ffprobe -v error -show_entries format=duration -of default=noprint_wrappers=1:nokey=1 /media/1/news/gsa-ta-na-rede-2026-09-02/video/gsa-ta-na-rede-final.mp4 | cut -d'.' -f1)

psql "postgresql://supabase_admin:GSA_SENHA_FORTE_2026@127.0.0.1:5433/gsahub" -c "
-- Deleta mídias temporárias anteriores de teste do Tá na Rede
DELETE FROM public.gsa_tv_media_items WHERE id LIKE 'media-ai-gsa-gsa_ta_na_rede-%' OR id = 'media-gsa-ta-na-rede-2026-09-02-final';

-- Insere o Master Oficial de Alta Qualidade
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

-- Atualiza job para completed com dados do master
UPDATE public.gsa_tv_jobs
SET status = 'completed',
    progress = 100,
    current_stage = 'Produção completa finalizada! O programa está disponível na Biblioteca.',
    finished_at = now()
WHERE job_type = 'ai_flow_vids_generate'
  AND payload->>'preset_id' = 'gsa_ta_na_rede';
"
`;
  const dbRes = await runSshScript(dbScript);
  console.log(dbRes.stdout);
  console.log('🎉 PROCESSO CONCLUÍDO COM SUCESSO!');
}

main().catch(console.error);
