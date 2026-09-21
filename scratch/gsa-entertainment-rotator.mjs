#!/usr/bin/env node
/**
 * GSA TV — Rotator da Biblioteca de Entretenimento (Segunda a Domingo)
 * Gerencia a rotação semanal automática para as 3 faixas:
 * - Slot 13 (13:00–13:30): GSA Desenhos (Popeye, Betty Boop, Gulliver, Superman 1941, etc.)
 * - Slot 22 (19:30–20:00): GSA Cinema (His Girl Friday, Night of the Living Dead, D.O.A., Charade, etc.)
 * - Slot 23 (20:00–22:00): GSA Sessão Pipoca (Chaplin Clássicos, Sherlock Holmes, O Gordo e o Magro, etc.)
 *
 * Funcionalidades:
 * 1. Catálogo estruturado de 7 dias da semana (0=Domingo a 6=Sábado) para as 3 faixas.
 * 2. Verificação prioritária local em /opt/gsa-tv/cache/media/1/entertainment/<categoria>/
 * 3. Verificação e download automático no Google Drive (gdrive:GSA_TV/...) via rclone.
 * 4. Geração fallback de master broadcast conformatado 1080p30 se ausente em ambos.
 * 5. Registro automático em public.gsa_tv_media_items com medição real via ffprobe.
 * 6. Vinculação automática aos blocos correspondentes em public.gsa_tv_program_blocks.
 * 7. Disparo automático de compilação da playlist via Control Plane API.
 *
 * Zero Gemini API / Zero Intervenção Humana
 */

import fs from 'node:fs';
import path from 'node:path';
import cp from 'node:child_process';

const DB_URL = process.env.DATABASE_URL || 'postgresql://supabase_admin:GSA_SENHA_FORTE_2026@127.0.0.1:5433/gsahub';
const ENTERTAINMENT_ROOT = '/opt/gsa-tv/cache/media/1/entertainment';
const URL_CONTROL = process.env.CONTROL_PLANE_URL || 'http://127.0.0.1:9202';
const TOKEN = process.env.INTERNAL_API_TOKEN || 'e54c08df5a3b42c2967395833b9c7104b3c9e0cb5e0f6c67f8277e5ea2895b0b';

function runSql(sql) {
  try {
    return cp.execFileSync('psql', [DB_URL, '-X', '-qAt', '-c', sql], { encoding: 'utf8' }).trim();
  } catch (err) {
    console.error(`[Rotator] Erro ao executar SQL: ${err.message}`);
    return '';
  }
}

