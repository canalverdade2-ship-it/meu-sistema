import { runSshScript } from './ssh2-run.mjs';
const script=String.raw`set -euo pipefail
echo '=== services ==='
sudo docker ps --format '{{.Names}}|{{.Image}}|{{.Status}}' | grep -E '^(gsa-tv-|n8n)' || true
echo '=== editorial file ==='
sudo test -f /opt/gsa-tv/cache/media/1/editorial/gsa-hub-editorial-ep01.mp4 && sudo stat -c '%n|%s|%y' /opt/gsa-tv/cache/media/1/editorial/gsa-hub-editorial-ep01.mp4 || echo missing
echo '=== state ==='
curl -fsS http://127.0.0.1:9202/health || true; echo
dburl=$(sudo docker inspect gsa-tv-control-plane --format '{{range .Config.Env}}{{println .}}{{end}}' | awk -F= '$1=="DATABASE_URL"{sub(/^DATABASE_URL=/,"");print;exit}')
sudo docker run --rm -i --network host postgres:15-alpine psql "$dburl" -X -At -F '|' <<'SQL'
select 'channel',status,desired_state,playout_state,signal_state,coalesce(last_error,'') from public.gsa_tv_channels where id='ch-main';
select 'media',id,title,duration_s,state,rights_ok,approval_state,drive_path from public.gsa_tv_media_items where id='media-gsa-hub-editorial-ep01';
select 'rights',count(*) from public.gsa_tv_rights_records where media_item_id='media-gsa-hub-editorial-ep01' and status='approved';
select 'program',id,name,status,default_duration_s from public.gsa_tv_programs where channel_id='ch-main' and name='GSA HUB — Uma estrutura para resolver';
select 'schedule',broadcast_date,version,state,title from public.gsa_tv_schedule_versions where channel_id='ch-main' and state='published' order by broadcast_date;
select 'blocks',v.broadcast_date,count(*),sum(b.planned_duration_s) from public.gsa_tv_schedule_versions v join public.gsa_tv_program_blocks b on b.schedule_version_id=v.id where v.channel_id='ch-main' and v.state='published' group by v.broadcast_date order by v.broadcast_date;
select 'jobs',job_type,status,progress,coalesce(error_message,'') from public.gsa_tv_jobs where created_at>now()-interval '20 minutes' order by created_at desc limit 12;
SQL
`;
const r=await runSshScript(script,120000);process.stdout.write(r.stdout);if(r.stderr)process.stderr.write(r.stderr);
