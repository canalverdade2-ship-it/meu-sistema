import { runSshScript } from './ssh2-run.mjs';

const script = String.raw`set -euo pipefail
media_id='media-gsa-manha-news-2026-09-04-draft-qc-v1'
block_id='8595acfe-b8d4-4b11-bd94-bae1e4f097c6'
normalized='/opt/gsa-tv/cache/media/1/normalized/media-gsa-manha-news-2026-09-04-draft-qc-v1-720p30.mp4'
draft_dir='/opt/gsa-tv/cache/media/1/production/editorial/2026-09-04/gsa-manha-news-2026-09-04-07-30-8595acfe/draft-master'
dburl=$(sudo docker inspect gsa-tv-control-plane --format '{{range .Config.Env}}{{println .}}{{end}}' | awk -F= '$1=="DATABASE_URL"{sub(/^DATABASE_URL=/,"");print;exit}')

resolved_normalized=$(sudo readlink -f "$normalized")
resolved_draft_dir=$(sudo readlink -f "$draft_dir")
echo "resolved_normalized|$resolved_normalized"
echo "resolved_draft_dir|$resolved_draft_dir"
case "$resolved_normalized" in /opt/gsa-tv/cache/media/1/normalized/*) ;; *) exit 10 ;; esac
case "$resolved_draft_dir" in /opt/gsa-tv/cache/media/1/production/editorial/2026-09-04/gsa-manha-news-2026-09-04-07-30-8595acfe/draft-master) ;; *) exit 11 ;; esac

sudo docker run --rm --network host postgres:15-alpine psql "$dburl" -X -v ON_ERROR_STOP=1 -c "begin;
update public.gsa_tv_program_blocks set media_item_id=null, metadata=coalesce(metadata,'{}'::jsonb)||jsonb_build_object('replacement_requirements',jsonb_build_array('Holt e Nyla em videos falados com lip-sync produzido no Google Vids','sem mosca embutida; usar somente a mosca fixa do playout GSA TV','abertura oficial validada'), 'rejected_media_id','$media_id', 'rejected_at',now()) where id='$block_id';
delete from public.gsa_tv_rights_records where media_item_id='$media_id';
delete from public.gsa_tv_media_items where id='$media_id';
commit;"

sudo rm -f -- "$normalized"
sudo rm -rf -- "$draft_dir"

sudo docker run --rm --network host postgres:15-alpine psql "$dburl" -X -At -F '|' -c "
select 'media_remaining',count(*) from public.gsa_tv_media_items where id='$media_id';
select 'tomorrow',v.broadcast_date,b.planned_start_offset_s,b.planned_duration_s,coalesce(b.media_item_id,'RESERVADO_SEM_MASTER'),b.metadata->'replacement_requirements' from public.gsa_tv_program_blocks b join public.gsa_tv_schedule_versions v on v.id=b.schedule_version_id where b.id='$block_id';
select 'channel',status,desired_state,playout_state,signal_state,coalesce(last_error,'') from public.gsa_tv_channels where id='ch-main';"
test ! -e "$normalized"
test ! -e "$draft_dir"
echo 'files_removed|true'
`;

const result = await runSshScript(script, 90000);
process.stdout.write(result.stdout);
if (result.stderr) process.stderr.write(result.stderr);
