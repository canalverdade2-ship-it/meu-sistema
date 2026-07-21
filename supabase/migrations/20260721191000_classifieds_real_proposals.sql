-- Fluxo operacional de propostas e mensagens moderadas dos Classificados.

BEGIN;

ALTER TABLE public.classificados_propostas
  ADD COLUMN IF NOT EXISTS anuncio_id uuid,
  ADD COLUMN IF NOT EXISTS comprador_id uuid,
  ADD COLUMN IF NOT EXISTS vendedor_id uuid,
  ADD COLUMN IF NOT EXISTS valor_proposta numeric,
  ADD COLUMN IF NOT EXISTS protocolo text,
  ADD COLUMN IF NOT EXISTS request_id uuid,
  ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'em_analise_gsa',
  ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now();

ALTER TABLE public.classificados_mensagens
  ADD COLUMN IF NOT EXISTS proposta_id uuid,
  ADD COLUMN IF NOT EXISTS remetente_id uuid,
  ADD COLUMN IF NOT EXISTS conteudo text,
  ADD COLUMN IF NOT EXISTS status_moderacao text NOT NULL DEFAULT 'pendente',
  ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now();

CREATE INDEX IF NOT EXISTS idx_classificados_propostas_comprador
  ON public.classificados_propostas(comprador_id, updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_classificados_propostas_vendedor
  ON public.classificados_propostas(vendedor_id, updated_at DESC);
CREATE UNIQUE INDEX IF NOT EXISTS idx_classificados_propostas_request
  ON public.classificados_propostas(comprador_id, request_id)
  WHERE request_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_classificados_mensagens_proposta
  ON public.classificados_mensagens(proposta_id, created_at ASC);

CREATE OR REPLACE FUNCTION public.gsa_client_classified_context(
  p_sessao_id uuid,
  p_session_token text
)
RETURNS uuid
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_claims jsonb := COALESCE(auth.jwt(), '{}'::jsonb);
  v_client_id uuid;
  v_jwt_session_id uuid;
  v_valid boolean := false;
BEGIN
  IF COALESCE(v_claims -> 'app_metadata' ->> 'gsa_actor_type', '') <> 'cliente' THEN
    RAISE EXCEPTION 'Sessão de cliente obrigatória.' USING ERRCODE = '42501';
  END IF;

  BEGIN
    v_client_id := NULLIF(v_claims -> 'app_metadata' ->> 'gsa_actor_id', '')::uuid;
    v_jwt_session_id := NULLIF(v_claims -> 'app_metadata' ->> 'gsa_session_id', '')::uuid;
  EXCEPTION WHEN invalid_text_representation THEN
    RAISE EXCEPTION 'Identidade da sessão inválida.' USING ERRCODE = '42501';
  END;

  IF v_client_id IS NULL OR v_jwt_session_id IS NULL OR v_jwt_session_id <> p_sessao_id THEN
    RAISE EXCEPTION 'Sessão de cliente inválida.' USING ERRCODE = '42501';
  END IF;

  SELECT EXISTS (
    SELECT 1
      FROM public.sistema_sessoes s
     WHERE s.id = p_sessao_id
       AND s.session_token = p_session_token
       AND lower(COALESCE(s.status, '')) IN ('ativo', 'ativa', 'active')
       AND (s.expira_em IS NULL OR s.expira_em > now())
       AND lower(COALESCE(s.ator_tipo, '')) = 'cliente'
       AND s.ator_id = v_client_id
  ) INTO v_valid;

  IF NOT v_valid OR NOT COALESCE(public.gsa_jwt_session_is_valid(), false) THEN
    RAISE EXCEPTION 'Sessão expirada. Faça login novamente.' USING ERRCODE = '42501';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.clientes c
     WHERE c.id = v_client_id
       AND lower(COALESCE(c.status, 'ativo')) = 'ativo'
       AND COALESCE(c.bloqueado, false) = false
       AND COALESCE(c.cadastro_aprovado, true) = true
  ) THEN
    RAISE EXCEPTION 'Seu cadastro não permite esta operação.' USING ERRCODE = '42501';
  END IF;

  RETURN v_client_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.gsa_client_classified_create_proposal(
  p_sessao_id uuid,
  p_session_token text,
  p_anuncio_id uuid,
  p_valor numeric,
  p_mensagem text,
  p_request_id uuid DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_client_id uuid := public.gsa_client_classified_context(p_sessao_id, p_session_token);
  v_anuncio record;
  v_proposta_id uuid;
  v_mensagem_id uuid;
  v_mensagem text := trim(COALESCE(p_mensagem, ''));
  v_request_id uuid := COALESCE(p_request_id, gen_random_uuid());
  v_protocolo text;
BEGIN
  IF p_anuncio_id IS NULL OR p_valor IS NULL OR p_valor <= 0 OR p_valor > 999999999.99 THEN
    RAISE EXCEPTION 'Informe um valor de proposta válido.' USING ERRCODE = '22023';
  END IF;

  IF length(v_mensagem) < 10 OR length(v_mensagem) > 1500 THEN
    RAISE EXCEPTION 'A mensagem deve possuir entre 10 e 1500 caracteres.' USING ERRCODE = '22023';
  END IF;

  IF v_mensagem ~* '(https?://|www\.|[[:alnum:]_.+-]+@[[:alnum:].-]+\.[[:alpha:]]{2,}|(^|[^0-9])[0-9]{10,13}([^0-9]|$))' THEN
    RAISE EXCEPTION 'Não informe telefone, e-mail ou link. A comunicação é protegida pela GSA.' USING ERRCODE = '22023';
  END IF;

  SELECT a.id, a.cliente_id, a.preco, a.status, a.titulo
    INTO v_anuncio
    FROM public.classificados_anuncios a
   WHERE a.id = p_anuncio_id
   FOR SHARE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Anúncio não encontrado.' USING ERRCODE = 'P0002';
  END IF;

  IF lower(COALESCE(v_anuncio.status, '')) NOT IN ('publicado', 'ativo', 'aprovado') THEN
    RAISE EXCEPTION 'Este anúncio não está disponível para propostas.' USING ERRCODE = '22023';
  END IF;

  IF v_anuncio.cliente_id = v_client_id THEN
    RAISE EXCEPTION 'Você não pode enviar proposta para o próprio anúncio.' USING ERRCODE = '22023';
  END IF;

  SELECT p.id
    INTO v_proposta_id
    FROM public.classificados_propostas p
   WHERE p.comprador_id = v_client_id
     AND p.request_id = v_request_id
   LIMIT 1;

  IF v_proposta_id IS NOT NULL THEN
    RETURN jsonb_build_object('success', true, 'id', v_proposta_id, 'already_created', true);
  END IF;

  IF EXISTS (
    SELECT 1 FROM public.classificados_propostas p
     WHERE p.anuncio_id = p_anuncio_id
       AND p.comprador_id = v_client_id
       AND lower(COALESCE(p.status, '')) NOT IN ('rejeitada', 'cancelada', 'encerrada')
  ) THEN
    RAISE EXCEPTION 'Você já possui uma proposta ativa para este anúncio.' USING ERRCODE = '23505';
  END IF;

  v_protocolo := 'CLA-PROP-' || upper(substr(encode(gen_random_bytes(8), 'hex'), 1, 12));

  INSERT INTO public.classificados_propostas (
    anuncio_id, comprador_id, vendedor_id, valor_proposta,
    protocolo, request_id, status, created_at, updated_at
  ) VALUES (
    p_anuncio_id, v_client_id, v_anuncio.cliente_id, round(p_valor, 2),
    v_protocolo, v_request_id, 'em_analise_gsa', now(), now()
  ) RETURNING id INTO v_proposta_id;

  INSERT INTO public.classificados_mensagens (
    proposta_id, remetente_id, conteudo, status_moderacao, created_at, updated_at
  ) VALUES (
    v_proposta_id, v_client_id, v_mensagem, 'pendente', now(), now()
  ) RETURNING id INTO v_mensagem_id;

  RETURN jsonb_build_object(
    'success', true,
    'id', v_proposta_id,
    'message_id', v_mensagem_id,
    'protocol', v_protocolo,
    'status', 'em_analise_gsa'
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.gsa_client_classified_list_messages(
  p_sessao_id uuid,
  p_session_token text,
  p_proposta_id uuid
)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_client_id uuid := public.gsa_client_classified_context(p_sessao_id, p_session_token);
  v_items jsonb;
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM public.classificados_propostas p
     WHERE p.id = p_proposta_id
       AND v_client_id IN (p.comprador_id, p.vendedor_id)
  ) THEN
    RAISE EXCEPTION 'Negociação não encontrada.' USING ERRCODE = 'P0002';
  END IF;

  SELECT COALESCE(jsonb_agg(
    jsonb_build_object(
      'id', m.id,
      'conteudo', m.conteudo,
      'remetente_id', m.remetente_id,
      'status_moderacao', m.status_moderacao,
      'created_at', m.created_at
    ) ORDER BY m.created_at ASC
  ), '[]'::jsonb)
    INTO v_items
    FROM public.classificados_mensagens m
   WHERE m.proposta_id = p_proposta_id
     AND (
       lower(COALESCE(m.status_moderacao, '')) IN ('aprovado', 'aprovada', 'approved')
       OR m.remetente_id = v_client_id
     );

  RETURN v_items;
END;
$$;

CREATE OR REPLACE FUNCTION public.gsa_client_classified_send_message(
  p_sessao_id uuid,
  p_session_token text,
  p_proposta_id uuid,
  p_mensagem text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_client_id uuid := public.gsa_client_classified_context(p_sessao_id, p_session_token);
  v_proposta record;
  v_mensagem text := trim(COALESCE(p_mensagem, ''));
  v_id uuid;
BEGIN
  IF length(v_mensagem) < 2 OR length(v_mensagem) > 1500 THEN
    RAISE EXCEPTION 'A mensagem deve possuir entre 2 e 1500 caracteres.' USING ERRCODE = '22023';
  END IF;

  IF v_mensagem ~* '(https?://|www\.|[[:alnum:]_.+-]+@[[:alnum:].-]+\.[[:alpha:]]{2,}|(^|[^0-9])[0-9]{10,13}([^0-9]|$))' THEN
    RAISE EXCEPTION 'Não informe telefone, e-mail ou link. A comunicação é protegida pela GSA.' USING ERRCODE = '22023';
  END IF;

  SELECT p.id, p.comprador_id, p.vendedor_id, p.status
    INTO v_proposta
    FROM public.classificados_propostas p
   WHERE p.id = p_proposta_id
     AND v_client_id IN (p.comprador_id, p.vendedor_id)
   FOR SHARE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Negociação não encontrada.' USING ERRCODE = 'P0002';
  END IF;

  IF lower(COALESCE(v_proposta.status, '')) IN ('rejeitada', 'cancelada', 'encerrada') THEN
    RAISE EXCEPTION 'Esta negociação não aceita novas mensagens.' USING ERRCODE = '22023';
  END IF;

  INSERT INTO public.classificados_mensagens (
    proposta_id, remetente_id, conteudo, status_moderacao, created_at, updated_at
  ) VALUES (
    p_proposta_id, v_client_id, v_mensagem, 'pendente', now(), now()
  ) RETURNING id INTO v_id;

  RETURN jsonb_build_object('success', true, 'id', v_id, 'status', 'pendente');
END;
$$;

REVOKE ALL ON FUNCTION public.gsa_client_classified_context(uuid, text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.gsa_client_classified_create_proposal(uuid, text, uuid, numeric, text, uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.gsa_client_classified_list_messages(uuid, text, uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.gsa_client_classified_send_message(uuid, text, uuid, text) FROM PUBLIC, anon;

GRANT EXECUTE ON FUNCTION public.gsa_client_classified_context(uuid, text) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.gsa_client_classified_create_proposal(uuid, text, uuid, numeric, text, uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.gsa_client_classified_list_messages(uuid, text, uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.gsa_client_classified_send_message(uuid, text, uuid, text) TO authenticated, service_role;

COMMIT;
