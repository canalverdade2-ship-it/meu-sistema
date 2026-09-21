import {runSshScript} from './ssh2-run.mjs';
const r=await runSshScript(`set -u
DBURL=$(sudo docker inspect gsa-tv-encoder-engine --format '{{range .Config.Env}}{{println .}}{{end}}' | awk -F= '$1=="DATABASE_URL"{sub(/^DATABASE_URL=/,"");print;exit}')
sudo docker run --rm -i --network host postgres:15-alpine psql -X -v ON_ERROR_STOP=1 -P pager=off -At "$DBURL" <<'SQL'
select '=== WEEKLY GRID COVERAGE ===';
select weekday||'|slots='||count(*)||'|enabled='||count(*) filter(where enabled)||'|seconds='||sum(case when end_time<=start_time then extract(epoch from(end_time-start_time))+86400 else extract(epoch from(end_time-start_time)) end) filter(where enabled) from public.gsa_tv_weekly_grid_slots group by weekday order by weekday;
with x as (select weekday,start_time,end_time,lag(end_time) over(partition by weekday order by start_time) prev_end from public.gsa_tv_weekly_grid_slots where enabled) select 'gap_or_overlap|'||weekday||'|'||prev_end||'->'||start_time||'|delta_s='||extract(epoch from(start_time-prev_end)) from x where prev_end is not null and start_time<>prev_end order by weekday,start_time;
select 'zero_length_slot|'||id||'|'||weekday||'|'||start_time||'|'||end_time from public.gsa_tv_weekly_grid_slots where enabled and end_time=start_time;
select 'grid_missing_program|'||count(*) from public.gsa_tv_weekly_grid_slots g left join public.gsa_tv_programs p on p.id=g.program_id where g.enabled and p.id is null;
select 'program_unused_grid|'||p.name from public.gsa_tv_programs p left join public.gsa_tv_weekly_grid_slots g on g.program_id=p.id and g.enabled where p.status='active' group by p.id,p.name having count(g.id)=0 order by p.name;

select '=== PUBLISHED SCHEDULE ===';
select broadcast_date||'|'||count(*)||'|published='||max(published_at) from public.gsa_tv_schedule_versions where state='published' group by broadcast_date having count(*)>1 order by broadcast_date;
select 'published_without_blocks|'||v.id||'|'||v.broadcast_date from public.gsa_tv_schedule_versions v left join public.gsa_tv_program_blocks b on b.schedule_version_id=v.id where v.state='published' group by v.id,v.broadcast_date having count(b.id)=0 order by v.broadcast_date;
select 'block_missing_asset|'||b.block_type||'|'||count(*) from public.gsa_tv_program_blocks b join public.gsa_tv_schedule_versions v on v.id=b.schedule_version_id and v.state='published' where b.media_item_id is null and b.episode_id is null and b.live_source_id is null group by b.block_type order by count(*) desc;
select 'future_content_asset_coverage|total='||count(*)||'|missing='||count(*) filter(where b.media_item_id is null and b.episode_id is null and b.live_source_id is null) from public.gsa_tv_program_blocks b join public.gsa_tv_schedule_versions v on v.id=b.schedule_version_id and v.state='published' where v.broadcast_date>=current_date and b.block_type='content';
select 'block_duration_nonpositive|'||count(*) from public.gsa_tv_program_blocks b join public.gsa_tv_schedule_versions v on v.id=b.schedule_version_id and v.state='published' where coalesce(b.planned_duration_s,0)<=0;

select '=== RIGHTS/MEDIA ===';
select 'ready_rights_false|'||count(*) from public.gsa_tv_media_items where state='ready' and not rights_ok;
select 'ready_rights_expired|'||count(*) from public.gsa_tv_media_items where state='ready' and rights_expires_at is not null and rights_expires_at<now();
select 'invalid_media_duration|'||count(*) from public.gsa_tv_media_items where state='ready' and coalesce(duration_s,0)<=0;
select 'nonstandard_ready|'||coalesce(video_width::text,'')||'x'||coalesce(video_height::text,'')||'|'||coalesce(video_fps::text,'')||'fps|'||coalesce(audio_sample_rate::text,'')||'Hz|'||count(*) from public.gsa_tv_media_items where state='ready' group by video_width,video_height,video_fps,audio_sample_rate order by count(*) desc;
SQL
`,240000);process.stdout.write(r.stdout);if(r.stderr)process.stderr.write(r.stderr);
