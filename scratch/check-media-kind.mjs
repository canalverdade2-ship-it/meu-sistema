import { runSshScript } from './ssh2-run.mjs';

async function main() {
  const script = `
psql "postgresql://supabase_admin:GSA_SENHA_FORTE_2026@127.0.0.1:5433/gsahub" -c "
SELECT pg_get_constraintdef(oid)
FROM pg_constraint
WHERE conname = 'gsa_tv_media_kind_valid';
"
`;
  const res = await runSshScript(script);
  console.log('CONSTRAINT:\n', res.stdout);
}

main().catch(console.error);
