import { runSshScript } from './ssh2-run.mjs';
const script=String.raw`set -euo pipefail
file=/opt/gsa-tv/cache/media/1/editorial/gsa-hub-editorial-ep01.mp4
duration=$(sudo docker run --rm -v /opt/gsa-tv/cache/media:/media gsa-tv/control-plane:1.6.7 ffprobe -v error -show_entries format=duration -of default=nw=1:nk=1 /media/1/editorial/gsa-hub-editorial-ep01.mp4)
duration_int=$(awk -v d="$duration" 'BEGIN{print int(d+0.5)}')
sha=$(sudo sha256sum "$file" | awk '{print $1}')
dburl=$(sudo docker inspect gsa-tv-control-plane --format '{{range .Config.Env}}{{println .}}{{end}}' | awk -F= '$1=="DATABASE_URL"{sub(/^DATABASE_URL=/,"");print;exit}')
sudo docker run --rm -i --network host postgres:15-alpine psql "$dburl" -X -v ON_ERROR_STOP=1 -v program_duration="$duration_int" -v program_sha="$sha" <<'SQL'
begin;
create temp table editorial_cfg(duration_s int,sha text) on commit drop;
insert into editorial_cfg values(:'program_duration'::int,:'program_sha');
insert into public.gsa_tv_media_items(id,channel_id,title,original_filename,duration_s,state,rights_ok,drive_path,media_kind,source_type,ai_generated,approval_state,metadata,updated_at)
select 'media-gsa-hub-editorial-ep01','ch-main','GSA HUB — Uma estrutura para resolver','gsa-hub-editorial-ep01.mp4',duration_s,'ready',true,'/media/1/editorial/gsa-hub-editorial-ep01.mp4','program','uploaded',false,'approved',jsonb_build_object('sha256',sha,'editorial_source','GSA HUB portal','production','GSA TV','owned_content',true,'episode','EP01'),now() from editorial_cfg
on conflict(id) do update set title=excluded.title,original_filename=excluded.original_filename,duration_s=excluded.duration_s,state='ready',rights_ok=true,drive_path=excluded.drive_path,media_kind='program',source_type='uploaded',approval_state='approved',metadata=excluded.metadata,updated_at=now();
insert into public.gsa_tv_rights_records(channel_id,media_item_id,status,license_type,territory,platforms,valid_from,justification,evidence,approved_at)
select 'ch-main','media-gsa-hub-editorial-ep01','approved','conteúdo institucional próprio','worldwide',array['youtube'],now(),'Conteúdo produzido pela GSA TV a partir de textos institucionais do portal GSA HUB, com identidade visual e locução próprias.','[{"type":"editorial_source","value":"Portal GSA HUB"},{"type":"ownership","value":"Produção institucional própria GSA TV"}]'::jsonb,now()
where not exists(select 1 from public.gsa_tv_rights_records where media_item_id='media-gsa-hub-editorial-ep01' and status='approved');
insert into public.gsa_tv_programs(channel_id,name,description,category,default_duration_s,status,notes)
select 'ch-main','GSA HUB — Uma estrutura para resolver','Revista institucional da GSA TV baseada no conteúdo oficial do portal GSA HUB.','institucional',duration_s,'published','EP01. Conteúdo próprio, aprovado para YouTube e distribuição mundial.' from editorial_cfg
where not exists(select 1 from public.gsa_tv_programs where channel_id='ch-main' and name='GSA HUB — Uma estrutura para resolver');
update public.gsa_tv_programs set default_duration_s=(select duration_s from editorial_cfg),status='published',updated_at=now() where channel_id='ch-main' and name='GSA HUB — Uma estrutura para resolver';
do $$
declare d date; v_id uuid; p_id uuid; pos int; offset_s int; dur int; piece int;
begin
 select duration_s into dur from editorial_cfg;
 select id into p_id from public.gsa_tv_programs where channel_id='ch-main' and name='GSA HUB — Uma estrutura para resolver' limit 1;
 for d in select generate_series((now() at time zone 'America/Sao_Paulo')::date,(now() at time zone 'America/Sao_Paulo')::date+1,'1 day')::date loop
  update public.gsa_tv_schedule_versions set state='cancelled',updated_at=now() where channel_id='ch-main' and broadcast_date=d and state='published';
  insert into public.gsa_tv_schedule_versions(channel_id,broadcast_date,version,state,title,notes,approved_at,published_at)
  values('ch-main',d,(select coalesce(max(version),0)+1 from public.gsa_tv_schedule_versions where channel_id='ch-main' and broadcast_date=d),'published','GSA HUB — Grade editorial institucional 24h','EP01 institucional em rotação contínua, com fallback técnico automático.',now(),now()) returning id into v_id;
  pos:=0; offset_s:=0;
  while offset_s < 86400 loop
   piece:=least(dur,86400-offset_s);
   insert into public.gsa_tv_program_blocks(schedule_version_id,program_id,media_item_id,block_type,position,planned_start_offset_s,planned_duration_s,cannot_interrupt,notes,metadata)
   values(v_id,p_id,'media-gsa-hub-editorial-ep01','content',pos,offset_s,piece,false,'Exibição editorial GSA HUB','{"source":"portal_gsa_hub","rights":"owned","episode":"EP01"}'::jsonb);
   pos:=pos+1; offset_s:=offset_s+piece;
  end loop;
  insert into public.gsa_tv_comments(channel_id,resource_type,resource_id,comment_type,priority,body,author_name)
  values('ch-main','schedule_version',v_id::text,'fixed_note','important','Grade editorial inaugural baseada no portal GSA HUB. Manter fallback e mosca oficial ativos.','Produção GSA TV');
 end loop;
end $$;
commit;
SQL
token=$(sudo docker inspect gsa-tv-control-plane --format '{{range .Config.Env}}{{println .}}{{end}}' | awk -F= '$1=="INTERNAL_API_TOKEN"{sub(/^INTERNAL_API_TOKEN=/,"");print;exit}')
queue(){ curl -fsS -X POST -H "Authorization: Bearer $token" -H 'Content-Type: application/json' -d "$2" "http://127.0.0.1:9202$1"; echo; }
echo '=== enqueue validation ==='
queue /automation/jobs '{"job_type":"validate_schedule","payload":{"source":"editorial-ep01"}}'
echo '=== enqueue compile ==='
queue /automation/jobs '{"job_type":"compile_playlist","payload":{"source":"editorial-ep01"}}'
sleep 8
echo '=== validation/compile status ==='
sudo docker run --rm --network host postgres:15-alpine psql "$dburl" -X -At -F '|' -c "select job_type,status,progress,coalesce(error_message,'') from public.gsa_tv_jobs where job_type in ('validate_schedule','compile_playlist') order by created_at desc limit 4;"
echo '=== enqueue playout reload ==='
reload_id=$(sudo docker run --rm --network host postgres:15-alpine psql "$dburl" -X -qAt -c "insert into public.gsa_tv_jobs(channel_id,job_type,status,progress,payload) values('ch-main','playout_reload','pending',0,'{\"source\":\"editorial-ep01\"}'::jsonb) returning id;")
echo "$reload_id"
for i in 1 2 3 4 5 6 7 8 9 10; do state=$(sudo docker run --rm --network host postgres:15-alpine psql "$dburl" -X -qAt -c "select status from public.gsa_tv_jobs where id='$reload_id'"); [ "$state" = completed ] && break; [ "$state" = failed ] && break; sleep 3; done
echo '=== final state ==='
sudo docker run --rm --network host postgres:15-alpine psql "$dburl" -X -At -F '|' -c "select 'reload',job_type,status,progress,coalesce(error_message,'') from public.gsa_tv_jobs where id='$reload_id'; select 'channel',status,desired_state,playout_state,signal_state,coalesce(last_error,'') from public.gsa_tv_channels where id='ch-main'; select 'media',id,title,duration_s,state,rights_ok,approval_state from public.gsa_tv_media_items where id='media-gsa-hub-editorial-ep01'; select 'schedule',broadcast_date,version,state,title from public.gsa_tv_schedule_versions where channel_id='ch-main' and state='published' order by broadcast_date;"
echo "EDITORIAL_PUBLISH_PASS duration=$duration_int"
`;
const r=await runSshScript(script,180000);process.stdout.write(r.stdout);if(r.stderr)process.stderr.write(r.stderr);
