import { runSshScript } from './ssh2-run.mjs';
const result = await runSshScript(`set -u
DB_URL=$(sudo awk -F= '$1=="DATABASE_URL"{sub(/^DATABASE_URL=/,"");print;exit}' /opt/gsa-tv/control-plane/.env)
echo 'columns:'
psql "$DB_URL" -X -At -F '|' -c "select column_name,data_type from information_schema.columns where table_schema='public' and table_name='gsa_tv_program_blocks' order by ordinal_position"
echo 'published versions:'
psql "$DB_URL" -X -P pager=off -c "select broadcast_date,state,version,title from public.gsa_tv_schedule_versions where broadcast_date>=current_date order by broadcast_date,version desc limit 20"
echo 'unbound future blocks:'
psql "$DB_URL" -X -P pager=off -c "select count(*) total,count(*) filter(where b.media_item_id is null and b.episode_id is null and b.live_source_id is null and b.campaign_id is null) unbound from public.gsa_tv_program_blocks b join public.gsa_tv_schedule_versions v on v.id=b.schedule_version_id where v.broadcast_date>=current_date and v.state='published'"
echo 'available media:'
psql "$DB_URL" -X -P pager=off -c "select id,title,duration_s,state,approval_state,rights_ok,drive_path from public.gsa_tv_media_items order by updated_at desc"
`,180000);
process.stdout.write(result.stdout); if(result.stderr) process.stderr.write(result.stderr);
