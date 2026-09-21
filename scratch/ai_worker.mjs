import fs from 'fs';
import path from 'path';
import { execSync } from 'child_process';
import pg from 'pg';

const { Pool } = pg;
const pool = new Pool({
  connectionString: process.env.DATABASE_URL || 'postgresql://supabase_admin:GSA_SENHA_FORTE_2026@127.0.0.1:5433/gsahub',
});

const FISH_API_KEY = '__FISH_API_KEY_FROM_SECURE_VAULT__';

const OFFICIAL_VOICES = {
  chamadas: '5c8a9b5d0b2549c7ada853529199ebe5',    // Impacto Comercial (Oficial GSA TV)
  vinhetas: '5c8a9b5d0b2549c7ada853529199ebe5',    // Impacto Comercial (Vinhetas & Transições)
  ancora_masc: 'fafc0100f94747259ecd6081ae5226aa', // Jornalista Bancada
  ancora_fem: '74b5a4384563467b80dd0ca12ca5fd04',  // Jornalista Escalada
};

const HOST_WORK_DIR = '/opt/gsa-tv/cache/media/1/news/ai-studio-production';
const DOCKER_WORK_DIR = '/media/1/news/ai-studio-production';

async function updateJob(jobId, status, progress, stage, error = null) {
  try {
    const finishedAt = status === 'completed' || status === 'failed' ? new Date() : null;
    await pool.query(
      `UPDATE public.gsa_tv_jobs 
       SET status = $1, progress = $2, current_stage = $3, error_message = $4, finished_at = $5, updated_at = now()
       WHERE id = $6`,
      [status, progress, stage, error, finishedAt, jobId]
    );
    console.log(`[Job ${jobId}] ${progress}% - ${stage} (${status})`);
  } catch (err) {
    console.error('Error updating job:', err.message);
  }
}

