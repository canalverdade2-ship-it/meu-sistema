import { runSshScript } from './ssh2-run.mjs';

const result = await runSshScript(`set -u
DB_URL=$(sudo awk -F= '$1=="DATABASE_URL"{sub(/^DATABASE_URL=/,"");print;exit}' /opt/gsa-tv/control-plane/.env)
echo '=== ENABLED GRAPHICS ==='
psql "$DB_URL" -X -P pager=off -c "select id,name,layer_type,enabled,text_content,config,updated_at from public.gsa_tv_graphics where channel_id='ch-main' order by updated_at desc nulls last,created_at desc"
echo '=== RECENT BADGE COMMANDS ==='
psql "$DB_URL" -X -P pager=off -c "select command,state,payload,created_at,started_at,finished_at,error from public.gsa_tv_playout_jobs where command='live_badge_toggle' order by created_at desc limit 12"
echo '=== SNAPSHOT ==='
curl -fsS http://127.0.0.1:9202/api/channels/ch-main/snapshot || true; echo
echo '=== ENGINE ==='
curl -fsS http://127.0.0.1:9210/health || true; echo
`, 120000);
process.stdout.write(result.stdout);
if (result.stderr) process.stderr.write(result.stderr);
