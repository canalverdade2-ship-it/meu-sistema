-- Corrige o fluxo principal do GSA Viagens:
-- proposta aceita -> transação pendente -> passageiros -> checkout.

ALTER TABLE public.viagens_orcamentos
  ADD COLUMN IF NOT EXISTS pacote_id UUID REFERENCES public.viagens_pacotes(id) ON DELETE SET NULL;

ALTER TABLE public.viagens_transacoes
  ADD COLUMN IF NOT EXISTS forma_pagamento TEXT;

CREATE OR REPLACE FUNCTION public.gsa_accept_travel_proposal(
  p_proposta_id UUID
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO public, pg_temp
AS $$
DECLARE
  v_cliente_id UUID;
  v_proposta public.viagens_propostas%ROWTYPE;
  v_transacao_id UUID;
BEGIN
  SELECT id INTO v_cliente_id
  FROM public.clientes
  WHERE user_id = auth.uid()
  LIMIT 1;

  IF v_cliente_id IS NULL THEN
    RAISE EXCEPTION 'Cliente autenticado não encontrado.';
  END IF;

  SELECT * INTO v_proposta
  FROM public.viagens_propostas
  WHERE id = p_proposta_id
    AND cliente_id = v_cliente_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Proposta não encontrada ou não pertence a este cliente.';
  END IF;

  IF v_proposta.status NOT IN ('enviada', 'visualizada', 'aceita') THEN
    RAISE EXCEPTION 'Esta proposta não pode mais ser aceita.';
  END IF;

  IF NOW() > v_proposta.prazo_aceitacao THEN
    UPDATE public.viagens_propostas
    SET status = 'expirada', updated_at = NOW()
    WHERE id = p_proposta_id;
    RAISE EXCEPTION 'O prazo de aceite desta proposta expirou.';
  END IF;

  UPDATE public.viagens_propostas
  SET status = 'aceita',
      aceito_em = COALESCE(aceito_em, NOW()),
      updated_at = NOW()
  WHERE id = p_proposta_id;

  INSERT INTO public.viagens_transacoes (
    proposta_id,
    cliente_id,
    valor_pago,
    status
  ) VALUES (
    p_proposta_id,
    v_cliente_id,
    v_proposta.valor_total,
    'pendente'
  )
  ON CONFLICT (proposta_id) DO UPDATE
    SET valor_pago = EXCLUDED.valor_pago,
        updated_at = NOW()
  RETURNING id INTO v_transacao_id;

  RETURN jsonb_build_object(
    'success', true,
    'proposta_id', p_proposta_id,
    'transacao_id', v_transacao_id
  );
END;
$$;

REVOKE ALL ON FUNCTION public.gsa_accept_travel_proposal(UUID) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.gsa_accept_travel_proposal(UUID) TO authenticated;

CREATE OR REPLACE FUNCTION public.gsa_client_checkout_travel(
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
  v_proposta public.viagens_propostas%ROWTYPE;
  v_fatura_id UUID;
  v_transacao_id UUID;
  v_passageiros_count INTEGER;
BEGIN
  SELECT id INTO v_cliente_id
  FROM public.clientes
  WHERE user_id = auth.uid()
  LIMIT 1;

  IF v_cliente_id IS NULL THEN
    RAISE EXCEPTION 'Cliente autenticado não encontrado.';
  END IF;

  v_proposta_id := (p_payload->>'proposta_id')::UUID;
  v_forma_pagamento := COALESCE(NULLIF(p_payload->>'forma_pagamento', ''), 'outros');

  IF v_proposta_id IS NULL THEN
    RAISE EXCEPTION 'Proposta de viagem não informada.';
  END IF;

  SELECT * INTO v_proposta
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

  SELECT COUNT(*) INTO v_passageiros_count
  FROM public.viagens_passageiros
  WHERE proposta_id = v_proposta_id
    AND cliente_id = v_cliente_id;

  IF v_passageiros_count = 0 THEN
    RAISE EXCEPTION 'Nenhum passageiro cadastrado para esta viagem.';
  END IF;

  SELECT id, fatura_id INTO v_transacao_id, v_fatura_id
  FROM public.viagens_transacoes
  WHERE proposta_id = v_proposta_id
    AND cliente_id = v_cliente_id
  FOR UPDATE;

  IF v_transacao_id IS NULL THEN
    INSERT INTO public.viagens_transacoes (
      proposta_id, cliente_id, valor_pago, forma_pagamento, status
    ) VALUES (
      v_proposta_id, v_cliente_id, v_proposta.valor_total, v_forma_pagamento, 'pendente'
    ) RETURNING id INTO v_transacao_id;
  END IF;

  IF v_fatura_id IS NULL THEN
    INSERT INTO public.faturas (
      cliente_id,
      valor_total,
      status,
      data_vencimento,
      tipo,
      metadata
    ) VALUES (
      v_cliente_id,
      v_proposta.valor_total,
      'pendente',
      CURRENT_DATE,
      'compra_viagem',
      jsonb_build_object(
        'proposta_id', v_proposta_id,
        'transacao_id', v_transacao_id,
        'pacote', v_proposta.snapshot_completo->>'titulo',
        'forma_pagamento', v_forma_pagamento
      )
    ) RETURNING id INTO v_fatura_id;
  END IF;

  UPDATE public.viagens_transacoes
  SET fatura_id = v_fatura_id,
      forma_pagamento = v_forma_pagamento,
      valor_pago = v_proposta.valor_total,
      updated_at = NOW()
  WHERE id = v_transacao_id;

  RETURN jsonb_build_object(
    'success', true,
    'transacao_id', v_transacao_id,
    'fatura_id', v_fatura_id
  );
END;
$$;

REVOKE ALL ON FUNCTION public.gsa_client_checkout_travel(JSONB) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.gsa_client_checkout_travel(JSONB) TO authenticated;
