-- Legacy clients attempted to write "pago" to service orders, although the
-- domain constraint only supports andamento/concluido/cancelado. Normalize that
-- legacy transition while the frontend callers are being removed.

CREATE OR REPLACE FUNCTION public.gsa_normalize_service_order_status()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF NEW.status = 'pago' THEN
    NEW.status := 'concluido';
    NEW.data_fim := coalesce(NEW.data_fim, now());
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_gsa_normalize_service_order_status ON public.ordens_servico;
CREATE TRIGGER trg_gsa_normalize_service_order_status
BEFORE INSERT OR UPDATE OF status ON public.ordens_servico
FOR EACH ROW
EXECUTE FUNCTION public.gsa_normalize_service_order_status();

