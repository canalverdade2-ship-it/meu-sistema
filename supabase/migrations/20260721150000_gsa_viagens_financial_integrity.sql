BEGIN;

-- Separa valor contratado, faturado, pago e elegível para reembolso.
ALTER TABLE public.viagens_transacoes
  ADD COLUMN IF NOT EXISTS valor_total_contrato numeric(10, 2),
  ADD COLUMN IF NOT EXISTS valor_faturado numeric(10, 2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS valor_efetivamente_pago numeric(10, 2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS valor_em_aberto numeric(10, 2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS valor_elegivel_reembolso numeric(10, 2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS pagamento_status text NOT NULL DEFAULT 'nao_faturado',
  ADD COLUMN IF NOT EXISTS financeiro_atualizado_em timestamptz;

COMMENT ON COLUMN public.viagens_transacoes.valor_pago IS
  'Campo legado: historicamente armazena o valor total do contrato. Nao usar como comprovacao de pagamento.';
COMMENT ON COLUMN public.viagens_transacoes.valor_total_contrato IS
  'Valor total contratado na proposta aceita.';
COMMENT ON COLUMN public.viagens_transacoes.valor_efetivamente_pago IS
  'Soma conciliada das faturas de viagem efetivamente pagas.';
COMMENT ON COLUMN public.viagens_transacoes.valor_elegivel_reembolso IS
  'Valor efetivamente pago ainda nao reembolsado, limitado ao total do contrato.';

UPDATE public.viagens_transacoes transacao
SET valor_total_contrato = GREATEST(
      COALESCE(
        transacao.valor_total_contrato,
        proposta.valor_total,
        transacao.valor_pago,
        0
      ),
      0
    ),
    valor_faturado = GREATEST(COALESCE(transacao.valor_faturado, 0), 0),
    valor_efetivamente_pago = GREATEST(COALESCE(transacao.valor_efetivamente_pago, 0), 0),
    valor_em_aberto = GREATEST(
      COALESCE(transacao.valor_total_contrato, proposta.valor_total, transacao.valor_pago, 0)
      - COALESCE(transacao.valor_efetivamente_pago, 0),
      0
    ),
    valor_elegivel_reembolso = GREATEST(COALESCE(transacao.valor_elegivel_reembolso, 0), 0),
    pagamento_status = COALESCE(NULLIF(transacao.pagamento_status, ''), 'nao_faturado')
FROM public.viagens_propostas proposta
WHERE proposta.id = transacao.proposta_id;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'viagens_transacoes_financial_values_check'
      AND conrelid = 'public.viagens_transacoes'::regclass
  ) THEN
    ALTER TABLE public.viagens_transacoes
      ADD CONSTRAINT viagens_transacoes_financial_values_check CHECK (
        COALESCE(valor_total_contrato, 0) >= 0
        AND valor_faturado >= 0
        AND valor_efetivamente_pago >= 0
        AND valor_em_aberto >= 0
        AND valor_elegivel_reembolso >= 0
      );
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'viagens_transacoes_pagamento_status_check'
      AND conrelid = 'public.viagens_transacoes'::regclass
  ) THEN
    ALTER TABLE public.viagens_transacoes
      ADD CONSTRAINT viagens_transacoes_pagamento_status_check CHECK (
        pagamento_status IN (
          'nao_faturado',
          'aguardando_pagamento',
          'parcialmente_pago',
          'pago'
        )
      );
  END IF;
END;
$$;

-- As parcelas passam a ter relacionamento relacional com a transacao e a fatura.
CREATE TABLE IF NOT EXISTS public.viagens_transacao_parcelas (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  transacao_id uuid NOT NULL REFERENCES public.viagens_transacoes(id) ON DELETE CASCADE,
  fatura_id uuid NOT NULL REFERENCES public.faturas(id) ON DELETE RESTRICT,
  numero integer NOT NULL DEFAULT 1 CHECK (numero BETWEEN 1 AND 24),
  total_parcelas integer NOT NULL DEFAULT 1 CHECK (total_parcelas BETWEEN 1 AND 24),
  valor numeric(10, 2) NOT NULL CHECK (valor >= 0),
  data_vencimento date,
  status text NOT NULL DEFAULT 'pendente',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (fatura_id)
);

CREATE INDEX IF NOT EXISTS idx_viagens_transacao_parcelas_transacao
  ON public.viagens_transacao_parcelas(transacao_id, numero);

ALTER TABLE public.viagens_transacao_parcelas ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.viagens_transacao_parcelas FROM public, anon, authenticated;
GRANT SELECT ON public.viagens_transacao_parcelas TO authenticated;

DROP POLICY IF EXISTS "Cliente ve parcelas de suas viagens" ON public.viagens_transacao_parcelas;
CREATE POLICY "Cliente ve parcelas de suas viagens"
  ON public.viagens_transacao_parcelas
  FOR SELECT
  TO authenticated
  USING (
    public.gsa_jwt_session_is_valid()
    AND public.gsa_jwt_actor_type() = 'cliente'
    AND EXISTS (
      SELECT 1
      FROM public.viagens_transacoes transacao
      WHERE transacao.id = transacao_id
        AND transacao.cliente_id = public.gsa_jwt_actor_id()
    )
  );

-- Suspensao/cancelamento de cobrancas durante a analise do cancelamento.
ALTER TABLE public.faturas
  ADD COLUMN IF NOT EXISTS cobranca_suspensa boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS suspensa_em timestamptz,
  ADD COLUMN IF NOT EXISTS motivo_suspensao text;

ALTER TABLE public.viagens_cancelamentos
  ADD COLUMN IF NOT EXISTS request_id uuid,
  ADD COLUMN IF NOT EXISTS status_transacao_anterior text,
  ADD COLUMN IF NOT EXISTS valor_pago_no_pedido numeric(10, 2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS faturas_suspensas integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS decidido_em timestamptz,
  ADD COLUMN IF NOT EXISTS decidido_por uuid,
  ADD COLUMN IF NOT EXISTS concluido_em timestamptz,
  ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now();

CREATE UNIQUE INDEX IF NOT EXISTS idx_viagens_cancelamentos_request_id
  ON public.viagens_cancelamentos(request_id)
  WHERE request_id IS NOT NULL;

CREATE TABLE IF NOT EXISTS public.gsa_travel_operation_requests (
  request_id uuid PRIMARY KEY,
  actor_type text NOT NULL CHECK (actor_type IN ('cliente', 'admin', 'colaborador')),
  actor_id uuid NOT NULL,
  operation text NOT NULL CHECK (operation IN (
    'solicitar_cancelamento_viagem',
    'resolver_cancelamento_viagem'
  )),
  target_id uuid,
  result jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  completed_at timestamptz
);

ALTER TABLE public.gsa_travel_operation_requests ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.gsa_travel_operation_requests FROM public, anon, authenticated;

CREATE OR REPLACE FUNCTION public.gsa_travel_safe_uuid(p_value text)
RETURNS uuid
LANGUAGE plpgsql
IMMUTABLE
SET search_path = public, pg_temp
AS $$
BEGIN
  IF p_value IS NULL OR trim(p_value) = '' THEN
    RETURN NULL;
  END IF;
  RETURN p_value::uuid;
EXCEPTION WHEN invalid_text_representation THEN
  RETURN NULL;
END;
$$;

CREATE OR REPLACE FUNCTION public.gsa_travel_invoice_is_paid(p_status text)
RETURNS boolean
LANGUAGE sql
IMMUTABLE
SET search_path = public, pg_temp
AS $$
  SELECT lower(COALESCE(p_status, '')) IN (
    'pago', 'paga', 'quitado', 'quitada', 'recebido', 'recebida',
    'confirmado', 'confirmada', 'pagamento_confirmado'
  );
$$;

CREATE OR REPLACE FUNCTION public.gsa_travel_invoice_is_open(p_status text)
RETURNS boolean
LANGUAGE sql
IMMUTABLE
SET search_path = public, pg_temp
AS $$
  SELECT lower(COALESCE(p_status, '')) IN (
    'pendente', 'vencida', 'revisada', 'aguardando_link', 'pendente_pagamento'
  );
$$;

REVOKE ALL ON FUNCTION public.gsa_travel_safe_uuid(text) FROM public, anon, authenticated;
REVOKE ALL ON FUNCTION public.gsa_travel_invoice_is_paid(text) FROM public, anon, authenticated;
REVOKE ALL ON FUNCTION public.gsa_travel_invoice_is_open(text) FROM public, anon, authenticated;

CREATE OR REPLACE FUNCTION public.gsa_refresh_travel_financial_summary(p_transacao_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_transacao public.viagens_transacoes%ROWTYPE;
  v_total numeric(10, 2);
  v_faturado numeric(10, 2) := 0;
  v_pago numeric(10, 2) := 0;
  v_reembolsado numeric(10, 2) := 0;
  v_aberto numeric(10, 2) := 0;
  v_elegivel numeric(10, 2) := 0;
  v_pagamento_status text;
BEGIN
  IF p_transacao_id IS NULL THEN
    RETURN '{}'::jsonb;
  END IF;

  SELECT * INTO v_transacao
  FROM public.viagens_transacoes
  WHERE id = p_transacao_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN '{}'::jsonb;
  END IF;

  v_total := GREATEST(
    COALESCE(v_transacao.valor_total_contrato, v_transacao.valor_pago, 0),
    0
  );

  SELECT
    COALESCE(SUM(
      CASE
        WHEN lower(COALESCE(fatura.status, '')) NOT IN ('cancelado', 'cancelada')
          THEN GREATEST(COALESCE(fatura.valor_total, 0), 0)
        ELSE 0
      END
    ), 0),
    COALESCE(SUM(
      CASE
        WHEN public.gsa_travel_invoice_is_paid(fatura.status)
          THEN GREATEST(COALESCE(fatura.valor_total, 0), 0)
        WHEN lower(COALESCE(fatura.status, '')) NOT IN ('cancelado', 'cancelada')
          AND fatura.valor_final_pendente IS NOT NULL
          AND fatura.valor_final_pendente < COALESCE(fatura.valor_total, 0)
          THEN GREATEST(
            COALESCE(fatura.valor_total, 0) - GREATEST(fatura.valor_final_pendente, 0),
            0
          )
        ELSE 0
      END
    ), 0)
  INTO v_faturado, v_pago
  FROM public.faturas fatura
  WHERE fatura.tipo = 'compra_viagem'
    AND public.gsa_travel_safe_uuid(fatura.metadata ->> 'transacao_id') = p_transacao_id;

  SELECT COALESCE(SUM(GREATEST(COALESCE(cancelamento.valor_reembolsado, 0), 0)), 0)
  INTO v_reembolsado
  FROM public.viagens_cancelamentos cancelamento
  WHERE cancelamento.transacao_id = p_transacao_id
    AND cancelamento.status = 'concluido';

  v_pago := GREATEST(v_pago, 0);
  v_aberto := GREATEST(v_total - v_pago, 0);
  v_elegivel := GREATEST(LEAST(v_pago, v_total) - v_reembolsado, 0);

  v_pagamento_status := CASE
    WHEN v_faturado <= 0 THEN 'nao_faturado'
    WHEN v_pago <= 0 THEN 'aguardando_pagamento'
    WHEN v_pago + 0.009 < v_total THEN 'parcialmente_pago'
    ELSE 'pago'
  END;

  UPDATE public.viagens_transacoes
  SET valor_total_contrato = v_total,
      valor_faturado = v_faturado,
      valor_efetivamente_pago = v_pago,
      valor_em_aberto = v_aberto,
      valor_elegivel_reembolso = v_elegivel,
      pagamento_status = v_pagamento_status,
      status = CASE
        WHEN status = 'pendente' AND v_pagamento_status = 'pago'
          THEN 'pagamento_confirmado'
        ELSE status
      END,
      financeiro_atualizado_em = now(),
      updated_at = now()
  WHERE id = p_transacao_id;

  RETURN jsonb_build_object(
    'transacao_id', p_transacao_id,
    'valor_total_contrato', v_total,
    'valor_faturado', v_faturado,
    'valor_efetivamente_pago', v_pago,
    'valor_em_aberto', v_aberto,
    'valor_elegivel_reembolso', v_elegivel,
    'pagamento_status', v_pagamento_status
  );
END;
$$;

REVOKE ALL ON FUNCTION public.gsa_refresh_travel_financial_summary(uuid)
  FROM public, anon, authenticated;

CREATE OR REPLACE FUNCTION public.gsa_sync_travel_invoice_financials()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_old_transacao_id uuid;
  v_new_transacao_id uuid;
  v_numero integer;
  v_total_parcelas integer;
BEGIN
  IF TG_OP <> 'INSERT' THEN
    v_old_transacao_id := public.gsa_travel_safe_uuid(OLD.metadata ->> 'transacao_id');
  END IF;

  IF TG_OP <> 'DELETE' THEN
    v_new_transacao_id := public.gsa_travel_safe_uuid(NEW.metadata ->> 'transacao_id');
  END IF;

  IF TG_OP = 'DELETE' THEN
    DELETE FROM public.viagens_transacao_parcelas WHERE fatura_id = OLD.id;
  ELSIF NEW.tipo = 'compra_viagem' AND v_new_transacao_id IS NOT NULL THEN
    v_numero := CASE
      WHEN COALESCE(NEW.metadata ->> 'parcela_numero', '') ~ '^\d+$'
        THEN LEAST(GREATEST((NEW.metadata ->> 'parcela_numero')::integer, 1), 24)
      ELSE 1
    END;
    v_total_parcelas := CASE
      WHEN COALESCE(NEW.metadata ->> 'parcelas_total', '') ~ '^\d+$'
        THEN LEAST(GREATEST((NEW.metadata ->> 'parcelas_total')::integer, 1), 24)
      ELSE 1
    END;

    INSERT INTO public.viagens_transacao_parcelas (
      transacao_id,
      fatura_id,
      numero,
      total_parcelas,
      valor,
      data_vencimento,
      status,
      updated_at
    ) VALUES (
      v_new_transacao_id,
      NEW.id,
      v_numero,
      v_total_parcelas,
      GREATEST(COALESCE(NEW.valor_total, 0), 0),
      NEW.data_vencimento::date,
      COALESCE(NEW.status, 'pendente'),
      now()
    )
    ON CONFLICT (fatura_id) DO UPDATE
      SET transacao_id = EXCLUDED.transacao_id,
          numero = EXCLUDED.numero,
          total_parcelas = EXCLUDED.total_parcelas,
          valor = EXCLUDED.valor,
          data_vencimento = EXCLUDED.data_vencimento,
          status = EXCLUDED.status,
          updated_at = now();
  END IF;

  IF v_old_transacao_id IS NOT NULL THEN
    PERFORM public.gsa_refresh_travel_financial_summary(v_old_transacao_id);
  END IF;
  IF v_new_transacao_id IS NOT NULL AND v_new_transacao_id IS DISTINCT FROM v_old_transacao_id THEN
    PERFORM public.gsa_refresh_travel_financial_summary(v_new_transacao_id);
  ELSIF v_new_transacao_id IS NOT NULL AND TG_OP = 'INSERT' THEN
    PERFORM public.gsa_refresh_travel_financial_summary(v_new_transacao_id);
  END IF;

  RETURN COALESCE(NEW, OLD);
END;
$$;

DROP TRIGGER IF EXISTS trg_gsa_sync_travel_invoice_financials ON public.faturas;
CREATE TRIGGER trg_gsa_sync_travel_invoice_financials
AFTER INSERT OR DELETE OR UPDATE OF
  status,
  valor_total,
  valor_final_pendente,
  data_vencimento,
  metadata
ON public.faturas
FOR EACH ROW
EXECUTE FUNCTION public.gsa_sync_travel_invoice_financials();

REVOKE ALL ON FUNCTION public.gsa_sync_travel_invoice_financials()
  FROM public, anon, authenticated;

-- Converte as faturas existentes em parcelas relacionais.
INSERT INTO public.viagens_transacao_parcelas (
  transacao_id,
  fatura_id,
  numero,
  total_parcelas,
  valor,
  data_vencimento,
  status
)
SELECT
  public.gsa_travel_safe_uuid(fatura.metadata ->> 'transacao_id'),
  fatura.id,
  CASE
    WHEN COALESCE(fatura.metadata ->> 'parcela_numero', '') ~ '^\d+$'
      THEN LEAST(GREATEST((fatura.metadata ->> 'parcela_numero')::integer, 1), 24)
    ELSE 1
  END,
  CASE
    WHEN COALESCE(fatura.metadata ->> 'parcelas_total', '') ~ '^\d+$'
      THEN LEAST(GREATEST((fatura.metadata ->> 'parcelas_total')::integer, 1), 24)
    ELSE 1
  END,
  GREATEST(COALESCE(fatura.valor_total, 0), 0),
  fatura.data_vencimento::date,
  COALESCE(fatura.status, 'pendente')
FROM public.faturas fatura
WHERE fatura.tipo = 'compra_viagem'
  AND public.gsa_travel_safe_uuid(fatura.metadata ->> 'transacao_id') IS NOT NULL
ON CONFLICT (fatura_id) DO UPDATE
  SET transacao_id = EXCLUDED.transacao_id,
      numero = EXCLUDED.numero,
      total_parcelas = EXCLUDED.total_parcelas,
      valor = EXCLUDED.valor,
      data_vencimento = EXCLUDED.data_vencimento,
      status = EXCLUDED.status,
      updated_at = now();

DO $$
DECLARE
  v_transacao_id uuid;
BEGIN
  FOR v_transacao_id IN SELECT id FROM public.viagens_transacoes LOOP
    PERFORM public.gsa_refresh_travel_financial_summary(v_transacao_id);
  END LOOP;
END;
$$;

CREATE OR REPLACE FUNCTION public.gsa_request_travel_cancellation_core(
  p_sessao_id uuid,
  p_session_token text,
  p_request_id uuid,
  p_transacao_id uuid,
  p_motivo text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_actor record;
  v_transacao public.viagens_transacoes%ROWTYPE;
  v_cancelamento_id uuid;
  v_active_cancelamento public.viagens_cancelamentos%ROWTYPE;
  v_inserted uuid;
  v_result jsonb;
  v_suspended_count integer := 0;
  v_status_cancelamento text;
BEGIN
  IF p_request_id IS NULL THEN
    RAISE EXCEPTION 'Identificador da operacao obrigatorio.' USING ERRCODE = '22023';
  END IF;
  IF p_transacao_id IS NULL THEN
    RAISE EXCEPTION 'Viagem nao informada.' USING ERRCODE = '22023';
  END IF;
  IF p_motivo IS NULL OR char_length(trim(p_motivo)) < 10 THEN
    RAISE EXCEPTION 'Informe um motivo com pelo menos 10 caracteres.' USING ERRCODE = '22023';
  END IF;

  SELECT * INTO v_actor
  FROM public.gsa_client_session_actor(p_sessao_id, p_session_token)
  LIMIT 1;

  INSERT INTO public.gsa_travel_operation_requests (
    request_id, actor_type, actor_id, operation, target_id
  ) VALUES (
    p_request_id, 'cliente', v_actor.cliente_id,
    'solicitar_cancelamento_viagem', p_transacao_id
  )
  ON CONFLICT (request_id) DO NOTHING
  RETURNING request_id INTO v_inserted;

  IF v_inserted IS NULL THEN
    SELECT request.result INTO v_result
    FROM public.gsa_travel_operation_requests request
    WHERE request.request_id = p_request_id
      AND request.actor_type = 'cliente'
      AND request.actor_id = v_actor.cliente_id
      AND request.operation = 'solicitar_cancelamento_viagem';

    IF NOT FOUND THEN
      RAISE EXCEPTION 'Identificador da operacao ja utilizado.' USING ERRCODE = '23505';
    END IF;
    IF v_result IS NULL THEN
      RAISE EXCEPTION 'Operacao ainda em processamento.' USING ERRCODE = '55000';
    END IF;
    RETURN v_result || jsonb_build_object('already_exists', true);
  END IF;

  PERFORM public.gsa_refresh_travel_financial_summary(p_transacao_id);

  SELECT * INTO v_transacao
  FROM public.viagens_transacoes
  WHERE id = p_transacao_id
    AND cliente_id = v_actor.cliente_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Viagem nao encontrada ou nao pertence a este cliente.' USING ERRCODE = 'P0002';
  END IF;

  IF v_transacao.status IN ('cancelada', 'reembolsada', 'concluida') THEN
    RAISE EXCEPTION 'Esta viagem nao aceita uma nova solicitacao de cancelamento.' USING ERRCODE = '22023';
  END IF;

  SELECT * INTO v_active_cancelamento
  FROM public.viagens_cancelamentos cancelamento
  WHERE cancelamento.transacao_id = p_transacao_id
    AND cancelamento.cliente_id = v_actor.cliente_id
    AND cancelamento.status IN ('solicitado', 'em_analise', 'reembolso_aprovado')
  ORDER BY cancelamento.created_at DESC
  LIMIT 1;

  IF FOUND THEN
    v_result := jsonb_build_object(
      'success', true,
      'already_exists', true,
      'cancelamento_id', v_active_cancelamento.id,
      'valor_elegivel_reembolso', v_active_cancelamento.valor_solicitado,
      'requires_refund', COALESCE(v_active_cancelamento.valor_solicitado, 0) > 0
    );

    UPDATE public.gsa_travel_operation_requests
    SET result = v_result, completed_at = now()
    WHERE request_id = p_request_id;

    RETURN v_result;
  END IF;

  v_status_cancelamento := CASE
    WHEN v_transacao.valor_elegivel_reembolso > 0 THEN 'solicitado'
    ELSE 'concluido'
  END;

  INSERT INTO public.viagens_cancelamentos (
    transacao_id,
    cliente_id,
    motivo,
    valor_solicitado,
    valor_reembolsado,
    status,
    resposta_gsa,
    request_id,
    status_transacao_anterior,
    valor_pago_no_pedido,
    concluido_em,
    updated_at
  ) VALUES (
    p_transacao_id,
    v_actor.cliente_id,
    trim(p_motivo),
    v_transacao.valor_elegivel_reembolso,
    CASE WHEN v_transacao.valor_elegivel_reembolso <= 0 THEN 0 ELSE NULL END,
    v_status_cancelamento,
    CASE
      WHEN v_transacao.valor_elegivel_reembolso <= 0
        THEN 'Cancelamento concluido sem reembolso, pois nao havia pagamento conciliado.'
      ELSE NULL
    END,
    p_request_id,
    v_transacao.status,
    v_transacao.valor_efetivamente_pago,
    CASE WHEN v_transacao.valor_elegivel_reembolso <= 0 THEN now() ELSE NULL END,
    now()
  )
  RETURNING id INTO v_cancelamento_id;

  UPDATE public.faturas fatura
  SET metadata = COALESCE(fatura.metadata, '{}'::jsonb) || jsonb_build_object(
        'gsa_travel_cancellation_id', v_cancelamento_id,
        'gsa_travel_previous_status', fatura.status,
        'gsa_travel_previous_pending', COALESCE(fatura.valor_final_pendente, fatura.valor_total)
      ),
      status = 'cancelado',
      data_cancelamento = now(),
      motivo_cancelamento = 'Cobranca suspensa por solicitacao de cancelamento da viagem.',
      valor_final_pendente = 0,
      cobranca_suspensa = true,
      suspensa_em = now(),
      motivo_suspensao = 'Cancelamento de viagem em analise'
  WHERE fatura.tipo = 'compra_viagem'
    AND public.gsa_travel_safe_uuid(fatura.metadata ->> 'transacao_id') = p_transacao_id
    AND public.gsa_travel_invoice_is_open(fatura.status);

  GET DIAGNOSTICS v_suspended_count = ROW_COUNT;

  UPDATE public.viagens_cancelamentos
  SET faturas_suspensas = v_suspended_count,
      updated_at = now()
  WHERE id = v_cancelamento_id;

  UPDATE public.viagens_transacoes
  SET status = CASE
        WHEN valor_elegivel_reembolso > 0 THEN 'reembolso_em_analise'
        ELSE 'cancelada'
      END,
      updated_at = now()
  WHERE id = p_transacao_id;

  PERFORM public.gsa_refresh_travel_financial_summary(p_transacao_id);

  v_result := jsonb_build_object(
    'success', true,
    'already_exists', false,
    'cancelamento_id', v_cancelamento_id,
    'requires_refund', v_transacao.valor_elegivel_reembolso > 0,
    'valor_total_contrato', v_transacao.valor_total_contrato,
    'valor_efetivamente_pago', v_transacao.valor_efetivamente_pago,
    'valor_elegivel_reembolso', v_transacao.valor_elegivel_reembolso,
    'faturas_suspensas', v_suspended_count
  );

  UPDATE public.gsa_travel_operation_requests
  SET result = v_result, completed_at = now()
  WHERE request_id = p_request_id;

  RETURN v_result;
END;
$$;

CREATE OR REPLACE FUNCTION public.gsa_request_travel_cancellation(
  p_sessao_id uuid,
  p_session_token text,
  p_request_id uuid,
  p_transacao_id uuid,
  p_motivo text
)
RETURNS jsonb
LANGUAGE sql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT public.gsa_request_travel_cancellation_core(
    p_sessao_id,
    p_session_token,
    p_request_id,
    p_transacao_id,
    p_motivo
  );
$$;

-- Compatibilidade segura para o frontend anterior durante a implantacao.
CREATE OR REPLACE FUNCTION public.gsa_request_travel_cancellation(
  p_sessao_id uuid,
  p_session_token text,
  p_transacao_id uuid,
  p_motivo text
)
RETURNS jsonb
LANGUAGE sql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT public.gsa_request_travel_cancellation_core(
    p_sessao_id,
    p_session_token,
    gen_random_uuid(),
    p_transacao_id,
    p_motivo
  );
$$;

REVOKE ALL ON FUNCTION public.gsa_request_travel_cancellation_core(uuid, text, uuid, uuid, text)
  FROM public, anon, authenticated;
REVOKE ALL ON FUNCTION public.gsa_request_travel_cancellation(uuid, text, uuid, uuid, text)
  FROM public, anon;
REVOKE ALL ON FUNCTION public.gsa_request_travel_cancellation(uuid, text, uuid, text)
  FROM public, anon;
GRANT EXECUTE ON FUNCTION public.gsa_request_travel_cancellation(uuid, text, uuid, uuid, text)
  TO authenticated;
GRANT EXECUTE ON FUNCTION public.gsa_request_travel_cancellation(uuid, text, uuid, text)
  TO authenticated;

-- Decisao financeira protegida. Exige acesso simultaneo aos modulos Viagens e Financeiro.
CREATE OR REPLACE FUNCTION public.gsa_admin_resolve_travel_cancellation(
  p_sessao_id uuid DEFAULT NULL,
  p_session_token text DEFAULT NULL,
  p_request_id uuid DEFAULT NULL,
  p_cancelamento_id uuid DEFAULT NULL,
  p_decision text DEFAULT NULL,
  p_taxas numeric DEFAULT 0,
  p_valor_reembolso numeric DEFAULT NULL,
  p_resposta text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_context jsonb;
  v_actor_id uuid;
  v_cancelamento public.viagens_cancelamentos%ROWTYPE;
  v_transacao public.viagens_transacoes%ROWTYPE;
  v_inserted uuid;
  v_result jsonb;
  v_taxas numeric(10, 2);
  v_refund numeric(10, 2);
  v_restored integer := 0;
BEGIN
  IF p_request_id IS NULL OR p_cancelamento_id IS NULL THEN
    RAISE EXCEPTION 'Identificadores da operacao e do cancelamento sao obrigatorios.' USING ERRCODE = '22023';
  END IF;

  PERFORM public.gsa_admin_assert_module('viagens');
  IF NOT public.gsa_admin_has_module('financeiro') THEN
    RAISE EXCEPTION 'A decisao de reembolso exige permissao do modulo Financeiro.' USING ERRCODE = '42501';
  END IF;

  v_context := public.gsa_admin_context();
  v_actor_id := (v_context ->> 'actor_id')::uuid;

  INSERT INTO public.gsa_travel_operation_requests (
    request_id, actor_type, actor_id, operation, target_id
  ) VALUES (
    p_request_id,
    v_context ->> 'actor_type',
    v_actor_id,
    'resolver_cancelamento_viagem',
    p_cancelamento_id
  )
  ON CONFLICT (request_id) DO NOTHING
  RETURNING request_id INTO v_inserted;

  IF v_inserted IS NULL THEN
    SELECT request.result INTO v_result
    FROM public.gsa_travel_operation_requests request
    WHERE request.request_id = p_request_id
      AND request.actor_type = v_context ->> 'actor_type'
      AND request.actor_id = v_actor_id
      AND request.operation = 'resolver_cancelamento_viagem';

    IF NOT FOUND THEN
      RAISE EXCEPTION 'Identificador da operacao ja utilizado.' USING ERRCODE = '23505';
    END IF;
    IF v_result IS NULL THEN
      RAISE EXCEPTION 'Operacao ainda em processamento.' USING ERRCODE = '55000';
    END IF;
    RETURN v_result || jsonb_build_object('already_exists', true);
  END IF;

  SELECT * INTO v_cancelamento
  FROM public.viagens_cancelamentos
  WHERE id = p_cancelamento_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Cancelamento nao encontrado.' USING ERRCODE = 'P0002';
  END IF;

  PERFORM public.gsa_refresh_travel_financial_summary(v_cancelamento.transacao_id);

  SELECT * INTO v_transacao
  FROM public.viagens_transacoes
  WHERE id = v_cancelamento.transacao_id
  FOR UPDATE;

  v_taxas := ROUND(GREATEST(COALESCE(p_taxas, 0), 0), 2);

  IF p_decision = 'em_analise' THEN
    IF v_cancelamento.status NOT IN ('solicitado', 'em_analise') THEN
      RAISE EXCEPTION 'Este cancelamento nao pode ser colocado em analise.' USING ERRCODE = '22023';
    END IF;

    UPDATE public.viagens_cancelamentos
    SET status = 'em_analise',
        resposta_gsa = COALESCE(NULLIF(trim(COALESCE(p_resposta, '')), ''), resposta_gsa),
        decidido_em = now(),
        decidido_por = v_actor_id,
        updated_at = now()
    WHERE id = p_cancelamento_id;

  ELSIF p_decision = 'aprovar' THEN
    IF v_cancelamento.status NOT IN ('solicitado', 'em_analise') THEN
      RAISE EXCEPTION 'Este cancelamento nao pode ser aprovado.' USING ERRCODE = '22023';
    END IF;

    IF v_taxas > v_transacao.valor_elegivel_reembolso THEN
      RAISE EXCEPTION 'As taxas nao podem superar o valor elegivel para reembolso.' USING ERRCODE = '22023';
    END IF;

    v_refund := ROUND(COALESCE(
      p_valor_reembolso,
      GREATEST(v_transacao.valor_elegivel_reembolso - v_taxas, 0)
    ), 2);

    IF v_refund < 0 OR v_refund + v_taxas > v_transacao.valor_elegivel_reembolso + 0.009 THEN
      RAISE EXCEPTION 'Valor de reembolso invalido para os pagamentos conciliados.' USING ERRCODE = '22023';
    END IF;

    UPDATE public.viagens_cancelamentos
    SET status = 'reembolso_aprovado',
        taxas_aplicaveis = v_taxas,
        valor_reembolsado = v_refund,
        resposta_gsa = COALESCE(NULLIF(trim(COALESCE(p_resposta, '')), ''), 'Reembolso aprovado.'),
        decidido_em = now(),
        decidido_por = v_actor_id,
        updated_at = now()
    WHERE id = p_cancelamento_id;

  ELSIF p_decision = 'negar' THEN
    IF v_cancelamento.status NOT IN ('solicitado', 'em_analise') THEN
      RAISE EXCEPTION 'Este cancelamento nao pode ser negado.' USING ERRCODE = '22023';
    END IF;

    UPDATE public.faturas fatura
    SET status = CASE
          WHEN COALESCE(fatura.metadata ->> 'gsa_travel_previous_status', '')
            IN ('pendente', 'vencida', 'revisada', 'aguardando_link', 'pendente_pagamento')
            THEN fatura.metadata ->> 'gsa_travel_previous_status'
          ELSE 'pendente'
        END,
        valor_final_pendente = CASE
          WHEN COALESCE(fatura.metadata ->> 'gsa_travel_previous_pending', '') ~ '^\d+(\.\d+)?$'
            THEN (fatura.metadata ->> 'gsa_travel_previous_pending')::numeric
          ELSE fatura.valor_total
        END,
        data_cancelamento = NULL,
        motivo_cancelamento = NULL,
        cobranca_suspensa = false,
        suspensa_em = NULL,
        motivo_suspensao = NULL,
        metadata = COALESCE(fatura.metadata, '{}'::jsonb)
          - 'gsa_travel_cancellation_id'
          - 'gsa_travel_previous_status'
          - 'gsa_travel_previous_pending'
    WHERE fatura.tipo = 'compra_viagem'
      AND fatura.metadata ->> 'gsa_travel_cancellation_id' = p_cancelamento_id::text;

    GET DIAGNOSTICS v_restored = ROW_COUNT;

    UPDATE public.viagens_cancelamentos
    SET status = 'reembolso_negado',
        taxas_aplicaveis = 0,
        valor_reembolsado = 0,
        resposta_gsa = COALESCE(NULLIF(trim(COALESCE(p_resposta, '')), ''), 'Solicitacao de reembolso negada.'),
        decidido_em = now(),
        decidido_por = v_actor_id,
        updated_at = now()
    WHERE id = p_cancelamento_id;

    UPDATE public.viagens_transacoes
    SET status = COALESCE(NULLIF(v_cancelamento.status_transacao_anterior, ''), 'pendente'),
        updated_at = now()
    WHERE id = v_cancelamento.transacao_id;

  ELSIF p_decision = 'concluir' THEN
    IF v_cancelamento.status <> 'reembolso_aprovado' THEN
      RAISE EXCEPTION 'Somente um reembolso aprovado pode ser concluido.' USING ERRCODE = '22023';
    END IF;

    v_refund := ROUND(GREATEST(COALESCE(v_cancelamento.valor_reembolsado, 0), 0), 2);
    IF v_refund > v_cancelamento.valor_pago_no_pedido + 0.009 THEN
      RAISE EXCEPTION 'O reembolso nao pode superar o valor pago registrado no pedido.' USING ERRCODE = '22023';
    END IF;

    UPDATE public.viagens_cancelamentos
    SET status = 'concluido',
        resposta_gsa = COALESCE(NULLIF(trim(COALESCE(p_resposta, '')), ''), resposta_gsa),
        concluido_em = now(),
        decidido_em = COALESCE(decidido_em, now()),
        decidido_por = COALESCE(decidido_por, v_actor_id),
        updated_at = now()
    WHERE id = p_cancelamento_id;

    UPDATE public.faturas fatura
    SET cobranca_suspensa = false,
        suspensa_em = NULL,
        motivo_suspensao = NULL
    WHERE fatura.tipo = 'compra_viagem'
      AND fatura.metadata ->> 'gsa_travel_cancellation_id' = p_cancelamento_id::text;

    UPDATE public.viagens_transacoes
    SET status = CASE
          WHEN v_refund + 0.009 >= v_cancelamento.valor_pago_no_pedido THEN 'reembolsada'
          ELSE 'cancelada'
        END,
        updated_at = now()
    WHERE id = v_cancelamento.transacao_id;

  ELSE
    RAISE EXCEPTION 'Decisao invalida.' USING ERRCODE = '22023';
  END IF;

  PERFORM public.gsa_refresh_travel_financial_summary(v_cancelamento.transacao_id);

  v_result := jsonb_build_object(
    'success', true,
    'already_exists', false,
    'cancelamento_id', p_cancelamento_id,
    'decision', p_decision,
    'faturas_restauradas', v_restored
  );

  UPDATE public.gsa_travel_operation_requests
  SET result = v_result, completed_at = now()
  WHERE request_id = p_request_id;

  PERFORM public.gsa_admin_write_audit(
    'viagens',
    'RESOLVER_CANCELAMENTO_VIAGEM',
    'viagens_cancelamentos',
    p_cancelamento_id,
    jsonb_build_object(
      'decision', p_decision,
      'taxas', v_taxas,
      'valor_reembolso', v_refund,
      'faturas_restauradas', v_restored,
      'request_id', p_request_id
    )
  );

  RETURN v_result;
END;
$$;

REVOKE ALL ON FUNCTION public.gsa_admin_resolve_travel_cancellation(
  uuid, text, uuid, uuid, text, numeric, numeric, text
) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.gsa_admin_resolve_travel_cancellation(
  uuid, text, uuid, uuid, text, numeric, numeric, text
) TO authenticated;

COMMIT;
