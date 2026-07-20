-- Correções críticas do painel do cliente.
-- 1. Revoga executores SQL genéricos de papéis públicos.
-- 2. Move a liberação agendada de crédito para uma transação segura no banco.

DO $$
DECLARE
  fn RECORD;
BEGIN
  FOR fn IN
    SELECT
      n.nspname AS schema_name,
      p.proname AS function_name,
      pg_get_function_identity_arguments(p.oid) AS identity_arguments
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public'
      AND p.proname = 'execute_sql'
  LOOP
    EXECUTE format(
      'REVOKE ALL ON FUNCTION %I.%I(%s) FROM PUBLIC, anon, authenticated',
      fn.schema_name,
      fn.function_name,
      fn.identity_arguments
    );
  END LOOP;
END;
$$;

DROP FUNCTION IF EXISTS public.gsa_client_process_scheduled_credit_release(UUID, TEXT);

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
  v_cliente public.clientes%ROWTYPE;
  v_solicitacao public.loja_credito_solicitacoes%ROWTYPE;
  v_limite_aprovado NUMERIC;
  v_limite_total_anterior NUMERIC;
  v_limite_disponivel_anterior NUMERIC;
  v_limite_total_novo NUMERIC;
  v_limite_disponivel_novo NUMERIC;
  v_variacao NUMERIC;
  v_tipo_mov TEXT;
  v_liberadas INTEGER := 0;
BEGIN
  SELECT actor.cliente_id
    INTO v_cliente_id
  FROM public.gsa_client_session_actor(p_sessao_id, p_session_token) actor
  LIMIT 1;

  IF v_cliente_id IS NULL THEN
    RAISE EXCEPTION 'Cliente autenticado não encontrado.';
  END IF;

  SELECT *
    INTO v_cliente
  FROM public.clientes
  WHERE id = v_cliente_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Cadastro do cliente não encontrado.';
  END IF;

  IF COALESCE(v_cliente.bloqueado, false)
     OR v_cliente.status IS DISTINCT FROM 'ativo'
     OR COALESCE(v_cliente.cadastro_aprovado, false) = false THEN
    RAISE EXCEPTION 'O cadastro não está autorizado para liberação de crédito.';
  END IF;

  FOR v_solicitacao IN
    SELECT *
    FROM public.loja_credito_solicitacoes
    WHERE cliente_id = v_cliente_id
      AND status = 'contrato_assinado'
      AND data_liberacao_credito IS NOT NULL
      AND data_liberacao_credito <= CURRENT_DATE
    ORDER BY data_liberacao_credito, created_at, id
    FOR UPDATE
  LOOP
    v_limite_aprovado := COALESCE(v_solicitacao.limite_aprovado, 0);

    IF v_limite_aprovado <= 0 THEN
      RAISE EXCEPTION 'Solicitação % possui limite aprovado inválido.', v_solicitacao.id;
    END IF;

    SELECT *
      INTO v_cliente
    FROM public.clientes
    WHERE id = v_cliente_id
    FOR UPDATE;

    v_limite_total_anterior := COALESCE(v_cliente.limite_credito_total, 0);
    v_limite_disponivel_anterior := COALESCE(v_cliente.limite_credito_disponivel, 0);

    IF v_solicitacao.tipo_solicitacao = 'adesao' THEN
      v_limite_total_novo := v_limite_aprovado;
      v_limite_disponivel_novo := v_limite_aprovado;
      v_variacao := v_limite_aprovado;
      v_tipo_mov := 'concessao_inicial';
    ELSE
      v_variacao := v_limite_aprovado - v_limite_total_anterior;
      v_limite_total_novo := v_limite_aprovado;
      v_limite_disponivel_novo := v_limite_disponivel_anterior + v_variacao;
      v_tipo_mov := 'solicitacao_aumento_aprovada';

      IF v_limite_disponivel_novo < 0 THEN
        RAISE EXCEPTION 'O novo limite é inferior ao crédito já utilizado.';
      END IF;
    END IF;

    UPDATE public.clientes
    SET limite_credito_total = v_limite_total_novo,
        limite_credito_disponivel = v_limite_disponivel_novo,
        opcao_pagamento_parcelado = v_solicitacao.opcao_pagamento_parcelado
    WHERE id = v_cliente_id;

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
    ) VALUES (
      v_cliente_id,
      v_solicitacao.id,
      v_tipo_mov,
      v_variacao,
      v_limite_total_anterior,
      v_limite_total_novo,
      v_limite_disponivel_anterior,
      v_limite_disponivel_novo,
      CASE
        WHEN v_solicitacao.tipo_solicitacao = 'adesao'
          THEN 'Ativação transacional de limite de crédito aprovado e contratado'
        ELSE format('Ajuste transacional de limite para %s', v_limite_aprovado)
      END
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
      v_cliente_id,
      'cliente',
      'Crédito ativo',
      format('Seu limite de crédito de R$ %s foi liberado e já está disponível para uso.', to_char(v_limite_aprovado, 'FM999G999G990D00')),
      'credito_loja',
      'sistema',
      false,
      NOW()
    );

    v_liberadas := v_liberadas + 1;
  END LOOP;

  RETURN jsonb_build_object(
    'success', true,
    'released', v_liberadas,
    'cliente_id', v_cliente_id
  );
END;
$$;

REVOKE ALL ON FUNCTION public.gsa_client_process_scheduled_credit_release(UUID, TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.gsa_client_process_scheduled_credit_release(UUID, TEXT) TO authenticated;
