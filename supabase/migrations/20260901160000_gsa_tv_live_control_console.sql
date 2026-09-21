BEGIN;

CREATE OR REPLACE FUNCTION public.gsa_admin_gsa_tv_live_command(
  p_sessao_id uuid DEFAULT NULL,
  p_session_token text DEFAULT NULL,
  p_command text DEFAULT NULL,
  p_payload jsonb DEFAULT '{}'::jsonb
) RETURNS jsonb
LANGUAGE plpgsql VOLATILE SECURITY DEFINER
SET search_path=public,pg_temp AS $$
DECLARE
  v_context jsonb := public.gsa_tv_admin_context(p_sessao_id,p_session_token);
  v_command text := lower(trim(COALESCE(p_command,'')));
  v_channel_id text := COALESCE(NULLIF(p_payload->>'channel_id',''),'ch-main');
  v_job_id uuid;
  v_media public.gsa_tv_media_items%ROWTYPE;
BEGIN
  IF v_command NOT IN (
    'stream_start','stream_pause','stream_resume','stream_stop',
    'playout_next','playout_previous','playout_reset',
    'live_take','live_return','media_take','emergency_take','graphics_reload'
  ) THEN
    RAISE EXCEPTION 'Comando de operação ao vivo não permitido.' USING ERRCODE='22023';
  END IF;

  IF NOT EXISTS(SELECT 1 FROM public.gsa_tv_channels WHERE id=v_channel_id) THEN
    RAISE EXCEPTION 'Canal da GSA TV não encontrado.' USING ERRCODE='P0002';
  END IF;

  IF v_command='media_take' THEN
    SELECT * INTO v_media FROM public.gsa_tv_media_items
    WHERE id=p_payload->>'media_item_id' AND channel_id=v_channel_id;
    IF NOT FOUND OR v_media.state<>'ready' OR NOT v_media.rights_ok OR
       (v_media.media_kind='advertising' AND v_media.approval_state<>'approved') OR
       (v_media.rights_expires_at IS NOT NULL AND v_media.rights_expires_at<=now()) THEN
      RAISE EXCEPTION 'A mídia não está pronta, aprovada ou com direitos válidos.' USING ERRCODE='22023';
    END IF;
  END IF;

  IF v_command='live_take' AND NOT EXISTS(
    SELECT 1 FROM public.gsa_tv_live_sources
    WHERE id=NULLIF(p_payload->>'source_id','')::uuid AND channel_id=v_channel_id
      AND enabled AND connection_configured
  ) THEN
    RAISE EXCEPTION 'A fonte ao vivo não está disponível.' USING ERRCODE='22023';
  END IF;

  IF EXISTS(
    SELECT 1 FROM public.gsa_tv_jobs
    WHERE channel_id=v_channel_id AND job_type=v_command AND status IN('pending','running')
  ) THEN
    RAISE EXCEPTION 'Este comando já está sendo processado.' USING ERRCODE='55000';
  END IF;

  INSERT INTO public.gsa_tv_jobs(channel_id,job_type,status,progress,payload)
  VALUES(v_channel_id,v_command,'pending',0,p_payload-'channel_id') RETURNING id INTO v_job_id;

  PERFORM public.gsa_tv_write_audit(
    v_context,v_channel_id,'live_command_enqueued','job',v_job_id::text,
    jsonb_build_object('command',v_command,'payload',p_payload-'connection_url'-'stream_key')
  );
  RETURN jsonb_build_object('success',true,'id',v_job_id,'status','pending','command',v_command);
END;
$$;

REVOKE ALL ON FUNCTION public.gsa_admin_gsa_tv_live_command(uuid,text,text,jsonb) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.gsa_admin_gsa_tv_live_command(uuid,text,text,jsonb) TO authenticated,service_role;
NOTIFY pgrst,'reload schema';
COMMIT;
