-- Service completion, invoicing and collection hardening.

CREATE UNIQUE INDEX IF NOT EXISTS faturas_one_per_service_order_uidx
  ON public.faturas(os_id)
  WHERE os_id IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS faturas_infinitepay_order_nsu_uidx
  ON public.faturas(infinitepay_order_nsu)
  WHERE infinitepay_order_nsu IS NOT NULL;

CREATE TABLE IF NOT EXISTS public.payment_webhook_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  provider text NOT NULL,
  transaction_nsu text NOT NULL,
  order_nsu text NOT NULL,
  fatura_id uuid NOT NULL REFERENCES public.faturas(id),
  paid_amount numeric NOT NULL,
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  processed_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(provider, transaction_nsu)
);
REVOKE ALL ON public.payment_webhook_events FROM anon, authenticated;

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
  IF v_fatura.status='cancelado' THEN RAISE EXCEPTION 'Fatura cancelada.'; END IF;
  IF EXISTS (SELECT 1 FROM public.payment_webhook_events WHERE provider='infinitepay' AND transaction_nsu=p_transaction_nsu) THEN
    RETURN jsonb_build_object('success',true,'already_processed',true,'fatura_id',p_fatura_id);
  END IF;
  IF v_fatura.status='pago' THEN
    RETURN jsonb_build_object('success',true,'already_processed',true,'fatura_id',p_fatura_id);
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
REVOKE ALL ON FUNCTION public.gsa_finalize_external_invoice_payment(uuid,text,text,numeric,text,jsonb) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.gsa_finalize_external_invoice_payment(uuid,text,text,numeric,text,jsonb) TO service_role;

CREATE OR REPLACE FUNCTION public.gsa_validate_service_invoice_link()
RETURNS trigger LANGUAGE plpgsql SET search_path=public AS $$
DECLARE v_os public.ordens_servico%rowtype;
BEGIN
  IF NEW.os_id IS NULL THEN RETURN NEW; END IF;
  SELECT * INTO v_os FROM public.ordens_servico WHERE id=NEW.os_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Ordem de servico vinculada nao encontrada.'; END IF;
  IF NEW.cliente_id IS DISTINCT FROM v_os.cliente_id THEN
    RAISE EXCEPTION 'A fatura e a ordem de servico devem pertencer ao mesmo cliente.';
  END IF;
  IF v_os.status NOT IN ('andamento','concluido') THEN
    RAISE EXCEPTION 'A ordem de servico nao esta apta para faturamento.';
  END IF;
  RETURN NEW;
END; $$;
DROP TRIGGER IF EXISTS trg_validate_service_invoice_link ON public.faturas;
CREATE TRIGGER trg_validate_service_invoice_link
BEFORE INSERT OR UPDATE OF os_id,cliente_id ON public.faturas
FOR EACH ROW EXECUTE FUNCTION public.gsa_validate_service_invoice_link();