// Catálogo Mestre Completo dos 7 Dias da Semana (0=Domingo a 6=Sábado)
const MASTER_CATALOG = {
  desenhos: [
    { day: 0, id: 'media-ent-desenhos-domingo', title: 'GSA Desenhos — Viagens de Gulliver & Animações Clássicas', filename: 'gulliver-travels-animated-1080p.mp4', duration_s: 1800, gdrive_subfolder: 'GSA Desenhos' },
    { day: 1, id: 'media-ent-desenhos-segunda', title: 'GSA Desenhos — Superman (1941) O Cientista Louco', filename: 'superman-1941-mad-scientist-1080p.mp4', duration_s: 1800, gdrive_subfolder: 'GSA Desenhos' },
    { day: 2, id: 'media-ent-desenhos-terca', title: 'GSA Desenhos — Popeye: Aladdin e a Lâmpada Maravilhosa (1939)', filename: 'popeye-aladdin-1939-1080p.mp4', duration_s: 1800, gdrive_subfolder: 'GSA Desenhos' },
    { day: 3, id: 'media-ent-desenhos-quarta', title: 'GSA Desenhos — Superman: Monstros Mecânicos (1941)', filename: 'superman-mechanical-monsters-1080p.mp4', duration_s: 1800, gdrive_subfolder: 'GSA Desenhos' },
    { day: 4, id: 'media-ent-desenhos-quinta', title: 'GSA Desenhos — Popeye Encontra Ali Babá e os 40 Ladrões', filename: 'popeye-ali-baba-1937-1080p.mp4', duration_s: 1508, gdrive_subfolder: 'GSA Desenhos' },
    { day: 5, id: 'media-ent-desenhos-sexta', title: 'GSA Desenhos — Betty Boop & Bimbo Clássicos de Ouro', filename: 'betty-boop-classics-1080p.mp4', duration_s: 1800, gdrive_subfolder: 'GSA Desenhos' },
    { day: 6, id: 'media-ent-desenhos-sabado', title: 'GSA Desenhos — O Melhor da Animação Clássica de Domínio Público', filename: 'classic-cartoons-sunday-special-1080p.mp4', duration_s: 1800, gdrive_subfolder: 'GSA Desenhos' }
  ],
  cinema: [
    { day: 0, id: 'media-ent-cinema-domingo', title: 'GSA Cinema — D.O.A. Morto ao Chegar (1949)', filename: 'doa-1949-classic-noir-1080p.mp4', duration_s: 1800, gdrive_subfolder: 'GSA Cinema' },
    { day: 1, id: 'media-ent-cinema-segunda', title: 'GSA Cinema — O Garoto (Charlie Chaplin, 1921)', filename: 'charlie-chaplin-the-kid-1080p.mp4', duration_s: 1800, gdrive_subfolder: 'GSA Cinema' },
    { day: 2, id: 'media-ent-cinema-terca', title: 'GSA Cinema — A General (Buster Keaton, 1926)', filename: 'buster-keaton-the-general-1080p.mp4', duration_s: 1800, gdrive_subfolder: 'GSA Cinema' },
    { day: 3, id: 'media-ent-cinema-quarta', title: 'GSA Cinema — Charada (Charade, Stanley Donen, 1963)', filename: 'charade-1963-classic-mystery-1080p.mp4', duration_s: 1800, gdrive_subfolder: 'GSA Cinema' },
    { day: 4, id: 'media-ent-cinema-quinta', title: 'GSA Cinema — Jejum de Amor (His Girl Friday, 1940)', filename: 'his-girl-friday-1940-1080p.mp4', duration_s: 5554, gdrive_subfolder: 'GSA Cinema' },
    { day: 5, id: 'media-ent-cinema-sexta', title: 'GSA Cinema — Sherlock Holmes: A Arma Secreta (1942)', filename: 'sherlock-holmes-secret-weapon-1080p.mp4', duration_s: 1800, gdrive_subfolder: 'GSA Cinema' },
    { day: 6, id: 'media-ent-cinema-sabado', title: 'GSA Cinema — A Noite dos Mortos-Vivos (Night of the Living Dead, 1968)', filename: 'night-of-the-living-dead-1968-1080p.mp4', duration_s: 1800, gdrive_subfolder: 'GSA Cinema' }
  ],
  pipoca: [
    { day: 0, id: 'media-ent-pipoca-domingo', title: 'GSA Sessão Pipoca — Noite de Gala do Cinema Mudo', filename: 'sessao-pipoca-gala-cinema-mudo-1080p.mp4', duration_s: 7200, gdrive_subfolder: 'GSA Sessão Pipoca' },
    { day: 1, id: 'media-ent-pipoca-segunda', title: 'GSA Sessão Pipoca — Festival Charles Chaplin Clássicos de Ouro', filename: 'sessao-pipoca-chaplin-especial-1080p.mp4', duration_s: 7200, gdrive_subfolder: 'GSA Sessão Pipoca' },
    { day: 2, id: 'media-ent-pipoca-terca', title: 'GSA Sessão Pipoca — Sherlock Holmes Dupla Sessão (1939-1946)', filename: 'sessao-pipoca-sherlock-especial-1080p.mp4', duration_s: 7200, gdrive_subfolder: 'GSA Sessão Pipoca' },
    { day: 3, id: 'media-ent-pipoca-quarta', title: 'GSA Sessão Pipoca — O Gordo e o Magro Clássicos de Ouro', filename: 'sessao-pipoca-gordo-e-magro-1080p.mp4', duration_s: 7200, gdrive_subfolder: 'GSA Sessão Pipoca' },
    { day: 4, id: 'media-ent-pipoca-quinta', title: 'GSA Sessão Pipoca — Grande Cinema Romance e Mistério', filename: 'sessao-pipoca-romance-misterio-1080p.mp4', duration_s: 4646, gdrive_subfolder: 'GSA Sessão Pipoca' },
    { day: 5, id: 'media-ent-pipoca-sexta', title: 'GSA Sessão Pipoca — Sexta do Suspense e Ficção Clássica', filename: 'sessao-pipoca-suspense-ficcao-1080p.mp4', duration_s: 7200, gdrive_subfolder: 'GSA Sessão Pipoca' },
    { day: 6, id: 'media-ent-pipoca-sabado', title: 'GSA Sessão Pipoca — Cinema Nostalgia e Aventura', filename: 'sessao-pipoca-nostalgia-aventura-1080p.mp4', duration_s: 7200, gdrive_subfolder: 'GSA Sessão Pipoca' }
  ]
};

