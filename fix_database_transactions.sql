-- RPC para deletar cliente em cascata de forma transacional e atômica
CREATE OR REPLACE FUNCTION delete_client_cascade(p_cliente_id UUID)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- Deleta ordens e orçamentos (essas tabelas costumam ter faturas ligadas)
  DELETE FROM ordens_servico WHERE cliente_id = p_cliente_id;
  DELETE FROM ordens_compra WHERE cliente_id = p_cliente_id;
  DELETE FROM ordens_assinatura WHERE cliente_id = p_cliente_id;
  DELETE FROM orcamentos WHERE cliente_id = p_cliente_id;
  
  -- Faturas e Movimentações
  DELETE FROM faturas WHERE cliente_id = p_cliente_id;
  DELETE FROM cliente_extrato_financeiro WHERE cliente_id = p_cliente_id;
  DELETE FROM cliente_pontos_movimentacoes WHERE cliente_id = p_cliente_id;
  
  -- Documentos e Tickets
  DELETE FROM cliente_documentos WHERE cliente_id = p_cliente_id;
  DELETE FROM tickets WHERE cliente_id = p_cliente_id;
  
  -- Loja e Assinaturas
  DELETE FROM loja_solicitacoes WHERE cliente_id = p_cliente_id;
  DELETE FROM cliente_promocoes WHERE cliente_id = p_cliente_id;
  DELETE FROM cobrancas WHERE cliente_id = p_cliente_id;
  
  -- Cliente (Mestre)
  DELETE FROM clientes WHERE id = p_cliente_id;
END;
$$;

-- RPC para solicitar saque de forma atômica, prevenindo saldo negativo e Double-Spend
CREATE OR REPLACE FUNCTION request_withdrawal_seguro(
  p_prestador_id UUID, 
  p_valor NUMERIC, 
  p_metodo_chave TEXT, 
  p_metodo_tipo TEXT,
  p_taxa NUMERIC DEFAULT 0
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_saldo_atual NUMERIC;
  v_saque_id UUID;
  v_valor_liquido NUMERIC;
BEGIN
  -- Bloqueia a linha do prestador para leitura concorrente (Evita Double-Spend)
  SELECT saldo_carteira INTO v_saldo_atual 
  FROM prestadores 
  WHERE id = p_prestador_id 
  FOR UPDATE;

  IF v_saldo_atual IS NULL THEN
    RETURN '{"success": false, "error": "Prestador não encontrado"}'::jsonb;
  END IF;

  IF v_saldo_atual < p_valor THEN
    RETURN '{"success": false, "error": "Saldo insuficiente"}'::jsonb;
  END IF;

  v_valor_liquido := p_valor - p_taxa;

  -- 1. Insere a solicitação de saque
  INSERT INTO prestador_saques (prestador_id, valor, valor_liquido, taxa_saque, status, metodo_chave, metodo_tipo)
  VALUES (p_prestador_id, p_valor, v_valor_liquido, p_taxa, 'pendente', p_metodo_chave, p_metodo_tipo)
  RETURNING id INTO v_saque_id;

  -- 2. Insere a transação de débito no extrato
  INSERT INTO prestador_transacoes (prestador_id, tipo, valor, descricao, saque_id)
  VALUES (p_prestador_id, 'debito', p_valor, 'Solicitação de saque', v_saque_id);

  -- 3. Atualiza o saldo da carteira atomicamente
  UPDATE prestadores 
  SET saldo_carteira = saldo_carteira - p_valor 
  WHERE id = p_prestador_id;

  RETURN '{"success": true}'::jsonb;
END;
$$;

-- RPC para validar vouchers de prêmios (Prevenção de Double-Spend)
CREATE OR REPLACE FUNCTION resgatar_voucher_seguro(
  p_voucher_id UUID,
  p_prestador_id UUID,
  p_valor NUMERIC
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_status TEXT;
  v_linhas_afetadas INT;
BEGIN
  -- Tenta atualizar apenas se o status for 'disponivel' (Garante que não foi resgatado por outra requisição concorrente)
  UPDATE prestador_premios_vouchers 
  SET status = 'pago', data_pagamento = NOW()
  WHERE id = p_voucher_id AND status = 'disponivel' AND prestador_id = p_prestador_id;
  
  GET DIAGNOSTICS v_linhas_afetadas = ROW_COUNT;
  
  IF v_linhas_afetadas = 0 THEN
    RETURN '{"success": false, "error": "Voucher já resgatado ou inválido"}'::jsonb;
  END IF;

  -- Credita o valor na conta do prestador e insere o histórico na transação
  INSERT INTO prestador_transacoes (prestador_id, tipo, valor, descricao, ref_id)
  VALUES (p_prestador_id, 'credito', p_valor, 'Resgate de Voucher', p_voucher_id);

  UPDATE prestadores 
  SET saldo_carteira = COALESCE(saldo_carteira, 0) + p_valor 
  WHERE id = p_prestador_id;

  RETURN '{"success": true}'::jsonb;
END;
$$;
