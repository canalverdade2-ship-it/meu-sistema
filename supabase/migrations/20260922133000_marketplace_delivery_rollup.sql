BEGIN;
CREATE OR REPLACE FUNCTION public.gsa_store_delivery_rollup(p_order uuid)
RETURNS text LANGUAGE sql VOLATILE SECURITY DEFINER SET search_path=public,pg_temp
AS $$
 SELECT CASE
  WHEN count(*)=0 THEN 'cancelado'
  WHEN bool_and(status='concluido') THEN 'concluido'
  WHEN bool_and(status IN ('em_transporte','concluido')) THEN 'em_transporte'
  WHEN bool_and(status IN ('em_expedicao','em_transporte','concluido')) THEN 'em_expedicao'
  WHEN bool_and(status IN ('aprovado','pago','em_expedicao','em_transporte','concluido')) THEN 'aprovado'
  ELSE 'em_analise' END
 FROM public.ordens_compra WHERE orcamento_id=p_order AND status<>'cancelado';
$$;
REVOKE ALL ON FUNCTION public.gsa_store_delivery_rollup(uuid) FROM PUBLIC,anon,authenticated;
DO $$ DECLARE v_source text; v_old text; BEGIN
 v_source:=pg_get_functiondef('public.gsa_admin_transition_store_order(uuid,text,uuid,uuid,text)'::regprocedure);
 v_old:=E'UPDATE public.orcamentos\n    SET status = p_novo_status,';
 IF position(v_old IN v_source)=0 THEN RAISE EXCEPTION 'Transition function changed; manual review required'; END IF;
 v_source:=replace(v_source,v_old,E'UPDATE public.orcamentos\n    SET status = public.gsa_store_delivery_rollup(v_ordem.orcamento_id),');
 v_source:=replace(v_source,'status_entrega = CASE p_novo_status','status_entrega = CASE public.gsa_store_delivery_rollup(v_ordem.orcamento_id)');
 v_source:=replace(v_source,'data_entrega = CASE WHEN p_novo_status = ''concluido''','data_entrega = CASE WHEN public.gsa_store_delivery_rollup(v_ordem.orcamento_id) = ''concluido''');
 EXECUTE v_source;
 v_source:=pg_get_functiondef('public.gsa_admin_ship_store_order(uuid,text,uuid,uuid,text,boolean,text)'::regprocedure);
 v_old:='UPDATE public.orcamentos SET entrega_rastreavel=p_rastreavel,codigo_rastreio=v_code WHERE id=v_order.orcamento_id;';
 IF position(v_old IN v_source)=0 THEN RAISE EXCEPTION 'Shipping function changed; manual review required'; END IF;
 v_source:=replace(v_source,v_old,'UPDATE public.orcamentos SET entrega_rastreavel=NULL,codigo_rastreio=NULL WHERE id=v_order.orcamento_id;');
 EXECUTE v_source;
END $$;
COMMIT;