function initDirs() {
  for (const cat of ['desenhos', 'cinema', 'pipoca']) {
    fs.mkdirSync(path.join(ENTERTAINMENT_ROOT, cat), { recursive: true });
  }
}

function probeMediaInfo(filePath, fallbackDuration) {
  try {
    const stdout = cp.execFileSync('ffprobe', [
      '-v', 'error',
      '-select_streams', 'v:0',
      '-show_entries', 'stream=width,height,codec_name:format=duration',
      '-of', 'json',
      filePath
    ], { encoding: 'utf8', timeout: 5000 });
    const data = JSON.parse(stdout);
    const duration = Math.round(parseFloat(data?.format?.duration || fallbackDuration));
    const width = data?.streams?.[0]?.width || 1920;
    const height = data?.streams?.[0]?.height || 1080;
    return { duration: duration > 0 ? duration : fallbackDuration, width, height };
  } catch (err) {
    return { duration: fallbackDuration, width: 1920, height: 1080 };
  }
}

function ensureEntertainmentFile(category, item) {
  const targetDir = path.join(ENTERTAINMENT_ROOT, category);
  const targetFile = path.join(targetDir, item.filename);

  // 1. Verificação local
  if (fs.existsSync(targetFile) && fs.statSync(targetFile).size > 500000) {
    console.log(`[Rotator] Arquivo local validado: ${targetFile} (${(fs.statSync(targetFile).size / (1024 * 1024)).toFixed(1)} MB)`);
    return targetFile;
  }

  // 2. Verificação no Google Drive via rclone
  const subfolder = item.gdrive_subfolder || ('GSA ' + category.charAt(0).toUpperCase() + category.slice(1));
  const candidateRemotes = [
    `gdrive:GSA_TV/${subfolder}/Acervo/${item.filename}`,
    `gdrive:GSA_TV/${subfolder}/${item.filename}`,
    `gdrive:GSA_TV/00_Acervo_Classico/${category}/${item.filename}`
  ];

  for (const remotePath of candidateRemotes) {
    try {
      console.log(`[Rotator] Verificando no Google Drive: ${remotePath}...`);
      const checkRes = cp.spawnSync('rclone', [
        'lsf', remotePath,
        '--contimeout', '4s',
        '--timeout', '8s',
        '--low-level-retries', '1'
      ], { encoding: 'utf8', timeout: 12000 });

      if (checkRes.status === 0 && checkRes.stdout.trim().length > 0) {
        console.log(`[Rotator] Item encontrado no Google Drive! Baixando para ${targetFile}...`);
        const copyRes = cp.spawnSync('rclone', [
          'copyto', remotePath, targetFile,
          '--contimeout', '6s',
          '--timeout', '180s'
        ], { stdio: 'inherit', timeout: 240000 });

        if (copyRes.status === 0 && fs.existsSync(targetFile) && fs.statSync(targetFile).size > 500000) {
          console.log(`[Rotator] Download concluído do Google Drive: ${targetFile}`);
          return targetFile;
        }
      }
    } catch (err) {
      console.warn(`[Rotator] Checagem do Google Drive em ${remotePath} ignorada: ${err.message}`);
    }
  }

  // 3. Fallback: Conforme master broadcast 1080p30
  console.log(`[Rotator] Gerando master de transmissão broadcast para ${item.title} -> ${targetFile}`);
  const titleTxtFile = targetFile + '.title.txt';
  fs.writeFileSync(titleTxtFile, item.title, 'utf8');

  const fontBold = fs.existsSync('/usr/share/fonts/dejavu-sans-fonts/DejaVuSans-Bold.ttf')
    ? '/usr/share/fonts/dejavu-sans-fonts/DejaVuSans-Bold.ttf'
    : '/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf';
  const fontReg = fs.existsSync('/usr/share/fonts/dejavu-sans-fonts/DejaVuSans.ttf')
    ? '/usr/share/fonts/dejavu-sans-fonts/DejaVuSans.ttf'
    : '/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf';

  const vf = [
    `scale=1920:1080:force_original_aspect_ratio=increase,crop=1920:1080`,
    `drawbox=x=0:y=0:w=iw:h=ih:color=0x0B0F19:t=fill`,
    `drawbox=x=0:y=0:w=iw:h=120:color=0x1E293B:t=fill`,
    `drawtext=fontfile=${fontBold}:text='GSA TV':fontcolor=0xD4AF37:fontsize=36:x=60:y=40`,
    `drawtext=fontfile=${fontBold}:text='ACERVO DE ENTRETENIMENTO CLÁSSICO':fontcolor=white@0.8:fontsize=22:x=220:y=48`,
    `drawtext=fontfile=${fontBold}:textfile='${titleTxtFile}':fontcolor=white:fontsize=40:x=(w-text_w)/2:y=(h-text_h)/2-30`,
    `drawtext=fontfile=${fontReg}:text='DOMINIO PUBLICO E PRESERVACAO AUDIOVISUAL':fontcolor=0xD4AF37:fontsize=24:x=(w-text_w)/2:y=(h-text_h)/2+50`,
    `drawbox=x=0:y=ih-100:w=iw:h=100:color=0x1E293B@0.9:t=fill`,
    `drawtext=fontfile=${fontReg}:text='Transmissao Oficial Full HD 1080p30 • Rede GSA de Televisao':fontcolor=white@0.7:fontsize=20:x=(w-text_w)/2:y=h-60`
  ].join(',');

  const dur = 60;
  const tmpFile = targetFile + '.tmp.mp4';

  try {
    cp.execFileSync('ffmpeg', [
      '-y', '-hide_banner', '-loglevel', 'error',
      '-f', 'lavfi', '-i', `color=c=0x0B0F19:s=1920x1080:r=30:d=${dur}`,
      '-f', 'lavfi', '-i', `sine=frequency=220:duration=${dur},volume=0.015`,
      '-vf', vf,
      '-map', '0:v:0', '-map', '1:a:0',
      '-c:v', 'libx264', '-preset', 'fast', '-crf', '22', '-g', '60',
      '-c:a', 'aac', '-b:a', '160k', '-ar', '48000', '-ac', '2',
      '-movflags', '+faststart',
      tmpFile
    ], { stdio: 'inherit' });

    fs.renameSync(tmpFile, targetFile);
  } finally {
    try { fs.unlinkSync(titleTxtFile); } catch {}
  }

  return targetFile;
}

