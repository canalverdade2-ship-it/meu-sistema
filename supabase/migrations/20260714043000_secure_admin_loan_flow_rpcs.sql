CREATE OR REPLACE FUNCTION public.gsa_admin_emprestimo_add_historico(
  p_emprestimo_id uuid,
  p_orcamento_id uuid,
  p_tipo_acao text,
  p_descricao text,
  p_usuario_tipo text DEFAULT 'admin',
  p_usuario_id uuid DEFAULT NULL,
  p_metadata jsonb DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.emprestimo_historico(
    emprestimo_id,
    orcamento_id,
    tipo_acao,
    descricao,
    usuario_tipo,
    usuario_id,
    metadata
  )
  VALUES (
    p_emprestimo_id,
    p_orcamento_id,
    p_tipo_acao,
    p_descricao,
    p_usuario_tipo,
    p_usuario_id,
    p_metadata
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.gsa_admin_emprestimo_salvar_observacao(
  p_sessao_id uuid,
  p_session_token text,
  p_emprestimo_id uuid,
  p_observacoes_admin text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_actor record;
  v_emp emprestimos%rowtype;
BEGIN
  SELECT * INTO v_actor FROM public.gsa_admin_session_actor(p_sessao_id, p_session_token) LIMIT 1;

  SELECT * INTO v_emp FROM public.emprestimos WHERE id = p_emprestimo_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Emprestimo nao encontrado.'; END IF;

  UPDATE public.emprestimos
     SET observacoes_admin = p_observacoes_admin,
         updated_at = now()
   WHERE id = p_emprestimo_id;

  PERFORM public.gsa_admin_emprestimo_add_historico(
    p_emprestimo_id,
    v_emp.orcamento_id,
    'observacao_admin',
    'Nota interna: ' || coalesce(p_observacoes_admin, '') || ' [POR: ' || v_actor.ator_nome || ']',
    'admin',
    NULL,
    jsonb_build_object('sessao_id', p_sessao_id)
  );

  RETURN jsonb_build_object('success', true, 'emprestimo_id', p_emprestimo_id, 'cliente_id', v_emp.cliente_id);
END;
$$;

CREATE OR REPLACE FUNCTION public.gsa_admin_emprestimo_enviar_comentario(
  p_sessao_id uuid,
  p_session_token text,
  p_emprestimo_id uuid,
  p_autor_id uuid,
  p_mensagem text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_actor record;
  v_emp emprestimos%rowtype;
  v_msg text := nullif(trim(coalesce(p_mensagem, '')), '');
  v_comentario_id uuid;
BEGIN
  IF v_msg IS NULL THEN RAISE EXCEPTION 'Mensagem obrigatoria.'; END IF;
  SELECT * INTO v_actor FROM public.gsa_admin_session_actor(p_sessao_id, p_session_token) LIMIT 1;

  SELECT * INTO v_emp FROM public.emprestimos WHERE id = p_emprestimo_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Emprestimo nao encontrado.'; END IF;

  INSERT INTO public.emprestimo_comentarios(emprestimo_id, autor_tipo, autor_id, mensagem)
  VALUES (p_emprestimo_id, 'admin', p_autor_id, v_msg)
  RETURNING id INTO v_comentario_id;

  RETURN jsonb_build_object(
    'success', true,
    'comentario_id', v_comentario_id,
    'emprestimo_id', p_emprestimo_id,
    'cliente_id', v_emp.cliente_id,
    'codigo_emprestimo', v_emp.codigo_emprestimo,
    'ator_nome', v_actor.ator_nome
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.gsa_admin_emprestimo_enviar_proposta(
  p_sessao_id uuid,
  p_session_token text,
  p_emprestimo_id uuid,
  p_valor_aprovado numeric,
  p_juros_total_percentual numeric,
  p_max_parcelas_liberado integer,
  p_taxa_servico numeric,
  p_proposta_mensagem text,
  p_validade_dias integer
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_actor record;
  v_emp emprestimos%rowtype;
  v_valor numeric := round(coalesce(p_valor_aprovado, 0), 2);
  v_juros numeric := round(coalesce(p_juros_total_percentual, 0), 2);
  v_taxa numeric := round(coalesce(p_taxa_servico, 0), 2);
  v_parcelas integer := greatest(1, coalesce(p_max_parcelas_liberado, 1));
  v_validade integer := greatest(1, coalesce(p_validade_dias, 7));
BEGIN
  IF v_valor <= 0 THEN RAISE EXCEPTION 'Valor aprovado deve ser maior que zero.'; END IF;
  IF v_juros < 0 THEN RAISE EXCEPTION 'Juros nao pode ser negativo.'; END IF;
  IF v_taxa < 0 THEN RAISE EXCEPTION 'Taxa de servico nao pode ser negativa.'; END IF;

  SELECT * INTO v_actor FROM public.gsa_admin_session_actor(p_sessao_id, p_session_token) LIMIT 1;
  SELECT * INTO v_emp FROM public.emprestimos WHERE id = p_emprestimo_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Emprestimo nao encontrado.'; END IF;

  UPDATE public.emprestimos
     SET valor_aprovado = v_valor,
         juros_total_percentual = v_juros,
         max_parcelas_liberado = v_parcelas,
         taxa_servico = v_taxa,
         proposta_mensagem = p_proposta_mensagem,
         proposta_validade = now() + (v_validade || ' days')::interval,
         status = 'proposta_enviada',
         updated_at = now()
   WHERE id = p_emprestimo_id;

  IF v_emp.orcamento_id IS NOT NULL THEN
    UPDATE public.orcamentos SET status = 'aprovado' WHERE id = v_emp.orcamento_id;
  END IF;

  PERFORM public.gsa_admin_emprestimo_add_historico(
    p_emprestimo_id,
    v_emp.orcamento_id,
    'proposta_enviada',
    'Proposta: ' || v_juros || '% juros, max ' || v_parcelas || 'x, taxa R$' || v_taxa || ' [POR: ' || v_actor.ator_nome || ']',
    'admin',
    NULL,
    jsonb_build_object('sessao_id', p_sessao_id)
  );

  RETURN jsonb_build_object('success', true, 'emprestimo_id', p_emprestimo_id, 'cliente_id', v_emp.cliente_id);
END;
$$;

CREATE OR REPLACE FUNCTION public.gsa_admin_emprestimo_enviar_contrato(
  p_sessao_id uuid,
  p_session_token text,
  p_emprestimo_id uuid,
  p_contrato_url text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_actor record;
  v_emp emprestimos%rowtype;
  v_url text := nullif(trim(coalesce(p_contrato_url, '')), '');
BEGIN
  IF v_url IS NULL THEN RAISE EXCEPTION 'URL do contrato obrigatoria.'; END IF;
  SELECT * INTO v_actor FROM public.gsa_admin_session_actor(p_sessao_id, p_session_token) LIMIT 1;
  SELECT * INTO v_emp FROM public.emprestimos WHERE id = p_emprestimo_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Emprestimo nao encontrado.'; END IF;

  UPDATE public.emprestimos
     SET contrato_url = v_url,
         status = 'pendencia_assinatura',
         updated_at = now()
   WHERE id = p_emprestimo_id;

  PERFORM public.gsa_admin_emprestimo_add_historico(
    p_emprestimo_id,
    v_emp.orcamento_id,
    'contrato_enviado',
    'ADM enviou contrato para assinatura [POR: ' || v_actor.ator_nome || ']',
    'admin',
    NULL,
    jsonb_build_object('sessao_id', p_sessao_id)
  );

  RETURN jsonb_build_object('success', true, 'emprestimo_id', p_emprestimo_id, 'cliente_id', v_emp.cliente_id);
END;
$$;

CREATE OR REPLACE FUNCTION public.gsa_admin_emprestimo_aprovar(
  p_sessao_id uuid,
  p_session_token text,
  p_emprestimo_id uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_actor record;
  v_emp emprestimos%rowtype;
  v_taxa numeric;
  v_is_taxa_zero boolean;
  v_fatura_id uuid;
  v_vencimento date := current_date + 5;
BEGIN
  SELECT * INTO v_actor FROM public.gsa_admin_session_actor(p_sessao_id, p_session_token) LIMIT 1;
  SELECT * INTO v_emp FROM public.emprestimos WHERE id = p_emprestimo_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Emprestimo nao encontrado.'; END IF;

  IF v_emp.fatura_taxa_id IS NOT NULL THEN
    UPDATE public.emprestimos SET status = 'aprovado', updated_at = now() WHERE id = p_emprestimo_id;
    RETURN jsonb_build_object('success', true, 'already_processed', true, 'emprestimo_id', p_emprestimo_id, 'cliente_id', v_emp.cliente_id, 'fatura_id', v_emp.fatura_taxa_id);
  END IF;

  v_taxa := round(coalesce(v_emp.taxa_servico, 0), 2);
  v_is_taxa_zero := v_taxa = 0;

  INSERT INTO public.faturas(
    cliente_id,
    emprestimo_id,
    tipo,
    valor_total,
    status,
    data_vencimento,
    data_emissao,
    data_pagamento,
    gerada_automaticamente,
    itens_faturados
  )
  VALUES (
    v_emp.cliente_id,
    p_emprestimo_id,
    'taxa_servico_emprestimo',
    v_taxa,
    CASE WHEN v_is_taxa_zero THEN 'paga' ELSE 'pendente' END,
    v_vencimento,
    current_date,
    CASE WHEN v_is_taxa_zero THEN now() ELSE NULL END,
    true,
    jsonb_build_array(jsonb_build_object(
      'descricao', 'Taxa de Servico - Emprestimo Aprovado (' || coalesce(v_emp.codigo_emprestimo, p_emprestimo_id::text) || ')',
      'valor_unitario', v_taxa,
      'quantidade', 1,
      'subtotal', v_taxa
    ))
  )
  RETURNING id INTO v_fatura_id;

  UPDATE public.emprestimos
     SET status = 'aprovado',
         fatura_taxa_id = v_fatura_id,
         updated_at = now()
   WHERE id = p_emprestimo_id;

  PERFORM public.gsa_admin_emprestimo_add_historico(
    p_emprestimo_id,
    v_emp.orcamento_id,
    'aprovado',
    CASE WHEN v_is_taxa_zero
      THEN 'Emprestimo aprovado. Taxa de servico isenta (R$ 0,00). Fatura gerada como paga automaticamente.'
      ELSE 'Emprestimo aprovado. Fatura de taxa gerada.'
    END || ' [POR: ' || v_actor.ator_nome || ']',
    'admin',
    NULL,
    jsonb_build_object('sessao_id', p_sessao_id, 'fatura_id', v_fatura_id)
  );

  RETURN jsonb_build_object(
    'success', true,
    'already_processed', false,
    'emprestimo_id', p_emprestimo_id,
    'cliente_id', v_emp.cliente_id,
    'fatura_id', v_fatura_id,
    'taxa_servico', v_taxa,
    'taxa_zero', v_is_taxa_zero
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.gsa_admin_emprestimo_atualizar_status(
  p_sessao_id uuid,
  p_session_token text,
  p_emprestimo_id uuid,
  p_status text,
  p_motivo text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_actor record;
  v_emp emprestimos%rowtype;
  v_status text := lower(trim(coalesce(p_status, '')));
  v_motivo text := nullif(trim(coalesce(p_motivo, '')), '');
  v_tipo_acao text;
  v_descricao text;
BEGIN
  IF v_status NOT IN ('ativo', 'pendencia_documentos', 'pendencia_assinatura', 'cancelado') THEN
    RAISE EXCEPTION 'Status de emprestimo invalido para esta operacao.';
  END IF;

  SELECT * INTO v_actor FROM public.gsa_admin_session_actor(p_sessao_id, p_session_token) LIMIT 1;
  SELECT * INTO v_emp FROM public.emprestimos WHERE id = p_emprestimo_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Emprestimo nao encontrado.'; END IF;

  IF v_status IN ('pendencia_documentos', 'pendencia_assinatura') AND v_motivo IS NULL THEN
    RAISE EXCEPTION 'Motivo da pendencia e obrigatorio.';
  END IF;

  IF v_status = 'ativo' THEN
    UPDATE public.emprestimos
       SET status = 'ativo',
           data_ativacao = now(),
           updated_at = now()
     WHERE id = p_emprestimo_id;
    v_tipo_acao := 'ativado';
    v_descricao := 'Emprestimo ativado pelo administrador';
  ELSIF v_status = 'pendencia_documentos' THEN
    UPDATE public.emprestimos
       SET status = 'pendencia_documentos',
           motivo_pendencia = v_motivo,
           updated_at = now()
     WHERE id = p_emprestimo_id;
    v_tipo_acao := 'pendencia_documentos';
    v_descricao := 'Pendencia: ' || v_motivo;
  ELSIF v_status = 'pendencia_assinatura' THEN
    UPDATE public.emprestimos
       SET status = 'pendencia_assinatura',
           assinatura_url = NULL,
           data_assinatura = NULL,
           motivo_pendencia = v_motivo,
           updated_at = now()
     WHERE id = p_emprestimo_id;
    v_tipo_acao := 'assinatura_reprovada';
    v_descricao := 'Assinatura reprovada: ' || v_motivo;
  ELSE
    UPDATE public.emprestimos
       SET status = 'cancelado',
           updated_at = now()
     WHERE id = p_emprestimo_id;
    v_tipo_acao := 'cancelado';
    v_descricao := 'Emprestimo cancelado pelo Financeiro';
  END IF;

  PERFORM public.gsa_admin_emprestimo_add_historico(
    p_emprestimo_id,
    v_emp.orcamento_id,
    v_tipo_acao,
    v_descricao || ' [POR: ' || v_actor.ator_nome || ']',
    'admin',
    NULL,
    jsonb_build_object('sessao_id', p_sessao_id)
  );

  RETURN jsonb_build_object('success', true, 'emprestimo_id', p_emprestimo_id, 'cliente_id', v_emp.cliente_id, 'status', v_status);
END;
$$;

CREATE OR REPLACE FUNCTION public.gsa_admin_emprestimo_atualizar_documento(
  p_sessao_id uuid,
  p_session_token text,
  p_documento_id uuid,
  p_status text,
  p_motivo text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_actor record;
  v_doc emprestimo_documentos%rowtype;
  v_emp emprestimos%rowtype;
  v_status text := lower(trim(coalesce(p_status, '')));
  v_motivo text := nullif(trim(coalesce(p_motivo, '')), '');
BEGIN
  IF v_status NOT IN ('aprovado', 'rejeitado') THEN
    RAISE EXCEPTION 'Status de documento invalido.';
  END IF;
  IF v_status = 'rejeitado' AND v_motivo IS NULL THEN
    RAISE EXCEPTION 'Motivo da rejeicao e obrigatorio.';
  END IF;

  SELECT * INTO v_actor FROM public.gsa_admin_session_actor(p_sessao_id, p_session_token) LIMIT 1;

  SELECT * INTO v_doc
  FROM public.emprestimo_documentos
  WHERE id = p_documento_id
  FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Documento de emprestimo nao encontrado.'; END IF;

  SELECT * INTO v_emp
  FROM public.emprestimos
  WHERE id = v_doc.emprestimo_id
  FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Emprestimo do documento nao encontrado.'; END IF;

  UPDATE public.emprestimo_documentos
     SET status = v_status,
         motivo_rejeicao = CASE WHEN v_status = 'rejeitado' THEN v_motivo ELSE NULL END
   WHERE id = p_documento_id;

  IF v_status = 'rejeitado' THEN
    UPDATE public.emprestimos
       SET status = 'pendencia_documentos',
           updated_at = now()
     WHERE id = v_emp.id;

    PERFORM public.gsa_admin_emprestimo_add_historico(
      v_emp.id,
      v_emp.orcamento_id,
      'pendencia_documentos',
      'Documento reprovado: ' || v_motivo || ' [POR: ' || v_actor.ator_nome || ']',
      'admin',
      NULL,
      jsonb_build_object('sessao_id', p_sessao_id, 'documento_id', p_documento_id)
    );
  END IF;

  RETURN jsonb_build_object(
    'success', true,
    'documento_id', p_documento_id,
    'emprestimo_id', v_emp.id,
    'cliente_id', v_emp.cliente_id,
    'status', v_status,
    'motivo', v_motivo
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.gsa_admin_emprestimo_enviar_oferta_quitacao(
  p_sessao_id uuid,
  p_session_token text,
  p_emprestimo_id uuid,
  p_valor_quitacao_acordo numeric
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_actor record;
  v_emp emprestimos%rowtype;
  v_valor numeric := round(coalesce(p_valor_quitacao_acordo, 0), 2);
BEGIN
  IF v_valor <= 0 THEN RAISE EXCEPTION 'Valor da quitacao deve ser maior que zero.'; END IF;
  SELECT * INTO v_actor FROM public.gsa_admin_session_actor(p_sessao_id, p_session_token) LIMIT 1;

  SELECT * INTO v_emp FROM public.emprestimos WHERE id = p_emprestimo_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Emprestimo nao encontrado.'; END IF;

  IF coalesce(v_emp.status, '') <> 'analise_quitacao' THEN
    RETURN jsonb_build_object('success', true, 'already_processed', true, 'emprestimo_id', p_emprestimo_id, 'cliente_id', v_emp.cliente_id, 'status', v_emp.status);
  END IF;

  UPDATE public.emprestimos
     SET status = 'aguardando_pagamento_quitacao',
         valor_quitacao_acordo = v_valor,
         updated_at = now()
   WHERE id = p_emprestimo_id;

  PERFORM public.gsa_admin_emprestimo_add_historico(
    p_emprestimo_id,
    v_emp.orcamento_id,
    'oferta_quitacao',
    'Oferta de quitacao: R$ ' || to_char(v_valor, 'FM999999999990D00') || ' [POR: ' || v_actor.ator_nome || ']',
    'admin',
    NULL,
    jsonb_build_object('sessao_id', p_sessao_id)
  );

  RETURN jsonb_build_object('success', true, 'already_processed', false, 'emprestimo_id', p_emprestimo_id, 'cliente_id', v_emp.cliente_id, 'valor_quitacao_acordo', v_valor);
END;
$$;

GRANT EXECUTE ON FUNCTION public.gsa_admin_emprestimo_salvar_observacao(uuid, text, uuid, text) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.gsa_admin_emprestimo_enviar_comentario(uuid, text, uuid, uuid, text) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.gsa_admin_emprestimo_enviar_proposta(uuid, text, uuid, numeric, numeric, integer, numeric, text, integer) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.gsa_admin_emprestimo_enviar_contrato(uuid, text, uuid, text) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.gsa_admin_emprestimo_aprovar(uuid, text, uuid) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.gsa_admin_emprestimo_atualizar_status(uuid, text, uuid, text, text) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.gsa_admin_emprestimo_atualizar_documento(uuid, text, uuid, text, text) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.gsa_admin_emprestimo_enviar_oferta_quitacao(uuid, text, uuid, numeric) TO anon, authenticated;
