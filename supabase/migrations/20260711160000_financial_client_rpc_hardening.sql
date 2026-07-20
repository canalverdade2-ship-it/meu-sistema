CREATE OR REPLACE FUNCTION public.gsa_generate_code(p_prefix text)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN upper(p_prefix) || '-' || upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 10));
END;
$$;

CREATE OR REPLACE FUNCTION public.pagar_fatura_cliente(payload jsonb)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_fatura faturas%rowtype;
  v_cliente clientes%rowtype;
  v_voucher vouchers%rowtype;
  v_fatura_id uuid := (payload->>'fatura_id')::uuid;
  v_cliente_id uuid := (payload->>'cliente_id')::uuid;
  v_voucher_id uuid := nullif(payload->>'voucher_id', '')::uuid;
  v_metodo text := coalesce(nullif(payload->>'metodo', ''), 'carteira');
  v_use_wallet boolean := coalesce((payload->>'use_wallet')::boolean, false);
  v_use_pontos boolean := coalesce((payload->>'use_pontos')::boolean, false);
  v_taxa_conversao numeric := greatest(coalesce((payload->>'taxa_conversao')::numeric, 0.01), 0.0001);
  v_subtotal numeric;
  v_voucher_discount numeric := 0;
  v_wallet_deduction numeric := 0;
  v_pontos_deduction numeric := 0;
  v_pontos_utilizados integer := 0;
  v_negative_charge numeric := 0;
  v_net_total numeric := 0;
  v_is_store_invoice boolean := false;
  v_novo_status text;
  v_paid_now numeric;
  v_now timestamptz := now();
