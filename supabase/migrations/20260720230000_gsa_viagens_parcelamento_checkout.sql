-- Corrige o checkout parcelado do GSA Viagens.
-- O valor total permanece na proposta/transação e as faturas são geradas por parcela.

ALTER TABLE public.viagens_transacoes
  ADD COLUMN IF NOT EXISTS parcelas INTEGER NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS valor_parcela NUMERIC(10, 2);

ALTER TABLE public.faturas
  ADD COLUMN IF NOT EXISTS metadata JSONB NOT NULL DEFAULT '{}'::JSONB;

ALTER TABLE public.faturas
  DROP CONSTRAINT IF EXISTS faturas_tipo_check;

ALTER TABLE public.faturas
  ADD CONSTRAINT faturas_tipo_check
  CHECK (
    tipo IS NULL
    OR tipo IN (
      'servico',
      'produto',
      'assinatura',
      'pacote_nivel',
      'emprestimo',
      'taxa_servico_emprestimo',
      'avulsa',
      'compra_viagem'
    )
  );

UPDATE public.viagens_transacoes
SET parcelas = GREATEST(COALESCE(parcelas, 1), 1),
    valor_parcela = COALESCE(valor_parcela, valor_pago)
WHERE valor_parcela IS NULL
   OR parcelas IS NULL
   OR parcelas < 1;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'viagens_transacoes_parcelas_check'
      AND conrelid = 'public.viagens_transacoes'::regclass
  ) THEN
    ALTER TABLE public.viagens_transacoes
      ADD CONSTRAINT viagens_transacoes_parcelas_check
      CHECK (parcelas BETWEEN 1 AND 24);
  END IF;
END;
$$;

CREATE INDEX IF NOT EXISTS idx_faturas_viagem_transacao_metadata
  ON public.faturas ((metadata ->> 'transacao_id'))
  WHERE tipo = 'compra_viagem';

