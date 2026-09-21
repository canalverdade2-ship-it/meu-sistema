BEGIN;

CREATE OR REPLACE FUNCTION public.gsa_client_request_transfer(
  p_sessao_id uuid, p_session_token text, p_request_id uuid,
  p_destino_id uuid, p_tipo text, p_valor numeric, p_motivo text
)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE
  v_actor record; v_origin public.clientes%rowtype; v_destination public.clientes%rowtype;
  v_type text:=lower(trim(coalesce(p_tipo,''))); v_value numeric:=round(coalesce(p_valor,0),2);
  v_reason text:=left(trim(coalesce(p_motivo,'')),500); v_fee_percent numeric:=0;
  v_fee_value numeric:=0; v_net numeric:=0; v_origin_after numeric; v_destination_after numeric;
  v_transfer_id uuid; v_result jsonb; v_inserted uuid;
BEGIN
  PERFORM set_config('gsa.credit_release','on',true);
  PERFORM set_config('my.app.bypass_saldo_check','on',true);
  PERFORM set_config('gsa.system_override','on',true);
  IF p_request_id IS NULL THEN RAISE EXCEPTION 'Identificador da operação obrigatório.'; END IF;
  IF p_destino_id IS NULL OR v_type NOT IN ('saldo','pontos') OR v_value<=0 OR length(v_reason)<3 THEN
    RAISE EXCEPTION 'Dados inválidos para transferência.';
  END IF;
  IF v_type='pontos' AND v_value<>trunc(v_value) THEN RAISE EXCEPTION 'A transferência de pontos deve usar valor inteiro.'; END IF;
  SELECT * INTO v_actor FROM public.gsa_client_session_actor(p_sessao_id,p_session_token) LIMIT 1;
  IF p_destino_id=v_actor.cliente_id THEN RAISE EXCEPTION 'Não é possível transferir para a própria conta.'; END IF;

  INSERT INTO public.gsa_client_operation_requests(request_id,cliente_id,operacao)
  VALUES(p_request_id,v_actor.cliente_id,'solicitar_transferencia')
  ON CONFLICT(request_id) DO NOTHING RETURNING request_id INTO v_inserted;
  IF v_inserted IS NULL THEN
    SELECT resultado INTO v_result FROM public.gsa_client_operation_requests
    WHERE request_id=p_request_id AND cliente_id=v_actor.cliente_id AND operacao='solicitar_transferencia';
    IF NOT FOUND THEN RAISE EXCEPTION 'Identificador da operação já utilizado.'; END IF;
    IF v_result IS NULL THEN RAISE EXCEPTION 'Operação ainda em processamento.'; END IF;
    RETURN v_result || jsonb_build_object('already_exists',true);
  END IF;

  PERFORM 1 FROM public.clientes WHERE id IN(v_actor.cliente_id,p_destino_id) ORDER BY id FOR UPDATE;
  SELECT * INTO v_origin FROM public.clientes WHERE id=v_actor.cliente_id;
  SELECT * INTO v_destination FROM public.clientes WHERE id=p_destino_id;
  IF v_destination.id IS NULL OR v_destination.status<>'ativo' THEN RAISE EXCEPTION 'Destinatário indisponível.'; END IF;
  IF v_type='saldo' AND coalesce(v_origin.carteira_bloqueada,false) THEN RAISE EXCEPTION 'A carteira está bloqueada.'; END IF;
  IF v_type='pontos' AND coalesce(v_origin.pontos_bloqueados,false) THEN RAISE EXCEPTION 'A carteira de pontos está bloqueada.'; END IF;
  IF v_type='saldo' AND coalesce(v_origin.saldo_carteira,0)<v_value THEN RAISE EXCEPTION 'Saldo insuficiente.'; END IF;
  IF v_type='pontos' AND coalesce(v_origin.saldo_pontos,0)<v_value THEN RAISE EXCEPTION 'Saldo de pontos insuficiente.'; END IF;

  SELECT least(greatest(coalesce(taxa_saque_transferencia,0),0),100) INTO v_fee_percent
  FROM public.client_levels WHERE id=coalesce(v_origin.nivel_manual_id,v_origin.nivel_id) LIMIT 1;
  v_fee_percent:=coalesce(v_fee_percent,0);
  v_fee_value:=CASE WHEN v_type='saldo' THEN round(v_value*v_fee_percent/100,2) ELSE floor(v_value*v_fee_percent/100) END;
  v_net:=v_value-v_fee_value;
  IF v_net<=0 THEN RAISE EXCEPTION 'O valor líquido da transferência deve ser positivo.'; END IF;

  IF v_type='saldo' THEN
    v_origin_after:=round(coalesce(v_origin.saldo_carteira,0)-v_value,2);
    v_destination_after:=round(coalesce(v_destination.saldo_carteira,0)+v_net,2);
    UPDATE public.clientes SET saldo_carteira=v_origin_after WHERE id=v_origin.id;
    UPDATE public.clientes SET saldo_carteira=v_destination_after WHERE id=v_destination.id;
  ELSE
    v_origin_after:=coalesce(v_origin.saldo_pontos,0)-v_value;
    v_destination_after:=coalesce(v_destination.saldo_pontos,0)+v_net;
    UPDATE public.clientes SET saldo_pontos=v_origin_after::integer WHERE id=v_origin.id;
    UPDATE public.clientes SET saldo_pontos=v_destination_after::integer WHERE id=v_destination.id;
  END IF;

  INSERT INTO public.transferencias(request_id,cliente_origem_id,cliente_destino_id,tipo,valor,taxa_aplicada,valor_liquido,motivo,status,data_solicitacao,data_pagamento)
  VALUES(p_request_id,v_origin.id,v_destination.id,v_type,v_value,v_fee_value,v_net,v_reason,'concluido',now(),current_date)
  RETURNING id INTO v_transfer_id;

  IF v_type='saldo' THEN
    INSERT INTO public.carteira_lancamentos(cliente_id,valor,tipo,descricao) VALUES
      (v_origin.id,v_value,'debito','Transferência instantânea enviada para '||v_destination.nome),
      (v_destination.id,v_net,'credito','Transferência instantânea recebida de '||v_origin.nome);
    INSERT INTO public.extrato_financeiro(cliente_id,tipo,valor,descricao,referencia_id,modulo_referencia,saldo_resultante) VALUES
      (v_origin.id,'saida',v_value,format('Transferência enviada para %s (taxa: %s%%)',v_destination.nome,v_fee_percent),v_transfer_id,'transferencia',v_origin_after),
      (v_destination.id,'entrada',v_net,'Transferência recebida de '||v_origin.nome,v_transfer_id,'transferencia',v_destination_after);
  ELSE
    INSERT INTO public.pontos_movimentacoes(cliente_id,tipo,pontos,saldo_apos,descricao) VALUES
      (v_origin.id,'resgate',-v_value::integer,v_origin_after::integer,'Transferência de pontos enviada para '||v_destination.nome),
      (v_destination.id,'transferencia_recebida',v_net::integer,v_destination_after::integer,'Transferência de pontos recebida de '||v_origin.nome);
    INSERT INTO public.points_transactions(cliente_id,tipo,pontos,descricao) VALUES
      (v_origin.id,'transferencia_enviada',-v_value::integer,'Transferência de pontos enviada para '||v_destination.nome),
      (v_destination.id,'transferencia_recebida',v_net::integer,'Transferência de pontos recebida de '||v_origin.nome);
  END IF;

  v_result:=jsonb_build_object('success',true,'already_exists',false,'status','concluido','transferencia_id',v_transfer_id,'saldo_resultante',v_origin_after,'taxa_aplicada',v_fee_value,'taxa_percentual',v_fee_percent,'valor_liquido',v_net);
  UPDATE public.gsa_client_operation_requests SET resultado=v_result,completed_at=now() WHERE request_id=p_request_id;
  INSERT INTO public.notificacoes(cliente_id,titulo,mensagem,modulo,tab,item_id,destinatario_tipo,acao_origem,contexto) VALUES
    (v_origin.id,'Transferência concluída',format('Sua transferência para %s foi concluída instantaneamente.',v_destination.nome),'financeiro','transferencias',v_transfer_id::text,'cliente','transferencia_instantanea',jsonb_build_object('transferencia_id',v_transfer_id)),
    (v_destination.id,'Transferência recebida',format('Você recebeu uma transferência de %s.',v_origin.nome),'financeiro','transferencias',v_transfer_id::text,'cliente','transferencia_instantanea_recebida',jsonb_build_object('transferencia_id',v_transfer_id));
  RETURN v_result;
