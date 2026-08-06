-- Fix return type handling of gsa_apply_points_internal inside gsa_finalize_paid_invoice_internal

CREATE OR REPLACE FUNCTION public.gsa_apply_points_internal(
  p_cliente_id uuid,
  p_pontos integer,
  p_descricao text,
  p_tipo text,
  p_fatura_id uuid DEFAULT NULL,
  p_notificar boolean DEFAULT true
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_cliente public.clientes%rowtype;
  v_saldo_anterior integer;
  v_total_anterior integer;
  v_novo_saldo integer;
  v_novo_total integer;
  v_aplicado integer;
  v_nivel_anterior uuid;
  v_novo_nivel public.client_levels%rowtype;
  v_level_up boolean := false;
BEGIN
  PERFORM set_config('my.app.bypass_saldo_check', 'on', true);
  PERFORM set_config('gsa.credit_release', 'on', true);

  IF p_cliente_id IS NULL OR p_pontos IS NULL OR nullif(trim(p_descricao), '') IS NULL THEN
    RAISE EXCEPTION 'Movimentacao de pontos invalida.';
  END IF;

  IF p_fatura_id IS NOT NULL
     AND EXISTS (
       SELECT 1
       FROM public.pontos_movimentacoes pm
       WHERE pm.cliente_id = p_cliente_id
         AND pm.fatura_id = p_fatura_id
         AND pm.tipo = p_tipo
     ) THEN
    RETURN jsonb_build_object('success', true, 'already_processed', true, 'pontos_aplicados', 0);
  END IF;

  SELECT * INTO v_cliente
  FROM public.clientes
  WHERE id = p_cliente_id
  FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Cliente nao encontrado.'; END IF;

  v_saldo_anterior := coalesce(v_cliente.saldo_pontos, 0);
  v_total_anterior := coalesce(v_cliente.pontos_totais, 0);
  v_novo_saldo := greatest(0, v_saldo_anterior + p_pontos);
  v_aplicado := v_novo_saldo - v_saldo_anterior;
  v_novo_total := greatest(0, v_total_anterior + v_aplicado);
  v_nivel_anterior := v_cliente.nivel_id;

  IF v_aplicado = 0 THEN
    RETURN jsonb_build_object(
      'success', true,
      'already_processed', false,
      'novo_saldo', v_novo_saldo,
      'pontos_aplicados', 0
    );
  END IF;

  UPDATE public.clientes
     SET saldo_pontos = v_novo_saldo,
         pontos_totais = v_novo_total
   WHERE id = p_cliente_id;

  INSERT INTO public.pontos_movimentacoes(
    cliente_id, fatura_id, tipo, pontos, saldo_apos, descricao
  ) VALUES (
    p_cliente_id, p_fatura_id, p_tipo, v_aplicado, v_novo_saldo, trim(p_descricao)
  );

  INSERT INTO public.points_transactions(cliente_id, tipo, pontos, descricao)
  VALUES (p_cliente_id, p_tipo, v_aplicado, trim(p_descricao));

  IF v_cliente.nivel_manual_id IS NULL THEN
    SELECT cl.id, cl.nome_nivel, cl.pontos_por_real
      INTO v_novo_nivel
    FROM public.client_levels cl
    WHERE cl.pontos_minimos <= v_novo_total
    ORDER BY cl.pontos_minimos DESC
    LIMIT 1;

    IF v_novo_nivel.id IS NOT NULL AND v_novo_nivel.id IS DISTINCT FROM v_nivel_anterior THEN
      UPDATE public.clientes SET nivel_id = v_novo_nivel.id WHERE id = p_cliente_id;
      INSERT INTO public.level_history(cliente_id, nivel_anterior_id, nivel_novo_id)
      VALUES (p_cliente_id, v_nivel_anterior, v_novo_nivel.id);
      v_level_up := true;
    END IF;
  END IF;

  IF p_notificar THEN
    INSERT INTO public.notificacoes(
      cliente_id, titulo, mensagem, modulo, lida, tipo,
      destinatario_tipo, prioridade, acao_origem, contexto
    ) VALUES (
      p_cliente_id,
      CASE WHEN v_aplicado > 0 THEN 'Pontos Ganhos' ELSE 'Pontos Removidos' END,
      CASE
        WHEN v_aplicado > 0 THEN 'Voce recebeu ' || v_aplicado || ' pontos.'
        ELSE 'Foram removidos ' || abs(v_aplicado) || ' pontos da sua conta.'
      END,
      'pontos',
      false,
      'sistema',
      'cliente',
      'normal',
      'movimentacao_pontos',
      jsonb_build_object('fatura_id', p_fatura_id, 'tipo', p_tipo)
    );

    IF v_level_up THEN
      INSERT INTO public.notificacoes(
        cliente_id, titulo, mensagem, modulo, lida, tipo,
        destinatario_tipo, prioridade, acao_origem, contexto
      ) VALUES (
        p_cliente_id,
        'Novo nivel conquistado',
        'Seu nivel foi atualizado para ' || coalesce(v_novo_nivel.nome_nivel, 'um novo nivel') || '.',
        'dashboard',
        false,
        'sistema',
        'cliente',
        'alta',
        'mudanca_nivel',
        jsonb_build_object('nivel_id', v_novo_nivel.id)
      );
    END IF;
  END IF;

  RETURN jsonb_build_object(
    'success', true,
    'already_processed', false,
    'novo_saldo', v_novo_saldo,
    'novo_total', v_novo_total,
    'pontos_aplicados', v_aplicado,
    'level_up', v_level_up,
    'novo_nivel_nome', v_novo_nivel.nome_nivel,
    'pontos_por_real', v_novo_nivel.pontos_por_real
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.gsa_finalize_paid_invoice_internal(
  p_fatura_id uuid,
  p_valor_base_pontos numeric DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_fatura public.faturas%rowtype;
  v_cliente public.clientes%rowtype;
  v_orcamento_id uuid;
  v_promocao_id uuid;
  v_solicitacao record;
  v_indicacao record;
  v_indicador public.clientes%rowtype;
  v_indicador_tipo text;
  v_indicador_limite numeric;
  v_indicador_pontos integer;
  v_bonus_carteira numeric := 0;
  v_gross_value numeric := 0;
  v_pontos_por_real numeric := 1;
  v_pontos_gerados integer := 0;
  v_points_res jsonb;
  v_valor_restaurado numeric := 0;
  v_novo_limite numeric := 0;
BEGIN
  PERFORM set_config('my.app.bypass_saldo_check', 'on', true);
  PERFORM set_config('gsa.credit_release', 'on', true);

  SELECT * INTO v_fatura
  FROM public.faturas
  WHERE id = p_fatura_id
  FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Fatura nao encontrada.'; END IF;
  IF v_fatura.status <> 'pago' THEN RAISE EXCEPTION 'A fatura ainda nao esta paga.'; END IF;

  SELECT coalesce(os.orcamento_id, oc.orcamento_id, oa.orcamento_id)
    INTO v_orcamento_id
  FROM (SELECT 1) seed
  LEFT JOIN public.ordens_servico os ON os.id = v_fatura.os_id
  LEFT JOIN public.ordens_compra oc ON oc.id = v_fatura.ordem_compra_id
  LEFT JOIN public.ordens_assinatura oa ON oa.id = v_fatura.ordem_assinatura_id;

  IF v_fatura.codigo_fatura LIKE 'FAT-TROCA-%' THEN
    SELECT ls.id, ls.cliente_id, ls.tipo, ls.historico_status
      INTO v_solicitacao
    FROM public.loja_solicitacoes ls
    WHERE ls.codigo_solicitacao = replace(v_fatura.codigo_fatura, 'FAT-TROCA-', '')
    FOR UPDATE;

    IF v_solicitacao.id IS NOT NULL THEN
      UPDATE public.loja_solicitacoes
         SET status = 'aguardando_instrucoes',
             historico_status = coalesce(v_solicitacao.historico_status, '{}'::jsonb)
               || jsonb_build_object('aguardando_instrucoes', now()),
             updated_at = now()
       WHERE id = v_solicitacao.id
         AND status IS DISTINCT FROM 'aguardando_instrucoes';

      IF FOUND THEN
        INSERT INTO public.notificacoes(
          cliente_id, titulo, mensagem, modulo, tab, item_id, lida, tipo,
          destinatario_tipo, prioridade, acao_origem
        ) VALUES (
          v_solicitacao.cliente_id,
          'Pagamento da diferenca confirmado',
          'O pagamento da diferenca da troca foi confirmado. O processo logistico foi iniciado.',
          'gsa_store', 'acompanhar', v_solicitacao.id::text, false, 'sistema',
          'cliente', 'alta', 'pagamento_confirmado'
        );
      END IF;
    END IF;
  END IF;

  IF coalesce(v_fatura.is_amortizacao_credito, false)
     AND NOT EXISTS (
       SELECT 1 FROM public.loja_credito_movimentacoes m
       WHERE m.fatura_id = v_fatura.id
         AND m.tipo = 'amortizacao'
     ) THEN
    SELECT * INTO v_cliente
    FROM public.clientes
    WHERE id = v_fatura.cliente_id
    FOR UPDATE;

    v_valor_restaurado := greatest(
      coalesce(v_fatura.valor_base_original, 0),
      coalesce(v_fatura.valor_total, 0)
    );
    v_novo_limite := round(coalesce(v_cliente.limite_credito_disponivel, 0) + v_valor_restaurado, 2);
    IF coalesce(v_cliente.limite_credito_total, 0) > 0 THEN
      v_novo_limite := least(v_novo_limite, v_cliente.limite_credito_total);
    END IF;

    UPDATE public.clientes
       SET limite_credito_disponivel = v_novo_limite
     WHERE id = v_fatura.cliente_id;

    INSERT INTO public.loja_credito_movimentacoes(
      cliente_id, tipo, valor, descricao,
      limite_total_anterior, limite_total_novo,
      limite_disponivel_anterior, limite_disponivel_novo,
      fatura_id, created_at
    ) VALUES (
      v_fatura.cliente_id,
      'amortizacao',
      v_valor_restaurado,
      'Amortizacao da fatura ' || coalesce(v_fatura.codigo_fatura, v_fatura.id::text),
      coalesce(v_cliente.limite_credito_total, 0),
      coalesce(v_cliente.limite_credito_total, 0),
      coalesce(v_cliente.limite_credito_disponivel, 0),
      v_novo_limite,
      v_fatura.id,
      now()
    );

    INSERT INTO public.notificacoes(
      cliente_id, titulo, mensagem, modulo, lida, tipo,
      destinatario_tipo, prioridade, acao_origem, contexto
    ) VALUES (
      v_fatura.cliente_id,
      'Parcela de credito paga',
      'O pagamento foi confirmado e seu limite disponivel foi atualizado.',
      'credito_loja', false, 'sistema', 'cliente', 'normal',
      'amortizacao_confirmada', jsonb_build_object('fatura_id', v_fatura.id, 'novo_limite', v_novo_limite)
    );
  END IF;

  IF v_fatura.ordem_compra_id IS NOT NULL THEN
    UPDATE public.ordens_compra SET status = 'pago'
     WHERE id = v_fatura.ordem_compra_id AND status <> 'cancelado';
  END IF;
  IF v_fatura.ordem_assinatura_id IS NOT NULL THEN
    UPDATE public.ordens_assinatura SET status = 'concluido', data_conclusao = coalesce(data_conclusao, now())
     WHERE id = v_fatura.ordem_assinatura_id AND status <> 'cancelado';
  END IF;
  IF v_fatura.os_id IS NOT NULL THEN
    UPDATE public.ordens_servico SET status = 'concluido', data_fim = coalesce(data_fim, now())
     WHERE id = v_fatura.os_id AND status <> 'cancelado';
  END IF;

  IF v_orcamento_id IS NOT NULL THEN
    UPDATE public.orcamentos
       SET status = 'pago',
           status_entrega = CASE
             WHEN v_fatura.ordem_compra_id IS NOT NULL OR v_fatura.ordem_assinatura_id IS NOT NULL
               THEN 'pagamento_aprovado'
             ELSE status_entrega
           END,
           data_pagamento_aprovado = CASE
             WHEN v_fatura.ordem_compra_id IS NOT NULL OR v_fatura.ordem_assinatura_id IS NOT NULL
               THEN coalesce(data_pagamento_aprovado, now())
             ELSE data_pagamento_aprovado
           END
     WHERE id = v_orcamento_id;

    SELECT o.promocao_id, coalesce(o.total, 0) + coalesce(o.desconto, 0)
      INTO v_promocao_id, v_gross_value
    FROM public.orcamentos o
    WHERE o.id = v_orcamento_id;

    IF v_promocao_id IS NOT NULL THEN
      UPDATE public.cliente_promocoes
         SET status = 'usada', data_uso = coalesce(data_uso, now()), orcamento_id = v_orcamento_id
       WHERE id = (
         SELECT cp.id
         FROM public.cliente_promocoes cp
         WHERE cp.cliente_id = v_fatura.cliente_id
           AND cp.promocao_id = v_promocao_id
           AND cp.status = 'ativa'
         ORDER BY (cp.orcamento_id = v_orcamento_id) DESC, cp.data_ativacao
         LIMIT 1
         FOR UPDATE
       );
    END IF;
  END IF;

  SELECT i.id, i.indicador_id, c.nome AS indicado_nome
    INTO v_indicacao
  FROM public.clientes c
  JOIN public.indicacoes i ON i.id = c.indicacao_origem_id
  WHERE c.id = v_fatura.cliente_id
    AND i.status = 'aberta'
  FOR UPDATE OF i;

  IF v_indicacao.id IS NOT NULL THEN
    SELECT * INTO v_indicador
    FROM public.clientes
    WHERE id = v_indicacao.indicador_id
    FOR UPDATE;

    SELECT coalesce((SELECT value FROM public.system_settings WHERE key = 'indicador_recompensa_tipo'), 'carteira'),
           coalesce((SELECT value::numeric FROM public.system_settings WHERE key = 'indicador_limite_carteira'),
                    (SELECT value::numeric FROM public.system_settings WHERE key = 'bonus_indicador'), 20),
           coalesce((SELECT value::integer FROM public.system_settings WHERE key = 'indicador_valor_pontos'), 50)
      INTO v_indicador_tipo, v_indicador_limite, v_indicador_pontos;

    IF v_indicador_tipo IN ('carteira', 'ambos') THEN
      v_bonus_carteira := least(round(greatest(v_gross_value, coalesce(v_fatura.valor_total, 0)) * 0.10, 2), v_indicador_limite);
      IF v_bonus_carteira > 0 THEN
        UPDATE public.clientes
           SET saldo_carteira = round(coalesce(saldo_carteira, 0) + v_bonus_carteira, 2)
         WHERE id = v_indicador.id;
        INSERT INTO public.carteira_lancamentos(cliente_id, valor, tipo, descricao)
        VALUES (v_indicador.id, v_bonus_carteira, 'credito', 'Bonus por indicacao concluida: ' || v_indicacao.indicado_nome);
        INSERT INTO public.extrato_financeiro(cliente_id, tipo, valor, descricao, saldo_resultante)
        VALUES (
          v_indicador.id, 'entrada', v_bonus_carteira,
          'Bonus de indicacao: ' || v_indicacao.indicado_nome,
          round(coalesce(v_indicador.saldo_carteira, 0) + v_bonus_carteira, 2)
        );
      END IF;
    END IF;

    IF v_indicador_tipo IN ('pontos', 'ambos') AND v_indicador_pontos > 0 THEN
      PERFORM public.gsa_apply_points_internal(
        v_indicador.id,
        v_indicador_pontos,
        'Bonus por indicacao concluida: ' || v_indicacao.indicado_nome,
        'indicacao',
        NULL,
        false
      );
    END IF;

    UPDATE public.indicacoes
       SET status = 'concluída',
           bonus_indicador = v_bonus_carteira,
           bonus_pontos = v_indicador_pontos,
           data_conclusao = coalesce(data_conclusao, now())
     WHERE id = v_indicacao.id;
  END IF;

  IF NOT coalesce(v_fatura.pontos_gerados, false) THEN
    v_points_res := public.gsa_apply_points_internal(
      v_fatura.cliente_id,
      CASE
        WHEN p_valor_base_pontos IS NOT NULL AND p_valor_base_pontos > 0
          THEN round(p_valor_base_pontos * v_pontos_por_real)::integer
        ELSE round(coalesce(v_fatura.valor_total, 0) * v_pontos_por_real)::integer
      END,
      'Pontos acumulados na fatura ' || coalesce(v_fatura.codigo_fatura, v_fatura.id::text),
      'pagamento_fatura',
      v_orcamento_id,
      false
    );

    v_pontos_gerados := coalesce((v_points_res->>'pontos_aplicados')::integer, 0);

    UPDATE public.faturas
       SET pontos_gerados = true
     WHERE id = p_fatura_id;
  END IF;

  RETURN jsonb_build_object(
    'success', true,
    'fatura_id', p_fatura_id,
    'bonus_carteira_indicador', v_bonus_carteira,
    'pontos_gerados', v_pontos_gerados
  );
END;
$$;
