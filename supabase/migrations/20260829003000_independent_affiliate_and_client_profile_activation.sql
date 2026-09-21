BEGIN;

ALTER TABLE public.clientes
  ADD COLUMN IF NOT EXISTS perfil_cliente_ativo boolean,
  ADD COLUMN IF NOT EXISTS perfil_cliente_ativado_em timestamptz,
  ADD COLUMN IF NOT EXISTS perfil_cliente_origem text,
  ADD COLUMN IF NOT EXISTS cadastro_origem text;

UPDATE public.clientes
SET perfil_cliente_ativo = true,
    perfil_cliente_ativado_em = coalesce(perfil_cliente_ativado_em, data_cadastro, now()),
    perfil_cliente_origem = coalesce(perfil_cliente_origem, 'legado'),
    cadastro_origem = coalesce(cadastro_origem, 'cliente')
WHERE perfil_cliente_ativo IS NULL;

ALTER TABLE public.clientes
  ALTER COLUMN perfil_cliente_ativo SET DEFAULT true,
  ALTER COLUMN perfil_cliente_ativo SET NOT NULL;

ALTER TABLE public.clientes DROP CONSTRAINT IF EXISTS clientes_perfil_cliente_origem_check;
ALTER TABLE public.clientes ADD CONSTRAINT clientes_perfil_cliente_origem_check
  CHECK (perfil_cliente_origem IS NULL OR perfil_cliente_origem IN ('legado','cadastro_cliente','afiliado','administrativo'));

ALTER TABLE public.clientes DROP CONSTRAINT IF EXISTS clientes_cadastro_origem_check;
ALTER TABLE public.clientes ADD CONSTRAINT clientes_cadastro_origem_check
  CHECK (cadastro_origem IS NULL OR cadastro_origem IN ('cliente','afiliado','administrativo','legado'));

CREATE OR REPLACE FUNCTION public.gsa_register_affiliate_account(p_payload jsonb DEFAULT '{}'::jsonb)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions, pg_temp
AS $$
DECLARE
  v_payload jsonb := coalesce(p_payload, '{}'::jsonb);
  v_document text := regexp_replace(coalesce(v_payload->>'documento', ''), '\D', '', 'g');
  v_name text := trim(coalesce(v_payload->>'nome', ''));
  v_display_name text := trim(coalesce(v_payload->>'nome_divulgacao', ''));
  v_email text := lower(trim(coalesce(v_payload->>'email', '')));
  v_phone text := regexp_replace(coalesce(v_payload->>'telefone', ''), '\D', '', 'g');
  v_pin text := coalesce(v_payload->>'pin', '');
  v_pix_type text := lower(trim(coalesce(v_payload->>'pix_tipo', '')));
  v_pix_key text := trim(coalesce(v_payload->>'pix_chave', ''));
  v_terms_version text := left(trim(coalesce(v_payload->>'termos_versao', '2026-08-29')), 40);
  v_client public.clientes%rowtype;
  v_affiliate public.gsa_afiliados%rowtype;
  v_session jsonb;
  v_client_code text;
  v_is_new boolean := false;
