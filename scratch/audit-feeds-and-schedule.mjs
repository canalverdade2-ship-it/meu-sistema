import { runSshScript } from './ssh2-run.mjs';

async function main() {
  const script = `
echo "=== 1. STATUS DO CANAL E PLAYOUT ==="
psql "postgresql://supabase_admin:GSA_SENHA_FORTE_2026@127.0.0.1:5433/gsahub" -c "
select id, status, desired_state, playout_state, signal_state, last_error from public.gsa_tv_channels;
"

echo "=== 2. SLOTS DA GRADE ATUALMENTE NO BANCO ==="
psql "postgresql://supabase_admin:GSA_SENHA_FORTE_2026@127.0.0.1:5433/gsahub" -c "
select count(*) as total_slots, min(scheduled_start) as inicio, max(scheduled_end) as fim from public.gsa_tv_schedule_slots;
"

echo "=== 3. TESTE DE CONEXÃO COM FEEDS OFICIAIS ==="
curl -s "https://agenciabrasil.ebc.com.br/rss/ultimasnoticias/feed.xml" | grep "<title>" | head -5
curl -s "https://economia.awesomeapi.com.br/last/USD-BRL,EUR-BRL,BTC-BRL" | head -1
`;
  const res = await runSshScript(script);
  console.log(res.stdout);
  if (res.stderr) console.error(res.stderr);
}

main().catch(console.error);
