cat << 'EOF' > /home/opc/wipe_products.sql
BEGIN;

CREATE TEMP TABLE p_ids AS SELECT id FROM public.produtos;

DELETE FROM public.fornecedor_entrega_itens WHERE produto_id IN (SELECT id FROM p_ids) OR pedido_item_id IN (SELECT id FROM public.pedido_compra_fornecedor_itens WHERE fornecedor_produto_id IN (SELECT id FROM public.fornecedor_produtos WHERE produto_id IN (SELECT id FROM p_ids)));
DELETE FROM public.pedido_compra_fornecedor_itens WHERE produto_id IN (SELECT id FROM p_ids) OR fornecedor_produto_id IN (SELECT id FROM public.fornecedor_produtos WHERE produto_id IN (SELECT id FROM p_ids));
DELETE FROM public.loja_pedido_itens WHERE produto_id IN (SELECT id FROM p_ids);
DELETE FROM public.ordens_compra WHERE produto_id IN (SELECT id FROM p_ids);
DELETE FROM public.loja_avaliacoes WHERE produto_id IN (SELECT id FROM p_ids);
DELETE FROM public.loja_avisos_estoque WHERE produto_id IN (SELECT id FROM p_ids);
DELETE FROM public.loja_estoque_historico WHERE produto_id IN (SELECT id FROM p_ids);
DELETE FROM public.loja_favoritos WHERE produto_id IN (SELECT id FROM p_ids);
DELETE FROM public.fornecedor_produtos WHERE produto_id IN (SELECT id FROM p_ids);
DELETE FROM public.cupons_loja WHERE produto_id IN (SELECT id FROM p_ids);
DELETE FROM public.fornecedor_produto_solicitacoes WHERE produto_id IN (SELECT id FROM p_ids) OR produto_aprovado_id IN (SELECT id FROM p_ids);
DELETE FROM public.loja_solicitacoes WHERE produto_desejado_id IN (SELECT id FROM p_ids);
DELETE FROM public.produto_desconto_cota_movimentos WHERE produto_id IN (SELECT id FROM p_ids);
DELETE FROM public.produto_fornecedor_config WHERE produto_id IN (SELECT id FROM p_ids);
DELETE FROM public.produto_importacao_origem WHERE produto_id IN (SELECT id FROM p_ids);
DELETE FROM public.produtos_fornecedores_config WHERE produto_id IN (SELECT id FROM p_ids);
DELETE FROM public.promocoes_quantidade WHERE produto_gatilho_id IN (SELECT id FROM p_ids) OR produto_brinde_id IN (SELECT id FROM p_ids);
DELETE FROM public.shopee_fulfillment_job_items WHERE produto_id IN (SELECT id FROM p_ids);
DELETE FROM public.loja_vaquinhas WHERE produto_id IN (SELECT id FROM p_ids);
DELETE FROM public.produto_variacao_grupos WHERE produto_id IN (SELECT id FROM p_ids);
DELETE FROM public.produto_variantes WHERE produto_id IN (SELECT id FROM p_ids);

DELETE FROM public.produtos WHERE id IN (SELECT id FROM p_ids);

COMMIT;
EOF
PGPASSWORD='GSA_SENHA_FORTE_2026' psql -h 127.0.0.1 -p 5433 -U supabase_admin -d gsahub -f /home/opc/wipe_products.sql