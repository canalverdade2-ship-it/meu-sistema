-- Permite ao cliente cancelar pedidos físicos até antes do início do transporte.
-- Mantém bloqueados pedidos em transporte ou já entregues e preserva todos os
-- estornos, notificações e registros de auditoria da função existente.

DO $migration$
DECLARE
  v_function_definition text;
  v_updated_definition text;
BEGIN
  SELECT pg_get_functiondef(
    'public.gsa_client_cancel_store_order_before_guard_fix_20260817(uuid,text,uuid,text)'::regprocedure
  )
  INTO v_function_definition;

  v_updated_definition := replace(
    v_function_definition,
    $rule$status IN ('em_expedicao', 'em_transporte', 'concluido')$rule$,
    $rule$status IN ('em_transporte', 'concluido')$rule$
  );

  IF v_updated_definition = v_function_definition THEN
    RAISE EXCEPTION 'A regra esperada de cancelamento da loja não foi encontrada.';
  END IF;

  EXECUTE v_updated_definition;
END;
$migration$;

COMMENT ON FUNCTION public.gsa_client_cancel_store_order(uuid, text, uuid, text) IS
  'Cancela atomicamente pedido físico da loja antes do transporte, com estornos, auditoria, notificações e recomposição de estoque.';
