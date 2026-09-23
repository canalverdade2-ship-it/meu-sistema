-- Reconciliation for historical duplicate version 20260922115000.
-- Read-only audit run 35804719264 proved the version is not registered on
-- either known target. The self-hosted target has the shipping contract but
-- not the checkout-claim contract, so both intended contracts are restated
-- under one unique migration version.
BEGIN;

ALTER TABLE public.ordens_compra ADD COLUMN IF NOT EXISTS entrega_rastreavel boolean;
ALTER TABLE public.ordens_compra ADD COLUMN IF NOT EXISTS codigo_rastreio text;
ALTER TABLE public.orcamentos ADD COLUMN IF NOT EXISTS entrega_rastreavel boolean;
ALTER TABLE public.orcamentos ADD COLUMN IF NOT EXISTS codigo_rastreio text;

CREATE OR REPLACE FUNCTION public.gsa_client_claim_invoice_generation(
  p_sessao_id uuid, p_session_token text, p_orcamento_id uuid
)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE
  v_actor record;
  v_orc public.orcamentos%rowtype;
  v_fatura public.faturas%rowtype;
  v_codigo text;
BEGIN
  SELECT * INTO v_actor FROM public.gsa_client_session_actor(p_sessao_id,p_session_token) LIMIT 1;
  IF NOT FOUND THEN RAISE EXCEPTION 'Sessao invalida.'; END IF;

  SELECT * INTO v_orc FROM public.orcamentos WHERE id=p_orcamento_id AND cliente_id=v_actor.cliente_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Orcamento nao encontrado para este cliente.'; END IF;
  IF round(coalesce(v_orc.total,0),2)<=0 THEN RAISE EXCEPTION 'Valor do orcamento invalido.'; END IF;

  SELECT * INTO v_fatura FROM public.faturas WHERE orcamento_id=p_orcamento_id AND status NOT IN ('cancelado', 'pago')
    ORDER BY created_at DESC NULLS LAST LIMIT 1;

  IF FOUND THEN
    IF v_fatura.infinitepay_link IS NOT NULL THEN
      RETURN jsonb_build_object('success',true,'already_generated',true,'fatura_id',v_fatura.id,
        'link',v_fatura.infinitepay_link,'order_nsu',v_fatura.infinitepay_order_nsu,'total',v_fatura.valor_total);
    ELSE
      IF extract(epoch from (now() - v_fatura.created_at)) < 120 THEN
        RETURN jsonb_build_object('success',true,'already_generated',false,'fatura_id',v_fatura.id,'total',v_fatura.valor_total);
      END IF;
    END IF;
  END IF;

  IF v_fatura.id IS NULL THEN
    v_codigo:=public.gsa_generate_code('FAT');
    INSERT INTO public.faturas(codigo_fatura,cliente_id,orcamento_id,valor_total,valor_final_pendente,valor_base_original,
      status,tipo,data_vencimento,data_emissao,gerada_automaticamente,observacoes)
    VALUES(v_codigo,v_actor.cliente_id,p_orcamento_id,round(v_orc.total,2),round(v_orc.total,2),round(v_orc.total,2),
      'pendente_geracao','produto',current_date+3,current_date,true,
      'Pedido Loja GSA #'||coalesce(v_orc.codigo_orcamento,p_orcamento_id::text)) RETURNING * INTO v_fatura;
  ELSE
    UPDATE public.faturas SET created_at=now() WHERE id=v_fatura.id;
  END IF;

  RETURN jsonb_build_object('success',true,'already_generated',false,'fatura_id',v_fatura.id,'total',v_fatura.valor_total);
END;
$$;

