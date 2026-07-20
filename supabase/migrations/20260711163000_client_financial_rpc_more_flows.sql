CREATE OR REPLACE FUNCTION public.converter_pontos_cliente(payload jsonb)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_cliente clientes%rowtype;
  v_cliente_id uuid := (payload->>'cliente_id')::uuid;
  v_pontos integer := coalesce((payload->>'pontos')::integer, 0);
  v_taxa numeric := greatest(coalesce((payload->>'taxa_conversao')::numeric, 0.01), 0.0001);
  v_valor numeric;
BEGIN
  IF v_cliente_id IS NULL OR v_pontos <= 0 THEN
    RAISE EXCEPTION 'Dados inválidos para conversão de pontos.';
  END IF;

  SELECT * INTO v_cliente FROM clientes WHERE id = v_cliente_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Cliente não encontrado.'; END IF;
  IF coalesce(v_cliente.pontos_bloqueados, false) THEN RAISE EXCEPTION 'Carteira de pontos bloqueada.'; END IF;
  IF coalesce(v_cliente.saldo_pontos, 0) < v_pontos THEN RAISE EXCEPTION 'Saldo de pontos insuficiente.'; END IF;

  v_valor := round(v_pontos * v_taxa, 2);
  UPDATE clientes
    SET saldo_pontos = coalesce(saldo_pontos, 0) - v_pontos,
        saldo_carteira = round(coalesce(saldo_carteira, 0) + v_valor, 2)
    WHERE id = v_cliente_id;

  INSERT INTO pontos_movimentacoes(cliente_id, tipo, pontos, saldo_apos, descricao, valor_convertido)
  VALUES (v_cliente_id, 'conversao_dinheiro', -v_pontos, coalesce(v_cliente.saldo_pontos, 0) - v_pontos, 'Conversão de pontos em saldo da carteira', v_valor);
  INSERT INTO points_transactions(cliente_id, tipo, pontos, descricao)
  VALUES (v_cliente_id, 'conversao_dinheiro', -v_pontos, 'Conversão de pontos em saldo da carteira');
  INSERT INTO extrato_financeiro(cliente_id, tipo, valor, descricao, modulo_referencia, saldo_resultante)
  VALUES (v_cliente_id, 'entrada', v_valor, 'Conversão de pontos em saldo', 'pontos', round(coalesce(v_cliente.saldo_carteira, 0) + v_valor, 2));

  RETURN jsonb_build_object('success', true, 'valor_convertido', v_valor, 'saldo_pontos', coalesce(v_cliente.saldo_pontos, 0) - v_pontos, 'saldo_carteira', round(coalesce(v_cliente.saldo_carteira, 0) + v_valor, 2));
END;
$$;

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
    RAISE EXCEPTION 'Dados inválidos para assinatura VIP.';
  END IF;

  SELECT * INTO v_cliente FROM clientes WHERE id = v_cliente_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Cliente não encontrado.'; END IF;

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
    v_desconto, 'pendente', 'pacote_nivel', v_pacote_id, 'pix',
    jsonb_build_array(jsonb_build_object('descricao', 'Compra do pacote de nível: ' || v_nome, 'valor', v_preco, 'beneficios', v_beneficios)),
    jsonb_build_array(jsonb_build_object('data', now(), 'descricao', 'Geração da fatura para compra de nível VIP', 'valor_total', v_preco, 'pontos_utilizados', v_pontos_usar, 'desconto_pontos', v_desconto, 'valor_restante', v_final))
  )
  RETURNING id INTO v_fatura_id;

  IF v_pontos_usar > 0 THEN
    UPDATE clientes SET saldo_pontos = coalesce(saldo_pontos, 0) - v_pontos_usar WHERE id = v_cliente_id;
    INSERT INTO pagamentos(fatura_id, valor, metodo, data_pagamento)
    VALUES (v_fatura_id, v_desconto, 'pontos', now());
    INSERT INTO pontos_movimentacoes(cliente_id, tipo, pontos, saldo_apos, descricao, valor_convertido)
    VALUES (v_cliente_id, 'resgate', -v_pontos_usar, coalesce(v_cliente.saldo_pontos, 0) - v_pontos_usar, 'Uso de pontos para compra do pacote de nível: ' || v_nome, v_desconto);
    INSERT INTO points_transactions(cliente_id, tipo, pontos, descricao)
    VALUES (v_cliente_id, 'resgate', -v_pontos_usar, 'Uso de pontos para compra do pacote de nível: ' || v_nome);
  END IF;

  RETURN jsonb_build_object('success', true, 'fatura_id', v_fatura_id, 'valor_final', v_final, 'pontos_utilizados', v_pontos_usar);
END;
$$;

