import { runSshScript } from './ssh2-run.mjs';

async function main() {
  const script = `
echo "=== 1. CHECAGEM DA MÍDIA DRAFT NO BANCO ==="
psql "postgresql://supabase_admin:GSA_SENHA_FORTE_2026@127.0.0.1:5433/gsahub" -c "
select id, title, state, approval_state, rights_ok, duration_s, drive_path from public.gsa_tv_media_items where id='media-gsa-manha-news-2026-09-04-draft-qc-v1';
"

echo "=== 2. SLOTS AGENDADOS PARA 04/09 ==="
psql "postgresql://supabase_admin:GSA_SENHA_FORTE_2026@127.0.0.1:5433/gsahub" -c "
select id, scheduled_start, scheduled_end, media_item_id from public.gsa_tv_schedule_slots where scheduled_start::text like '2026-09-04%' limit 5;
"

echo "=== 3. VERSÃO DA IMAGEM DO CONTROL PLANE ==="
sudo docker inspect gsa-tv-control-plane --format '{{.Config.Image}}'
`;
  const res = await runSshScript(script);
  console.log(res.stdout);
  if (res.stderr) console.error(res.stderr);
}

main().catch(console.error);