CREATE OR REPLACE FUNCTION public.gsa_client_checkout_travel(
  p_sessao_id UUID,
  p_session_token TEXT,
  p_payload JSONB
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO public, pg_temp
AS $$
DECLARE
  v_cliente_id UUID;
  v_proposta_id UUID;
  v_forma_pagamento TEXT;
  v_parcelas INTEGER;
  v_max_parcelas INTEGER;
  v_proposta public.viagens_propostas%ROWTYPE;
  v_transacao public.viagens_transacoes%ROWTYPE;
  v_primeira_fatura_id UUID;
  v_fatura_id UUID;
  v_fatura_ids JSONB := '[]'::JSONB;
  v_passageiros_count INTEGER;
  v_expected_passageiros INTEGER;
  v_valor_base NUMERIC(10, 2);
  v_valor_parcela NUMERIC(10, 2);
  v_primeira_parcela NUMERIC(10, 2);
  v_parcela_numero INTEGER;
  v_existing_invoice_count INTEGER;
BEGIN
  SELECT actor.cliente_id
    INTO v_cliente_id
  FROM public.gsa_client_session_actor(p_sessao_id, p_session_token) actor
  LIMIT 1;

  IF v_cliente_id IS NULL THEN
    RAISE EXCEPTION 'Cliente autenticado não encontrado.';
  END IF;

  BEGIN
    v_proposta_id := NULLIF(p_payload ->> 'proposta_id', '')::UUID;
    v_parcelas := COALESCE(NULLIF(p_payload ->> 'parcelas', '')::INTEGER, 1);
  EXCEPTION WHEN invalid_text_representation THEN
    RAISE EXCEPTION 'Dados de parcelamento inválidos.' USING ERRCODE = '22023';
  END;

  v_forma_pagamento := COALESCE(NULLIF(p_payload ->> 'forma_pagamento', ''), 'outros');

  IF v_proposta_id IS NULL THEN
    RAISE EXCEPTION 'Proposta de viagem não informada.';
  END IF;

  SELECT *
    INTO v_proposta
  FROM public.viagens_propostas
  WHERE id = v_proposta_id
    AND cliente_id = v_cliente_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Proposta não encontrada ou não pertence a este cliente.';
  END IF;

  IF v_proposta.status <> 'aceita' THEN
    RAISE EXCEPTION 'A proposta precisa ser aceita antes do pagamento.';
  END IF;

  IF NOW() > v_proposta.prazo_pagamento THEN
    UPDATE public.viagens_propostas
    SET status = 'expirada', updated_at = NOW()
    WHERE id = v_proposta_id;
    RAISE EXCEPTION 'O prazo de pagamento desta proposta expirou.';
  END IF;

  v_max_parcelas := LEAST(GREATEST(COALESCE(v_proposta.parcelamento_permitido, 1), 1), 24);
  IF v_parcelas < 1 OR v_parcelas > v_max_parcelas THEN
    RAISE EXCEPTION 'Escolha entre 1 e % parcela(s) para esta proposta.', v_max_parcelas;
  END IF;

  v_expected_passageiros := GREATEST(COALESCE(v_proposta.quantidade_passageiros, 1), 1);

  SELECT COUNT(*)
    INTO v_passageiros_count
  FROM public.viagens_passageiros
  WHERE proposta_id = v_proposta_id
    AND cliente_id = v_cliente_id;

  IF v_passageiros_count <> v_expected_passageiros THEN
    RAISE EXCEPTION 'Cadastre exatamente % passageiro(s) antes do pagamento. Atualmente: %.',
      v_expected_passageiros,
      v_passageiros_count;
  END IF;

  SELECT *
    INTO v_transacao
  FROM public.viagens_transacoes
  WHERE proposta_id = v_proposta_id
    AND cliente_id = v_cliente_id
  FOR UPDATE;

  IF NOT FOUND THEN
    INSERT INTO public.viagens_transacoes (
      proposta_id,
      cliente_id,
      valor_pago,
      forma_pagamento,
      parcelas,
      valor_parcela,
      status
    ) VALUES (
      v_proposta_id,
      v_cliente_id,
      v_proposta.valor_total,
      v_forma_pagamento,
      v_parcelas,
      ROUND(v_proposta.valor_total / v_parcelas, 2),
      'pendente'
    )
    RETURNING * INTO v_transacao;
  END IF;

  IF v_transacao.status <> 'pendente' THEN
    RAISE EXCEPTION 'Esta viagem não está mais aguardando pagamento.';
  END IF;

  IF v_transacao.fatura_id IS NOT NULL THEN
    IF COALESCE(v_transacao.parcelas, 1) <> v_parcelas THEN
      RAISE EXCEPTION 'O parcelamento desta cobrança já foi definido em % parcela(s).', v_transacao.parcelas;
    END IF;

    RETURN jsonb_build_object(
      'success', TRUE,
      'idempotent', TRUE,
      'transacao_id', v_transacao.id,
      'fatura_id', v_transacao.fatura_id,
      'parcelas', v_transacao.parcelas,
      'valor_primeira_parcela', v_transacao.valor_parcela,
      'valor_total', v_proposta.valor_total
    );
  END IF;

  SELECT COUNT(*)
    INTO v_existing_invoice_count
  FROM public.faturas
  WHERE tipo = 'compra_viagem'
    AND metadata ->> 'transacao_id' = v_transacao.id::TEXT;

  IF v_existing_invoice_count > 0 THEN
    RAISE EXCEPTION 'Já existem cobranças vinculadas a esta viagem sem referência principal. Contate o suporte.';
  END IF;

  v_valor_base := TRUNC(v_proposta.valor_total / v_parcelas, 2);

  FOR v_parcela_numero IN 1..v_parcelas LOOP
    v_valor_parcela := CASE
      WHEN v_parcela_numero = v_parcelas
        THEN v_proposta.valor_total - (v_valor_base * (v_parcelas - 1))
      ELSE v_valor_base
    END;

    INSERT INTO public.faturas (
      cliente_id,
      valor_total,
      status,
      data_vencimento,
      tipo,
      metadata
    ) VALUES (
      v_cliente_id,
      v_valor_parcela,
      'pendente',
      (CURRENT_DATE + make_interval(months => v_parcela_numero - 1))::DATE,
      'compra_viagem',
      jsonb_build_object(
        'proposta_id', v_proposta_id,
        'transacao_id', v_transacao.id,
        'pacote', v_proposta.snapshot_completo ->> 'titulo',
        'forma_pagamento', v_forma_pagamento,
        'quantidade_passageiros', v_expected_passageiros,
        'parcela_numero', v_parcela_numero,
        'parcelas_total', v_parcelas,
        'valor_total_contrato', v_proposta.valor_total
      )
    )
    RETURNING id INTO v_fatura_id;

    IF v_parcela_numero = 1 THEN
      v_primeira_fatura_id := v_fatura_id;
      v_primeira_parcela := v_valor_parcela;
    END IF;

    v_fatura_ids := v_fatura_ids || jsonb_build_array(v_fatura_id);
  END LOOP;

  UPDATE public.viagens_transacoes
  SET fatura_id = v_primeira_fatura_id,
      forma_pagamento = v_forma_pagamento,
      valor_pago = v_proposta.valor_total,
      parcelas = v_parcelas,
      valor_parcela = v_primeira_parcela,
      updated_at = NOW()
  WHERE id = v_transacao.id
    AND status = 'pendente';

  RETURN jsonb_build_object(
    'success', TRUE,
    'transacao_id', v_transacao.id,
    'fatura_id', v_primeira_fatura_id,
    'fatura_ids', v_fatura_ids,
    'parcelas', v_parcelas,
    'valor_primeira_parcela', v_primeira_parcela,
    'valor_total', v_proposta.valor_total,
    'quantidade_passageiros', v_expected_passageiros
  );
END;
$$;

REVOKE ALL ON FUNCTION public.gsa_client_checkout_travel(UUID, TEXT, JSONB) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.gsa_client_checkout_travel(UUID, TEXT, JSONB) TO authenticated;
