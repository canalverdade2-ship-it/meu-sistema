CREATE OR REPLACE FUNCTION public.gsa_client_sync_pix_invoice(p_sessao_id uuid, p_session_token text, p_orcamento_id uuid, p_checkout_link text, p_order_nsu text, p_itens jsonb DEFAULT '[]'::jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE v_actor record; v_orc public.orcamentos%rowtype; v_fatura public.faturas%rowtype; v_codigo text;
BEGIN
  SELECT * INTO v_actor FROM public.gsa_client_session_actor(p_sessao_id,p_session_token) LIMIT 1;
  SELECT * INTO v_orc FROM public.orcamentos WHERE id=p_orcamento_id AND cliente_id=v_actor.cliente_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Orcamento nao encontrado para este cliente.'; END IF;
  IF round(coalesce(v_orc.total,0),2)<=0 THEN RAISE EXCEPTION 'Valor do orcamento invalido.'; END IF;
  SELECT * INTO v_fatura FROM public.faturas WHERE orcamento_id=p_orcamento_id AND status<>'cancelado'
    ORDER BY created_at DESC NULLS LAST LIMIT 1 FOR UPDATE;
  IF FOUND THEN
    UPDATE public.faturas SET infinitepay_link=nullif(trim(p_checkout_link),''),infinitepay_order_nsu=nullif(trim(p_order_nsu),''),
      forma_pagamento_escolhida='pix',itens_faturados=CASE WHEN jsonb_array_length(coalesce(itens_faturados,'[]'::jsonb))=0 THEN coalesce(p_itens,'[]'::jsonb) ELSE itens_faturados END
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
END; $function$

CREATE OR REPLACE FUNCTION public.gsa_client_store_payment_quote(p_sessao_id uuid, p_session_token text, p_orcamento_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  v_actor record;
  v_order public.orcamentos%rowtype;
BEGIN
  SELECT * INTO v_actor
  FROM public.gsa_client_session_actor(p_sessao_id, p_session_token)
  LIMIT 1;

  SELECT * INTO v_order
  FROM public.orcamentos
  WHERE id = p_orcamento_id
    AND cliente_id = v_actor.cliente_id
  FOR SHARE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Pedido não encontrado para este cliente.' USING ERRCODE='P0002';
  END IF;
  IF v_order.status = 'cancelado' THEN
    RAISE EXCEPTION 'Pedido cancelado não pode gerar cobrança.' USING ERRCODE='22023';
  END IF;
  IF round(coalesce(v_order.total, 0), 2) < 0 THEN
    RAISE EXCEPTION 'Total do pedido inválido.' USING ERRCODE='22023';
  END IF;
  RETURN jsonb_build_object(
    'success', true,
    'orcamento_id', v_order.id,
    'codigo_orcamento', v_order.codigo_orcamento,
    'total', round(coalesce(v_order.total, 0), 2),
    'status', v_order.status
  );
END;
$function$