BEGIN
  IF v_fatura_id IS NULL OR v_cliente_id IS NULL THEN
    RAISE EXCEPTION 'Dados obrigatórios da fatura ausentes.';
  END IF;

  SELECT * INTO v_fatura FROM faturas WHERE id = v_fatura_id AND cliente_id = v_cliente_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Fatura não encontrada.';
  END IF;
  IF v_fatura.status IN ('pago', 'cancelado') THEN
    RAISE EXCEPTION 'Esta fatura já foi finalizada.';
  END IF;

  SELECT * INTO v_cliente FROM clientes WHERE id = v_cliente_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Cliente não encontrado.';
  END IF;

  v_subtotal := round(coalesce(v_fatura.valor_final_pendente, v_fatura.valor_total, 0), 2);
  IF v_subtotal <= 0 THEN
    RAISE EXCEPTION 'Fatura sem valor pendente.';
  END IF;

  v_is_store_invoice := v_fatura.ordem_compra_id IS NOT NULL
    OR (v_fatura.ordem_assinatura_id IS NOT NULL AND coalesce(v_fatura.codigo_fatura, '') ~ '-1/[0-9]+$');

  IF v_voucher_id IS NOT NULL THEN
    SELECT * INTO v_voucher FROM vouchers WHERE id = v_voucher_id FOR UPDATE;
    IF NOT FOUND OR v_voucher.status <> 'ativo' THEN
      RAISE EXCEPTION 'Voucher inválido ou expirado.';
    END IF;
    IF v_voucher.cliente_id IS NOT NULL AND v_voucher.cliente_id <> v_cliente_id THEN
      RAISE EXCEPTION 'Voucher não pertence a este cliente.';
    END IF;
    IF v_voucher.validade IS NOT NULL AND v_voucher.validade < current_date THEN
      RAISE EXCEPTION 'Voucher expirado.';
    END IF;
    IF coalesce(v_voucher.usage_limit, 0) > 0 AND coalesce(v_voucher.usage_count, 0) >= v_voucher.usage_limit THEN
      RAISE EXCEPTION 'Limite de uso do voucher atingido.';
    END IF;
    IF v_voucher.categoria = 'saque' THEN
      RAISE EXCEPTION 'Este voucher não pode ser aplicado em fatura.';
    END IF;

    v_voucher_discount := CASE
      WHEN v_voucher.tipo = 'porcentagem' THEN round(v_subtotal * (v_voucher.valor / 100), 2)
      ELSE round(v_voucher.valor, 2)
    END;
    v_voucher_discount := least(greatest(v_voucher_discount, 0), v_subtotal);

    UPDATE vouchers
      SET usage_count = coalesce(usage_count, 0) + 1,
          status = CASE
            WHEN coalesce(usage_limit, 0) > 0 AND coalesce(usage_count, 0) + 1 >= usage_limit THEN 'expirado'
            ELSE status
          END,
          data_uso = v_now,
          tipo_uso = 'fatura'
      WHERE id = v_voucher_id;
  END IF;

  IF v_use_wallet AND NOT v_is_store_invoice THEN
    IF coalesce(v_cliente.carteira_bloqueada, false) THEN
      RAISE EXCEPTION 'Carteira bloqueada.';
    END IF;
    v_wallet_deduction := round(least(greatest(coalesce(v_cliente.saldo_carteira, 0), 0), greatest(v_subtotal - v_voucher_discount, 0)), 2);
  END IF;

  IF v_use_pontos AND NOT v_is_store_invoice THEN
    IF coalesce(v_cliente.pontos_bloqueados, false) THEN
      RAISE EXCEPTION 'Carteira de pontos bloqueada.';
    END IF;
    v_pontos_deduction := round(least(greatest(coalesce(v_cliente.saldo_pontos, 0) * v_taxa_conversao, 0), greatest(v_subtotal - v_voucher_discount - v_wallet_deduction, 0)), 2);
    v_pontos_utilizados := ceil(v_pontos_deduction / v_taxa_conversao);
    IF v_pontos_utilizados > coalesce(v_cliente.saldo_pontos, 0) THEN
      RAISE EXCEPTION 'Saldo de pontos insuficiente.';
    END IF;
  END IF;

  v_negative_charge := CASE WHEN coalesce(v_cliente.saldo_carteira, 0) < 0 THEN abs(v_cliente.saldo_carteira) ELSE 0 END;
  v_net_total := round(greatest(v_subtotal - v_voucher_discount - v_wallet_deduction - v_pontos_deduction, 0) + v_negative_charge, 2);
  v_novo_status := CASE WHEN v_net_total <= 0 THEN 'pago' ELSE 'pendente_pagamento' END;
  v_paid_now := round(v_voucher_discount + v_wallet_deduction + v_pontos_deduction, 2);

  IF v_wallet_deduction > 0 THEN
    UPDATE clientes SET saldo_carteira = coalesce(saldo_carteira, 0) - v_wallet_deduction WHERE id = v_cliente_id;
    INSERT INTO extrato_financeiro(cliente_id, tipo, valor, descricao, referencia_id, modulo_referencia, saldo_resultante)
    VALUES (v_cliente_id, 'saida', v_wallet_deduction, 'Uso de Saldo - Fatura ' || coalesce(v_fatura.codigo_fatura, 'N/A'), v_fatura_id, 'faturas', coalesce(v_cliente.saldo_carteira, 0) - v_wallet_deduction);
    INSERT INTO pagamentos(fatura_id, valor, metodo, data_pagamento)
    VALUES (v_fatura_id, v_wallet_deduction, 'carteira', v_now);
  END IF;

  IF v_pontos_deduction > 0 THEN
    UPDATE clientes SET saldo_pontos = coalesce(saldo_pontos, 0) - v_pontos_utilizados WHERE id = v_cliente_id;
    INSERT INTO pontos_movimentacoes(cliente_id, fatura_id, tipo, pontos, saldo_apos, descricao, valor_convertido)
    VALUES (v_cliente_id, v_fatura_id, 'uso_fatura', -v_pontos_utilizados, coalesce(v_cliente.saldo_pontos, 0) - v_pontos_utilizados, 'Uso de pontos na fatura ' || coalesce(v_fatura.codigo_fatura, 'N/A'), v_pontos_deduction);
    INSERT INTO points_transactions(cliente_id, tipo, pontos, descricao)
    VALUES (v_cliente_id, 'uso_fatura', -v_pontos_utilizados, 'Uso de pontos na fatura ' || coalesce(v_fatura.codigo_fatura, 'N/A'));
    INSERT INTO pagamentos(fatura_id, valor, metodo, data_pagamento)
    VALUES (v_fatura_id, v_pontos_deduction, 'pontos', v_now);
  END IF;

  IF v_voucher_discount > 0 THEN
    INSERT INTO pagamentos(fatura_id, voucher_id, valor, metodo, data_pagamento)
    VALUES (v_fatura_id, v_voucher_id, v_voucher_discount, 'voucher', v_now);
  END IF;

  UPDATE faturas
    SET status = v_novo_status,
        valor_pago = round(coalesce(valor_pago, 0) + v_paid_now, 2),
        valor_final_pendente = v_net_total,
        data_pagamento = CASE WHEN v_novo_status = 'pago' THEN v_now ELSE data_pagamento END,
        forma_pagamento_escolhida = v_metodo,
        data_escolha_pagamento = v_now,
        desconto_voucher_aplicado = coalesce(desconto_voucher_aplicado, 0) + v_voucher_discount,
        abatimento_carteira_aplicado = coalesce(abatimento_carteira_aplicado, 0) + v_wallet_deduction,
        desconto_pontos_aplicado = coalesce(desconto_pontos_aplicado, 0) + v_pontos_deduction
    WHERE id = v_fatura_id;

  RETURN jsonb_build_object(
    'success', true,
    'fatura_id', v_fatura_id,
    'status', v_novo_status,
    'subtotal', v_subtotal,
    'valor_pago_agora', v_paid_now,
    'valor_pendente', v_net_total,
    'voucher_discount', v_voucher_discount,
    'wallet_deduction', v_wallet_deduction,
    'pontos_deduction', v_pontos_deduction,
    'pontos_utilizados', v_pontos_utilizados
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.solicitar_saque_cliente(payload jsonb)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_cliente clientes%rowtype;
  v_saque_id uuid;
  v_cliente_id uuid := (payload->>'cliente_id')::uuid;
  v_valor numeric := round((payload->>'valor')::numeric, 2);
  v_taxa numeric := round(coalesce((payload->>'taxa_aplicada')::numeric, 0), 2);
  v_tipo_pix text := nullif(payload->>'tipo_chave_pix', '');
  v_chave_pix text := nullif(payload->>'chave_pix', '');
  v_min numeric := round(coalesce((payload->>'min_saque')::numeric, 0), 2);
  v_novo_saldo numeric;
BEGIN
  IF v_cliente_id IS NULL OR v_valor IS NULL OR v_valor <= 0 OR v_chave_pix IS NULL THEN
    RAISE EXCEPTION 'Dados inválidos para saque.';
  END IF;
  IF v_valor < v_min THEN
    RAISE EXCEPTION 'Valor abaixo do mínimo permitido para saque.';
  END IF;

  SELECT * INTO v_cliente FROM clientes WHERE id = v_cliente_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Cliente não encontrado.'; END IF;
  IF coalesce(v_cliente.carteira_bloqueada, false) THEN RAISE EXCEPTION 'Carteira bloqueada para saque.'; END IF;
  IF coalesce(v_cliente.saldo_carteira, 0) < v_valor THEN RAISE EXCEPTION 'Saldo insuficiente para saque.'; END IF;

  v_novo_saldo := round(coalesce(v_cliente.saldo_carteira, 0) - v_valor, 2);

  INSERT INTO saques(cliente_id, valor, taxa_aplicada, valor_liquido, tipo_chave_pix, chave_pix, status, data_solicitacao)
  VALUES (v_cliente_id, v_valor, v_taxa, round(v_valor * (1 - v_taxa / 100), 2), v_tipo_pix, v_chave_pix, 'pendente', now())
  RETURNING id INTO v_saque_id;

  UPDATE clientes SET saldo_carteira = v_novo_saldo WHERE id = v_cliente_id;
  INSERT INTO extrato_financeiro(cliente_id, tipo, valor, descricao, referencia_id, modulo_referencia, saldo_resultante)
  VALUES (v_cliente_id, 'saida', v_valor, 'Solicitação de Saque', v_saque_id, 'saques', v_novo_saldo);

  RETURN jsonb_build_object('success', true, 'saque_id', v_saque_id, 'saldo_carteira', v_novo_saldo);
END;
$$;

CREATE OR REPLACE FUNCTION public.cancelar_saque_cliente(p_saque_id uuid, p_cliente_id uuid, p_motivo text DEFAULT 'Cancelado pelo cliente')
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_saque saques%rowtype;
  v_cliente clientes%rowtype;
  v_novo_saldo numeric;
BEGIN
  SELECT * INTO v_saque FROM saques WHERE id = p_saque_id AND cliente_id = p_cliente_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Saque não encontrado.'; END IF;
  IF v_saque.status <> 'pendente' THEN RAISE EXCEPTION 'Este saque já foi processado e não pode mais ser cancelado.'; END IF;

  SELECT * INTO v_cliente FROM clientes WHERE id = p_cliente_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Cliente não encontrado.'; END IF;

  v_novo_saldo := round(coalesce(v_cliente.saldo_carteira, 0) + coalesce(v_saque.valor, 0), 2);
  UPDATE saques SET status = 'cancelado', motivo_cancelamento = coalesce(nullif(p_motivo, ''), 'Cancelado pelo cliente') WHERE id = p_saque_id;
  UPDATE clientes SET saldo_carteira = v_novo_saldo WHERE id = p_cliente_id;
  INSERT INTO extrato_financeiro(cliente_id, tipo, valor, descricao, referencia_id, modulo_referencia, saldo_resultante)
  VALUES (p_cliente_id, 'entrada', v_saque.valor, 'Estorno de Saque Cancelado (#' || substr(p_saque_id::text, 1, 8) || ')', p_saque_id, 'saques', v_novo_saldo);

  RETURN jsonb_build_object('success', true, 'saque_id', p_saque_id, 'saldo_carteira', v_novo_saldo);
END;
$$;

CREATE OR REPLACE FUNCTION public.solicitar_transferencia_cliente(payload jsonb)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_origem clientes%rowtype;
  v_destino clientes%rowtype;
  v_level_taxa numeric := 0;
  v_transferencia_id uuid;
  v_origem_id uuid := (payload->>'cliente_origem_id')::uuid;
  v_destino_id uuid := (payload->>'cliente_destino_id')::uuid;
  v_tipo text := coalesce(nullif(payload->>'tipo', ''), 'saldo');
  v_valor numeric := round((payload->>'valor')::numeric, 2);
  v_motivo text := nullif(payload->>'motivo', '');
  v_taxa_valor numeric;
  v_valor_liquido numeric;
  v_novo_saldo numeric;
BEGIN
  IF v_origem_id IS NULL OR v_destino_id IS NULL OR v_origem_id = v_destino_id OR v_valor IS NULL OR v_valor <= 0 OR v_motivo IS NULL THEN
    RAISE EXCEPTION 'Dados inválidos para transferência.';
  END IF;
  IF v_tipo NOT IN ('saldo', 'pontos') THEN RAISE EXCEPTION 'Tipo de transferência inválido.'; END IF;

  SELECT * INTO v_origem FROM clientes WHERE id = v_origem_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Cliente de origem não encontrado.'; END IF;
  SELECT * INTO v_destino FROM clientes WHERE id = v_destino_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Destinatário não encontrado.'; END IF;

  IF v_tipo = 'saldo' AND coalesce(v_origem.carteira_bloqueada, false) THEN RAISE EXCEPTION 'Carteira bloqueada.'; END IF;
  IF v_tipo = 'pontos' AND coalesce(v_origem.pontos_bloqueados, false) THEN RAISE EXCEPTION 'Carteira de pontos bloqueada.'; END IF;
  IF v_tipo = 'saldo' AND coalesce(v_origem.saldo_carteira, 0) < v_valor THEN RAISE EXCEPTION 'Saldo insuficiente.'; END IF;
  IF v_tipo = 'pontos' AND coalesce(v_origem.saldo_pontos, 0) < v_valor THEN RAISE EXCEPTION 'Saldo de pontos insuficiente.'; END IF;

  SELECT coalesce(taxa_saque_transferencia, 0) INTO v_level_taxa
  FROM client_levels
  WHERE id = coalesce(v_origem.nivel_manual_id, v_origem.nivel_id)
  LIMIT 1;
  v_level_taxa := coalesce(v_level_taxa, 0);
  v_taxa_valor := CASE WHEN v_tipo = 'saldo' THEN round(v_valor * (v_level_taxa / 100), 2) ELSE floor(v_valor * (v_level_taxa / 100)) END;
  v_valor_liquido := greatest(v_valor - v_taxa_valor, 0);

  v_novo_saldo := CASE WHEN v_tipo = 'saldo' THEN round(coalesce(v_origem.saldo_carteira, 0) - v_valor, 2) ELSE coalesce(v_origem.saldo_pontos, 0) - v_valor END;
  IF v_tipo = 'saldo' THEN
    UPDATE clientes SET saldo_carteira = v_novo_saldo WHERE id = v_origem_id;
  ELSE
    UPDATE clientes SET saldo_pontos = v_novo_saldo::integer WHERE id = v_origem_id;
  END IF;

  INSERT INTO transferencias(cliente_origem_id, cliente_destino_id, tipo, valor, taxa_aplicada, valor_liquido, motivo, status, data_solicitacao)
  VALUES (v_origem_id, v_destino_id, v_tipo, v_valor, v_taxa_valor, v_valor_liquido, v_motivo, 'em_analise', now())
  RETURNING id INTO v_transferencia_id;

  IF v_tipo = 'saldo' THEN
    INSERT INTO extrato_financeiro(cliente_id, tipo, valor, descricao, referencia_id, modulo_referencia, saldo_resultante)
    VALUES (v_origem_id, 'saida', v_valor, 'Transferência em análise para ' || v_destino.nome || ' (Taxa: ' || v_level_taxa || '%)', v_transferencia_id, 'transferencia', v_novo_saldo);
  ELSE
    INSERT INTO pontos_movimentacoes(cliente_id, tipo, pontos, saldo_apos, descricao)
    VALUES (v_origem_id, 'uso_fatura', -v_valor::integer, v_novo_saldo::integer, 'Transferência em análise para ' || v_destino.nome || ' (Taxa: ' || v_level_taxa || '%)');
    INSERT INTO points_transactions(cliente_id, tipo, pontos, descricao)
    VALUES (v_origem_id, 'transferencia_enviada', -v_valor::integer, 'Transferência em análise para ' || v_destino.nome || ' (Taxa: ' || v_level_taxa || '%)');
  END IF;

  RETURN jsonb_build_object('success', true, 'transferencia_id', v_transferencia_id, 'saldo_resultante', v_novo_saldo, 'taxa_aplicada', v_taxa_valor, 'valor_liquido', v_valor_liquido);
END;
$$;

CREATE OR REPLACE FUNCTION public.cancelar_transferencia_cliente(p_transferencia_id uuid, p_cliente_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_transfer transferencias%rowtype;
  v_cliente clientes%rowtype;
  v_novo_saldo numeric;
BEGIN
  SELECT * INTO v_transfer FROM transferencias WHERE id = p_transferencia_id AND cliente_origem_id = p_cliente_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Transferência não encontrada.'; END IF;
  IF v_transfer.status <> 'em_analise' THEN RAISE EXCEPTION 'Esta transferência já foi processada.'; END IF;
  SELECT * INTO v_cliente FROM clientes WHERE id = p_cliente_id FOR UPDATE;

  IF v_transfer.tipo = 'saldo' THEN
    v_novo_saldo := round(coalesce(v_cliente.saldo_carteira, 0) + v_transfer.valor, 2);
    UPDATE clientes SET saldo_carteira = v_novo_saldo WHERE id = p_cliente_id;
    INSERT INTO extrato_financeiro(cliente_id, tipo, valor, descricao, referencia_id, modulo_referencia, saldo_resultante)
    VALUES (p_cliente_id, 'entrada', v_transfer.valor, 'Estorno de transferência cancelada', p_transferencia_id, 'transferencia', v_novo_saldo);
  ELSE
    v_novo_saldo := coalesce(v_cliente.saldo_pontos, 0) + v_transfer.valor;
    UPDATE clientes SET saldo_pontos = v_novo_saldo::integer WHERE id = p_cliente_id;
    INSERT INTO pontos_movimentacoes(cliente_id, tipo, pontos, saldo_apos, descricao)
    VALUES (p_cliente_id, 'estorno', v_transfer.valor::integer, v_novo_saldo::integer, 'Estorno de transferência cancelada');
    INSERT INTO points_transactions(cliente_id, tipo, pontos, descricao)
    VALUES (p_cliente_id, 'estorno', v_transfer.valor::integer, 'Estorno de transferência cancelada');
  END IF;

  UPDATE transferencias SET status = 'cancelado', motivo_cancelamento = 'Cancelada pelo cliente', observacoes_admin = 'Cancelada pelo cliente' WHERE id = p_transferencia_id;
  RETURN jsonb_build_object('success', true, 'transferencia_id', p_transferencia_id, 'saldo_resultante', v_novo_saldo);
END;
$$;

CREATE OR REPLACE FUNCTION public.estornar_transferencia_cliente(p_transferencia_id uuid, p_cliente_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_transfer transferencias%rowtype;
  v_origem clientes%rowtype;
  v_destino clientes%rowtype;
  v_saldo_origem numeric;
  v_saldo_destino numeric;
BEGIN
  SELECT * INTO v_transfer FROM transferencias WHERE id = p_transferencia_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Transferência não encontrada.'; END IF;
  IF p_cliente_id NOT IN (v_transfer.cliente_origem_id, v_transfer.cliente_destino_id) THEN RAISE EXCEPTION 'Cliente sem permissão para estornar esta transferência.'; END IF;
  IF v_transfer.status <> 'aprovado' THEN RAISE EXCEPTION 'Esta transferência já foi estornada ou não está mais aprovada.'; END IF;

  SELECT * INTO v_origem FROM clientes WHERE id = v_transfer.cliente_origem_id FOR UPDATE;
  SELECT * INTO v_destino FROM clientes WHERE id = v_transfer.cliente_destino_id FOR UPDATE;

  IF v_transfer.tipo = 'saldo' THEN
    IF coalesce(v_destino.saldo_carteira, 0) < coalesce(v_transfer.valor_liquido, v_transfer.valor) THEN
      RAISE EXCEPTION 'Destinatário sem saldo suficiente para estorno.';
    END IF;
    v_saldo_origem := round(coalesce(v_origem.saldo_carteira, 0) + v_transfer.valor, 2);
    v_saldo_destino := round(coalesce(v_destino.saldo_carteira, 0) - coalesce(v_transfer.valor_liquido, v_transfer.valor), 2);
    UPDATE clientes SET saldo_carteira = v_saldo_origem WHERE id = v_transfer.cliente_origem_id;
    UPDATE clientes SET saldo_carteira = v_saldo_destino WHERE id = v_transfer.cliente_destino_id;
    INSERT INTO extrato_financeiro(cliente_id, tipo, valor, descricao, referencia_id, modulo_referencia, saldo_resultante)
    VALUES
      (v_transfer.cliente_origem_id, 'entrada', v_transfer.valor, 'Estorno de transferência', p_transferencia_id, 'transferencia', v_saldo_origem),
      (v_transfer.cliente_destino_id, 'saida', coalesce(v_transfer.valor_liquido, v_transfer.valor), 'Estorno de transferência recebida', p_transferencia_id, 'transferencia', v_saldo_destino);
  ELSE
    IF coalesce(v_destino.saldo_pontos, 0) < coalesce(v_transfer.valor_liquido, v_transfer.valor) THEN
      RAISE EXCEPTION 'Destinatário sem pontos suficientes para estorno.';
    END IF;
    v_saldo_origem := coalesce(v_origem.saldo_pontos, 0) + v_transfer.valor;
    v_saldo_destino := coalesce(v_destino.saldo_pontos, 0) - coalesce(v_transfer.valor_liquido, v_transfer.valor);
    UPDATE clientes SET saldo_pontos = v_saldo_origem::integer WHERE id = v_transfer.cliente_origem_id;
    UPDATE clientes SET saldo_pontos = v_saldo_destino::integer WHERE id = v_transfer.cliente_destino_id;
    INSERT INTO pontos_movimentacoes(cliente_id, tipo, pontos, saldo_apos, descricao)
    VALUES
      (v_transfer.cliente_origem_id, 'estorno', v_transfer.valor::integer, v_saldo_origem::integer, 'Estorno de transferência'),
      (v_transfer.cliente_destino_id, 'estorno', -coalesce(v_transfer.valor_liquido, v_transfer.valor)::integer, v_saldo_destino::integer, 'Estorno de transferência recebida');
    INSERT INTO points_transactions(cliente_id, tipo, pontos, descricao)
    VALUES
      (v_transfer.cliente_origem_id, 'estorno', v_transfer.valor::integer, 'Estorno de transferência'),
      (v_transfer.cliente_destino_id, 'estorno', -coalesce(v_transfer.valor_liquido, v_transfer.valor)::integer, 'Estorno de transferência recebida');
  END IF;

  UPDATE transferencias SET status = 'estornado' WHERE id = p_transferencia_id;
  RETURN jsonb_build_object('success', true, 'transferencia_id', p_transferencia_id);
END;
$$;

GRANT EXECUTE ON FUNCTION public.pagar_fatura_cliente(jsonb) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.solicitar_saque_cliente(jsonb) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.cancelar_saque_cliente(uuid, uuid, text) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.solicitar_transferencia_cliente(jsonb) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.cancelar_transferencia_cliente(uuid, uuid) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.estornar_transferencia_cliente(uuid, uuid) TO anon, authenticated;
