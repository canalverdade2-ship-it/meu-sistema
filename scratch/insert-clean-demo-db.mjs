import { runSshScript } from './ssh2-run.mjs';

async function main() {
  const script = `
psql "postgresql://supabase_admin:GSA_SENHA_FORTE_2026@127.0.0.1:5433/gsahub" -c "
INSERT INTO public.gsa_tv_media_items (
  id, channel_id, title, original_filename, duration_s,
  video_codec, video_width, video_height, video_fps,
  audio_codec, audio_sample_rate, audio_channels,
  state, rights_ok, drive_path, media_kind, source_type,
  ai_generated, approval_state, metadata, created_at, updated_at
) VALUES (
  'media-demo-manha-news-clean',
  'ch-main',
  'Demonstração — GSA Manhã News (100% Limpa na Origem)',
  'vinheta_gsa_manha_news_clean.mp4',
  9,
  'h264', 1920, 1080, 30,
  'aac', 48000, 2,
  'ready', true,
  '/media/1/identity/vinhetas/vinheta-gsa-manha-news-clean-master.mp4',
  'identity', 'ai',
  true, 'approved',
  '{\\"clean_source\\": true, \\"watermark\\": false}'::jsonb,
  now(), now()
) ON CONFLICT (id) DO UPDATE SET
  title = EXCLUDED.title,
  drive_path = EXCLUDED.drive_path,
  video_width = EXCLUDED.video_width,
  video_height = EXCLUDED.video_height,
  state = 'ready',
  updated_at = now();
"
`;
  const res = await runSshScript(script);
  console.log(res.stdout);
  if (res.stderr) console.error(res.stderr);
}

main().catch(console.error);
