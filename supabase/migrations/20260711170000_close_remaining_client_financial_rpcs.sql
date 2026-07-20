CREATE OR REPLACE FUNCTION public.assinar_area_vip_cliente(payload jsonb)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_cliente clientes%rowtype;
  v_fatura_id uuid;
  v_cliente_id uuid := (payload->>'cliente_id')::uuid;
  v_pacote_id text := nullif(payload->>'pacote_nivel_id', '');
  v_nome text := coalesce(nullif(payload->>'nome', ''), 'Pacote VIP');
  v_preco numeric := round((payload->>'valor')::numeric, 2);
  v_beneficios jsonb := coalesce(payload->'beneficios', '[]'::jsonb);
  v_pontos_usar integer;
  v_desconto numeric;
  v_final numeric;
BEGIN
  IF v_cliente_id IS NULL OR v_pacote_id IS NULL OR v_preco IS NULL OR v_preco <= 0 THEN
    RAISE EXCEPTION 'Dados invalidos para assinatura VIP.';
  END IF;

  SELECT * INTO v_cliente FROM clientes WHERE id = v_cliente_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Cliente nao encontrado.'; END IF;

  v_pontos_usar := least(coalesce(v_cliente.saldo_pontos, 0), floor(v_preco * 100)::integer);
  v_desconto := round(v_pontos_usar * 0.01, 2);
  v_final := round(greatest(v_preco - v_desconto, 0), 2);

  INSERT INTO faturas(
    cliente_id, codigo_fatura, data_vencimento, valor_total, valor_final_pendente,
    desconto_pontos_aplicado, status, tipo, pacote_nivel_id, forma_pagamento_escolhida,
    itens_faturados, historico_pagamentos
  )
  VALUES (
    v_cliente_id, public.gsa_generate_code('FAT-VIP'), current_date + 3, v_preco, v_final,
    v_desconto, 'pendente', 'avulsa', v_pacote_id, 'pix',
    jsonb_build_array(jsonb_build_object('descricao', 'Compra do pacote de nivel: ' || v_nome, 'valor', v_preco, 'beneficios', v_beneficios)),
    jsonb_build_array(jsonb_build_object('data', now(), 'descricao', 'Geracao da fatura para compra de nivel VIP', 'valor_total', v_preco, 'pontos_utilizados', v_pontos_usar, 'desconto_pontos', v_desconto, 'valor_restante', v_final))
  )
  RETURNING id INTO v_fatura_id;

  IF v_pontos_usar > 0 THEN
    UPDATE clientes SET saldo_pontos = coalesce(saldo_pontos, 0) - v_pontos_usar WHERE id = v_cliente_id;
    INSERT INTO pagamentos(fatura_id, valor, metodo, data_pagamento)
    VALUES (v_fatura_id, v_desconto, 'pontos', now());
    INSERT INTO pontos_movimentacoes(cliente_id, tipo, pontos, saldo_apos, descricao, valor_convertido)
    VALUES (v_cliente_id, 'resgate', -v_pontos_usar, coalesce(v_cliente.saldo_pontos, 0) - v_pontos_usar, 'Uso de pontos para compra do pacote de nivel: ' || v_nome, v_desconto);
    INSERT INTO points_transactions(cliente_id, tipo, pontos, descricao)
    VALUES (v_cliente_id, 'resgate', -v_pontos_usar, 'Uso de pontos para compra do pacote de nivel: ' || v_nome);
  END IF;

  RETURN jsonb_build_object('success', true, 'fatura_id', v_fatura_id, 'valor_final', v_final, 'pontos_utilizados', v_pontos_usar);
END;
$$;

