-- Migration: Sistema Completo de Avaliações e Comentários de Produtos
-- Data: 2026-08-12

CREATE TABLE IF NOT EXISTS public.loja_avaliacoes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    produto_id UUID NOT NULL REFERENCES public.produtos(id) ON DELETE CASCADE,
    cliente_id UUID REFERENCES public.clientes(id) ON DELETE SET NULL,
    nome_autor TEXT NOT NULL DEFAULT 'Cliente GSA',
    cidade TEXT,
    estado TEXT,
    nota NUMERIC(2,1) NOT NULL CHECK (nota >= 1 AND nota <= 5),
    titulo TEXT,
    comentario TEXT NOT NULL,
    recomenda BOOLEAN DEFAULT true,
    fotos JSONB DEFAULT '[]'::jsonb,
    origem TEXT NOT NULL DEFAULT 'gsa', -- 'gsa' | 'importado' | 'ficticio'
    curtidas_uteis INTEGER DEFAULT 0,
    verificado BOOLEAN DEFAULT false,
    status TEXT NOT NULL DEFAULT 'aprovado', -- 'aprovado' | 'pendente' | 'rejeitado'
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Adiciona colunas auxiliares na tabela produtos se não existirem
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'produtos' AND column_name = 'avaliacao_media') THEN
        ALTER TABLE public.produtos ADD COLUMN avaliacao_media NUMERIC(3,2) DEFAULT 0;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'produtos' AND column_name = 'total_avaliacoes') THEN
        ALTER TABLE public.produtos ADD COLUMN total_avaliacoes INTEGER DEFAULT 0;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'produtos' AND column_name = 'comentarios_importados') THEN
        ALTER TABLE public.produtos ADD COLUMN comentarios_importados JSONB DEFAULT '[]'::jsonb;
    END IF;
END $$;

-- Índices para consultas rápidas
CREATE INDEX IF NOT EXISTS idx_loja_avaliacoes_produto ON public.loja_avaliacoes(produto_id, status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_loja_avaliacoes_cliente ON public.loja_avaliacoes(cliente_id);

-- Habilitar RLS
ALTER TABLE public.loja_avaliacoes ENABLE ROW LEVEL SECURITY;

-- Políticas de RLS
DROP POLICY IF EXISTS "Permitir leitura pública de avaliações aprovadas" ON public.loja_avaliacoes;
CREATE POLICY "Permitir leitura pública de avaliações aprovadas"
    ON public.loja_avaliacoes FOR SELECT
    USING (status = 'aprovado' OR auth.role() = 'service_role');

DROP POLICY IF EXISTS "Permitir inserção de avaliações" ON public.loja_avaliacoes;
CREATE POLICY "Permitir inserção de avaliações"
    ON public.loja_avaliacoes FOR INSERT
    WITH CHECK (true);

DROP POLICY IF EXISTS "Permitir atualização de curtidas úteis" ON public.loja_avaliacoes;
CREATE POLICY "Permitir atualização de curtidas úteis"
    ON public.loja_avaliacoes FOR UPDATE
    USING (true)
    WITH CHECK (true);

-- Conceder permissões
GRANT SELECT, INSERT, UPDATE ON public.loja_avaliacoes TO anon, authenticated, service_role;

-- Função Trigger para atualizar resumo de notas do produto automaticamente
CREATE OR REPLACE FUNCTION public.trg_fn_update_produto_rating_summary()
RETURNS TRIGGER AS $$
DECLARE
    v_produto_id UUID;
    v_media NUMERIC(3,2);
    v_total INTEGER;
BEGIN
    v_produto_id := COALESCE(NEW.produto_id, OLD.produto_id);
    
    -- Calcula a média e total apenas de avaliações reais do sistema GSA
    SELECT 
        COALESCE(ROUND(AVG(nota)::numeric, 1), 0),
        COUNT(*)
    INTO v_media, v_total
    FROM public.loja_avaliacoes
    WHERE produto_id = v_produto_id 
      AND status = 'aprovado'
      AND origem = 'gsa';

    IF v_total > 0 THEN
        UPDATE public.produtos 
        SET avaliacao_media = v_media, 
            total_avaliacoes = v_total
        WHERE id = v_produto_id;
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trg_loja_avaliacoes_rating_summary ON public.loja_avaliacoes;
CREATE TRIGGER trg_loja_avaliacoes_rating_summary
    AFTER INSERT OR UPDATE OR DELETE ON public.loja_avaliacoes
    FOR EACH ROW
    EXECUTE FUNCTION public.trg_fn_update_produto_rating_summary();
