import { runSshScript } from './ssh2-run.mjs';

const result = await runSshScript(`set -Eeuo pipefail
DB_URL=$(sudo awk -F= '$1=="DATABASE_URL"{sub(/^DATABASE_URL=/,"");print;exit}' /opt/gsa-tv/control-plane/.env)
echo '=== COLUMNS ==='
psql "$DB_URL" -X -At -F $'\\t' -c "select column_name,data_type from information_schema.columns where table_schema='public' and table_name='gsa_tv_weekly_grid_slots' order by ordinal_position"
echo '=== ROWS ==='
psql "$DB_URL" -X -At -F $'\\t' -c "select row_to_json(x) from (select * from public.gsa_tv_weekly_grid_slots order by 1,2) x"
echo '=== PROGRAMS ==='
psql "$DB_URL" -X -At -F $'\\t' -c "select row_to_json(x) from (select * from public.gsa_tv_programs order by name) x"
`, 180000);
process.stdout.write(result.stdout);
if (result.stderr) process.stderr.write(result.stderr);
