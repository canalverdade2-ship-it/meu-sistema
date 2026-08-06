-- Trigger to ensure valor_final_pendente is always synced with valor_total and valor_pago
CREATE OR REPLACE FUNCTION public.fn_faturas_sync_valor_final_pendente()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.status = 'pago' THEN
    NEW.valor_final_pendente := 0;
  ELSE
    NEW.valor_final_pendente := CASE 
      WHEN coalesce(NEW.valor_pago, 0) > 0 THEN greatest(0, NEW.valor_total - coalesce(NEW.valor_pago, 0))
      ELSE NEW.valor_total
    END;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_faturas_sync_valor_final_pendente ON public.faturas;
CREATE TRIGGER trg_faturas_sync_valor_final_pendente
BEFORE INSERT OR UPDATE OF valor_total, valor_pago, status ON public.faturas
FOR EACH ROW
EXECUTE FUNCTION public.fn_faturas_sync_valor_final_pendente();

UPDATE public.faturas
   SET valor_final_pendente = CASE 
     WHEN status = 'pago' THEN 0
     WHEN coalesce(valor_pago, 0) > 0 THEN greatest(0, valor_total - coalesce(valor_pago, 0))
     ELSE valor_total
   END;
