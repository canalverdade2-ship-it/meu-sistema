import { runSshScript } from './ssh2-run.mjs';

async function main() {
  const script = `
psql "postgresql://supabase_admin:GSA_SENHA_FORTE_2026@127.0.0.1:5433/gsahub" -t -c "
select metadata from public.gsa_tv_media_items where id='media-58eba934-bf86-45bb-a6ab-16f83aa4ab63';
"
`;
  const res = await runSshScript(script);
  console.log(res.stdout);
}

main().catch(console.error);
