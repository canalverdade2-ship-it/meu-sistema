-- Migration: 20260828120000_atomic_points_conversion.sql
-- Description: Atomic points to wallet conversion RPC function for WhatsApp Webhook and Clients
-- Resolves: P0 Race Condition / RMW concurrency vulnerability on points-to-wallet conversion

CREATE OR REPLACE FUNCTION public.gsa_converter_pontos_carteira(
  p_cliente_id uuid,
  p_pontos integer DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_client public.clientes%rowtype;
  v_pts integer;
  v_rate numeric := 0.01; -- 100 pontos = R$ 1,00
  v_valor numeric;
  v_novo_pontos integer;
  v_novo_carteira numeric;
BEGIN
  -- Row-level exclusive lock prevents race conditions and concurrent modifications
  SELECT * INTO v_client
  FROM public.clientes
  WHERE id = p_cliente_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Cliente não encontrado');
  END IF;

  IF coalesce(v_client.pontos_bloqueados, false) THEN
    RETURN jsonb_build_object('success', false, 'error', 'Carteira de pontos bloqueada');
  END IF;

  IF p_pontos IS NULL OR p_pontos <= 0 THEN
    v_pts := coalesce(v_client.saldo_pontos, 0);
  ELSE
    v_pts := p_pontos;
  END IF;

  IF v_pts <= 0 OR coalesce(v_client.saldo_pontos, 0) < v_pts THEN
    RETURN jsonb_build_object('success', false, 'error', 'Saldo de pontos insuficiente');
  END IF;

  -- Obter taxa de conversão cadastrada ou usar taxa padrão (0.01)
  SELECT least(greatest(coalesce(taxa_conversao_pontos, 0.01), 0.0001), 100)
  INTO v_rate FROM public.empresa ORDER BY created_at LIMIT 1;
  v_rate := coalesce(v_rate, 0.01);

  v_valor := round(v_pts * v_rate, 2);
  v_novo_pontos := coalesce(v_client.saldo_pontos, 0) - v_pts;
  v_novo_carteira := round(coalesce(v_client.saldo_carteira, 0) + v_valor, 2);

  UPDATE public.clientes
  SET
    saldo_pontos = v_novo_pontos,
    saldo_carteira = v_novo_carteira,
    updated_at = now()
  WHERE id = p_cliente_id;

  INSERT INTO public.pontos_movimentacoes (
    cliente_id, tipo, pontos, saldo_apos, descricao, valor_convertido
  ) VALUES (
    p_cliente_id, 'conversao_dinheiro', -v_pts, v_novo_pontos,
    'Conversão de pontos em saldo via WhatsApp', v_valor
  );

  INSERT INTO public.carteira_lancamentos (
    cliente_id, valor, tipo, descricao
  ) VALUES (
    p_cliente_id, v_valor, 'credito',
    'Conversão de pontos via WhatsApp'
  );

  INSERT INTO public.extrato_financeiro (
    cliente_id, tipo, valor, descricao, modulo_referencia, saldo_resultante
  ) VALUES (
    p_cliente_id, 'entrada', v_valor, 'Conversão de pontos via WhatsApp', 'pontos', v_novo_carteira
  );

  RETURN jsonb_build_object(
    'success', true,
    'pontos_convertidos', v_pts,
    'valor_convertido', v_valor,
    'novo_saldo_pontos', v_novo_pontos,
    'novo_saldo_carteira', v_novo_carteira
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.gsa_converter_pontos_carteira(uuid, integer) TO anon, authenticated, service_role;