CREATE OR REPLACE FUNCTION public.gsa_admin_concluir_os_e_faturar(
  p_sessao_id uuid,
  p_session_token text,
  p_os_id uuid,
  p_data_vencimento date DEFAULT (current_date + 5),
  p_observacao text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_actor record;
  v_os public.ordens_servico%rowtype;
  v_orc public.orcamentos%rowtype;
  v_fatura public.faturas%rowtype;
  v_codigo text;
  v_descricao text;
BEGIN
  SELECT * INTO v_actor
  FROM public.gsa_admin_session_actor(p_sessao_id, p_session_token)
  LIMIT 1;

  SELECT * INTO v_os
  FROM public.ordens_servico
  WHERE id = p_os_id
  FOR UPDATE;

  IF NOT FOUND THEN RAISE EXCEPTION 'Ordem de servico nao encontrada.'; END IF;
  IF v_os.status = 'cancelado' THEN RAISE EXCEPTION 'Ordem de servico cancelada nao pode ser faturada.'; END IF;

  SELECT * INTO v_fatura
  FROM public.faturas
  WHERE os_id = v_os.id
  LIMIT 1
  FOR UPDATE;

  IF FOUND THEN
    IF v_os.status <> 'concluido' THEN
      UPDATE public.ordens_servico SET status='concluido', data_fim=coalesce(data_fim, now()) WHERE id=v_os.id;
    END IF;
    RETURN jsonb_build_object('success', true, 'already_processed', true,
      'os_id', v_os.id, 'codigo_os', v_os.codigo_os,
      'fatura_id', v_fatura.id, 'codigo_fatura', v_fatura.codigo_fatura,
      'valor_total', v_fatura.valor_total, 'data_vencimento', v_fatura.data_vencimento);
  END IF;

  IF v_os.status <> 'andamento' THEN
    RAISE EXCEPTION 'Somente uma ordem em andamento pode ser concluida e faturada.';
  END IF;
  IF p_data_vencimento IS NULL OR p_data_vencimento < current_date THEN
    RAISE EXCEPTION 'A data de vencimento nao pode estar no passado.';
  END IF;

  SELECT * INTO v_orc FROM public.orcamentos WHERE id=v_os.orcamento_id FOR SHARE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Orcamento vinculado nao encontrado.'; END IF;
  IF v_orc.cliente_id IS DISTINCT FROM v_os.cliente_id THEN
    RAISE EXCEPTION 'Cliente da ordem diverge do cliente do orcamento.';
  END IF;
  IF round(coalesce(v_orc.total,0),2) <= 0 THEN
    RAISE EXCEPTION 'O valor aprovado do servico deve ser maior que zero.';
  END IF;

  v_codigo := public.gsa_generate_code('FAT');
  v_descricao := coalesce(nullif(trim(p_observacao),''),
    'Servico concluido - OS ' || coalesce(v_os.codigo_os, v_os.id::text));

  INSERT INTO public.faturas(
    codigo_fatura, cliente_id, os_id, orcamento_id,
    valor_total, valor_final_pendente, valor_base_original,
    data_emissao, data_vencimento, status, tipo, observacoes,
    gerada_automaticamente, itens_faturados
  ) VALUES (
    v_codigo, v_os.cliente_id, v_os.id, v_os.orcamento_id,
    round(v_orc.total,2), round(v_orc.total,2), round(v_orc.total,2),
    current_date, p_data_vencimento, 'pendente', 'servico', v_descricao,
    true, jsonb_build_array(jsonb_build_object(
      'id', replace(gen_random_uuid()::text,'-',''),
      'descricao', coalesce(nullif(v_orc.titulo_solicitacao,''), v_descricao),
      'quantidade', 1, 'valor_unitario', round(v_orc.total,2),
      'subtotal', round(v_orc.total,2), 'tipo', 'servico', 'data_criacao', now()
    ))
  ) RETURNING * INTO v_fatura;

  UPDATE public.ordens_servico
  SET status='concluido', data_fim=now()
  WHERE id=v_os.id;

  UPDATE public.prestador_demandas
  SET status = CASE WHEN status IN ('concluida','finalizada','cancelada','concluida_interna') THEN status ELSE 'finalizada' END
  WHERE os_id=v_os.id;

  RETURN jsonb_build_object('success', true, 'already_processed', false,
    'os_id', v_os.id, 'codigo_os', v_os.codigo_os,
    'fatura_id', v_fatura.id, 'codigo_fatura', v_fatura.codigo_fatura,
    'valor_total', v_fatura.valor_total, 'data_vencimento', v_fatura.data_vencimento,
    'ator_nome', v_actor.ator_nome);
END;
$$;

CREATE OR REPLACE FUNCTION public.gsa_admin_cancelar_os(
  p_sessao_id uuid, p_session_token text, p_os_id uuid, p_motivo text
)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE v_actor record; v_os public.ordens_servico%rowtype;
BEGIN
  IF nullif(trim(coalesce(p_motivo,'')),'') IS NULL THEN RAISE EXCEPTION 'Motivo obrigatorio.'; END IF;
  SELECT * INTO v_actor FROM public.gsa_admin_session_actor(p_sessao_id,p_session_token) LIMIT 1;
  SELECT * INTO v_os FROM public.ordens_servico WHERE id=p_os_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Ordem de servico nao encontrada.'; END IF;
  IF EXISTS (SELECT 1 FROM public.faturas WHERE os_id=p_os_id AND status='pago') THEN
    RAISE EXCEPTION 'Ordem com fatura paga exige fluxo financeiro de estorno.';
  END IF;
  IF v_os.status='cancelado' THEN RETURN jsonb_build_object('success',true,'already_processed',true); END IF;
  UPDATE public.ordens_servico SET status='cancelado',motivo_cancelamento=trim(p_motivo),data_fim=now() WHERE id=p_os_id;
  UPDATE public.faturas SET status='cancelado',motivo_cancelamento='OS cancelada: '||trim(p_motivo),data_cancelamento=now()
    WHERE os_id=p_os_id AND status<>'pago';
  RETURN jsonb_build_object('success',true,'already_processed',false,'os_id',p_os_id,'ator_nome',v_actor.ator_nome);
END; $$;

-- Direct browser mutation is no longer allowed for service orders.
REVOKE INSERT, UPDATE, DELETE, TRUNCATE ON public.ordens_servico FROM anon, authenticated;
DROP POLICY IF EXISTS "Acesso total" ON public.ordens_servico;
DROP POLICY IF EXISTS ordens_servico_public_read ON public.ordens_servico;
CREATE POLICY ordens_servico_public_read ON public.ordens_servico FOR SELECT TO anon, authenticated USING (true);

-- Destructive invoice operations must only happen through protected functions.
REVOKE DELETE, TRUNCATE ON public.faturas FROM anon, authenticated;

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
END; $$;
GRANT EXECUTE ON FUNCTION public.gsa_client_sync_pix_invoice(uuid,text,uuid,text,text,jsonb) TO anon,authenticated;

DROP POLICY IF EXISTS "Acesso total" ON public.faturas;
DROP POLICY IF EXISTS faturas_public_read ON public.faturas;
CREATE POLICY faturas_public_read ON public.faturas FOR SELECT TO anon,authenticated USING (true);
REVOKE INSERT,UPDATE,DELETE,TRUNCATE,REFERENCES,TRIGGER ON public.faturas FROM anon,authenticated;
REVOKE INSERT,UPDATE,DELETE,TRUNCATE,REFERENCES,TRIGGER ON public.ordens_servico FROM anon,authenticated;
GRANT SELECT ON public.faturas,public.ordens_servico TO anon,authenticated;

GRANT EXECUTE ON FUNCTION public.gsa_admin_concluir_os_e_faturar(uuid,text,uuid,date,text) TO anon,authenticated;
GRANT EXECUTE ON FUNCTION public.gsa_admin_cancelar_os(uuid,text,uuid,text) TO anon,authenticated;

CREATE OR REPLACE FUNCTION public.gsa_admin_enviar_fatura_cobranca(
  p_sessao_id uuid, p_session_token text, p_fatura_id uuid
)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE v_actor record; v_fatura public.faturas%rowtype; v_cobranca_id uuid;
BEGIN
  SELECT * INTO v_actor FROM public.gsa_admin_session_actor(p_sessao_id,p_session_token) LIMIT 1;
  SELECT * INTO v_fatura FROM public.faturas WHERE id=p_fatura_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Fatura nao encontrada.'; END IF;
  IF v_fatura.status NOT IN ('pendente','vencida','revisada','pendente_pagamento') THEN
    RAISE EXCEPTION 'Somente fatura pendente ou vencida pode ser enviada para cobranca.';
  END IF;
  SELECT id INTO v_cobranca_id FROM public.cobrancas WHERE fatura_id=p_fatura_id LIMIT 1 FOR UPDATE;
  IF v_cobranca_id IS NOT NULL THEN
    RETURN jsonb_build_object('success',true,'already_exists',true,'cobranca_id',v_cobranca_id,'fatura_id',p_fatura_id);
  END IF;
  INSERT INTO public.cobrancas(fatura_id,cliente_id,valor_original,valor_atualizado,valor_pago,dias_atraso,score_risco,status,nivel_cobranca)
  VALUES(p_fatura_id,v_fatura.cliente_id,coalesce(v_fatura.valor_final_pendente,v_fatura.valor_total,0),
    coalesce(v_fatura.valor_final_pendente,v_fatura.valor_total,0),0,
    greatest(current_date-coalesce(v_fatura.data_vencimento,current_date),0),15,'pendente',1)
  RETURNING id INTO v_cobranca_id;
  RETURN jsonb_build_object('success',true,'already_exists',false,'cobranca_id',v_cobranca_id,'fatura_id',p_fatura_id,'ator_nome',v_actor.ator_nome);
END; $$;
GRANT EXECUTE ON FUNCTION public.gsa_admin_enviar_fatura_cobranca(uuid,text,uuid) TO anon,authenticated;
