BEGIN;

CREATE OR REPLACE FUNCTION public.gsa_admin_set_calculator_pro_voucher_status(
  p_sessao_id uuid,
  p_session_token text,
  p_voucher_id uuid,
  p_status text
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_voucher public.gsa_calculator_pro_vouchers;
BEGIN
  PERFORM public.gsa_admin_validate_context(p_sessao_id, p_session_token);

  IF p_status NOT IN ('active','cancelled') THEN
    RAISE EXCEPTION 'Status de voucher inválido' USING ERRCODE = '22023';
  END IF;

  SELECT * INTO v_voucher
    FROM public.gsa_calculator_pro_vouchers
   WHERE id = p_voucher_id
   FOR UPDATE;

  IF v_voucher.id IS NULL THEN
    RAISE EXCEPTION 'Voucher não encontrado' USING ERRCODE = 'P0002';
  END IF;
  IF v_voucher.status = 'used' THEN
    RAISE EXCEPTION 'Voucher já utilizado não pode ser alterado' USING ERRCODE = '22023';
  END IF;
  IF v_voucher.status = 'expired'
     OR (v_voucher.expires_at IS NOT NULL AND v_voucher.expires_at <= now()) THEN
    UPDATE public.gsa_calculator_pro_vouchers
       SET status = 'expired'
     WHERE id = v_voucher.id;
    RAISE EXCEPTION 'Voucher expirado não pode ser reativado' USING ERRCODE = '22023';
  END IF;

  UPDATE public.gsa_calculator_pro_vouchers
     SET status = p_status
   WHERE id = v_voucher.id;

  RETURN jsonb_build_object('success', true, 'status', p_status);
END;
$$;

REVOKE ALL ON FUNCTION public.gsa_admin_set_calculator_pro_voucher_status(uuid,text,uuid,text)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.gsa_admin_set_calculator_pro_voucher_status(uuid,text,uuid,text)
  TO authenticated;

COMMIT;
