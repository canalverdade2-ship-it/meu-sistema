import { runSshScript } from './ssh2-run.mjs';

async function main() {
  const script = `
echo "=== 1. DOCKER PS NO SERVIDOR ==="
sudo docker ps --format 'table {{.Names}}\t{{.Status}}\t{{.Image}}'

echo "=== 2. PROCESSOS FFMPEG ATIVOS ==="
sudo ps aux | grep -i ffmpeg | grep -v grep || echo "Nenhum ffmpeg rodando no host"

echo "=== 3. STATUS DO CANAL NO POSTGRESQL ==="
psql "postgresql://supabase_admin:GSA_SENHA_FORTE_2026@127.0.0.1:5433/gsahub" -c "
select id, status, desired_state, playout_state, signal_state, last_signal_at from public.gsa_tv_channels;
"

echo "=== 4. ÚLTIMOS LOGS DO ENCODER ENGINE (SE EXISTIR) ==="
sudo docker logs --tail 25 gsa-tv-encoder-engine 2>&1 || sudo docker logs --tail 25 encoder-engine 2>&1 || echo "Sem container encoder-engine"

echo "=== 5. ARQUIVOS RECENTES EM /home/opc/ OU NA VPS ==="
find /home/opc/ /opt/gsa-tv/ -maxdepth 3 -mmin -120 2>/dev/null | head -30
`;
  const res = await runSshScript(script);
  console.log(res.stdout);
  if (res.stderr) console.error(res.stderr);
}

main().catch(console.error);
