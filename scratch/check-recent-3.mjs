import { runSshScript } from './ssh2-run.mjs';

async function main() {
  const script = `
psql "postgresql://supabase_admin:GSA_SENHA_FORTE_2026@127.0.0.1:5433/gsahub" -t -c "
select id,title,media_kind,created_at from public.gsa_tv_media_items order by created_at desc limit 3;
"
`;
  const res = await runSshScript(script);
  console.log(res.stdout);
}

main().catch(console.error);
