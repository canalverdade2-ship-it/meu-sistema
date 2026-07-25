BEGIN;

CREATE TABLE IF NOT EXISTS public.gsa_site_campaign_permissions (
  collaborator_id uuid PRIMARY KEY REFERENCES public.colaboradores(id) ON DELETE CASCADE,
  allowed_actions text[] NOT NULL DEFAULT ARRAY['view','create','edit','duplicate','metrics']::text[],
  updated_by_id text,
  updated_by_name text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT gsa_site_campaign_permissions_actions_check CHECK (
    allowed_actions <@ ARRAY['view','create','edit','duplicate','publish','pause','resume','end','archive','delete','metrics']::text[]
  )
);

ALTER TABLE public.gsa_site_campaign_permissions ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.gsa_site_campaign_permissions FROM PUBLIC, anon, authenticated;
GRANT ALL ON public.gsa_site_campaign_permissions TO service_role;

CREATE OR REPLACE FUNCTION public.gsa_site_campaign_permission_touch()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public, pg_temp
AS $$
BEGIN
  NEW.updated_at := now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_gsa_site_campaign_permission_touch ON public.gsa_site_campaign_permissions;
CREATE TRIGGER trg_gsa_site_campaign_permission_touch
BEFORE UPDATE ON public.gsa_site_campaign_permissions
FOR EACH ROW EXECUTE FUNCTION public.gsa_site_campaign_permission_touch();

CREATE OR REPLACE FUNCTION public.gsa_site_campaign_has_action(p_action text)
RETURNS boolean
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_context jsonb := public.gsa_admin_context();
  v_actor_type text := v_context ->> 'actor_type';
  v_actor_id uuid := (v_context ->> 'actor_id')::uuid;
  v_action text := lower(trim(COALESCE(p_action, '')));
