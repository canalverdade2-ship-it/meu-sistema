BEGIN;

CREATE OR REPLACE FUNCTION public.gsa_client_request_affiliate_payout(
  p_sessao_id uuid,
  p_session_token text,
  p_request_id uuid,
  p_valor numeric
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_actor record;
  v_affiliate public.gsa_afiliados%rowtype;
  v_available numeric(14,2);
  v_minimum numeric(14,2);
  v_payout public.gsa_afiliado_saques%rowtype;
  v_value numeric(14,2) := round(coalesce(p_valor, 0), 2);
BEGIN
  SELECT * INTO v_actor
  FROM public.gsa_client_session_actor(p_sessao_id, p_session_token)
  LIMIT 1;

  SELECT * INTO v_affiliate
  FROM public.gsa_afiliados
  WHERE cliente_id = v_actor.cliente_id AND status = 'ativo'
  FOR UPDATE;

  IF v_affiliate.id IS NULL THEN
    RAISE EXCEPTION 'Perfil de afiliado ativo nao encontrado.';
  END IF;
  IF p_request_id IS NULL THEN
    RAISE EXCEPTION 'Identificador da solicitacao obrigatorio.';
  END IF;
  IF v_value <= 0 OR v_value > 1000000 THEN
    RAISE EXCEPTION 'Valor de saque invalido.';
  END IF;

  SELECT * INTO v_payout
  FROM public.gsa_afiliado_saques
  WHERE request_id = p_request_id
  FOR UPDATE;

  IF FOUND THEN
    IF v_payout.afiliado_id <> v_affiliate.id OR v_payout.valor <> v_value THEN
      RAISE EXCEPTION 'Identificador de solicitacao ja utilizado em outra operacao.';
    END IF;
    RETURN jsonb_build_object(
      'success', true,
      'idempotent', true,
      'payout_id', v_payout.id,
      'status', v_payout.status
    );
  END IF;

  SELECT coalesce(min(saque_minimo), 50)
    INTO v_minimum
  FROM public.gsa_afiliado_programas
  WHERE ativo;

  IF v_value < v_minimum THEN
    RAISE EXCEPTION 'O valor minimo para saque e R$ %.', v_minimum;
  END IF;
  IF v_affiliate.pix_chave IS NULL OR v_affiliate.pix_tipo IS NULL THEN
    RAISE EXCEPTION 'Cadastre uma chave PIX antes de solicitar saque.';
  END IF;

  SELECT greatest(
    coalesce((
      SELECT sum(valor - pago_valor)
      FROM public.gsa_afiliado_comissoes
      WHERE afiliado_id = v_affiliate.id AND status = 'disponivel'
    ), 0)
    - coalesce((
      SELECT sum(valor)
      FROM public.gsa_afiliado_saques
      WHERE afiliado_id = v_affiliate.id AND status IN ('solicitado','aprovado')
    ), 0),
    0
  ) INTO v_available;

  IF v_value > v_available THEN
    RAISE EXCEPTION 'Saldo de comissoes disponivel insuficiente.';
  END IF;

  INSERT INTO public.gsa_afiliado_saques(
    afiliado_id, request_id, valor, status,
    pix_tipo_snapshot, pix_chave_snapshot
  ) VALUES (
    v_affiliate.id, p_request_id, v_value, 'solicitado',
    v_affiliate.pix_tipo, v_affiliate.pix_chave
  )
  RETURNING * INTO v_payout;

  RETURN jsonb_build_object(
    'success', true,
    'idempotent', false,
    'payout_id', v_payout.id,
    'status', v_payout.status
  );
END;
$$;

REVOKE ALL ON FUNCTION public.gsa_client_request_affiliate_payout(uuid,text,uuid,numeric) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.gsa_client_request_affiliate_payout(uuid,text,uuid,numeric) TO authenticated, service_role;

COMMIT;
