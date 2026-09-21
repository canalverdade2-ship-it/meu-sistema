-- Fecha configuracoes auxiliares de fornecedor que foram abertas por policy generica.

BEGIN;

ALTER TABLE public.produto_fornecedor_config ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow All Access" ON public.produto_fornecedor_config;
DROP POLICY IF EXISTS "Allow anon all on produto_fornecedor_config" ON public.produto_fornecedor_config;
DROP POLICY IF EXISTS "Allow anon insert on produto_fornecedor_config" ON public.produto_fornecedor_config;
REVOKE ALL ON TABLE public.produto_fornecedor_config FROM PUBLIC, anon, authenticated;

ALTER TABLE public.produtos_fornecedores_config ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow All Access" ON public.produtos_fornecedores_config;
REVOKE ALL ON TABLE public.produtos_fornecedores_config FROM PUBLIC, anon, authenticated;

NOTIFY pgrst, 'reload schema';
COMMIT;
