BEGIN;

CREATE OR REPLACE FUNCTION public.gsa_calculator_pro_enforce_product_state()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  IF OLD.ativo AND NOT NEW.ativo THEN
    UPDATE public.gsa_calculator_pro_sessions
       SET revoked_at = now()
     WHERE tool_id = NEW.tool_id
       AND revoked_at IS NULL
       AND expires_at > now();

    INSERT INTO public.gsa_calculator_pro_events(event_type, tool_id, details)
    VALUES ('product_disabled', NEW.tool_id, jsonb_build_object('revoked_sessions', true));
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_gsa_calculator_pro_product_state ON public.gsa_calculator_pro_products;
CREATE TRIGGER trg_gsa_calculator_pro_product_state
AFTER UPDATE OF ativo ON public.gsa_calculator_pro_products
FOR EACH ROW EXECUTE FUNCTION public.gsa_calculator_pro_enforce_product_state();

CREATE OR REPLACE FUNCTION public.gsa_calculator_pro_limit_checkout_attempts()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_recent integer;
BEGIN
  SELECT count(*) INTO v_recent
    FROM public.gsa_calculator_pro_payments p
   WHERE p.visitor_token_hash = NEW.visitor_token_hash
     AND p.tool_id = NEW.tool_id
     AND p.created_at > now() - interval '10 minutes'
     AND p.status IN ('pending','processing');

  IF v_recent >= 5 THEN
    RAISE EXCEPTION 'Muitas tentativas de checkout. Aguarde alguns minutos.' USING ERRCODE = 'P0001';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_gsa_calculator_pro_checkout_limit ON public.gsa_calculator_pro_payments;
CREATE TRIGGER trg_gsa_calculator_pro_checkout_limit
BEFORE INSERT ON public.gsa_calculator_pro_payments
FOR EACH ROW EXECUTE FUNCTION public.gsa_calculator_pro_limit_checkout_attempts();

CREATE OR REPLACE FUNCTION public.gsa_calculator_pro_expire_records()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_vouchers integer := 0;
  v_grants integer := 0;
  v_sessions integer := 0;
BEGIN
  UPDATE public.gsa_calculator_pro_vouchers
     SET status = 'expired'
   WHERE status = 'active'
     AND expires_at IS NOT NULL
     AND expires_at <= now();
  GET DIAGNOSTICS v_vouchers = ROW_COUNT;

  UPDATE public.gsa_calculator_pro_grants
     SET status = 'expired'
   WHERE status = 'active'
     AND valid_until IS NOT NULL
     AND valid_until <= now();
  GET DIAGNOSTICS v_grants = ROW_COUNT;

  UPDATE public.gsa_calculator_pro_sessions
     SET revoked_at = COALESCE(revoked_at, now())
   WHERE revoked_at IS NULL
     AND expires_at <= now();
  GET DIAGNOSTICS v_sessions = ROW_COUNT;

  RETURN jsonb_build_object(
    'success', true,
    'expired_vouchers', v_vouchers,
    'expired_grants', v_grants,
    'expired_sessions', v_sessions
  );
END;
$$;

REVOKE ALL ON FUNCTION public.gsa_calculator_pro_expire_records() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.gsa_calculator_pro_expire_records() TO service_role;

COMMIT;
