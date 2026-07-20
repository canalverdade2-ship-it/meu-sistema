BEGIN;

DO $$
DECLARE
  v_cliente_id uuid := extensions.gen_random_uuid();
  v_indicador_id uuid := extensions.gen_random_uuid();
  v_produto_id uuid := extensions.gen_random_uuid();
  v_orcamento_id uuid := extensions.gen_random_uuid();
  v_ordem_id uuid := extensions.gen_random_uuid();
  v_fatura_id uuid := extensions.gen_random_uuid();
  v_credit_invoice_id uuid := extensions.gen_random_uuid();
  v_indicacao_id uuid := extensions.gen_random_uuid();
  v_promocao_id uuid := extensions.gen_random_uuid();
  v_client_session jsonb;
  v_admin_session jsonb;
  v_result jsonb;
  v_count integer;
  v_points_before_adjust integer;
  v_numeric numeric;
  v_text text;
BEGIN
  INSERT INTO public.clientes(
    id, nome, status, saldo_carteira, saldo_pontos, pontos_totais,
    limite_credito_total, limite_credito_disponivel, indicacao_origem_id
  ) VALUES (
    v_indicador_id, 'AUDITORIA INDICADOR', 'ativo', 0, 0, 0, 0, 0, NULL
  );

  INSERT INTO public.indicacoes(
    id, indicador_id, indicado_nome, whatsapp_indicado, status, data_indicacao
  ) VALUES (
    v_indicacao_id, v_indicador_id, 'AUDITORIA CLIENTE', '11999990001', 'aberta', current_date
  );

  INSERT INTO public.clientes(
    id, nome, status, saldo_carteira, saldo_pontos, pontos_totais,
    limite_credito_total, limite_credito_disponivel, indicacao_origem_id
  ) VALUES (
    v_cliente_id, 'AUDITORIA CLIENTE', 'ativo', 90, 0, 0, 100, 0, v_indicacao_id
  );

  INSERT INTO public.servicos(id, codigo_servico, nome, valor, tipo_cliente)
  VALUES (v_produto_id, 'AUD-SRV', 'Servico auditoria', 100, 'pf');

  INSERT INTO public.promocoes(
    id, titulo, descricao, tipo, data_inicio_divulgacao,
    data_fim_divulgacao, prazo_validade_meses, status
  ) VALUES (
    v_promocao_id, 'Promocao auditoria', 'Teste transacional', 'geral',
    now() - interval '1 day', now() + interval '1 day', 1, 'ativa'
  );

  INSERT INTO public.cliente_promocoes(
    cliente_id, promocao_id, data_expiracao, status
  ) VALUES (
    v_cliente_id, v_promocao_id, now() + interval '1 day', 'ativa'
  );

  INSERT INTO public.orcamentos(
    id, codigo_orcamento, cliente_id, servico_id, categoria,
    valor_servico, desconto, total, status, promocao_id
  ) VALUES (
    v_orcamento_id, 'AUD-ORC', v_cliente_id, v_produto_id, 'servico',
    100, 0, 100, 'aprovado', v_promocao_id
  );

  INSERT INTO public.ordens_servico(
    id, codigo_os, cliente_id, orcamento_id, status, data_inicio
  ) VALUES (
    v_ordem_id, 'AUD-OS', v_cliente_id, v_orcamento_id, 'andamento', now()
  );

  INSERT INTO public.vouchers(
    codigo_voucher, valor, tipo, status, cliente_id, usage_limit, usage_count, validade
  ) VALUES (
    'AUD-VOUCHER-' || substr(v_cliente_id::text, 1, 8), 10, 'fixo', 'ativo',
    v_cliente_id, 1, 0, current_date + 1
  );

  INSERT INTO public.faturas(
    id, codigo_fatura, os_id, cliente_id, valor_total,
    valor_final_pendente, status, tipo, data_vencimento
  ) VALUES (
    v_fatura_id, 'AUD-FAT', v_ordem_id, v_cliente_id, 100,
    100, 'pendente', 'servico', current_date + 5
  );

  INSERT INTO public.system_settings(key, value, must_change_code)
  VALUES
    ('indicador_recompensa_tipo', 'carteira', false),
    ('indicador_limite_carteira', '20', false),
    ('indicador_valor_pontos', '50', false)
  ON CONFLICT (key) DO UPDATE SET value = excluded.value;

  v_client_session := public.gsa_create_session_internal(
    'cliente', v_cliente_id, 'AUDITORIA CLIENTE', '{}'::jsonb
  );

  SELECT public.gsa_client_pagar_fatura(
    (v_client_session ->> 'sessao_id')::uuid,
    v_client_session ->> 'session_token',
    jsonb_build_object(
      'fatura_id', v_fatura_id,
      'voucher_id', (SELECT id FROM public.vouchers WHERE cliente_id = v_cliente_id LIMIT 1),
      'metodo', 'carteira',
      'use_wallet', true,
      'use_pontos', false,
      'taxa_conversao', 0.01
    )
  ) INTO v_result;

  IF v_result ->> 'status' <> 'pago' THEN
    RAISE EXCEPTION 'Pagamento cliente nao concluiu: %', v_result;
  END IF;

  SELECT status INTO v_text FROM public.faturas WHERE id = v_fatura_id;
  IF v_text <> 'pago' THEN RAISE EXCEPTION 'Fatura nao ficou paga.'; END IF;
  SELECT status INTO v_text FROM public.ordens_servico WHERE id = v_ordem_id;
  IF v_text <> 'concluido' THEN RAISE EXCEPTION 'Ordem nao recebeu propagacao.'; END IF;
  SELECT status INTO v_text FROM public.orcamentos WHERE id = v_orcamento_id;
  IF v_text <> 'pago' THEN RAISE EXCEPTION 'Orcamento nao recebeu propagacao.'; END IF;
  SELECT status INTO v_text FROM public.cliente_promocoes WHERE cliente_id = v_cliente_id AND promocao_id = v_promocao_id;
  IF v_text <> 'usada' THEN RAISE EXCEPTION 'Promocao nao foi consumida.'; END IF;
  SELECT status INTO v_text FROM public.indicacoes WHERE id = v_indicacao_id;
  IF v_text <> 'concluída' THEN RAISE EXCEPTION 'Indicacao nao foi concluida: %', v_text; END IF;
  SELECT saldo_carteira INTO v_numeric FROM public.clientes WHERE id = v_indicador_id;
  IF v_numeric <> 10 THEN RAISE EXCEPTION 'Bonus do indicador incorreto: %', v_numeric; END IF;
  SELECT saldo_pontos INTO v_count FROM public.clientes WHERE id = v_cliente_id;
  IF v_count <> 100 THEN RAISE EXCEPTION 'Pontos do pagamento incorretos: %', v_count; END IF;

  SELECT public.gsa_client_pagar_fatura(
    (v_client_session ->> 'sessao_id')::uuid,
    v_client_session ->> 'session_token',
    jsonb_build_object('fatura_id', v_fatura_id)
  ) INTO v_result;
  IF NOT coalesce((v_result ->> 'already_processed')::boolean, false) THEN
    RAISE EXCEPTION 'Repeticao do pagamento nao foi idempotente.';
  END IF;

  SELECT count(*) INTO v_count FROM public.pontos_movimentacoes
   WHERE cliente_id = v_cliente_id AND fatura_id = v_fatura_id AND tipo = 'geracao_fatura';
  IF v_count <> 1 THEN RAISE EXCEPTION 'Pontos duplicados: %', v_count; END IF;
  SELECT usage_count INTO v_count FROM public.vouchers WHERE cliente_id = v_cliente_id;
  IF v_count <> 1 THEN RAISE EXCEPTION 'Voucher duplicado: %', v_count; END IF;
  SELECT count(*) INTO v_count FROM public.carteira_lancamentos
   WHERE cliente_id = v_indicador_id AND descricao LIKE 'Bonus por indicacao%';
  IF v_count <> 1 THEN RAISE EXCEPTION 'Bonus de indicacao duplicado: %', v_count; END IF;

  v_admin_session := public.gsa_create_session_internal(
    'admin', extensions.gen_random_uuid(), 'AUDITORIA ADMIN', '{}'::jsonb
  );

  INSERT INTO public.faturas(
    id, codigo_fatura, cliente_id, valor_total, valor_final_pendente,
    status, tipo, data_vencimento, is_amortizacao_credito, valor_base_original
  ) VALUES (
    v_credit_invoice_id, 'AUD-CRED', v_cliente_id, 80, 80,
    'pendente', 'avulsa', current_date + 5, true, 80
  );

  SELECT public.gsa_admin_baixar_fatura(
    (v_admin_session ->> 'sessao_id')::uuid,
    v_admin_session ->> 'session_token',
    v_credit_invoice_id,
    'manual', now(), 'Auditoria transacional'
  ) INTO v_result;
  IF v_result ->> 'status' <> 'pago' THEN RAISE EXCEPTION 'Baixa admin falhou.'; END IF;

  SELECT limite_credito_disponivel INTO v_numeric FROM public.clientes WHERE id = v_cliente_id;
  IF v_numeric <> 80 THEN RAISE EXCEPTION 'Amortizacao restaurou limite incorreto: %', v_numeric; END IF;

  PERFORM public.gsa_admin_baixar_fatura(
    (v_admin_session ->> 'sessao_id')::uuid,
    v_admin_session ->> 'session_token',
    v_credit_invoice_id,
    'manual', now(), 'Repeticao'
  );
  SELECT count(*) INTO v_count FROM public.loja_credito_movimentacoes
   WHERE fatura_id = v_credit_invoice_id AND tipo = 'amortizacao';
  IF v_count <> 1 THEN RAISE EXCEPTION 'Amortizacao duplicada: %', v_count; END IF;
  SELECT limite_credito_disponivel INTO v_numeric FROM public.clientes WHERE id = v_cliente_id;
  IF v_numeric <> 80 THEN RAISE EXCEPTION 'Limite duplicado: %', v_numeric; END IF;

  SELECT saldo_pontos INTO v_points_before_adjust FROM public.clientes WHERE id = v_cliente_id;
  PERFORM public.gsa_admin_adjust_points(
    (v_admin_session ->> 'sessao_id')::uuid,
    v_admin_session ->> 'session_token',
    v_cliente_id,
    -20,
    'Teste de ajuste'
  );
  SELECT saldo_pontos INTO v_count FROM public.clientes WHERE id = v_cliente_id;
  IF v_count <> v_points_before_adjust - 20 THEN
    RAISE EXCEPTION 'Ajuste administrativo incorreto: %', v_count;
  END IF;

  IF has_function_privilege('anon', 'public.pagar_fatura_cliente(jsonb)', 'EXECUTE') THEN
    RAISE EXCEPTION 'RPC legado de pagamento continua acessivel ao anon.';
  END IF;
  IF has_function_privilege('authenticated', 'public.secure_add_gamification_points(uuid,numeric,text,text,uuid)', 'EXECUTE') THEN
    RAISE EXCEPTION 'RPC legado de pontos continua acessivel.';
  END IF;
END;
$$;

ROLLBACK;
