-- Habilitar RLS (Row-Level Security)
ALTER TABLE public.cobrancas ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cobranca_historico ENABLE ROW LEVEL SECURITY;

-- Criar políticas de acesso total (leitura, inserção, atualização e deleção)
CREATE POLICY "Public Full Access" ON public.cobrancas FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Public Full Access" ON public.cobranca_historico FOR ALL USING (true) WITH CHECK (true);
