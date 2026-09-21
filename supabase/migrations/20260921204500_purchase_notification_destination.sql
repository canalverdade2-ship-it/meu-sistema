BEGIN;
DO $$ DECLARE source text; BEGIN
source:=pg_get_functiondef('public.gsa_notify_marketplace_admin_event()'::regprocedure);
IF position('v_tab := ''abertos''' in source)=0 THEN RAISE EXCEPTION 'Unexpected function version'; END IF;
EXECUTE replace(source,'v_tab := ''abertos''','v_tab := ''processamento''');
END $$;
UPDATE public.notificacoes SET modulo='vendas',tab='processamento'
WHERE destinatario_tipo='admin' AND acao_origem='checkout_loja' AND tab='abertos';
COMMIT;
SELECT count(*) AS corrected_purchase_links FROM public.notificacoes WHERE destinatario_tipo='admin' AND acao_origem='checkout_loja' AND tab='processamento';