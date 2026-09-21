-- ============================================================
-- Migration: Adicionar data_cancelamento em parceiros_resgates
-- Suporte ao fluxo de cancelamento de resgate de benefício via WhatsApp/Self-Service
-- ============================================================

-- Adiciona a coluna data_cancelamento de forma idempotente
ALTER TABLE public.parceiros_resgates
  ADD COLUMN IF NOT EXISTS data_cancelamento timestamptz;

-- Comentário explicativo na coluna
COMMENT ON COLUMN public.parceiros_resgates.data_cancelamento IS 'Data e hora em que o protocolo de resgate foi cancelado pelo cliente ou pelo autoatendimento via WhatsApp';

-- Notifica o PostgREST para recarregar o schema imediatamente
NOTIFY pgrst, 'reload schema';