CREATE OR REPLACE FUNCTION public.resgatar_voucher_carteira(p_voucher_id uuid, p_cliente_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_voucher vouchers%rowtype;
  v_cliente clientes%rowtype;
  v_valor numeric;
  v_novo_saldo numeric;
BEGIN
  IF p_voucher_id IS NULL OR p_cliente_id IS NULL THEN
    RAISE EXCEPTION 'Voucher e cliente sao obrigatorios.';
  END IF;

  SELECT * INTO v_voucher FROM vouchers WHERE id = p_voucher_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Voucher nao encontrado.'; END IF;
  IF v_voucher.status <> 'ativo' THEN RAISE EXCEPTION 'Voucher nao esta ativo.'; END IF;
  IF v_voucher.categoria <> 'saque' THEN RAISE EXCEPTION 'Voucher nao e de resgate para carteira.'; END IF;
  IF v_voucher.cliente_id IS NOT NULL AND v_voucher.cliente_id <> p_cliente_id THEN
    RAISE EXCEPTION 'Voucher nao pertence a este cliente.';
  END IF;
  IF v_voucher.validade IS NOT NULL AND v_voucher.validade::date < current_date THEN
    RAISE EXCEPTION 'Voucher expirado.';
  END IF;
  IF coalesce(v_voucher.usage_limit, 0) > 0 AND coalesce(v_voucher.usage_count, 0) >= v_voucher.usage_limit THEN
    RAISE EXCEPTION 'Limite de uso do voucher atingido.';
  END IF;

  SELECT * INTO v_cliente FROM clientes WHERE id = p_cliente_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Cliente nao encontrado.'; END IF;

  v_valor := round(coalesce(v_voucher.valor, 0), 2);
  IF v_valor <= 0 THEN RAISE EXCEPTION 'Valor do voucher invalido.'; END IF;

  v_novo_saldo := round(coalesce(v_cliente.saldo_carteira, 0) + v_valor, 2);

  UPDATE clientes SET saldo_carteira = v_novo_saldo WHERE id = p_cliente_id;

  INSERT INTO carteira_lancamentos(cliente_id, valor, tipo, descricao)
  VALUES (p_cliente_id, v_valor, 'credito', 'Resgate de Voucher Saque: ' || coalesce(v_voucher.codigo_voucher, p_voucher_id::text));

  INSERT INTO extrato_financeiro(cliente_id, tipo, valor, descricao, saldo_resultante, referencia_id, modulo_referencia)
  VALUES (p_cliente_id, 'entrada', v_valor, 'Resgate de Voucher Saque: ' || coalesce(v_voucher.codigo_voucher, p_voucher_id::text), v_novo_saldo, p_voucher_id, 'vouchers');

  UPDATE vouchers
  SET usage_count = coalesce(usage_count, 0) + 1,
      status = CASE
        WHEN coalesce(usage_limit, 0) <= 1 OR coalesce(usage_count, 0) + 1 >= usage_limit THEN 'usado'
        ELSE status
      END,
      data_uso = now(),
      tipo_uso = 'Resgate para Carteira'
  WHERE id = p_voucher_id;

  RETURN jsonb_build_object('success', true, 'valor', v_valor, 'saldo_carteira', v_novo_saldo);
END;
$$;

CREATE OR REPLACE FUNCTION public.gerar_fatura_parcela_emprestimo(p_parcela_id uuid, p_cliente_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_parcela emprestimo_parcelas%rowtype;
  v_emp emprestimos%rowtype;
  v_fatura_id uuid;
  v_codigo text;
  v_valor numeric;
BEGIN
  IF p_parcela_id IS NULL OR p_cliente_id IS NULL THEN
    RAISE EXCEPTION 'Parcela e cliente sao obrigatorios.';
  END IF;

  SELECT * INTO v_parcela FROM emprestimo_parcelas WHERE id = p_parcela_id AND cliente_id = p_cliente_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Parcela nao encontrada.'; END IF;
  IF v_parcela.status = 'paga' THEN RAISE EXCEPTION 'Parcela ja esta paga.'; END IF;

  IF v_parcela.fatura_id IS NOT NULL THEN
    RETURN jsonb_build_object('success', true, 'fatura_id', v_parcela.fatura_id, 'already_exists', true);
  END IF;

  SELECT * INTO v_emp FROM emprestimos WHERE id = v_parcela.emprestimo_id AND cliente_id = p_cliente_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Emprestimo nao encontrado.'; END IF;

  v_valor := round(coalesce(v_parcela.valor, 0), 2);
  IF v_valor <= 0 THEN RAISE EXCEPTION 'Valor da parcela invalido.'; END IF;

  v_codigo := 'FAT-EMP-' || coalesce(v_emp.codigo_emprestimo, v_emp.id::text) || '-' || v_parcela.numero_parcela::text;
  SELECT id INTO v_fatura_id FROM faturas WHERE codigo_fatura = v_codigo AND cliente_id = p_cliente_id LIMIT 1;

  IF v_fatura_id IS NULL THEN
    INSERT INTO faturas(
      cliente_id, codigo_fatura, valor_total, valor_final_pendente, status,
      data_vencimento, tipo, emprestimo_id, itens_faturados
    )
    VALUES (
      p_cliente_id, v_codigo, v_valor, v_valor, 'pendente',
      v_parcela.data_vencimento, 'emprestimo', v_parcela.emprestimo_id,
      jsonb_build_array(jsonb_build_object(
        'id', 'parcela-' || p_parcela_id::text,
        'descricao', 'Parcela ' || v_parcela.numero_parcela::text || ' do Emprestimo',
        'valor', v_valor,
        'quantidade', 1
      ))
    )
    RETURNING id INTO v_fatura_id;
  END IF;

  UPDATE emprestimo_parcelas SET fatura_id = v_fatura_id WHERE id = p_parcela_id;

  RETURN jsonb_build_object('success', true, 'fatura_id', v_fatura_id, 'already_exists', false);
END;
$$;

GRANT EXECUTE ON FUNCTION public.assinar_area_vip_cliente(jsonb) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.resgatar_voucher_carteira(uuid, uuid) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.gerar_fatura_parcela_emprestimo(uuid, uuid) TO anon, authenticated;