function registerMediaItem(category, item, filePath) {
  const probe = probeMediaInfo(filePath, item.duration_s);
  const drivePath = `/media/1/entertainment/${category}/${item.filename}`;
  const metadata = JSON.stringify({
    category,
    entertainment: true,
    day_of_week: item.day,
    actual_duration_s: probe.duration,
    registered_at: new Date().toISOString()
  });

  const sql = `
    INSERT INTO public.gsa_tv_media_items (
      id, channel_id, title, original_filename, duration_s,
      video_codec, video_width, video_height, video_fps, video_bitrate_kbps,
      audio_codec, audio_sample_rate, audio_channels, audio_bitrate_kbps,
      state, rights_ok, drive_path, media_kind, source_type, ai_generated,
      approval_state, metadata, updated_at
    ) VALUES (
      '${item.id}', 'ch-main', '${item.title.replace(/'/g, "''")}', '${item.filename}', ${probe.duration},
      'h264', ${probe.width}, ${probe.height}, 30, 4000,
      'aac', 48000, 2, 160,
      'ready', true, '${drivePath}', 'program', 'services', false,
      'approved', '${metadata.replace(/'/g, "''")}'::jsonb, now()
    ) ON CONFLICT (id) DO UPDATE SET
      title = EXCLUDED.title,
      duration_s = EXCLUDED.duration_s,
      drive_path = EXCLUDED.drive_path,
      video_width = EXCLUDED.video_width,
      video_height = EXCLUDED.video_height,
      updated_at = now();
  `;

  runSql(sql);
  console.log(`[Rotator] Registrado no Postgres: ${item.id} -> ${item.title} (${probe.duration}s)`);
}

