import { runSshScript } from './ssh2-run.mjs';
const remote=String.raw`set +e
db=$(sudo docker inspect gsa-tv-control-plane --format '{{range .Config.Env}}{{println .}}{{end}}' | awk -F= '$1=="DATABASE_URL"{sub(/^DATABASE_URL=/,"");print;exit}')
run(){ label="$1"; sql="$2"; printf '%s|' "$label"; out=$(psql "$db" -X -v ON_ERROR_STOP=1 -Atc "$sql" 2>&1); code=$?; if [ $code -eq 0 ]; then echo "ok|$out"; else echo "FAIL|$out"; fi; }
run channel "select count(*) from (select id,name,status,desired_state,playout_state,signal_state,last_heartbeat_at,last_signal_at,last_error,quality_profile,(coalesce(config->>'youtube_video_id','')<>'') youtube_video_id_configured from public.gsa_tv_channels where id='ch-main') q"
run incidents "select count(*) from (select id,severity,message,created_at from public.gsa_tv_incidents where channel_id='ch-main' and not resolved order by created_at desc limit 20) q"
run rights "select count(*) from (select id,title,rights_expires_at from public.gsa_tv_media_items where channel_id='ch-main' and rights_expires_at is not null and rights_expires_at<now()+interval '7 days' order by rights_expires_at limit 50) q"
run execution "select count(*) from (select count(*)::int executions,count(*) filter(where outcome='fallback')::int fallbacks,coalesce(sum(duration_s),0)::numeric total_duration_s from public.gsa_tv_execution_log where channel_id='ch-main' and created_at>now()-interval '24 hours') q"
run backups "select count(*) from (select id,state,backup_type,started_at,finished_at,size_bytes from public.gsa_tv_backup_runs where channel_id='ch-main' order by started_at desc limit 5) q"
run jobs "select count(*) from (select id,job_type,status,progress,error_message,created_at,finished_at from public.gsa_tv_jobs where channel_id='ch-main' order by created_at desc limit 20) q"
run ai_jobs "select count(*) from (select state,count(*)::int count from public.gsa_tv_ai_jobs j join public.gsa_tv_ai_projects p on p.id=j.project_id where p.channel_id='ch-main' and j.created_at>now()-interval '24 hours' group by state order by state) q"
run schedule "select count(*) from (select id,broadcast_date,version,state,title,published_at from public.gsa_tv_schedule_versions where channel_id='ch-main' order by broadcast_date desc,version desc limit 5) q"
run media_pending "select count(*) from (select id,title,state,updated_at from public.gsa_tv_media_items where channel_id='ch-main' and state in ('received','processing') and updated_at<now()-interval '2 minutes' order by updated_at limit 50) q"
run ai_ready "select count(*) from (select id,name,project_type,state,autonomy_mode,updated_at from public.gsa_tv_ai_projects where channel_id='ch-main' and state='approved' and autonomy_mode in ('supervised_auto','authorized_routine') order by updated_at limit 20) q"
run alerts "select count(*) from (select enabled,min_severity,cooldown_minutes,(coalesce(whatsapp_number,'')<>'') recipient_configured from public.gsa_tv_alert_settings where channel_id='ch-main' limit 1) q"
`;
const r=await runSshScript(remote,45000);process.stdout.write(r.stdout);if(r.stderr)process.stderr.write(r.stderr);
