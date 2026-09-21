import { runSshScript } from './ssh2-run.mjs';
const r=await runSshScript(`set -euo pipefail
cat >/tmp/node-types.sql <<'SQL'
select distinct elem->>'type'
from workflow_entity w
cross join lateral jsonb_array_elements(w.nodes::jsonb) elem
order by 1;
SQL
docker exec -i evo-postgres psql -U evo -d n8n -X -At < /tmp/node-types.sql
rm -f /tmp/node-types.sql
`);
process.stdout.write(r.stdout);process.stderr.write(r.stderr);