async function generateTtsAudio(text, voiceId, outputPath) {
  console.log(`Calling Fish Audio S2.1 Pro for voice ${voiceId}...`);
  const res = await fetch('https://api.fish.audio/v1/tts', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${FISH_API_KEY}`,
      'Content-Type': 'application/json',
      'model': 's2.1-pro-free',
    },
    body: JSON.stringify({
      text: text,
      reference_id: voiceId,
      format: 'mp3',
    }),
  });

  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`Fish Audio TTS failed (${res.status}): ${errText}`);
  }

  const buffer = Buffer.from(await res.arrayBuffer());
  fs.writeFileSync(outputPath, buffer);
  console.log(`Saved audio to ${outputPath} (${buffer.length} bytes)`);
}

async function processAiJob(job) {
  const jobId = job.id;
  const payload = job.payload || {};
  const presetId = payload.preset_id || 'gsa_interprogramas';
  const title = payload.title || 'Edição GSA TV';

  console.log(`\n========================================`);
  console.log(`Starting AI Production: ${title} (${presetId})`);
  console.log(`Job ID: ${jobId}`);
  console.log(`========================================`);

  fs.mkdirSync(HOST_WORK_DIR, { recursive: true });
  const timestamp = Date.now();
  const baseName = `gsa-${presetId}-${timestamp}`;

  const hostAudioMp3 = path.join(HOST_WORK_DIR, `${baseName}-narration.mp3`);
  const hostAudioWav = path.join(HOST_WORK_DIR, `${baseName}-audio48k.wav`);
  const dockerAudioWav = `${DOCKER_WORK_DIR}/${baseName}-audio48k.wav`;
  const dockerAudioMp3 = `${DOCKER_WORK_DIR}/${baseName}-narration.mp3`;
  const dockerVideoMaster = `${DOCKER_WORK_DIR}/${baseName}-master.mp4`;
  const hostVideoMaster = path.join(HOST_WORK_DIR, `${baseName}-master.mp4`);

  try {
    // 1. ROTEIRIZAÇÃO & DEFINIÇÃO DE VOZ
    await updateJob(jobId, 'running', 15, 'Compondo roteiro broadcast e definindo locução oficial...');
    await new Promise(r => setTimeout(r, 1000));

    let scriptText = '';
    let voiceId = OFFICIAL_VOICES.chamadas;
    let category = 'interprogram';
    let durationSeconds = 20;

    if (presetId === 'gsa_interprogramas') {
      scriptText = 'Você está assistindo à GSA TV. A seguir, continue acompanhando a nossa programação com notícias, análises de mercado e entretenimento em alta definição. GSA TV, a sua rede 24 horas no ar.';
      voiceId = OFFICIAL_VOICES.chamadas;
      category = 'ident';
      durationSeconds = 20;
    } else if (presetId === 'gsa_news_morning') {
      scriptText = 'Bom dia! O GSA Manhã Notícias traz os primeiros destaques do agronegócio, previsão do tempo para todo o país e as informações fundamentais para começar o seu dia bem informado.';
      voiceId = OFFICIAL_VOICES.ancora_masc;
      category = 'news';
      durationSeconds = 25;
    } else if (presetId === 'gsa_financial') {
      scriptText = 'Boletim Econômico GSA. O mercado financeiro abriu em ritmo de cautela com os investidores atentos aos dados da inflação e às decisões do Banco Central sobre a taxa de juros.';
      voiceId = OFFICIAL_VOICES.chamadas;
      category = 'news';
      durationSeconds = 22;
    } else if (presetId === 'gsa_agro') {
      scriptText = 'GSA Agro e Campo. A safra recorde de grãos impulsiona as exportações brasileiras e a tecnologia no campo ganha força com novos investimentos em sustentabilidade.';
      voiceId = OFFICIAL_VOICES.ancora_masc;
      category = 'news';
      durationSeconds = 22;
    } else if (presetId === 'gsa_viral') {
      scriptText = 'GSA Tá na Rede! Os assuntos mais comentados do dia nas plataformas digitais, as inovações em inteligência artificial e os vídeos que estão movimentando a internet.';
      voiceId = OFFICIAL_VOICES.vinhetas;
      category = 'entertainment';
      durationSeconds = 20;
    } else {
      scriptText = 'GSA News, edição oficial. Acompanhe os principais fatos do Brasil e do mundo com a nossa equipe de reportagem e análises completas dos acontecimentos do dia.';
      voiceId = OFFICIAL_VOICES.ancora_masc;
      category = 'news';
      durationSeconds = 25;
    }

    // 2. GRAVAÇÃO DE VOZ COM O FISH AUDIO S2.1 PRO FREE
    await updateJob(jobId, 'running', 40, 'Sintetizando narração com voz oficial no Fish Audio S2.1 Pro...');
    await generateTtsAudio(scriptText, voiceId, hostAudioMp3);

    // Converte áudio para estéreo 48.000 Hz WAV usando docker ffplayout
    execSync(`sudo docker exec gsa-tv-ffplayout ffmpeg -y -hide_banner -loglevel error -i "${dockerAudioMp3}" -ar 48000 -ac 2 "${dockerAudioWav}"`);

    // 3. MONTAGEM DAS CENAS & LOWER THIRDS
    await updateJob(jobId, 'running', 70, 'Renderizando vídeo 1080p, grafismos e lower thirds na VPS...');

    // Verifica duração exata do áudio
    const durationOutput = execSync(`sudo docker exec gsa-tv-ffplayout ffprobe -v error -show_entries format=duration -of default=noprint_wrappers=1:nokey=1 "${dockerAudioWav}"`).toString().trim();
    const exactDuration = Math.ceil(parseFloat(durationOutput) || durationSeconds);

    // Renderiza o vídeo com ffmpeg usando o container ffplayout
    const logoFile = '/media/1/identity/gsa-tv-logo-transparent.png';
    const hasLogo = fs.existsSync('/opt/gsa-tv/cache' + logoFile);

    // Prepara arquivos de texto seguros para o drawtext (evita problemas com aspas ou caracteres especiais)
    const hostTitleTxt = path.join(HOST_WORK_DIR, `${baseName}-title.txt`);
    const dockerTitleTxt = `${DOCKER_WORK_DIR}/${baseName}-title.txt`;
    fs.writeFileSync(hostTitleTxt, title.toUpperCase());

    const hostSubTxt = path.join(HOST_WORK_DIR, `${baseName}-sub.txt`);
    const dockerSubTxt = `${DOCKER_WORK_DIR}/${baseName}-sub.txt`;
    fs.writeFileSync(hostSubTxt, 'GSA TV • REDE 24 HORAS • TRANSMISSÃO OFICIAL');

    const filterComplex = hasLogo
      ? `[0:v]scale=1920:1080:force_original_aspect_ratio=increase,crop=1920:1080,fps=30[bg];` +
        `[1:v]scale=160:-1[logo];` +
        `[bg][logo]overlay=W-w-24:24[v0];` +
        `[v0]drawbox=x=0:y=860:w=1920:h=140:color=0x06162a@0.85:t=fill,` +
        `drawbox=x=0:y=860:w=1920:h=4:color=0xc99a3b@1:t=fill,` +
        `drawtext=fontfile=/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf:textfile=${dockerTitleTxt}:expansion=none:fontcolor=0xe2b354:fontsize=28:x=60:y=885,` +
        `drawtext=fontfile=/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf:textfile=${dockerSubTxt}:expansion=none:fontcolor=white:fontsize=20:x=60:y=935[outv]`
      : `[0:v]scale=1920:1080:force_original_aspect_ratio=increase,crop=1920:1080,fps=30,` +
        `drawbox=x=0:y=860:w=1920:h=140:color=0x06162a@0.85:t=fill,` +
        `drawbox=x=0:y=860:w=1920:h=4:color=0xc99a3b@1:t=fill,` +
        `drawtext=fontfile=/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf:textfile=${dockerTitleTxt}:expansion=none:fontcolor=0xe2b354:fontsize=28:x=60:y=885,` +
        `drawtext=fontfile=/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf:textfile=${dockerSubTxt}:expansion=none:fontcolor=white:fontsize=20:x=60:y=935[outv]`;

    // Seleciona vídeo de apoio dinâmico real em vez de fundo estático
    let bgVideo = '/media/1/news/gsa-news-2026-09-01-v2/motion/tecnologia.webm';
    if (presetId === 'gsa_financial') {
      bgVideo = '/media/1/news/gsa-news-2026-09-01-v2/motion/comercio.webm';
    } else if (presetId === 'gsa_interprogramas') {
      bgVideo = '/media/1/filler/gsa-tv-filler-600.mp4';
    } else if (presetId?.includes('news')) {
      bgVideo = '/media/1/news/gsa-news-2026-09-01-extended/source/part1-vids.mp4';
    }

    const ffmpegCmd = `sudo docker exec gsa-tv-ffplayout ffmpeg -y -hide_banner -loglevel error \
      -stream_loop -1 -i "${bgVideo}" \
      ${hasLogo ? `-loop 1 -i ${logoFile}` : ''} \
      -i "${dockerAudioWav}" \
      -filter_complex "${filterComplex}" \
      -map "[outv]" -map ${hasLogo ? '2:a:0' : '1:a:0'} \
      -c:v libx264 -preset fast -crf 20 -pix_fmt yuv420p \
      -c:a aac -b:a 192k -ar 48000 -ac 2 \
      -t ${exactDuration} \
      "${dockerVideoMaster}"`;

    console.log('Running ffmpeg render in docker ffplayout with dynamic B-roll...');
    execSync(ffmpegCmd);

    // 4. SALVANDO MASTER & REGISTRANDO NA BIBLIOTECA
    await updateJob(jobId, 'running', 90, 'Salvando Master e registrando na Biblioteca de Mídia...');

    const mediaId = `media-ai-${baseName}`;
    const filename = `${baseName}-master.mp4`;
    const relativeDrivePath = `news/ai-studio-production/${filename}`;

    // Registra na tabela gsa_tv_media_items
    const validKind = presetId === 'gsa_interprogramas' ? 'identity' : 'program';
    await pool.query(`
      INSERT INTO public.gsa_tv_media_items(
        id, channel_id, title, original_filename, duration_s,
        video_codec, video_width, video_height, video_fps,
        audio_codec, audio_sample_rate, audio_channels,
        state, rights_ok, media_kind, source_type, ai_generated,
        approval_state, drive_path, created_at, updated_at
      ) VALUES (
        $1, 'ch-main', $2, $3, $4,
        'h264', 1920, 1080, 30,
        'aac', 48000, 2,
        'ready', true, $5, 'ai', true,
        'approved', $6, now(), now()
      )
      ON CONFLICT (id) DO UPDATE SET
        title = EXCLUDED.title,
        duration_s = EXCLUDED.duration_s,
        state = 'ready',
        updated_at = now();
    `, [mediaId, `${title} — Edição Autônoma`, filename, exactDuration, validKind, relativeDrivePath]);

    // Registra projeto no painel IA
    await pool.query(`
      INSERT INTO public.gsa_tv_ai_projects(
        channel_id, project_type, title, name, brief, state,
        autonomy_mode, output_media_item_id, metadata, created_at, updated_at
      ) VALUES (
        'ch-main', 'news', $1, $1, $2, 'completed',
        'supervised_auto', $3, $4, now(), now()
      )
    `, [title, scriptText, mediaId, { preset_id: presetId, duration: exactDuration, filename }]);

    // 5. CONCLUÍDO COM SUCESSO!
    await updateJob(jobId, 'completed', 100, 'Produção concluída! O vídeo está pronto na Biblioteca de Mídia.');
    console.log(`[SUCCESS] AI Production Finished for Job ${jobId}! Output: ${mediaId}`);

  } catch (err) {
    console.error(`[ERROR] Job ${jobId} failed:`, err.message);
    await updateJob(jobId, 'failed', 0, 'Falha na produção do vídeo.', err.message);
  }
}

async function workerLoop() {
  console.log('🤖 GSA TV AI Production Worker is running in background...');
  while (true) {
    try {
      const res = await pool.query(`
        SELECT id, channel_id, job_type, status, payload
        FROM public.gsa_tv_jobs
        WHERE job_type = 'ai_flow_vids_generate' AND status IN ('queued', 'pending')
        ORDER BY created_at ASC
        LIMIT 1
      `);

      if (res.rows.length > 0) {
        const job = res.rows[0];
        await processAiJob(job);
      }
    } catch (e) {
      console.error('Worker loop error:', e.message);
    }
    await new Promise(r => setTimeout(r, 2000));
  }
}

workerLoop().catch(console.error);
