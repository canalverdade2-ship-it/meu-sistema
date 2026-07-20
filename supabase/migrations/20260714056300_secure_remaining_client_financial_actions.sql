-- Session-bound client financial, subscription, VIP and benefit operations.

ALTER TABLE public.gsa_client_operation_requests
  DROP CONSTRAINT IF EXISTS gsa_client_operation_name_check;
ALTER TABLE public.gsa_client_operation_requests
  ADD CONSTRAINT gsa_client_operation_name_check CHECK (operacao IN (
    'converter_pontos',
    'solicitar_saque',
    'solicitar_transferencia',
    'assinar_area_vip',
    'prorrogar_assinatura'
  ));

ALTER TABLE public.faturas DROP CONSTRAINT IF EXISTS faturas_tipo_check;
ALTER TABLE public.faturas
  ADD CONSTRAINT faturas_tipo_check CHECK (
    tipo IS NULL OR tipo IN (
      'servico', 'produto', 'assinatura', 'pacote_nivel',
      'emprestimo', 'taxa_servico_emprestimo', 'avulsa'
    )
  );

ALTER TABLE public.emprestimo_parcelas
  DROP CONSTRAINT IF EXISTS emprestimo_parcelas_status_check;
ALTER TABLE public.emprestimo_parcelas
  ADD CONSTRAINT emprestimo_parcelas_status_check CHECK (
    status IN ('pendente', 'paga', 'vencida', 'em_cobranca', 'suspensa')
  );

CREATE TABLE IF NOT EXISTS public.gsa_voucher_resgates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  voucher_id uuid NOT NULL REFERENCES public.vouchers(id) ON DELETE CASCADE,
  cliente_id uuid NOT NULL REFERENCES public.clientes(id) ON DELETE CASCADE,
  valor numeric NOT NULL CHECK (valor > 0),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (voucher_id, cliente_id)
);
ALTER TABLE public.gsa_voucher_resgates ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.gsa_voucher_resgates FROM public, anon, authenticated;

