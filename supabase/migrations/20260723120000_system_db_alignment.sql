-- ====================================================================================
-- MIGRATION: SYSTEM & DATABASE COMPLETE ALIGNMENT AND SYNCHRONIZATION
-- ====================================================================================

-- 1. Ensure extensions and base system configuration
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 2. Create missing tables referenced in frontend code
CREATE TABLE IF NOT EXISTS public.cliente_notas_admin (
    id UUID PRIMARY KEY DEFAULT extensions.uuid_generate_v4(),
    cliente_id UUID REFERENCES public.clientes(id) ON DELETE CASCADE,
    autor_id UUID,
    autor_nome TEXT,
    conteudo TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

ALTER TABLE public.cliente_notas_admin ENABLE ROW LEVEL SECURITY;

DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'cliente_notas_admin' AND policyname = 'Allow all cliente_notas_admin') THEN
        CREATE POLICY "Allow all cliente_notas_admin" 
        ON public.cliente_notas_admin FOR ALL 
        USING (true) WITH CHECK (true);
    END IF;
END $$;

-- 3. Add missing columns referenced in frontend queries
ALTER TABLE public.ordens_servico ADD COLUMN IF NOT EXISTS anexos_os JSONB DEFAULT '[]'::jsonb;
ALTER TABLE public.orcamentos ADD COLUMN IF NOT EXISTS anexos JSONB DEFAULT '[]'::jsonb;
ALTER TABLE public.orcamentos ADD COLUMN IF NOT EXISTS comprovante_concorrente_urls JSONB DEFAULT '[]'::jsonb;
ALTER TABLE public.assinaturas ADD COLUMN IF NOT EXISTS visivel_na_loja BOOLEAN DEFAULT false;

-- 4. System Settings RLS and Access Control
ALTER TABLE IF EXISTS public.system_settings ENABLE ROW LEVEL SECURITY;

DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'system_settings' AND policyname = 'Public and Auth Read Access system_settings') THEN
        CREATE POLICY "Public and Auth Read Access system_settings" 
        ON public.system_settings FOR SELECT 
        USING (true);
    END IF;
END $$;

-- 5. Client Levels RLS
ALTER TABLE IF EXISTS public.client_levels ENABLE ROW LEVEL SECURITY;

DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'client_levels' AND policyname = 'Public Read client_levels') THEN
        CREATE POLICY "Public Read client_levels" 
        ON public.client_levels FOR SELECT 
        USING (true);
    END IF;
END $$;

-- 6. Ensure Store Categories RLS
ALTER TABLE IF EXISTS public.loja_categorias ENABLE ROW LEVEL SECURITY;

DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'loja_categorias' AND policyname = 'Public Read loja_categorias') THEN
        CREATE POLICY "Public Read loja_categorias" 
        ON public.loja_categorias FOR SELECT 
        USING (true);
    END IF;
END $$;

-- 7. Foreign Key Performance Indexes for System Responsiveness
CREATE INDEX IF NOT EXISTS idx_faturas_cliente_id ON public.faturas(cliente_id);
CREATE INDEX IF NOT EXISTS idx_cobrancas_cliente_id ON public.cobrancas(cliente_id);
CREATE INDEX IF NOT EXISTS idx_ordens_servico_cliente_id ON public.ordens_servico(cliente_id);
CREATE INDEX IF NOT EXISTS idx_ordens_compra_cliente_id ON public.ordens_compra(cliente_id);
CREATE INDEX IF NOT EXISTS idx_notificacoes_cliente_id ON public.notificacoes(cliente_id);
CREATE INDEX IF NOT EXISTS idx_loja_pedido_itens_cliente_id ON public.loja_pedido_itens(cliente_id);
CREATE INDEX IF NOT EXISTS idx_points_transactions_cliente_id ON public.points_transactions(cliente_id);
CREATE INDEX IF NOT EXISTS idx_pontos_movimentacoes_cliente_id ON public.pontos_movimentacoes(cliente_id);
CREATE INDEX IF NOT EXISTS idx_carteira_lancamentos_cliente_id ON public.carteira_lancamentos(cliente_id);

-- 8. Ensure Notifications RLS Policy
ALTER TABLE IF EXISTS public.notificacoes ENABLE ROW LEVEL SECURITY;

DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'notificacoes' AND policyname = 'Allow read notificacoes') THEN
        CREATE POLICY "Allow read notificacoes" 
        ON public.notificacoes FOR SELECT 
        USING (true);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'notificacoes' AND policyname = 'Allow insert notificacoes') THEN
        CREATE POLICY "Allow insert notificacoes" 
        ON public.notificacoes FOR INSERT 
        WITH CHECK (true);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'notificacoes' AND policyname = 'Allow update notificacoes') THEN
        CREATE POLICY "Allow update notificacoes" 
        ON public.notificacoes FOR UPDATE 
        USING (true);
    END IF;
END $$;

-- 9. Secure Transactional RPC for Points and Balance Sync
CREATE OR REPLACE FUNCTION public.sync_cliente_pontos_e_saldo(
    p_cliente_id UUID,
    p_pontos_delta INT DEFAULT 0,
    p_saldo_delta NUMERIC DEFAULT 0,
    p_descricao TEXT DEFAULT ''
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_novo_saldo NUMERIC;
    v_novos_pontos INT;
BEGIN
    UPDATE public.clientes
    SET 
        saldo_carteira = COALESCE(saldo_carteira, 0) + p_saldo_delta,
        saldo_pontos = COALESCE(saldo_pontos, 0) + p_pontos_delta,
        updated_at = NOW()
    WHERE id = p_cliente_id
    RETURNING saldo_carteira, saldo_pontos INTO v_novo_saldo, v_novos_pontos;

    IF p_pontos_delta <> 0 THEN
        INSERT INTO public.points_transactions (cliente_id, tipo, pontos, descricao, created_at)
        VALUES (p_cliente_id, CASE WHEN p_pontos_delta > 0 THEN 'credito' ELSE 'debito' END, p_pontos_delta, p_descricao, NOW());
        
        INSERT INTO public.pontos_movimentacoes (cliente_id, tipo, pontos, descricao, created_at)
        VALUES (p_cliente_id, CASE WHEN p_pontos_delta > 0 THEN 'credito' ELSE 'debito' END, p_pontos_delta, p_descricao, NOW());
    END IF;

    RETURN jsonb_build_object(
        'success', true,
        'novo_saldo', v_novo_saldo,
        'novos_pontos', v_novos_pontos
    );
EXCEPTION WHEN OTHERS THEN
    RETURN jsonb_build_object(
        'success', false,
        'error', SQLERRM
    );
END;
$$;

GRANT EXECUTE ON FUNCTION public.sync_cliente_pontos_e_saldo(UUID, INT, NUMERIC, TEXT) TO anon, authenticated, service_role;
