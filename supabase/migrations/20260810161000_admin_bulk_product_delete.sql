-- Migration: 20260810161000_admin_bulk_product_delete.sql
-- Funcao RPC segura para exclusao definitiva de produtos em lote pelo Administrador

CREATE OR REPLACE FUNCTION public.gsa_admin_delete_products_bulk(
  p_sessao_id UUID,
  p_session_token TEXT,
  p_ids UUID[]
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO public, pg_temp
AS $$
DECLARE
  v_actor RECORD;
  v_deleted_count INTEGER := 0;
  v_archived_count INTEGER := 0;
  v_id UUID;
BEGIN
  -- 1. Autenticar sessao administrativa
  SELECT * INTO v_actor FROM public.gsa_require_admin_actor(p_sessao_id, p_session_token);

  -- 2. Limpar tabelas filhas sem risco de integridade
  DELETE FROM public.loja_carrinhos WHERE item_id = ANY(p_ids) AND tipo = 'produto';
  DELETE FROM public.produto_fornecedor_config WHERE produto_id = ANY(p_ids);
  
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'loja_avaliacoes') THEN
    DELETE FROM public.loja_avaliacoes WHERE produto_id = ANY(p_ids);
  END IF;

  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'loja_favoritos') THEN
    DELETE FROM public.loja_favoritos WHERE produto_id = ANY(p_ids);
  END IF;

  -- 3. Excluir produtos em lote
  FOREACH v_id IN ARRAY p_ids
  LOOP
    BEGIN
      DELETE FROM public.produtos WHERE id = v_id;
      IF FOUND THEN
        v_deleted_count := v_deleted_count + 1;
      END IF;
    EXCEPTION WHEN foreign_key_violation THEN
      -- Se possuir vinculo com faturas/pedidos historicos, inativa o produto
      UPDATE public.produtos SET status = 'inativo', visivel_na_loja = false WHERE id = v_id;
      v_archived_count := v_archived_count + 1;
    END;
  END LOOP;

  RETURN jsonb_build_object(
    'success', true, 
    'deleted', v_deleted_count, 
    'archived', v_archived_count,
    'total', v_deleted_count + v_archived_count
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.gsa_admin_delete_products_bulk(UUID, TEXT, UUID[]) TO anon, authenticated, service_role;
