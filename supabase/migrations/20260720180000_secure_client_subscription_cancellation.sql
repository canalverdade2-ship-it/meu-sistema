-- Session-bound and idempotent subscription cancellation for clients.

ALTER TABLE public.gsa_client_operation_requests
  DROP CONSTRAINT IF EXISTS gsa_client_operation_name_check;
ALTER TABLE public.gsa_client_operation_requests
  ADD CONSTRAINT gsa_client_operation_name_check CHECK (operacao IN (
    'converter_pontos',
    'solicitar_saque',
    'solicitar_transferencia',
    'assinar_area_vip',
    'prorrogar_assinatura',
    'cancelar_assinatura'
  ));

CREATE OR REPLACE FUNCTION public.gsa_client_cancel_subscription(
  p_sessao_id uuid,
  p_session_token text,
  p_request_id uuid,
  p_ordem_assinatura_id uuid,
  p_data_cancelamento date
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_actor record;
  v_order public.ordens_assinatura%rowtype;
  v_plan public.assinaturas%rowtype;
  v_result jsonb;
  v_inserted uuid;
  v_status text;
  v_cancelled_invoices integer := 0;
BEGIN
  IF p_request_id IS NULL THEN
    RAISE EXCEPTION 'Identificador da operacao obrigatorio.';
  END IF;
  IF p_ordem_assinatura_id IS NULL OR p_data_cancelamento IS NULL THEN
    RAISE EXCEPTION 'Assinatura e data de cancelamento sao obrigatorias.';
  END IF;
  IF p_data_cancelamento < current_date THEN
    RAISE EXCEPTION 'A data de cancelamento nao pode ser retroativa.';
  END IF;

  SELECT * INTO v_actor
  FROM public.gsa_client_session_actor(p_sessao_id, p_session_token)
  LIMIT 1;

  INSERT INTO public.gsa_client_operation_requests(request_id, cliente_id, operacao)
  VALUES (p_request_id, v_actor.cliente_id, 'cancelar_assinatura')
  ON CONFLICT (request_id) DO NOTHING
  RETURNING request_id INTO v_inserted;

  IF v_inserted IS NULL THEN
    SELECT resultado INTO v_result
    FROM public.gsa_client_operation_requests
    WHERE request_id = p_request_id
      AND cliente_id = v_actor.cliente_id
      AND operacao = 'cancelar_assinatura';
    IF NOT FOUND THEN RAISE EXCEPTION 'Identificador da operacao ja utilizado.'; END IF;
    IF v_result IS NULL THEN RAISE EXCEPTION 'Operacao ainda em processamento.'; END IF;
    RETURN v_result || jsonb_build_object('already_exists', true);
  END IF;

  SELECT * INTO v_order
  FROM public.ordens_assinatura
  WHERE id = p_ordem_assinatura_id
    AND cliente_id = v_actor.cliente_id
  FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Assinatura nao encontrada.'; END IF;

  SELECT * INTO v_plan
  FROM public.assinaturas
  WHERE id = v_order.assinatura_id;

  IF v_order.status = 'cancelado' THEN
    v_result := jsonb_build_object(
      'success', true,
      'already_exists', false,
      'already_processed', true,
      'ordem_assinatura_id', v_order.id,
      'status', 'cancelado',
      'data_cancelamento', v_order.data_cancelamento,
      'faturas_futuras_canceladas', 0
    );
    UPDATE public.gsa_client_operation_requests
    SET resultado = v_result, completed_at = now()
    WHERE request_id = p_request_id;
    RETURN v_result;
  END IF;

  IF v_order.status NOT IN ('concluido', 'ativa', 'em_cancelamento') THEN
    RAISE EXCEPTION 'Somente uma assinatura ativa pode ser cancelada pelo cliente.';
  END IF;

  v_status := CASE WHEN p_data_cancelamento > current_date THEN 'em_cancelamento' ELSE 'cancelado' END;

  UPDATE public.ordens_assinatura
  SET status = v_status,
      data_cancelamento = p_data_cancelamento,
      valor_proporcional_cancelamento = NULL,
      motivo_cancelamento = CASE
        WHEN v_status = 'em_cancelamento' THEN 'Cancelamento agendado pelo cliente'
        ELSE 'Cancelamento realizado pelo cliente'
      END
  WHERE id = v_order.id;

  UPDATE public.faturas
  SET status = 'cancelado',
      data_cancelamento = now(),
      motivo_cancelamento = 'Cancelada automaticamente por encerramento da assinatura em ' || p_data_cancelamento::text,
      valor_final_pendente = 0
  WHERE ordem_assinatura_id = v_order.id
    AND status IN ('pendente', 'vencida', 'revisada', 'aguardando_link', 'pendente_pagamento')
    AND data_vencimento::date > p_data_cancelamento;
  GET DIAGNOSTICS v_cancelled_invoices = ROW_COUNT;

  v_result := jsonb_build_object(
    'success', true,
    'already_exists', false,
    'already_processed', false,
    'ordem_assinatura_id', v_order.id,
    'status', v_status,
    'data_cancelamento', p_data_cancelamento,
    'faturas_futuras_canceladas', v_cancelled_invoices,
    'regra_financeira', 'faturas_pagas_preservadas_e_faturas_ate_a_data_mantidas'
  );

  UPDATE public.gsa_client_operation_requests
  SET resultado = v_result, completed_at = now()
  WHERE request_id = p_request_id;

  INSERT INTO public.notificacoes(
    cliente_id, titulo, mensagem, modulo, tab, item_id,
    destinatario_tipo, acao_origem, contexto
  ) VALUES (
    v_actor.cliente_id,
    CASE WHEN v_status = 'em_cancelamento' THEN 'Cancelamento de assinatura agendado' ELSE 'Assinatura cancelada' END,
    CASE
      WHEN v_status = 'em_cancelamento' THEN
        'O cancelamento da assinatura ' || coalesce(v_plan.nome, 'contratada') ||
        ' foi agendado para ' || to_char(p_data_cancelamento, 'DD/MM/YYYY') || '.'
      ELSE 'A assinatura ' || coalesce(v_plan.nome, 'contratada') || ' foi cancelada.'
    END,
    'servicos_assinaturas', 'assinaturas', v_order.id::text,
    'cliente', 'cancelar_assinatura',
    jsonb_build_object(
      'ordem_assinatura_id', v_order.id,
      'status', v_status,
      'data_cancelamento', p_data_cancelamento,
      'faturas_futuras_canceladas', v_cancelled_invoices
    )
  );

  RETURN v_result;
END;
$$;

REVOKE ALL ON FUNCTION public.gsa_client_cancel_subscription(uuid, text, uuid, uuid, date) FROM public;
GRANT EXECUTE ON FUNCTION public.gsa_client_cancel_subscription(uuid, text, uuid, uuid, date) TO anon, authenticated;
