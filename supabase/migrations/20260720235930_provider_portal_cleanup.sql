BEGIN;

-- O frontend definitivo não grava mais notas diretamente. A nota de entrega/devolução
-- é criada exclusivamente pelo trigger transacional da demanda.
DROP TRIGGER IF EXISTS trg_provider_duplicate_os_note ON public.os_notas;
DROP FUNCTION IF EXISTS public.gsa_provider_suppress_duplicate_os_note();

COMMIT;
