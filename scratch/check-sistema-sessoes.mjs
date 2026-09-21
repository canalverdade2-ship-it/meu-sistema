import { runSshScript } from './ssh2-run.mjs';

async function main() {
  const script = `
psql "postgresql://supabase_admin:GSA_SENHA_FORTE_2026@127.0.0.1:5433/gsahub" -c "select id,ator_tipo,ator_nome,expira_em,criado_em from public.sistema_sessoes order by criado_em desc limit 3;"
`;
  const res = await runSshScript(script);
  console.log(res.stdout);
}

main().catch(console.error);
