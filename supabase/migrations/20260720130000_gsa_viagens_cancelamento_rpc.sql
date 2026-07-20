-- Solicitação transacional de cancelamento pelo titular da viagem.

CREATE OR REPLACE FUNCTION public.gsa_request_travel_cancellation(
  p_transacao_id UUID,
  p_motivo TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO public, pg_temp
AS $$
DECLARE
  v_cliente_id UUID;
  v_transacao public.viagens_transacoes%ROWTYPE;
  v_cancelamento_id UUID;
BEGIN
  SELECT id INTO v_cliente_id
  FROM public.clientes
  WHERE user_id = auth.uid()
  LIMIT 1;

  IF v_cliente_id IS NULL THEN
    RAISE EXCEPTION 'Cliente autenticado não encontrado.';
  END IF;

  IF p_motivo IS NULL OR char_length(trim(p_motivo)) < 10 THEN
    RAISE EXCEPTION 'Informe um motivo com pelo menos 10 caracteres.';
  END IF;

  SELECT * INTO v_transacao
  FROM public.viagens_transacoes
  WHERE id = p_transacao_id
    AND cliente_id = v_cliente_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Viagem não encontrada ou não pertence a este cliente.';
  END IF;

  IF v_transacao.status IN ('cancelada', 'reembolsada', 'concluida') THEN
    RAISE EXCEPTION 'Esta viagem não aceita uma nova solicitação de cancelamento.';
  END IF;

  SELECT id INTO v_cancelamento_id
  FROM public.viagens_cancelamentos
  WHERE transacao_id = p_transacao_id
    AND cliente_id = v_cliente_id
    AND status IN ('solicitado', 'em_analise', 'reembolso_aprovado')
  ORDER BY created_at DESC
  LIMIT 1;

  IF v_cancelamento_id IS NOT NULL THEN
    RETURN jsonb_build_object(
      'success', true,
      'already_exists', true,
      'cancelamento_id', v_cancelamento_id
    );
  END IF;

  INSERT INTO public.viagens_cancelamentos (
    transacao_id,
    cliente_id,
    motivo,
    valor_solicitado,
    status
  ) VALUES (
    p_transacao_id,
    v_cliente_id,
    trim(p_motivo),
    v_transacao.valor_pago,
    'solicitado'
  )
  RETURNING id INTO v_cancelamento_id;

  UPDATE public.viagens_transacoes
  SET status = 'reembolso_em_analise',
      updated_at = NOW()
  WHERE id = p_transacao_id;

  RETURN jsonb_build_object(
    'success', true,
    'already_exists', false,
    'cancelamento_id', v_cancelamento_id
  );
END;
$$;

REVOKE ALL ON FUNCTION public.gsa_request_travel_cancellation(UUID, TEXT) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.gsa_request_travel_cancellation(UUID, TEXT) TO authenticated;
