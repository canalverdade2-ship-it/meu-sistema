import { runSshScript } from './ssh2-run.mjs';
const result=await runSshScript(`set -euo pipefail
envs=$(sudo docker inspect n8n --format '{{range .Config.Env}}{{println .}}{{end}}')
value(){ printf '%s\n' "$envs" | awk -F= -v key="$1" '$1==key{sub("^[^=]*=","");print;exit}'; }
db_password=$(value DB_POSTGRESDB_PASSWORD)
sudo docker exec -e PGPASSWORD="$db_password" evo-postgres psql -U "$(value DB_POSTGRESDB_USER)" -d "$(value DB_POSTGRESDB_DATABASE)" -X -At -F '|' -c 'select type,name from credentials_entity order by type,name'`,30000);
process.stdout.write(result.stdout);if(result.stderr)process.stderr.write(result.stderr);