END;
$$;

REVOKE ALL ON FUNCTION public.gsa_client_request_transfer(uuid,text,uuid,uuid,text,numeric,text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.gsa_client_request_transfer(uuid,text,uuid,uuid,text,numeric,text) TO anon,authenticated,service_role;

DO $$ BEGIN
  IF to_regprocedure('public.gsa_admin_processar_transferencia_legacy_20260829(uuid,text,uuid,text,text,date)') IS NULL THEN
    ALTER FUNCTION public.gsa_admin_processar_transferencia(uuid,text,uuid,text,text,date)
      RENAME TO gsa_admin_processar_transferencia_legacy_20260829;
  END IF;
END $$;
REVOKE ALL ON FUNCTION public.gsa_admin_processar_transferencia_legacy_20260829(uuid,text,uuid,text,text,date)
  FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.gsa_admin_processar_transferencia_legacy_20260829(uuid,text,uuid,text,text,date)
  TO service_role;

CREATE OR REPLACE FUNCTION public.gsa_admin_processar_transferencia(
  p_sessao_id uuid,p_session_token text,p_transferencia_id uuid,p_acao text,
  p_motivo text DEFAULT NULL,p_data_pagamento date DEFAULT CURRENT_DATE
)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
BEGIN
  IF lower(trim(coalesce(p_acao,'')))<>'estornar' THEN
    RAISE EXCEPTION 'Transferências entre clientes são concluídas instantaneamente e não passam por análise.' USING ERRCODE='22023';
  END IF;
  RETURN public.gsa_admin_processar_transferencia_legacy_20260829(
    p_sessao_id,p_session_token,p_transferencia_id,'estornar',p_motivo,p_data_pagamento
  );
END;
$$;
REVOKE ALL ON FUNCTION public.gsa_admin_processar_transferencia(uuid,text,uuid,text,text,date) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.gsa_admin_processar_transferencia(uuid,text,uuid,text,text,date) TO authenticated,service_role;
NOTIFY pgrst,'reload schema';
COMMIT;
