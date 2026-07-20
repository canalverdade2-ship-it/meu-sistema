-- Create os_suporte_mensagens table
CREATE TABLE IF NOT EXISTS public.os_suporte_mensagens (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  os_id UUID NOT NULL REFERENCES public.ordens_servico(id) ON DELETE CASCADE,
  remetente_tipo TEXT NOT NULL CHECK (remetente_tipo IN ('cliente', 'admin')),
  remetente_id UUID,
  remetente_nome TEXT,
  mensagem TEXT NOT NULL,
  lida BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

-- Enable RLS
ALTER TABLE public.os_suporte_mensagens ENABLE ROW LEVEL SECURITY;

-- Create policies
CREATE POLICY "Enable insert for authenticated users only" ON public.os_suporte_mensagens
  FOR INSERT WITH CHECK (auth.role() = 'authenticated');

CREATE POLICY "Enable select for authenticated users only" ON public.os_suporte_mensagens
  FOR SELECT USING (auth.role() = 'authenticated');

CREATE POLICY "Enable update for authenticated users only" ON public.os_suporte_mensagens
  FOR UPDATE USING (auth.role() = 'authenticated');

-- Enable realtime
alter publication supabase_realtime add table public.os_suporte_mensagens;
