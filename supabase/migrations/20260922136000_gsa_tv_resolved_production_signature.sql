BEGIN;
SET LOCAL lock_timeout='5s';
SET LOCAL statement_timeout='30s';

CREATE OR REPLACE FUNCTION public.gsa_tv_production_signature(p_version uuid)
RETURNS text
LANGUAGE sql
STABLE
SET search_path=public,pg_temp
AS $$
WITH version_info AS (
  SELECT id,channel_id,broadcast_date
    FROM public.gsa_tv_schedule_versions
   WHERE id=p_version
),
resolved AS (
  SELECT
    b.id,
    b.program_id,
    b.block_type,
    b.planned_start_offset_s,
    b.planned_duration_s,
    b.is_reprise,
    b.metadata,
    b.live_source_id,
    b.episode_id,
    b.campaign_id,
    coalesce(dm.id,em.id,pm.id,cm.id) resolved_media_id,
    coalesce(ep.id,pm.resolved_episode_id) resolved_episode_id,
    coalesce(dm.state,em.state,pm.state,cm.state) media_state,
    coalesce(dm.approval_state,em.approval_state,pm.approval_state,cm.approval_state) approval_state,
    coalesce(dm.rights_ok,em.rights_ok,pm.rights_ok,cm.rights_ok) rights_ok,
    coalesce(dm.rights_expires_at,em.rights_expires_at,pm.rights_expires_at,cm.rights_expires_at) rights_expires_at,
    coalesce(dm.drive_path,em.drive_path,pm.drive_path,cm.drive_path) drive_path,
    coalesce(dm.duration_s,em.duration_s,pm.duration_s,cm.duration_s) duration_s,
    coalesce(dm.updated_at,em.updated_at,pm.updated_at,cm.updated_at) media_updated_at
  FROM version_info v
  JOIN public.gsa_tv_program_blocks b ON b.schedule_version_id=v.id
  LEFT JOIN public.gsa_tv_media_items dm
    ON dm.id=b.media_item_id AND dm.channel_id=v.channel_id
  LEFT JOIN public.gsa_tv_episodes ep ON ep.id=b.episode_id
  LEFT JOIN public.gsa_tv_media_items em
    ON em.id=ep.media_item_id AND em.channel_id=v.channel_id
  LEFT JOIN LATERAL (
    SELECT m.*,e.id resolved_episode_id
      FROM public.gsa_tv_series se
      JOIN public.gsa_tv_episodes e ON e.series_id=se.id
      JOIN public.gsa_tv_media_items m ON m.id=e.media_item_id
     WHERE b.media_item_id IS NULL
       AND b.episode_id IS NULL
       AND b.program_id IS NOT NULL
       AND se.program_id=b.program_id
       AND m.channel_id=v.channel_id
     ORDER BY
       CASE WHEN b.is_reprise THEN e.last_run_at ELSE e.first_run_at END NULLS FIRST,
       e.season_number,
       e.episode_number,
       e.id
     LIMIT 1
  ) pm ON true
  LEFT JOIN LATERAL (
    SELECT m.*
      FROM public.gsa_tv_ad_assets aa
      JOIN public.gsa_tv_media_items m ON m.id=aa.media_item_id
      JOIN public.gsa_tv_ad_campaigns c ON c.id=aa.campaign_id
     WHERE b.campaign_id IS NOT NULL
       AND aa.campaign_id=b.campaign_id
       AND c.status='active'
       AND ((v.broadcast_date + make_interval(secs=>b.planned_start_offset_s))
            AT TIME ZONE 'America/Sao_Paulo')
           BETWEEN c.starts_at AND c.ends_at
       AND m.channel_id=v.channel_id
       AND m.state='ready'
       AND m.rights_ok
       AND m.approval_state='approved'
     ORDER BY aa.weight DESC,m.updated_at ASC,m.id
     LIMIT 1
  ) cm ON true
)
SELECT md5(coalesce(string_agg(
  jsonb_build_array(
    id,
    program_id,
    block_type,
    planned_start_offset_s,
    planned_duration_s,
    is_reprise,
    metadata,
    live_source_id,
    episode_id,
    campaign_id,
    resolved_media_id,
    resolved_episode_id,
    media_state,
    approval_state,
    rights_ok,
    rights_expires_at,
    drive_path,
    duration_s,
    media_updated_at
  )::text,
  '|'
  ORDER BY planned_start_offset_s,id
),''))
FROM resolved;
$$;

COMMENT ON FUNCTION public.gsa_tv_production_signature(uuid) IS
  'Assina a grade versionada e a mídia efetivamente resolvida (direta, episódio/série ou campanha), incluindo direitos, aprovação, duração e metadata.';

COMMIT;
