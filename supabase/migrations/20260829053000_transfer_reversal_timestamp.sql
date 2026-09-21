BEGIN;
ALTER TABLE public.transferencias
  ADD COLUMN IF NOT EXISTS data_estorno timestamptz;
COMMENT ON COLUMN public.transferencias.data_estorno IS
  'Data e hora em que o destinatário devolveu a transferência ao remetente.';
NOTIFY pgrst,'reload schema';
COMMIT;
