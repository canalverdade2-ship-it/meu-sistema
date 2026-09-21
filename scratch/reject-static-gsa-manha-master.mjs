import { runSshScript } from './ssh2-run.mjs';

const script = String.raw`set -euo pipefail
media_id='media-gsa-manha-news-2026-09-04-draft-qc-v1'
block_id='8595acfe-b8d4-4b11-bd94-bae1e4f097c6'
dburl=$(sudo docker inspect gsa-tv-control-plane --format '{{range .Config.Env}}{{println .}}{{end}}' | awk -F= '$1=="DATABASE_URL"{sub(/^DATABASE_URL=/,"");print;exit}')

sudo docker run --rm --network host postgres:15-alpine psql "$dburl" -X -v ON_ERROR_STOP=1 <<SQL
begin;
update public.gsa_tv_media_items
set approval_state='rejected',
    metadata=coalesce(metadata,'{}'::jsonb)||jsonb_build_object(
      'editorial_rejection_reason','Apresentadores Holt e Nyla estáticos; faltam vídeos falados/lip-sync produzidos no Google Vids.',
      'editorial_rejected_at',now(),
      'editorial_rejected_by','Adriano Farias')
where id='$media_id';
update public.gsa_tv_program_blocks
set media_item_id=null,
    metadata=coalesce(metadata,'{}'::jsonb)||jsonb_build_object(
      'media_rejected_at',now(),
      'media_rejection_reason','Master estático rejeitado; aguardando versão Google Vids com apresentadores falantes.')
where id='$block_id' and media_item_id='$media_id';
commit;
SQL

sleep 10
sudo docker run --rm --network host postgres:15-alpine psql "$dburl" -X -At -F '|' -c "
select 'channel',status,desired_state,playout_state,signal_state,coalesce(last_error,'') from public.gsa_tv_channels where id='ch-main';
select 'media',id,state,approval_state,rights_ok from public.gsa_tv_media_items where id='$media_id';
select 'tomorrow',v.broadcast_date,b.planned_start_offset_s,b.planned_duration_s,coalesce(b.media_item_id,'RESERVADO_SEM_MASTER')
from public.gsa_tv_program_blocks b join public.gsa_tv_schedule_versions v on v.id=b.schedule_version_id where b.id='$block_id';"

root=/opt/gsa-tv/cache/media/1/production/editorial/2026-09-04/gsa-manha-news-2026-09-04-07-30-8595acfe
echo 'package_files_begin'
sudo find "$root" -maxdepth 4 -type f -printf '%P|%s bytes\n' | sort
echo 'package_files_end'
`;

const result = await runSshScript(script, 90000);
process.stdout.write(result.stdout);
if (result.stderr) process.stderr.write(result.stderr);
