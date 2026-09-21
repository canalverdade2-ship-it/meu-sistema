import { runSshScript } from './ssh2-run.mjs';

async function main() {
  const script = `
echo "=== 1. STATUS AO VIVO DO CANAL ==="
psql "postgresql://supabase_admin:GSA_SENHA_FORTE_2026@127.0.0.1:5433/gsahub" -c "
select id, status, desired_state, playout_state, signal_state, last_signal_at from public.gsa_tv_channels where id='ch-main';
"

echo "=== 2. MÍDIA QUE ESTÁ RODANDO AGORA NO FFMPEG ==="
sudo docker exec gsa-tv-ffplayout ps aux | grep ffmpeg | head -3

echo "=== 3. ÚLTIMAS 5 MÍDIAS CADASTRADAS NO BANCO ==="
psql "postgresql://supabase_admin:GSA_SENHA_FORTE_2026@127.0.0.1:5433/gsahub" -c "
select id, title, media_kind, state, created_at from public.gsa_tv_media_items order by created_at desc limit 5;
"

echo "=== 4. FILA DE JOBS RECENTES ==="
psql "postgresql://supabase_admin:GSA_SENHA_FORTE_2026@127.0.0.1:5433/gsahub" -c "
select id, job_type, status, progress, created_at from public.gsa_tv_jobs order by created_at desc limit 3;
"
`;
  const res = await runSshScript(script);
  console.log(res.stdout);
  if (res.stderr) console.error(res.stderr);
}

main().catch(console.error);
