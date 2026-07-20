-- Alterar tabela loja_reembolsos para suportar assinaturas (ordem_compra_id null) e referenciar ordem_assinatura
ALTER TABLE public.loja_reembolsos
ALTER COLUMN ordem_compra_id DROP NOT NULL;

-- Adicionar ordem_assinatura_id caso não exista
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name='loja_reembolsos' AND column_name='ordem_assinatura_id') THEN
        ALTER TABLE public.loja_reembolsos
        ADD COLUMN ordem_assinatura_id uuid REFERENCES public.ordens_assinatura(id) ON DELETE SET NULL;
    END IF;
END $$;
