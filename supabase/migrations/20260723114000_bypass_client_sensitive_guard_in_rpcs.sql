-- Allow legitimate SECURITY DEFINER client financial RPCs to update balance/points
CREATE OR REPLACE FUNCTION public.prevent_saldo_tampering()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO public, pg_temp
AS $$
BEGIN
    IF current_setting('my.app.bypass_saldo_check', true) = 'on'
       OR current_setting('gsa.credit_release', true) = 'on' THEN
        RETURN NEW;
    END IF;

    IF auth.role() = 'authenticated' THEN
        IF NEW.saldo_carteira IS DISTINCT FROM OLD.saldo_carteira OR NEW.saldo_pontos IS DISTINCT FROM OLD.saldo_pontos THEN
            RAISE EXCEPTION 'Acesso negado: Saldos não podem ser alterados diretamente.';
        END IF;
    END IF;
    RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.gsa_client_request_transfer(
  p_sessao_id uuid,
  p_session_token text,
  p_request_id uuid,
  p_destino_id uuid,
  p_tipo text,
  p_valor numeric,
  p_motivo text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_actor record;
  v_origin public.clientes%rowtype;
  v_destination public.clientes%rowtype;
  v_type text := lower(trim(coalesce(p_tipo, '')));
  v_value numeric := round(coalesce(p_valor, 0), 2);
  v_reason text := left(trim(coalesce(p_motivo, '')), 500);
  v_fee_percent numeric;
  v_fee_value numeric;
  v_net numeric;
  v_new_balance numeric;
  v_transfer_id uuid;
  v_result jsonb;
  v_inserted uuid;
BEGIN
  PERFORM set_config('gsa.credit_release', 'on', true);
  PERFORM set_config('my.app.bypass_saldo_check', 'on', true);
  IF p_request_id IS NULL THEN RAISE EXCEPTION 'Identificador da operação obrigatório.'; END IF;
  IF p_destino_id IS NULL OR v_type NOT IN ('saldo', 'pontos')
     OR v_value <= 0 OR length(v_reason) < 3 THEN
    RAISE EXCEPTION 'Dados inválidos para transferência.';
  END IF;
  IF v_type = 'pontos' AND v_value <> trunc(v_value) THEN RAISE EXCEPTION 'A transferência de pontos deve usar valor inteiro.'; END IF;

  SELECT * INTO v_actor FROM public.gsa_client_session_actor(p_sessao_id, p_session_token) LIMIT 1;
  IF p_destino_id = v_actor.cliente_id THEN RAISE EXCEPTION 'Não é possível transferir para a própria conta.'; END IF;

  INSERT INTO public.gsa_client_operation_requests(request_id, cliente_id, operacao)
  VALUES (p_request_id, v_actor.cliente_id, 'solicitar_transferencia')
  ON CONFLICT (request_id) DO NOTHING RETURNING request_id INTO v_inserted;
  IF v_inserted IS NULL THEN
    SELECT resultado INTO v_result FROM public.gsa_client_operation_requests
    WHERE request_id = p_request_id AND cliente_id = v_actor.cliente_id AND operacao = 'solicitar_transferencia';
    IF NOT FOUND THEN RAISE EXCEPTION 'Identificador da operação já utilizado.'; END IF;
    IF v_result IS NULL THEN RAISE EXCEPTION 'Operação ainda em processamento.'; END IF;
    RETURN v_result || jsonb_build_object('already_exists', true);
  END IF;

  PERFORM 1 FROM public.clientes
  WHERE id IN (v_actor.cliente_id, p_destino_id)
  ORDER BY id FOR UPDATE;
  SELECT * INTO v_origin FROM public.clientes WHERE id = v_actor.cliente_id;
  SELECT * INTO v_destination FROM public.clientes WHERE id = p_destino_id;
  IF v_destination.id IS NULL OR v_destination.status <> 'ativo' THEN RAISE EXCEPTION 'Destinatário indisponível.'; END IF;
  IF v_type = 'saldo' AND coalesce(v_origin.carteira_bloqueada, false) THEN RAISE EXCEPTION 'A carteira está bloqueada.'; END IF;
  IF v_type = 'pontos' AND coalesce(v_origin.pontos_bloqueados, false) THEN RAISE EXCEPTION 'A carteira de pontos está bloqueada.'; END IF;
  IF v_type = 'saldo' AND coalesce(v_origin.saldo_carteira, 0) < v_value THEN RAISE EXCEPTION 'Saldo insuficiente.'; END IF;
  IF v_type = 'pontos' AND coalesce(v_origin.saldo_pontos, 0) < v_value THEN RAISE EXCEPTION 'Saldo de pontos insuficiente.'; END IF;

  SELECT least(greatest(coalesce(taxa_saque_transferencia, 0), 0), 100)
  INTO v_fee_percent FROM public.client_levels
  WHERE id = coalesce(v_origin.nivel_manual_id, v_origin.nivel_id) LIMIT 1;
  v_fee_percent := coalesce(v_fee_percent, 0);
  v_fee_value := CASE WHEN v_type = 'saldo'
    THEN round(v_value * v_fee_percent / 100, 2)
    ELSE floor(v_value * v_fee_percent / 100) END;
  v_net := greatest(v_value - v_fee_value, 0);
  IF v_net <= 0 THEN RAISE EXCEPTION 'O valor líquido da transferência deve ser positivo.'; END IF;

  IF v_type = 'saldo' THEN
    v_new_balance := round(coalesce(v_origin.saldo_carteira, 0) - v_value, 2);
    UPDATE public.clientes SET saldo_carteira = v_new_balance WHERE id = v_actor.cliente_id;
  ELSE
    v_new_balance := coalesce(v_origin.saldo_pontos, 0) - v_value;
    UPDATE public.clientes SET saldo_pontos = v_new_balance::integer WHERE id = v_actor.cliente_id;
  END IF;

  INSERT INTO public.transferencias(
    request_id, cliente_origem_id, cliente_destino_id, tipo,
    valor, taxa_aplicada, valor_liquido, motivo, status, data_solicitacao
  ) VALUES (
    p_request_id, v_actor.cliente_id, p_destino_id, v_type,
    v_value, v_fee_value, v_net, v_reason, 'em_analise', now()
  ) RETURNING id INTO v_transfer_id;

  IF v_type = 'saldo' THEN
    INSERT INTO public.carteira_lancamentos(cliente_id, valor, tipo, descricao)
    VALUES (v_actor.cliente_id, v_value, 'debito', 'Transferência em análise para ' || v_destination.nome);
    INSERT INTO public.extrato_financeiro(
      cliente_id, tipo, valor, descricao, referencia_id, modulo_referencia, saldo_resultante
    ) VALUES (
      v_actor.cliente_id, 'saida', v_value,
      format('Transferência em análise para %s (taxa: %s%%)', v_destination.nome, v_fee_percent),
      v_transfer_id, 'transferencia', v_new_balance
    );
  ELSE
    INSERT INTO public.pontos_movimentacoes(cliente_id, tipo, pontos, saldo_apos, descricao)
    VALUES (
      v_actor.cliente_id, 'resgate', -v_value::integer, v_new_balance::integer,
      format('Transferência em análise para %s (taxa: %s%%)', v_destination.nome, v_fee_percent)
    );
    INSERT INTO public.points_transactions(cliente_id, tipo, pontos, descricao)
    VALUES (v_actor.cliente_id, 'transferencia_enviada', -v_value::integer, 'Transferência em análise para ' || v_destination.nome);
  END IF;

  v_result := jsonb_build_object(
    'success', true, 'already_exists', false, 'transferencia_id', v_transfer_id,
    'saldo_resultante', v_new_balance, 'taxa_aplicada', v_fee_value,
    'taxa_percentual', v_fee_percent, 'valor_liquido', v_net
  );
  UPDATE public.gsa_client_operation_requests SET resultado = v_result, completed_at = now()
  WHERE request_id = p_request_id;

  INSERT INTO public.notificacoes(
    cliente_id, titulo, mensagem, modulo, tab, item_id,
    destinatario_tipo, acao_origem, contexto
  ) VALUES (
    v_actor.cliente_id, 'Transferência solicitada',
    'Sua transferência para ' || v_destination.nome || ' foi enviada para análise.',
    'financeiro', 'transferencias', v_transfer_id::text,
    'cliente', 'solicitar_transferencia', jsonb_build_object('transferencia_id', v_transfer_id)
  );
  INSERT INTO public.notificacoes(
    titulo, mensagem, modulo, tab, item_id,
    destinatario_tipo, prioridade, acao_origem, contexto
  ) VALUES (
    'Nova transferência solicitada',
    format('%s solicitou transferência para %s.', v_actor.cliente_nome, v_destination.nome),
    'financeiro', 'transferencias', v_transfer_id::text,
    'admin', 'alta', 'solicitar_transferencia', jsonb_build_object('transferencia_id', v_transfer_id)
  );

  RETURN v_result;
END;
$$;

CREATE OR REPLACE FUNCTION public.gsa_client_cancel_transfer(
  p_sessao_id uuid,
  p_session_token text,
  p_transferencia_id uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_actor record;
  v_transfer public.transferencias%rowtype;
  v_client public.clientes%rowtype;
  v_balance numeric;
BEGIN
  PERFORM set_config('gsa.credit_release', 'on', true);
  PERFORM set_config('my.app.bypass_saldo_check', 'on', true);
  SELECT * INTO v_actor FROM public.gsa_client_session_actor(p_sessao_id, p_session_token) LIMIT 1;
  SELECT * INTO v_transfer FROM public.transferencias
  WHERE id = p_transferencia_id AND cliente_origem_id = v_actor.cliente_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Transferência não encontrada.'; END IF;
  IF v_transfer.status = 'cancelado' THEN
    RETURN jsonb_build_object('success', true, 'already_cancelled', true, 'transferencia_id', p_transferencia_id);
  END IF;
  IF v_transfer.status <> 'em_analise' THEN RAISE EXCEPTION 'Esta transferência já foi processada.'; END IF;
  SELECT * INTO v_client FROM public.clientes WHERE id = v_actor.cliente_id FOR UPDATE;

  IF v_transfer.tipo = 'saldo' THEN
    v_balance := round(coalesce(v_client.saldo_carteira, 0) + v_transfer.valor, 2);
    UPDATE public.clientes SET saldo_carteira = v_balance WHERE id = v_actor.cliente_id;
    INSERT INTO public.carteira_lancamentos(cliente_id, valor, tipo, descricao)
    VALUES (v_actor.cliente_id, v_transfer.valor, 'credito', 'Estorno de transferência cancelada');
    INSERT INTO public.extrato_financeiro(
      cliente_id, tipo, valor, descricao, referencia_id, modulo_referencia, saldo_resultante
    ) VALUES (
      v_actor.cliente_id, 'entrada', v_transfer.valor, 'Estorno de transferência cancelada',
      p_transferencia_id, 'transferencia', v_balance
    );
  ELSE
    v_balance := coalesce(v_client.saldo_pontos, 0) + v_transfer.valor;
    UPDATE public.clientes SET saldo_pontos = v_balance::integer WHERE id = v_actor.cliente_id;
    INSERT INTO public.pontos_movimentacoes(cliente_id, tipo, pontos, saldo_apos, descricao)
    VALUES (v_actor.cliente_id, 'estorno', v_transfer.valor::integer, v_balance::integer, 'Estorno de transferência cancelada');
    INSERT INTO public.points_transactions(cliente_id, tipo, pontos, descricao)
    VALUES (v_actor.cliente_id, 'estorno', v_transfer.valor::integer, 'Estorno de transferência cancelada');
  END IF;

  UPDATE public.transferencias
  SET status = 'cancelado', motivo_cancelamento = 'Cancelada pelo cliente',
      observacoes_admin = 'Cancelada pelo cliente'
  WHERE id = p_transferencia_id;
  RETURN jsonb_build_object(
    'success', true, 'already_cancelled', false,
    'transferencia_id', p_transferencia_id, 'saldo_resultante', v_balance
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.gsa_client_reverse_transfer(
  p_sessao_id uuid,
  p_session_token text,
  p_transferencia_id uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_actor record;
  v_transfer public.transferencias%rowtype;
  v_origin public.clientes%rowtype;
  v_destination public.clientes%rowtype;
  v_origin_balance numeric;
  v_destination_balance numeric;
BEGIN
  PERFORM set_config('gsa.credit_release', 'on', true);
  PERFORM set_config('my.app.bypass_saldo_check', 'on', true);
  SELECT * INTO v_actor FROM public.gsa_client_session_actor(p_sessao_id, p_session_token) LIMIT 1;
  SELECT * INTO v_transfer FROM public.transferencias WHERE id = p_transferencia_id FOR UPDATE;
  IF NOT FOUND OR v_actor.cliente_id NOT IN (v_transfer.cliente_origem_id, v_transfer.cliente_destino_id) THEN
    RAISE EXCEPTION 'Transferência não encontrada.';
  END IF;
  IF v_transfer.status = 'estornado' THEN
    RETURN jsonb_build_object('success', true, 'already_reversed', true, 'transferencia_id', p_transferencia_id);
  END IF;
  IF v_transfer.status NOT IN ('aprovado', 'concluido') THEN RAISE EXCEPTION 'Esta transferência não pode ser estornada.'; END IF;

  PERFORM 1 FROM public.clientes
  WHERE id IN (v_transfer.cliente_origem_id, v_transfer.cliente_destino_id)
  ORDER BY id FOR UPDATE;
  SELECT * INTO v_origin FROM public.clientes WHERE id = v_transfer.cliente_origem_id;
  SELECT * INTO v_destination FROM public.clientes WHERE id = v_transfer.cliente_destino_id;

  IF v_transfer.tipo = 'saldo' THEN
    IF coalesce(v_destination.saldo_carteira, 0) < v_transfer.valor_liquido THEN
      RAISE EXCEPTION 'O destinatário não possui saldo suficiente para estorno.';
    END IF;
    v_origin_balance := round(coalesce(v_origin.saldo_carteira, 0) + v_transfer.valor, 2);
    v_destination_balance := round(coalesce(v_destination.saldo_carteira, 0) - v_transfer.valor_liquido, 2);

    UPDATE public.clientes SET saldo_carteira = v_origin_balance WHERE id = v_transfer.cliente_origem_id;
    UPDATE public.clientes SET saldo_carteira = v_destination_balance WHERE id = v_transfer.cliente_destino_id;

    INSERT INTO public.carteira_lancamentos(cliente_id, valor, tipo, descricao)
    VALUES
      (v_transfer.cliente_origem_id, v_transfer.valor, 'credito', 'Estorno de transferência recebido de ' || v_destination.nome),
      (v_transfer.cliente_destino_id, v_transfer.valor_liquido, 'debito', 'Estorno de transferência devolvido para ' || v_origin.nome);

    INSERT INTO public.extrato_financeiro(
      cliente_id, tipo, valor, descricao, referencia_id, modulo_referencia, saldo_resultante
    ) VALUES
      (v_transfer.cliente_origem_id, 'entrada', v_transfer.valor, 'Estorno de transferência recebido de ' || v_destination.nome, p_transferencia_id, 'transferencia', v_origin_balance),
      (v_transfer.cliente_destino_id, 'saida', v_transfer.valor_liquido, 'Estorno de transferência devolvido para ' || v_origin.nome, p_transferencia_id, 'transferencia', v_destination_balance);
  ELSE
    IF coalesce(v_destination.saldo_pontos, 0) < v_transfer.valor_liquido THEN
      RAISE EXCEPTION 'O destinatário não possui pontos suficientes para estorno.';
    END IF;
    v_origin_balance := coalesce(v_origin.saldo_pontos, 0) + v_transfer.valor;
    v_destination_balance := coalesce(v_destination.saldo_pontos, 0) - v_transfer.valor_liquido;

    UPDATE public.clientes SET saldo_pontos = v_origin_balance::integer WHERE id = v_transfer.cliente_origem_id;
    UPDATE public.clientes SET saldo_pontos = v_destination_balance::integer WHERE id = v_transfer.cliente_destino_id;

    INSERT INTO public.pontos_movimentacoes(cliente_id, tipo, pontos, saldo_apos, descricao)
    VALUES
      (v_transfer.cliente_origem_id, 'estorno', v_transfer.valor::integer, v_origin_balance::integer, 'Estorno de transferência recebido'),
      (v_transfer.cliente_destino_id, 'resgate', -v_transfer.valor_liquido::integer, v_destination_balance::integer, 'Estorno de transferência devolvido');

    INSERT INTO public.points_transactions(cliente_id, tipo, pontos, descricao)
    VALUES
      (v_transfer.cliente_origem_id, 'estorno', v_transfer.valor::integer, 'Estorno de transferência recebido'),
      (v_transfer.cliente_destino_id, 'estorno', -v_transfer.valor_liquido::integer, 'Estorno de transferência devolvido');
  END IF;

  UPDATE public.transferencias
  SET status = 'estornado', data_estorno = now(),
      motivo_cancelamento = 'Estornada pelo usuário', observacoes_admin = 'Estornada pelo usuário'
  WHERE id = p_transferencia_id;

  RETURN jsonb_build_object('success', true, 'already_reversed', false, 'transferencia_id', p_transferencia_id);
END;
$$;
