import { runSshScript } from './ssh2-run.mjs';
const script=String.raw`set -euo pipefail
file=/opt/gsa-tv/cache/media/1/editorial/gsa-hub-editorial-ep01.mp4
echo '=== ffprobe ==='
sudo docker run --rm -v /opt/gsa-tv/cache/media:/media gsa-tv/control-plane:1.6.7 ffprobe -v error -show_entries stream=index,codec_name,codec_type,width,height,r_frame_rate,sample_rate,channels -show_entries format=duration,bit_rate -of json /media/1/editorial/gsa-hub-editorial-ep01.mp4
duration=$(sudo docker run --rm -v /opt/gsa-tv/cache/media:/media gsa-tv/control-plane:1.6.7 ffprobe -v error -show_entries format=duration -of default=nw=1:nk=1 /media/1/editorial/gsa-hub-editorial-ep01.mp4)
duration_int=$(awk -v d="$duration" 'BEGIN{print int(d+0.5)}')
sha=$(sudo sha256sum "$file" | awk '{print $1}')
dburl=$(sudo docker inspect gsa-tv-control-plane --format '{{range .Config.Env}}{{println .}}{{end}}' | awk -F= '$1=="DATABASE_URL"{sub(/^DATABASE_URL=/,"");print;exit}')
echo '=== constraints ==='
sudo docker run --rm --network host postgres:15-alpine psql "$dburl" -X -At -c "select conname||'|'||pg_get_constraintdef(oid) from pg_constraint where conrelid='public.gsa_tv_media_items'::regclass and contype='c' order by conname;"
echo '=== dry-run ==='
sudo docker run --rm -i --network host postgres:15-alpine psql "$dburl" -X -v ON_ERROR_STOP=1 -v program_duration="$duration_int" -v program_sha="$sha" <<'SQL'
begin;
create temp table editorial_cfg(duration_s int,sha text) on commit drop;
insert into editorial_cfg values(:'program_duration'::int,:'program_sha');
insert into public.gsa_tv_media_items(id,channel_id,title,original_filename,duration_s,state,rights_ok,drive_path,media_kind,source_type,ai_generated,approval_state,metadata,updated_at)
select 'media-gsa-hub-editorial-ep01','ch-main','GSA HUB — Uma estrutura para resolver','gsa-hub-editorial-ep01.mp4',duration_s,'ready',true,'/media/1/editorial/gsa-hub-editorial-ep01.mp4','program','uploaded',false,'approved',jsonb_build_object('sha256',sha,'editorial_source','GSA HUB portal','production','GSA TV','owned_content',true,'episode','EP01'),now() from editorial_cfg;
insert into public.gsa_tv_rights_records(channel_id,media_item_id,status,license_type,territory,platforms,valid_from,justification,evidence,approved_at) values('ch-main','media-gsa-hub-editorial-ep01','approved','conteúdo institucional próprio','worldwide',array['youtube'],now(),'Conteúdo institucional próprio.','[]'::jsonb,now());
insert into public.gsa_tv_programs(channel_id,name,description,category,default_duration_s,status,notes) select 'ch-main','GSA HUB — Uma estrutura para resolver','Revista institucional da GSA TV baseada no portal GSA HUB.','institucional',duration_s,'published','EP01.' from editorial_cfg;
rollback;
SQL
echo "DRYRUN_PASS duration=$duration_int"
`;
const r=await runSshScript(script,120000);process.stdout.write(r.stdout);if(r.stderr)process.stderr.write(r.stderr);
