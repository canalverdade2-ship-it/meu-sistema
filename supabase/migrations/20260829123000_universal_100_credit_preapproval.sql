BEGIN;

ALTER TABLE public.clientes
  ADD COLUMN IF NOT EXISTS credito_pre_aprovado_valor numeric(14,2) NOT NULL DEFAULT 100.00,
  ADD COLUMN IF NOT EXISTS credito_pre_aprovado_liberado_em timestamptz;

ALTER TABLE public.loja_credito_solicitacoes
  ADD COLUMN IF NOT EXISTS origem_pre_aprovado boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS prazo_analise timestamptz;

CREATE UNIQUE INDEX IF NOT EXISTS loja_credito_pre_aprovado_ativo_uidx
ON public.loja_credito_solicitacoes(cliente_id)
WHERE origem_pre_aprovado IS TRUE AND status IN ('analise','documentos_pendentes','pre_aprovado','contrato_pendente_assinatura','contrato_assinado');

CREATE OR REPLACE FUNCTION public.gsa_client_request_preapproved_credit_100(
  p_sessao_id uuid, p_session_token text
) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_actor record; v_client public.clientes%rowtype; v_request_id uuid; v_deadline timestamptz;
BEGIN
  SELECT * INTO v_actor FROM public.gsa_validate_session(p_sessao_id,p_session_token) LIMIT 1;
  IF NOT coalesce(v_actor.is_valid,false) OR v_actor.ator_tipo <> 'cliente' THEN RAISE EXCEPTION 'Sessao de cliente invalida ou expirada.'; END IF;
  SELECT * INTO v_client FROM public.clientes WHERE id=v_actor.ator_id FOR UPDATE;
  IF NOT FOUND OR v_client.status <> 'ativo' OR coalesce(v_client.cadastro_aprovado,true) IS NOT TRUE THEN RAISE EXCEPTION 'Cliente nao esta ativo.'; END IF;
  IF v_client.credito_pre_aprovado_liberado_em IS NOT NULL THEN RAISE EXCEPTION 'O credito pre-aprovado de R$ 100,00 ja foi liberado para esta conta.'; END IF;
  SELECT id INTO v_request_id FROM public.loja_credito_solicitacoes
   WHERE cliente_id=v_client.id AND origem_pre_aprovado IS TRUE
     AND status IN ('analise','documentos_pendentes','pre_aprovado','contrato_pendente_assinatura','contrato_assinado')
   ORDER BY created_at DESC LIMIT 1;
  IF v_request_id IS NOT NULL THEN
    RETURN jsonb_build_object('success',true,'already_pending',true,'solicitacao_id',v_request_id);
  END IF;
  v_deadline:=now()+interval '72 hours';
  INSERT INTO public.loja_credito_solicitacoes(cliente_id,tipo_solicitacao,status,limite_solicitado,limite_aprovado,origem_pre_aprovado,prazo_analise)
  VALUES(v_client.id,'adesao','analise',100,0,true,v_deadline) RETURNING id INTO v_request_id;
  INSERT INTO public.notificacoes(cliente_id,titulo,mensagem,modulo,tipo,destinatario_tipo,prioridade,acao_origem,contexto)
  VALUES(v_client.id,'Credito pre-aprovado solicitado','Sua solicitacao de liberacao de R$ 100,00 entrou em analise por ate 72 horas.','credito_loja','sistema','cliente','normal','sistema',jsonb_build_object('solicitacao_id',v_request_id,'prazo_analise',v_deadline));
  INSERT INTO public.notificacoes(titulo,mensagem,modulo,tab,item_id,tipo,destinatario_tipo,prioridade,acao_origem,contexto)
  VALUES('Liberacao de credito pre-aprovado','Cliente '||v_client.nome||' solicitou a liberacao dos R$ 100,00 pre-aprovados. Prazo de analise: 72 horas.','credito_loja','solicitacoes',v_request_id::text,'sistema','admin','alta','cadastro_novo_cliente',jsonb_build_object('cliente_id',v_client.id,'solicitacao_id',v_request_id,'prazo_analise',v_deadline));
  RETURN jsonb_build_object('success',true,'already_pending',false,'solicitacao_id',v_request_id,'prazo_analise',v_deadline);
