-- auth.identities.email is generated from identity_data in the current GoTrue
-- schema and must not be written explicitly.

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

  DELETE FROM auth.refresh_tokens
   WHERE user_id = v_identity.auth_user_id::text;
  DELETE FROM auth.sessions
   WHERE user_id = v_identity.auth_user_id;

  INSERT INTO auth.users(
    instance_id, id, aud, role, email, encrypted_password,
    email_confirmed_at, raw_app_meta_data, raw_user_meta_data,
    created_at, updated_at, confirmation_token, recovery_token,
    email_change, email_change_token_new, email_change_token_current,
    reauthentication_token, is_sso_user, is_anonymous
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
    '', '', '', '', '', '', false, false
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
    provider_id, user_id, identity_data, provider,
    last_sign_in_at, created_at, updated_at
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
    now(), now(), now()
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

