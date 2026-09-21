import { runSshScript } from './ssh2-run.mjs';

async function main() {
  const script = `
psql "postgresql://supabase_admin:GSA_SENHA_FORTE_2026@127.0.0.1:5433/gsahub" -c "
select id,title,drive_path,original_filename from public.gsa_tv_media_items where original_filename like '%Manha%' or title like '%Manh%' or title like '%GSA NEWS%';
"
`;
  const res = await runSshScript(script);
  console.log(res.stdout);
}

main().catch(console.error);
