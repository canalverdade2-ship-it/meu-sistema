BEGIN;
ALTER TABLE public.ordens_compra ADD COLUMN IF NOT EXISTS entrega_rastreavel boolean;
ALTER TABLE public.ordens_compra ADD COLUMN IF NOT EXISTS codigo_rastreio text;
ALTER TABLE public.orcamentos ADD COLUMN IF NOT EXISTS entrega_rastreavel boolean;
ALTER TABLE public.orcamentos ADD COLUMN IF NOT EXISTS codigo_rastreio text;
CREATE OR REPLACE FUNCTION public.gsa_admin_ship_store_order(
 p_sessao_id uuid,p_session_token text,p_request_id uuid,p_ordem_compra_id uuid,
 p_novo_status text,p_rastreavel boolean,p_codigo_rastreio text
) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp
AS $$
DECLARE v_order public.ordens_compra%rowtype; v_result jsonb; v_code text;
BEGIN
 PERFORM public.gsa_require_admin_actor(p_sessao_id,p_session_token);
 IF p_novo_status IS DISTINCT FROM 'em_transporte' THEN RAISE EXCEPTION 'Operação exclusiva para envio em transporte.'; END IF;
 IF p_rastreavel IS NULL THEN RAISE EXCEPTION 'Informe se a entrega é rastreável.'; END IF;
 v_code:=CASE WHEN p_rastreavel THEN nullif(btrim(p_codigo_rastreio),'') ELSE NULL END;
 IF p_rastreavel AND (v_code IS NULL OR length(v_code)>100 OR v_code ~ '[[:cntrl:]]') THEN
  RAISE EXCEPTION 'Informe um código de rastreamento válido, com até 100 caracteres.';
 END IF;
 PERFORM pg_advisory_xact_lock(hashtextextended(p_request_id::text,0));
 SELECT * INTO v_order FROM public.ordens_compra WHERE id=p_ordem_compra_id FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'Ordem de compra não encontrada.'; END IF;
 SELECT result INTO v_result FROM public.gsa_admin_operation_requests WHERE request_id=p_request_id AND resource_id=p_ordem_compra_id;
 IF v_result IS NOT NULL THEN RETURN v_result || jsonb_build_object('already_processed',true); END IF;
 IF EXISTS(SELECT 1 FROM public.gsa_admin_operation_requests WHERE request_id=p_request_id) THEN RAISE EXCEPTION 'Identificador de operação já utilizado.'; END IF;
 v_result:=public.gsa_admin_transition_store_order(p_sessao_id,p_session_token,p_request_id,p_ordem_compra_id,p_novo_status);
 UPDATE public.ordens_compra SET entrega_rastreavel=p_rastreavel,codigo_rastreio=v_code WHERE id=p_ordem_compra_id;
 UPDATE public.orcamentos SET entrega_rastreavel=p_rastreavel,codigo_rastreio=v_code WHERE id=v_order.orcamento_id;
 RETURN v_result;
END; $$;
REVOKE ALL ON FUNCTION public.gsa_admin_ship_store_order(uuid,text,uuid,uuid,text,boolean,text) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.gsa_admin_ship_store_order(uuid,text,uuid,uuid,text,boolean,text) TO authenticated,service_role;
NOTIFY pgrst,'reload schema';
COMMIT;
