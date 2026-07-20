-- Compatibilidade segura com o fluxo legado do painel.
-- Quando o navegador tenta alterar limites, o trigger ignora os valores recebidos
-- e calcula a liberação exclusivamente a partir da solicitação aprovada no banco.

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

  IF COALESCE(OLD.bloqueado, false)
     OR OLD.status IS DISTINCT FROM 'ativo'
     OR COALESCE(OLD.cadastro_aprovado, false) = false THEN
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

-- A inserção duplicada feita pelo código legado após a liberação é descartada.
CREATE OR REPLACE FUNCTION public.gsa_guard_duplicate_client_credit_movement()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO public, pg_temp
AS $$
BEGIN
  IF public.gsa_jwt_actor_type() = 'cliente'
     AND NEW.tipo IN ('concessao_inicial', 'solicitacao_aumento_aprovada')
     AND EXISTS (
       SELECT 1
       FROM public.loja_credito_movimentacoes existente
       WHERE existente.solicitacao_id = NEW.solicitacao_id
         AND existente.tipo IN ('concessao_inicial', 'solicitacao_aumento_aprovada')
     ) THEN
    RETURN NULL;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_gsa_guard_duplicate_client_credit_movement ON public.loja_credito_movimentacoes;
CREATE TRIGGER trg_gsa_guard_duplicate_client_credit_movement
BEFORE INSERT
ON public.loja_credito_movimentacoes
FOR EACH ROW
EXECUTE FUNCTION public.gsa_guard_duplicate_client_credit_movement();

-- Evita a notificação duplicada emitida pelo código legado após o trigger seguro.
CREATE OR REPLACE FUNCTION public.gsa_guard_duplicate_client_credit_notification()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO public, pg_temp
AS $$
BEGIN
  IF public.gsa_jwt_actor_type() = 'cliente'
     AND NEW.cliente_id = public.gsa_jwt_actor_id()
     AND NEW.modulo = 'credito_loja'
     AND NEW.titulo ILIKE 'Crédito Ativo%'
     AND EXISTS (
       SELECT 1
       FROM public.notificacoes existente
       WHERE existente.cliente_id = NEW.cliente_id
         AND existente.modulo = 'credito_loja'
         AND existente.titulo ILIKE 'Crédito ativo%'
         AND existente.data_criacao >= NOW() - INTERVAL '5 minutes'
     ) THEN
    RETURN NULL;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_gsa_guard_duplicate_client_credit_notification ON public.notificacoes;
CREATE TRIGGER trg_gsa_guard_duplicate_client_credit_notification
BEFORE INSERT
ON public.notificacoes
FOR EACH ROW
EXECUTE FUNCTION public.gsa_guard_duplicate_client_credit_notification();

REVOKE ALL ON FUNCTION public.gsa_guard_duplicate_client_credit_movement() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.gsa_guard_duplicate_client_credit_notification() FROM PUBLIC, anon, authenticated;
