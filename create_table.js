import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const supabase = createClient(process.env.VITE_SUPABASE_URL, process.env.VITE_SUPABASE_ANON_KEY);

async function run() {
  const sql = `
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
ALTER TABLE public.os_suporte_mensagens ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Enable insert for authenticated users only" ON public.os_suporte_mensagens;
CREATE POLICY "Enable insert for authenticated users only" ON public.os_suporte_mensagens FOR INSERT WITH CHECK (auth.role() = 'authenticated');
DROP POLICY IF EXISTS "Enable select for authenticated users only" ON public.os_suporte_mensagens;
CREATE POLICY "Enable select for authenticated users only" ON public.os_suporte_mensagens FOR SELECT USING (auth.role() = 'authenticated');
DROP POLICY IF EXISTS "Enable update for authenticated users only" ON public.os_suporte_mensagens;
CREATE POLICY "Enable update for authenticated users only" ON public.os_suporte_mensagens FOR UPDATE USING (auth.role() = 'authenticated');
  `;
  // We can't execute raw SQL via JS client without RPC or postgres connection.
  // Wait, I will use `psql` if they have a postgres connection string, but we only have VITE_SUPABASE_URL.
}
run();
