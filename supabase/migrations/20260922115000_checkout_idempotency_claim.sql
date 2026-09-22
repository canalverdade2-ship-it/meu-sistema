-- Nova migration para idempotência segura na geração de link

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
  
  -- Verificar se já existe fatura
  SELECT * INTO v_fatura FROM public.faturas WHERE orcamento_id=p_orcamento_id AND status NOT IN ('cancelado', 'pago')
    ORDER BY created_at DESC NULLS LAST LIMIT 1;
    
  IF FOUND THEN
    IF v_fatura.infinitepay_link IS NOT NULL THEN
      RETURN jsonb_build_object('success',true,'already_generated',true,'fatura_id',v_fatura.id,
        'link',v_fatura.infinitepay_link,'order_nsu',v_fatura.infinitepay_order_nsu,'total',v_fatura.valor_total);
    ELSE
      -- Já foi claimada, mas ainda sem link. 
      -- Se a geração demorar mais que 2 minutos, assumimos que a Edge Function falhou (PROVIDER LINK ORPHAN RISK).
      -- Nesse caso, permitimos uma nova tentativa.
      IF extract(epoch from (now() - v_fatura.created_at)) < 120 THEN
        RETURN jsonb_build_object('success',true,'already_generated',false,'fatura_id',v_fatura.id,'total',v_fatura.valor_total);
      END IF;
      -- Passou do timeout. Reutilizamos a mesma fatura para tentar novamente.
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
END; $$;

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
END; $$;

