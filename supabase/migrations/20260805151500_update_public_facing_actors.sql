-- Migration to update public/client-facing notifications and logs from 'Administrador'/'ADM' to 'Sistema'

-- 1. Update Realtime Trigger for Tickets
CREATE OR REPLACE FUNCTION public.handle_realtime_notifications()
RETURNS TRIGGER AS $$
DECLARE
    v_cliente_id UUID;
    v_titulo TEXT;
    v_mensagem TEXT;
    v_modulo TEXT;
    v_item_id UUID;
    v_emoji TEXT;
    v_new_json JSONB;
BEGIN
    v_new_json := to_jsonb(NEW);

    CASE TG_TABLE_NAME
        WHEN 'tickets' THEN
            v_cliente_id := (v_new_json->>'cliente_id')::UUID;
            v_modulo := 'suporte';
            v_emoji := '🎫';
            v_item_id := (v_new_json->>'id')::UUID;
            IF (TG_OP = 'INSERT') THEN
                v_titulo := 'Ticket Aberto com Sucesso';
                v_mensagem := 'Seu ticket sobre "' || COALESCE(v_new_json->>'assunto', 'Sem Assunto') || '" foi aberto. Responderemos em breve!';
                INSERT INTO notificacoes (cliente_id, titulo, mensagem, modulo, item_id, tipo)
                VALUES (NULL, v_emoji || ' ' || v_titulo, 'Novo ticket de ' || COALESCE(v_cliente_id::TEXT, 'Desconhecido') || ': ' || COALESCE(v_new_json->>'assunto', 'Sem Assunto'), v_modulo, v_item_id, 'admin');
            END IF;
            IF v_titulo IS NOT NULL THEN
                INSERT INTO notificacoes (cliente_id, titulo, mensagem, modulo, item_id)
                VALUES (v_cliente_id, v_emoji || ' ' || v_titulo, v_mensagem, v_modulo, v_item_id);
            END IF;

        WHEN 'ticket_mensagens' THEN
            SELECT cliente_id INTO v_cliente_id FROM tickets WHERE id = (v_new_json->>'ticket_id')::UUID;
            v_modulo := 'suporte';
            v_emoji := '📩💬';
            IF (v_new_json->>'tipo' = 'admin') THEN
                v_titulo := 'Nova Resposta do Suporte';
                v_mensagem := 'O sistema respondeu ao seu ticket.';
                INSERT INTO notificacoes (cliente_id, titulo, mensagem, modulo, item_id)
                VALUES (v_cliente_id, v_emoji || ' ' || v_titulo, v_mensagem, v_modulo, (v_new_json->>'ticket_id'));
            ELSE
                v_titulo := 'Nova Mensagem do Cliente';
                v_mensagem := 'O cliente enviou uma mensagem no ticket.';
                INSERT INTO notificacoes (cliente_id, titulo, mensagem, modulo, item_id, tipo)
                VALUES (NULL, v_emoji || ' ' || v_titulo, v_mensagem, v_modulo, (v_new_json->>'ticket_id'), 'admin');
            END IF;

        ELSE
            -- Pass-through default behavior if other tables exist
            NULL;
    END CASE;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;