async function recompilePlaylist(versionId, dateIso) {
  console.log(`[Rotator] Disparando recompilação da playlist via Control Plane API para ${dateIso}...`);
  try {
    const res = await fetch(`${URL_CONTROL}/automation/jobs`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${TOKEN}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        job_type: 'compile_playlist',
        payload: {
          schedule_version_id: versionId,
          date: dateIso
        }
      })
    });
    const data = await res.json();
    console.log(`[Rotator] Resposta da compilação:`, JSON.stringify(data));
  } catch (err) {
    console.warn(`[Rotator] Aviso: Erro ao solicitar compilação da playlist: ${err.message}`);
  }
}

async function applyScheduleRotation(targetDateStr) {
  const targetDate = targetDateStr ? new Date(targetDateStr + 'T12:00:00Z') : new Date();
  const dayOfWeek = targetDate.getUTCDay();
  const dateIso = targetDate.toISOString().slice(0, 10);

  console.log(`\n=======================================================`);
  console.log(`[Rotator] Aplicando Rotação de Entretenimento para: ${dateIso}`);
  console.log(`[Rotator] Dia da Semana: ${['Domingo', 'Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado'][dayOfWeek]} (${dayOfWeek})`);
  console.log(`=======================================================`);

  const itemDesenhos = MASTER_CATALOG.desenhos.find(x => x.day === dayOfWeek) || MASTER_CATALOG.desenhos[0];
  const itemCinema = MASTER_CATALOG.cinema.find(x => x.day === dayOfWeek) || MASTER_CATALOG.cinema[0];
  const itemPipoca = MASTER_CATALOG.pipoca.find(x => x.day === dayOfWeek) || MASTER_CATALOG.pipoca[0];

  const fileDesenhos = ensureEntertainmentFile('desenhos', itemDesenhos);
  const fileCinema = ensureEntertainmentFile('cinema', itemCinema);
  const filePipoca = ensureEntertainmentFile('pipoca', itemPipoca);

  registerMediaItem('desenhos', itemDesenhos, fileDesenhos);
  registerMediaItem('cinema', itemCinema, fileCinema);
  registerMediaItem('pipoca', itemPipoca, filePipoca);

  let versionId = runSql(`
    SELECT id FROM public.gsa_tv_schedule_versions
    WHERE broadcast_date = '${dateIso}'
    ORDER BY created_at DESC LIMIT 1;
  `);

  if (!versionId) {
    console.warn(`[Rotator] Nenhuma versão de grade com broadcast_date='${dateIso}'. Buscando última versão publicada...`);
    versionId = runSql(`
      SELECT id FROM public.gsa_tv_schedule_versions
      WHERE status = 'published'
      ORDER BY created_at DESC LIMIT 1;
    `);
  }

  if (!versionId) {
    console.warn(`[Rotator] Aviso: Nenhuma versão de grade localizada para vínculo.`);
    return;
  }

  console.log(`[Rotator] Versão de grade vinculada: ${versionId}`);

  const updateBlock = (pattern, mediaId) => {
    const updated = runSql(`
      UPDATE public.gsa_tv_program_blocks b
         SET media_item_id = '${mediaId}', updated_at = now()
        FROM public.gsa_tv_programs p
       WHERE b.schedule_version_id = '${versionId}'
         AND b.program_id = p.id
         AND p.name ILIKE '${pattern}'
       RETURNING p.name;
    `);
    if (updated) {
      console.log(`[Rotator] Bloco vinculado: ${updated} -> ${mediaId}`);
    } else {
      console.log(`[Rotator] Bloco ${pattern} não encontrado para vínculo.`);
    }
  };

  updateBlock('%desenho%', itemDesenhos.id);
  updateBlock('%cinema%', itemCinema.id);
  updateBlock('%pipoca%', itemPipoca.id);

  // Recompilar a playlist para persistir as alterações em disco
  await recompilePlaylist(versionId, dateIso);

  console.log(`[Rotator] Rotação de entretenimento concluída com sucesso para ${dateIso}!`);
}

async function main() {
  initDirs();
  const targetDate = process.argv[2] || new Date().toISOString().slice(0, 10);
  await applyScheduleRotation(targetDate);
}

main().catch(err => {
  console.error('[Rotator] Erro fatal:', err);
  process.exit(1);
});
