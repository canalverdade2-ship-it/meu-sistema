BEGIN;

-- 1. ESTRUTURA DA TABELA parceiros (colunas de resgate)
ALTER TABLE public.parceiros
  ADD COLUMN IF NOT EXISTS redemption_has_coupon    boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS redemption_coupon_code   text,
  ADD COLUMN IF NOT EXISTS redemption_has_voucher   boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS redemption_has_link      boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS redemption_link          text,
  ADD COLUMN IF NOT EXISTS redemption_auto_redirect boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS redemption_instructions  text,
  ADD COLUMN IF NOT EXISTS redemption_delay_24h     boolean NOT NULL DEFAULT false;

-- 2. ESTRUTURA DA TABELA parceiros_resgates (todos os campos)
ALTER TABLE public.parceiros_resgates
  ADD COLUMN IF NOT EXISTS email          text,
  ADD COLUMN IF NOT EXISTS link_ativacao  text,
  ADD COLUMN IF NOT EXISTS status         text NOT NULL DEFAULT 'pendente',
  ADD COLUMN IF NOT EXISTS data_ativacao  timestamptz;

-- 3. Notifica PostgREST para recarregar schema cache
NOTIFY pgrst, 'reload schema';

COMMIT;