CREATE OR REPLACE FUNCTION public.gsa_client_subscribe_vip(
  p_sessao_id uuid,
  p_session_token text,
  p_request_id uuid,
  p_nivel_id uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_actor record;
  v_client public.clientes%rowtype;
  v_level public.client_levels%rowtype;
  v_rate numeric;
  v_price numeric;
  v_points integer;
  v_discount numeric;
  v_pending numeric;
  v_invoice_id uuid;
  v_result jsonb;
  v_inserted uuid;
BEGIN
  IF p_request_id IS NULL OR p_nivel_id IS NULL THEN
    RAISE EXCEPTION 'Identificador da operação e nível VIP são obrigatórios.';
  END IF;

  SELECT * INTO v_actor
  FROM public.gsa_client_session_actor(p_sessao_id, p_session_token)
  LIMIT 1;

  INSERT INTO public.gsa_client_operation_requests(request_id, cliente_id, operacao)
  VALUES (p_request_id, v_actor.cliente_id, 'assinar_area_vip')
  ON CONFLICT (request_id) DO NOTHING
  RETURNING request_id INTO v_inserted;

  IF v_inserted IS NULL THEN
    SELECT resultado INTO v_result
    FROM public.gsa_client_operation_requests
    WHERE request_id = p_request_id
      AND cliente_id = v_actor.cliente_id
      AND operacao = 'assinar_area_vip';
    IF NOT FOUND THEN RAISE EXCEPTION 'Identificador da operação já utilizado.'; END IF;
    IF v_result IS NULL THEN RAISE EXCEPTION 'Operação ainda em processamento.'; END IF;
    RETURN v_result || jsonb_build_object('already_exists', true);
  END IF;

  SELECT * INTO v_client
  FROM public.clientes
  WHERE id = v_actor.cliente_id
  FOR UPDATE;
  IF NOT FOUND OR v_client.status <> 'ativo' THEN
    RAISE EXCEPTION 'Cliente não está apto a contratar o nível VIP.';
  END IF;
  IF coalesce(v_client.pontos_bloqueados, false) THEN
    RAISE EXCEPTION 'A carteira de pontos está bloqueada.';
  END IF;

  SELECT * INTO v_level
  FROM public.client_levels
  WHERE id = p_nivel_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Nível VIP não encontrado.'; END IF;

  v_price := round(greatest(coalesce(v_level.preco, 0), 0), 2);
  IF v_price <= 0 THEN RAISE EXCEPTION 'Este nível VIP não está disponível para compra.'; END IF;

  SELECT least(greatest(coalesce(taxa_conversao_pontos, 0.01), 0.0001), 100)
  INTO v_rate
  FROM public.empresa
  ORDER BY created_at
  LIMIT 1;
  v_rate := coalesce(v_rate, 0.01);
  v_points := least(
    greatest(coalesce(v_client.saldo_pontos, 0), 0),
    floor(v_price / v_rate)::integer
  );
  v_discount := least(v_price, round(v_points * v_rate, 2));
  v_pending := round(v_price - v_discount, 2);

  INSERT INTO public.faturas(
    cliente_id, codigo_fatura, data_vencimento, valor_total, valor_pago,
    valor_final_pendente, desconto_pontos_aplicado, status, tipo,
    pacote_nivel_id, forma_pagamento_escolhida, itens_faturados,
    historico_pagamentos, gerada_automaticamente
  ) VALUES (
    v_actor.cliente_id, public.gsa_generate_code('FAT-VIP'), current_date + 3,
    v_price, v_discount, v_pending, v_discount, 'pendente', 'pacote_nivel',
    v_level.id::text, 'pix',
    jsonb_build_array(jsonb_build_object(
      'id', 'nivel-' || v_level.id::text,
      'codigo', v_level.id::text,
      'descricao', 'Compra do nível VIP: ' || v_level.nome_nivel,
      'valor', v_price,
      'quantidade', 1,
      'beneficios', coalesce(v_level.benefits, '[]'::jsonb),
      'beneficios_exclusivos', coalesce(v_level.exclusive_benefits, '[]'::jsonb)
    )),
    jsonb_build_array(jsonb_build_object(
      'data', now(),
      'descricao', 'Geração da fatura para compra de nível VIP',
      'valor_total', v_price,
      'pontos_utilizados', v_points,
      'desconto_pontos', v_discount,
      'valor_restante', v_pending
    )),
    true
  ) RETURNING id INTO v_invoice_id;

  IF v_points > 0 THEN
    UPDATE public.clientes
    SET saldo_pontos = coalesce(saldo_pontos, 0) - v_points
    WHERE id = v_actor.cliente_id;

    INSERT INTO public.pagamentos(fatura_id, valor, metodo, data_pagamento)
    VALUES (v_invoice_id, v_discount, 'pontos', now());
    INSERT INTO public.pontos_movimentacoes(
      cliente_id, tipo, pontos, saldo_apos, descricao, valor_convertido
    ) VALUES (
      v_actor.cliente_id, 'resgate', -v_points,
      coalesce(v_client.saldo_pontos, 0) - v_points,
      'Uso de pontos para compra do nível VIP: ' || v_level.nome_nivel,
      v_discount
    );
    INSERT INTO public.points_transactions(cliente_id, tipo, pontos, descricao)
    VALUES (
      v_actor.cliente_id, 'resgate', -v_points,
      'Uso de pontos para compra do nível VIP: ' || v_level.nome_nivel
    );
  END IF;

  IF v_pending = 0 THEN
    UPDATE public.faturas
    SET status = 'pago', data_pagamento = now(), valor_pago = v_price
    WHERE id = v_invoice_id;
  END IF;

  v_result := jsonb_build_object(
    'success', true,
    'already_exists', false,
    'fatura_id', v_invoice_id,
    'nivel_id', v_level.id,
    'nivel_nome', v_level.nome_nivel,
    'valor_total', v_price,
    'valor_final', v_pending,
    'pontos_utilizados', v_points,
    'pago_integralmente_com_pontos', v_pending = 0
  );
  UPDATE public.gsa_client_operation_requests
  SET resultado = v_result, completed_at = now()
  WHERE request_id = p_request_id;

  INSERT INTO public.notificacoes(
    cliente_id, titulo, mensagem, modulo, tab, item_id,
    destinatario_tipo, acao_origem, contexto
  ) VALUES (
    v_actor.cliente_id,
    CASE WHEN v_pending = 0 THEN 'Nível VIP confirmado' ELSE 'Fatura VIP gerada' END,
    CASE WHEN v_pending = 0
      THEN 'Seu nível ' || v_level.nome_nivel || ' foi pago integralmente com pontos.'
      ELSE 'A fatura do nível ' || v_level.nome_nivel || ' está disponível para pagamento.'
    END,
    'financeiro', 'faturas', v_invoice_id::text,
    'cliente', 'assinar_area_vip',
    jsonb_build_object('fatura_id', v_invoice_id, 'nivel_id', v_level.id)
  );

  RETURN v_result;
END;
$$;

CREATE OR REPLACE FUNCTION public.gsa_client_accept_store_credit_settlement(
  p_sessao_id uuid,
  p_session_token text,
  p_orcamento_id uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_actor record;
  v_budget public.orcamentos%rowtype;
  v_invoice_id uuid;
  v_first_order_id uuid;
  v_code text;
  v_offer numeric;
  v_outstanding numeric;
BEGIN
  SELECT * INTO v_actor
  FROM public.gsa_client_session_actor(p_sessao_id, p_session_token)
  LIMIT 1;

  SELECT * INTO v_budget
  FROM public.orcamentos
  WHERE id = p_orcamento_id
    AND cliente_id = v_actor.cliente_id
  FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Pedido de crédito não encontrado.'; END IF;

  v_code := 'FAT-QUIT-' || coalesce(v_budget.codigo_orcamento, v_budget.id::text);
  SELECT id INTO v_invoice_id
  FROM public.faturas
  WHERE codigo_fatura = v_code
    AND cliente_id = v_actor.cliente_id
    AND status <> 'cancelado'
  LIMIT 1;
  IF v_invoice_id IS NOT NULL THEN
    RETURN jsonb_build_object('success', true, 'fatura_id', v_invoice_id, 'already_exists', true);
  END IF;

  IF coalesce(v_budget.status_quitacao_credito, '') <> 'aguardando_pagamento_quitacao'
     OR coalesce(v_budget.valor_quitacao_acordo, 0) <= 0 THEN
    RAISE EXCEPTION 'Não existe proposta de quitação disponível.';
  END IF;

  v_offer := round(v_budget.valor_quitacao_acordo, 2);
  SELECT round(coalesce(sum(greatest(coalesce(f.valor_final_pendente, f.valor_total), 0)), 0), 2)
  INTO v_outstanding
  FROM public.faturas f
  WHERE f.cliente_id = v_actor.cliente_id
    AND f.status NOT IN ('pago', 'cancelado')
    AND coalesce(f.is_amortizacao_credito, false)
    AND (
      f.orcamento_id = v_budget.id
      OR f.ordem_compra_id IN (
        SELECT oc.id FROM public.ordens_compra oc WHERE oc.orcamento_id = v_budget.id
      )
    );
  IF v_outstanding <= 0 THEN RAISE EXCEPTION 'Não existem parcelas de crédito pendentes para quitação.'; END IF;
  IF v_offer > v_outstanding THEN RAISE EXCEPTION 'A oferta de quitação excede o saldo devedor.'; END IF;

  SELECT id INTO v_first_order_id
  FROM public.ordens_compra
  WHERE orcamento_id = v_budget.id
  ORDER BY data_criacao, id
  LIMIT 1;

  INSERT INTO public.faturas(
    cliente_id, tipo, valor_total, valor_final_pendente, valor_base_original,
    status, gerada_automaticamente, is_amortizacao_credito, codigo_fatura,
    data_vencimento, ordem_compra_id, orcamento_id, itens_faturados
  ) VALUES (
    v_actor.cliente_id, 'produto', v_offer, v_offer, v_outstanding,
    'pendente', true, true, v_code, current_date + 5,
    v_first_order_id, v_budget.id,
    jsonb_build_array(jsonb_build_object(
      'id', 'quitacao-' || v_budget.id::text,
      'codigo', 'CRE-' || coalesce(v_budget.codigo_orcamento, ''),
      'descricao', 'Quitação total antecipada do pedido #' || coalesce(v_budget.codigo_orcamento, ''),
      'valor', v_offer,
      'quantidade', 1
    ))
  ) RETURNING id INTO v_invoice_id;

  UPDATE public.faturas f
  SET status = 'cancelado', quitacao_fatura_id = v_invoice_id,
      motivo_cancelamento = 'Substituída por fatura de quitação',
      data_cancelamento = now()
  WHERE f.cliente_id = v_actor.cliente_id
    AND f.id <> v_invoice_id
    AND f.status NOT IN ('pago', 'cancelado')
    AND coalesce(f.is_amortizacao_credito, false)
    AND (
      f.orcamento_id = v_budget.id
      OR f.ordem_compra_id IN (
        SELECT oc.id FROM public.ordens_compra oc WHERE oc.orcamento_id = v_budget.id
      )
    );

  UPDATE public.orcamentos
  SET status_quitacao_credito = NULL, valor_quitacao_acordo = NULL
  WHERE id = v_budget.id;

  INSERT INTO public.orcamento_timeline(
    orcamento_id, status, titulo, descricao, metadata
  ) VALUES (
    v_budget.id, 'quitacao_aceita', 'Quitação aceita pelo cliente',
    'Fatura de quitação gerada no valor de R$ ' || to_char(v_offer, 'FM999G999G990D00'),
    jsonb_build_object('fatura_id', v_invoice_id, 'valor_original', v_outstanding, 'valor_quitacao', v_offer)
  );
  INSERT INTO public.notificacoes(
    cliente_id, titulo, mensagem, modulo, tab, item_id,
    destinatario_tipo, acao_origem, contexto
  ) VALUES (
    v_actor.cliente_id, 'Fatura de quitação gerada',
    'A fatura de quitação do seu crédito está disponível para pagamento.',
    'financeiro', 'faturas', v_invoice_id::text,
    'cliente', 'aceitar_quitacao_credito', jsonb_build_object('orcamento_id', v_budget.id)
  );

  RETURN jsonb_build_object(
    'success', true, 'fatura_id', v_invoice_id, 'already_exists', false,
    'valor_original', v_outstanding, 'valor_quitacao', v_offer
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.gsa_client_accept_loan_settlement(
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
  v_loan public.emprestimos%rowtype;
  v_invoice_id uuid;
  v_code text;
  v_offer numeric;
  v_outstanding numeric;
BEGIN
  SELECT * INTO v_actor
  FROM public.gsa_client_session_actor(p_sessao_id, p_session_token)
  LIMIT 1;

  SELECT * INTO v_loan
  FROM public.emprestimos
  WHERE id = p_emprestimo_id
    AND cliente_id = v_actor.cliente_id
  FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Empréstimo não encontrado.'; END IF;

  v_code := 'FAT-QUIT-' || coalesce(v_loan.codigo_emprestimo, v_loan.id::text);
  SELECT id INTO v_invoice_id
  FROM public.faturas
  WHERE codigo_fatura = v_code
    AND cliente_id = v_actor.cliente_id
    AND status <> 'cancelado'
  LIMIT 1;
  IF v_invoice_id IS NOT NULL THEN
    RETURN jsonb_build_object('success', true, 'fatura_id', v_invoice_id, 'already_exists', true);
  END IF;

  IF v_loan.status <> 'aguardando_pagamento_quitacao'
     OR coalesce(v_loan.valor_quitacao_acordo, 0) <= 0 THEN
    RAISE EXCEPTION 'Não existe proposta de quitação disponível.';
  END IF;

  v_offer := round(v_loan.valor_quitacao_acordo, 2);
  SELECT round(coalesce(sum(valor), 0), 2)
  INTO v_outstanding
  FROM public.emprestimo_parcelas
  WHERE emprestimo_id = v_loan.id
    AND cliente_id = v_actor.cliente_id
    AND numero_parcela > 0
    AND status <> 'paga';
  IF v_outstanding <= 0 THEN RAISE EXCEPTION 'Não existem parcelas pendentes para quitação.'; END IF;
  IF v_offer > v_outstanding THEN RAISE EXCEPTION 'A oferta de quitação excede o saldo devedor.'; END IF;

  UPDATE public.faturas
  SET status = 'cancelado', motivo_cancelamento = 'Substituída por fatura de quitação',
      data_cancelamento = now()
  WHERE id IN (
    SELECT fatura_id
    FROM public.emprestimo_parcelas
    WHERE emprestimo_id = v_loan.id
      AND cliente_id = v_actor.cliente_id
      AND status <> 'paga'
      AND fatura_id IS NOT NULL
  ) AND status NOT IN ('pago', 'cancelado');

  INSERT INTO public.faturas(
    cliente_id, tipo, valor_total, valor_final_pendente, valor_base_original,
    data_vencimento, status, codigo_fatura, emprestimo_id, orcamento_id,
    gerada_automaticamente, itens_faturados
  ) VALUES (
    v_actor.cliente_id, 'emprestimo', v_offer, v_offer, v_outstanding,
    current_date + 5, 'pendente', v_code, v_loan.id, v_loan.orcamento_id, true,
    jsonb_build_array(jsonb_build_object(
      'id', 'quitacao-' || v_loan.id::text,
      'codigo', coalesce(v_loan.codigo_emprestimo, ''),
      'descricao', 'Quitação total do empréstimo ' || coalesce(v_loan.codigo_emprestimo, ''),
      'valor', v_offer,
      'quantidade', 1
    ))
  ) RETURNING id INTO v_invoice_id;

  UPDATE public.emprestimo_parcelas
  SET status = 'suspensa', quitacao_fatura_id = v_invoice_id
  WHERE emprestimo_id = v_loan.id
    AND numero_parcela > 0
    AND status <> 'paga';

  INSERT INTO public.emprestimo_parcelas(
    emprestimo_id, cliente_id, fatura_id, numero_parcela,
    valor, data_vencimento, status
  ) VALUES (
    v_loan.id, v_actor.cliente_id, v_invoice_id, 0,
    v_offer, current_date + 5, 'pendente'
  );

  INSERT INTO public.emprestimo_historico(
    emprestimo_id, orcamento_id, tipo_acao, descricao,
    usuario_tipo, usuario_id, metadata
  ) VALUES (
    v_loan.id, v_loan.orcamento_id, 'aceite_quitacao',
    'Cliente aceitou a oferta de quitação de R$ ' || to_char(v_offer, 'FM999G999G990D00'),
    'cliente', v_actor.cliente_id::text,
    jsonb_build_object('fatura_id', v_invoice_id, 'valor_original', v_outstanding)
  );
  INSERT INTO public.notificacoes(
    cliente_id, titulo, mensagem, modulo, tab, item_id,
    destinatario_tipo, acao_origem, contexto
  ) VALUES (
    v_actor.cliente_id, 'Fatura de quitação gerada',
    'A fatura de quitação do seu empréstimo está disponível para pagamento.',
    'financeiro', 'faturas', v_invoice_id::text,
    'cliente', 'aceitar_quitacao_emprestimo', jsonb_build_object('emprestimo_id', v_loan.id)
  );

  RETURN jsonb_build_object(
    'success', true, 'fatura_id', v_invoice_id, 'already_exists', false,
    'valor_original', v_outstanding, 'valor_quitacao', v_offer
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.gsa_client_generate_loan_installment_invoice(
  p_sessao_id uuid,
  p_session_token text,
  p_parcela_id uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_actor record;
  v_installment public.emprestimo_parcelas%rowtype;
  v_loan public.emprestimos%rowtype;
  v_invoice_id uuid;
  v_code text;
  v_value numeric;
  v_created boolean := false;
BEGIN
  SELECT * INTO v_actor
  FROM public.gsa_client_session_actor(p_sessao_id, p_session_token)
  LIMIT 1;

  SELECT * INTO v_installment
  FROM public.emprestimo_parcelas
  WHERE id = p_parcela_id
    AND cliente_id = v_actor.cliente_id
  FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Parcela não encontrada.'; END IF;
  IF v_installment.status = 'paga' THEN RAISE EXCEPTION 'Parcela já está paga.'; END IF;
  IF v_installment.status = 'suspensa' THEN RAISE EXCEPTION 'Parcela suspensa por processo de quitação.'; END IF;

  IF v_installment.fatura_id IS NOT NULL THEN
    RETURN jsonb_build_object('success', true, 'fatura_id', v_installment.fatura_id, 'already_exists', true);
  END IF;

  SELECT * INTO v_loan
  FROM public.emprestimos
  WHERE id = v_installment.emprestimo_id
    AND cliente_id = v_actor.cliente_id
  FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Empréstimo não encontrado.'; END IF;

  v_value := round(coalesce(v_installment.valor, 0), 2);
  IF v_value <= 0 THEN RAISE EXCEPTION 'Valor da parcela inválido.'; END IF;
  v_code := 'FAT-EMP-' || coalesce(v_loan.codigo_emprestimo, v_loan.id::text)
    || '-' || v_installment.numero_parcela::text;

  SELECT id INTO v_invoice_id
  FROM public.faturas
  WHERE codigo_fatura = v_code
    AND cliente_id = v_actor.cliente_id
  LIMIT 1;

  IF v_invoice_id IS NULL THEN
    INSERT INTO public.faturas(
      cliente_id, codigo_fatura, valor_total, valor_final_pendente,
      status, data_vencimento, tipo, emprestimo_id, orcamento_id,
      gerada_automaticamente, itens_faturados
    ) VALUES (
      v_actor.cliente_id, v_code, v_value, v_value, 'pendente',
      v_installment.data_vencimento, 'emprestimo', v_loan.id,
      v_loan.orcamento_id, true,
      jsonb_build_array(jsonb_build_object(
        'id', 'parcela-' || v_installment.id::text,
        'codigo', v_loan.codigo_emprestimo,
        'descricao', 'Parcela ' || v_installment.numero_parcela::text || ' do empréstimo',
        'valor', v_value,
        'quantidade', 1
      ))
    ) RETURNING id INTO v_invoice_id;
    v_created := true;
  END IF;

  UPDATE public.emprestimo_parcelas
  SET fatura_id = v_invoice_id
  WHERE id = v_installment.id;

  IF v_created THEN
    INSERT INTO public.notificacoes(
      cliente_id, titulo, mensagem, modulo, tab, item_id,
      destinatario_tipo, acao_origem, contexto
    ) VALUES (
      v_actor.cliente_id, 'Fatura da parcela gerada',
      'A fatura da parcela ' || v_installment.numero_parcela::text || ' está disponível.',
      'financeiro', 'faturas', v_invoice_id::text,
      'cliente', 'gerar_fatura_parcela_emprestimo',
      jsonb_build_object('emprestimo_id', v_loan.id, 'parcela_id', v_installment.id)
    );
  END IF;

  RETURN jsonb_build_object(
    'success', true, 'fatura_id', v_invoice_id, 'already_exists', NOT v_created
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.gsa_client_extend_subscription(
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
  IF p_request_id IS NULL THEN RAISE EXCEPTION 'Identificador da operação obrigatório.'; END IF;
  IF p_ordem_assinatura_id IS NULL OR p_meses IS NULL OR p_meses < 1 OR p_meses > 36 THEN
    RAISE EXCEPTION 'O período de prorrogação deve ser de 1 a 36 meses.';
  END IF;

  SELECT * INTO v_actor
  FROM public.gsa_client_session_actor(p_sessao_id, p_session_token)
  LIMIT 1;

  INSERT INTO public.gsa_client_operation_requests(request_id, cliente_id, operacao)
  VALUES (p_request_id, v_actor.cliente_id, 'prorrogar_assinatura')
  ON CONFLICT (request_id) DO NOTHING
  RETURNING request_id INTO v_inserted;

  IF v_inserted IS NULL THEN
    SELECT resultado INTO v_result
    FROM public.gsa_client_operation_requests
    WHERE request_id = p_request_id
      AND cliente_id = v_actor.cliente_id
      AND operacao = 'prorrogar_assinatura';
    IF NOT FOUND THEN RAISE EXCEPTION 'Identificador da operação já utilizado.'; END IF;
    IF v_result IS NULL THEN RAISE EXCEPTION 'Operação ainda em processamento.'; END IF;
    RETURN v_result || jsonb_build_object('already_exists', true);
  END IF;

  SELECT * INTO v_order
  FROM public.ordens_assinatura
  WHERE id = p_ordem_assinatura_id
    AND cliente_id = v_actor.cliente_id
  FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Assinatura não encontrada.'; END IF;
  IF v_order.status IN ('cancelado', 'em_cancelamento') THEN
    RAISE EXCEPTION 'Assinatura cancelada não pode ser prorrogada.';
  END IF;

  SELECT * INTO v_plan
  FROM public.assinaturas
  WHERE id = v_order.assinatura_id
    AND status = 'ativo';
  IF NOT FOUND THEN RAISE EXCEPTION 'Plano de assinatura indisponível.'; END IF;
  v_price := round(greatest(coalesce(v_plan.valor, 0), 0), 2);
  IF v_price <= 0 THEN RAISE EXCEPTION 'Valor do plano de assinatura inválido.'; END IF;

  SELECT greatest(
    current_date,
    coalesce(v_order.data_vencimento::date, current_date),
    coalesce(max(data_vencimento), current_date)
  ) INTO v_base_date
  FROM public.faturas
  WHERE ordem_assinatura_id = v_order.id
    AND status <> 'cancelado';

  FOR v_i IN 1..p_meses LOOP
    v_due_date := (v_base_date + make_interval(months => v_i))::date;
    INSERT INTO public.faturas(
      codigo_fatura, ordem_assinatura_id, orcamento_id, cliente_id,
      valor_total, valor_final_pendente, status, tipo, data_vencimento,
      gerada_automaticamente, itens_faturados
    ) VALUES (
      public.gsa_generate_code('FAT'), v_order.id, v_order.orcamento_id,
      v_actor.cliente_id, v_price, v_price, 'pendente', 'assinatura',
      v_due_date, true,
      jsonb_build_array(jsonb_build_object(
        'id', 'prorrogacao-' || p_request_id::text || '-' || v_i::text,
        'codigo', v_plan.codigo_assinatura,
        'descricao', 'Prorrogação de assinatura: ' || v_plan.nome,
        'valor', v_price,
        'quantidade', 1,
        'mes_prorrogado', v_i
      ))
    ) RETURNING id INTO v_invoice_id;
    v_invoice_ids := array_append(v_invoice_ids, v_invoice_id);
  END LOOP;

  UPDATE public.ordens_assinatura
  SET prazo_meses = coalesce(prazo_meses, 0) + p_meses,
      data_vencimento = (v_base_date + make_interval(months => p_meses))::date
  WHERE id = v_order.id;

  v_result := jsonb_build_object(
    'success', true, 'already_exists', false,
    'faturas_ids', to_jsonb(v_invoice_ids),
    'meses', p_meses,
    'nova_data_vencimento', (v_base_date + make_interval(months => p_meses))::date
  );
  UPDATE public.gsa_client_operation_requests
  SET resultado = v_result, completed_at = now()
  WHERE request_id = p_request_id;

  INSERT INTO public.notificacoes(
    cliente_id, titulo, mensagem, modulo, tab, item_id,
    destinatario_tipo, acao_origem, contexto
  ) VALUES (
    v_actor.cliente_id, 'Assinatura prorrogada',
    'Sua assinatura ' || v_plan.nome || ' foi prorrogada por ' || p_meses || ' mês(es).',
    'servicos_assinaturas', 'assinaturas', v_order.id::text,
    'cliente', 'prorrogar_assinatura',
    jsonb_build_object('ordem_assinatura_id', v_order.id, 'meses', p_meses)
  );

  RETURN v_result;
END;
$$;

CREATE OR REPLACE FUNCTION public.gsa_client_redeem_wallet_voucher(
  p_sessao_id uuid,
  p_session_token text,
  p_voucher_id uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_actor record;
  v_voucher public.vouchers%rowtype;
  v_client public.clientes%rowtype;
  v_value numeric;
  v_new_balance numeric;
  v_redemption_id uuid;
  v_previous public.gsa_voucher_resgates%rowtype;
BEGIN
  SELECT * INTO v_actor
  FROM public.gsa_client_session_actor(p_sessao_id, p_session_token)
  LIMIT 1;

  SELECT * INTO v_voucher
  FROM public.vouchers
  WHERE id = p_voucher_id
  FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Voucher não encontrado.'; END IF;

  SELECT * INTO v_previous
  FROM public.gsa_voucher_resgates
  WHERE voucher_id = v_voucher.id
    AND cliente_id = v_actor.cliente_id;
  IF FOUND THEN
    SELECT saldo_carteira INTO v_new_balance
    FROM public.clientes WHERE id = v_actor.cliente_id;
    RETURN jsonb_build_object(
      'success', true, 'already_exists', true,
      'valor', v_previous.valor, 'saldo_carteira', v_new_balance
    );
  END IF;

  IF v_voucher.status <> 'ativo' THEN RAISE EXCEPTION 'Voucher não está ativo.'; END IF;
  IF v_voucher.categoria <> 'saque' THEN RAISE EXCEPTION 'Voucher não é válido para resgate em carteira.'; END IF;
  IF v_voucher.cliente_id IS NOT NULL AND v_voucher.cliente_id <> v_actor.cliente_id THEN
    RAISE EXCEPTION 'Voucher não pertence a este cliente.';
  END IF;
  IF v_voucher.validade IS NOT NULL AND v_voucher.validade < current_date THEN
    RAISE EXCEPTION 'Voucher expirado.';
  END IF;
  IF coalesce(v_voucher.usage_limit, 0) > 0
     AND coalesce(v_voucher.usage_count, 0) >= v_voucher.usage_limit THEN
    RAISE EXCEPTION 'Limite de uso do voucher atingido.';
  END IF;

  SELECT * INTO v_client
  FROM public.clientes
  WHERE id = v_actor.cliente_id
  FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Cliente não encontrado.'; END IF;
  IF coalesce(v_client.carteira_bloqueada, false) THEN RAISE EXCEPTION 'A carteira está bloqueada.'; END IF;

  v_value := round(greatest(coalesce(v_voucher.valor, 0), 0), 2);
  IF v_value <= 0 THEN RAISE EXCEPTION 'Valor do voucher inválido.'; END IF;
  v_new_balance := round(coalesce(v_client.saldo_carteira, 0) + v_value, 2);

  INSERT INTO public.gsa_voucher_resgates(voucher_id, cliente_id, valor)
  VALUES (v_voucher.id, v_actor.cliente_id, v_value)
  RETURNING id INTO v_redemption_id;

  UPDATE public.clientes
  SET saldo_carteira = v_new_balance
  WHERE id = v_actor.cliente_id;
  INSERT INTO public.carteira_lancamentos(cliente_id, valor, tipo, descricao)
  VALUES (
    v_actor.cliente_id, v_value, 'credito',
    'Resgate de voucher: ' || coalesce(v_voucher.codigo_voucher, v_voucher.id::text)
  );
  INSERT INTO public.extrato_financeiro(
    cliente_id, tipo, valor, descricao, saldo_resultante,
    referencia_id, modulo_referencia
  ) VALUES (
    v_actor.cliente_id, 'entrada', v_value,
    'Resgate de voucher: ' || coalesce(v_voucher.codigo_voucher, v_voucher.id::text),
    v_new_balance, v_voucher.id, 'vouchers'
  );

  UPDATE public.vouchers
  SET usage_count = coalesce(usage_count, 0) + 1,
      status = CASE
        WHEN coalesce(usage_limit, 0) > 0
         AND coalesce(usage_count, 0) + 1 >= usage_limit THEN 'usado'
        ELSE status
      END,
      data_uso = now(),
      tipo_uso = 'Resgate para carteira'
  WHERE id = v_voucher.id;

  INSERT INTO public.notificacoes(
    cliente_id, titulo, mensagem, modulo, tab, item_id,
    destinatario_tipo, acao_origem, contexto
  ) VALUES (
    v_actor.cliente_id, 'Voucher resgatado',
    'O valor de R$ ' || to_char(v_value, 'FM999G999G990D00') || ' foi adicionado à sua carteira.',
    'financeiro', 'extrato', v_redemption_id::text,
    'cliente', 'resgatar_voucher', jsonb_build_object('voucher_id', v_voucher.id)
  );

  RETURN jsonb_build_object(
    'success', true, 'already_exists', false,
    'resgate_id', v_redemption_id, 'valor', v_value, 'saldo_carteira', v_new_balance
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.gsa_client_process_welcome_bonus(
  p_sessao_id uuid,
  p_session_token text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_actor record;
  v_client public.clientes%rowtype;
  v_bonus_type text;
  v_bonus_value numeric;
  v_points integer;
  v_existing boolean;
  v_new_balance numeric;
BEGIN
  SELECT * INTO v_actor
  FROM public.gsa_client_session_actor(p_sessao_id, p_session_token)
  LIMIT 1;

  SELECT * INTO v_client
  FROM public.clientes
  WHERE id = v_actor.cliente_id
  FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Cliente não encontrado.'; END IF;

  SELECT lower(trim(value)) INTO v_bonus_type
  FROM public.system_settings WHERE key = 'bonus_cadastro_tipo';
  SELECT value::numeric INTO v_bonus_value
  FROM public.system_settings WHERE key = 'bonus_cadastro_valor';
  v_bonus_type := CASE WHEN v_bonus_type = 'carteira' THEN 'carteira' ELSE 'pontos' END;
  v_bonus_value := round(greatest(coalesce(v_bonus_value, 100), 0), 2);

  IF v_client.status <> 'ativo' THEN
    RETURN jsonb_build_object('success', true, 'processed', false, 'reason', 'cliente_inativo');
  END IF;
  IF v_client.indicacao_origem_id IS NOT NULL THEN
    UPDATE public.clientes SET bonus_boas_vindas_pendente = false WHERE id = v_client.id;
    RETURN jsonb_build_object('success', true, 'processed', false, 'reason', 'cliente_indicado');
  END IF;
  IF coalesce(v_client.bonus_boas_vindas_pendente, false) IS NOT TRUE THEN
    RETURN jsonb_build_object('success', true, 'processed', false, 'reason', 'sem_bonus_pendente');
  END IF;
  IF v_bonus_value <= 0 THEN RAISE EXCEPTION 'Configuração do bônus de boas-vindas inválida.'; END IF;

  SELECT EXISTS (
    SELECT 1 FROM public.pontos_movimentacoes
    WHERE cliente_id = v_client.id AND descricao = 'Bônus de Boas-vindas'
    UNION ALL
    SELECT 1 FROM public.carteira_lancamentos
    WHERE cliente_id = v_client.id AND descricao = 'Bônus de Boas-vindas'
  ) INTO v_existing;
  IF v_existing THEN
    UPDATE public.clientes SET bonus_boas_vindas_pendente = false WHERE id = v_client.id;
    RETURN jsonb_build_object('success', true, 'processed', false, 'reason', 'bonus_ja_processado');
  END IF;

  PERFORM set_config('my.app.bypass_saldo_check', 'on', true);
  IF v_bonus_type = 'carteira' THEN
    v_new_balance := round(coalesce(v_client.saldo_carteira, 0) + v_bonus_value, 2);
    UPDATE public.clientes
    SET saldo_carteira = v_new_balance, bonus_boas_vindas_pendente = false
    WHERE id = v_client.id;
    INSERT INTO public.carteira_lancamentos(cliente_id, valor, tipo, descricao)
    VALUES (v_client.id, v_bonus_value, 'credito', 'Bônus de Boas-vindas');
    INSERT INTO public.extrato_financeiro(
      cliente_id, tipo, valor, descricao, saldo_resultante, modulo_referencia
    ) VALUES (
      v_client.id, 'entrada', v_bonus_value, 'Bônus de Boas-vindas',
      v_new_balance, 'boas_vindas'
    );
  ELSE
    v_points := floor(v_bonus_value)::integer;
    IF v_points <= 0 THEN RAISE EXCEPTION 'Quantidade de pontos do bônus inválida.'; END IF;
    UPDATE public.clientes
    SET saldo_pontos = coalesce(saldo_pontos, 0) + v_points,
        pontos_totais = coalesce(pontos_totais, 0) + v_points,
        bonus_boas_vindas_pendente = false
    WHERE id = v_client.id;
    INSERT INTO public.pontos_movimentacoes(
      cliente_id, tipo, pontos, saldo_apos, descricao
    ) VALUES (
      v_client.id, 'bonus', v_points,
      coalesce(v_client.saldo_pontos, 0) + v_points,
      'Bônus de Boas-vindas'
    );
    INSERT INTO public.points_transactions(cliente_id, tipo, pontos, descricao)
    VALUES (v_client.id, 'bonus', v_points, 'Bônus de Boas-vindas');
    v_bonus_value := v_points;
  END IF;

  INSERT INTO public.notificacoes(
    cliente_id, titulo, mensagem, modulo, destinatario_tipo,
    prioridade, data_criacao, acao_origem
  ) VALUES
    (v_client.id, 'Bem-vindo(a)!', 'Seu cadastro foi aprovado e o portal está liberado.',
      'dashboard', 'cliente', 'alta', now(), 'bonus_boas_vindas'),
    (v_client.id, 'Bônus recebido',
      CASE WHEN v_bonus_type = 'carteira'
        THEN 'Você recebeu R$ ' || to_char(v_bonus_value, 'FM999G999G990D00') || ' na carteira.'
        ELSE 'Você recebeu ' || v_bonus_value::integer || ' pontos de boas-vindas.'
      END,
      'dashboard', 'cliente', 'normal', now() + interval '1 millisecond', 'bonus_boas_vindas');

  RETURN jsonb_build_object(
    'success', true, 'processed', true,
    'bonus_tipo', v_bonus_type, 'bonus_valor', v_bonus_value
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.gsa_client_release_signed_credit(
  p_sessao_id uuid,
  p_session_token text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_actor record;
  v_request public.loja_credito_solicitacoes%rowtype;
  v_client public.clientes%rowtype;
  v_current_total numeric;
  v_current_available numeric;
  v_used numeric;
  v_new_total numeric;
  v_new_available numeric;
  v_variation numeric;
  v_movement_type text;
  v_count integer := 0;
BEGIN
  SELECT * INTO v_actor
  FROM public.gsa_client_session_actor(p_sessao_id, p_session_token)
  LIMIT 1;

  FOR v_request IN
    SELECT *
    FROM public.loja_credito_solicitacoes
    WHERE cliente_id = v_actor.cliente_id
      AND status = 'contrato_assinado'
      AND data_liberacao_credito <= current_date
    ORDER BY data_liberacao_credito, id
    FOR UPDATE
  LOOP
    SELECT * INTO v_client
    FROM public.clientes
    WHERE id = v_actor.cliente_id
    FOR UPDATE;
    IF NOT FOUND THEN RAISE EXCEPTION 'Cliente não encontrado.'; END IF;

    v_current_total := round(greatest(coalesce(v_client.limite_credito_total, 0), 0), 2);
    v_current_available := round(greatest(coalesce(v_client.limite_credito_disponivel, 0), 0), 2);
    v_used := greatest(v_current_total - v_current_available, 0);
    v_new_total := round(greatest(coalesce(v_request.limite_aprovado, 0), 0), 2);
    IF v_new_total <= 0 THEN RAISE EXCEPTION 'Limite aprovado inválido.'; END IF;
    IF v_new_total < v_used THEN
      RAISE EXCEPTION 'O limite aprovado é inferior ao crédito já utilizado.';
    END IF;

    v_variation := v_new_total - v_current_total;
    v_new_available := round(v_new_total - v_used, 2);
    v_movement_type := CASE WHEN v_request.tipo_solicitacao = 'adesao'
      THEN 'concessao_inicial' ELSE 'solicitacao_aumento_aprovada' END;

    UPDATE public.clientes
    SET limite_credito_total = v_new_total,
        limite_credito_disponivel = v_new_available,
        opcao_pagamento_parcelado = v_request.opcao_pagamento_parcelado
    WHERE id = v_actor.cliente_id;

    INSERT INTO public.loja_credito_movimentacoes(
      cliente_id, solicitacao_id, tipo, valor,
      limite_total_anterior, limite_total_novo,
      limite_disponivel_anterior, limite_disponivel_novo, descricao
    ) VALUES (
      v_actor.cliente_id, v_request.id, v_movement_type, v_variation,
      v_current_total, v_new_total, v_current_available, v_new_available,
      CASE WHEN v_request.tipo_solicitacao = 'adesao'
        THEN 'Ativação automática do limite de crédito contratado'
        ELSE 'Alteração automática do limite de crédito contratado'
      END
    );
    UPDATE public.loja_credito_solicitacoes
    SET status = 'liberado', updated_at = now()
    WHERE id = v_request.id;

    INSERT INTO public.notificacoes(
      cliente_id, titulo, mensagem, modulo, tab, item_id,
      destinatario_tipo, acao_origem, contexto
    ) VALUES (
      v_actor.cliente_id, 'Crédito liberado',
      'Seu limite de crédito de R$ ' || to_char(v_new_total, 'FM999G999G990D00') || ' está disponível.',
      'financeiro', 'credito', v_request.id::text,
      'cliente', 'liberar_credito_assinado',
      jsonb_build_object('limite_total', v_new_total, 'limite_disponivel', v_new_available)
    );
    v_count := v_count + 1;
  END LOOP;

  RETURN jsonb_build_object('success', true, 'liberados', v_count);
END;
$$;

CREATE OR REPLACE FUNCTION public.process_expired_quitacoes()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_invoice record;
BEGIN
  FOR v_invoice IN
    SELECT f.id, f.emprestimo_id, f.orcamento_id
    FROM public.faturas f
    WHERE f.status IN ('pendente', 'vencida')
      AND f.data_vencimento < current_date
      AND EXISTS (
        SELECT 1
        FROM jsonb_array_elements(coalesce(f.itens_faturados, '[]'::jsonb)) AS item
        WHERE coalesce(item ->> 'id', '') LIKE 'quitacao-%'
      )
    FOR UPDATE
  LOOP
    UPDATE public.faturas
    SET status = 'cancelado', motivo_cancelamento = 'Oferta de quitação expirada',
        data_cancelamento = now()
    WHERE id = v_invoice.id;

    UPDATE public.faturas
    SET status = CASE WHEN data_vencimento < current_date THEN 'vencida' ELSE 'pendente' END,
        quitacao_fatura_id = NULL,
        motivo_cancelamento = NULL,
        data_cancelamento = NULL
    WHERE quitacao_fatura_id = v_invoice.id
      AND status = 'cancelado';

    UPDATE public.emprestimo_parcelas
    SET status = CASE WHEN data_vencimento < current_date THEN 'vencida' ELSE 'pendente' END,
        quitacao_fatura_id = NULL
    WHERE quitacao_fatura_id = v_invoice.id
      AND status = 'suspensa';
    DELETE FROM public.emprestimo_parcelas
    WHERE fatura_id = v_invoice.id AND numero_parcela = 0;

    UPDATE public.emprestimos
    SET status = 'ativo', valor_quitacao_acordo = NULL, updated_at = now()
    WHERE id = v_invoice.emprestimo_id
      AND status = 'aguardando_pagamento_quitacao';
    UPDATE public.orcamentos
    SET status_quitacao_credito = NULL, valor_quitacao_acordo = NULL
    WHERE id = v_invoice.orcamento_id;
  END LOOP;
END;
$$;

REVOKE ALL ON FUNCTION public.assinar_area_vip_cliente(jsonb) FROM public, anon, authenticated;
REVOKE ALL ON FUNCTION public.aceitar_quitacao_credito_loja(uuid, uuid) FROM public, anon, authenticated;
REVOKE ALL ON FUNCTION public.aceitar_quitacao_emprestimo(uuid, uuid) FROM public, anon, authenticated;
REVOKE ALL ON FUNCTION public.gerar_fatura_parcela_emprestimo(uuid, uuid) FROM public, anon, authenticated;
REVOKE ALL ON FUNCTION public.prorrogar_assinatura_cliente(uuid, uuid, integer) FROM public, anon, authenticated;
REVOKE ALL ON FUNCTION public.resgatar_voucher_carteira(uuid, uuid) FROM public, anon, authenticated;
REVOKE ALL ON FUNCTION public.processar_bonus_boas_vindas_seguro(uuid) FROM public, anon, authenticated;
REVOKE ALL ON FUNCTION public.suprimir_bonus_boas_vindas_cliente(uuid) FROM public, anon, authenticated;
REVOKE ALL ON FUNCTION public.liberar_credito_loja_assinado(uuid) FROM public, anon, authenticated;

REVOKE ALL ON FUNCTION public.gsa_client_subscribe_vip(uuid, text, uuid, uuid) FROM public;
REVOKE ALL ON FUNCTION public.gsa_client_accept_store_credit_settlement(uuid, text, uuid) FROM public;
REVOKE ALL ON FUNCTION public.gsa_client_accept_loan_settlement(uuid, text, uuid) FROM public;
REVOKE ALL ON FUNCTION public.gsa_client_generate_loan_installment_invoice(uuid, text, uuid) FROM public;
REVOKE ALL ON FUNCTION public.gsa_client_extend_subscription(uuid, text, uuid, uuid, integer) FROM public;
REVOKE ALL ON FUNCTION public.gsa_client_redeem_wallet_voucher(uuid, text, uuid) FROM public;
REVOKE ALL ON FUNCTION public.gsa_client_process_welcome_bonus(uuid, text) FROM public;
REVOKE ALL ON FUNCTION public.gsa_client_release_signed_credit(uuid, text) FROM public;

GRANT EXECUTE ON FUNCTION public.gsa_client_subscribe_vip(uuid, text, uuid, uuid) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.gsa_client_accept_store_credit_settlement(uuid, text, uuid) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.gsa_client_accept_loan_settlement(uuid, text, uuid) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.gsa_client_generate_loan_installment_invoice(uuid, text, uuid) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.gsa_client_extend_subscription(uuid, text, uuid, uuid, integer) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.gsa_client_redeem_wallet_voucher(uuid, text, uuid) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.gsa_client_process_welcome_bonus(uuid, text) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.gsa_client_release_signed_credit(uuid, text) TO anon, authenticated;

