-- Session-bound wallet, points, withdrawal and transfer operations.

CREATE TABLE IF NOT EXISTS public.gsa_client_operation_requests (
  request_id uuid PRIMARY KEY,
  cliente_id uuid NOT NULL REFERENCES public.clientes(id) ON DELETE CASCADE,
  operacao text NOT NULL,
  resultado jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  completed_at timestamptz,
  CONSTRAINT gsa_client_operation_name_check CHECK (operacao IN (
    'converter_pontos', 'solicitar_saque', 'solicitar_transferencia'
  ))
);

CREATE INDEX IF NOT EXISTS idx_gsa_client_operation_requests_client
  ON public.gsa_client_operation_requests(cliente_id, operacao, created_at DESC);

ALTER TABLE public.gsa_client_operation_requests ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.gsa_client_operation_requests FROM public, anon, authenticated;

ALTER TABLE public.saques ADD COLUMN IF NOT EXISTS request_id uuid;
CREATE UNIQUE INDEX IF NOT EXISTS uq_saques_request_id
  ON public.saques(request_id) WHERE request_id IS NOT NULL;

ALTER TABLE public.transferencias ADD COLUMN IF NOT EXISTS request_id uuid;
CREATE UNIQUE INDEX IF NOT EXISTS uq_transferencias_request_id
  ON public.transferencias(request_id) WHERE request_id IS NOT NULL;

