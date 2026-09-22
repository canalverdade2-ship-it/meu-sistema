BEGIN;
SET LOCAL lock_timeout='5s';
SET LOCAL statement_timeout='30s';

CREATE OR REPLACE FUNCTION public.gsa_tv_autopilot_assign_continuity_fallback(
  p_block_id uuid,
  p_expected_media_id text,
  p_fallback_media_id text,
  p_broadcast_date date
)
RETURNS jsonb
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path=public,pg_temp
AS $$
DECLARE
  v_today date := (now() AT TIME ZONE 'America/Sao_Paulo')::date;
  v_block public.gsa_tv_program_blocks%ROWTYPE;
  v_version public.gsa_tv_schedule_versions%ROWTYPE;
  v_fallback public.gsa_tv_media_items%ROWTYPE;
  v_block_end timestamptz;
  v_expected text := NULLIF(p_expected_media_id,'');
BEGIN
  IF p_block_id IS NULL OR NULLIF(p_fallback_media_id,'') IS NULL THEN
    RAISE EXCEPTION 'GSA TV Autopilot: parâmetros de fallback ausentes';
  END IF;

  IF p_broadcast_date <> v_today + 1 THEN
    RAISE EXCEPTION 'GSA TV Autopilot: fallback editorial automático permitido somente para D+1';
  END IF;

  SELECT *
    INTO v_block
    FROM public.gsa_tv_program_blocks
   WHERE id=p_block_id
   FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'GSA TV Autopilot: bloco não encontrado';
  END IF;

  SELECT *
    INTO v_version
    FROM public.gsa_tv_schedule_versions
   WHERE id=v_block.schedule_version_id
   FOR UPDATE;

  IF NOT FOUND
     OR v_version.channel_id<>'ch-main'
     OR v_version.state<>'published'
     OR v_version.broadcast_date<>p_broadcast_date THEN
    RAISE EXCEPTION 'GSA TV Autopilot: grade mudou ou não está publicada para D+1';
  END IF;

  IF v_block.media_item_id IS DISTINCT FROM v_expected THEN
    RAISE EXCEPTION 'GSA TV Autopilot: vínculo de mídia mudou desde a decisão de fallback';
  END IF;

  IF v_block.block_type='live'
     OR v_block.is_reprise
     OR COALESCE(v_block.metadata->>'content_mode','')='library' THEN
    RAISE EXCEPTION 'GSA TV Autopilot: bloco não elegível para fallback institucional';
  END IF;

  SELECT *
    INTO v_fallback
    FROM public.gsa_tv_media_items
   WHERE id=p_fallback_media_id
     AND channel_id='ch-main'
   FOR SHARE;

  IF NOT FOUND
     OR v_fallback.state<>'ready'
     OR v_fallback.approval_state<>'approved'
     OR NOT v_fallback.rights_ok THEN
    RAISE EXCEPTION 'GSA TV Autopilot: filler institucional não está pronto/aprovado';
  END IF;

  IF COALESCE(v_fallback.metadata->>'autopilot_official_continuity','false')<>'true' THEN
    RAISE EXCEPTION 'GSA TV Autopilot: mídia informada não é o filler institucional autorizado';
  END IF;

  v_block_end :=
    (p_broadcast_date::timestamp
      + make_interval(secs=>v_block.planned_start_offset_s+v_block.planned_duration_s))
    AT TIME ZONE 'America/Sao_Paulo';

  IF v_fallback.rights_expires_at IS NOT NULL
     AND v_fallback.rights_expires_at < v_block_end THEN
    RAISE EXCEPTION 'GSA TV Autopilot: direitos do filler expiram antes do bloco';
  END IF;

  UPDATE public.gsa_tv_program_blocks
     SET media_item_id=p_fallback_media_id,
         metadata=COALESCE(metadata,'{}'::jsonb) || jsonb_build_object(
           'content_mode','library',
           'autopilot_fallback',true,
           'autopilot_fallback_reason','production_deadline',
           'autopilot_previous_media_id',v_expected,
           'autopilot_fallback_assigned_at',now()
         ),
         updated_at=now()
   WHERE id=p_block_id
     AND media_item_id IS NOT DISTINCT FROM v_expected;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'GSA TV Autopilot: compare-and-swap de fallback perdeu a corrida';
  END IF;

  INSERT INTO public.gsa_tv_audit_log(
    channel_id,actor,action,resource_type,resource_id,ip_address,details
  ) VALUES (
    'ch-main',
    'autopilot-fallback-engine',
    'assign_continuity_fallback',
    'program_block',
    p_block_id::text,
    NULL,
    jsonb_build_object(
      'broadcast_date',p_broadcast_date,
      'schedule_version_id',v_block.schedule_version_id,
      'program_id',v_block.program_id,
      'previous_media_item_id',v_expected,
      'fallback_media_item_id',p_fallback_media_id,
      'planned_duration_s',v_block.planned_duration_s
    )
  );

  RETURN jsonb_build_object(
    'success',true,
    'changed',true,
    'block_id',p_block_id,
    'previous_media_item_id',v_expected,
    'fallback_media_item_id',p_fallback_media_id
  );
END;
$$;

REVOKE ALL ON FUNCTION public.gsa_tv_autopilot_assign_continuity_fallback(uuid,text,text,date)
  FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.gsa_tv_autopilot_assign_continuity_fallback(uuid,text,text,date)
  TO service_role;

COMMENT ON FUNCTION public.gsa_tv_autopilot_assign_continuity_fallback(uuid,text,text,date) IS
  'CAS auditado de último recurso: converte bloco original D+1 incompleto em continuidade institucional autorizada.';

COMMIT;
