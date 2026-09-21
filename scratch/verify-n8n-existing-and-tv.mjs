import { runSshScript } from './ssh2-run.mjs';
const r=await runSshScript(`set -euo pipefail
echo '=== workflows ==='
docker exec evo-postgres psql -U evo -d n8n -X -At -F '|' -c "select id,name,active from workflow_entity order by name;"
echo '=== n8n-public-env ==='
docker inspect --format '{{range .Config.Env}}{{println .}}{{end}}' n8n | grep -E '^(N8N_HOST|N8N_WEBHOOK_URL|N8N_EDITOR_BASE_URL|N8N_PROTOCOL|N8N_SECURE_COOKIE|N8N_PROXY_HOPS)=' | sort
echo '=== tv ==='
token=$(sudo sed -n 's/^INTERNAL_API_TOKEN=//p' /opt/gsa-tv/control-plane/.env | head -1)
curl -fsS -H "x-internal-token: $token" http://127.0.0.1:9202/automation/snapshot | python3 -c "import json,sys;d=json.load(sys.stdin);c=d.get('channel') or {};print('status=%s|desired=%s|playout=%s|signal=%s|error=%s'%(c.get('status'),c.get('desired_state'),c.get('playout_state'),c.get('signal_state'),c.get('last_error')))"
`);
process.stdout.write(r.stdout);process.stderr.write(r.stderr);