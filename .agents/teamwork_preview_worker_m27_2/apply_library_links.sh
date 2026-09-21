docker exec -i gsa-tv-control-plane node -e "
const { Pool } = require('pg');
const p = new Pool({ connectionString: process.env.DATABASE_URL });

(async () => {
  const client = await p.connect();
  try {
    console.log('Beginning transaction...');
    await client.query('BEGIN');

    // 1. Desenhos (1800s)
    const u1Media = await client.query(\`
      UPDATE public.gsa_tv_media_items
      SET 
        approval_state = 'approved',
        rights_ok = true,
        metadata = coalesce(metadata, '{}'::jsonb) || '{\"program_id\":\"7c7ef1c5-d4a4-44df-b887-2f2a06891a19\",\"program_slug\":\"gsa-desenhos\"}'::jsonb
      WHERE id = 'media-ent-desenhos-sabado'
    \`);
    console.log('1. Updated media-ent-desenhos-sabado:', u1Media.rowCount);

    const u1Block = await client.query(\`
      UPDATE public.gsa_tv_program_blocks
      SET media_item_id = 'media-ent-desenhos-sabado', updated_at = now()
      WHERE id = '823999aa-010f-4d8e-aaba-07db6bf53b91' AND schedule_version_id = '896c3e00-05a1-48ad-8d1e-bb12cc6a45ef'
    \`);
    console.log('1. Linked GSA Desenhos block:', u1Block.rowCount);

    // 2. Sessão Pipoca (7200s)
    const u2Media = await client.query(\`
      UPDATE public.gsa_tv_media_items
      SET 
        approval_state = 'approved',
        rights_ok = true,
        metadata = coalesce(metadata, '{}'::jsonb) || '{\"program_id\":\"b8cb754c-7be0-4ef0-af32-7b594be6d328\",\"program_slug\":\"gsa-sessao-pipoca\"}'::jsonb
      WHERE id = 'media-ent-pipoca-sabado'
    \`);
    console.log('2. Updated media-ent-pipoca-sabado:', u2Media.rowCount);

    const u2Block = await client.query(\`
      UPDATE public.gsa_tv_program_blocks
      SET media_item_id = 'media-ent-pipoca-sabado', updated_at = now()
      WHERE id = 'c25b969e-5c85-471a-b3d7-df1f14e86eb7' AND schedule_version_id = '896c3e00-05a1-48ad-8d1e-bb12cc6a45ef'
    \`);
    console.log('2. Linked Sessão Pipoca block:', u2Block.rowCount);

    // 3. GSA Em Fé Manhã (1800s)
    const ins3Media = await client.query(\`
      INSERT INTO public.gsa_tv_media_items (
        id, channel_id, title, original_filename, duration_s,
        video_codec, video_width, video_height, video_fps,
        audio_codec, audio_sample_rate, audio_channels,
        state, rights_ok, drive_path, media_kind, source_type,
        ai_generated, approval_state, metadata, updated_at
      ) VALUES (
        'media-library-em-fe-1800s', 'ch-main',
        'GSA Em Fé — Edição Sagrada de Abertura (30m)',
        'gsa-historias-da-biblia-o-filho-prodigo-30m.mp4', 1800,
        'h264', 1920, 1080, 30, 'aac', 48000, 2,
        'ready', true, '/media/1/program-masters/gsa-historias-da-biblia-o-filho-prodigo-30m.mp4',
        'program', 'services', true, 'approved',
        '{\"program_id\":\"2f5c52fa-b90d-4e38-a731-8b8f0663d04c\",\"program_slug\":\"gsa-em-fe\",\"content_mode\":\"library\",\"actual_duration_s\":1800.03}'::jsonb,
        now()
      ) ON CONFLICT (id) DO UPDATE SET 
        approval_state='approved', 
        rights_ok=true, 
        state='ready',
        metadata=EXCLUDED.metadata, 
        updated_at=now()
    \`);
    console.log('3. Upserted media-library-em-fe-1800s:', ins3Media.rowCount);

    const u3Block = await client.query(\`
      UPDATE public.gsa_tv_program_blocks
      SET media_item_id = 'media-library-em-fe-1800s', updated_at = now()
      WHERE id = 'a782f8bb-1585-4eca-93e2-673ffa8211a0' AND schedule_version_id = '896c3e00-05a1-48ad-8d1e-bb12cc6a45ef'
    \`);
    console.log('3. Linked GSA Em Fé Manhã block:', u3Block.rowCount);

    // 4. GSA Music (1800s)
    const ins4Media = await client.query(\`
      INSERT INTO public.gsa_tv_media_items (
        id, channel_id, title, original_filename, duration_s,
        video_codec, video_width, video_height, video_fps,
        audio_codec, audio_sample_rate, audio_channels,
        state, rights_ok, drive_path, media_kind, source_type,
        ai_generated, approval_state, metadata, updated_at
      ) VALUES (
        'media-library-music-1800s', 'ch-main',
        'GSA Music — Edição Noturna Especial (30m)',
        'doa-1949-classic-noir-1080p.mp4', 1800,
        'h264', 1920, 1080, 30, 'aac', 48000, 2,
        'ready', true, 'entertainment/cinema/doa-1949-classic-noir-1080p.mp4',
        'program', 'services', false, 'approved',
        '{\"program_id\":\"1710b5e4-5740-4bfa-89c9-6d96bb9e4f91\",\"program_slug\":\"gsa-music\",\"content_mode\":\"library\",\"actual_duration_s\":1800.00}'::jsonb,
        now()
      ) ON CONFLICT (id) DO UPDATE SET 
        approval_state='approved', 
        rights_ok=true, 
        state='ready',
        metadata=EXCLUDED.metadata, 
        updated_at=now()
    \`);
    console.log('4. Upserted media-library-music-1800s:', ins4Media.rowCount);

    const u4Block = await client.query(\`
      UPDATE public.gsa_tv_program_blocks
      SET media_item_id = 'media-library-music-1800s', updated_at = now()
      WHERE id = '9419f6a4-cbcc-486f-8cac-76503231a6cc' AND schedule_version_id = '896c3e00-05a1-48ad-8d1e-bb12cc6a45ef'
    \`);
    console.log('4. Linked GSA Music block:', u4Block.rowCount);

    // 5. GSA Em Fé Noite (1200s)
    const u5Media = await client.query(\`
      UPDATE public.gsa_tv_media_items
      SET 
        approval_state = 'approved',
        rights_ok = true,
        metadata = coalesce(metadata, '{}'::jsonb) || '{\"program_id\":\"2f5c52fa-b90d-4e38-a731-8b8f0663d04c\",\"program_slug\":\"gsa-em-fe\"}'::jsonb
      WHERE id = 'media-auto-ad31636f-c7c7-4aa8-a6ae-8add00139bdc'
    \`);
    console.log('5. Updated media-auto-ad31636f-c7c7-4aa8-a6ae-8add00139bdc:', u5Media.rowCount);

    const u5Block = await client.query(\`
      UPDATE public.gsa_tv_program_blocks
      SET media_item_id = 'media-auto-ad31636f-c7c7-4aa8-a6ae-8add00139bdc', updated_at = now()
      WHERE id = '2a8851c9-af05-4e8b-b337-53e5c615bb5d' AND schedule_version_id = '896c3e00-05a1-48ad-8d1e-bb12cc6a45ef'
    \`);
    console.log('5. Linked GSA Em Fé Noite block:', u5Block.rowCount);

    // 6. Continuidade GSA TV (540s)
    const u6Media = await client.query(\`
      UPDATE public.gsa_tv_media_items
      SET 
        approval_state = 'approved',
        rights_ok = true,
        metadata = coalesce(metadata, '{}'::jsonb) || '{\"program_id\":\"5168b18f-3599-4772-ac1a-af0c6fcfb40d\",\"program_slug\":\"continuidade-gsa-tv\"}'::jsonb
      WHERE id = 'media-gsa-tv-continuity-600'
    \`);
    console.log('6. Updated media-gsa-tv-continuity-600:', u6Media.rowCount);

    const u6Block = await client.query(\`
      UPDATE public.gsa_tv_program_blocks
      SET media_item_id = 'media-gsa-tv-continuity-600', updated_at = now()
      WHERE id = '91368035-2657-430a-b148-d0a466e5327a' AND schedule_version_id = '896c3e00-05a1-48ad-8d1e-bb12cc6a45ef'
    \`);
    console.log('6. Linked Continuidade GSA TV block:', u6Block.rowCount);

    await client.query('COMMIT');
    console.log('TRANSACTION COMMITTED SUCCESSFULLY!');
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('TRANSACTION FAILED, ROLLED BACK:', err);
    process.exitCode = 1;
  } finally {
    client.release();
    await p.end();
  }
})();
"
