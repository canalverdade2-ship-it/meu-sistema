-- Bridge the authenticated GSA application session to a real Supabase Auth JWT.
-- This lets RLS, Storage and Realtime authorize the same actor that passed the
-- GSA credential check. A fresh technical password and session claim are issued
-- on every login, invalidating previous refresh tokens and JWT session claims.

CREATE TABLE IF NOT EXISTS public.gsa_auth_identities (
  ator_tipo text NOT NULL,
  ator_id uuid NOT NULL,
  auth_user_id uuid NOT NULL DEFAULT extensions.gen_random_uuid(),
  auth_email text NOT NULL,
  criado_em timestamptz NOT NULL DEFAULT now(),
  atualizado_em timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (ator_tipo, ator_id),
  UNIQUE (auth_user_id),
  UNIQUE (auth_email),
  CHECK (ator_tipo IN ('admin', 'colaborador', 'cliente', 'prestador'))
);

ALTER TABLE public.gsa_auth_identities ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.gsa_auth_identities FROM public, anon, authenticated;

CREATE OR REPLACE FUNCTION public.gsa_provision_auth_identity_internal(
  p_ator_tipo text,
  p_ator_id uuid,
  p_ator_nome text,
  p_sessao_id uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth, extensions
AS $$
DECLARE
  v_identity public.gsa_auth_identities%rowtype;
  v_password text;
  v_app_metadata jsonb;
  v_user_metadata jsonb;
BEGIN
  IF p_ator_tipo NOT IN ('admin', 'colaborador', 'cliente', 'prestador')
     OR p_ator_id IS NULL
     OR p_sessao_id IS NULL THEN
    RAISE EXCEPTION 'Identidade GSA invalida.';
  END IF;

  INSERT INTO public.gsa_auth_identities(ator_tipo, ator_id, auth_email)
  VALUES (
    p_ator_tipo,
    p_ator_id,
    lower(p_ator_tipo || '-' || replace(p_ator_id::text, '-', '') || '@auth.gsa.local')
  )
  ON CONFLICT (ator_tipo, ator_id)
  DO UPDATE SET atualizado_em = now()
  RETURNING * INTO v_identity;

  v_password := encode(extensions.gen_random_bytes(32), 'hex') || 'aA1!';
  v_app_metadata := jsonb_build_object(
    'provider', 'email',
    'providers', jsonb_build_array('email'),
    'gsa_actor_type', p_ator_tipo,
    'gsa_actor_id', p_ator_id::text,
    'gsa_session_id', p_sessao_id::text
  );
  v_user_metadata := jsonb_build_object(
    'name', coalesce(nullif(trim(p_ator_nome), ''), 'Usuario GSA')
  );

  -- Remove every refresh path from an older GSA login. Existing access tokens
  -- also stop passing RLS because their gsa_session_id claim is no longer active.
  DELETE FROM auth.refresh_tokens
   WHERE user_id = v_identity.auth_user_id::text;
  DELETE FROM auth.sessions
   WHERE user_id = v_identity.auth_user_id;

  INSERT INTO auth.users(
    instance_id,
    id,
    aud,
    role,
    email,
    encrypted_password,
    email_confirmed_at,
    raw_app_meta_data,
    raw_user_meta_data,
    created_at,
    updated_at,
    confirmation_token,
    recovery_token,
    email_change,
    email_change_token_new,
    email_change_token_current,
    reauthentication_token,
    is_sso_user,
    is_anonymous
  ) VALUES (
    '00000000-0000-0000-0000-000000000000'::uuid,
    v_identity.auth_user_id,
    'authenticated',
    'authenticated',
    v_identity.auth_email,
    extensions.crypt(v_password, extensions.gen_salt('bf', 12)),
    now(),
    v_app_metadata,
    v_user_metadata,
    now(),
    now(),
    '',
    '',
    '',
    '',
    '',
    '',
    false,
    false
  )
  ON CONFLICT (id)
  DO UPDATE SET
    email = excluded.email,
    encrypted_password = excluded.encrypted_password,
    email_confirmed_at = coalesce(auth.users.email_confirmed_at, now()),
    raw_app_meta_data = excluded.raw_app_meta_data,
    raw_user_meta_data = excluded.raw_user_meta_data,
    updated_at = now(),
    banned_until = NULL,
    deleted_at = NULL,
    is_sso_user = false,
    is_anonymous = false;

  INSERT INTO auth.identities(
    provider_id,
    user_id,
    identity_data,
    provider,
    last_sign_in_at,
    created_at,
    updated_at
  ) VALUES (
    v_identity.auth_user_id::text,
    v_identity.auth_user_id,
    jsonb_build_object(
      'sub', v_identity.auth_user_id::text,
      'email', v_identity.auth_email,
      'email_verified', true,
      'phone_verified', false
    ),
    'email',
    now(),
    now(),
    now()
  )
  ON CONFLICT (provider_id, provider)
  DO UPDATE SET
    user_id = excluded.user_id,
    identity_data = excluded.identity_data,
    last_sign_in_at = now(),
    updated_at = now();

  RETURN jsonb_build_object(
    'user_id', v_identity.auth_user_id,
    'email', v_identity.auth_email,
    'password', v_password
  );
END;
$$;

REVOKE ALL ON FUNCTION public.gsa_provision_auth_identity_internal(text, uuid, text, uuid)
  FROM public, anon, authenticated;

CREATE OR REPLACE FUNCTION public.gsa_create_session_internal(
  p_ator_tipo text,
  p_ator_id uuid,
  p_ator_nome text,
  p_metadata jsonb DEFAULT '{}'::jsonb
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth, extensions
AS $$
DECLARE
  v_token text;
  v_sessao_id uuid;
  v_auth jsonb;
BEGIN
  IF p_ator_tipo NOT IN ('admin', 'colaborador', 'cliente', 'prestador') THEN
    RAISE EXCEPTION 'Tipo de ator invalido.';
  END IF;
  IF p_ator_id IS NULL THEN
    RAISE EXCEPTION 'Ator obrigatorio.';
  END IF;

  UPDATE public.sistema_sessoes
     SET status = 'encerrado',
         encerrado_em = coalesce(encerrado_em, now())
   WHERE ator_id = p_ator_id
     AND ator_tipo = p_ator_tipo
     AND status = 'ativo';

  v_token := encode(extensions.gen_random_bytes(32), 'hex');

  INSERT INTO public.sistema_sessoes(
    ator_tipo, ator_id, ator_nome, status, token_hash, token_hint, origem, metadata
  ) VALUES (
    p_ator_tipo,
    p_ator_id,
    coalesce(nullif(trim(p_ator_nome), ''), 'Usuario'),
    'ativo',
    public.gsa_hash_session_token(v_token),
    left(v_token, 8),
    'login_atomico_supabase_auth',
    coalesce(p_metadata, '{}'::jsonb)
  )
  RETURNING id INTO v_sessao_id;

  v_auth := public.gsa_provision_auth_identity_internal(
    p_ator_tipo,
    p_ator_id,
    p_ator_nome,
    v_sessao_id
  );

  RETURN jsonb_build_object(
    'sessao_id', v_sessao_id,
    'session_token', v_token,
    'ator_tipo', p_ator_tipo,
    'ator_id', p_ator_id,
    'ator_nome', coalesce(nullif(trim(p_ator_nome), ''), 'Usuario'),
    'metadata', coalesce(p_metadata, '{}'::jsonb),
    'auth', v_auth
  );
END;
$$;

REVOKE ALL ON FUNCTION public.gsa_create_session_internal(text, uuid, text, jsonb)
  FROM public, anon, authenticated;

CREATE OR REPLACE FUNCTION public.gsa_jwt_actor_type()
RETURNS text
LANGUAGE sql
STABLE
SET search_path = public, auth
AS $$
  SELECT nullif(auth.jwt() -> 'app_metadata' ->> 'gsa_actor_type', '');
$$;

CREATE OR REPLACE FUNCTION public.gsa_jwt_actor_id()
RETURNS uuid
LANGUAGE plpgsql
STABLE
SET search_path = public, auth
AS $$
DECLARE
  v_value text;
BEGIN
  v_value := nullif(auth.jwt() -> 'app_metadata' ->> 'gsa_actor_id', '');
  IF v_value IS NULL THEN RETURN NULL; END IF;
  RETURN v_value::uuid;
EXCEPTION WHEN invalid_text_representation THEN
  RETURN NULL;
END;
$$;

CREATE OR REPLACE FUNCTION public.gsa_jwt_session_id()
RETURNS uuid
LANGUAGE plpgsql
STABLE
SET search_path = public, auth
AS $$
DECLARE
  v_value text;
BEGIN
  v_value := nullif(auth.jwt() -> 'app_metadata' ->> 'gsa_session_id', '');
  IF v_value IS NULL THEN RETURN NULL; END IF;
  RETURN v_value::uuid;
EXCEPTION WHEN invalid_text_representation THEN
  RETURN NULL;
END;
$$;

CREATE OR REPLACE FUNCTION public.gsa_jwt_session_is_valid()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, auth
AS $$
  SELECT EXISTS (
    SELECT 1
      FROM public.sistema_sessoes s
      JOIN public.gsa_auth_identities i
        ON i.ator_tipo = s.ator_tipo
       AND i.ator_id = s.ator_id
     WHERE s.id = public.gsa_jwt_session_id()
       AND s.ator_tipo = public.gsa_jwt_actor_type()
       AND s.ator_id = public.gsa_jwt_actor_id()
       AND s.status = 'ativo'
       AND i.auth_user_id = auth.uid()
  );
$$;

CREATE OR REPLACE FUNCTION public.gsa_jwt_is_admin()
RETURNS boolean
LANGUAGE sql
STABLE
SET search_path = public
AS $$
  SELECT public.gsa_jwt_session_is_valid()
     AND public.gsa_jwt_actor_type() IN ('admin', 'colaborador');
$$;

REVOKE ALL ON FUNCTION public.gsa_jwt_actor_type() FROM public, anon;
REVOKE ALL ON FUNCTION public.gsa_jwt_actor_id() FROM public, anon;
REVOKE ALL ON FUNCTION public.gsa_jwt_session_id() FROM public, anon;
REVOKE ALL ON FUNCTION public.gsa_jwt_session_is_valid() FROM public, anon;
REVOKE ALL ON FUNCTION public.gsa_jwt_is_admin() FROM public, anon;

GRANT EXECUTE ON FUNCTION public.gsa_jwt_actor_type() TO authenticated;
GRANT EXECUTE ON FUNCTION public.gsa_jwt_actor_id() TO authenticated;
GRANT EXECUTE ON FUNCTION public.gsa_jwt_session_id() TO authenticated;
GRANT EXECUTE ON FUNCTION public.gsa_jwt_session_is_valid() TO authenticated;
GRANT EXECUTE ON FUNCTION public.gsa_jwt_is_admin() TO authenticated;
