BEGIN;

CREATE OR REPLACE FUNCTION public.gsa_admin_site_campaigns_overview(
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
  v_result jsonb;
  v_actions text[];
  v_campaigns jsonb;
BEGIN
  PERFORM public.gsa_site_campaign_assert_action('view');

  IF v_context ->> 'actor_type' = 'admin' THEN
    v_actions := ARRAY['view','create','edit','duplicate','publish','pause','resume','end','archive','delete','metrics']::text[];
  ELSE
    SELECT COALESCE(allowed_actions, ARRAY[]::text[])
    INTO v_actions
    FROM public.gsa_site_campaign_permissions
    WHERE collaborator_id = (v_context ->> 'actor_id')::uuid;
  END IF;

  v_result := public.gsa_admin_site_campaigns_overview_internal(p_sessao_id, p_session_token);

  IF NOT ('metrics' = ANY(COALESCE(v_actions, ARRAY[]::text[]))) THEN
    SELECT COALESCE(jsonb_agg(item - 'metrics'), '[]'::jsonb)
    INTO v_campaigns
    FROM jsonb_array_elements(COALESCE(v_result -> 'campaigns', '[]'::jsonb)) item;

    v_result := jsonb_set(v_result, '{campaigns}', COALESCE(v_campaigns, '[]'::jsonb), true);
    v_result := jsonb_set(v_result, '{analytics}', jsonb_build_object('by_device','[]'::jsonb,'by_page','[]'::jsonb,'by_day','[]'::jsonb), true);
    v_result := jsonb_set(v_result, '{totals,impressions}', '0'::jsonb, true);
    v_result := jsonb_set(v_result, '{totals,clicks}', '0'::jsonb, true);
    v_result := jsonb_set(v_result, '{totals,click_through_rate}', '0'::jsonb, true);
  END IF;

  RETURN v_result || jsonb_build_object('current_permissions', COALESCE(to_jsonb(v_actions), '[]'::jsonb));
END;
$$;

CREATE OR REPLACE FUNCTION public.gsa_admin_site_campaign_my_permissions(
  p_sessao_id uuid DEFAULT NULL,
  p_session_token text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_context jsonb := public.gsa_admin_validate_context(p_sessao_id, p_session_token);
  v_actions text[];
BEGIN
  PERFORM public.gsa_admin_assert_module('avisos-campanhas');
  IF v_context ->> 'actor_type' = 'admin' THEN
    v_actions := ARRAY['view','create','edit','duplicate','publish','pause','resume','end','archive','delete','metrics']::text[];
  ELSE
    SELECT COALESCE(allowed_actions, ARRAY[]::text[])
    INTO v_actions
    FROM public.gsa_site_campaign_permissions
    WHERE collaborator_id = (v_context ->> 'actor_id')::uuid;
  END IF;
  RETURN jsonb_build_object(
    'actor_type', v_context ->> 'actor_type',
    'allowed_actions', COALESCE(to_jsonb(v_actions), '[]'::jsonb)
  );
END;
$$;

REVOKE ALL ON FUNCTION public.gsa_admin_site_campaign_my_permissions(uuid,text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.gsa_admin_site_campaign_my_permissions(uuid,text) TO authenticated, service_role;

COMMIT;
