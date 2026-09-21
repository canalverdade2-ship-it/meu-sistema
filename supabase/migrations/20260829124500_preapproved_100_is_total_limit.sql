BEGIN;

CREATE OR REPLACE FUNCTION public.gsa_guard_preapproved_credit_eligibility()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE v_total numeric; v_released timestamptz;
BEGIN
  IF NEW.origem_pre_aprovado IS TRUE THEN
    SELECT coalesce(limite_credito_total,0),credito_pre_aprovado_liberado_em INTO v_total,v_released
    FROM public.clientes WHERE id=NEW.cliente_id;
    IF v_total>=100 OR v_released IS NOT NULL THEN RAISE EXCEPTION 'Cliente ja possui limite de R$ 100,00 ou superior.'; END IF;
    NEW.limite_solicitado:=100; NEW.prazo_analise:=coalesce(NEW.prazo_analise,now()+interval '72 hours');
  END IF;
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS trg_guard_preapproved_credit_eligibility ON public.loja_credito_solicitacoes;
CREATE TRIGGER trg_guard_preapproved_credit_eligibility BEFORE INSERT OR UPDATE OF origem_pre_aprovado,limite_solicitado
ON public.loja_credito_solicitacoes FOR EACH ROW EXECUTE FUNCTION public.gsa_guard_preapproved_credit_eligibility();

-- Ajusta a aprovacao vigente: R$ 100 e o novo limite total, nao um adicional.
DO $$
DECLARE v_def text;
BEGIN
  SELECT pg_get_functiondef('public.gsa_admin_approve_preapproved_credit_100(uuid,text,uuid)'::regprocedure) INTO v_def;
  v_def:=replace(v_def,
    'v_new_total:=round(coalesce(v_client.limite_credito_total,0)+100,2);' || chr(10) ||
    '  v_new_available:=round(coalesce(v_client.limite_credito_disponivel,0)+100,2);',
    'IF coalesce(v_client.limite_credito_total,0)>=100 THEN RAISE EXCEPTION ''Cliente ja possui limite de R$ 100,00 ou superior.''; END IF;' || chr(10) ||
    '  v_new_total:=100;' || chr(10) ||
    '  v_new_available:=round(coalesce(v_client.limite_credito_disponivel,0)+(100-coalesce(v_client.limite_credito_total,0)),2);');
  v_def:=replace(v_def,
    '''concessao_inicial'',100,coalesce(v_client.limite_credito_total,0),v_new_total',
    '''concessao_inicial'',(100-coalesce(v_client.limite_credito_total,0)),coalesce(v_client.limite_credito_total,0),v_new_total');
  EXECUTE v_def;
END;
$$;

COMMIT;
