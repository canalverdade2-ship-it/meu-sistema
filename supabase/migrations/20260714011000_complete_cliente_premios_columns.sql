-- Completes columns used by the current prize flow without removing existing data.

ALTER TABLE public.cliente_premios
  ADD COLUMN IF NOT EXISTS nome text,
  ADD COLUMN IF NOT EXISTS tipo text,
  ADD COLUMN IF NOT EXISTS data_cadastro timestamptz,
  ADD COLUMN IF NOT EXISTS data_validade timestamptz,
  ADD COLUMN IF NOT EXISTS data_cancelamento timestamptz,
  ADD COLUMN IF NOT EXISTS motivo_cancelamento text,
  ADD COLUMN IF NOT EXISTS forma_resgate text;

UPDATE public.cliente_premios
SET
  nome = COALESCE(nome, titulo),
  data_cadastro = COALESCE(data_cadastro, created_at),
  data_validade = COALESCE(data_validade, COALESCE(created_at, now()) + interval '30 days')
WHERE nome IS NULL
   OR data_cadastro IS NULL
   OR data_validade IS NULL;

ALTER TABLE public.cliente_premios
  ALTER COLUMN data_cadastro SET DEFAULT now(),
  ALTER COLUMN data_validade SET DEFAULT (now() + interval '30 days');