CREATE OR REPLACE FUNCTION public.aceitar_quitacao_credito_loja(p_orcamento_id uuid, p_cliente_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_orc orcamentos%rowtype;
  v_fatura_id uuid;
  v_codigo text;
  v_valor_original numeric;
  v_ordem_compra_id uuid;
BEGIN
  SELECT * INTO v_orc FROM orcamentos WHERE id = p_orcamento_id AND cliente_id = p_cliente_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Pedido de crédito não encontrado.'; END IF;
  IF coalesce(v_orc.valor_quitacao_acordo, 0) <= 0 THEN RAISE EXCEPTION 'Não existe proposta de quitação disponível.'; END IF;

  v_codigo := 'FAT-QUIT-' || coalesce(v_orc.codigo_orcamento, p_orcamento_id::text);
  SELECT id INTO v_fatura_id FROM faturas WHERE codigo_fatura = v_codigo AND status <> 'cancelada' LIMIT 1;
  IF v_fatura_id IS NOT NULL THEN
    RETURN jsonb_build_object('success', true, 'fatura_id', v_fatura_id, 'already_exists', true);
  END IF;

  SELECT id INTO v_ordem_compra_id FROM ordens_compra WHERE orcamento_id = p_orcamento_id LIMIT 1;
  SELECT coalesce(sum(valor_total), 0) INTO v_valor_original FROM faturas WHERE cliente_id = p_cliente_id AND status NOT IN ('pago', 'cancelado', 'cancelada') AND (ordem_compra_id = v_ordem_compra_id OR quitacao_fatura_id IS NULL);

  INSERT INTO faturas(cliente_id, tipo, valor_total, valor_final_pendente, valor_base_original, status, gerada_automaticamente, is_amortizacao_credito, codigo_fatura, data_vencimento, ordem_compra_id, itens_faturados)
  VALUES (
    p_cliente_id, 'produto', v_orc.valor_quitacao_acordo, v_orc.valor_quitacao_acordo, greatest(v_valor_original, v_orc.valor_quitacao_acordo),
    'pendente', true, true, v_codigo, current_date + 5, v_ordem_compra_id,
    jsonb_build_array(jsonb_build_object('id', 'quitacao-' || p_orcamento_id, 'codigo', 'CRE-' || coalesce(v_orc.codigo_orcamento, ''), 'descricao', 'Quitação Total Antecipada - Pedido #' || coalesce(v_orc.codigo_orcamento, ''), 'valor', v_orc.valor_quitacao_acordo, 'quantidade', 1))
  )
  RETURNING id INTO v_fatura_id;

  UPDATE faturas SET status = 'cancelado', quitacao_fatura_id = v_fatura_id
  WHERE cliente_id = p_cliente_id AND id <> v_fatura_id AND status NOT IN ('pago', 'cancelado') AND ordem_compra_id = v_ordem_compra_id;
  UPDATE orcamentos SET status_quitacao_credito = NULL, valor_quitacao_acordo = NULL WHERE id = p_orcamento_id;

  RETURN jsonb_build_object('success', true, 'fatura_id', v_fatura_id, 'already_exists', false);
END;
$$;

CREATE OR REPLACE FUNCTION public.aceitar_quitacao_emprestimo(p_emprestimo_id uuid, p_cliente_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_emp emprestimos%rowtype;
  v_fatura_id uuid;
  v_codigo text;
BEGIN
  SELECT * INTO v_emp FROM emprestimos WHERE id = p_emprestimo_id AND cliente_id = p_cliente_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Empréstimo não encontrado.'; END IF;
  IF coalesce(v_emp.valor_quitacao_acordo, 0) <= 0 THEN RAISE EXCEPTION 'Não existe proposta de quitação disponível.'; END IF;

  v_codigo := 'FAT-QUIT-' || coalesce(v_emp.codigo_emprestimo, p_emprestimo_id::text);
  SELECT id INTO v_fatura_id FROM faturas WHERE codigo_fatura = v_codigo AND status <> 'cancelado' LIMIT 1;
  IF v_fatura_id IS NOT NULL THEN
    RETURN jsonb_build_object('success', true, 'fatura_id', v_fatura_id, 'already_exists', true);
  END IF;

  UPDATE faturas SET status = 'cancelado'
  WHERE id IN (SELECT fatura_id FROM emprestimo_parcelas WHERE emprestimo_id = p_emprestimo_id AND status <> 'paga' AND fatura_id IS NOT NULL)
    AND status <> 'pago';

  INSERT INTO faturas(cliente_id, tipo, valor_total, valor_final_pendente, data_vencimento, status, codigo_fatura, emprestimo_id, itens_faturados)
  VALUES (p_cliente_id, 'emprestimo', v_emp.valor_quitacao_acordo, v_emp.valor_quitacao_acordo, current_date + 5, 'pendente', v_codigo, p_emprestimo_id,
    jsonb_build_array(jsonb_build_object('id', 'quitacao-' || p_emprestimo_id, 'descricao', 'Quitação Total Empréstimo ' || coalesce(v_emp.codigo_emprestimo, ''), 'valor', v_emp.valor_quitacao_acordo, 'quantidade', 1)))
  RETURNING id INTO v_fatura_id;

  UPDATE emprestimo_parcelas SET status = 'suspensa', quitacao_fatura_id = v_fatura_id
  WHERE emprestimo_id = p_emprestimo_id AND status <> 'paga';

  INSERT INTO emprestimo_parcelas(emprestimo_id, cliente_id, fatura_id, numero_parcela, valor, data_vencimento, status)
  VALUES (p_emprestimo_id, p_cliente_id, v_fatura_id, 0, v_emp.valor_quitacao_acordo, current_date + 5, 'pendente');

  INSERT INTO emprestimo_historico(emprestimo_id, tipo_acao, descricao, usuario_tipo, usuario_id)
  VALUES (p_emprestimo_id, 'aceite_quitacao', 'Cliente aceitou oferta de quitação de ' || v_emp.valor_quitacao_acordo, 'cliente', p_cliente_id);

  RETURN jsonb_build_object('success', true, 'fatura_id', v_fatura_id, 'already_exists', false);
END;
$$;

GRANT EXECUTE ON FUNCTION public.converter_pontos_cliente(jsonb) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.assinar_area_vip_cliente(jsonb) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.aceitar_quitacao_credito_loja(uuid, uuid) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.aceitar_quitacao_emprestimo(uuid, uuid) TO anon, authenticated;
