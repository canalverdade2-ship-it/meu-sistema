import { runSshScript } from './ssh2-run.mjs';

async function main() {
  const script = `
psql "postgresql://supabase_admin:GSA_SENHA_FORTE_2026@127.0.0.1:5433/gsahub" -c "select id,title,drive_path,video_width,video_height,video_bitrate_kbps from public.gsa_tv_media_items where id='media-f5a6e79b-d245-4d10-b955-fde6dc228d9e';"
`;
  const res = await runSshScript(script);
  console.log(res.stdout);
}

main().catch(console.error);
