CREATE OR REPLACE FUNCTION public.gsa_admin_ajustar_saldo_cliente(
  p_sessao_id uuid,
  p_session_token text,
  p_cliente_id uuid,
  p_tipo text,
  p_valor numeric,
  p_descricao text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_actor record;
  v_cliente clientes%rowtype;
  v_tipo text := coalesce(nullif(trim(p_tipo), ''), 'entrada');
  v_valor numeric := round(coalesce(p_valor, 0), 2);
  v_adjustment numeric;
  v_novo_saldo numeric;
  v_descricao text;
BEGIN
  IF v_valor <= 0 THEN
    RAISE EXCEPTION 'Valor do ajuste deve ser maior que zero.';
  END IF;

  IF v_tipo NOT IN ('entrada', 'saida') THEN
    RAISE EXCEPTION 'Tipo de ajuste invalido.';
  END IF;

  SELECT * INTO v_actor
  FROM public.gsa_admin_session_actor(p_sessao_id, p_session_token)
  LIMIT 1;

  SELECT * INTO v_cliente
  FROM public.clientes
  WHERE id = p_cliente_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Cliente nao encontrado.';
  END IF;

  v_adjustment := CASE WHEN v_tipo = 'entrada' THEN v_valor ELSE -v_valor END;
  v_novo_saldo := round(coalesce(v_cliente.saldo_carteira, 0) + v_adjustment, 2);
  v_descricao := coalesce(nullif(trim(p_descricao), ''), 'Lancamento manual de ' || CASE WHEN v_tipo = 'entrada' THEN 'credito' ELSE 'debito' END) || ' [POR: ' || v_actor.ator_nome || ']';

  UPDATE public.clientes
     SET saldo_carteira = v_novo_saldo,
         updated_at = now()
   WHERE id = p_cliente_id;

  INSERT INTO public.carteira_lancamentos(cliente_id, valor, tipo, descricao)
  VALUES (
    p_cliente_id,
    v_valor,
    CASE WHEN v_tipo = 'entrada' THEN 'credito' ELSE 'debito' END,
    v_descricao
  );

  INSERT INTO public.extrato_financeiro(cliente_id, tipo, valor, descricao, saldo_resultante)
  VALUES (
    p_cliente_id,
    v_tipo,
    v_valor,
    v_descricao,
    v_novo_saldo
  );

  RETURN jsonb_build_object(
    'success', true,
    'cliente_id', p_cliente_id,
    'saldo_anterior', coalesce(v_cliente.saldo_carteira, 0),
    'saldo_atual', v_novo_saldo,
    'ajuste', v_adjustment
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.gsa_admin_ajustar_saldo_cliente(uuid, text, uuid, text, numeric, text) TO anon, authenticated;
