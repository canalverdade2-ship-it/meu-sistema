BEGIN;

-- A interface administrativa utiliza a assinatura canônica com ação,
-- referência e data. A sobrecarga legada aceitava marcar como pago sem
-- comprovante e deixa de ser acessível pelo navegador.
DO $$
BEGIN
  IF to_regprocedure('public.gsa_admin_decide_affiliate_payout(uuid,text,uuid,text,text,timestamptz,text)') IS NOT NULL THEN
    REVOKE ALL ON FUNCTION public.gsa_admin_decide_affiliate_payout(uuid,text,uuid,text,text,timestamptz,text)
      FROM PUBLIC, anon, authenticated;
    GRANT EXECUTE ON FUNCTION public.gsa_admin_decide_affiliate_payout(uuid,text,uuid,text,text,timestamptz,text)
      TO service_role;
  END IF;
END $$;

NOTIFY pgrst, 'reload schema';
COMMIT;
