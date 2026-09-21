import { runSshScript } from './ssh2-run.mjs';

async function main() {
  const script = `
psql "postgresql://supabase_admin:GSA_SENHA_FORTE_2026@127.0.0.1:5433/gsahub" -c "
select id, title, drive_path, duration_s, video_width, video_height, video_fps, audio_sample_rate, state, metadata from public.gsa_tv_media_items where id='media-gsa-manha-news-2026-09-04-draft-qc-v1';
"
`;
  const res = await runSshScript(script);
  console.log(res.stdout);
}

main().catch(console.error);
