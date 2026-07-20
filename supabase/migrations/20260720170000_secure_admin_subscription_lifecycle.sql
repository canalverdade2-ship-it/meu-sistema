-- Secure, transactional and idempotent administrative subscription lifecycle.

CREATE TABLE IF NOT EXISTS public.gsa_admin_operation_requests (
  request_id uuid PRIMARY KEY,
  ator_tipo text NOT NULL CHECK (ator_tipo IN ('admin', 'colaborador')),
  ator_id uuid,
  operacao text NOT NULL CHECK (operacao IN (
    'prorrogar_assinatura_admin',
    'cancelar_assinatura_admin'
  )),
  resultado jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  completed_at timestamptz
);

ALTER TABLE public.gsa_admin_operation_requests ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.gsa_admin_operation_requests FROM public, anon, authenticated;

CREATE OR REPLACE FUNCTION public.gsa_admin_extend_subscription(
  p_sessao_id uuid,
  p_session_token text,
  p_request_id uuid,
  p_ordem_assinatura_id uuid,
  p_meses integer
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
  v_base_date date;
  v_due_date date;
  v_invoice_id uuid;
  v_invoice_ids uuid[] := '{}';
  v_result jsonb;
  v_inserted uuid;
  v_i integer;
  v_price numeric;
BEGIN
  IF p_request_id IS NULL THEN
    RAISE EXCEPTION 'Identificador da operacao obrigatorio.';
  END IF;
  IF p_ordem_assinatura_id IS NULL OR p_meses IS NULL OR p_meses < 1 OR p_meses > 36 THEN
    RAISE EXCEPTION 'O periodo de prorrogacao deve ser de 1 a 36 meses.';
  END IF;

  SELECT * INTO v_actor
  FROM public.gsa_admin_session_actor(p_sessao_id, p_session_token)
  LIMIT 1;

  INSERT INTO public.gsa_admin_operation_requests(
    request_id, ator_tipo, ator_id, operacao
  ) VALUES (
    p_request_id, v_actor.ator_tipo, v_actor.ator_id, 'prorrogar_assinatura_admin'
  )
  ON CONFLICT (request_id) DO NOTHING
  RETURNING request_id INTO v_inserted;

  IF v_inserted IS NULL THEN
    SELECT resultado INTO v_result
    FROM public.gsa_admin_operation_requests
    WHERE request_id = p_request_id
      AND ator_tipo = v_actor.ator_tipo
      AND ator_id IS NOT DISTINCT FROM v_actor.ator_id
      AND operacao = 'prorrogar_assinatura_admin';

    IF NOT FOUND THEN
      RAISE EXCEPTION 'Identificador da operacao ja utilizado.';
    END IF;
    IF v_result IS NULL THEN
      RAISE EXCEPTION 'Operacao ainda em processamento.';
    END IF;
    RETURN v_result || jsonb_build_object('already_exists', true);
  END IF;

  SELECT * INTO v_order
  FROM public.ordens_assinatura
  WHERE id = p_ordem_assinatura_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Assinatura nao encontrada.';
  END IF;
  IF v_order.status NOT IN ('concluido', 'ativa') THEN
    RAISE EXCEPTION 'Somente uma assinatura ativa pode ser prorrogada.';
  END IF;

  SELECT * INTO v_plan
  FROM public.assinaturas
  WHERE id = v_order.assinatura_id
    AND status = 'ativo';

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Plano de assinatura indisponivel.';
  END IF;

  v_price := round(greatest(coalesce(v_plan.valor, 0), 0), 2);
  IF v_price <= 0 THEN
    RAISE EXCEPTION 'Valor do plano de assinatura invalido.';
  END IF;

  SELECT greatest(
    current_date,
    coalesce(v_order.data_vencimento::date, current_date),
    coalesce(max(data_vencimento), current_date)
  ) INTO v_base_date
  FROM public.faturas
  WHERE ordem_assinatura_id = v_order.id
    AND status NOT IN ('cancelado', 'cancelada');

  FOR v_i IN 1..p_meses LOOP
    v_due_date := (v_base_date + make_interval(months => v_i))::date;

    INSERT INTO public.faturas(
      codigo_fatura,
      ordem_assinatura_id,
      orcamento_id,
      cliente_id,
      valor_total,
      valor_final_pendente,
      status,
      tipo,
      data_vencimento,
      gerada_automaticamente,
      mes_referencia,
      itens_faturados
    ) VALUES (
      public.gsa_generate_code('FAT'),
      v_order.id,
      v_order.orcamento_id,
      v_order.cliente_id,
      v_price,
      v_price,
      'pendente',
      'assinatura',
      v_due_date,
      true,
      to_char(v_due_date, 'YYYY-MM'),
      jsonb_build_array(jsonb_build_object(
        'id', 'prorrogacao-admin-' || p_request_id::text || '-' || v_i::text,
        'codigo', v_plan.codigo_assinatura,
        'descricao', 'Prorrogacao administrativa da assinatura: ' || v_plan.nome,
        'valor', v_price,
        'quantidade', 1,
        'mes_prorrogado', v_i
      ))
    )
    RETURNING id INTO v_invoice_id;

    v_invoice_ids := array_append(v_invoice_ids, v_invoice_id);
  END LOOP;

  UPDATE public.ordens_assinatura
  SET prazo_meses = coalesce(prazo_meses, 0) + p_meses,
      data_vencimento = (v_base_date + make_interval(months => p_meses))::date,
      observacoes_admin = trim(concat_ws(
        ' ',
        nullif(observacoes_admin, ''),
        '[Prorrogado por ' || p_meses || ' mes(es) em ' || current_date::text ||
        ' por ' || coalesce(v_actor.ator_nome, 'Administrador') || ']'
      ))
  WHERE id = v_order.id;

  v_result := jsonb_build_object(
    'success', true,
    'already_exists', false,
    'ordem_assinatura_id', v_order.id,
    'cliente_id', v_order.cliente_id,
    'faturas_ids', to_jsonb(v_invoice_ids),
    'meses', p_meses,
    'nova_data_vencimento', (v_base_date + make_interval(months => p_meses))::date
  );

  UPDATE public.gsa_admin_operation_requests
  SET resultado = v_result,
      completed_at = now()
  WHERE request_id = p_request_id;

  INSERT INTO public.notificacoes(
    cliente_id,
    titulo,
    mensagem,
    modulo,
    tab,
    item_id,
    destinatario_tipo,
    acao_origem,
    contexto
  ) VALUES (
    v_order.cliente_id,
    'Assinatura prorrogada',
    'Sua assinatura ' || v_plan.nome || ' foi prorrogada por ' || p_meses || ' mes(es).',
    'servicos_assinaturas',
    'assinaturas',
    v_order.id::text,
    'cliente',
    'prorrogar_assinatura_admin',
    jsonb_build_object(
      'ordem_assinatura_id', v_order.id,
      'meses', p_meses,
      'faturas_ids', to_jsonb(v_invoice_ids)
    )
  );

  INSERT INTO public.sistema_logs(acao, detalhes, ator_tipo, ator_id, ator_nome)
  VALUES (
    'PRORROGAR_ASSINATURA',
    jsonb_build_object(
      'ordem_assinatura_id', v_order.id,
      'cliente_id', v_order.cliente_id,
      'meses', p_meses,
      'faturas_ids', to_jsonb(v_invoice_ids),
      'request_id', p_request_id
    )::text,
    v_actor.ator_tipo,
    v_actor.ator_id,
    v_actor.ator_nome
  );

  RETURN v_result;
END;
$$;

CREATE OR REPLACE FUNCTION public.gsa_admin_cancel_subscription(
  p_sessao_id uuid,
  p_session_token text,
  p_request_id uuid,
  p_ordem_assinatura_id uuid,
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
  v_order public.ordens_assinatura%rowtype;
  v_plan public.assinaturas%rowtype;
  v_result jsonb;
  v_inserted uuid;
  v_status text;
  v_reason text;
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
  FROM public.gsa_admin_session_actor(p_sessao_id, p_session_token)
  LIMIT 1;

  INSERT INTO public.gsa_admin_operation_requests(
    request_id, ator_tipo, ator_id, operacao
  ) VALUES (
    p_request_id, v_actor.ator_tipo, v_actor.ator_id, 'cancelar_assinatura_admin'
  )
  ON CONFLICT (request_id) DO NOTHING
  RETURNING request_id INTO v_inserted;

  IF v_inserted IS NULL THEN
    SELECT resultado INTO v_result
    FROM public.gsa_admin_operation_requests
    WHERE request_id = p_request_id
      AND ator_tipo = v_actor.ator_tipo
      AND ator_id IS NOT DISTINCT FROM v_actor.ator_id
      AND operacao = 'cancelar_assinatura_admin';

    IF NOT FOUND THEN
      RAISE EXCEPTION 'Identificador da operacao ja utilizado.';
    END IF;
    IF v_result IS NULL THEN
      RAISE EXCEPTION 'Operacao ainda em processamento.';
    END IF;
    RETURN v_result || jsonb_build_object('already_exists', true);
  END IF;

  SELECT * INTO v_order
  FROM public.ordens_assinatura
  WHERE id = p_ordem_assinatura_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Assinatura nao encontrada.';
  END IF;

  SELECT * INTO v_plan
  FROM public.assinaturas
  WHERE id = v_order.assinatura_id;

  IF v_order.status = 'cancelado' THEN
    v_result := jsonb_build_object(
      'success', true,
      'already_exists', false,
      'already_processed', true,
      'ordem_assinatura_id', v_order.id,
      'cliente_id', v_order.cliente_id,
      'status', 'cancelado',
      'data_cancelamento', v_order.data_cancelamento
    );

    UPDATE public.gsa_admin_operation_requests
    SET resultado = v_result,
        completed_at = now()
    WHERE request_id = p_request_id;

    RETURN v_result;
  END IF;

  IF v_order.status NOT IN (
    'em_analise', 'pendente', 'pago', 'concluido', 'ativa', 'em_cancelamento'
  ) THEN
    RAISE EXCEPTION 'Status da assinatura nao permite cancelamento.';
  END IF;

  v_status := CASE
    WHEN p_data_cancelamento > current_date THEN 'em_cancelamento'
    ELSE 'cancelado'
  END;
  v_reason := coalesce(
    nullif(trim(coalesce(p_motivo, '')), ''),
    CASE
      WHEN v_status = 'em_cancelamento' THEN 'Cancelamento agendado pelo administrador'
      ELSE 'Cancelamento realizado pelo administrador'
    END
  );

  UPDATE public.ordens_assinatura
  SET status = v_status,
      data_cancelamento = p_data_cancelamento,
      valor_proporcional_cancelamento = NULL,
      motivo_cancelamento = v_reason || ' [POR: ' || coalesce(v_actor.ator_nome, 'Administrador') || ']'
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
    AND data_vencimento::date > p_data_cancelamento;

  GET DIAGNOSTICS v_cancelled_invoices = ROW_COUNT;

  v_result := jsonb_build_object(
    'success', true,
    'already_exists', false,
    'already_processed', false,
    'ordem_assinatura_id', v_order.id,
    'cliente_id', v_order.cliente_id,
    'status', v_status,
    'data_cancelamento', p_data_cancelamento,
    'faturas_futuras_canceladas', v_cancelled_invoices,
    'regra_financeira', 'faturas_pagas_preservadas_e_faturas_ate_a_data_mantidas'
  );

  UPDATE public.gsa_admin_operation_requests
  SET resultado = v_result,
      completed_at = now()
  WHERE request_id = p_request_id;

  INSERT INTO public.notificacoes(
    cliente_id,
    titulo,
    mensagem,
    modulo,
    tab,
    item_id,
    destinatario_tipo,
    acao_origem,
    contexto
  ) VALUES (
    v_order.cliente_id,
    CASE
      WHEN v_status = 'em_cancelamento' THEN 'Cancelamento de assinatura agendado'
      ELSE 'Assinatura cancelada'
    END,
    CASE
      WHEN v_status = 'em_cancelamento' THEN
        'O cancelamento da assinatura ' || coalesce(v_plan.nome, 'contratada') ||
        ' foi agendado para ' || to_char(p_data_cancelamento, 'DD/MM/YYYY') || '.'
      ELSE
        'A assinatura ' || coalesce(v_plan.nome, 'contratada') || ' foi cancelada.'
    END,
    'servicos_assinaturas',
    'assinaturas',
    v_order.id::text,
    'cliente',
    'cancelar_assinatura_admin',
    jsonb_build_object(
      'ordem_assinatura_id', v_order.id,
      'status', v_status,
      'data_cancelamento', p_data_cancelamento,
      'faturas_futuras_canceladas', v_cancelled_invoices
    )
  );

  INSERT INTO public.sistema_logs(acao, detalhes, ator_tipo, ator_id, ator_nome)
  VALUES (
    CASE
      WHEN v_status = 'em_cancelamento' THEN 'AGENDAR_CANCELAMENTO_ASSINATURA'
      ELSE 'CANCELAR_ASSINATURA'
    END,
    jsonb_build_object(
      'ordem_assinatura_id', v_order.id,
      'cliente_id', v_order.cliente_id,
      'status', v_status,
      'data_cancelamento', p_data_cancelamento,
      'faturas_futuras_canceladas', v_cancelled_invoices,
      'request_id', p_request_id
    )::text,
    v_actor.ator_tipo,
    v_actor.ator_id,
    v_actor.ator_nome
  );

  RETURN v_result;
END;
$$;

CREATE OR REPLACE FUNCTION public.gsa_process_scheduled_subscription_cancellations()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_order record;
  v_processed integer := 0;
  v_cancelled_invoices integer := 0;
  v_total_cancelled_invoices integer := 0;
BEGIN
  FOR v_order IN
    SELECT oa.id, oa.cliente_id, oa.assinatura_id, oa.data_cancelamento
    FROM public.ordens_assinatura oa
    WHERE oa.status = 'em_cancelamento'
      AND oa.data_cancelamento IS NOT NULL
      AND oa.data_cancelamento::date <= current_date
    ORDER BY oa.data_cancelamento, oa.id
    FOR UPDATE SKIP LOCKED
  LOOP
    UPDATE public.ordens_assinatura
    SET status = 'cancelado',
        valor_proporcional_cancelamento = NULL
    WHERE id = v_order.id
      AND status = 'em_cancelamento';

    IF FOUND THEN
      UPDATE public.faturas
      SET status = 'cancelado',
          data_cancelamento = now(),
          motivo_cancelamento = 'Cancelada automaticamente pelo processamento do encerramento da assinatura',
          valor_final_pendente = 0
      WHERE ordem_assinatura_id = v_order.id
        AND status IN (
          'pendente', 'vencida', 'revisada', 'aguardando_link', 'pendente_pagamento'
        )
        AND data_vencimento::date > v_order.data_cancelamento::date;

      GET DIAGNOSTICS v_cancelled_invoices = ROW_COUNT;
      v_total_cancelled_invoices := v_total_cancelled_invoices + v_cancelled_invoices;
      v_processed := v_processed + 1;

      INSERT INTO public.notificacoes(
        cliente_id,
        titulo,
        mensagem,
        modulo,
        tab,
        item_id,
        destinatario_tipo,
        acao_origem,
        contexto
      ) VALUES (
        v_order.cliente_id,
        'Assinatura cancelada',
        'O cancelamento agendado da sua assinatura foi concluido.',
        'servicos_assinaturas',
        'assinaturas',
        v_order.id::text,
        'cliente',
        'processar_cancelamento_assinatura',
        jsonb_build_object(
          'ordem_assinatura_id', v_order.id,
          'data_cancelamento', v_order.data_cancelamento,
          'faturas_futuras_canceladas', v_cancelled_invoices
        )
      );

      INSERT INTO public.sistema_logs(acao, detalhes, ator_tipo, ator_nome)
      VALUES (
        'PROCESSAR_CANCELAMENTO_ASSINATURA',
        jsonb_build_object(
          'ordem_assinatura_id', v_order.id,
          'cliente_id', v_order.cliente_id,
          'data_cancelamento', v_order.data_cancelamento,
          'faturas_futuras_canceladas', v_cancelled_invoices
        )::text,
        'sistema',
        'Processador Automatico'
      );
    END IF;
  END LOOP;

  RETURN jsonb_build_object(
    'success', true,
    'assinaturas_processadas', v_processed,
    'faturas_futuras_canceladas', v_total_cancelled_invoices
  );
END;
$$;

REVOKE ALL ON FUNCTION public.gsa_admin_extend_subscription(uuid, text, uuid, uuid, integer) FROM public;
REVOKE ALL ON FUNCTION public.gsa_admin_cancel_subscription(uuid, text, uuid, uuid, date, text) FROM public;
REVOKE ALL ON FUNCTION public.gsa_process_scheduled_subscription_cancellations() FROM public, anon, authenticated;

GRANT EXECUTE ON FUNCTION public.gsa_admin_extend_subscription(uuid, text, uuid, uuid, integer) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.gsa_admin_cancel_subscription(uuid, text, uuid, uuid, date, text) TO anon, authenticated;

DO $$
DECLARE
  v_job_id bigint;
BEGIN
  IF EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_cron')
     AND EXISTS (SELECT 1 FROM pg_namespace WHERE nspname = 'cron') THEN
    EXECUTE 'SELECT jobid FROM cron.job WHERE jobname = $1 LIMIT 1'
      INTO v_job_id
      USING 'gsa-process-scheduled-subscription-cancellations';

    IF v_job_id IS NOT NULL THEN
      EXECUTE 'SELECT cron.unschedule($1)' USING v_job_id;
    END IF;

    EXECUTE 'SELECT cron.schedule($1, $2, $3)'
      USING
        'gsa-process-scheduled-subscription-cancellations',
        '*/15 * * * *',
        'SELECT public.gsa_process_scheduled_subscription_cancellations();';
  END IF;
END;
$$;
