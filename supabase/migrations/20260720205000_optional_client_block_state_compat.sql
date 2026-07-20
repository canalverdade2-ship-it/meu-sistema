-- Compatibilidade com esquemas em que `clientes.bloqueado` não existe fisicamente.
-- Todas as validações usam JSONB, mantendo suporte ao campo quando ele estiver presente.

CREATE OR REPLACE FUNCTION public.gsa_client_record_is_blocked(p_cliente JSONB)
RETURNS BOOLEAN
LANGUAGE sql
IMMUTABLE
SET search_path TO public, pg_temp
AS $$
  SELECT
    COALESCE((p_cliente ->> 'bloqueado')::BOOLEAN, false)
    OR COALESCE(p_cliente ->> 'status', '') <> 'ativo'
    OR COALESCE((p_cliente ->> 'cadastro_aprovado')::BOOLEAN, false) = false;
$$;

CREATE OR REPLACE FUNCTION public.gsa_release_due_store_credit_for_client(p_cliente_id UUID)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO public, pg_temp
AS $$
DECLARE
  v_solicitacao public.loja_credito_solicitacoes%ROWTYPE;
  v_cliente public.clientes%ROWTYPE;
  v_limite_aprovado NUMERIC;
  v_total_anterior NUMERIC;
  v_disponivel_anterior NUMERIC;
  v_total_novo NUMERIC;
  v_disponivel_novo NUMERIC;
  v_variacao NUMERIC;
  v_tipo_mov TEXT;
  v_processadas INTEGER := 0;
BEGIN
  PERFORM pg_advisory_xact_lock(hashtextextended('gsa-store-credit:' || p_cliente_id::TEXT, 0));
  PERFORM set_config('gsa.credit_release', 'on', true);

  SELECT *
    INTO v_cliente
  FROM public.clientes
  WHERE id = p_cliente_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Cliente % não encontrado.', p_cliente_id;
  END IF;

  IF public.gsa_client_record_is_blocked(to_jsonb(v_cliente)) THEN
    RAISE EXCEPTION 'Cliente % sem acesso ativo.', p_cliente_id;
  END IF;

  FOR v_solicitacao IN
    SELECT *
    FROM public.loja_credito_solicitacoes
    WHERE cliente_id = p_cliente_id
      AND status = 'contrato_assinado'
      AND data_liberacao_credito IS NOT NULL
      AND data_liberacao_credito <= CURRENT_DATE
    ORDER BY data_liberacao_credito, created_at, id
    FOR UPDATE SKIP LOCKED
  LOOP
    SELECT *
      INTO v_cliente
    FROM public.clientes
    WHERE id = p_cliente_id
    FOR UPDATE;

    v_limite_aprovado := COALESCE(v_solicitacao.limite_aprovado, 0);
    IF v_limite_aprovado <= 0 THEN
      RAISE EXCEPTION 'Solicitação % possui limite aprovado inválido.', v_solicitacao.id;
    END IF;

    v_total_anterior := COALESCE(v_cliente.limite_credito_total, 0);
    v_disponivel_anterior := COALESCE(v_cliente.limite_credito_disponivel, 0);

    IF v_solicitacao.tipo_solicitacao = 'adesao' THEN
      v_total_novo := v_limite_aprovado;
      v_disponivel_novo := v_limite_aprovado;
      v_variacao := v_limite_aprovado;
      v_tipo_mov := 'concessao_inicial';
    ELSE
      v_variacao := v_limite_aprovado - v_total_anterior;
      v_total_novo := v_limite_aprovado;
      v_disponivel_novo := v_disponivel_anterior + v_variacao;
      v_tipo_mov := 'solicitacao_aumento_aprovada';

      IF v_disponivel_novo < 0 THEN
        RAISE EXCEPTION 'Novo limite inferior ao crédito utilizado pelo cliente %.', p_cliente_id;
      END IF;
    END IF;

    UPDATE public.clientes
    SET limite_credito_total = v_total_novo,
        limite_credito_disponivel = v_disponivel_novo,
        opcao_pagamento_parcelado = v_solicitacao.opcao_pagamento_parcelado
    WHERE id = p_cliente_id;

    INSERT INTO public.loja_credito_movimentacoes (
      cliente_id,
      solicitacao_id,
      tipo,
      valor,
      limite_total_anterior,
      limite_total_novo,
      limite_disponivel_anterior,
      limite_disponivel_novo,
      descricao
    )
    SELECT
      p_cliente_id,
      v_solicitacao.id,
      v_tipo_mov,
      v_variacao,
      v_total_anterior,
      v_total_novo,
      v_disponivel_anterior,
      v_disponivel_novo,
      'Liberação automática e transacional de crédito'
    WHERE NOT EXISTS (
      SELECT 1
      FROM public.loja_credito_movimentacoes existente
      WHERE existente.solicitacao_id = v_solicitacao.id
        AND existente.tipo IN ('concessao_inicial', 'solicitacao_aumento_aprovada')
    );

    UPDATE public.loja_credito_solicitacoes
    SET status = 'liberado',
        updated_at = NOW()
    WHERE id = v_solicitacao.id
      AND status = 'contrato_assinado';

    IF FOUND THEN
      INSERT INTO public.notificacoes (
        cliente_id,
        destinatario_tipo,
        titulo,
        mensagem,
        modulo,
        tipo,
        lida,
        data_criacao
      ) VALUES (
        p_cliente_id,
        'cliente',
        'Crédito ativo',
        format(
          'Seu limite de crédito de R$ %s foi liberado e já está disponível.',
          to_char(v_limite_aprovado, 'FM999G999G990D00')
        ),
        'credito_loja',
        'sistema',
        false,
        NOW()
      );
      v_processadas := v_processadas + 1;
    END IF;
  END LOOP;

  RETURN v_processadas;
