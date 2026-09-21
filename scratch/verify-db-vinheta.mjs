import { runSshScript } from './ssh2-run.mjs';

async function main() {
  const script = `
psql "postgresql://supabase_admin:GSA_SENHA_FORTE_2026@127.0.0.1:5433/gsahub" -c "
SELECT id, title, duration_s, video_width, video_height, state, approval_state, media_kind
FROM public.gsa_tv_media_items
WHERE id = 'media-vinheta-gsa-ta-na-rede';
"
`;
  const res = await runSshScript(script);
  console.log(res.stdout);
}

main().catch(console.error);