END;
$$;
REVOKE ALL ON FUNCTION public.gsa_client_request_preapproved_credit_100(uuid,text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.gsa_client_request_preapproved_credit_100(uuid,text) TO authenticated,service_role;

CREATE OR REPLACE FUNCTION public.gsa_admin_approve_preapproved_credit_100(
  p_sessao_id uuid,p_session_token text,p_solicitacao_id uuid
) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE v_admin record; v_req public.loja_credito_solicitacoes%rowtype; v_client public.clientes%rowtype; v_new_total numeric; v_new_available numeric;
BEGIN
  SELECT * INTO v_admin FROM public.gsa_admin_session_actor(p_sessao_id,p_session_token) LIMIT 1;
  SELECT * INTO v_req FROM public.loja_credito_solicitacoes WHERE id=p_solicitacao_id FOR UPDATE;
  IF NOT FOUND OR v_req.origem_pre_aprovado IS NOT TRUE THEN RAISE EXCEPTION 'Solicitacao pre-aprovada nao encontrada.'; END IF;
  IF v_req.status='liberado' THEN RETURN jsonb_build_object('success',true,'already_processed',true); END IF;
  IF v_req.status <> 'analise' THEN RAISE EXCEPTION 'Esta solicitacao nao esta disponivel para aprovacao.'; END IF;
  SELECT * INTO v_client FROM public.clientes WHERE id=v_req.cliente_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Cliente nao encontrado.'; END IF;
  IF v_client.credito_pre_aprovado_liberado_em IS NOT NULL THEN RAISE EXCEPTION 'Credito pre-aprovado ja liberado.'; END IF;
  v_new_total:=round(coalesce(v_client.limite_credito_total,0)+100,2);
  v_new_available:=round(coalesce(v_client.limite_credito_disponivel,0)+100,2);
  UPDATE public.clientes SET limite_credito_total=v_new_total,limite_credito_disponivel=v_new_available,
    credito_pre_aprovado_liberado_em=now(),updated_at=now() WHERE id=v_client.id;
  UPDATE public.loja_credito_solicitacoes SET status='liberado',limite_aprovado=100,data_liberacao_credito=current_date,updated_at=now() WHERE id=v_req.id;
  INSERT INTO public.loja_credito_movimentacoes(cliente_id,solicitacao_id,tipo,valor,limite_total_anterior,limite_total_novo,limite_disponivel_anterior,limite_disponivel_novo,descricao)
  VALUES(v_client.id,v_req.id,'concessao_inicial',100,coalesce(v_client.limite_credito_total,0),v_new_total,coalesce(v_client.limite_credito_disponivel,0),v_new_available,'Liberacao administrativa do credito pre-aprovado de R$ 100,00.');
  INSERT INTO public.notificacoes(cliente_id,titulo,mensagem,modulo,tipo,destinatario_tipo,prioridade,acao_origem,contexto)
  VALUES(v_client.id,'Credito de R$ 100,00 liberado','A analise foi aprovada e os R$ 100,00 ja estao disponiveis no seu limite.','credito_loja','sistema','cliente','alta','credito_pre_aprovado_aprovado',jsonb_build_object('solicitacao_id',v_req.id));
  RETURN jsonb_build_object('success',true,'already_processed',false,'limite_total_novo',v_new_total,'limite_disponivel_novo',v_new_available);
END;
$$;
REVOKE ALL ON FUNCTION public.gsa_admin_approve_preapproved_credit_100(uuid,text,uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.gsa_admin_approve_preapproved_credit_100(uuid,text,uuid) TO authenticated,service_role;

COMMIT;
