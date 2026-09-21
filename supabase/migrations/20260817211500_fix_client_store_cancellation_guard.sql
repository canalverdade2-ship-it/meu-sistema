-- Permite que a RPC autenticada de cancelamento execute os estornos internos
-- protegidos pelo gatilho financeiro, sem liberar esses campos ao navegador.
-- Também recompõe o estoque da variante escolhido no pedido.

DO $$
BEGIN
  IF to_regprocedure('public.gsa_client_cancel_store_order_before_guard_fix_20260817(uuid,text,uuid,text)') IS NULL THEN
    ALTER FUNCTION public.gsa_client_cancel_store_order(uuid, text, uuid, text)
      RENAME TO gsa_client_cancel_store_order_before_guard_fix_20260817;
  END IF;
END;
$$;

REVOKE ALL ON FUNCTION public.gsa_client_cancel_store_order_before_guard_fix_20260817(uuid, text, uuid, text)
  FROM public, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.gsa_client_cancel_store_order_before_guard_fix_20260817(uuid, text, uuid, text)
  TO service_role;

CREATE OR REPLACE FUNCTION public.gsa_client_cancel_store_order(
  p_sessao_id uuid,
  p_session_token text,
  p_orcamento_id uuid,
  p_motivo text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_previous_status text;
  v_result jsonb;
BEGIN
  SELECT status INTO v_previous_status
  FROM public.orcamentos
  WHERE id = p_orcamento_id;

  -- O bypass vale somente para esta transação e somente dentro da RPC
  -- SECURITY DEFINER, depois que a função-base validar a sessão e a posse.
  PERFORM set_config('gsa.credit_release', 'on', true);
  PERFORM set_config('gsa.system_override', 'on', true);

  v_result := public.gsa_client_cancel_store_order_before_guard_fix_20260817(
    p_sessao_id, p_session_token, p_orcamento_id, p_motivo
  );

  IF COALESCE(v_previous_status, '') <> 'cancelado'
     AND COALESCE((v_result ->> 'already_cancelled')::boolean, false) IS FALSE THEN
    UPDATE public.produto_variantes variant
    SET estoque_disponivel = variant.estoque_disponivel + restored.quantity,
        updated_at = now()
    FROM (
      SELECT item.produto_variante_id,
             sum(COALESCE(item.quantidade, 1))::integer AS quantity
      FROM public.loja_pedido_itens item
      WHERE item.orcamento_id = p_orcamento_id
        AND item.tipo = 'produto'
        AND item.produto_variante_id IS NOT NULL
      GROUP BY item.produto_variante_id
    ) restored
    WHERE variant.id = restored.produto_variante_id
      AND COALESCE(variant.controle_estoque, false);
  END IF;

  RETURN v_result;
END;
$$;

REVOKE ALL ON FUNCTION public.gsa_client_cancel_store_order(uuid, text, uuid, text)
  FROM public, anon;
GRANT EXECUTE ON FUNCTION public.gsa_client_cancel_store_order(uuid, text, uuid, text)
  TO authenticated, service_role;

COMMENT ON FUNCTION public.gsa_client_cancel_store_order(uuid, text, uuid, text) IS
  'Cancela atomicamente pedido da loja, autoriza apenas os estornos internos protegidos e recompõe estoque de variantes.';