CREATE OR REPLACE FUNCTION public.gsa_client_sync_pix_invoice(
  p_sessao_id uuid, p_session_token text, p_orcamento_id uuid,
  p_checkout_link text, p_order_nsu text, p_itens jsonb DEFAULT '[]'::jsonb
)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE v_actor record; v_orc public.orcamentos%rowtype; v_fatura public.faturas%rowtype; v_codigo text;
BEGIN
  SELECT * INTO v_actor FROM public.gsa_client_session_actor(p_sessao_id,p_session_token) LIMIT 1;
  SELECT * INTO v_orc FROM public.orcamentos WHERE id=p_orcamento_id AND cliente_id=v_actor.cliente_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Orcamento nao encontrado para este cliente.'; END IF;
  IF round(coalesce(v_orc.total,0),2)<=0 THEN RAISE EXCEPTION 'Valor do orcamento invalido.'; END IF;
  SELECT * INTO v_fatura FROM public.faturas WHERE orcamento_id=p_orcamento_id AND status<>'cancelado'
    ORDER BY created_at DESC NULLS LAST LIMIT 1 FOR UPDATE;
  IF FOUND THEN
    UPDATE public.faturas SET
      infinitepay_link=nullif(trim(p_checkout_link),''),
      infinitepay_order_nsu=nullif(trim(p_order_nsu),''),
      forma_pagamento_escolhida='pix',
      status=CASE WHEN status='pendente_geracao' THEN 'pendente' ELSE status END,
      itens_faturados=CASE WHEN jsonb_array_length(coalesce(itens_faturados,'[]'::jsonb))=0 THEN coalesce(p_itens,'[]'::jsonb) ELSE itens_faturados END
    WHERE id=v_fatura.id RETURNING * INTO v_fatura;
  ELSE
    v_codigo:=public.gsa_generate_code('FAT');
    INSERT INTO public.faturas(codigo_fatura,cliente_id,orcamento_id,valor_total,valor_final_pendente,valor_base_original,
      status,tipo,forma_pagamento_escolhida,infinitepay_link,infinitepay_order_nsu,data_vencimento,data_emissao,gerada_automaticamente,observacoes,itens_faturados,
      desconto_promocional_aplicado,desconto_voucher_aplicado,desconto_pontos_aplicado,abatimento_carteira_aplicado)
    VALUES(v_codigo,v_actor.cliente_id,p_orcamento_id,round(v_orc.total,2),round(v_orc.total,2),round(v_orc.total,2),
      'pendente','produto','pix',nullif(trim(p_checkout_link),''),nullif(trim(p_order_nsu),''),current_date+3,current_date,true,
      'Pedido Loja GSA #'||coalesce(v_orc.codigo_orcamento,p_orcamento_id::text),coalesce(p_itens,'[]'::jsonb),
      coalesce(v_orc.desconto_promocional,v_orc.desconto_produtos,0),coalesce(v_orc.desconto_cupom,0),coalesce(v_orc.desconto_pontos,0),coalesce(v_orc.abatimento_carteira,0)) RETURNING * INTO v_fatura;
  END IF;
  RETURN jsonb_build_object('success',true,'fatura_id',v_fatura.id,'codigo_fatura',v_fatura.codigo_fatura);
END;
$$;

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
 IF p_rastreavel THEN
 INSERT INTO public.notificacoes(cliente_id,destinatario_tipo,titulo,mensagem,modulo,item_id,tipo,acao_origem,contexto,lida,data_criacao)
 VALUES(v_order.cliente_id,'cliente','Seu pedido está em transporte',
 'A entrega ' || coalesce(v_order.codigo_ordem,v_order.id::text) || ' é rastreável. Código: ' || v_code || '. Consulte este código no site da transportadora.',
 'produtos',v_order.orcamento_id::text,'sistema','pedido_rastreio_disponivel',
 jsonb_build_object('ordem_compra_id',v_order.id,'orcamento_id',v_order.orcamento_id,'codigo_rastreio',v_code),false,now());
 END IF;
 RETURN v_result;
END;
$$;

REVOKE ALL ON FUNCTION public.gsa_admin_ship_store_order(uuid,text,uuid,uuid,text,boolean,text) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.gsa_admin_ship_store_order(uuid,text,uuid,uuid,text,boolean,text) TO authenticated,service_role;

NOTIFY pgrst,'reload schema';
COMMIT;
