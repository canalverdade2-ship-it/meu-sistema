import { runSshScript } from './ssh2-run.mjs';
const result = await runSshScript(`set -u
DB_URL=$(sudo awk -F= '$1=="DATABASE_URL"{sub(/^DATABASE_URL=/,"");print;exit}' /opt/gsa-tv/control-plane/.env)
psql "$DB_URL" -X -P pager=off -c "select column_name from information_schema.columns where table_schema='public' and table_name='gsa_tv_alert_settings' order by ordinal_position"
psql "$DB_URL" -X -P pager=off -c "select row_to_json(x) from (select * from public.gsa_tv_alert_settings) x"
psql "$DB_URL" -X -P pager=off -c "select state,count(*),max(created_at) latest from public.gsa_tv_alert_deliveries group by state order by state"
`,180000);
process.stdout.write(result.stdout); if(result.stderr) process.stderr.write(result.stderr);
