import { runSshScript } from './ssh2-run.mjs';

async function main() {
  const script = `
psql "postgresql://supabase_admin:GSA_SENHA_FORTE_2026@127.0.0.1:5433/gsahub" -c "
select channel_id, rtmp_server, stream_key_ciphertext from public.gsa_tv_channel_secrets;
"
`;
  const res = await runSshScript(script);
  console.log(res.stdout);
}

main().catch(console.error);
