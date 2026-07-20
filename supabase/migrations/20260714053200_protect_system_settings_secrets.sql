-- System secrets must never be returned by a direct table SELECT or stored in
-- clear text. Administrative changes are session-bound and bcrypt-backed.

CREATE OR REPLACE FUNCTION public.gsa_admin_upsert_settings(
  p_sessao_id uuid,
  p_session_token text,
  p_settings jsonb
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  v_actor record;
  v_setting record;
BEGIN
  SELECT * INTO v_actor
  FROM public.gsa_admin_can_configure(p_sessao_id, p_session_token)
  LIMIT 1;

  IF jsonb_typeof(p_settings) <> 'array' OR jsonb_array_length(p_settings) = 0 THEN
    RAISE EXCEPTION 'Lista de configuracoes invalida.';
  END IF;
  IF jsonb_array_length(p_settings) > 100 THEN
    RAISE EXCEPTION 'Limite de configuracoes por operacao excedido.';
  END IF;

  FOR v_setting IN
    SELECT trim(x.key) AS key, x.value
    FROM jsonb_to_recordset(p_settings) AS x(key text, value text)
  LOOP
    IF nullif(v_setting.key, '') IS NULL OR length(v_setting.key) > 120 THEN
      RAISE EXCEPTION 'Chave de configuracao invalida.';
    END IF;
    IF length(coalesce(v_setting.value, '')) > 20000 THEN
      RAISE EXCEPTION 'Valor de configuracao excede o limite permitido.';
    END IF;

    IF v_setting.key IN ('master_api_key', 'smtp_password') THEN
      RAISE EXCEPTION 'Segredos externos devem ser configurados no ambiente seguro do servidor.';
    END IF;

    IF v_setting.key = 'admin_access_code' THEN
      IF v_actor.ator_tipo <> 'admin' THEN
        RAISE EXCEPTION 'Apenas o administrador master pode alterar o codigo de acesso.';
      END IF;
      IF length(coalesce(v_setting.value, '')) < 8 THEN
        RAISE EXCEPTION 'O novo codigo administrativo deve ter pelo menos 8 caracteres.';
      END IF;

      INSERT INTO public.system_settings(key, value, value_hash, must_change_code, updated_at)
      VALUES (
        v_setting.key,
        '',
        extensions.crypt(v_setting.value, extensions.gen_salt('bf', 12)),
        false,
        now()
      )
      ON CONFLICT (key) DO UPDATE
        SET value = '',
            value_hash = excluded.value_hash,
            must_change_code = false,
            updated_at = now();
    ELSE
      INSERT INTO public.system_settings(key, value, must_change_code, updated_at)
      VALUES (v_setting.key, coalesce(v_setting.value, ''), false, now())
      ON CONFLICT (key) DO UPDATE
        SET value = excluded.value,
            updated_at = now();
    END IF;
  END LOOP;

  INSERT INTO public.sistema_logs(acao, detalhes, ator_tipo, ator_id, ator_nome)
  VALUES (
    'ATUALIZAR_CONFIGURACOES',
    jsonb_build_object(
      'chaves', (SELECT jsonb_agg(value ->> 'key') FROM jsonb_array_elements(p_settings)),
      'quantidade', jsonb_array_length(p_settings)
    )::text,
    v_actor.ator_tipo,
    v_actor.ator_id,
    v_actor.ator_nome
  );

  RETURN true;
END;
$$;

CREATE OR REPLACE FUNCTION public.gsa_admin_change_access_code(
  p_sessao_id uuid,
  p_session_token text,
  p_current_code text,
  p_new_code text
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  v_actor record;
  v_setting public.system_settings%rowtype;
BEGIN
  SELECT * INTO v_actor
  FROM public.gsa_admin_session_actor(p_sessao_id, p_session_token)
  LIMIT 1;

  IF v_actor.ator_tipo <> 'admin' THEN
    RAISE EXCEPTION 'Apenas o administrador master pode alterar o codigo de acesso.';
  END IF;
  IF length(coalesce(p_new_code, '')) < 8 THEN
    RAISE EXCEPTION 'O novo codigo deve ter pelo menos 8 caracteres.';
  END IF;
  IF p_new_code = p_current_code THEN
    RAISE EXCEPTION 'O novo codigo deve ser diferente do codigo atual.';
  END IF;

  SELECT * INTO v_setting
  FROM public.system_settings
  WHERE key = 'admin_access_code'
  FOR UPDATE;

  IF v_setting.value_hash IS NULL
     OR extensions.crypt(coalesce(p_current_code, ''), v_setting.value_hash) <> v_setting.value_hash THEN
    RAISE EXCEPTION 'Codigo atual incorreto.';
  END IF;

  UPDATE public.system_settings
     SET value = '',
         value_hash = extensions.crypt(p_new_code, extensions.gen_salt('bf', 12)),
         must_change_code = false,
         updated_at = now()
   WHERE key = 'admin_access_code';

  INSERT INTO public.sistema_logs(acao, detalhes, ator_tipo, ator_id, ator_nome)
  VALUES (
    'ALTERAR_CODIGO_ADMIN',
    'Codigo administrativo alterado com verificacao da credencial atual.',
    v_actor.ator_tipo,
    v_actor.ator_id,
    v_actor.ator_nome
  );

  RETURN true;
END;
$$;

UPDATE public.system_settings
   SET value = ''
 WHERE key = 'admin_access_code'
   AND value_hash IS NOT NULL;

ALTER TABLE public.system_settings ENABLE ROW LEVEL SECURITY;

DO $$
DECLARE
  v_policy record;
BEGIN
  FOR v_policy IN
    SELECT policyname
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'system_settings'
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.system_settings', v_policy.policyname);
  END LOOP;
END;
$$;

CREATE POLICY system_settings_public_read
ON public.system_settings
FOR SELECT
TO anon, authenticated
USING (key NOT IN ('admin_access_code', 'master_api_key', 'smtp_password'));

CREATE POLICY system_settings_admin_secret_read
ON public.system_settings
FOR SELECT
TO authenticated
USING (public.gsa_jwt_is_admin());

REVOKE ALL ON TABLE public.system_settings FROM anon, authenticated;
GRANT SELECT ON TABLE public.system_settings TO anon, authenticated;

REVOKE ALL ON FUNCTION public.gsa_admin_change_access_code(uuid, text, text, text)
  FROM public;
GRANT EXECUTE ON FUNCTION public.gsa_admin_change_access_code(uuid, text, text, text)
  TO authenticated;

