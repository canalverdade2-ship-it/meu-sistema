-- Keep legacy callers compatible with the canonical points ledger domain.

CREATE OR REPLACE FUNCTION public.gsa_normalize_points_movement_type()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF NEW.tipo = 'pagamento' THEN
    NEW.tipo := 'geracao_fatura';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_gsa_normalize_points_movement_type ON public.pontos_movimentacoes;
CREATE TRIGGER trg_gsa_normalize_points_movement_type
BEFORE INSERT OR UPDATE OF tipo ON public.pontos_movimentacoes
FOR EACH ROW
EXECUTE FUNCTION public.gsa_normalize_points_movement_type();

