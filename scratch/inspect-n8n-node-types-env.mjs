import { runSshScript } from './ssh2-run.mjs';
const r=await runSshScript(`set -euo pipefail
echo '=== node types ==='
docker exec evo-postgres psql -U evo -d n8n -X -At -c 'select distinct n->>''type'' from workflow_entity w cross join lateral jsonb_array_elements(w.nodes::jsonb) n order by 1;' || true
echo '=== selected env names/values ==='
sudo awk -F= '/^N8N_(RUNNERS|UNVERIFIED|COMMUNITY|COMPRESSION)/{print $1"="$2}' /etc/gsa/n8n.env || true
`);
process.stdout.write(r.stdout);process.stderr.write(r.stderr);