CREATE OR REPLACE FUNCTION public.gsa_client_lookup_transfer_recipient(
  p_sessao_id uuid,
  p_session_token text,
  p_tipo_documento text,
  p_documento text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_actor record;
  v_type text := lower(trim(coalesce(p_tipo_documento, '')));
  v_document text := regexp_replace(coalesce(p_documento, ''), '\D', '', 'g');
  v_recipient record;
BEGIN
  SELECT * INTO v_actor
  FROM public.gsa_client_session_actor(p_sessao_id, p_session_token)
  LIMIT 1;

  IF v_type = 'cpf' AND length(v_document) <> 11 THEN RAISE EXCEPTION 'CPF inválido.'; END IF;
  IF v_type = 'cnpj' AND length(v_document) <> 14 THEN RAISE EXCEPTION 'CNPJ inválido.'; END IF;
  IF v_type NOT IN ('cpf', 'cnpj') THEN RAISE EXCEPTION 'Tipo de documento inválido.'; END IF;

  SELECT id, nome INTO v_recipient
  FROM public.clientes
  WHERE id <> v_actor.cliente_id
    AND status = 'ativo'
    AND CASE WHEN v_type = 'cpf'
      THEN regexp_replace(coalesce(cpf, ''), '\D', '', 'g') = v_document
      ELSE regexp_replace(coalesce(cnpj, ''), '\D', '', 'g') = v_document
    END
  LIMIT 1;

  IF v_recipient.id IS NULL THEN RAISE EXCEPTION 'Destinatário não encontrado.'; END IF;
  RETURN jsonb_build_object('id', v_recipient.id, 'nome', v_recipient.nome);
END;
$$;

CREATE OR REPLACE FUNCTION public.gsa_client_convert_points(
  p_sessao_id uuid,
  p_session_token text,
  p_request_id uuid,
  p_pontos integer
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_actor record;
  v_client public.clientes%rowtype;
  v_rate numeric;
  v_amount numeric;
  v_result jsonb;
  v_inserted uuid;
  v_new_points integer;
  v_new_wallet numeric;
BEGIN
  IF p_request_id IS NULL THEN RAISE EXCEPTION 'Identificador da operação obrigatório.'; END IF;
  IF p_pontos IS NULL OR p_pontos <= 0 OR p_pontos > 100000000 THEN
    RAISE EXCEPTION 'Quantidade de pontos inválida.';
  END IF;

  SELECT * INTO v_actor
  FROM public.gsa_client_session_actor(p_sessao_id, p_session_token)
  LIMIT 1;

  INSERT INTO public.gsa_client_operation_requests(request_id, cliente_id, operacao)
  VALUES (p_request_id, v_actor.cliente_id, 'converter_pontos')
  ON CONFLICT (request_id) DO NOTHING
  RETURNING request_id INTO v_inserted;

  IF v_inserted IS NULL THEN
    SELECT resultado INTO v_result
    FROM public.gsa_client_operation_requests
    WHERE request_id = p_request_id
      AND cliente_id = v_actor.cliente_id
      AND operacao = 'converter_pontos';
    IF NOT FOUND THEN RAISE EXCEPTION 'Identificador da operação já utilizado.'; END IF;
    IF v_result IS NULL THEN RAISE EXCEPTION 'Operação ainda em processamento.'; END IF;
    RETURN v_result || jsonb_build_object('already_exists', true);
  END IF;

  SELECT * INTO v_client FROM public.clientes WHERE id = v_actor.cliente_id FOR UPDATE;
  IF coalesce(v_client.pontos_bloqueados, false) THEN RAISE EXCEPTION 'A carteira de pontos está bloqueada.'; END IF;
  IF coalesce(v_client.saldo_pontos, 0) < p_pontos THEN RAISE EXCEPTION 'Saldo de pontos insuficiente.'; END IF;

  SELECT least(greatest(coalesce(taxa_conversao_pontos, 0.01), 0.0001), 100)
  INTO v_rate FROM public.empresa ORDER BY created_at LIMIT 1;
  v_rate := coalesce(v_rate, 0.01);
  v_amount := round(p_pontos * v_rate, 2);
  v_new_points := coalesce(v_client.saldo_pontos, 0) - p_pontos;
  v_new_wallet := round(coalesce(v_client.saldo_carteira, 0) + v_amount, 2);

  UPDATE public.clientes
  SET saldo_pontos = v_new_points, saldo_carteira = v_new_wallet
  WHERE id = v_actor.cliente_id;

  INSERT INTO public.pontos_movimentacoes(
    cliente_id, tipo, pontos, saldo_apos, descricao, valor_convertido
  ) VALUES (
    v_actor.cliente_id, 'conversao_dinheiro', -p_pontos, v_new_points,
    'Conversão de pontos em saldo da carteira', v_amount
  );
  INSERT INTO public.points_transactions(cliente_id, tipo, pontos, descricao)
  VALUES (v_actor.cliente_id, 'conversao_dinheiro', -p_pontos, 'Conversão de pontos em saldo da carteira');
  INSERT INTO public.carteira_lancamentos(cliente_id, valor, tipo, descricao)
  VALUES (v_actor.cliente_id, v_amount, 'credito', 'Conversão de pontos em saldo da carteira');
  INSERT INTO public.extrato_financeiro(
    cliente_id, tipo, valor, descricao, modulo_referencia, saldo_resultante
  ) VALUES (
    v_actor.cliente_id, 'entrada', v_amount, 'Conversão de pontos em saldo', 'pontos', v_new_wallet
  );

  v_result := jsonb_build_object(
    'success', true, 'already_exists', false,
    'valor_convertido', v_amount, 'taxa_conversao', v_rate,
    'saldo_pontos', v_new_points, 'saldo_carteira', v_new_wallet
  );
  UPDATE public.gsa_client_operation_requests
  SET resultado = v_result, completed_at = now()
  WHERE request_id = p_request_id;

  INSERT INTO public.notificacoes(
    cliente_id, titulo, mensagem, modulo, tab,
    destinatario_tipo, acao_origem, contexto
  ) VALUES (
    v_actor.cliente_id, 'Pontos convertidos',
    format('%s pontos foram convertidos em R$ %s.', p_pontos, to_char(v_amount, 'FM999G999G990D00')),
    'fidelidade', 'pontos', 'cliente', 'converter_pontos',
    jsonb_build_object('pontos', p_pontos, 'valor', v_amount)
  );

  RETURN v_result;
END;
$$;

CREATE OR REPLACE FUNCTION public.gsa_client_request_withdrawal(
  p_sessao_id uuid,
  p_session_token text,
  p_request_id uuid,
  p_tipo_chave_pix text,
  p_chave_pix text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_actor record;
  v_client public.clientes%rowtype;
  v_type text := lower(trim(coalesce(p_tipo_chave_pix, '')));
  v_key text := trim(coalesce(p_chave_pix, ''));
  v_digits text;
  v_min numeric;
  v_fee_percent numeric;
  v_amount numeric;
  v_net numeric;
  v_new_wallet numeric;
  v_withdrawal_id uuid;
  v_result jsonb;
  v_inserted uuid;
BEGIN
  IF p_request_id IS NULL THEN RAISE EXCEPTION 'Identificador da operação obrigatório.'; END IF;
  IF v_type NOT IN ('cpf', 'cnpj', 'email', 'telefone', 'aleatoria') THEN RAISE EXCEPTION 'Tipo de chave PIX inválido.'; END IF;
  IF length(v_key) > 180 THEN RAISE EXCEPTION 'Chave PIX inválida.'; END IF;
  v_digits := regexp_replace(v_key, '\D', '', 'g');
  IF (v_type = 'cpf' AND length(v_digits) <> 11)
     OR (v_type = 'cnpj' AND length(v_digits) <> 14)
     OR (v_type = 'telefone' AND length(v_digits) NOT BETWEEN 10 AND 11)
     OR (v_type = 'email' AND v_key !~* '^[^\s@]+@[^\s@]+\.[^\s@]+$')
     OR (v_type = 'aleatoria' AND length(v_key) < 32) THEN
    RAISE EXCEPTION 'Chave PIX inválida.';
  END IF;

  SELECT * INTO v_actor FROM public.gsa_client_session_actor(p_sessao_id, p_session_token) LIMIT 1;

  INSERT INTO public.gsa_client_operation_requests(request_id, cliente_id, operacao)
  VALUES (p_request_id, v_actor.cliente_id, 'solicitar_saque')
  ON CONFLICT (request_id) DO NOTHING RETURNING request_id INTO v_inserted;
  IF v_inserted IS NULL THEN
    SELECT resultado INTO v_result FROM public.gsa_client_operation_requests
    WHERE request_id = p_request_id AND cliente_id = v_actor.cliente_id AND operacao = 'solicitar_saque';
    IF NOT FOUND THEN RAISE EXCEPTION 'Identificador da operação já utilizado.'; END IF;
    IF v_result IS NULL THEN RAISE EXCEPTION 'Operação ainda em processamento.'; END IF;
    RETURN v_result || jsonb_build_object('already_exists', true);
  END IF;

  SELECT * INTO v_client FROM public.clientes WHERE id = v_actor.cliente_id FOR UPDATE;
  IF coalesce(v_client.carteira_bloqueada, false) THEN RAISE EXCEPTION 'A carteira está bloqueada para saque.'; END IF;
  IF coalesce(v_client.saque_liberado_manual, false) IS NOT TRUE
     AND NOT EXISTS (SELECT 1 FROM public.faturas WHERE cliente_id = v_actor.cliente_id AND status = 'pago') THEN
    RAISE EXCEPTION 'O saque é liberado após o pagamento da primeira fatura.';
  END IF;

  SELECT round(greatest(coalesce(value::numeric, 0), 0), 2) INTO v_min
  FROM public.system_settings WHERE key = 'valor_minimo_saque';
  v_min := coalesce(v_min, 0);
  v_amount := round(greatest(coalesce(v_client.saldo_carteira, 0), 0), 2);
  IF v_amount <= 0 OR v_amount < v_min THEN
    RAISE EXCEPTION 'Saldo abaixo do valor mínimo permitido para saque.';
  END IF;

  SELECT least(greatest(coalesce(taxa_saque_transferencia, 0), 0), 100)
  INTO v_fee_percent
  FROM public.client_levels
  WHERE id = coalesce(v_client.nivel_manual_id, v_client.nivel_id)
  LIMIT 1;
  v_fee_percent := coalesce(v_fee_percent, 0);
  v_net := round(v_amount * (1 - v_fee_percent / 100), 2);
  v_new_wallet := round(coalesce(v_client.saldo_carteira, 0) - v_amount, 2);

  INSERT INTO public.saques(
    cliente_id, request_id, valor, taxa_aplicada, valor_liquido,
    tipo_chave_pix, chave_pix, status, data_solicitacao
  ) VALUES (
    v_actor.cliente_id, p_request_id, v_amount, v_fee_percent, v_net,
    v_type, v_key, 'pendente', now()
  ) RETURNING id INTO v_withdrawal_id;

  UPDATE public.clientes SET saldo_carteira = v_new_wallet WHERE id = v_actor.cliente_id;
  INSERT INTO public.carteira_lancamentos(cliente_id, valor, tipo, descricao)
  VALUES (v_actor.cliente_id, v_amount, 'debito', 'Solicitação de saque');
  INSERT INTO public.extrato_financeiro(
    cliente_id, tipo, valor, descricao, referencia_id, modulo_referencia, saldo_resultante
  ) VALUES (
    v_actor.cliente_id, 'saida', v_amount, 'Solicitação de saque',
    v_withdrawal_id, 'saques', v_new_wallet
  );

  v_result := jsonb_build_object(
    'success', true, 'already_exists', false, 'saque_id', v_withdrawal_id,
    'valor', v_amount, 'taxa_percentual', v_fee_percent,
    'valor_liquido', v_net, 'saldo_carteira', v_new_wallet
  );
  UPDATE public.gsa_client_operation_requests SET resultado = v_result, completed_at = now()
  WHERE request_id = p_request_id;

  INSERT INTO public.notificacoes(
    titulo, mensagem, modulo, tab, item_id,
    destinatario_tipo, prioridade, acao_origem, contexto
  ) VALUES (
    'Nova solicitação de saque',
    format('%s solicitou saque de R$ %s.', v_actor.cliente_nome, to_char(v_amount, 'FM999G999G990D00')),
    'financeiro', 'saques', v_withdrawal_id::text,
    'admin', 'alta', 'solicitar_saque', jsonb_build_object('saque_id', v_withdrawal_id)
  );
  INSERT INTO public.notificacoes(
    cliente_id, titulo, mensagem, modulo, tab, item_id,
    destinatario_tipo, acao_origem, contexto
  ) VALUES (
    v_actor.cliente_id, 'Saque solicitado',
    'Sua solicitação de saque foi enviada para análise.',
    'financeiro', 'saques', v_withdrawal_id::text,
    'cliente', 'solicitar_saque', jsonb_build_object('saque_id', v_withdrawal_id)
  );

  RETURN v_result;
END;
$$;

CREATE OR REPLACE FUNCTION public.gsa_client_cancel_withdrawal(
  p_sessao_id uuid,
  p_session_token text,
  p_saque_id uuid,
  p_motivo text DEFAULT 'Cancelado pelo cliente'
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_actor record;
  v_withdrawal public.saques%rowtype;
  v_client public.clientes%rowtype;
  v_new_wallet numeric;
  v_reason text := left(trim(coalesce(p_motivo, 'Cancelado pelo cliente')), 500);
BEGIN
  SELECT * INTO v_actor FROM public.gsa_client_session_actor(p_sessao_id, p_session_token) LIMIT 1;
  SELECT * INTO v_withdrawal FROM public.saques
  WHERE id = p_saque_id AND cliente_id = v_actor.cliente_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Saque não encontrado.'; END IF;
  IF v_withdrawal.status = 'cancelado' THEN
    RETURN jsonb_build_object('success', true, 'already_cancelled', true, 'saque_id', p_saque_id);
  END IF;
  IF v_withdrawal.status <> 'pendente' THEN RAISE EXCEPTION 'Este saque já foi processado.'; END IF;

  SELECT * INTO v_client FROM public.clientes WHERE id = v_actor.cliente_id FOR UPDATE;
  v_new_wallet := round(coalesce(v_client.saldo_carteira, 0) + v_withdrawal.valor, 2);
  UPDATE public.saques SET status = 'cancelado', motivo_cancelamento = v_reason WHERE id = p_saque_id;
  UPDATE public.clientes SET saldo_carteira = v_new_wallet WHERE id = v_actor.cliente_id;
  INSERT INTO public.carteira_lancamentos(cliente_id, valor, tipo, descricao)
  VALUES (v_actor.cliente_id, v_withdrawal.valor, 'credito', 'Estorno de saque cancelado');
  INSERT INTO public.extrato_financeiro(
    cliente_id, tipo, valor, descricao, referencia_id, modulo_referencia, saldo_resultante
  ) VALUES (
    v_actor.cliente_id, 'entrada', v_withdrawal.valor, 'Estorno de saque cancelado',
    p_saque_id, 'saques', v_new_wallet
  );
  RETURN jsonb_build_object(
    'success', true, 'already_cancelled', false,
    'saque_id', p_saque_id, 'saldo_carteira', v_new_wallet
  );
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
      RAISE EXCEPTION 'O destinatário não possui saldo suficiente para o estorno.';
    END IF;
    v_origin_balance := round(coalesce(v_origin.saldo_carteira, 0) + v_transfer.valor, 2);
    v_destination_balance := round(coalesce(v_destination.saldo_carteira, 0) - v_transfer.valor_liquido, 2);
    UPDATE public.clientes SET saldo_carteira = v_origin_balance WHERE id = v_origin.id;
    UPDATE public.clientes SET saldo_carteira = v_destination_balance WHERE id = v_destination.id;
    INSERT INTO public.carteira_lancamentos(cliente_id, valor, tipo, descricao) VALUES
      (v_origin.id, v_transfer.valor, 'credito', 'Estorno de transferência'),
      (v_destination.id, v_transfer.valor_liquido, 'debito', 'Estorno de transferência recebida');
    INSERT INTO public.extrato_financeiro(
      cliente_id, tipo, valor, descricao, referencia_id, modulo_referencia, saldo_resultante
    ) VALUES
      (v_origin.id, 'entrada', v_transfer.valor, 'Estorno de transferência', p_transferencia_id, 'transferencia', v_origin_balance),
      (v_destination.id, 'saida', v_transfer.valor_liquido, 'Estorno de transferência recebida', p_transferencia_id, 'transferencia', v_destination_balance);
  ELSE
    IF coalesce(v_destination.saldo_pontos, 0) < v_transfer.valor_liquido THEN
      RAISE EXCEPTION 'O destinatário não possui pontos suficientes para o estorno.';
    END IF;
    v_origin_balance := coalesce(v_origin.saldo_pontos, 0) + v_transfer.valor;
    v_destination_balance := coalesce(v_destination.saldo_pontos, 0) - v_transfer.valor_liquido;
    UPDATE public.clientes SET saldo_pontos = v_origin_balance::integer WHERE id = v_origin.id;
    UPDATE public.clientes SET saldo_pontos = v_destination_balance::integer WHERE id = v_destination.id;
    INSERT INTO public.pontos_movimentacoes(cliente_id, tipo, pontos, saldo_apos, descricao) VALUES
      (v_origin.id, 'estorno', v_transfer.valor::integer, v_origin_balance::integer, 'Estorno de transferência'),
      (v_destination.id, 'estorno', -v_transfer.valor_liquido::integer, v_destination_balance::integer, 'Estorno de transferência recebida');
    INSERT INTO public.points_transactions(cliente_id, tipo, pontos, descricao) VALUES
      (v_origin.id, 'estorno', v_transfer.valor::integer, 'Estorno de transferência'),
      (v_destination.id, 'estorno', -v_transfer.valor_liquido::integer, 'Estorno de transferência recebida');
  END IF;

  UPDATE public.transferencias SET status = 'estornado' WHERE id = p_transferencia_id;
  INSERT INTO public.notificacoes(
    cliente_id, titulo, mensagem, modulo, tab, item_id,
    destinatario_tipo, acao_origem, contexto
  ) VALUES
    (v_origin.id, 'Transferência estornada', 'A transferência foi estornada.', 'financeiro', 'transferencias', p_transferencia_id::text, 'cliente', 'estornar_transferencia', jsonb_build_object('transferencia_id', p_transferencia_id)),
    (v_destination.id, 'Transferência estornada', 'Uma transferência recebida foi estornada.', 'financeiro', 'transferencias', p_transferencia_id::text, 'cliente', 'estornar_transferencia', jsonb_build_object('transferencia_id', p_transferencia_id));
  RETURN jsonb_build_object('success', true, 'already_reversed', false, 'transferencia_id', p_transferencia_id);
END;
$$;

REVOKE ALL ON FUNCTION public.gsa_client_lookup_transfer_recipient(uuid, text, text, text) FROM public, anon;
REVOKE ALL ON FUNCTION public.gsa_client_convert_points(uuid, text, uuid, integer) FROM public, anon;
REVOKE ALL ON FUNCTION public.gsa_client_request_withdrawal(uuid, text, uuid, text, text) FROM public, anon;
REVOKE ALL ON FUNCTION public.gsa_client_cancel_withdrawal(uuid, text, uuid, text) FROM public, anon;
REVOKE ALL ON FUNCTION public.gsa_client_request_transfer(uuid, text, uuid, uuid, text, numeric, text) FROM public, anon;
REVOKE ALL ON FUNCTION public.gsa_client_cancel_transfer(uuid, text, uuid) FROM public, anon;
REVOKE ALL ON FUNCTION public.gsa_client_reverse_transfer(uuid, text, uuid) FROM public, anon;

GRANT EXECUTE ON FUNCTION public.gsa_client_lookup_transfer_recipient(uuid, text, text, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.gsa_client_convert_points(uuid, text, uuid, integer) TO authenticated;
GRANT EXECUTE ON FUNCTION public.gsa_client_request_withdrawal(uuid, text, uuid, text, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.gsa_client_cancel_withdrawal(uuid, text, uuid, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.gsa_client_request_transfer(uuid, text, uuid, uuid, text, numeric, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.gsa_client_cancel_transfer(uuid, text, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.gsa_client_reverse_transfer(uuid, text, uuid) TO authenticated;

REVOKE ALL ON FUNCTION public.converter_pontos_cliente(jsonb) FROM public, anon, authenticated;
REVOKE ALL ON FUNCTION public.solicitar_saque_cliente(jsonb) FROM public, anon, authenticated;
REVOKE ALL ON FUNCTION public.cancelar_saque_cliente(uuid, uuid, text) FROM public, anon, authenticated;
REVOKE ALL ON FUNCTION public.solicitar_transferencia_cliente(jsonb) FROM public, anon, authenticated;
REVOKE ALL ON FUNCTION public.cancelar_transferencia_cliente(uuid, uuid) FROM public, anon, authenticated;
REVOKE ALL ON FUNCTION public.estornar_transferencia_cliente(uuid, uuid) FROM public, anon, authenticated;
