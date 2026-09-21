import { runSshScript } from './ssh2-run.mjs';

const script = String.raw`set -euo pipefail
dburl=$(sudo docker inspect gsa-tv-control-plane --format '{{range .Config.Env}}{{println .}}{{end}}' | awk -F= '$1=="DATABASE_URL"{sub(/^DATABASE_URL=/,"");print;exit}')
sudo docker run --rm --network host postgres:15-alpine psql "$dburl" -X -At -F '|' -c "
select 'graphics',id,layer_type,name,enabled,left(coalesce(text_content,''),160),config from public.gsa_tv_graphics where channel_id='ch-main' order by layer_type,created_at;
select 'items',count(*),count(*) filter(where validation_state='verified'),max(fetched_at) from public.gsa_tv_editorial_items;
select 'headline',s.name,i.validation_state,coalesce(i.published_at,i.fetched_at),regexp_replace(i.title,E'[\\n\\r|]+',' ','g') from public.gsa_tv_editorial_items i join public.gsa_tv_editorial_sources s on s.id=i.source_id where i.validation_state in ('verified','pending') order by coalesce(i.published_at,i.fetched_at) desc limit 20;
select 'source',id,name,enabled,last_status,last_collected_at,coalesce(last_error,'') from public.gsa_tv_editorial_sources where enabled order by official_source desc,id;"
`;
const result = await runSshScript(script, 90000);
process.stdout.write(result.stdout);
if (result.stderr) process.stderr.write(result.stderr);
