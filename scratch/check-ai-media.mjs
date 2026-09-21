import { runSshScript } from './ssh2-run.mjs';

async function main() {
  const script = `
psql "postgresql://supabase_admin:GSA_SENHA_FORTE_2026@127.0.0.1:5433/gsahub" -c "
SELECT id, title, duration_s, media_kind, source_type, approval_state, state, created_at
FROM public.gsa_tv_media_items
WHERE source_type = 'ai'
ORDER BY created_at DESC
LIMIT 5;
"
`;
  const res = await runSshScript(script);
  console.log('OUTPUT:\n', res.stdout);
}

main().catch(console.error);
