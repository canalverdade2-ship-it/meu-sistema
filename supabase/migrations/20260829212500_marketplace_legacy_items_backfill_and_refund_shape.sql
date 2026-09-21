BEGIN;

CREATE OR REPLACE FUNCTION public.gsa_client_store_refunds(
  p_sessao_id uuid,
  p_session_token text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_actor record;
  v_result jsonb;
BEGIN
  SELECT * INTO v_actor
  FROM public.gsa_client_session_actor(p_sessao_id, p_session_token)
  LIMIT 1;

  SELECT coalesce(jsonb_agg(item ORDER BY criado_em DESC), '[]'::jsonb)
  INTO v_result
  FROM (
    SELECT r.id, r.codigo_reembolso, r.ordem_compra_id, r.ordem_assinatura_id,
           r.valor_reembolso, r.motivo_cancelamento, r.prazo_pagamento,
           r.status, r.data_pagamento, r.metodo_reembolso, r.referencia_estorno,
           r.comprovante_url, r.observacoes_pagamento, r.criado_em,
           coalesce(oc.orcamento_id, oa.orcamento_id) AS orcamento_id,
           coalesce(oc.codigo_ordem, oa.codigo_ordem) AS codigo_ordem,
           coalesce(p.nome, a.nome) AS item_nome,
           coalesce(o1.codigo_orcamento, o2.codigo_orcamento) AS codigo_orcamento
    FROM public.loja_reembolsos r
    LEFT JOIN public.ordens_compra oc ON oc.id = r.ordem_compra_id
    LEFT JOIN public.produtos p ON p.id = oc.produto_id
    LEFT JOIN public.orcamentos o1 ON o1.id = oc.orcamento_id
    LEFT JOIN public.ordens_assinatura oa ON oa.id = r.ordem_assinatura_id
    LEFT JOIN public.assinaturas a ON a.id = oa.assinatura_id
    LEFT JOIN public.orcamentos o2 ON o2.id = oa.orcamento_id
    WHERE r.cliente_id = v_actor.cliente_id
  ) item;

  RETURN v_result;
END;
$$;

REVOKE ALL ON FUNCTION public.gsa_client_store_refunds(uuid,text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.gsa_client_store_refunds(uuid,text) TO anon, authenticated;

CREATE TEMP TABLE legacy_marketplace_budgets ON COMMIT DROP AS
SELECT o.id
FROM public.orcamentos o
WHERE NOT EXISTS (SELECT 1 FROM public.loja_pedido_itens li WHERE li.orcamento_id = o.id)
  AND (EXISTS (SELECT 1 FROM public.ordens_compra oc WHERE oc.orcamento_id = o.id)
    OR EXISTS (SELECT 1 FROM public.ordens_assinatura oa WHERE oa.orcamento_id = o.id));

-- Normaliza snapshots históricos de produtos sem alterar estoque, saldo ou status.
INSERT INTO public.loja_pedido_itens(
  orcamento_id, cliente_id, tipo, item_id, produto_id,
  codigo, nome, valor_unitario, quantidade, subtotal, metadata,
  produto_variante_id, variacao_selecionada, created_at
)
SELECT o.id, o.cliente_id, 'produto', oc.produto_id, oc.produto_id,
       coalesce(nullif(p.codigo_produto,''), oc.codigo_ordem),
       coalesce(nullif(oc.nome_produto_contratado,''), p.nome, 'Produto'),
       greatest(coalesce(oc.valor_unitario_contratado, p.valor, 0), 0),
       greatest(coalesce(oc.quantidade, 1), 1),
       round(greatest(coalesce(oc.valor_unitario_contratado, p.valor, 0), 0)
             * greatest(coalesce(oc.quantidade, 1), 1), 2),
       jsonb_build_object('origem', 'backfill_legado', 'ordem_compra_id', oc.id),
       oc.produto_variante_id, oc.variacao_selecionada,
       coalesce(oc.data_criacao, o.data_criacao, now())
FROM public.ordens_compra oc
JOIN public.orcamentos o ON o.id = oc.orcamento_id
JOIN legacy_marketplace_budgets lb ON lb.id = o.id
LEFT JOIN public.produtos p ON p.id = oc.produto_id
WHERE oc.produto_id IS NOT NULL;

-- Normaliza snapshots históricos de assinaturas.
INSERT INTO public.loja_pedido_itens(
  orcamento_id, cliente_id, tipo, item_id, assinatura_id,
  codigo, nome, valor_unitario, quantidade, prazo_meses, subtotal, metadata, created_at
)
SELECT o.id, o.cliente_id, 'assinatura', oa.assinatura_id, oa.assinatura_id,
       coalesce(nullif(a.codigo_assinatura,''), oa.codigo_ordem),
       coalesce(nullif(oa.nome_assinatura_contratada,''), a.nome, 'Assinatura'),
       greatest(coalesce(oa.valor_mensal_contratado, a.valor, 0), 0),
       greatest(coalesce(oa.quantidade, 1), 1),
       greatest(coalesce(oa.prazo_meses, 1), 1),
       round(greatest(coalesce(oa.valor_mensal_contratado, a.valor, 0), 0)
             * greatest(coalesce(oa.quantidade, 1), 1), 2),
       jsonb_build_object('origem', 'backfill_legado', 'ordem_assinatura_id', oa.id),
       coalesce(oa.data_criacao, o.data_criacao, now())
FROM public.ordens_assinatura oa
JOIN public.orcamentos o ON o.id = oa.orcamento_id
JOIN legacy_marketplace_budgets lb ON lb.id = o.id
LEFT JOIN public.assinaturas a ON a.id = oa.assinatura_id
WHERE oa.assinatura_id IS NOT NULL;

NOTIFY pgrst, 'reload schema';
COMMIT;
