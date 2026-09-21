import fs from 'node:fs';
import { runSshScript } from './ssh2-run.mjs';

const continuity = fs.readFileSync(new URL('./gsa-tv-continuity.png', import.meta.url)).toString('base64');
const logo = fs.readFileSync(new URL('./gsa-tv-logo-transparent.png', import.meta.url)).toString('base64');
const remote = String.raw`set -euo pipefail
work=/tmp/gsa-tv-official-identity
rm -rf "$work" && mkdir -p "$work"
printf '%s' '${continuity}' | base64 -d > "$work/gsa-tv-continuity.png"
printf '%s' '${logo}' | base64 -d > "$work/gsa-tv-logo-transparent.png"
sudo install -m 0664 -o 989 -g 986 "$work/gsa-tv-continuity.png" /opt/gsa-tv/cache/media/1/identity/gsa-tv-continuity.png
sudo install -m 0664 -o 989 -g 986 "$work/gsa-tv-logo-transparent.png" /opt/gsa-tv/cache/media/1/identity/gsa-tv-logo-transparent.png
sudo docker run --rm -v /opt/gsa-tv/cache/media:/media gsa-tv/control-plane:1.6.7 ffmpeg -hide_banner -loglevel error -y -loop 1 -i /media/1/identity/gsa-tv-continuity.png -f lavfi -i anullsrc=channel_layout=stereo:sample_rate=48000 -t 10 -vf fps=30,format=yuv420p -c:v libx264 -preset veryfast -profile:v high -level 4.0 -g 60 -keyint_min 60 -sc_threshold 0 -b:v 2500k -maxrate 2500k -bufsize 5000k -c:a aac -b:a 128k -ar 48000 -ac 2 -movflags +faststart /media/1/identity/gsa-tv-continuity-720p30.tmp.mp4
sudo docker run --rm -v /opt/gsa-tv/cache/media:/media gsa-tv/control-plane:1.6.7 ffmpeg -hide_banner -loglevel error -y -stream_loop 59 -i /media/1/identity/gsa-tv-continuity-720p30.tmp.mp4 -t 600 -c copy -movflags +faststart /media/1/filler/gsa-tv-filler-600.tmp.mp4
sudo mv -f /opt/gsa-tv/cache/media/1/identity/gsa-tv-continuity-720p30.tmp.mp4 /opt/gsa-tv/cache/media/1/identity/gsa-tv-continuity-720p30.mp4
sudo mv -f /opt/gsa-tv/cache/media/1/filler/gsa-tv-filler-600.tmp.mp4 /opt/gsa-tv/cache/media/1/filler/gsa-tv-filler-600.mp4
sudo cp -f /opt/gsa-tv/cache/media/1/identity/gsa-tv-continuity-720p30.mp4 /opt/gsa-tv/fallback/gsa-tv-fallback-720p30.new.mp4
sudo mv -f /opt/gsa-tv/fallback/gsa-tv-fallback-720p30.new.mp4 /opt/gsa-tv/fallback/gsa-tv-fallback-720p30.mp4
sudo chown 989:986 /opt/gsa-tv/cache/media/1/identity/gsa-tv-continuity-720p30.mp4 /opt/gsa-tv/cache/media/1/filler/gsa-tv-filler-600.mp4
sudo chown 986:989 /opt/gsa-tv/fallback/gsa-tv-fallback-720p30.mp4
sudo chmod 0664 /opt/gsa-tv/cache/media/1/identity/gsa-tv-continuity-720p30.mp4 /opt/gsa-tv/cache/media/1/filler/gsa-tv-filler-600.mp4
sudo chmod 0640 /opt/gsa-tv/fallback/gsa-tv-fallback-720p30.mp4
dburl=$(sudo docker inspect gsa-tv-control-plane --format '{{range .Config.Env}}{{println .}}{{end}}' | awk -F= '$1=="DATABASE_URL"{sub(/^DATABASE_URL=/,"");print}')
sudo docker run --rm -i --network host postgres:15-alpine psql "$dburl" -X -v ON_ERROR_STOP=1 <<'SQL'
begin;
insert into public.gsa_tv_media_items(id,channel_id,title,original_filename,duration_s,state,rights_ok,drive_path,media_kind,source_type,approval_state,metadata)
values
('media-gsa-tv-official-continuity','ch-main','GSA TV — Continuidade oficial','gsa-tv-continuity-720p30.mp4',10,'ready',true,'/media/1/identity/gsa-tv-continuity-720p30.mp4','identity','uploaded','approved','{"fallback_official":true,"identity_role":"continuity"}'::jsonb),
('media-gsa-tv-official-logo','ch-main','GSA TV — Logo oficial','gsa-tv-logo-transparent.png',86400,'ready',true,'/media/1/identity/gsa-tv-logo-transparent.png','identity','uploaded','approved','{"identity_role":"logo","transparent":true}'::jsonb)
on conflict(id) do update set title=excluded.title,original_filename=excluded.original_filename,duration_s=excluded.duration_s,state='ready',rights_ok=true,drive_path=excluded.drive_path,media_kind='identity',approval_state='approved',metadata=excluded.metadata,updated_at=now();
update public.gsa_tv_media_items set metadata=metadata-'fallback_official' where channel_id='ch-main' and id<>'media-gsa-tv-official-continuity';
update public.gsa_tv_graphics set enabled=false where channel_id='ch-main' and layer_type='logo' and name<>'Mosca oficial GSA TV';
insert into public.gsa_tv_graphics(channel_id,layer_type,name,enabled,media_item_id,config)
select 'ch-main','logo','Mosca oficial GSA TV',true,'media-gsa-tv-official-logo','{"opacity":0.92,"position":"top-right","safe_margin":24}'::jsonb
where not exists(select 1 from public.gsa_tv_graphics where channel_id='ch-main' and name='Mosca oficial GSA TV');
update public.gsa_tv_graphics set enabled=true,media_item_id='media-gsa-tv-official-logo',config='{"opacity":0.92,"position":"top-right","safe_margin":24}'::jsonb,updated_at=now() where channel_id='ch-main' and name='Mosca oficial GSA TV';
commit;
select id,title,drive_path,approval_state,metadata from public.gsa_tv_media_items where id like 'media-gsa-tv-official-%' order by id;
select layer_type,name,enabled,media_item_id from public.gsa_tv_graphics where channel_id='ch-main' order by created_at;
SQL
sudo docker compose --project-directory /opt/gsa-tv/control-plane -f /opt/gsa-tv/control-plane/compose.yml restart control-plane >/dev/null
for i in $(seq 1 30); do curl -fsS http://127.0.0.1:9202/health >/dev/null 2>&1 && break; sleep 2; done
curl -fsS http://127.0.0.1:9202/health
echo
`;

const result = await runSshScript(remote, 180000);
process.stdout.write(result.stdout);
if (result.stderr) process.stderr.write(result.stderr);
