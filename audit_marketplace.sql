SELECT p.proname, pg_get_function_identity_arguments(p.oid) args, p.prosecdef,
       has_function_privilege('anon',p.oid,'EXECUTE') anon_exec,
       has_function_privilege('authenticated',p.oid,'EXECUTE') auth_exec
FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
WHERE n.nspname='public' AND p.proname IN ('gsa_client_checkout_store','gsa_client_cancel_store_order','gsa_client_generate_store_invoice','gsa_client_sync_pix_invoice','gsa_client_checkout_store_before_zero_fix_20260817');

SELECT table_name, grantee, string_agg(privilege_type,',' ORDER BY privilege_type) privileges
FROM information_schema.role_table_grants
WHERE table_schema='public' AND table_name IN ('produtos','orcamentos','loja_pedido_itens','loja_carrinhos','faturas','ordens_compra','cupons_loja','cupons_ativados')
  AND grantee IN ('anon','authenticated') GROUP BY table_name,grantee ORDER BY table_name,grantee;

SELECT tablename,policyname,cmd,roles,qual,with_check FROM pg_policies
WHERE schemaname='public' AND tablename IN ('produtos','orcamentos','loja_pedido_itens','loja_carrinhos','faturas','ordens_compra','cupons_loja','cupons_ativados')
ORDER BY tablename,policyname;

SELECT column_name,data_type FROM information_schema.columns
WHERE table_schema='public' AND table_name='orcamentos' AND column_name ILIKE '%request%';

SELECT conrelid::regclass table_name,conname,pg_get_constraintdef(oid) definition
FROM pg_constraint WHERE conrelid IN ('public.orcamentos'::regclass,'public.loja_pedido_itens'::regclass,'public.ordens_compra'::regclass)
 AND contype IN ('u','c','f') ORDER BY conrelid::regclass::text,conname;

SELECT count(*) FILTER(WHERE controle_estoque AND estoque_disponivel<0) negative_stock,
       count(*) FILTER(WHERE visivel_na_loja AND coalesce(status,'ativo')='ativo') visible_active,
       count(*) FILTER(WHERE visivel_na_loja AND controle_estoque AND estoque_disponivel<=0) visible_out_of_stock
FROM public.produtos;

SELECT status,count(*) FROM public.orcamentos WHERE categoria IN ('produto','assinatura') GROUP BY status ORDER BY count(*) DESC;

SELECT count(*) AS duplicate_request_groups FROM (
 SELECT checkout_request_id FROM public.orcamentos WHERE checkout_request_id IS NOT NULL GROUP BY checkout_request_id HAVING count(*)>1
) d;

SELECT count(*) FILTER (WHERE NOT EXISTS(SELECT 1 FROM public.loja_pedido_itens i WHERE i.orcamento_id=o.id)) orders_without_items,
       count(*) FILTER (WHERE o.status='pago' AND NOT EXISTS(SELECT 1 FROM public.faturas f WHERE f.orcamento_id=o.id)) paid_without_invoice,
       count(*) FILTER (WHERE EXISTS(SELECT 1 FROM public.faturas f WHERE f.orcamento_id=o.id AND abs(coalesce(f.valor_total,0)-coalesce(o.total,0))>0.01)) invoice_total_mismatch
FROM public.orcamentos o WHERE o.categoria IN ('produto','assinatura');

SELECT count(*) total_products,
       count(*) FILTER(WHERE visivel_na_loja) visible,
       jsonb_object_agg(coalesce(status,'NULL'),qty) status_counts
FROM (SELECT status,count(*) qty FROM public.produtos GROUP BY status) s
CROSS JOIN LATERAL (SELECT count(*) total_products,count(*) FILTER(WHERE visivel_na_loja) visible FROM public.produtos) totals
GROUP BY totals.total_products,totals.visible;

SELECT status,count(*) quantidade,coalesce(sum(valor_reembolso),0) valor
FROM public.loja_reembolsos GROUP BY status ORDER BY status;

SELECT count(*) FILTER(WHERE status='pendente' AND prazo_pagamento<now()) reembolsos_atrasados,
       count(*) FILTER(WHERE status='aprovado' AND data_pagamento IS NULL) aprovados_sem_data,
       count(*) FILTER(WHERE status='aprovado' AND metodo_reembolso='credito_carteira' AND NOT EXISTS(
         SELECT 1 FROM public.carteira_lancamentos cl WHERE cl.cliente_id=r.cliente_id AND cl.descricao ILIKE '%'||left(r.id::text,8)||'%'
       )) carteira_sem_lancamento
FROM public.loja_reembolsos r;

SELECT schemaname,tablename FROM pg_publication_tables
WHERE pubname='supabase_realtime' AND tablename IN ('produtos','orcamentos','loja_pedido_itens','loja_carrinhos','faturas','ordens_compra','cupons_loja') ORDER BY tablename;