BEGIN
  IF pg_column_size(v_payload) > 24576 THEN
    RAISE EXCEPTION 'Dados excedem o limite permitido.';
  END IF;
  IF length(v_document) NOT IN (11, 14) THEN RAISE EXCEPTION 'Informe um CPF ou CNPJ valido.'; END IF;
  IF length(v_display_name) NOT BETWEEN 3 AND 120 THEN RAISE EXCEPTION 'Informe o nome de divulgacao.'; END IF;
  IF v_pin !~ '^\d{4}$' THEN RAISE EXCEPTION 'O PIN deve ter exatamente 4 digitos.'; END IF;
  IF v_pix_type NOT IN ('cpf','cnpj','email','telefone','aleatoria') OR v_pix_key = '' OR length(v_pix_key) > 180 THEN
    RAISE EXCEPTION 'Informe uma chave PIX valida.';
  END IF;
  IF coalesce((v_payload->>'termos_aceitos')::boolean, false) IS NOT TRUE THEN
    RAISE EXCEPTION 'E necessario aceitar os termos do programa.';
  END IF;

  PERFORM public.gsa_assert_public_rate_limit('cadastro_afiliado_documento', v_document, 5, interval '1 hour');

  SELECT c.* INTO v_client
  FROM public.clientes c
  WHERE regexp_replace(coalesce(c.cpf, c.cnpj, ''), '\D', '', 'g') = v_document
  LIMIT 1
  FOR UPDATE;

  IF v_client.id IS NULL THEN
    IF length(v_name) NOT BETWEEN 3 AND 180 THEN RAISE EXCEPTION 'Informe o nome completo.'; END IF;
    IF v_email !~* '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$' THEN RAISE EXCEPTION 'Informe um e-mail valido.'; END IF;
    IF length(v_phone) NOT BETWEEN 10 AND 13 THEN RAISE EXCEPTION 'Informe um telefone valido.'; END IF;
    IF EXISTS (SELECT 1 FROM public.clientes c WHERE lower(trim(coalesce(c.email, ''))) = v_email) THEN
      RAISE EXCEPTION 'Este e-mail ja esta vinculado a outra conta GSA.';
    END IF;
    IF EXISTS (SELECT 1 FROM public.clientes c WHERE regexp_replace(coalesce(c.telefone, ''), '\D', '', 'g') = v_phone) THEN
      RAISE EXCEPTION 'Este telefone ja esta vinculado a outra conta GSA.';
    END IF;

    v_client_code := 'CLI-' || upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 16));
    INSERT INTO public.clientes(
      codigo_cliente, nome, email, cpf, cnpj, tipo_pessoa, telefone,
      status, cadastro_aprovado, pin_hash, pin_tentativas, pin_bloqueado,
      perfil_cliente_ativo, perfil_cliente_ativado_em, perfil_cliente_origem,
      cadastro_origem, bonus_boas_vindas_pendente
    ) VALUES (
      v_client_code, v_name, v_email,
      CASE WHEN length(v_document) = 11 THEN v_document ELSE NULL END,
      CASE WHEN length(v_document) = 14 THEN v_document ELSE NULL END,
      CASE WHEN length(v_document) = 14 THEN 'pj' ELSE 'pf' END,
      v_phone, 'ativo', true, extensions.crypt(v_pin, extensions.gen_salt('bf', 12)), 0, false,
      false, NULL, NULL, 'afiliado', false
    ) RETURNING * INTO v_client;
    v_is_new := true;
  ELSE
    IF coalesce(v_client.pin_bloqueado, false) THEN RAISE EXCEPTION 'A conta esta temporariamente bloqueada.'; END IF;
    IF v_client.pin_hash IS NULL OR extensions.crypt(v_pin, v_client.pin_hash) <> v_client.pin_hash THEN
      RAISE EXCEPTION 'Documento ou PIN incorreto.';
    END IF;
    IF coalesce(v_client.cadastro_aprovado, true) IS NOT TRUE THEN
      RAISE EXCEPTION 'A conta GSA informada ainda nao possui acesso liberado.';
    END IF;
  END IF;

  SELECT a.* INTO v_affiliate FROM public.gsa_afiliados a WHERE a.cliente_id = v_client.id FOR UPDATE;
  IF v_affiliate.id IS NULL THEN
    INSERT INTO public.gsa_afiliados(
      cliente_id, codigo_publico, nome_divulgacao, status,
      pix_tipo, pix_chave, termos_versao, termos_aceitos_em
    ) VALUES (
      v_client.id, public.gsa_affiliate_new_code('A'), v_display_name, 'ativo',
      v_pix_type, v_pix_key, v_terms_version, now()
    ) RETURNING * INTO v_affiliate;
  ELSIF v_affiliate.status <> 'ativo' THEN
    RAISE EXCEPTION 'O perfil de afiliado esta indisponivel. Procure o atendimento GSA.';
  ELSE
    UPDATE public.gsa_afiliados
       SET nome_divulgacao = v_display_name,
           pix_tipo = v_pix_type,
           pix_chave = v_pix_key,
           termos_versao = v_terms_version,
           termos_aceitos_em = now(),
           updated_at = now()
     WHERE id = v_affiliate.id
     RETURNING * INTO v_affiliate;
  END IF;

  INSERT INTO public.sistema_logs(acao, detalhes, ator_tipo, ator_id, ator_nome)
  VALUES (
    CASE WHEN v_is_new THEN 'CADASTRAR_AFILIADO_INDEPENDENTE' ELSE 'ATIVAR_AFILIADO' END,
    CASE WHEN v_is_new THEN 'Identidade GSA criada inicialmente como afiliado.' ELSE 'Perfil de afiliado ativado em identidade existente.' END,
    'cliente', v_client.id, v_client.nome
  );

  v_session := public.gsa_create_session_internal(
    'cliente', v_client.id, v_client.nome,
    jsonb_build_object(
      'perfil_cliente_ativo', v_client.perfil_cliente_ativo,
      'perfil_afiliado_ativo', true,
      'cadastro_origem', coalesce(v_client.cadastro_origem, 'cliente')
    )
  );

  RETURN jsonb_build_object(
    'success', true,
    'valid', true,
    'id', v_client.id,
    'nome', v_client.nome,
    'is_new_identity', v_is_new,
    'perfil_cliente_ativo', v_client.perfil_cliente_ativo,
    'affiliate_id', v_affiliate.id,
    'session', v_session
  );
