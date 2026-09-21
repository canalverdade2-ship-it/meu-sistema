import { runSshScript } from './ssh2-run.mjs';

const script = String.raw`set -euo pipefail
media_id='media-gsa-manha-news-2026-09-04-draft-qc-v1'
block_id='8595acfe-b8d4-4b11-bd94-bae1e4f097c6'
expected_source_sha='bfd8fdb210a8baed7fbe3b1efd4fed1bb5fcd4c9665bb0aa17cc50719f1b20ab'
expected_playout_sha='4824862b408f579b3feef381bd22b5c455428cfecbc534c2865f2feb303c1c1d'
host_file='/opt/gsa-tv/cache/media/1/normalized/media-gsa-manha-news-2026-09-04-draft-qc-v1-720p30.mp4'
source_file='/opt/gsa-tv/cache/media/1/production/editorial/2026-09-04/gsa-manha-news-2026-09-04-07-30-8595acfe/draft-master/gsa-manha-news-2026-09-04-draft-master.mp4'
dburl=$(sudo docker inspect gsa-tv-control-plane --format '{{range .Config.Env}}{{println .}}{{end}}' | awk -F= '$1=="DATABASE_URL"{sub(/^DATABASE_URL=/,"");print;exit}')
token=$(sudo docker inspect gsa-tv-control-plane --format '{{range .Config.Env}}{{println .}}{{end}}' | awk -F= '$1=="INTERNAL_API_TOKEN"{sub(/^INTERNAL_API_TOKEN=/,"");print;exit}')
test -n "$dburl" && test -n "$token"
sudo test -f "$host_file" && sudo test -f "$source_file"
actual_playout_sha=$(sudo sha256sum "$host_file" | awk '{print $1}')
actual_source_sha=$(sudo sha256sum "$source_file" | awk '{print $1}')
test "$actual_playout_sha" = "$expected_playout_sha"
test "$actual_source_sha" = "$expected_source_sha"

sql64=$(base64 -w0 <<'SQL'
BEGIN;
DO $$
DECLARE
  v_media public.gsa_tv_media_items%ROWTYPE;
  v_block record;
  v_coverage integer;
BEGIN
  SELECT * INTO v_media FROM public.gsa_tv_media_items
   WHERE id='media-gsa-manha-news-2026-09-04-draft-qc-v1' FOR UPDATE;
  IF NOT FOUND OR v_media.state<>'ready' OR v_media.approval_state<>'pending' OR NOT v_media.rights_ok THEN
    RAISE EXCEPTION 'Gate de mídia divergente: state=%, approval=%, rights=%',
      v_media.state,v_media.approval_state,v_media.rights_ok;
  END IF;

  SELECT b.id,b.media_item_id,b.planned_start_offset_s,b.planned_duration_s,
         p.name,v.broadcast_date,v.state AS schedule_state
    INTO v_block
    FROM public.gsa_tv_program_blocks b
    JOIN public.gsa_tv_schedule_versions v ON v.id=b.schedule_version_id
    JOIN public.gsa_tv_programs p ON p.id=b.program_id
   WHERE b.id='8595acfe-b8d4-4b11-bd94-bae1e4f097c6'::uuid FOR UPDATE OF b;
  IF NOT FOUND OR v_block.broadcast_date<>DATE '2026-09-04'
     OR v_block.schedule_state<>'published'
     OR v_block.planned_start_offset_s<>27000
     OR v_block.planned_duration_s<>1800
     OR v_block.name<>'GSA Manhã News'
     OR v_block.media_item_id IS NOT NULL THEN
    RAISE EXCEPTION 'Gate do bloco divergente: %',row_to_json(v_block);
  END IF;

  SELECT sum(planned_duration_s)::integer INTO v_coverage
    FROM public.gsa_tv_program_blocks b
    JOIN public.gsa_tv_schedule_versions v ON v.id=b.schedule_version_id
   WHERE v.channel_id='ch-main' AND v.broadcast_date='2026-09-04' AND v.state='published';
  IF v_coverage<>86400 THEN RAISE EXCEPTION 'Cobertura diária inválida: %',v_coverage; END IF;

  UPDATE public.gsa_tv_media_items
     SET approval_state='approved',
         metadata=coalesce(metadata,'{}'::jsonb)||jsonb_build_object(
           'editorial_approved_at',now(),
           'editorial_approved_by','Adriano Farias',
           'editorial_approval_source','explicit_user_authorization',
           'approved_source_sha256','bfd8fdb210a8baed7fbe3b1efd4fed1bb5fcd4c9665bb0aa17cc50719f1b20ab',
           'approved_playout_sha256','4824862b408f579b3feef381bd22b5c455428cfecbc534c2865f2feb303c1c1d'
         ),
         updated_at=now()
   WHERE id='media-gsa-manha-news-2026-09-04-draft-qc-v1';

  INSERT INTO public.gsa_tv_rights_records(
    channel_id,media_item_id,status,license_type,territory,platforms,valid_from,
    justification,evidence,approved_at
  )
  SELECT 'ch-main',v_media.id,'approved',
         'produção original GSA TV; fontes factuais reference_only',
         'worldwide',ARRAY['youtube'],now(),
         'Master original GSA TV aprovado pelo responsável humano. Agência Brasil, Câmara e Senado foram usados como fontes factuais; nenhuma imagem ou vídeo da Agência Brasil foi reutilizado.',
         jsonb_build_array(
           jsonb_build_object('type','fact_check','value','PASS'),
           jsonb_build_object('type','sha256','value','bfd8fdb210a8baed7fbe3b1efd4fed1bb5fcd4c9665bb0aa17cc50719f1b20ab'),
           jsonb_build_object('type','human_approval','value','Adriano Farias - autorização explícita')
         ),now()
   WHERE NOT EXISTS(
     SELECT 1 FROM public.gsa_tv_rights_records
      WHERE media_item_id=v_media.id AND status='approved'
   );

  UPDATE public.gsa_tv_program_blocks
     SET media_item_id=v_media.id,
         metadata=coalesce(metadata,'{}'::jsonb)||jsonb_build_object(
           'media_promoted_at',now(),
           'media_promoted_by','Adriano Farias',
           'media_source_sha256','bfd8fdb210a8baed7fbe3b1efd4fed1bb5fcd4c9665bb0aa17cc50719f1b20ab',
           'media_playout_sha256','4824862b408f579b3feef381bd22b5c455428cfecbc534c2865f2feb303c1c1d',
           'human_approval',true
         ),
         updated_at=now()
   WHERE id=v_block.id;

  INSERT INTO public.gsa_tv_audit_log(channel_id,actor,action,resource_type,resource_id,details)
  VALUES(
    'ch-main','Adriano Farias','media_approved_and_scheduled','program_block',v_block.id::text,
    jsonb_build_object(
      'broadcast_date','2026-09-04','start_time','07:30:00',
      'media_item_id',v_media.id,
      'source_sha256','bfd8fdb210a8baed7fbe3b1efd4fed1bb5fcd4c9665bb0aa17cc50719f1b20ab',
      'playout_sha256','4824862b408f579b3feef381bd22b5c455428cfecbc534c2865f2feb303c1c1d',
      'authorization','Aprovado, pode colocar o GSA Manhã News no ar.'
    )
  );
END $$;
COMMIT;
SQL
)
printf '%s' "$sql64" | base64 -d | sudo docker run --rm -i --network host postgres:15-alpine psql "$dburl" -X -v ON_ERROR_STOP=1

queue_job(){
  curl -fsS -X POST -H "Authorization: Bearer $token" -H 'Content-Type: application/json' +    -d "$2" "http://127.0.0.1:9202$1"
}
validation=$(queue_job /automation/jobs '{"job_type":"validate_schedule","payload":{"source":"gsa-manha-news-human-approval","broadcast_date":"2026-09-04"}}')
compile=$(queue_job /automation/jobs '{"job_type":"compile_playlist","payload":{"source":"gsa-manha-news-human-approval","broadcast_date":"2026-09-04"}}')
validation_id=$(printf '%s' "$validation" | python3 -c 'import json,sys; print(json.load(sys.stdin)["job_id"])')
compile_id=$(printf '%s' "$compile" | python3 -c 'import json,sys; print(json.load(sys.stdin)["job_id"])')

for i in $(seq 1 30); do
  states=$(sudo docker run --rm --network host postgres:15-alpine psql "$dburl" -X -At -F '|' -c "select id,status,coalesce(error_message,'') from public.gsa_tv_jobs where id in ('$validation_id','$compile_id') order by id")
  if printf '%s' "$states" | grep -q '|failed|'; then printf '%s\n' "$states"; exit 1; fi
  completed=$(printf '%s' "$states" | grep -c '|completed|' || true)
  [ "$completed" -eq 2 ] && break
  sleep 2
done
printf '%s\n' "$states"
test "$(printf '%s' "$states" | grep -c '|completed|' || true)" -eq 2

playlist='/opt/gsa-tv/playlists/2026-09-04.json'
test -f "$playlist"
python3 - "$playlist" "$host_file" <<'PY'
import json,sys
playlist_path,expected_source=sys.argv[1:]
data=json.load(open(playlist_path,encoding='utf-8'))
timeline=0.0
hit=None
after=None
for item in data['program']:
    duration=float(item['duration'])
    if abs(timeline-27000)<0.6:
        hit=(timeline,item)
    if hit and timeline>=27000+float(hit[1]['duration'])-0.1 and after is None and item is not hit[1]:
        after=(timeline,item)
        break
    timeline+=duration
assert hit, 'entrada das 07:30 ausente'
assert hit[1]['source']==expected_source, (hit[1]['source'],expected_source)
assert 273 <= float(hit[1]['duration']) <= 275, hit[1]['duration']
assert after and after[1].get('title')=='Continuidade GSA TV', after
assert abs(after[0]-(27000+float(hit[1]['duration'])))<0.6, after[0]
print('playlist_proof|start=27000|title=%s|duration=%s|source=%s' % (hit[1].get('title'),hit[1]['duration'],hit[1]['source']))
print('continuity_proof|start=%s|title=%s|duration=%s' % (after[0],after[1].get('title'),after[1]['duration']))
PY

sudo docker run --rm --network host postgres:15-alpine psql "$dburl" -X -At -F '|' <<'SQL'
select 'media',id,state,approval_state,rights_ok,duration_s from public.gsa_tv_media_items
 where id='media-gsa-manha-news-2026-09-04-draft-qc-v1';
select 'block',b.id,v.broadcast_date,b.planned_start_offset_s,b.planned_duration_s,p.name,b.media_item_id
 from public.gsa_tv_program_blocks b join public.gsa_tv_schedule_versions v on v.id=b.schedule_version_id
 join public.gsa_tv_programs p on p.id=b.program_id
 where b.id='8595acfe-b8d4-4b11-bd94-bae1e4f097c6';
select 'rights',status,license_type,approved_at from public.gsa_tv_rights_records
 where media_item_id='media-gsa-manha-news-2026-09-04-draft-qc-v1' order by approved_at desc limit 1;
select 'channel',status,desired_state,playout_state,signal_state,coalesce(last_error,'') from public.gsa_tv_channels where id='ch-main';
SQL
`;

const result = await runSshScript(script, 180000);
process.stdout.write(result.stdout);
if (result.stderr) process.stderr.write(result.stderr);
