import { runSshScript } from './ssh2-run.mjs';

async function main() {
  const script = `
psql "postgresql://supabase_admin:GSA_SENHA_FORTE_2026@127.0.0.1:5433/gsahub" -c "
select id, title, drive_path, metadata from public.gsa_tv_media_items where title like '%V12%' or title like '%Edição Oficial%';
"
`;
  const res = await runSshScript(script);
  console.log(res.stdout);
}

main().catch(console.error);