END;
$$;

REVOKE ALL ON FUNCTION public.gsa_register_affiliate_account(jsonb) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.gsa_register_affiliate_account(jsonb) TO service_role;

CREATE OR REPLACE FUNCTION public.gsa_client_profile_access_state(
  p_sessao_id uuid,
  p_session_token text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_actor record;
  v_client record;
  v_affiliate record;
BEGIN
  SELECT * INTO v_actor FROM public.gsa_client_session_actor(p_sessao_id, p_session_token) LIMIT 1;
  SELECT id, nome, perfil_cliente_ativo, perfil_cliente_ativado_em, cadastro_origem
    INTO v_client FROM public.clientes WHERE id = v_actor.cliente_id;
  SELECT id, status INTO v_affiliate FROM public.gsa_afiliados WHERE cliente_id = v_actor.cliente_id;

  RETURN jsonb_build_object(
    'success', true,
    'client_id', v_client.id,
    'nome', v_client.nome,
    'perfil_cliente_ativo', coalesce(v_client.perfil_cliente_ativo, true),
    'perfil_cliente_ativado_em', v_client.perfil_cliente_ativado_em,
    'perfil_afiliado_ativo', v_affiliate.id IS NOT NULL AND v_affiliate.status = 'ativo',
    'cadastro_origem', v_client.cadastro_origem
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.gsa_affiliate_activate_client_profile(
  p_sessao_id uuid,
  p_session_token text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_actor record;
  v_client public.clientes%rowtype;
  v_affiliate public.gsa_afiliados%rowtype;
  v_activated boolean := false;
BEGIN
  SELECT * INTO v_actor FROM public.gsa_client_session_actor(p_sessao_id, p_session_token) LIMIT 1;
  SELECT * INTO v_client FROM public.clientes WHERE id = v_actor.cliente_id FOR UPDATE;
  SELECT * INTO v_affiliate FROM public.gsa_afiliados WHERE cliente_id = v_actor.cliente_id;

  IF v_affiliate.id IS NULL OR v_affiliate.status <> 'ativo' THEN
    RAISE EXCEPTION 'E necessario possuir um perfil de afiliado ativo.';
  END IF;

  IF coalesce(v_client.perfil_cliente_ativo, false) IS NOT TRUE THEN
    UPDATE public.clientes
       SET perfil_cliente_ativo = true,
           perfil_cliente_ativado_em = now(),
           perfil_cliente_origem = 'afiliado',
           bonus_boas_vindas_pendente = true,
           updated_at = now()
     WHERE id = v_client.id;
    v_activated := true;

    INSERT INTO public.sistema_logs(acao, detalhes, ator_tipo, ator_id, ator_nome)
    VALUES (
      'ATIVAR_PERFIL_CLIENTE_PELO_AFILIADO',
      'Perfil de cliente ativado pelo proprio afiliado autenticado.',
      'cliente', v_client.id, v_client.nome
    );
  END IF;

  RETURN jsonb_build_object(
    'success', true,
    'activated', v_activated,
    'client_id', v_client.id,
    'redirect_to', '/cliente/dashboard'
  );
END;
$$;

REVOKE ALL ON FUNCTION public.gsa_client_profile_access_state(uuid, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.gsa_affiliate_activate_client_profile(uuid, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.gsa_client_profile_access_state(uuid, text) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.gsa_affiliate_activate_client_profile(uuid, text) TO anon, authenticated;

NOTIFY pgrst, 'reload schema';

COMMIT;
