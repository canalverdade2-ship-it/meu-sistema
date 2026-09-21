import { runSshScript } from './ssh2-run.mjs';

async function main() {
  const script = `
psql "postgresql://supabase_admin:GSA_SENHA_FORTE_2026@127.0.0.1:5433/gsahub" -c "select id,name,quality_profile,status,desired_state,playout_state from public.gsa_tv_channels;"
`;
  const res = await runSshScript(script);
  console.log(res.stdout);
}

main().catch(console.error);
