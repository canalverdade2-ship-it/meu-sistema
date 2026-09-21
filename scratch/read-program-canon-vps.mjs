import { runSshScript } from './ssh2-run.mjs';
const result = await runSshScript(`set -eu
DB_URL=$(sudo awk -F= '$1=="DATABASE_URL"{sub(/^DATABASE_URL=/,"");print;exit}' /opt/gsa-tv/control-plane/.env)
echo '=== PROGRAMS ==='
psql "$DB_URL" -X -P pager=off -c "select row_to_json(x) from (select * from public.gsa_tv_programs where status='published' order by name) x"
echo '=== PRESENTERS ==='
PRESENTER_TABLE=$(psql "$DB_URL" -X -Atc "select tablename from pg_tables where schemaname='public' and tablename ilike '%presenter%' order by tablename limit 1")
if [ -n "$PRESENTER_TABLE" ]; then psql "$DB_URL" -X -P pager=off -c "select row_to_json(x) from (select * from public.$PRESENTER_TABLE order by name) x"; else echo 'no presenter table'; fi
echo '=== EDITORIAL MEMORY ==='
psql "$DB_URL" -X -P pager=off -c "select row_to_json(x) from (select * from public.gsa_tv_ai_memory order by updated_at desc limit 100) x" 2>/dev/null || true
`, 120000);
process.stdout.write(result.stdout);
if(result.stderr) process.stderr.write(result.stderr);
