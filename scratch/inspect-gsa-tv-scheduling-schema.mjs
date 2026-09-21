import { runSshScript } from './ssh2-run.mjs';

const remote = String.raw`set -euo pipefail
pw=$(grep -oP 'Senha Master:\*\*\s*\K\S+' /dev/null 2>/dev/null || true)
export PGPASSWORD=$(sudo docker inspect gsa-tv-control-plane --format '{{range .Config.Env}}{{println .}}{{end}}' | awk -F'[/:@]' '$1=="DATABASE_URL=postgresql"{print $4}')
dburl=$(sudo docker inspect gsa-tv-control-plane --format '{{range .Config.Env}}{{println .}}{{end}}' | awk -F= '$1=="DATABASE_URL"{sub(/^DATABASE_URL=/,"");print}')
sudo docker exec gsa-tv-control-plane node - <<'NODE'
NODE
sudo -u postgres true 2>/dev/null || true
`;

// Use the database container's psql with the already configured local admin
// credential, without printing the secret.
const query = String.raw`set -euo pipefail
dburl=$(sudo docker inspect gsa-tv-control-plane --format '{{range .Config.Env}}{{println .}}{{end}}' | awk -F= '$1=="DATABASE_URL"{sub(/^DATABASE_URL=/,"");print}')
sudo docker run --rm --network host postgres:15-alpine psql "$dburl" -X -At -F '|' -c "
select 'columns',table_name,column_name,data_type,is_nullable,coalesce(column_default,'') from information_schema.columns where table_schema='public' and table_name in ('gsa_tv_programs','gsa_tv_schedule_versions','gsa_tv_program_blocks','gsa_tv_schedule_slots','gsa_tv_media_items','gsa_tv_graphics','gsa_tv_alert_settings') order by table_name,ordinal_position;
select 'media',id,title,drive_path,media_kind,state,rights_ok,approval_state,coalesce(metadata::text,'{}') from public.gsa_tv_media_items order by created_at;
select 'constraint',conname,pg_get_constraintdef(oid) from pg_constraint where conrelid in ('public.gsa_tv_programs'::regclass,'public.gsa_tv_schedule_versions'::regclass,'public.gsa_tv_program_blocks'::regclass);
"`;

const result = await runSshScript(query, 90000);
process.stdout.write(result.stdout);
if (result.stderr) process.stderr.write(result.stderr);
