-- Atomic invoice settlement and gamification. No financial side effect is left
-- for the browser to perform after the invoice commit.

CREATE OR REPLACE FUNCTION public.gsa_client_session_actor(
  p_sessao_id uuid,
  p_session_token text
)
RETURNS TABLE(cliente_id uuid, cliente_nome text)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_session record;
BEGIN
  SELECT * INTO v_session
  FROM public.gsa_validate_session(p_sessao_id, p_session_token)
  LIMIT 1;

  IF NOT coalesce(v_session.is_valid, false)
     OR v_session.ator_tipo <> 'cliente'
     OR v_session.ator_id IS NULL THEN
    RAISE EXCEPTION 'Sessao de cliente invalida ou expirada.';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.clientes c
    WHERE c.id = v_session.ator_id
      AND coalesce(c.status, 'ativo') <> 'inativo'
  ) THEN
    RAISE EXCEPTION 'Cliente inativo ou inexistente.';
  END IF;

  cliente_id := v_session.ator_id;
  cliente_nome := coalesce(v_session.ator_nome, 'Cliente');
  RETURN NEXT;
END;
$$;

CREATE OR REPLACE FUNCTION public.gsa_provider_session_actor(
  p_sessao_id uuid,
  p_session_token text
)
RETURNS TABLE(prestador_id uuid, prestador_nome text)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_session record;
BEGIN
  SELECT * INTO v_session
  FROM public.gsa_validate_session(p_sessao_id, p_session_token)
  LIMIT 1;

  IF NOT coalesce(v_session.is_valid, false)
     OR v_session.ator_tipo <> 'prestador'
     OR v_session.ator_id IS NULL THEN
    RAISE EXCEPTION 'Sessao de prestador invalida ou expirada.';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.prestadores p
    WHERE p.id = v_session.ator_id
      AND coalesce(p.status, 'ativo') NOT IN ('suspenso', 'desligado', 'reprovado')
  ) THEN
    RAISE EXCEPTION 'Prestador bloqueado ou inexistente.';
  END IF;

  prestador_id := v_session.ator_id;
  prestador_nome := coalesce(v_session.ator_nome, 'Prestador');
  RETURN NEXT;
END;
$$;

REVOKE ALL ON FUNCTION public.gsa_client_session_actor(uuid, text) FROM public, anon, authenticated;
REVOKE ALL ON FUNCTION public.gsa_provider_session_actor(uuid, text) FROM public, anon, authenticated;

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
SET search_path = public
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
    RETURN jsonb_build_object('success', true, 'already_processed', true);
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

REVOKE ALL ON FUNCTION public.gsa_apply_points_internal(uuid, integer, text, text, uuid, boolean)
  FROM public, anon, authenticated;

