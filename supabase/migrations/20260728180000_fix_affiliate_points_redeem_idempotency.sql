-- Migration: Fix ON CONFLICT specification and bypass client sensitive profile guard for gsa_client_redeem_affiliate_points
-- Resolves Postgres error: "Campos administrativos e financeiros não podem ser alterados pelo cliente."

CREATE OR REPLACE FUNCTION public.gsa_client_redeem_affiliate_points(
  p_sessao_id uuid,
  p_session_token text,
  p_request_id uuid,
  p_pontos numeric
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_actor record;
  v_points numeric(14,2);
  v_rate numeric := 0.01;
  v_minimum numeric := 100;
  v_active boolean := true;
  v_credit numeric(14,2);
  v_inserted_id uuid;
BEGIN
  SELECT * INTO v_actor FROM public.gsa_client_session_actor(p_sessao_id, p_session_token) LIMIT 1;
  IF p_request_id IS NULL THEN RAISE EXCEPTION 'Identificador da operacao obrigatorio.'; END IF;

  SELECT coalesce(max(CASE WHEN key = 'afiliado_pontos_resgate_taxa' THEN value::numeric END), 0.01),
         coalesce(max(CASE WHEN key = 'afiliado_pontos_minimo_resgate' THEN value::numeric END), 100),
         coalesce(max(CASE WHEN key = 'afiliado_pontos_ativo' THEN value END)::boolean, true)
    INTO v_rate, v_minimum, v_active
  FROM public.system_settings
  WHERE key IN ('afiliado_pontos_resgate_taxa','afiliado_pontos_minimo_resgate','afiliado_pontos_ativo');

  IF NOT v_active THEN RAISE EXCEPTION 'O resgate de pontos esta temporariamente indisponivel.'; END IF;
  IF coalesce(p_pontos, 0) < v_minimum THEN RAISE EXCEPTION 'O minimo para resgate e % pontos.', v_minimum; END IF;

  IF EXISTS (
    SELECT 1 FROM public.gsa_afiliado_pontos_eventos WHERE request_id = p_request_id
  ) THEN
    RETURN jsonb_build_object('success', true, 'idempotent', true);
  END IF;

  SELECT pontos INTO v_points FROM public.clientes WHERE id = v_actor.cliente_id FOR UPDATE;
  IF coalesce(v_points, 0) < p_pontos THEN RAISE EXCEPTION 'Saldo de pontos insuficiente.'; END IF;
  v_credit := round(p_pontos * v_rate, 2);
  IF v_credit <= 0 THEN RAISE EXCEPTION 'Conversao de pontos invalida.'; END IF;

  INSERT INTO public.gsa_afiliado_pontos_eventos(cliente_id, tipo, pontos_assinados, valor_carteira, request_id)
  VALUES (v_actor.cliente_id, 'resgate_carteira', -round(p_pontos, 2), v_credit, p_request_id)
  ON CONFLICT (request_id) WHERE request_id IS NOT NULL DO NOTHING
  RETURNING id INTO v_inserted_id;

  IF v_inserted_id IS NULL THEN
    RETURN jsonb_build_object('success', true, 'idempotent', true);
  END IF;

  -- Bypass trigger protection for financial balance update inside secure RPC
  PERFORM set_config('gsa.credit_release', 'on', true);

  UPDATE public.clientes
     SET pontos = pontos - round(p_pontos, 2),
         saldo_carteira = saldo_carteira + v_credit
   WHERE id = v_actor.cliente_id;

  RETURN jsonb_build_object('success', true, 'pontos', p_pontos, 'valor_creditado', v_credit);
END;
$$;

REVOKE ALL ON FUNCTION public.gsa_client_redeem_affiliate_points(uuid,text,uuid,numeric) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.gsa_client_redeem_affiliate_points(uuid,text,uuid,numeric) TO authenticated, service_role;
