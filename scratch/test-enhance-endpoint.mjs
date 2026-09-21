import { runSshScript } from './ssh2-run.mjs';

async function main() {
  // Pegar uma sessao admin valida do banco
  const script = `
SESSION_JSON=$(psql "postgresql://supabase_admin:GSA_SENHA_FORTE_2026@127.0.0.1:5433/gsahub" -t -A -c "select json_build_object('id', s.id, 'token', s.token) from public.gsa_admin_sessoes s where s.expira_em > now() and s.revogado = false order by s.criado_em desc limit 1;")
echo "Sessao: $SESSION_JSON"
SESSAO_ID=$(echo "$SESSION_JSON" | jq -r .id)
SESSAO_TOKEN=$(echo "$SESSION_JSON" | jq -r .token)

echo "Testando chamada POST /media/media-f5a6e79b-d245-4d10-b955-fde6dc228d9e/enhance..."
curl -s -X POST "http://127.0.0.1:9202/media/media-f5a6e79b-d245-4d10-b955-fde6dc228d9e/enhance" \
  -H "content-type: application/json" \
  -H "x-gsa-session-id: $SESSAO_ID" \
  -H "x-gsa-session-token: $SESSAO_TOKEN" \
  -d '{"profile": "1080p_pro"}'
echo ""
`;
  const res = await runSshScript(script);
  console.log(res.stdout);
}

main().catch(console.error);
