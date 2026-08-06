-- Migration: Criar tabela para pendências bidirecionais via WhatsApp
-- Description: Cria tabela de contexto para aguardar arquivos e respostas via WhatsApp

CREATE TABLE IF NOT EXISTS public.whatsapp_pendencias_ativas (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  cliente_id UUID REFERENCES public.clientes(id) ON DELETE CASCADE,
  telefone TEXT NOT NULL,
  modulo TEXT NOT NULL,
  registro_id TEXT NOT NULL,
  tipo_esperado TEXT NOT NULL CHECK (tipo_esperado IN ('arquivo', 'texto', 'opcao', 'qualquer')),
  status TEXT NOT NULL DEFAULT 'aguardando_resposta' CHECK (status IN ('aguardando_resposta', 'processado', 'expirado')),
  mensagem_contexto TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  expires_at TIMESTAMP WITH TIME ZONE DEFAULT (now() + interval '3 days')
);

-- Index for fast lookup by phone number when a message arrives
CREATE INDEX IF NOT EXISTS idx_wp_pendencias_telefone ON public.whatsapp_pendencias_ativas(telefone) WHERE status = 'aguardando_resposta';
CREATE INDEX IF NOT EXISTS idx_wp_pendencias_cliente ON public.whatsapp_pendencias_ativas(cliente_id);

-- Enable RLS
ALTER TABLE public.whatsapp_pendencias_ativas ENABLE ROW LEVEL SECURITY;

-- Admins can read all
CREATE POLICY "Admins read all whatsapp_pendencias_ativas" 
  ON public.whatsapp_pendencias_ativas 
  FOR SELECT 
  TO authenticated 
  USING (
    EXISTS (SELECT 1 FROM admins WHERE id = auth.uid()) OR
    EXISTS (SELECT 1 FROM colaboradores WHERE id = auth.uid())
  );

-- Function to register a pending interaction
CREATE OR REPLACE FUNCTION public.gsa_registrar_pendencia_whatsapp(
  p_cliente_id UUID,
  p_telefone TEXT,
  p_modulo TEXT,
  p_registro_id TEXT,
  p_tipo_esperado TEXT,
  p_mensagem_contexto TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_id UUID;
BEGIN
  -- Mark existing waiting requests for this exact record as expired to prevent duplicates
  UPDATE public.whatsapp_pendencias_ativas
  SET status = 'expirado', updated_at = now()
  WHERE cliente_id = p_cliente_id 
    AND modulo = p_modulo 
    AND registro_id = p_registro_id 
    AND status = 'aguardando_resposta';

  INSERT INTO public.whatsapp_pendencias_ativas(
    cliente_id, telefone, modulo, registro_id, tipo_esperado, mensagem_contexto
  ) VALUES (
    p_cliente_id, p_telefone, p_modulo, p_registro_id, p_tipo_esperado, p_mensagem_contexto
  ) RETURNING id INTO v_id;

  RETURN jsonb_build_object('success', true, 'id', v_id);
END;
$$;

-- Add publication for realtime
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables 
    WHERE pubname = 'supabase_realtime' 
      AND schemaname = 'public' 
      AND tablename = 'whatsapp_pendencias_ativas'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.whatsapp_pendencias_ativas;
  END IF;
END $$;
