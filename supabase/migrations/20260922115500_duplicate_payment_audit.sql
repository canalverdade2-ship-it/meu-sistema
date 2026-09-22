-- Migration para tratar Duplicidade de Pagamentos Reais (Links Orfaos / Múltiplos Checkouts Pagos)

CREATE OR REPLACE FUNCTION public.gsa_finalize_external_invoice_payment(
  p_fatura_id uuid, p_order_nsu text, p_transaction_nsu text,
  p_paid_amount numeric, p_capture_method text, p_payload jsonb DEFAULT '{}'::jsonb
)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE v_fatura public.faturas%rowtype; v_pending numeric; v_event_id uuid; v_final jsonb;
BEGIN
  IF current_user NOT IN ('postgres','service_role','supabase_admin') THEN
    RAISE EXCEPTION 'Operacao exclusiva do processador de pagamentos.';
  END IF;
  IF nullif(trim(coalesce(p_transaction_nsu,'')),'') IS NULL THEN RAISE EXCEPTION 'Transacao sem identificador.'; END IF;
  SELECT * INTO v_fatura FROM public.faturas WHERE id=p_fatura_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Fatura nao encontrada.'; END IF;
  IF v_fatura.infinitepay_order_nsu IS DISTINCT FROM p_order_nsu THEN RAISE EXCEPTION 'Referencia de pagamento divergente.'; END IF;
  
  IF EXISTS (SELECT 1 FROM public.payment_webhook_events WHERE provider='infinitepay' AND transaction_nsu=p_transaction_nsu) THEN
    RETURN jsonb_build_object('success',true,'already_processed',true,'fatura_id',p_fatura_id);
  END IF;

  IF v_fatura.status='cancelado' THEN 
    -- PAYMENT AFTER CANCELLATION: Registrar o evento mas manter a fatura cancelada
    INSERT INTO public.payment_webhook_events(provider,transaction_nsu,order_nsu,fatura_id,paid_amount,payload)
    VALUES('infinitepay',trim(p_transaction_nsu),p_order_nsu,p_fatura_id,p_paid_amount,jsonb_build_object('inconsistency', 'PAYMENT_AFTER_CANCELLATION', 'original_payload', coalesce(p_payload,'{}'::jsonb))) RETURNING id INTO v_event_id;
    
    -- Inserir pagamento com status 'inconsistente'
    INSERT INTO public.pagamentos(fatura_id,cliente_id,valor,metodo,status,data_pagamento,observacoes)
    VALUES(p_fatura_id,v_fatura.cliente_id,p_paid_amount,coalesce(nullif(trim(p_capture_method),''),'infinitepay'),'inconsistente',now(),'PAYMENT_AFTER_CANCELLATION');

    RETURN jsonb_build_object('success',false,'error','PAYMENT_AFTER_CANCELLATION','fatura_id',p_fatura_id,'event_id',v_event_id);
  END IF;

  IF v_fatura.status='pago' THEN
    -- DUPLICATE_PAYMENT_FOR_ORDER: Fatura já liquidada, mas recebemos outra transação real.
    -- Registrar o evento e criar pagamento inconsistente/requer reembolso.
    INSERT INTO public.payment_webhook_events(provider,transaction_nsu,order_nsu,fatura_id,paid_amount,payload)
    VALUES('infinitepay',trim(p_transaction_nsu),p_order_nsu,p_fatura_id,p_paid_amount,jsonb_build_object('inconsistency', 'DUPLICATE_PAYMENT_FOR_ORDER', 'original_payload', coalesce(p_payload,'{}'::jsonb))) RETURNING id INTO v_event_id;
    
    INSERT INTO public.pagamentos(fatura_id,cliente_id,valor,metodo,status,data_pagamento,observacoes)
    VALUES(p_fatura_id,v_fatura.cliente_id,p_paid_amount,coalesce(nullif(trim(p_capture_method),''),'infinitepay'),'refund_required',now(),'DUPLICATE_PAYMENT_FOR_ORDER');

    RETURN jsonb_build_object('success',true,'already_processed',false,'inconsistency','DUPLICATE_PAYMENT_FOR_ORDER','fatura_id',p_fatura_id,'event_id',v_event_id);
  END IF;
  
  v_pending := round(coalesce(v_fatura.valor_final_pendente,v_fatura.valor_total,0),2);
  IF round(coalesce(p_paid_amount,0),2) <> v_pending THEN
    RAISE EXCEPTION 'Valor confirmado diverge do valor pendente da fatura.';
  END IF;
  
  INSERT INTO public.payment_webhook_events(provider,transaction_nsu,order_nsu,fatura_id,paid_amount,payload)
  VALUES('infinitepay',trim(p_transaction_nsu),p_order_nsu,p_fatura_id,v_pending,coalesce(p_payload,'{}'::jsonb)) RETURNING id INTO v_event_id;
  
  INSERT INTO public.pagamentos(fatura_id,cliente_id,valor,metodo,status,data_pagamento)
  VALUES(p_fatura_id,v_fatura.cliente_id,v_pending,coalesce(nullif(trim(p_capture_method),''),'infinitepay'),'pago',now());
  
  UPDATE public.faturas SET status='pago',valor_pago=round(coalesce(valor_pago,0)+v_pending,2),
    valor_final_pendente=0,data_pagamento=now(),forma_pagamento_escolhida=coalesce(nullif(trim(p_capture_method),''),'infinitepay')
  WHERE id=p_fatura_id;
  
  v_final := public.gsa_finalize_paid_invoice_internal(p_fatura_id,v_pending);
  
  RETURN jsonb_build_object('success',true,'already_processed',false,'fatura_id',p_fatura_id,'event_id',v_event_id,'finalization',v_final);
END; $$;
