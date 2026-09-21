BEGIN;

ALTER TABLE public.clientes
  ADD COLUMN IF NOT EXISTS limite_credito_bloqueado numeric(14,2) NOT NULL DEFAULT 0
  CHECK (limite_credito_bloqueado >= 0);
ALTER TABLE public.loja_credito_contestacoes
  ADD COLUMN IF NOT EXISTS valor_bloqueado numeric(14,2) NOT NULL DEFAULT 0
  CHECK (valor_bloqueado >= 0);
ALTER TABLE public.loja_credito_cancelamentos_limite
  ADD COLUMN IF NOT EXISTS valor_bloqueado numeric(14,2) NOT NULL DEFAULT 0
  CHECK (valor_bloqueado >= 0);

CREATE OR REPLACE FUNCTION public.gsa_guard_store_credit_blocked_balance()
RETURNS trigger LANGUAGE plpgsql SET search_path TO 'public','pg_temp' AS $$
BEGIN
  NEW.limite_credito_bloqueado := round(greatest(COALESCE(NEW.limite_credito_bloqueado,0),0),2);
  IF COALESCE(current_setting('gsa.system_override',true),'')='on'
     AND COALESCE(NEW.limite_credito_total,0)=0
     AND COALESCE(NEW.limite_credito_disponivel,0)=0 THEN
    NEW.limite_credito_bloqueado := 0;
  END IF;
  IF NEW.limite_credito_bloqueado > greatest(COALESCE(NEW.limite_credito_disponivel,0),0) + 0.01 THEN
    RAISE EXCEPTION 'O limite disponível está bloqueado por uma análise financeira em andamento.' USING ERRCODE='22023';
  END IF;
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS trg_guard_store_credit_blocked_balance ON public.clientes;
CREATE TRIGGER trg_guard_store_credit_blocked_balance
BEFORE INSERT OR UPDATE OF limite_credito_disponivel,limite_credito_bloqueado ON public.clientes
FOR EACH ROW EXECUTE FUNCTION public.gsa_guard_store_credit_blocked_balance();

CREATE OR REPLACE FUNCTION public.gsa_apply_credit_dispute_block()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public','pg_temp' AS $$
DECLARE v_release numeric := 0; v_reduce numeric := 0;
BEGIN
  PERFORM pg_advisory_xact_lock(hashtextextended('gsa-store-credit:' || NEW.cliente_id::text,0));
  PERFORM set_config('gsa.credit_release','on',true);
  PERFORM set_config('gsa.system_override','on',true);
  IF TG_OP='INSERT' THEN
    NEW.valor_bloqueado := round(NEW.valor_contestado,2);
    UPDATE public.clientes SET
      limite_credito_disponivel=least(COALESCE(limite_credito_total,0),round(COALESCE(limite_credito_disponivel,0)+NEW.valor_bloqueado,2)),
      limite_credito_bloqueado=round(COALESCE(limite_credito_bloqueado,0)+NEW.valor_bloqueado,2)
    WHERE id=NEW.cliente_id;
    RETURN NEW;
  END IF;
  IF OLD.status IN ('aberta','em_analise','aguardando_documentos')
     AND NEW.status IN ('deferida','parcialmente_deferida','indeferida','cancelada_cliente','resolvida_por_estorno') THEN
    v_release := round(COALESCE(OLD.valor_bloqueado,OLD.valor_contestado,0),2);
    IF NEW.status IN ('indeferida','cancelada_cliente') THEN v_reduce := v_release;
    ELSIF NEW.status='parcialmente_deferida' THEN v_reduce := greatest(v_release-COALESCE(NEW.valor_deferido,0),0);
    ELSE v_reduce := 0;
    END IF;
    UPDATE public.clientes SET
      limite_credito_bloqueado=greatest(round(COALESCE(limite_credito_bloqueado,0)-v_release,2),0),
      limite_credito_disponivel=greatest(round(COALESCE(limite_credito_disponivel,0)-v_reduce,2),0)
    WHERE id=NEW.cliente_id;
    NEW.valor_bloqueado := 0;
  END IF;
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS trg_apply_credit_dispute_block ON public.loja_credito_contestacoes;
CREATE TRIGGER trg_apply_credit_dispute_block
BEFORE INSERT OR UPDATE OF status ON public.loja_credito_contestacoes
FOR EACH ROW EXECUTE FUNCTION public.gsa_apply_credit_dispute_block();

CREATE OR REPLACE FUNCTION public.gsa_apply_credit_limit_cancellation_block()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public','pg_temp' AS $$
DECLARE v_client public.clientes%rowtype; v_release numeric := 0;
BEGIN
  PERFORM pg_advisory_xact_lock(hashtextextended('gsa-store-credit:' || NEW.cliente_id::text,0));
  PERFORM set_config('gsa.credit_release','on',true);
  PERFORM set_config('gsa.system_override','on',true);
  IF TG_OP='INSERT' THEN
    SELECT * INTO v_client FROM public.clientes WHERE id=NEW.cliente_id FOR UPDATE;
    IF COALESCE(v_client.limite_credito_bloqueado,0)>0.01 THEN
      RAISE EXCEPTION 'Existe limite bloqueado por outra análise financeira.' USING ERRCODE='22023';
    END IF;
    NEW.valor_bloqueado := round(COALESCE(v_client.limite_credito_disponivel,0),2);
    UPDATE public.clientes SET limite_credito_bloqueado=NEW.valor_bloqueado WHERE id=NEW.cliente_id;
    RETURN NEW;
  END IF;
  IF OLD.status IN ('solicitado','em_analise') AND NEW.status IN ('aprovado','recusado') THEN
    v_release := round(COALESCE(OLD.valor_bloqueado,0),2);
    UPDATE public.clientes SET limite_credito_bloqueado=0 WHERE id=NEW.cliente_id;
    NEW.valor_bloqueado := 0;
  END IF;
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS trg_apply_credit_limit_cancellation_block ON public.loja_credito_cancelamentos_limite;
CREATE TRIGGER trg_apply_credit_limit_cancellation_block
BEFORE INSERT OR UPDATE OF status ON public.loja_credito_cancelamentos_limite
FOR EACH ROW EXECUTE FUNCTION public.gsa_apply_credit_limit_cancellation_block();

NOTIFY pgrst, 'reload schema';
COMMIT;
