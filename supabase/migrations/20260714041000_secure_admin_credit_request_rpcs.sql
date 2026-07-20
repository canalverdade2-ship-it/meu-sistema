CREATE OR REPLACE FUNCTION public.gsa_admin_preaprovar_credito(
  p_sessao_id uuid,
  p_session_token text,
  p_solicitacao_id uuid,
  p_limite_aprovado numeric,
  p_opcao_pagamento_parcelado boolean,
  p_max_parcelas integer,
  p_contrato_url text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_actor record;
  v_sol loja_credito_solicitacoes%rowtype;
  v_limite numeric := round(coalesce(p_limite_aprovado, 0), 2);
  v_contrato_url text := nullif(trim(coalesce(p_contrato_url, '')), '');
  v_max_parcelas integer := greatest(1, least(60, coalesce(p_max_parcelas, 12)));
BEGIN
  IF v_limite <= 0 THEN
    RAISE EXCEPTION 'Limite aprovado deve ser maior que zero.';
  END IF;

  IF v_contrato_url IS NULL THEN
    RAISE EXCEPTION 'Contrato de abertura de credito e obrigatorio.';
  END IF;

  SELECT * INTO v_actor FROM public.gsa_admin_session_actor(p_sessao_id, p_session_token) LIMIT 1;

  SELECT * INTO v_sol
  FROM public.loja_credito_solicitacoes
  WHERE id = p_solicitacao_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Solicitacao de credito nao encontrada.';
  END IF;

  UPDATE public.loja_credito_solicitacoes
     SET limite_aprovado = v_limite,
         opcao_pagamento_parcelado = coalesce(p_opcao_pagamento_parcelado, false),
         max_parcelas = CASE WHEN coalesce(p_opcao_pagamento_parcelado, false) THEN v_max_parcelas ELSE 12 END,
         contrato_url = v_contrato_url,
         status = 'contrato_pendente_assinatura',
         updated_at = now()
   WHERE id = p_solicitacao_id;

  RETURN jsonb_build_object(
    'success', true,
    'solicitacao_id', p_solicitacao_id,
    'cliente_id', v_sol.cliente_id,
    'status', 'contrato_pendente_assinatura',
    'limite_aprovado', v_limite,
    'ator_nome', v_actor.ator_nome
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.gsa_admin_recusar_credito(
  p_sessao_id uuid,
  p_session_token text,
  p_solicitacao_id uuid,
  p_motivo text,
  p_nova_tentativa_apos date
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_actor record;
  v_sol loja_credito_solicitacoes%rowtype;
  v_motivo text := nullif(trim(coalesce(p_motivo, '')), '');
BEGIN
  IF v_motivo IS NULL THEN
    RAISE EXCEPTION 'Motivo da recusa e obrigatorio.';
  END IF;

  SELECT * INTO v_actor FROM public.gsa_admin_session_actor(p_sessao_id, p_session_token) LIMIT 1;

  SELECT * INTO v_sol
  FROM public.loja_credito_solicitacoes
  WHERE id = p_solicitacao_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Solicitacao de credito nao encontrada.';
  END IF;

  UPDATE public.loja_credito_solicitacoes
     SET motivo_negacao = v_motivo,
         nova_tentativa_apos = p_nova_tentativa_apos,
         status = 'negado',
         updated_at = now()
   WHERE id = p_solicitacao_id;

  RETURN jsonb_build_object(
    'success', true,
    'solicitacao_id', p_solicitacao_id,
    'cliente_id', v_sol.cliente_id,
    'status', 'negado',
    'ator_nome', v_actor.ator_nome
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.gsa_admin_solicitar_documento_credito(
  p_sessao_id uuid,
  p_session_token text,
  p_solicitacao_id uuid,
  p_nome_documento text,
  p_observacao text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_actor record;
  v_sol loja_credito_solicitacoes%rowtype;
  v_nome text := nullif(trim(coalesce(p_nome_documento, '')), '');
  v_doc_id uuid;
BEGIN
  IF v_nome IS NULL THEN
    RAISE EXCEPTION 'Nome do documento e obrigatorio.';
  END IF;

  SELECT * INTO v_actor FROM public.gsa_admin_session_actor(p_sessao_id, p_session_token) LIMIT 1;

  SELECT * INTO v_sol
  FROM public.loja_credito_solicitacoes
  WHERE id = p_solicitacao_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Solicitacao de credito nao encontrada.';
  END IF;

  INSERT INTO public.loja_credito_documentos(
    solicitacao_id,
    nome_documento,
    observacao,
    status
  )
  VALUES (
    p_solicitacao_id,
    v_nome,
    nullif(trim(coalesce(p_observacao, '')), ''),
    'pendente'
  )
  RETURNING id INTO v_doc_id;

  UPDATE public.loja_credito_solicitacoes
     SET status = 'documentos_pendentes',
         updated_at = now()
   WHERE id = p_solicitacao_id;

  RETURN jsonb_build_object(
    'success', true,
    'documento_id', v_doc_id,
    'solicitacao_id', p_solicitacao_id,
    'cliente_id', v_sol.cliente_id,
    'nome_documento', v_nome,
    'ator_nome', v_actor.ator_nome
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.gsa_admin_atualizar_documento_credito(
  p_sessao_id uuid,
  p_session_token text,
  p_documento_id uuid,
  p_status text,
  p_observacao text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_actor record;
  v_doc loja_credito_documentos%rowtype;
  v_status text := lower(trim(coalesce(p_status, '')));
BEGIN
  IF v_status NOT IN ('pendente', 'aprovado', 'rejeitado') THEN
    RAISE EXCEPTION 'Status de documento invalido.';
  END IF;

  SELECT * INTO v_actor FROM public.gsa_admin_session_actor(p_sessao_id, p_session_token) LIMIT 1;

  SELECT * INTO v_doc
  FROM public.loja_credito_documentos
  WHERE id = p_documento_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Documento de credito nao encontrado.';
  END IF;

  UPDATE public.loja_credito_documentos
     SET status = v_status,
         observacao = CASE WHEN v_status = 'rejeitado' THEN nullif(trim(coalesce(p_observacao, '')), '') ELSE NULL END,
         updated_at = now()
   WHERE id = p_documento_id;

  RETURN jsonb_build_object(
    'success', true,
    'documento_id', p_documento_id,
    'solicitacao_id', v_doc.solicitacao_id,
    'nome_documento', v_doc.nome_documento,
    'status', v_status,
    'ator_nome', v_actor.ator_nome
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.gsa_admin_rejeitar_contrato_credito(
  p_sessao_id uuid,
  p_session_token text,
  p_solicitacao_id uuid,
  p_motivo text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_actor record;
  v_sol loja_credito_solicitacoes%rowtype;
  v_motivo text := nullif(trim(coalesce(p_motivo, '')), '');
BEGIN
  IF v_motivo IS NULL THEN
    RAISE EXCEPTION 'Motivo da rejeicao e obrigatorio.';
  END IF;

  SELECT * INTO v_actor FROM public.gsa_admin_session_actor(p_sessao_id, p_session_token) LIMIT 1;

  SELECT * INTO v_sol
  FROM public.loja_credito_solicitacoes
  WHERE id = p_solicitacao_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Solicitacao de credito nao encontrada.';
  END IF;

  UPDATE public.loja_credito_solicitacoes
     SET status = 'contrato_pendente_assinatura',
         contrato_assinado_url = NULL,
         motivo_negacao = v_motivo,
         updated_at = now()
   WHERE id = p_solicitacao_id;

  RETURN jsonb_build_object(
    'success', true,
    'solicitacao_id', p_solicitacao_id,
    'cliente_id', v_sol.cliente_id,
    'status', 'contrato_pendente_assinatura',
    'ator_nome', v_actor.ator_nome
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.gsa_admin_preaprovar_credito(uuid, text, uuid, numeric, boolean, integer, text) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.gsa_admin_recusar_credito(uuid, text, uuid, text, date) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.gsa_admin_solicitar_documento_credito(uuid, text, uuid, text, text) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.gsa_admin_atualizar_documento_credito(uuid, text, uuid, text, text) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.gsa_admin_rejeitar_contrato_credito(uuid, text, uuid, text) TO anon, authenticated;
