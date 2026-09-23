BEGIN;
SET LOCAL lock_timeout='5s';
SET LOCAL statement_timeout='30s';

CREATE OR REPLACE FUNCTION public.gsa_tv_autopilot_replace_shortfall_media(
  p_block_id uuid,
  p_expected_media_id text,
  p_new_media_id text,
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
  v_old public.gsa_tv_media_items%ROWTYPE;
  v_new public.gsa_tv_media_items%ROWTYPE;
  v_block_end timestamptz;
BEGIN
  IF p_block_id IS NULL OR NULLIF(p_expected_media_id,'') IS NULL OR NULLIF(p_new_media_id,'') IS NULL THEN
    RAISE EXCEPTION 'GSA TV Autopilot: parâmetros obrigatórios ausentes';
  END IF;

  IF p_broadcast_date <= v_today OR p_broadcast_date > v_today + 7 THEN
    RAISE EXCEPTION 'GSA TV Autopilot: troca automática permitida somente para D+1..D+7';
  END IF;

  SELECT *
    INTO v_block
    FROM public.gsa_tv_program_blocks
   WHERE id = p_block_id
   FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'GSA TV Autopilot: bloco não encontrado';
  END IF;

  SELECT *
    INTO v_version
    FROM public.gsa_tv_schedule_versions
   WHERE id = v_block.schedule_version_id
   FOR UPDATE;

  IF NOT FOUND
     OR v_version.channel_id <> 'ch-main'
     OR v_version.state <> 'published'
     OR v_version.broadcast_date <> p_broadcast_date THEN
    RAISE EXCEPTION 'GSA TV Autopilot: grade mudou ou não está publicada para a data esperada';
  END IF;

  IF v_block.media_item_id IS DISTINCT FROM p_expected_media_id THEN
    RAISE EXCEPTION 'GSA TV Autopilot: vínculo de mídia mudou desde a decisão';
  END IF;

  IF v_block.block_type = 'live'
     OR v_block.is_reprise
     OR COALESCE(v_block.metadata->>'content_mode','') = 'library' THEN
    RAISE EXCEPTION 'GSA TV Autopilot: bloco não elegível para substituição automática';
  END IF;

  SELECT *
    INTO v_old
    FROM public.gsa_tv_media_items
   WHERE id = p_expected_media_id
     AND channel_id = 'ch-main';

  IF NOT FOUND THEN
    RAISE EXCEPTION 'GSA TV Autopilot: mídia anterior não encontrada';
  END IF;

  IF v_old.duration_s + 1 >= v_block.planned_duration_s THEN
    RETURN jsonb_build_object(
      'success', true,
      'changed', false,
      'reason', 'shortfall_already_resolved',
      'block_id', p_block_id,
      'media_item_id', p_expected_media_id
    );
  END IF;

  SELECT *
    INTO v_new
    FROM public.gsa_tv_media_items
   WHERE id = p_new_media_id
     AND channel_id = 'ch-main';

  IF NOT FOUND THEN
    RAISE EXCEPTION 'GSA TV Autopilot: nova mídia não encontrada';
  END IF;

  v_block_end :=
    (p_broadcast_date::timestamp
      + make_interval(secs => v_block.planned_start_offset_s + v_block.planned_duration_s))
    AT TIME ZONE 'America/Sao_Paulo';

  IF v_new.state <> 'ready'
     OR v_new.approval_state <> 'approved'
     OR NOT v_new.rights_ok
     OR (v_new.rights_expires_at IS NOT NULL AND v_new.rights_expires_at < v_block_end) THEN
    RAISE EXCEPTION 'GSA TV Autopilot: nova mídia não está pronta/aprovada ou direitos expiram antes do bloco';
  END IF;

  IF abs(v_new.duration_s - v_block.planned_duration_s) > 1.5 THEN
    RAISE EXCEPTION
      'GSA TV Autopilot: duração da nova mídia (%) diverge do slot (%)',
      v_new.duration_s, v_block.planned_duration_s;
  END IF;

  IF COALESCE(v_new.metadata->>'broadcast_date','') <> p_broadcast_date::text
     OR COALESCE(v_new.metadata->>'target_block_id','') <> p_block_id::text
     OR COALESCE(v_new.metadata->>'production_reason','') <> 'duration_shortfall' THEN
    RAISE EXCEPTION 'GSA TV Autopilot: provenance da nova mídia não corresponde ao bloco';
  END IF;

  IF v_block.program_id IS NOT NULL
     AND COALESCE(v_new.metadata->>'program_id','') <> v_block.program_id::text THEN
    RAISE EXCEPTION 'GSA TV Autopilot: programa da nova mídia diverge do bloco';
  END IF;

  UPDATE public.gsa_tv_program_blocks
     SET media_item_id = p_new_media_id,
         metadata = COALESCE(metadata,'{}'::jsonb) || jsonb_build_object(
           'autopilot_previous_media_id', p_expected_media_id,
           'autopilot_replacement_reason', 'duration_shortfall',
           'autopilot_replaced_at', now()
         ),
         updated_at = now()
   WHERE id = p_block_id
     AND media_item_id = p_expected_media_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'GSA TV Autopilot: compare-and-swap perdeu a corrida';
  END IF;

  INSERT INTO public.gsa_tv_audit_log(
    channel_id, actor, action, resource_type, resource_id, ip_address, details
  ) VALUES (
    'ch-main',
    'autopilot-duration-engine',
    'replace_shortfall_media',
    'program_block',
    p_block_id::text,
    NULL,
    jsonb_build_object(
      'broadcast_date', p_broadcast_date,
      'schedule_version_id', v_block.schedule_version_id,
      'program_id', v_block.program_id,
      'old_media_item_id', p_expected_media_id,
      'old_duration_s', v_old.duration_s,
      'new_media_item_id', p_new_media_id,
      'new_duration_s', v_new.duration_s,
      'planned_duration_s', v_block.planned_duration_s
    )
  );

  RETURN jsonb_build_object(
    'success', true,
    'changed', true,
    'block_id', p_block_id,
    'old_media_item_id', p_expected_media_id,
    'new_media_item_id', p_new_media_id,
    'planned_duration_s', v_block.planned_duration_s,
    'new_duration_s', v_new.duration_s
  );
END;
$$;

REVOKE ALL ON FUNCTION public.gsa_tv_autopilot_replace_shortfall_media(uuid,text,text,date)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.gsa_tv_autopilot_replace_shortfall_media(uuid,text,text,date)
  TO service_role;

COMMENT ON FUNCTION public.gsa_tv_autopilot_replace_shortfall_media(uuid,text,text,date) IS
  'CAS auditado para substituir automaticamente mídia curta somente em blocos futuros publicados, com provenance, direitos e duração exata.';

COMMIT;
