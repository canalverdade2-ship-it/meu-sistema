-- Migration: Persistência de Favoritos da Loja (loja_favoritos)
-- Permite que clientes autenticados salvem seus produtos favoritos diretamente no banco de dados.

-- 1. Garantir que a tabela loja_favoritos existe com a estrutura correta
CREATE TABLE IF NOT EXISTS public.loja_favoritos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  produto_id UUID REFERENCES public.produtos(id) ON DELETE CASCADE,
  cliente_id UUID REFERENCES public.clientes(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT now(),
  CONSTRAINT loja_favoritos_produto_id_cliente_id_key UNIQUE (produto_id, cliente_id)
);

CREATE INDEX IF NOT EXISTS idx_loja_favoritos_cliente_id ON public.loja_favoritos (cliente_id);
CREATE INDEX IF NOT EXISTS idx_loja_favoritos_produto_id ON public.loja_favoritos (produto_id);

-- 2. Atualizar cliente_operational_write para permitir loja_favoritos
CREATE OR REPLACE FUNCTION public.cliente_operational_write(
  p_cliente_id uuid,
  p_table text,
  p_action text,
  p_data jsonb DEFAULT '{}'::jsonb,
  p_filter jsonb DEFAULT '{}'::jsonb
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  v_allowed CONSTANT TEXT[] := ARRAY[
    'clientes', 'tickets', 'ticket_mensagens', 'cliente_documentos',
    'loja_carrinhos', 'loja_favoritos', 'cupons_ativados', 'cliente_promocoes',
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
$function$;

-- 3. Atualizar gsa_client_operational_write para incluir loja_favoritos
CREATE OR REPLACE FUNCTION public.gsa_client_operational_write(
  p_sessao_id uuid,
  p_session_token text,
  p_table text,
  p_action text,
  p_data jsonb DEFAULT '{}'::jsonb,
  p_filter jsonb DEFAULT '{}'::jsonb
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
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
    'loja_carrinhos', 'loja_favoritos', 'cupons_ativados', 'cliente_promocoes',
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
    v_data := public.gsa_jsonb_pick(v_data, ARRAY['assunto', 'descricao', 'categoria', 'prioridade', 'tipo', 'modulo'])
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

  ELSIF v_table = 'loja_favoritos' THEN
    IF v_action NOT IN ('insert', 'delete') THEN RAISE EXCEPTION 'Operação de favoritos inválida.'; END IF;
    IF v_action = 'insert' THEN
      v_data := public.gsa_jsonb_pick(v_data, ARRAY['produto_id', 'created_at'])
        || jsonb_build_object('cliente_id', v_cliente_id);
    ELSE
      v_filter := v_filter || jsonb_build_object('cliente_id', v_cliente_id);
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
$function$;

-- 4. Configurar RLS em public.loja_favoritos
ALTER TABLE public.loja_favoritos ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Favoritos por cliente" ON public.loja_favoritos;
DROP POLICY IF EXISTS "loja_favoritos_select_all" ON public.loja_favoritos;
DROP POLICY IF EXISTS "cliente_select_loja_favoritos" ON public.loja_favoritos;
DROP POLICY IF EXISTS "admin_all_loja_favoritos" ON public.loja_favoritos;

CREATE POLICY "cliente_select_loja_favoritos"
  ON public.loja_favoritos
  FOR SELECT
  TO public
  USING (true);

CREATE POLICY "admin_all_loja_favoritos"
  ON public.loja_favoritos
  FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);
