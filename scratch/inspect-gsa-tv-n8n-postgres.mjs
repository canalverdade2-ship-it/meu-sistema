import { runSshScript } from './ssh2-run.mjs';

const remote = String.raw`set -euo pipefail
db_user=$(sudo docker inspect n8n --format '{{range .Config.Env}}{{println .}}{{end}}' | awk -F= '$1=="DB_POSTGRESDB_USER"{print $2}')
db_name=$(sudo docker inspect n8n --format '{{range .Config.Env}}{{println .}}{{end}}' | awk -F= '$1=="DB_POSTGRESDB_DATABASE"{print $2}')
sudo docker exec evo-postgres psql -U "$db_user" -d "$db_name" -Atc "select id,name,active from workflow_entity where name like 'GSA TV %' order by name"
`;

const result = await runSshScript(remote, 45000);
process.stdout.write(result.stdout);
if (result.stderr) process.stderr.write(result.stderr);
