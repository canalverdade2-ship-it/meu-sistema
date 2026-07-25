BEGIN;

CREATE OR REPLACE FUNCTION public.gsa_admin_delete_site_campaign(
  p_campaign_id uuid,
  p_sessao_id uuid DEFAULT NULL,
  p_session_token text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_context jsonb := public.gsa_admin_validate_context(p_sessao_id, p_session_token);
  v_actor_type text := v_context ->> 'actor_type';
  v_actor_id text := v_context ->> 'actor_id';
  v_actor_name text := COALESCE(v_context ->> 'actor_name', v_context ->> 'name', 'Usuário administrativo');
  v_campaign public.gsa_site_campaigns%ROWTYPE;
  v_event_count bigint;
BEGIN
  PERFORM public.gsa_admin_assert_module('avisos-campanhas');

  SELECT * INTO v_campaign
  FROM public.gsa_site_campaigns
  WHERE id = p_campaign_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Campanha não encontrada';
  END IF;

  IF v_campaign.status NOT IN ('draft', 'archived') THEN
    RAISE EXCEPTION 'Somente rascunhos ou campanhas arquivadas podem ser excluídos';
  END IF;

  SELECT count(*) INTO v_event_count
  FROM public.gsa_site_campaign_events
  WHERE campaign_id = p_campaign_id;

  INSERT INTO public.gsa_site_campaign_history(
    campaign_id, campaign_name, action, actor_type, actor_id, actor_name, details
  ) VALUES (
    v_campaign.id,
    v_campaign.internal_name,
    'DELETED',
    v_actor_type,
    v_actor_id,
    v_actor_name,
    jsonb_build_object(
      'campaign', to_jsonb(v_campaign),
      'deleted_event_count', v_event_count
    )
  );

  DELETE FROM public.gsa_site_campaigns WHERE id = p_campaign_id;

  RETURN jsonb_build_object(
    'success', true,
    'deleted_id', p_campaign_id,
    'deleted_event_count', v_event_count
  );
END;
$$;

REVOKE ALL ON FUNCTION public.gsa_admin_delete_site_campaign(uuid,uuid,text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.gsa_admin_delete_site_campaign(uuid,uuid,text) TO authenticated, service_role;

COMMIT;