-- 2. Update Credit Limit RPCs
CREATE OR REPLACE FUNCTION public.gsa_admin_aprovar_solicitacao_limite(
  p_sessao_id uuid,
  p_session_token text,
  p_solicitacao_id uuid,
  p_novo_limite numeric DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_actor record;
  v_sol record;
  v_cli record;
  v_limite numeric(12,2);
  v_diff numeric(12,2);
  v_novo_disponivel numeric(12,2);
BEGIN
  v_actor := public.gsa_require_admin_actor(p_sessao_id, p_session_token);

  SELECT * INTO v_sol FROM public.solicitacoes_limite WHERE id = p_solicitacao_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Solicitacao nao encontrada.'; END IF;

  IF v_sol.status = 'aprovada' THEN
    RETURN jsonb_build_object('success', true, 'already_processed', true, 'solicitacao_id', v_sol.id);
  END IF;
  IF v_sol.status <> 'pendente' THEN
    RAISE EXCEPTION 'Apenas solicitacoes pendentes podem ser aprovadas.';
  END IF;

  SELECT * INTO v_cli FROM public.clientes WHERE id = v_sol.cliente_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Cliente nao encontrado.'; END IF;

  v_limite := coalesce(p_novo_limite, v_sol.limite_solicitado);
  IF v_limite IS NULL OR v_limite <= 0 THEN
    RAISE EXCEPTION 'Novo limite invalido.';
  END IF;

  v_diff := v_limite - coalesce(v_cli.limite_credito_total, 0);
  v_novo_disponivel := greatest(0::numeric, coalesce(v_cli.limite_credito_disponivel, 0) + v_diff);

  UPDATE public.clientes
     SET limite_credito_total = v_limite,
         limite_credito_disponivel = v_novo_disponivel,
         updated_at = now()
   WHERE id = v_cli.id;

  UPDATE public.solicitacoes_limite
     SET status = 'aprovada',
         data_analise = now(),
         analisado_por = v_actor.ator_id::text,
         updated_at = now()
   WHERE id = v_sol.id;

  INSERT INTO public.historico_limite_credito (
    cliente_id, solicitacao_id, tipo, valor_alteracao,
    limite_total_anterior, limite_total_novo,
    limite_disponivel_anterior, limite_disponivel_novo,
    descricao
  )
  VALUES (
    v_cli.id,
    v_sol.id,
    'solicitacao_aumento_aprovada',
    abs(v_diff),
    coalesce(v_cli.limite_credito_total, 0),
    v_limite,
    coalesce(v_cli.limite_credito_disponivel, 0),
    v_novo_disponivel,
    'Aumento de limite solicitado aprovado pelo Sistema. Novo limite: R$ ' || to_char(v_limite, 'FM999999999990D00') || ' [POR: ' || v_actor.ator_nome || ']'
  );

  RETURN jsonb_build_object(
    'success', true,
    'already_processed', false,
    'cliente_id', v_cli.id,
    'solicitacao_id', v_sol.id,
    'limite_total_anterior', coalesce(v_cli.limite_credito_total, 0),
    'limite_total_novo', v_limite,
    'limite_disponivel_novo', v_novo_disponivel
  );
END;
$$;


CREATE OR REPLACE FUNCTION public.gsa_admin_ajustar_limite_manual(
  p_sessao_id uuid,
  p_session_token text,
  p_cliente_id uuid,
  p_novo_total numeric,
  p_motivo text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_actor record;
  v_cli record;
  v_diff numeric(12,2);
  v_novo_disponivel numeric(12,2);
  v_descricao text;
BEGIN
  v_actor := public.gsa_require_admin_actor(p_sessao_id, p_session_token);

  SELECT * INTO v_cli FROM public.clientes WHERE id = p_cliente_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Cliente nao encontrado.'; END IF;

  IF p_novo_total IS NULL OR p_novo_total < 0 THEN
    RAISE EXCEPTION 'Novo limite total invalido.';
  END IF;

  v_descricao := nullif(trim(coalesce(p_motivo, '')), '');
  IF v_descricao IS NULL THEN
    RAISE EXCEPTION 'Informe o motivo do ajuste manual de limite.';
  END IF;

  v_diff := p_novo_total - coalesce(v_cli.limite_credito_total, 0);
  v_novo_disponivel := greatest(0::numeric, coalesce(v_cli.limite_credito_disponivel, 0) + v_diff);

  UPDATE public.clientes
     SET limite_credito_total = p_novo_total,
         limite_credito_disponivel = v_novo_disponivel,
         updated_at = now()
   WHERE id = p_cliente_id;

  INSERT INTO public.historico_limite_credito (
    cliente_id, tipo, valor_alteracao,
    limite_total_anterior, limite_total_novo,
    limite_disponivel_anterior, limite_disponivel_novo,
    descricao
  )
  VALUES (
    p_cliente_id,
    CASE WHEN v_diff >= 0 THEN 'ajuste_adm_aumento' ELSE 'ajuste_adm_reducao' END,
    abs(v_diff),
    coalesce(v_cli.limite_credito_total, 0),
    p_novo_total,
    coalesce(v_cli.limite_credito_disponivel, 0),
    v_novo_disponivel,
    'Ajuste manual de limite pelo Sistema. Motivo: ' || v_descricao || ' [POR: ' || v_actor.ator_nome || ']'
  );

  RETURN jsonb_build_object(
    'success', true,
    'cliente_id', p_cliente_id,
    'limite_total_anterior', coalesce(v_cli.limite_credito_total, 0),
    'limite_total_novo', p_novo_total,
    'limite_disponivel_novo', v_novo_disponivel
  );
END;
$$;


-- 3. Update Loan Flow RPCs
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
  v_emp record;
  v_url text;
BEGIN
  v_actor := public.gsa_require_admin_actor(p_sessao_id, p_session_token);

  v_url := nullif(trim(coalesce(p_contrato_url, '')), '');
  IF v_url IS NULL THEN RAISE EXCEPTION 'URL do contrato nao informada.'; END IF;

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
    'Sistema enviou contrato para assinatura [POR: ' || v_actor.ator_nome || ']',
    'admin',
    NULL,
    jsonb_build_object('sessao_id', p_sessao_id)
  );

  RETURN jsonb_build_object('success', true, 'emprestimo_id', p_emprestimo_id, 'cliente_id', v_emp.cliente_id);
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
  v_emp record;
  v_status text;
  v_motivo text;
  v_tipo_acao text;
  v_descricao text;
BEGIN
  v_actor := public.gsa_require_admin_actor(p_sessao_id, p_session_token);

  v_status := trim(coalesce(p_status, ''));
  v_motivo := trim(coalesce(p_motivo, ''));

  IF v_status NOT IN ('ativo', 'pendencia_documentos', 'pendencia_assinatura', 'em_analise', 'aprovado') THEN
    RAISE EXCEPTION 'Status invalido para transicao administrativa: %', v_status;
  END IF;

  SELECT * INTO v_emp FROM public.emprestimos WHERE id = p_emprestimo_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Emprestimo nao encontrado.'; END IF;

  IF v_status = v_emp.status THEN
    RETURN jsonb_build_object('success', true, 'already_processed', true, 'status', v_status);
  END IF;

  IF v_status = 'ativo' THEN
    UPDATE public.emprestimos
       SET status = 'ativo',
           data_ativacao = now(),
           updated_at = now()
     WHERE id = p_emprestimo_id;
    v_tipo_acao := 'ativado';
    v_descricao := 'Emprestimo ativado pelo sistema';
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
           updated_at = now()
     WHERE id = p_emprestimo_id;
    v_tipo_acao := 'pendencia_assinatura';
    v_descricao := 'Aguardando assinatura do cliente';
  ELSE
    UPDATE public.emprestimos
       SET status = v_status,
           updated_at = now()
     WHERE id = p_emprestimo_id;
    v_tipo_acao := 'status_alterado';
    v_descricao := 'Status alterado para: ' || v_status;
  END IF;

  PERFORM public.gsa_admin_emprestimo_add_historico(
    p_emprestimo_id,
    v_emp.orcamento_id,
    v_tipo_acao,
    v_descricao || ' [POR: ' || v_actor.ator_nome || ']',
    'admin',
    NULL,
    jsonb_build_object('sessao_id', p_sessao_id, 'motivo', v_motivo)
  );

  RETURN jsonb_build_object('success', true, 'emprestimo_id', p_emprestimo_id, 'status', v_status);
END;
$$;


-- 4. Update Subscription Cancellation Lifecycle
CREATE OR REPLACE FUNCTION public.gsa_admin_cancel_subscription_order(
  p_sessao_id uuid,
  p_session_token text,
  p_request_id text,
  p_order_id uuid,
  p_data_cancelamento date,
  p_motivo text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_actor record;
  v_order record;
  v_status text;
  v_today date := (timezone('America/Sao_Paulo', now()))::date;
  v_reason text;
BEGIN
  v_actor := public.gsa_require_admin_actor(p_sessao_id, p_session_token);

  IF p_order_id IS NULL THEN
    RAISE EXCEPTION 'Ordem de assinatura nao informada.';
  END IF;

  IF p_data_cancelamento IS NULL THEN
    RAISE EXCEPTION 'Data de cancelamento nao informada.';
  END IF;

  SELECT *
  INTO v_order
  FROM public.ordens_assinatura
  WHERE id = p_order_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Ordem de assinatura nao encontrada.';
  END IF;

  IF v_order.status = 'cancelado' THEN
    RETURN jsonb_build_object(
      'success', true,
      'already_processed', true,
      'status', 'cancelado',
      'order_id', v_order.id
    );
  END IF;

  v_status := CASE
    WHEN p_data_cancelamento > v_today THEN 'em_cancelamento'
    ELSE 'cancelado'
  END;
  v_reason := coalesce(
    nullif(trim(coalesce(p_motivo, '')), ''),
    CASE
      WHEN v_status = 'em_cancelamento' THEN 'Cancelamento agendado pelo sistema'
      ELSE 'Cancelamento realizado pelo sistema'
    END
  );

  UPDATE public.ordens_assinatura
  SET status = v_status,
      data_cancelamento = p_data_cancelamento,
      valor_proporcional_cancelamento = NULL,
      motivo_cancelamento = v_reason || ' [POR: ' || coalesce(v_actor.ator_nome, 'Sistema') || ']'
  WHERE id = v_order.id;

  UPDATE public.faturas
  SET status = 'cancelado',
      data_cancelamento = now(),
      motivo_cancelamento = 'Cancelada automaticamente por encerramento da assinatura em ' || p_data_cancelamento::text,
      valor_final_pendente = 0
  WHERE ordem_assinatura_id = v_order.id
    AND status IN (
      'pendente', 'vencida', 'revisada', 'aguardando_link', 'pendente_pagamento'
    )
    AND (data_vencimento IS NULL OR data_vencimento >= p_data_cancelamento);

  RETURN jsonb_build_object(
    'success', true,
    'already_processed', false,
    'status', v_status,
    'order_id', v_order.id,
    'data_cancelamento', p_data_cancelamento,
    'motivo_cancelamento', v_reason
  );
END;
$$;
