-- Resolve os achados da auditoria final do Painel do Cliente.
-- Recuperação com prova de posse do e-mail, leituras individuais, escrita operacional
-- vinculada à sessão, Storage estrito, proteção de tickets e rate limiting de notificações.

CREATE TABLE IF NOT EXISTS public.gsa_client_recovery_challenges (
  id UUID PRIMARY KEY,
  cliente_id UUID NOT NULL REFERENCES public.clientes(id) ON DELETE CASCADE,
  documento TEXT NOT NULL,
  auth_email TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expires_at TIMESTAMPTZ NOT NULL DEFAULT (NOW() + INTERVAL '10 minutes'),
  consumed_at TIMESTAMPTZ
);
ALTER TABLE public.gsa_client_recovery_challenges ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.gsa_client_recovery_challenges FROM PUBLIC, anon, authenticated;
CREATE INDEX IF NOT EXISTS idx_gsa_client_recovery_challenges_active
ON public.gsa_client_recovery_challenges (auth_email, expires_at)
WHERE consumed_at IS NULL;

CREATE OR REPLACE FUNCTION public.gsa_begin_client_recovery(
  p_documento TEXT,
  p_email TEXT,
  p_challenge_id UUID
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO public, pg_temp
AS $$
DECLARE
  v_cliente_id UUID;
  v_documento TEXT := regexp_replace(COALESCE(p_documento, ''), '\D', '', 'g');
  v_email TEXT := lower(trim(COALESCE(p_email, '')));
BEGIN
  DELETE FROM public.gsa_client_recovery_challenges
  WHERE expires_at < NOW() OR consumed_at IS NOT NULL;

  SELECT c.id INTO v_cliente_id
  FROM public.clientes c
  WHERE (
      regexp_replace(COALESCE(c.cpf, ''), '\D', '', 'g') = v_documento
      OR regexp_replace(COALESCE(c.cnpj, ''), '\D', '', 'g') = v_documento
    )
    AND lower(trim(COALESCE(c.email, ''))) = v_email
    AND NOT public.gsa_client_record_is_blocked(to_jsonb(c))
  LIMIT 1;

  IF v_cliente_id IS NULL THEN
    RETURN jsonb_build_object('success', false);
  END IF;

  UPDATE public.gsa_client_recovery_challenges
  SET consumed_at = NOW()
  WHERE cliente_id = v_cliente_id AND consumed_at IS NULL;

  INSERT INTO public.gsa_client_recovery_challenges (id, cliente_id, documento, auth_email)
  VALUES (p_challenge_id, v_cliente_id, v_documento, v_email);

  RETURN jsonb_build_object('success', true);
END;
$$;
REVOKE ALL ON FUNCTION public.gsa_begin_client_recovery(TEXT, TEXT, UUID) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.gsa_begin_client_recovery(TEXT, TEXT, UUID) TO service_role;

CREATE TABLE IF NOT EXISTS public.notificacao_leituras (
  notificacao_id UUID NOT NULL REFERENCES public.notificacoes(id) ON DELETE CASCADE,
  ator_tipo TEXT NOT NULL CHECK (ator_tipo IN ('cliente', 'prestador', 'colaborador')),
  ator_id UUID NOT NULL,
  lida_em TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (notificacao_id, ator_tipo, ator_id)
);
ALTER TABLE public.notificacao_leituras ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.notificacao_leituras FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.gsa_client_mark_notification_read(
  p_sessao_id UUID,
  p_session_token TEXT,
  p_notification_id UUID
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO public, pg_temp
AS $$
DECLARE
  v_cliente_id UUID;
  v_notificacao public.notificacoes%ROWTYPE;
BEGIN
  SELECT actor.cliente_id INTO v_cliente_id
  FROM public.gsa_client_session_actor(p_sessao_id, p_session_token) actor
  LIMIT 1;
  IF v_cliente_id IS NULL THEN RAISE EXCEPTION 'Sessão de cliente inválida.'; END IF;

  SELECT * INTO v_notificacao
  FROM public.notificacoes
  WHERE id = p_notification_id
    AND (cliente_id = v_cliente_id OR destinatario_tipo IN ('broadcast_clientes', 'broadcast_todos'))
  LIMIT 1;
  IF NOT FOUND THEN RAISE EXCEPTION 'Notificação não encontrada para este cliente.'; END IF;

  IF v_notificacao.cliente_id = v_cliente_id THEN
    UPDATE public.notificacoes SET lida = true
    WHERE id = p_notification_id AND cliente_id = v_cliente_id;
  ELSE
    INSERT INTO public.notificacao_leituras (notificacao_id, ator_tipo, ator_id)
    VALUES (p_notification_id, 'cliente', v_cliente_id)
    ON CONFLICT (notificacao_id, ator_tipo, ator_id) DO UPDATE SET lida_em = NOW();
  END IF;
  RETURN jsonb_build_object('success', true);
END;
$$;

CREATE OR REPLACE FUNCTION public.gsa_client_get_notification_read_ids(
  p_sessao_id UUID,
  p_session_token TEXT,
  p_notification_ids UUID[]
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO public, pg_temp
AS $$
DECLARE
  v_cliente_id UUID;
  v_ids JSONB;
BEGIN
  SELECT actor.cliente_id INTO v_cliente_id
  FROM public.gsa_client_session_actor(p_sessao_id, p_session_token) actor
  LIMIT 1;
  IF v_cliente_id IS NULL THEN RAISE EXCEPTION 'Sessão de cliente inválida.'; END IF;

  SELECT COALESCE(jsonb_agg(l.notificacao_id), '[]'::jsonb) INTO v_ids
  FROM public.notificacao_leituras l
  JOIN public.notificacoes n ON n.id = l.notificacao_id
  WHERE l.ator_tipo = 'cliente'
    AND l.ator_id = v_cliente_id
    AND l.notificacao_id = ANY(COALESCE(p_notification_ids, ARRAY[]::UUID[]))
    AND n.destinatario_tipo IN ('broadcast_clientes', 'broadcast_todos');
  RETURN jsonb_build_object('success', true, 'ids', v_ids);
END;
$$;
REVOKE ALL ON FUNCTION public.gsa_client_mark_notification_read(UUID, TEXT, UUID) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.gsa_client_get_notification_read_ids(UUID, TEXT, UUID[]) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.gsa_client_mark_notification_read(UUID, TEXT, UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.gsa_client_get_notification_read_ids(UUID, TEXT, UUID[]) TO authenticated;

CREATE OR REPLACE FUNCTION public.gsa_jsonb_pick(p_data JSONB, p_keys TEXT[])
RETURNS JSONB
LANGUAGE sql
IMMUTABLE
SET search_path TO public, pg_temp
AS $$
  SELECT COALESCE(jsonb_object_agg(entry.key, entry.value), '{}'::JSONB)
  FROM jsonb_each(COALESCE(p_data, '{}'::JSONB)) entry
  WHERE entry.key = ANY(COALESCE(p_keys, ARRAY[]::TEXT[]));
$$;
REVOKE ALL ON FUNCTION public.gsa_jsonb_pick(JSONB, TEXT[]) FROM PUBLIC, anon, authenticated;

-- Executor privado. Toda chamada externa passa obrigatoriamente pela função de sessão abaixo.
CREATE OR REPLACE FUNCTION public.cliente_operational_write(
  p_cliente_id UUID,
  p_table TEXT,
  p_action TEXT,
  p_data JSONB DEFAULT '{}'::JSONB,
  p_filter JSONB DEFAULT '{}'::JSONB
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO public, pg_temp
AS $$
DECLARE
  v_allowed CONSTANT TEXT[] := ARRAY[
    'clientes', 'tickets', 'ticket_mensagens', 'cliente_documentos',
    'loja_carrinhos', 'cupons_ativados', 'cliente_promocoes',
    'promocoes_quantidade_ativadas', 'loja_solicitacoes', 'loja_avaliacoes',
    'cliente_premios', 'emprestimos', 'emprestimo_documentos',
    'emprestimo_historico', 'emprestimo_comentarios', 'orcamentos',
    'loja_credito_solicitacoes', 'loja_credito_documentos', 'indicacoes',
    'vouchers', 'ordens_servico', 'os_notas', 'os_suporte_mensagens',
    'fatura_contestacoes'
  ];
  v_table TEXT := lower(trim(p_table));
  v_action TEXT := lower(trim(p_action));
  v_data JSONB := COALESCE(p_data, '{}'::JSONB);
  v_filter JSONB := COALESCE(p_filter, '{}'::JSONB);
  v_sql TEXT;
  v_cols TEXT;
  v_vals TEXT;
  v_sets TEXT;
  v_where TEXT := '';
  v_result JSONB;
  v_has_cliente_id BOOLEAN;
  v_key TEXT;
  v_value JSONB;
  v_idx INTEGER := 0;
BEGIN
  IF p_cliente_id IS NULL THEN RAISE EXCEPTION 'Cliente obrigatório.'; END IF;
  IF NOT (v_table = ANY(v_allowed)) THEN RAISE EXCEPTION 'Tabela não permitida: %', v_table; END IF;
  IF v_action NOT IN ('insert', 'update', 'delete') THEN RAISE EXCEPTION 'Ação não permitida: %', v_action; END IF;

  SELECT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = v_table AND column_name = 'cliente_id'
  ) INTO v_has_cliente_id;

  IF v_table = 'clientes' THEN
    v_filter := v_filter || jsonb_build_object('id', p_cliente_id);
  ELSIF v_has_cliente_id THEN
    v_data := v_data || jsonb_build_object('cliente_id', p_cliente_id);
    v_filter := v_filter || jsonb_build_object('cliente_id', p_cliente_id);
  END IF;

  IF v_action = 'insert' THEN
    SELECT string_agg(format('%I', key), ', '), string_agg(format('%L', value #>> '{}'), ', ')
      INTO v_cols, v_vals
    FROM jsonb_each(v_data)
    WHERE value IS NOT NULL AND value <> 'null'::JSONB;
    IF v_cols IS NULL THEN RAISE EXCEPTION 'Dados obrigatórios para inserção.'; END IF;
    v_sql := format('INSERT INTO public.%I (%s) VALUES (%s) RETURNING to_jsonb(%I.*)', v_table, v_cols, v_vals, v_table);
    EXECUTE v_sql INTO v_result;
    RETURN jsonb_build_object('success', true, 'data', v_result);
  END IF;

  FOR v_key, v_value IN SELECT key, value FROM jsonb_each(v_filter) LOOP
    v_idx := v_idx + 1;
    IF v_idx > 1 THEN v_where := v_where || ' AND '; END IF;
    v_where := v_where || format('%I = %L', v_key, v_value #>> '{}');
  END LOOP;
  IF v_where = '' THEN RAISE EXCEPTION 'Filtro obrigatório para update/delete.'; END IF;

  IF v_action = 'update' THEN
    SELECT string_agg(format('%I = %L', key, value #>> '{}'), ', ')
      INTO v_sets
    FROM jsonb_each(v_data)
    WHERE key <> 'cliente_id' AND value IS NOT NULL AND value <> 'null'::JSONB;
    IF v_sets IS NULL THEN RAISE EXCEPTION 'Dados obrigatórios para atualização.'; END IF;
    v_sql := format('UPDATE public.%I SET %s WHERE %s RETURNING to_jsonb(%I.*)', v_table, v_sets, v_where, v_table);
    EXECUTE v_sql INTO v_result;
    IF v_result IS NULL THEN RAISE EXCEPTION 'Registro não encontrado ou sem permissão.'; END IF;
    RETURN jsonb_build_object('success', true, 'data', v_result);
  END IF;

  v_sql := format('DELETE FROM public.%I WHERE %s RETURNING to_jsonb(%I.*)', v_table, v_where, v_table);
  EXECUTE v_sql INTO v_result;
  IF v_result IS NULL THEN RAISE EXCEPTION 'Registro não encontrado ou sem permissão.'; END IF;
  RETURN jsonb_build_object('success', true, 'data', v_result);
END;
$$;
REVOKE ALL ON FUNCTION public.cliente_operational_write(UUID, TEXT, TEXT, JSONB, JSONB) FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.gsa_client_operational_write(
  p_sessao_id UUID,
  p_session_token TEXT,
  p_table TEXT,
  p_action TEXT,
  p_data JSONB DEFAULT '{}'::JSONB,
  p_filter JSONB DEFAULT '{}'::JSONB
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO public, pg_temp
AS $$
DECLARE
  v_cliente_id UUID;
  v_table TEXT := lower(trim(COALESCE(p_table, '')));
  v_action TEXT := lower(trim(COALESCE(p_action, '')));
  v_data JSONB := COALESCE(p_data, '{}'::JSONB);
  v_filter JSONB := COALESCE(p_filter, '{}'::JSONB);
  v_related_id UUID;
  v_secondary_id UUID;
  v_has_cliente_id BOOLEAN;
  v_status TEXT;
  v_allowed_tables CONSTANT TEXT[] := ARRAY[
    'clientes', 'tickets', 'ticket_mensagens', 'cliente_documentos',
    'loja_carrinhos', 'cupons_ativados', 'cliente_promocoes',
    'promocoes_quantidade_ativadas', 'loja_solicitacoes', 'loja_avaliacoes',
    'cliente_premios', 'emprestimos', 'emprestimo_documentos',
    'emprestimo_historico', 'emprestimo_comentarios', 'orcamentos',
    'loja_credito_solicitacoes', 'loja_credito_documentos', 'indicacoes',
    'vouchers', 'ordens_servico', 'os_notas', 'os_suporte_mensagens',
    'fatura_contestacoes'
  ];
BEGIN
  SELECT actor.cliente_id INTO v_cliente_id
  FROM public.gsa_client_session_actor(p_sessao_id, p_session_token) actor
  LIMIT 1;
  IF v_cliente_id IS NULL THEN RAISE EXCEPTION 'Sessão de cliente inválida.'; END IF;
  IF NOT (v_table = ANY(v_allowed_tables)) THEN RAISE EXCEPTION 'Tabela não permitida para escrita do cliente.'; END IF;
  IF v_action NOT IN ('insert', 'update', 'delete') THEN RAISE EXCEPTION 'Operação não permitida.'; END IF;

  SELECT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = v_table AND column_name = 'cliente_id'
  ) INTO v_has_cliente_id;

  IF v_table = 'clientes' THEN
    IF v_action <> 'update' THEN RAISE EXCEPTION 'O cliente só pode atualizar os próprios dados cadastrais.'; END IF;
    v_filter := jsonb_build_object('id', v_cliente_id);
    v_data := public.gsa_jsonb_pick(v_data, ARRAY[
      'nome', 'cpf', 'cnpj', 'telefone', 'email', 'cep', 'endereco',
      'numero', 'bairro', 'cidade', 'estado', 'data_nascimento', 'observacoes'
    ]);

  ELSIF v_table = 'tickets' THEN
    IF v_action <> 'insert' THEN RAISE EXCEPTION 'Tickets do cliente só podem ser criados.'; END IF;
    v_data := public.gsa_jsonb_pick(v_data, ARRAY['assunto', 'descricao', 'categoria', 'prioridade', 'tipo'])
      || jsonb_build_object('cliente_id', v_cliente_id, 'status', 'aberto');

  ELSIF v_table = 'ticket_mensagens' THEN
    IF v_action <> 'insert' THEN RAISE EXCEPTION 'Mensagens de ticket só podem ser criadas.'; END IF;
    v_related_id := NULLIF(v_data ->> 'ticket_id', '')::UUID;
    IF v_related_id IS NULL OR NOT EXISTS (
      SELECT 1 FROM public.tickets t WHERE t.id = v_related_id AND t.cliente_id = v_cliente_id
    ) THEN RAISE EXCEPTION 'Ticket não pertence ao cliente autenticado.'; END IF;
    v_data := public.gsa_jsonb_pick(v_data, ARRAY[
      'ticket_id', 'autor_nome', 'mensagem', 'anexo_url', 'anexo_tipo', 'anexo_nome'
    ]) || jsonb_build_object('ticket_id', v_related_id, 'autor_id', v_cliente_id, 'tipo', 'cliente');

  ELSIF v_table = 'cliente_documentos' THEN
    IF v_action NOT IN ('update', 'delete') THEN RAISE EXCEPTION 'Operação inválida para documento cadastral.'; END IF;
    v_filter := v_filter || jsonb_build_object('cliente_id', v_cliente_id);
    IF v_action = 'update' THEN
      v_data := public.gsa_jsonb_pick(v_data, ARRAY['urls'])
        || jsonb_build_object('status', 'em_analise', 'motivo_rejeicao', NULL);
    END IF;

  ELSIF v_table = 'loja_credito_solicitacoes' THEN
    IF v_action = 'insert' THEN
      v_data := public.gsa_jsonb_pick(v_data, ARRAY['tipo_solicitacao', 'limite_solicitado'])
        || jsonb_build_object('cliente_id', v_cliente_id, 'status', 'analise');
    ELSIF v_action = 'update' THEN
      v_filter := v_filter || jsonb_build_object('cliente_id', v_cliente_id);
      v_status := COALESCE(v_data ->> 'status', '');
      IF v_status <> 'contrato_assinado' THEN RAISE EXCEPTION 'Transição de crédito não permitida.'; END IF;
      v_data := public.gsa_jsonb_pick(v_data, ARRAY['contrato_assinado_url', 'updated_at'])
        || jsonb_build_object('status', 'contrato_assinado');
    ELSE
      RAISE EXCEPTION 'Solicitação de crédito não pode ser excluída pelo cliente.';
    END IF;

  ELSIF v_table = 'loja_credito_documentos' THEN
    IF v_action <> 'update' THEN RAISE EXCEPTION 'Documento de crédito só pode ser reenviado.'; END IF;
    SELECT d.solicitacao_id INTO v_related_id
    FROM public.loja_credito_documentos d
    WHERE d.id = NULLIF(v_filter ->> 'id', '')::UUID;
    IF v_related_id IS NULL OR NOT EXISTS (
      SELECT 1 FROM public.loja_credito_solicitacoes s WHERE s.id = v_related_id AND s.cliente_id = v_cliente_id
    ) THEN RAISE EXCEPTION 'Documento de crédito não pertence ao cliente autenticado.'; END IF;
    v_data := public.gsa_jsonb_pick(v_data, ARRAY['arquivo_url', 'updated_at'])
      || jsonb_build_object('status', 'pendente');

  ELSIF v_table = 'emprestimos' THEN
    IF v_action = 'insert' THEN
      v_secondary_id := NULLIF(v_data ->> 'orcamento_id', '')::UUID;
      IF v_secondary_id IS NOT NULL AND NOT EXISTS (
        SELECT 1 FROM public.orcamentos o WHERE o.id = v_secondary_id AND o.cliente_id = v_cliente_id
      ) THEN RAISE EXCEPTION 'Orçamento do empréstimo não pertence ao cliente.'; END IF;
      v_data := public.gsa_jsonb_pick(v_data, ARRAY[
        'codigo_emprestimo', 'orcamento_id', 'valor_solicitado', 'parcelas_escolhidas'
      ]) || jsonb_build_object('cliente_id', v_cliente_id, 'status', 'analise_inicial');
    ELSIF v_action = 'update' THEN
      v_filter := v_filter || jsonb_build_object('cliente_id', v_cliente_id);
      v_status := COALESCE(v_data ->> 'status', '');
      IF v_status NOT IN ('analise_inicial', 'analise_final', 'analise_contrato', 'cancelado') THEN
        RAISE EXCEPTION 'Transição de empréstimo não permitida ao cliente.';
      END IF;
      v_data := public.gsa_jsonb_pick(v_data, ARRAY[
        'parcelas_escolhidas', 'valor_parcela', 'valor_total_financiado',
        'dados_bancarios', 'assinatura_url', 'data_assinatura', 'status'
      ]);
    ELSE
      RAISE EXCEPTION 'Empréstimo não pode ser excluído pelo cliente.';
    END IF;

  ELSIF v_table IN ('emprestimo_documentos', 'emprestimo_historico') THEN
    IF v_action NOT IN ('insert', 'update') THEN RAISE EXCEPTION 'Operação inválida para registro de empréstimo.'; END IF;
    v_related_id := NULLIF(v_data ->> 'emprestimo_id', '')::UUID;
    v_secondary_id := NULLIF(v_data ->> 'orcamento_id', '')::UUID;
    IF v_action = 'update' AND v_related_id IS NULL AND v_secondary_id IS NULL THEN
      IF v_table = 'emprestimo_documentos' THEN
        SELECT d.emprestimo_id, d.orcamento_id INTO v_related_id, v_secondary_id
        FROM public.emprestimo_documentos d WHERE d.id = NULLIF(v_filter ->> 'id', '')::UUID;
      ELSE
        SELECT h.emprestimo_id, h.orcamento_id INTO v_related_id, v_secondary_id
        FROM public.emprestimo_historico h WHERE h.id = NULLIF(v_filter ->> 'id', '')::UUID;
      END IF;
    END IF;
    IF NOT (
      (v_related_id IS NOT NULL AND EXISTS (SELECT 1 FROM public.emprestimos e WHERE e.id = v_related_id AND e.cliente_id = v_cliente_id))
      OR (v_secondary_id IS NOT NULL AND EXISTS (SELECT 1 FROM public.orcamentos o WHERE o.id = v_secondary_id AND o.cliente_id = v_cliente_id))
    ) THEN RAISE EXCEPTION 'Registro de empréstimo não pertence ao cliente.'; END IF;
    IF v_table = 'emprestimo_documentos' THEN
      v_data := public.gsa_jsonb_pick(v_data, ARRAY[
        'emprestimo_id', 'orcamento_id', 'tipo', 'nome', 'url', 'status', 'motivo_rejeicao'
      ]);
      IF v_action = 'insert' THEN v_data := v_data || jsonb_build_object('status', 'enviado');
      ELSE v_data := v_data || jsonb_build_object('status', 'reenviado', 'motivo_rejeicao', NULL); END IF;
    ELSE
      IF v_action <> 'insert' THEN RAISE EXCEPTION 'Histórico de empréstimo é somente inclusão.'; END IF;
      v_data := public.gsa_jsonb_pick(v_data, ARRAY['emprestimo_id', 'orcamento_id', 'tipo_acao', 'descricao'])
        || jsonb_build_object('usuario_tipo', 'cliente', 'usuario_id', v_cliente_id);
    END IF;

  ELSIF v_table = 'emprestimo_comentarios' THEN
    IF v_action <> 'insert' THEN RAISE EXCEPTION 'Comentário de empréstimo é somente inclusão.'; END IF;
    v_related_id := NULLIF(v_data ->> 'emprestimo_id', '')::UUID;
    IF v_related_id IS NULL OR NOT EXISTS (
      SELECT 1 FROM public.emprestimos e WHERE e.id = v_related_id AND e.cliente_id = v_cliente_id
    ) THEN RAISE EXCEPTION 'Empréstimo não pertence ao cliente autenticado.'; END IF;
    v_data := public.gsa_jsonb_pick(v_data, ARRAY['emprestimo_id', 'mensagem'])
      || jsonb_build_object('autor_tipo', 'cliente', 'autor_id', v_cliente_id);

  ELSIF v_table = 'orcamentos' THEN
    IF v_action = 'insert' THEN
      -- Campos administrativos e financeiros finais nunca são aceitos da interface.
      v_data := v_data - ARRAY[
        'id', 'cliente_id', 'valor_adicional', 'descricao_adicional', 'acrescimo',
        'valor_final_pendente', 'status_pagamento', 'resposta_admin', 'aprovado_por',
        'data_aprovacao', 'data_conclusao', 'fatura_id', 'prestador_id'
      ]::TEXT[];
      v_data := v_data || jsonb_build_object('cliente_id', v_cliente_id);
      IF NOT (v_data ? 'status') THEN v_data := v_data || jsonb_build_object('status', 'aberto'); END IF;
      IF v_data ->> 'status' NOT IN ('aberto', 'pendente') THEN RAISE EXCEPTION 'Status inicial do orçamento inválido.'; END IF;
    ELSIF v_action = 'update' THEN
      v_filter := v_filter || jsonb_build_object('cliente_id', v_cliente_id);
      v_status := COALESCE(v_data ->> 'status', '');
      IF v_status NOT IN ('em revisão', 'negociação', 'cancelado') THEN RAISE EXCEPTION 'Transição de orçamento não permitida.'; END IF;
      v_data := public.gsa_jsonb_pick(v_data, ARRAY[
        'status', 'anexos', 'documentos_solicitados', 'desconto_solicitado_porcentagem',
        'motivo_desconto', 'fase_negociacao', 'comprovante_concorrente_urls'
      ]);
      IF v_status = 'negociação' THEN v_data := v_data || jsonb_build_object('fase_negociacao', 'admin'); END IF;
    ELSE
      RAISE EXCEPTION 'Orçamento não pode ser excluído pelo cliente.';
    END IF;

  ELSIF v_table = 'ordens_servico' THEN
    IF v_action <> 'update' THEN RAISE EXCEPTION 'Ordem de serviço só pode receber documentos.'; END IF;
    v_filter := v_filter || jsonb_build_object('cliente_id', v_cliente_id);
    v_data := public.gsa_jsonb_pick(v_data, ARRAY['anexos_os', 'documentos_solicitados_os']);

  ELSIF v_table IN ('os_notas', 'os_suporte_mensagens') THEN
    IF v_action <> 'insert' THEN RAISE EXCEPTION 'Registros de suporte da OS são somente inclusão.'; END IF;
    v_related_id := NULLIF(v_data ->> 'os_id', '')::UUID;
    IF v_related_id IS NULL OR NOT EXISTS (
      SELECT 1 FROM public.ordens_servico os WHERE os.id = v_related_id AND os.cliente_id = v_cliente_id
    ) THEN RAISE EXCEPTION 'Ordem de serviço não pertence ao cliente.'; END IF;
    IF v_table = 'os_notas' THEN
      v_data := public.gsa_jsonb_pick(v_data, ARRAY['os_id', 'nota']);
    ELSE
      v_data := public.gsa_jsonb_pick(v_data, ARRAY['os_id', 'mensagem'])
        || jsonb_build_object('remetente_tipo', 'cliente', 'remetente_id', v_cliente_id, 'lida', false);
    END IF;

  ELSIF v_table = 'fatura_contestacoes' THEN
    IF v_action <> 'insert' THEN RAISE EXCEPTION 'Contestação de fatura é somente inclusão.'; END IF;
    v_related_id := NULLIF(v_data ->> 'fatura_id', '')::UUID;
    IF v_related_id IS NULL OR NOT EXISTS (
      SELECT 1 FROM public.faturas f WHERE f.id = v_related_id AND f.cliente_id = v_cliente_id
    ) THEN RAISE EXCEPTION 'Fatura não pertence ao cliente.'; END IF;
    v_data := public.gsa_jsonb_pick(v_data, ARRAY['fatura_id', 'motivo', 'descricao'])
      || jsonb_build_object('status', 'aberta');
    IF v_has_cliente_id THEN v_data := v_data || jsonb_build_object('cliente_id', v_cliente_id); END IF;

  ELSIF v_table = 'loja_solicitacoes' THEN
    IF v_action <> 'insert' THEN RAISE EXCEPTION 'Solicitação de troca/devolução é somente inclusão.'; END IF;
    v_related_id := NULLIF(v_data ->> 'orcamento_origem_id', '')::UUID;
    IF v_related_id IS NULL OR NOT EXISTS (
      SELECT 1 FROM public.orcamentos o WHERE o.id = v_related_id AND o.cliente_id = v_cliente_id
    ) THEN RAISE EXCEPTION 'Pedido de origem não pertence ao cliente.'; END IF;
    v_data := public.gsa_jsonb_pick(v_data, ARRAY[
      'codigo_solicitacao', 'orcamento_origem_id', 'tipo', 'motivo', 'descricao_detalhada', 'imagens_anexo'
    ]) || jsonb_build_object('cliente_id', v_cliente_id, 'status', 'em_analise');

  ELSIF v_table = 'loja_avaliacoes' THEN
    IF v_action <> 'insert' THEN RAISE EXCEPTION 'Avaliação é somente inclusão.'; END IF;
    v_related_id := NULLIF(v_data ->> 'produto_id', '')::UUID;
    IF v_related_id IS NULL OR NOT EXISTS (
      SELECT 1 FROM public.orcamentos o
      WHERE o.cliente_id = v_cliente_id AND o.produto_id = v_related_id
    ) THEN RAISE EXCEPTION 'Produto não foi encontrado nos pedidos do cliente.'; END IF;
    IF COALESCE((v_data ->> 'nota')::INTEGER, 0) NOT BETWEEN 1 AND 5 THEN RAISE EXCEPTION 'Nota da avaliação inválida.'; END IF;
    v_data := public.gsa_jsonb_pick(v_data, ARRAY['produto_id', 'nota', 'comentario'])
      || jsonb_build_object('cliente_id', v_cliente_id);

  ELSIF v_table = 'cliente_premios' THEN
    IF v_action <> 'update' THEN RAISE EXCEPTION 'Prêmio do cliente só pode ser resgatado ou expirado.'; END IF;
    v_filter := v_filter || jsonb_build_object('cliente_id', v_cliente_id);
    v_status := COALESCE(v_data ->> 'status', '');
    IF v_status NOT IN ('resgatado', 'cancelado') THEN RAISE EXCEPTION 'Status de prêmio inválido.'; END IF;
    v_data := public.gsa_jsonb_pick(v_data, ARRAY['status', 'data_resgate', 'data_cancelamento', 'motivo_cancelamento']);

  ELSIF v_table = 'loja_carrinhos' THEN
    IF v_action NOT IN ('insert', 'update', 'delete') THEN RAISE EXCEPTION 'Operação de carrinho inválida.'; END IF;
    IF v_action = 'insert' THEN
      v_data := public.gsa_jsonb_pick(v_data, ARRAY['item_id', 'tipo', 'quantidade', 'prazo_meses', 'updated_at'])
        || jsonb_build_object('cliente_id', v_cliente_id);
    ELSE
      v_filter := v_filter || jsonb_build_object('cliente_id', v_cliente_id);
      IF v_action = 'update' THEN v_data := public.gsa_jsonb_pick(v_data, ARRAY['quantidade', 'prazo_meses', 'updated_at']); END IF;
    END IF;

  ELSIF v_table = 'cupons_ativados' THEN
    IF v_action <> 'insert' THEN RAISE EXCEPTION 'Cupom ativado é somente inclusão.'; END IF;
    v_data := public.gsa_jsonb_pick(v_data, ARRAY['cupom_id']) || jsonb_build_object('cliente_id', v_cliente_id);

  ELSIF v_table = 'promocoes_quantidade_ativadas' THEN
    IF v_action <> 'insert' THEN RAISE EXCEPTION 'Promoção por quantidade é somente ativação.'; END IF;
    v_data := public.gsa_jsonb_pick(v_data, ARRAY['promocao_quantidade_id']) || jsonb_build_object('cliente_id', v_cliente_id);

  ELSIF v_table = 'cliente_promocoes' THEN
    IF v_action = 'insert' THEN
      v_data := public.gsa_jsonb_pick(v_data, ARRAY['promocao_id', 'data_ativacao', 'data_expiracao'])
        || jsonb_build_object('cliente_id', v_cliente_id, 'status', 'ativa');
    ELSIF v_action = 'update' THEN
      v_filter := v_filter || jsonb_build_object('cliente_id', v_cliente_id);
      v_data := public.gsa_jsonb_pick(v_data, ARRAY['status', 'motivo_cancelamento', 'data_cancelamento', 'visualizado']);
      IF v_data ? 'status' AND v_data ->> 'status' <> 'cancelado' THEN RAISE EXCEPTION 'Transição de promoção inválida.'; END IF;
    ELSE
      RAISE EXCEPTION 'Promoção do cliente não pode ser excluída.';
    END IF;

  ELSIF v_table = 'indicacoes' THEN
    IF v_action = 'insert' THEN
      v_data := public.gsa_jsonb_pick(v_data, ARRAY[
        'indicado_nome', 'whatsapp_indicado', 'data_indicacao', 'voucher_id'
      ]) || jsonb_build_object(
        'indicador_id', v_cliente_id,
        'bonus_indicador', 0,
        'bonus_indicado', 0,
        'status', 'aberta'
      );
    ELSIF v_action = 'update' THEN
      v_filter := v_filter || jsonb_build_object('indicador_id', v_cliente_id);
      v_data := jsonb_build_object('status', 'cancelada');
    ELSE
      RAISE EXCEPTION 'Indicação não pode ser excluída.';
    END IF;

  ELSIF v_table = 'vouchers' THEN
    IF v_action <> 'insert' THEN RAISE EXCEPTION 'Voucher de indicação é somente inclusão.'; END IF;
    -- O valor do benefício não é aceito do navegador; o backend usa zero até a conversão administrativa.
    v_data := public.gsa_jsonb_pick(v_data, ARRAY['codigo_voucher', 'validade', 'uso_unico', 'descricao'])
      || jsonb_build_object(
        'cliente_id', v_cliente_id,
        'tipo_desconto', 'porcentagem',
        'valor_desconto', 0,
        'status', 'ativo'
      );

  ELSE
    RAISE EXCEPTION 'Tabela sem política operacional específica.';
  END IF;

  RETURN public.cliente_operational_write(v_cliente_id, v_table, v_action, v_data, v_filter);
END;
$$;
REVOKE ALL ON FUNCTION public.gsa_client_operational_write(UUID, TEXT, TEXT, TEXT, JSONB, JSONB) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.gsa_client_operational_write(UUID, TEXT, TEXT, TEXT, JSONB, JSONB) TO authenticated;

DO $$
DECLARE fn RECORD;
BEGIN
  FOR fn IN
    SELECT n.nspname, p.proname, pg_get_function_identity_arguments(p.oid) AS args
    FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public' AND p.proname = 'cliente_operational_write'
  LOOP
    EXECUTE format('REVOKE ALL ON FUNCTION %I.%I(%s) FROM PUBLIC, anon, authenticated', fn.nspname, fn.proname, fn.args);
  END LOOP;
END;
$$;

CREATE OR REPLACE FUNCTION public.gsa_guard_client_sensitive_profile_fields()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO public, pg_temp
AS $$
BEGIN
  IF public.gsa_jwt_actor_type() = 'cliente'
     AND COALESCE(current_setting('gsa.credit_release', true), '') <> 'on'
     AND (
       to_jsonb(NEW) -> 'status' IS DISTINCT FROM to_jsonb(OLD) -> 'status'
       OR to_jsonb(NEW) -> 'cadastro_aprovado' IS DISTINCT FROM to_jsonb(OLD) -> 'cadastro_aprovado'
       OR to_jsonb(NEW) -> 'bloqueado' IS DISTINCT FROM to_jsonb(OLD) -> 'bloqueado'
       OR to_jsonb(NEW) -> 'saldo_carteira' IS DISTINCT FROM to_jsonb(OLD) -> 'saldo_carteira'
       OR to_jsonb(NEW) -> 'pontos_totais' IS DISTINCT FROM to_jsonb(OLD) -> 'pontos_totais'
       OR to_jsonb(NEW) -> 'saldo_pontos' IS DISTINCT FROM to_jsonb(OLD) -> 'saldo_pontos'
       OR to_jsonb(NEW) -> 'carteira_bloqueada' IS DISTINCT FROM to_jsonb(OLD) -> 'carteira_bloqueada'
       OR to_jsonb(NEW) -> 'saque_liberado_manual' IS DISTINCT FROM to_jsonb(OLD) -> 'saque_liberado_manual'
       OR to_jsonb(NEW) -> 'nivel_id' IS DISTINCT FROM to_jsonb(OLD) -> 'nivel_id'
       OR to_jsonb(NEW) -> 'nivel_manual_id' IS DISTINCT FROM to_jsonb(OLD) -> 'nivel_manual_id'
     ) THEN
    RAISE EXCEPTION 'Campos administrativos e financeiros não podem ser alterados pelo cliente.';
  END IF;
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS trg_gsa_guard_client_sensitive_profile_fields ON public.clientes;
CREATE TRIGGER trg_gsa_guard_client_sensitive_profile_fields
BEFORE UPDATE ON public.clientes
FOR EACH ROW EXECUTE FUNCTION public.gsa_guard_client_sensitive_profile_fields();
REVOKE ALL ON FUNCTION public.gsa_guard_client_sensitive_profile_fields() FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.gsa_guard_duplicate_active_client_ticket()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO public, pg_temp
AS $$
DECLARE v_actor_id UUID;
BEGIN
  IF public.gsa_jwt_actor_type() <> 'cliente' THEN RETURN NEW; END IF;
  v_actor_id := public.gsa_jwt_actor_id();
  IF v_actor_id IS NULL THEN RAISE EXCEPTION 'Sessão de cliente inválida.'; END IF;
  NEW.cliente_id := v_actor_id;
  PERFORM pg_advisory_xact_lock(hashtextextended(v_actor_id::TEXT || ':' || lower(trim(COALESCE(NEW.assunto, ''))), 0));
  IF EXISTS (
    SELECT 1 FROM public.tickets t
    WHERE t.cliente_id = v_actor_id
      AND lower(trim(COALESCE(t.assunto, ''))) = lower(trim(COALESCE(NEW.assunto, '')))
      AND lower(COALESCE(t.status, '')) NOT IN ('concluido', 'fechado', 'cancelado')
  ) THEN RAISE EXCEPTION 'Já existe um ticket ativo para este assunto.'; END IF;
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS trg_gsa_guard_duplicate_active_client_ticket ON public.tickets;
CREATE TRIGGER trg_gsa_guard_duplicate_active_client_ticket
BEFORE INSERT ON public.tickets
FOR EACH ROW EXECUTE FUNCTION public.gsa_guard_duplicate_active_client_ticket();
REVOKE ALL ON FUNCTION public.gsa_guard_duplicate_active_client_ticket() FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.gsa_guard_client_notification_insert()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO public, pg_temp
AS $$
DECLARE
  v_actor_type TEXT;
  v_actor_id UUID;
  v_recent_count INTEGER;
  v_allowed_admin_actions CONSTANT TEXT[] := ARRAY[
    'ticket_aberto_cliente', 'ticket_mensagem_cliente_adm', 'documento_enviado_cliente',
    'comprovante_enviado', 'premio_resgate_solicitado', 'voucher_resgate_solicitado',
    'assinatura_cancelamento_solicitado', 'orcamento_criado', 'orcamento_negociacao',
    'ticket_aberto', 'ticket_mensagem_cliente', 'saque_solicitado',
    'transferencia_solicitada', 'cadastro_novo_cliente', 'exclusao_solicitada',
    'os_documento_enviado', 'emprestimo_comentario', 'emprestimo_aceito',
    'emprestimo_assinado', 'quitacao', 'emprestimo_criado',
    'documento_cliente_enviado', 'sistema'
  ];
BEGIN
  v_actor_type := public.gsa_jwt_actor_type();
  v_actor_id := public.gsa_jwt_actor_id();
  IF v_actor_type <> 'cliente' THEN RETURN NEW; END IF;
  IF v_actor_id IS NULL THEN RAISE EXCEPTION 'Sessão de cliente inválida para criar notificação.'; END IF;

  NEW.titulo := left(trim(COALESCE(NEW.titulo, '')), 160);
  NEW.mensagem := left(trim(COALESCE(NEW.mensagem, '')), 2000);
  NEW.modulo := left(trim(COALESCE(NEW.modulo, 'sistema')), 80);
  NEW.contexto := COALESCE(NEW.contexto, '{}'::JSONB) || jsonb_build_object('actor_id', v_actor_id, 'actor_type', 'cliente');
  IF NEW.titulo = '' OR NEW.mensagem = '' THEN RAISE EXCEPTION 'Título e mensagem são obrigatórios.'; END IF;

  SELECT count(*) INTO v_recent_count
  FROM public.notificacoes n
  WHERE n.data_criacao >= NOW() - INTERVAL '1 minute'
    AND n.contexto ->> 'actor_id' = v_actor_id::TEXT;
  IF v_recent_count >= 20 THEN RAISE EXCEPTION 'Limite de notificações excedido. Aguarde antes de tentar novamente.'; END IF;

  IF NEW.destinatario_tipo IS NULL AND NEW.cliente_id = v_actor_id THEN NEW.destinatario_tipo := 'cliente'; END IF;
  IF NEW.destinatario_tipo = 'cliente' THEN
    IF NEW.cliente_id IS DISTINCT FROM v_actor_id OR NEW.prestador_id IS NOT NULL OR NEW.colaborador_id IS NOT NULL THEN
      RAISE EXCEPTION 'Cliente não pode criar notificação para outro usuário.';
    END IF;
  ELSIF NEW.destinatario_tipo = 'admin' THEN
    IF NEW.cliente_id IS NOT NULL OR NEW.prestador_id IS NOT NULL OR NEW.colaborador_id IS NOT NULL THEN
      RAISE EXCEPTION 'Notificação administrativa do cliente possui destinatário inválido.';
    END IF;
    IF COALESCE(NEW.acao_origem, 'sistema') <> ALL(v_allowed_admin_actions) THEN
      RAISE EXCEPTION 'Ação de notificação administrativa não permitida.';
    END IF;
    NEW.prioridade := CASE WHEN NEW.prioridade = 'alta' THEN 'alta' ELSE 'normal' END;
  ELSE
    RAISE EXCEPTION 'Tipo de destinatário não permitido para sessão de cliente.';
  END IF;
  NEW.tipo := COALESCE(NULLIF(NEW.tipo, ''), 'sistema');
  NEW.lida := false;
  NEW.data_criacao := COALESCE(NEW.data_criacao, NOW());
  RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION public.gsa_guard_client_notification_insert() FROM PUBLIC, anon, authenticated;

UPDATE storage.buckets
SET public = false,
    file_size_limit = 10485760,
    allowed_mime_types = ARRAY[
      'application/pdf', 'image/jpeg', 'image/png', 'image/webp', 'image/gif',
      'text/plain', 'application/msword',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'application/vnd.ms-excel',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
    ]
WHERE id = 'documentos_cliente';

DROP POLICY IF EXISTS "GSA acessa documentos privados do cliente" ON storage.objects;
DROP POLICY IF EXISTS "GSA envia documentos privados do cliente" ON storage.objects;
DROP POLICY IF EXISTS "GSA atualiza documentos privados do cliente" ON storage.objects;
DROP POLICY IF EXISTS "GSA exclui documentos privados do cliente" ON storage.objects;

CREATE POLICY "GSA acessa documentos privados do cliente" ON storage.objects
FOR SELECT TO authenticated USING (
  bucket_id = 'documentos_cliente' AND public.gsa_jwt_session_is_valid() AND (
    public.gsa_jwt_actor_type() IN ('admin', 'colaborador') OR (
      public.gsa_jwt_actor_type() IN ('cliente', 'prestador') AND (
        split_part(name, '/', 1) = public.gsa_jwt_actor_id()::TEXT OR (
          split_part(name, '/', 1) IN ('credito_documentos', 'credito_contratos', 'cliente_documentos', 'documentos', 'perfil', 'suporte', 'tickets')
          AND split_part(name, '/', 2) = public.gsa_jwt_actor_id()::TEXT
        )
      )
    )
  )
);

CREATE POLICY "GSA envia documentos privados do cliente" ON storage.objects
FOR INSERT TO authenticated WITH CHECK (
  bucket_id = 'documentos_cliente' AND public.gsa_jwt_session_is_valid() AND (
    public.gsa_jwt_actor_type() IN ('admin', 'colaborador') OR (
      public.gsa_jwt_actor_type() IN ('cliente', 'prestador') AND (
        split_part(name, '/', 1) = public.gsa_jwt_actor_id()::TEXT OR (
          split_part(name, '/', 1) IN ('credito_documentos', 'credito_contratos', 'cliente_documentos', 'documentos', 'perfil', 'suporte', 'tickets')
          AND split_part(name, '/', 2) = public.gsa_jwt_actor_id()::TEXT
        )
      )
    )
  )
);

CREATE POLICY "GSA atualiza documentos privados do cliente" ON storage.objects
FOR UPDATE TO authenticated USING (
  bucket_id = 'documentos_cliente' AND public.gsa_jwt_session_is_valid() AND (
    public.gsa_jwt_actor_type() IN ('admin', 'colaborador') OR split_part(name, '/', 1) = public.gsa_jwt_actor_id()::TEXT OR (
      split_part(name, '/', 1) IN ('credito_documentos', 'credito_contratos', 'cliente_documentos', 'documentos', 'perfil', 'suporte', 'tickets')
      AND split_part(name, '/', 2) = public.gsa_jwt_actor_id()::TEXT
    )
  )
) WITH CHECK (
  bucket_id = 'documentos_cliente' AND public.gsa_jwt_session_is_valid() AND (
    public.gsa_jwt_actor_type() IN ('admin', 'colaborador') OR split_part(name, '/', 1) = public.gsa_jwt_actor_id()::TEXT OR (
      split_part(name, '/', 1) IN ('credito_documentos', 'credito_contratos', 'cliente_documentos', 'documentos', 'perfil', 'suporte', 'tickets')
      AND split_part(name, '/', 2) = public.gsa_jwt_actor_id()::TEXT
    )
  )
);

CREATE POLICY "GSA exclui documentos privados do cliente" ON storage.objects
FOR DELETE TO authenticated USING (
  bucket_id = 'documentos_cliente' AND public.gsa_jwt_session_is_valid() AND (
    public.gsa_jwt_actor_type() IN ('admin', 'colaborador') OR split_part(name, '/', 1) = public.gsa_jwt_actor_id()::TEXT OR (
      split_part(name, '/', 1) IN ('credito_documentos', 'credito_contratos', 'cliente_documentos', 'documentos', 'perfil', 'suporte', 'tickets')
      AND split_part(name, '/', 2) = public.gsa_jwt_actor_id()::TEXT
    )
  )
);
