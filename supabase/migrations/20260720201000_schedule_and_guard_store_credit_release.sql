-- Liberação de crédito executada pelo banco, sem depender do navegador do cliente.
-- Também bloqueia alterações diretas em campos financeiros por sessões de cliente.

CREATE OR REPLACE FUNCTION public.gsa_process_due_store_credit_releases()
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
  IF NOT pg_try_advisory_xact_lock(hashtext('gsa_process_due_store_credit_releases')) THEN
    RETURN 0;
  END IF;

  PERFORM set_config('gsa.credit_release', 'on', true);

  FOR v_solicitacao IN
    SELECT *
    FROM public.loja_credito_solicitacoes
    WHERE status = 'contrato_assinado'
      AND data_liberacao_credito IS NOT NULL
      AND data_liberacao_credito <= CURRENT_DATE
    ORDER BY data_liberacao_credito, created_at, id
    FOR UPDATE SKIP LOCKED
  LOOP
    BEGIN
      SELECT *
        INTO v_cliente
      FROM public.clientes
      WHERE id = v_solicitacao.cliente_id
      FOR UPDATE;

      IF NOT FOUND THEN
        RAISE EXCEPTION 'Cliente % não encontrado.', v_solicitacao.cliente_id;
      END IF;

      IF COALESCE(v_cliente.bloqueado, false)
         OR v_cliente.status IS DISTINCT FROM 'ativo'
         OR COALESCE(v_cliente.cadastro_aprovado, false) = false THEN
        RAISE EXCEPTION 'Cliente % sem acesso ativo.', v_cliente.id;
      END IF;

      v_limite_aprovado := COALESCE(v_solicitacao.limite_aprovado, 0);
      IF v_limite_aprovado <= 0 THEN
        RAISE EXCEPTION 'Solicitação % possui limite inválido.', v_solicitacao.id;
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
          RAISE EXCEPTION 'Novo limite inferior ao crédito utilizado pelo cliente %.', v_cliente.id;
        END IF;
      END IF;

      UPDATE public.clientes
      SET limite_credito_total = v_total_novo,
          limite_credito_disponivel = v_disponivel_novo,
          opcao_pagamento_parcelado = v_solicitacao.opcao_pagamento_parcelado
      WHERE id = v_cliente.id;

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
        v_cliente.id,
        v_solicitacao.id,
        v_tipo_mov,
        v_variacao,
        v_total_anterior,
        v_total_novo,
        v_disponivel_anterior,
        v_disponivel_novo,
        CASE
          WHEN v_solicitacao.tipo_solicitacao = 'adesao'
            THEN 'Ativação automática e transacional de limite aprovado'
          ELSE format('Ajuste automático e transacional do limite para %s', v_limite_aprovado)
        END
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
          v_cliente.id,
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
    EXCEPTION
      WHEN OTHERS THEN
        RAISE WARNING 'Falha ao liberar solicitação de crédito %: %', v_solicitacao.id, SQLERRM;
    END;
  END LOOP;

  RETURN v_processadas;
END;
$$;

REVOKE ALL ON FUNCTION public.gsa_process_due_store_credit_releases() FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.gsa_guard_client_credit_limits()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO public, pg_temp
AS $$
BEGIN
  IF public.gsa_jwt_actor_type() = 'cliente'
     AND COALESCE(current_setting('gsa.credit_release', true), '') <> 'on'
     AND (
       NEW.limite_credito_total IS DISTINCT FROM OLD.limite_credito_total
       OR NEW.limite_credito_disponivel IS DISTINCT FROM OLD.limite_credito_disponivel
       OR NEW.opcao_pagamento_parcelado IS DISTINCT FROM OLD.opcao_pagamento_parcelado
     ) THEN
    RAISE EXCEPTION 'Alterações de limite de crédito só podem ser processadas pelo backend.';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_gsa_guard_client_credit_limits ON public.clientes;
CREATE TRIGGER trg_gsa_guard_client_credit_limits
BEFORE UPDATE OF limite_credito_total, limite_credito_disponivel, opcao_pagamento_parcelado
ON public.clientes
FOR EACH ROW
EXECUTE FUNCTION public.gsa_guard_client_credit_limits();

CREATE OR REPLACE FUNCTION public.gsa_guard_client_credit_release_status()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO public, pg_temp
AS $$
BEGIN
  IF public.gsa_jwt_actor_type() = 'cliente'
     AND COALESCE(current_setting('gsa.credit_release', true), '') <> 'on'
     AND NEW.status = 'liberado'
     AND NEW.status IS DISTINCT FROM OLD.status THEN
    RAISE EXCEPTION 'A liberação de crédito só pode ser concluída pelo backend.';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_gsa_guard_client_credit_release_status ON public.loja_credito_solicitacoes;
CREATE TRIGGER trg_gsa_guard_client_credit_release_status
BEFORE UPDATE OF status
ON public.loja_credito_solicitacoes
FOR EACH ROW
EXECUTE FUNCTION public.gsa_guard_client_credit_release_status();

-- Agenda a rotina somente quando pg_cron já estiver habilitado no projeto.
-- A ausência da extensão não bloqueia esta migração; nesse caso, uma Edge Function
-- ou agendador externo deve chamar gsa_process_due_store_credit_releases().
DO $$
DECLARE
  v_job_id BIGINT;
BEGIN
  IF EXISTS (SELECT 1 FROM pg_namespace WHERE nspname = 'cron') THEN
    SELECT jobid
      INTO v_job_id
    FROM cron.job
    WHERE jobname = 'gsa-process-due-store-credit-releases'
    LIMIT 1;

    IF v_job_id IS NOT NULL THEN
      PERFORM cron.unschedule(v_job_id);
    END IF;

    PERFORM cron.schedule(
      'gsa-process-due-store-credit-releases',
      '* * * * *',
      'SELECT public.gsa_process_due_store_credit_releases();'
    );
  ELSE
    RAISE NOTICE 'pg_cron não está habilitado; configure um agendamento externo para gsa_process_due_store_credit_releases().';
  END IF;
END;
$$;
