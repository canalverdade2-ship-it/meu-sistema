import fs from 'node:fs';
import { runSshScript } from './ssh2-run.mjs';

const archive = fs.readFileSync(new URL('./gsa-tv-editorial.tar.gz', import.meta.url)).toString('base64');
const remote = String.raw`set -euo pipefail
work=/tmp/gsa-tv-editorial
sudo rm -rf "$work"
mkdir -p "$work"
printf '%s' '${archive}' | base64 -d > "$work/package.tar.gz"
tar -xzf "$work/package.tar.gz" -C "$work"
mkdir -p "$work/rendered"
for n in 01 02 03 04 05 06 07 08 09; do
  duration=$(sudo docker run --rm -v "$work:/work" gsa-tv/control-plane:1.6.7 ffprobe -v error -show_entries format=duration -of default=nw=1:nk=1 "/work/voice-$n.wav")
  total=$(awk -v d="$duration" 'BEGIN{printf "%.3f",d+2.0}')
  sudo docker run --rm --user 0 -v "$work:/work" gsa-tv/control-plane:1.6.7 ffmpeg -hide_banner -loglevel error -y \
    -loop 1 -i "/work/slide-$n.png" -i "/work/voice-$n.wav" -t "$total" \
    -vf "fps=30,format=yuv420p" -af "apad=pad_dur=2" \
    -c:v libx264 -preset veryfast -profile:v high -level 4.0 -g 60 -keyint_min 60 -sc_threshold 0 \
    -b:v 2500k -minrate 2500k -maxrate 2500k -bufsize 5000k -x264-params 'nal-hrd=cbr:force-cfr=1:filler=1' \
    -c:a aac -b:a 128k -ar 48000 -ac 2 -movflags +faststart "/work/rendered/segment-$n.mp4"
done
for n in 01 02 03 04 05 06 07 08 09; do echo "file '/work/rendered/segment-$n.mp4'"; done > "$work/concat.txt"
sudo docker run --rm --user 0 -v "$work:/work" gsa-tv/control-plane:1.6.7 ffmpeg -hide_banner -loglevel error -y -f concat -safe 0 -i /work/concat.txt -c copy -movflags +faststart /work/gsa-hub-editorial-ep01.mp4
sudo install -d -m 0775 -o 989 -g 986 /opt/gsa-tv/cache/media/1/editorial
sudo install -m 0664 -o 989 -g 986 "$work/gsa-hub-editorial-ep01.mp4" /opt/gsa-tv/cache/media/1/editorial/gsa-hub-editorial-ep01.mp4
duration=$(sudo docker run --rm -v /opt/gsa-tv/cache/media:/media gsa-tv/control-plane:1.6.7 ffprobe -v error -show_entries format=duration -of default=nw=1:nk=1 /media/1/editorial/gsa-hub-editorial-ep01.mp4)
duration_int=$(awk -v d="$duration" 'BEGIN{print int(d+0.5)}')
sha=$(sudo sha256sum /opt/gsa-tv/cache/media/1/editorial/gsa-hub-editorial-ep01.mp4 | awk '{print $1}')
dburl=$(sudo docker inspect gsa-tv-control-plane --format '{{range .Config.Env}}{{println .}}{{end}}' | awk -F= '$1=="DATABASE_URL"{sub(/^DATABASE_URL=/,"");print}')
sudo docker run --rm -i --network host postgres:15-alpine psql "$dburl" -X -v ON_ERROR_STOP=1 -v program_duration="$duration_int" -v program_sha="$sha" <<'SQL'
begin;
create temp table editorial_cfg(duration_s int,sha text) on commit drop;
insert into editorial_cfg values(:'program_duration'::int,:'program_sha');
insert into public.gsa_tv_media_items(id,channel_id,title,original_filename,duration_s,state,rights_ok,drive_path,media_kind,source_type,ai_generated,approval_state,metadata,updated_at)
select 'media-gsa-hub-editorial-ep01','ch-main','GSA HUB — Uma estrutura para resolver','gsa-hub-editorial-ep01.mp4',duration_s,'ready',true,'/media/1/editorial/gsa-hub-editorial-ep01.mp4','program','uploaded',false,'approved',jsonb_build_object('sha256',sha,'editorial_source','GSA HUB portal','production','GSA TV','owned_content',true,'episode','EP01'),now() from editorial_cfg
on conflict(id) do update set title=excluded.title,original_filename=excluded.original_filename,duration_s=excluded.duration_s,state='ready',rights_ok=true,drive_path=excluded.drive_path,media_kind='program',approval_state='approved',metadata=excluded.metadata,updated_at=now();

insert into public.gsa_tv_rights_records(channel_id,media_item_id,status,license_type,territory,platforms,valid_from,justification,evidence,approved_at)
select 'ch-main','media-gsa-hub-editorial-ep01','approved','conteúdo institucional próprio','worldwide',array['youtube'],now(),'Conteúdo produzido pela GSA TV exclusivamente a partir dos textos institucionais do portal GSA HUB, com identidade visual própria e sem mídia externa de terceiros.','[{"type":"editorial_source","value":"Portal GSA HUB"},{"type":"ownership","value":"Produção institucional própria GSA TV"}]'::jsonb,now()
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
    values('ch-main',d,(select coalesce(max(version),0)+1 from public.gsa_tv_schedule_versions where channel_id='ch-main' and broadcast_date=d),'published','GSA HUB — Grade editorial institucional 24h','Programação editorial baseada no portal GSA HUB, com repetição contínua do EP01 e fallback técnico automático.',now(),now()) returning id into v_id;
    pos:=0; offset_s:=0;
    while offset_s < 86400 loop
      piece:=least(dur,86400-offset_s);
      insert into public.gsa_tv_program_blocks(schedule_version_id,program_id,media_item_id,block_type,position,planned_start_offset_s,planned_duration_s,cannot_interrupt,notes,metadata)
      values(v_id,p_id,'media-gsa-hub-editorial-ep01','content',pos,offset_s,piece,false,'Exibição editorial GSA HUB','{"source":"portal_gsa_hub","rights":"owned","episode":"EP01"}'::jsonb);
      pos:=pos+1; offset_s:=offset_s+piece;
    end loop;
    insert into public.gsa_tv_comments(channel_id,resource_type,resource_id,comment_type,priority,body,author_name)
    values('ch-main','schedule_version',v_id::text,'fixed_note','important','Grade editorial inaugural produzida com textos oficiais do GSA HUB. Manter continuidade de emergência e mosca oficial ativas.','Produção GSA TV');
  end loop;
end $$;
commit;
select id,title,duration_s,state,rights_ok,drive_path from public.gsa_tv_media_items where id='media-gsa-hub-editorial-ep01';
select v.broadcast_date,v.version,v.state,v.title,count(b.id) blocks,sum(b.planned_duration_s) duration_s from public.gsa_tv_schedule_versions v join public.gsa_tv_program_blocks b on b.schedule_version_id=v.id where v.channel_id='ch-main' and v.state='published' group by v.id order by v.broadcast_date;
SQL
token=$(sudo docker inspect gsa-tv-control-plane --format '{{range .Config.Env}}{{println .}}{{end}}' | awk -F= '$1=="INTERNAL_API_TOKEN"{sub(/^INTERNAL_API_TOKEN=/,"");print;exit}')
curl -fsS -X POST -H "Authorization: Bearer $token" -H 'Content-Type: application/json' -d '{"job_type":"validate_schedule","payload":{"source":"editorial-ep01"}}' http://127.0.0.1:9202/automation/jobs
echo
curl -fsS -X POST -H "Authorization: Bearer $token" -H 'Content-Type: application/json' -d '{"job_type":"compile_playlist","payload":{"source":"editorial-ep01"}}' http://127.0.0.1:9202/automation/jobs
echo
echo "PROGRAM_DURATION=$duration_int SHA256=$sha"
`;

const result = await runSshScript(remote, 300000);
process.stdout.write(result.stdout);
if (result.stderr) process.stderr.write(result.stderr);
