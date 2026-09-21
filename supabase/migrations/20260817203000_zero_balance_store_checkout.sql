-- Pedidos integralmente quitados por pontos/carteira precisam de uma fatura
-- interna paga (R$ 0,00), sem qualquer adquirente externo. Além de preservar
-- a trilha financeira, isso dispara normalmente os fluxos pós-pagamento.

DO $$
BEGIN
  IF to_regprocedure('public.gsa_client_checkout_store_before_zero_fix_20260817(uuid,text,jsonb)') IS NULL THEN
    ALTER FUNCTION public.gsa_client_checkout_store(uuid, text, jsonb)
      RENAME TO gsa_client_checkout_store_before_zero_fix_20260817;
  END IF;
END;
$$;

REVOKE ALL ON FUNCTION public.gsa_client_checkout_store_before_zero_fix_20260817(uuid, text, jsonb)
  FROM public, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.gsa_client_checkout_store_before_zero_fix_20260817(uuid, text, jsonb)
  TO service_role;

CREATE OR REPLACE FUNCTION public.gsa_client_checkout_store(
  p_sessao_id uuid,
  p_session_token text,
  p_payload jsonb
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_result jsonb;
  v_order public.orcamentos%rowtype;
  v_first_purchase uuid;
  v_first_subscription uuid;
  v_first_service uuid;
  v_items jsonb;
BEGIN
  v_result := public.gsa_client_checkout_store_before_zero_fix_20260817(
    p_sessao_id, p_session_token, p_payload
  );

  IF round(COALESCE((v_result ->> 'total')::numeric, 0), 2) <> 0
     OR lower(COALESCE(v_result ->> 'status', '')) <> 'pago' THEN
    RETURN v_result;
  END IF;

  SELECT * INTO v_order
  FROM public.orcamentos
  WHERE id = (v_result ->> 'orcamento_id')::uuid;

  IF v_order.id IS NULL THEN
    RAISE EXCEPTION 'Pedido quitado não encontrado.';
  END IF;

  SELECT id INTO v_first_purchase FROM public.ordens_compra
   WHERE orcamento_id = v_order.id ORDER BY id LIMIT 1;
  SELECT id INTO v_first_subscription FROM public.ordens_assinatura
   WHERE orcamento_id = v_order.id ORDER BY id LIMIT 1;
  SELECT id INTO v_first_service FROM public.ordens_servico
   WHERE orcamento_id = v_order.id ORDER BY id LIMIT 1;

  SELECT COALESCE(jsonb_agg(jsonb_build_object(
    'nome', nome, 'codigo', codigo, 'tipo', tipo,
    'quantidade', quantidade, 'valor_unitario', valor_unitario,
    'subtotal', subtotal, 'produto_variante_id', produto_variante_id,
    'variacao_selecionada', variacao_selecionada
  ) ORDER BY id), '[]'::jsonb)
  INTO v_items
  FROM public.loja_pedido_itens
  WHERE orcamento_id = v_order.id;

  IF NOT EXISTS (SELECT 1 FROM public.faturas WHERE orcamento_id = v_order.id) THEN
    INSERT INTO public.faturas(
      codigo_fatura, cliente_id, orcamento_id, ordem_compra_id,
      ordem_assinatura_id, os_id, valor_total, valor_pago,
      valor_final_pendente, status, tipo, data_emissao, data_pagamento,
      data_vencimento, gerada_automaticamente, forma_pagamento_escolhida,
      itens_faturados, valor_base_original, desconto_promocional_aplicado,
      desconto_voucher_aplicado, desconto_pontos_aplicado,
      abatimento_carteira_aplicado, observacoes
    ) VALUES (
      'FAT-' || regexp_replace(v_order.codigo_orcamento, '^(ODC-|ORC-)', ''),
      v_order.cliente_id, v_order.id, v_first_purchase,
      v_first_subscription, v_first_service, 0, 0, 0, 'pago',
      CASE WHEN v_first_purchase IS NOT NULL THEN 'produto'
           WHEN v_first_subscription IS NOT NULL THEN 'assinatura'
           ELSE 'servico' END,
      current_date, now(), current_date, true, 'saldo_pontos', v_items,
      COALESCE(v_order.subtotal_preco_tabela, v_order.subtotal_itens, 0),
      COALESCE(v_order.desconto_promocional, 0), COALESCE(v_order.desconto_cupom, 0),
      COALESCE(v_order.desconto_pontos, 0), COALESCE(v_order.abatimento_carteira, 0),
      'Quitada integralmente por pontos e/ou saldo da carteira; sem cobrança externa.'
    );
  END IF;

  RETURN v_result;
END;
$$;

REVOKE ALL ON FUNCTION public.gsa_client_checkout_store(uuid, text, jsonb) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.gsa_client_checkout_store(uuid, text, jsonb)
  TO authenticated, service_role;

COMMENT ON FUNCTION public.gsa_client_checkout_store(uuid, text, jsonb) IS
  'Checkout atômico da loja; pedidos de saldo zero são liquidados internamente sem adquirente.';