END;
$$;

CREATE OR REPLACE FUNCTION public.gsa_client_process_scheduled_credit_release(
  p_sessao_id UUID,
  p_session_token TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO public, pg_temp
AS $$
DECLARE
  v_cliente_id UUID;
  v_liberadas INTEGER;
BEGIN
  SELECT actor.cliente_id
    INTO v_cliente_id
  FROM public.gsa_client_session_actor(p_sessao_id, p_session_token) actor
  LIMIT 1;

  IF v_cliente_id IS NULL THEN
    RAISE EXCEPTION 'Cliente autenticado não encontrado.';
  END IF;

  v_liberadas := public.gsa_release_due_store_credit_for_client(v_cliente_id);

  RETURN jsonb_build_object(
    'success', true,
    'released', v_liberadas,
    'cliente_id', v_cliente_id
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.gsa_process_due_store_credit_releases()
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO public, pg_temp
AS $$
DECLARE
  v_cliente_id UUID;
  v_total INTEGER := 0;
BEGIN
  IF NOT pg_try_advisory_xact_lock(hashtext('gsa_process_due_store_credit_releases')) THEN
    RETURN 0;
  END IF;

  FOR v_cliente_id IN
    SELECT DISTINCT cliente_id
    FROM public.loja_credito_solicitacoes
    WHERE status = 'contrato_assinado'
      AND data_liberacao_credito IS NOT NULL
      AND data_liberacao_credito <= CURRENT_DATE
      AND cliente_id IS NOT NULL
  LOOP
    BEGIN
      v_total := v_total + public.gsa_release_due_store_credit_for_client(v_cliente_id);
    EXCEPTION
      WHEN OTHERS THEN
        RAISE WARNING 'Falha ao processar crédito do cliente %: %', v_cliente_id, SQLERRM;
    END;
  END LOOP;

  RETURN v_total;
END;
$$;

CREATE OR REPLACE FUNCTION public.gsa_guard_client_credit_limits()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO public, pg_temp
AS $$
DECLARE
  v_actor_id UUID;
  v_solicitacao public.loja_credito_solicitacoes%ROWTYPE;
  v_limite_aprovado NUMERIC;
  v_variacao NUMERIC;
  v_tipo_mov TEXT;
BEGIN
  IF public.gsa_jwt_actor_type() <> 'cliente'
     OR COALESCE(current_setting('gsa.credit_release', true), '') = 'on'
     OR NOT (
       NEW.limite_credito_total IS DISTINCT FROM OLD.limite_credito_total
       OR NEW.limite_credito_disponivel IS DISTINCT FROM OLD.limite_credito_disponivel
       OR NEW.opcao_pagamento_parcelado IS DISTINCT FROM OLD.opcao_pagamento_parcelado
     ) THEN
    RETURN NEW;
  END IF;

  v_actor_id := public.gsa_jwt_actor_id();
  IF v_actor_id IS NULL OR v_actor_id <> OLD.id THEN
    RAISE EXCEPTION 'Cliente não autorizado a alterar este limite.';
  END IF;

  IF public.gsa_client_record_is_blocked(to_jsonb(OLD)) THEN
    RAISE EXCEPTION 'Cadastro sem autorização para liberação de crédito.';
  END IF;

  SELECT *
    INTO v_solicitacao
  FROM public.loja_credito_solicitacoes
  WHERE cliente_id = OLD.id
    AND status = 'contrato_assinado'
    AND data_liberacao_credito IS NOT NULL
    AND data_liberacao_credito <= CURRENT_DATE
  ORDER BY data_liberacao_credito, created_at, id
  LIMIT 1
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Não existe crédito contratado e vencido para liberação.';
  END IF;

  v_limite_aprovado := COALESCE(v_solicitacao.limite_aprovado, 0);
  IF v_limite_aprovado <= 0 THEN
    RAISE EXCEPTION 'Limite aprovado inválido.';
  END IF;

  IF v_solicitacao.tipo_solicitacao = 'adesao' THEN
    NEW.limite_credito_total := v_limite_aprovado;
    NEW.limite_credito_disponivel := v_limite_aprovado;
    v_variacao := v_limite_aprovado;
    v_tipo_mov := 'concessao_inicial';
  ELSE
    v_variacao := v_limite_aprovado - COALESCE(OLD.limite_credito_total, 0);
    NEW.limite_credito_total := v_limite_aprovado;
    NEW.limite_credito_disponivel := COALESCE(OLD.limite_credito_disponivel, 0) + v_variacao;
    v_tipo_mov := 'solicitacao_aumento_aprovada';

    IF NEW.limite_credito_disponivel < 0 THEN
      RAISE EXCEPTION 'Novo limite inferior ao crédito já utilizado.';
    END IF;
  END IF;

  NEW.opcao_pagamento_parcelado := v_solicitacao.opcao_pagamento_parcelado;
  PERFORM set_config('gsa.credit_release', 'on', true);

  INSERT INTO public.loja_credito_movimentacoes (
    cliente_id,
    solicitacao_id,
    tipo,
    valor,
    limite_total_anterior,
    limite_total_novo,
    limite_disponivel_anterior,
    limite_disponivel_novo,
    descricao
  )
  SELECT
    OLD.id,
    v_solicitacao.id,
    v_tipo_mov,
    v_variacao,
    COALESCE(OLD.limite_credito_total, 0),
    NEW.limite_credito_total,
    COALESCE(OLD.limite_credito_disponivel, 0),
    NEW.limite_credito_disponivel,
    'Liberação validada pelo banco a partir do fluxo legado'
  WHERE NOT EXISTS (
    SELECT 1
    FROM public.loja_credito_movimentacoes existente
    WHERE existente.solicitacao_id = v_solicitacao.id
      AND existente.tipo IN ('concessao_inicial', 'solicitacao_aumento_aprovada')
  );

  UPDATE public.loja_credito_solicitacoes
  SET status = 'liberado',
      updated_at = NOW()
  WHERE id = v_solicitacao.id
    AND status = 'contrato_assinado';

  INSERT INTO public.notificacoes (
    cliente_id,
    destinatario_tipo,
    titulo,
    mensagem,
    modulo,
    tipo,
    lida,
    data_criacao
  ) VALUES (
    OLD.id,
    'cliente',
    'Crédito ativo',
    format(
      'Seu limite de crédito de R$ %s foi liberado e já está disponível.',
      to_char(v_limite_aprovado, 'FM999G999G990D00')
    ),
    'credito_loja',
    'sistema',
    false,
    NOW()
  );

  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.gsa_client_record_is_blocked(JSONB) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.gsa_release_due_store_credit_for_client(UUID) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.gsa_process_due_store_credit_releases() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.gsa_client_process_scheduled_credit_release(UUID, TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.gsa_client_process_scheduled_credit_release(UUID, TEXT) TO authenticated;
