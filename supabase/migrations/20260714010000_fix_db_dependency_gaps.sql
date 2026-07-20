-- Fixes verified application/database dependency gaps found by the live audit.
-- Keeps the comment counter update in the database instead of relying on frontend fallback logic.

CREATE OR REPLACE FUNCTION public.increment_comentarios(demanda_id_param uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.prestador_demandas
  SET
    total_comentarios = COALESCE(total_comentarios, 0) + 1,
    updated_at = now()
  WHERE id = demanda_id_param;
END;
$$;

GRANT EXECUTE ON FUNCTION public.increment_comentarios(uuid) TO anon, authenticated;
