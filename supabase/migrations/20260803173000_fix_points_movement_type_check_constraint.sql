-- Normalize movement type trigger and update check constraint to include all legacy and new movement types

CREATE OR REPLACE FUNCTION public.gsa_normalize_points_movement_type()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public, pg_temp
AS $$
BEGIN
  IF NEW.tipo IS NULL OR NEW.tipo = '' THEN
    NEW.tipo := 'geracao_fatura';
  ELSIF NEW.tipo IN ('pagamento', 'pagamento_fatura', 'pagamento_os', 'fatura_paga') THEN
    NEW.tipo := 'geracao_fatura';
  ELSIF NEW.tipo IN ('indicacao', 'bonus_indicacao', 'bonus_indicador', 'bonus_indicado') THEN
    NEW.tipo := 'indicacao';
  ELSIF NEW.tipo IN ('ajuste', 'ajuste_manual', 'ajuste_admin') THEN
    NEW.tipo := 'ajuste_manual';
  ELSIF NEW.tipo IN ('resgate', 'voucher') THEN
    NEW.tipo := 'resgate_voucher';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_gsa_normalize_points_movement_type ON public.pontos_movimentacoes;
CREATE TRIGGER trg_gsa_normalize_points_movement_type
BEFORE INSERT OR UPDATE OF tipo ON public.pontos_movimentacoes
FOR EACH ROW
EXECUTE FUNCTION public.gsa_normalize_points_movement_type();

ALTER TABLE public.pontos_movimentacoes DROP CONSTRAINT IF EXISTS pontos_movimentacoes_tipo_check;
ALTER TABLE public.pontos_movimentacoes ADD CONSTRAINT pontos_movimentacoes_tipo_check
  CHECK (tipo IN (
    'geracao_fatura', 'pagamento', 'pagamento_fatura', 'pagamento_os', 'fatura_paga',
    'uso_voucher', 'resgate_voucher', 'resgate_pontos', 'expiracao', 'ajuste_admin', 'ajuste_manual',
    'bonus_indicador', 'bonus_indicado', 'bonus_indicacao', 'indicacao', 'conversao_saldo', 'conversao_dinheiro',
    'estorno', 'uso_fatura', 'transferencia_entrada', 'transferencia_saida', 'outro'
  ));