CREATE OR REPLACE FUNCTION public.gsa_finalize_paid_invoice_internal(
  p_fatura_id uuid,
  p_valor_base_pontos numeric DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
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
  v_valor_restaurado numeric := 0;
  v_novo_limite numeric := 0;
BEGIN
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
           data_conclusao = now()
     WHERE id = v_indicacao.id;

    INSERT INTO public.notificacoes(
      cliente_id, titulo, mensagem, modulo, lida, tipo,
      destinatario_tipo, prioridade, acao_origem, contexto
    ) VALUES (
      v_indicador.id,
      'Bonus de indicacao',
      'Sua indicacao de ' || v_indicacao.indicado_nome || ' foi concluida e a recompensa foi creditada.',
      'indique-ganhe', false, 'sistema', 'cliente', 'alta',
      'indicacao_concluida', jsonb_build_object('indicacao_id', v_indicacao.id)
    );
  END IF;

  IF NOT coalesce(v_fatura.pontos_gerados, false)
     AND coalesce(p_valor_base_pontos, 0) > 0 THEN
    SELECT coalesce(cl.pontos_por_real, 1)
      INTO v_pontos_por_real
    FROM public.clientes c
    LEFT JOIN public.client_levels cl ON cl.id = coalesce(c.nivel_manual_id, c.nivel_id)
    WHERE c.id = v_fatura.cliente_id;
    v_pontos_gerados := floor(round(p_valor_base_pontos, 2) * coalesce(v_pontos_por_real, 1));

    IF v_pontos_gerados > 0 THEN
      PERFORM public.gsa_apply_points_internal(
        v_fatura.cliente_id,
        v_pontos_gerados,
        'Pagamento da fatura ' || coalesce(v_fatura.codigo_fatura, v_fatura.id::text),
        'geracao_fatura',
        v_fatura.id,
        true
      );
    END IF;
    UPDATE public.faturas SET pontos_gerados = true WHERE id = v_fatura.id;
  END IF;

  RETURN jsonb_build_object(
    'success', true,
    'fatura_id', v_fatura.id,
    'orcamento_id', v_orcamento_id,
    'pontos_gerados', v_pontos_gerados,
    'bonus_indicacao', v_bonus_carteira,
    'credito_restaurado', v_valor_restaurado
  );
END;
$$;

REVOKE ALL ON FUNCTION public.gsa_finalize_paid_invoice_internal(uuid, numeric)
  FROM public, anon, authenticated;

CREATE OR REPLACE FUNCTION public.gsa_client_pagar_fatura(
  p_sessao_id uuid,
  p_session_token text,
  p_payload jsonb
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_actor record;
  v_fatura public.faturas%rowtype;
  v_cliente public.clientes%rowtype;
  v_voucher public.vouchers%rowtype;
  v_fatura_id uuid := nullif(p_payload ->> 'fatura_id', '')::uuid;
  v_voucher_id uuid := nullif(p_payload ->> 'voucher_id', '')::uuid;
  v_metodo text := coalesce(nullif(trim(p_payload ->> 'metodo'), ''), 'carteira');
  v_use_wallet boolean := coalesce((p_payload ->> 'use_wallet')::boolean, false);
  v_use_pontos boolean := coalesce((p_payload ->> 'use_pontos')::boolean, false);
  v_taxa_conversao numeric := greatest(coalesce((p_payload ->> 'taxa_conversao')::numeric, 0.01), 0.0001);
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
  v_points_base numeric;
  v_now timestamptz := now();
BEGIN
  SELECT * INTO v_actor
  FROM public.gsa_client_session_actor(p_sessao_id, p_session_token)
  LIMIT 1;

  IF v_fatura_id IS NULL THEN RAISE EXCEPTION 'Fatura obrigatoria.'; END IF;

  SELECT * INTO v_fatura
  FROM public.faturas
  WHERE id = v_fatura_id
    AND cliente_id = v_actor.cliente_id
  FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Fatura nao encontrada.'; END IF;

  IF v_fatura.status = 'pago' THEN
    RETURN jsonb_build_object('success', true, 'already_processed', true, 'status', 'pago');
  END IF;
  IF v_fatura.status = 'cancelado' THEN RAISE EXCEPTION 'Fatura cancelada.'; END IF;
  IF v_fatura.status = 'pendente_pagamento' AND v_fatura.data_escolha_pagamento IS NOT NULL THEN
    RETURN jsonb_build_object(
      'success', true,
      'already_processed', true,
      'status', v_fatura.status,
      'valor_pendente', v_fatura.valor_final_pendente
    );
  END IF;

  SELECT * INTO v_cliente
  FROM public.clientes
  WHERE id = v_actor.cliente_id
  FOR UPDATE;

  v_subtotal := round(coalesce(v_fatura.valor_final_pendente, v_fatura.valor_total, 0), 2);
  IF v_subtotal <= 0 THEN RAISE EXCEPTION 'Fatura sem valor pendente.'; END IF;

  v_is_store_invoice := v_fatura.ordem_compra_id IS NOT NULL
    OR (v_fatura.ordem_assinatura_id IS NOT NULL AND coalesce(v_fatura.codigo_fatura, '') ~ '-1/[0-9]+$');

  IF v_voucher_id IS NOT NULL THEN
    SELECT * INTO v_voucher FROM public.vouchers WHERE id = v_voucher_id FOR UPDATE;
    IF NOT FOUND OR v_voucher.status <> 'ativo' THEN RAISE EXCEPTION 'Voucher invalido ou expirado.'; END IF;
    IF v_voucher.cliente_id IS NOT NULL AND v_voucher.cliente_id <> v_actor.cliente_id THEN
      RAISE EXCEPTION 'Voucher nao pertence a este cliente.';
    END IF;
    IF v_voucher.validade IS NOT NULL AND v_voucher.validade < current_date THEN RAISE EXCEPTION 'Voucher expirado.'; END IF;
    IF coalesce(v_voucher.usage_limit, 0) > 0 AND coalesce(v_voucher.usage_count, 0) >= v_voucher.usage_limit THEN
      RAISE EXCEPTION 'Limite de uso do voucher atingido.';
    END IF;
    IF v_voucher.categoria = 'saque' THEN RAISE EXCEPTION 'Voucher incompativel com fatura.'; END IF;

    v_voucher_discount := CASE
      WHEN v_voucher.tipo = 'porcentagem' THEN round(v_subtotal * (v_voucher.valor / 100), 2)
      ELSE round(v_voucher.valor, 2)
    END;
    v_voucher_discount := least(greatest(v_voucher_discount, 0), v_subtotal);

    UPDATE public.vouchers
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
    IF coalesce(v_cliente.carteira_bloqueada, false) THEN RAISE EXCEPTION 'Carteira bloqueada.'; END IF;
    v_wallet_deduction := round(least(
      greatest(coalesce(v_cliente.saldo_carteira, 0), 0),
      greatest(v_subtotal - v_voucher_discount, 0)
    ), 2);
  END IF;

  IF v_use_pontos AND NOT v_is_store_invoice THEN
    IF coalesce(v_cliente.pontos_bloqueados, false) THEN RAISE EXCEPTION 'Carteira de pontos bloqueada.'; END IF;
    v_pontos_deduction := round(least(
      greatest(coalesce(v_cliente.saldo_pontos, 0) * v_taxa_conversao, 0),
      greatest(v_subtotal - v_voucher_discount - v_wallet_deduction, 0)
    ), 2);
    v_pontos_utilizados := ceil(v_pontos_deduction / v_taxa_conversao);
    IF v_pontos_utilizados > coalesce(v_cliente.saldo_pontos, 0) THEN RAISE EXCEPTION 'Saldo de pontos insuficiente.'; END IF;
  END IF;

  v_negative_charge := CASE WHEN coalesce(v_cliente.saldo_carteira, 0) < 0 THEN abs(v_cliente.saldo_carteira) ELSE 0 END;
  v_net_total := round(greatest(v_subtotal - v_voucher_discount - v_wallet_deduction - v_pontos_deduction, 0) + v_negative_charge, 2);
  v_novo_status := CASE WHEN v_net_total <= 0 THEN 'pago' ELSE 'pendente_pagamento' END;
  v_paid_now := round(v_voucher_discount + v_wallet_deduction + v_pontos_deduction, 2);
  v_points_base := greatest(v_paid_now - v_pontos_deduction, 0);

  IF v_wallet_deduction > 0 THEN
    UPDATE public.clientes SET saldo_carteira = coalesce(saldo_carteira, 0) - v_wallet_deduction WHERE id = v_actor.cliente_id;
    INSERT INTO public.extrato_financeiro(cliente_id, tipo, valor, descricao, referencia_id, modulo_referencia, saldo_resultante)
    VALUES (
      v_actor.cliente_id, 'saida', v_wallet_deduction,
      'Uso de saldo - Fatura ' || coalesce(v_fatura.codigo_fatura, 'N/A'),
      v_fatura_id, 'faturas', coalesce(v_cliente.saldo_carteira, 0) - v_wallet_deduction
    );
    INSERT INTO public.pagamentos(fatura_id, valor, metodo, data_pagamento)
    VALUES (v_fatura_id, v_wallet_deduction, 'carteira', v_now);
  END IF;

  IF v_pontos_deduction > 0 THEN
    PERFORM public.gsa_apply_points_internal(
      v_actor.cliente_id,
      -v_pontos_utilizados,
      'Uso de pontos na fatura ' || coalesce(v_fatura.codigo_fatura, 'N/A'),
      'uso_fatura',
      v_fatura_id,
      false
    );
    UPDATE public.pontos_movimentacoes
       SET valor_convertido = v_pontos_deduction
     WHERE id = (
       SELECT id FROM public.pontos_movimentacoes
       WHERE cliente_id = v_actor.cliente_id
         AND fatura_id = v_fatura_id
         AND tipo = 'uso_fatura'
       ORDER BY data_movimentacao DESC
       LIMIT 1
     );
    INSERT INTO public.pagamentos(fatura_id, valor, metodo, data_pagamento)
    VALUES (v_fatura_id, v_pontos_deduction, 'pontos', v_now);
  END IF;

  IF v_voucher_discount > 0 THEN
    INSERT INTO public.pagamentos(fatura_id, voucher_id, valor, metodo, data_pagamento)
    VALUES (v_fatura_id, v_voucher_id, v_voucher_discount, 'voucher', v_now);
  END IF;

  UPDATE public.faturas
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

  IF v_novo_status = 'pago' THEN
    PERFORM public.gsa_finalize_paid_invoice_internal(v_fatura_id, v_points_base);
  END IF;

  RETURN jsonb_build_object(
    'success', true,
    'already_processed', false,
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

CREATE OR REPLACE FUNCTION public.gsa_admin_baixar_fatura(
  p_sessao_id uuid,
  p_session_token text,
  p_fatura_id uuid,
  p_metodo text DEFAULT 'manual',
  p_data_pagamento timestamptz DEFAULT now(),
  p_observacoes text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_actor record;
  v_fatura public.faturas%rowtype;
  v_valor_pago numeric;
  v_metodo text := coalesce(nullif(trim(p_metodo), ''), 'manual');
  v_data_pagamento timestamptz := coalesce(p_data_pagamento, now());
  v_finalizacao jsonb;
BEGIN
  SELECT * INTO v_actor
  FROM public.gsa_admin_session_actor(p_sessao_id, p_session_token)
  LIMIT 1;

  SELECT * INTO v_fatura
  FROM public.faturas
  WHERE id = p_fatura_id
  FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Fatura nao encontrada.'; END IF;
  IF v_fatura.status = 'cancelado' THEN RAISE EXCEPTION 'Fatura cancelada nao pode receber baixa.'; END IF;

  v_valor_pago := round(coalesce(v_fatura.valor_final_pendente, v_fatura.valor_total, 0), 2);
  IF v_valor_pago <= 0 THEN v_valor_pago := round(coalesce(v_fatura.valor_total, 0), 2); END IF;

  IF v_fatura.status = 'pago' THEN
    v_finalizacao := public.gsa_finalize_paid_invoice_internal(
      p_fatura_id,
      CASE WHEN coalesce(v_fatura.pontos_gerados, false) THEN 0 ELSE v_valor_pago END
    );
    RETURN jsonb_build_object(
      'success', true, 'already_processed', true, 'fatura_id', p_fatura_id,
      'status', 'pago', 'valor_pago', coalesce(v_fatura.valor_pago, v_valor_pago),
      'finalizacao', v_finalizacao
    );
  END IF;

  UPDATE public.faturas
     SET status = 'pago',
         data_pagamento = v_data_pagamento,
         forma_pagamento_escolhida = v_metodo,
         data_escolha_pagamento = v_data_pagamento,
         observacoes = coalesce(nullif(trim(p_observacoes), ''), observacoes),
         valor_pago = round(coalesce(valor_pago, 0) + v_valor_pago, 2),
         valor_final_pendente = 0
   WHERE id = p_fatura_id;

  INSERT INTO public.pagamentos(fatura_id, metodo, valor, data_pagamento)
  VALUES (p_fatura_id, v_metodo, v_valor_pago, v_data_pagamento);

  v_finalizacao := public.gsa_finalize_paid_invoice_internal(p_fatura_id, v_valor_pago);

  RETURN jsonb_build_object(
    'success', true, 'already_processed', false, 'fatura_id', p_fatura_id,
    'status', 'pago', 'valor_pago', v_valor_pago, 'metodo', v_metodo,
    'ator_tipo', v_actor.ator_tipo, 'ator_nome', v_actor.ator_nome,
    'finalizacao', v_finalizacao
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.gsa_admin_adjust_points(
  p_sessao_id uuid,
  p_session_token text,
  p_cliente_id uuid,
  p_pontos integer,
  p_descricao text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_actor record;
  v_result jsonb;
BEGIN
  SELECT * INTO v_actor
  FROM public.gsa_admin_session_actor(p_sessao_id, p_session_token)
  LIMIT 1;

  IF p_pontos = 0 OR abs(p_pontos) > 1000000 THEN RAISE EXCEPTION 'Ajuste de pontos invalido.'; END IF;
  IF nullif(trim(p_descricao), '') IS NULL THEN RAISE EXCEPTION 'Informe o motivo do ajuste.'; END IF;

  v_result := public.gsa_apply_points_internal(
    p_cliente_id,
    p_pontos,
    trim(p_descricao) || ' [POR: ' || v_actor.ator_nome || ']',
    'ajuste_manual',
    NULL,
    true
  );

  INSERT INTO public.sistema_logs(acao, detalhes, ator_tipo, ator_id, ator_nome)
  VALUES (
    'AJUSTE_PONTOS_CLIENTE',
    jsonb_build_object('cliente_id', p_cliente_id, 'pontos', p_pontos, 'motivo', trim(p_descricao))::text,
    v_actor.ator_tipo, v_actor.ator_id, v_actor.ator_nome
  );
  RETURN v_result;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.pagar_fatura_cliente(jsonb) FROM public, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.secure_add_gamification_points(uuid, numeric, text, text, uuid)
  FROM public, anon, authenticated;

REVOKE ALL ON FUNCTION public.gsa_client_pagar_fatura(uuid, text, jsonb) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.gsa_client_pagar_fatura(uuid, text, jsonb) TO authenticated;

REVOKE ALL ON FUNCTION public.gsa_admin_adjust_points(uuid, text, uuid, integer, text) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.gsa_admin_adjust_points(uuid, text, uuid, integer, text) TO authenticated;

REVOKE EXECUTE ON FUNCTION public.gsa_admin_baixar_fatura(uuid, text, uuid, text, timestamptz, text) FROM anon;
GRANT EXECUTE ON FUNCTION public.gsa_admin_baixar_fatura(uuid, text, uuid, text, timestamptz, text) TO authenticated;