BEGIN
  IF v_actor_type = 'admin' THEN
    RETURN true;
  END IF;
  IF v_actor_type <> 'colaborador' OR NOT public.gsa_admin_has_module('avisos-campanhas') THEN
    RETURN false;
  END IF;
  RETURN EXISTS (
    SELECT 1
    FROM public.gsa_site_campaign_permissions p
    WHERE p.collaborator_id = v_actor_id
      AND v_action = ANY(p.allowed_actions)
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.gsa_site_campaign_assert_action(p_action text)
RETURNS void
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  IF NOT public.gsa_site_campaign_has_action(p_action) THEN
    RAISE EXCEPTION 'Você não possui permissão para executar a ação % na Central de Avisos e Campanhas.', p_action USING ERRCODE = '42501';
  END IF;
END;
$$;

ALTER FUNCTION public.gsa_admin_site_campaigns_overview(uuid,text)
  RENAME TO gsa_admin_site_campaigns_overview_internal;
ALTER FUNCTION public.gsa_admin_upsert_site_campaign(uuid,jsonb,uuid,text)
  RENAME TO gsa_admin_upsert_site_campaign_internal;
ALTER FUNCTION public.gsa_admin_set_site_campaign_status(uuid,text,uuid,text)
  RENAME TO gsa_admin_set_site_campaign_status_internal;
ALTER FUNCTION public.gsa_admin_duplicate_site_campaign(uuid,uuid,text)
  RENAME TO gsa_admin_duplicate_site_campaign_internal;
ALTER FUNCTION public.gsa_admin_delete_site_campaign(uuid,uuid,text)
  RENAME TO gsa_admin_delete_site_campaign_internal;

REVOKE ALL ON FUNCTION public.gsa_admin_site_campaigns_overview_internal(uuid,text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.gsa_admin_upsert_site_campaign_internal(uuid,jsonb,uuid,text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.gsa_admin_set_site_campaign_status_internal(uuid,text,uuid,text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.gsa_admin_duplicate_site_campaign_internal(uuid,uuid,text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.gsa_admin_delete_site_campaign_internal(uuid,uuid,text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.gsa_admin_site_campaigns_overview_internal(uuid,text) TO service_role;
GRANT EXECUTE ON FUNCTION public.gsa_admin_upsert_site_campaign_internal(uuid,jsonb,uuid,text) TO service_role;
GRANT EXECUTE ON FUNCTION public.gsa_admin_set_site_campaign_status_internal(uuid,text,uuid,text) TO service_role;
GRANT EXECUTE ON FUNCTION public.gsa_admin_duplicate_site_campaign_internal(uuid,uuid,text) TO service_role;
GRANT EXECUTE ON FUNCTION public.gsa_admin_delete_site_campaign_internal(uuid,uuid,text) TO service_role;

CREATE OR REPLACE FUNCTION public.gsa_admin_site_campaigns_overview(
  p_sessao_id uuid DEFAULT NULL,
  p_session_token text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  PERFORM public.gsa_admin_validate_context(p_sessao_id, p_session_token);
  PERFORM public.gsa_site_campaign_assert_action('view');
  RETURN public.gsa_admin_site_campaigns_overview_internal(p_sessao_id, p_session_token);
END;
$$;

CREATE OR REPLACE FUNCTION public.gsa_admin_upsert_site_campaign(
  p_campaign_id uuid DEFAULT NULL,
  p_payload jsonb DEFAULT '{}'::jsonb,
  p_sessao_id uuid DEFAULT NULL,
  p_session_token text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  PERFORM public.gsa_admin_validate_context(p_sessao_id, p_session_token);
  PERFORM public.gsa_site_campaign_assert_action(CASE WHEN p_campaign_id IS NULL THEN 'create' ELSE 'edit' END);
  RETURN public.gsa_admin_upsert_site_campaign_internal(p_campaign_id, p_payload, p_sessao_id, p_session_token);
END;
$$;

CREATE OR REPLACE FUNCTION public.gsa_admin_set_site_campaign_status(
  p_campaign_id uuid,
  p_action text,
  p_sessao_id uuid DEFAULT NULL,
  p_session_token text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_action text := lower(trim(COALESCE(p_action, '')));
BEGIN
  PERFORM public.gsa_admin_validate_context(p_sessao_id, p_session_token);
  IF v_action NOT IN ('publish','pause','resume','end','archive') THEN
    RAISE EXCEPTION 'Ação inválida';
  END IF;
  PERFORM public.gsa_site_campaign_assert_action(v_action);
  RETURN public.gsa_admin_set_site_campaign_status_internal(p_campaign_id, v_action, p_sessao_id, p_session_token);
END;
$$;

CREATE OR REPLACE FUNCTION public.gsa_admin_duplicate_site_campaign(
  p_campaign_id uuid,
  p_sessao_id uuid DEFAULT NULL,
  p_session_token text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  PERFORM public.gsa_admin_validate_context(p_sessao_id, p_session_token);
  PERFORM public.gsa_site_campaign_assert_action('duplicate');
  RETURN public.gsa_admin_duplicate_site_campaign_internal(p_campaign_id, p_sessao_id, p_session_token);
END;
$$;

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
BEGIN
  PERFORM public.gsa_admin_validate_context(p_sessao_id, p_session_token);
  PERFORM public.gsa_site_campaign_assert_action('delete');
  RETURN public.gsa_admin_delete_site_campaign_internal(p_campaign_id, p_sessao_id, p_session_token);
END;
$$;

CREATE OR REPLACE FUNCTION public.gsa_admin_site_campaign_permission_overview(
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
  v_result jsonb;
BEGIN
  IF v_context ->> 'actor_type' <> 'admin' THEN
    RAISE EXCEPTION 'Somente administradores podem gerenciar permissões da Central.' USING ERRCODE = '42501';
  END IF;

  SELECT COALESCE(jsonb_agg(jsonb_build_object(
    'id', c.id,
    'nome', c.nome,
    'email', c.email,
    'status', c.status,
    'enabled', EXISTS (
      SELECT 1 FROM public.colaborador_modulos cm
      WHERE cm.colaborador_id = c.id AND cm.modulo_id = 'avisos-campanhas'
    ),
    'allowed_actions', COALESCE(p.allowed_actions, ARRAY[]::text[])
  ) ORDER BY c.nome), '[]'::jsonb)
  INTO v_result
  FROM public.colaboradores c
  LEFT JOIN public.gsa_site_campaign_permissions p ON p.collaborator_id = c.id;

  RETURN jsonb_build_object('success', true, 'collaborators', v_result);
END;
$$;

CREATE OR REPLACE FUNCTION public.gsa_admin_set_site_campaign_permissions(
  p_collaborator_id uuid,
  p_enabled boolean,
  p_allowed_actions text[] DEFAULT ARRAY[]::text[],
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
  v_actor_id text := v_context ->> 'actor_id';
  v_actor_name text := COALESCE(v_context ->> 'actor_name', 'Administrador');
  v_actions text[] := ARRAY(SELECT DISTINCT lower(trim(value)) FROM unnest(COALESCE(p_allowed_actions, ARRAY[]::text[])) value WHERE trim(value) <> '');
  v_collaborator_name text;
BEGIN
  IF v_context ->> 'actor_type' <> 'admin' THEN
    RAISE EXCEPTION 'Somente administradores podem gerenciar permissões da Central.' USING ERRCODE = '42501';
  END IF;
  IF NOT v_actions <@ ARRAY['view','create','edit','duplicate','publish','pause','resume','end','archive','delete','metrics']::text[] THEN
    RAISE EXCEPTION 'Existe uma permissão de ação inválida';
  END IF;
  IF p_enabled AND NOT ('view' = ANY(v_actions)) THEN
    RAISE EXCEPTION 'A permissão de visualização é obrigatória quando o módulo está ativo';
  END IF;

  SELECT nome INTO v_collaborator_name FROM public.colaboradores WHERE id = p_collaborator_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Colaborador não encontrado'; END IF;

  IF p_enabled THEN
    INSERT INTO public.colaborador_modulos(colaborador_id, modulo_id)
    VALUES (p_collaborator_id, 'avisos-campanhas')
    ON CONFLICT DO NOTHING;

    INSERT INTO public.gsa_site_campaign_permissions(collaborator_id, allowed_actions, updated_by_id, updated_by_name)
    VALUES (p_collaborator_id, v_actions, v_actor_id, v_actor_name)
    ON CONFLICT (collaborator_id) DO UPDATE SET
      allowed_actions = EXCLUDED.allowed_actions,
      updated_by_id = EXCLUDED.updated_by_id,
      updated_by_name = EXCLUDED.updated_by_name;
  ELSE
    DELETE FROM public.colaborador_modulos
    WHERE colaborador_id = p_collaborator_id AND modulo_id = 'avisos-campanhas';
    DELETE FROM public.gsa_site_campaign_permissions WHERE collaborator_id = p_collaborator_id;
  END IF;

  INSERT INTO public.gsa_site_campaign_history(campaign_name, action, actor_type, actor_id, actor_name, details)
  VALUES (
    'Permissões da Central',
    'PERMISSIONS_UPDATED',
    'admin',
    v_actor_id,
    v_actor_name,
    jsonb_build_object(
      'collaborator_id', p_collaborator_id,
      'collaborator_name', v_collaborator_name,
      'enabled', p_enabled,
      'allowed_actions', CASE WHEN p_enabled THEN to_jsonb(v_actions) ELSE '[]'::jsonb END
    )
  );

  RETURN jsonb_build_object('success', true, 'enabled', p_enabled, 'allowed_actions', CASE WHEN p_enabled THEN to_jsonb(v_actions) ELSE '[]'::jsonb END);
END;
$$;

REVOKE ALL ON FUNCTION public.gsa_site_campaign_permission_touch() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.gsa_site_campaign_has_action(text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.gsa_site_campaign_assert_action(text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.gsa_admin_site_campaign_permission_overview(uuid,text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.gsa_admin_set_site_campaign_permissions(uuid,boolean,text[],uuid,text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.gsa_site_campaign_has_action(text) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.gsa_site_campaign_assert_action(text) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.gsa_admin_site_campaigns_overview(uuid,text) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.gsa_admin_upsert_site_campaign(uuid,jsonb,uuid,text) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.gsa_admin_set_site_campaign_status(uuid,text,uuid,text) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.gsa_admin_duplicate_site_campaign(uuid,uuid,text) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.gsa_admin_delete_site_campaign(uuid,uuid,text) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.gsa_admin_site_campaign_permission_overview(uuid,text) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.gsa_admin_set_site_campaign_permissions(uuid,boolean,text[],uuid,text) TO authenticated, service_role;

COMMIT;
