BEGIN;

-- Saldo recebido de outros afiliados não pode ser confundido com a carteira
-- geral do perfil de cliente (reembolsos, créditos e outros lançamentos).
ALTER TABLE public.gsa_afiliados
  ADD COLUMN IF NOT EXISTS saldo_operacional numeric(14,2) NOT NULL DEFAULT 0;

ALTER TABLE public.gsa_afiliados
  DROP CONSTRAINT IF EXISTS gsa_afiliados_saldo_operacional_check;
ALTER TABLE public.gsa_afiliados
  ADD CONSTRAINT gsa_afiliados_saldo_operacional_check CHECK (saldo_operacional >= 0);

-- Os registros anteriores à separação eram movimentados na carteira do
-- cliente. Somente transferências ainda concluídas entram no novo saldo.
UPDATE public.gsa_afiliados a
SET saldo_operacional = greatest(coalesce((
  SELECT sum(CASE
    WHEN t.destinatario_afiliado_id = a.id THEN t.valor
    WHEN t.remetente_afiliado_id = a.id THEN -t.valor
    ELSE 0
  END)
  FROM public.gsa_afiliado_transferencias t
  WHERE t.status = 'concluida'
    AND (t.remetente_afiliado_id = a.id OR t.destinatario_afiliado_id = a.id)
), 0), 0);

CREATE OR REPLACE FUNCTION public.gsa_affiliate_available_balance(p_afiliado_id uuid)
RETURNS numeric
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $$
  SELECT greatest(
    coalesce((
      SELECT sum(valor - pago_valor)
      FROM public.gsa_afiliado_comissoes
      WHERE afiliado_id = p_afiliado_id AND status = 'disponivel'
    ), 0)
    + coalesce((
      SELECT saldo_operacional FROM public.gsa_afiliados WHERE id = p_afiliado_id
    ), 0)
    - coalesce((
      SELECT sum(valor)
      FROM public.gsa_afiliado_saques
      WHERE afiliado_id = p_afiliado_id AND status IN ('solicitado','aprovado')
    ), 0),
    0
  )::numeric(14,2);
$$;

-- Toda leitura direta passa a respeitar a identidade autenticada. Escritas
-- ficam exclusivamente nas RPCs SECURITY DEFINER auditadas.
DO $$
DECLARE
  v_table text;
  v_policy record;
BEGIN
  FOREACH v_table IN ARRAY ARRAY[
    'gsa_afiliado_programas','gsa_afiliados','gsa_afiliado_links',
    'gsa_afiliado_cliques','gsa_afiliado_atribuicoes','gsa_afiliado_conversoes',
    'gsa_afiliado_comissoes','gsa_afiliado_saques',
    'gsa_afiliado_comissao_eventos','gsa_afiliado_pontos_eventos',
    'gsa_afiliado_transferencias'
  ] LOOP
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', v_table);
    FOR v_policy IN
      SELECT policyname FROM pg_policies WHERE schemaname = 'public' AND tablename = v_table
    LOOP
      EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', v_policy.policyname, v_table);
    END LOOP;
    EXECUTE format('REVOKE ALL ON TABLE public.%I FROM PUBLIC, anon, authenticated', v_table);
    EXECUTE format('GRANT ALL ON TABLE public.%I TO service_role', v_table);
  END LOOP;
END $$;

CREATE POLICY gsa_affiliate_programs_public_read ON public.gsa_afiliado_programas
FOR SELECT TO anon, authenticated USING (ativo);
GRANT SELECT ON public.gsa_afiliado_programas TO anon, authenticated;

CREATE POLICY gsa_affiliates_own_read ON public.gsa_afiliados
FOR SELECT TO authenticated USING (cliente_id = public.gsa_jwt_actor_id());
GRANT SELECT ON public.gsa_afiliados TO authenticated;

CREATE POLICY gsa_affiliate_links_own_read ON public.gsa_afiliado_links
FOR SELECT TO authenticated USING (EXISTS (
  SELECT 1 FROM public.gsa_afiliados a
  WHERE a.id = afiliado_id AND a.cliente_id = public.gsa_jwt_actor_id()
));
GRANT SELECT ON public.gsa_afiliado_links TO authenticated;

CREATE POLICY gsa_affiliate_clicks_own_read ON public.gsa_afiliado_cliques
FOR SELECT TO authenticated USING (EXISTS (
  SELECT 1 FROM public.gsa_afiliado_links l
  JOIN public.gsa_afiliados a ON a.id = l.afiliado_id
  WHERE l.id = link_id AND a.cliente_id = public.gsa_jwt_actor_id()
));
GRANT SELECT ON public.gsa_afiliado_cliques TO authenticated;

CREATE POLICY gsa_affiliate_attributions_own_read ON public.gsa_afiliado_atribuicoes
FOR SELECT TO authenticated USING (EXISTS (
  SELECT 1 FROM public.gsa_afiliados a
  WHERE a.id = afiliado_id AND a.cliente_id = public.gsa_jwt_actor_id()
));
GRANT SELECT ON public.gsa_afiliado_atribuicoes TO authenticated;

CREATE POLICY gsa_affiliate_conversions_own_read ON public.gsa_afiliado_conversoes
FOR SELECT TO authenticated USING (EXISTS (
  SELECT 1 FROM public.gsa_afiliados a
  WHERE a.id = afiliado_id AND a.cliente_id = public.gsa_jwt_actor_id()
));
GRANT SELECT ON public.gsa_afiliado_conversoes TO authenticated;

CREATE POLICY gsa_affiliate_commissions_own_read ON public.gsa_afiliado_comissoes
FOR SELECT TO authenticated USING (EXISTS (
  SELECT 1 FROM public.gsa_afiliados a
  WHERE a.id = afiliado_id AND a.cliente_id = public.gsa_jwt_actor_id()
));
GRANT SELECT ON public.gsa_afiliado_comissoes TO authenticated;

CREATE POLICY gsa_affiliate_payouts_own_read ON public.gsa_afiliado_saques
FOR SELECT TO authenticated USING (EXISTS (
  SELECT 1 FROM public.gsa_afiliados a
  WHERE a.id = afiliado_id AND a.cliente_id = public.gsa_jwt_actor_id()
));
GRANT SELECT ON public.gsa_afiliado_saques TO authenticated;

CREATE POLICY gsa_affiliate_events_own_read ON public.gsa_afiliado_comissao_eventos
FOR SELECT TO authenticated USING (EXISTS (
  SELECT 1 FROM public.gsa_afiliados a
  WHERE a.id = afiliado_id AND a.cliente_id = public.gsa_jwt_actor_id()
));
GRANT SELECT ON public.gsa_afiliado_comissao_eventos TO authenticated;

CREATE POLICY gsa_affiliate_points_own_read ON public.gsa_afiliado_pontos_eventos
FOR SELECT TO authenticated USING (
  cliente_id = public.gsa_jwt_actor_id()
  OR EXISTS (
    SELECT 1 FROM public.gsa_afiliados a
    WHERE a.id = afiliado_id AND a.cliente_id = public.gsa_jwt_actor_id()
  )
);
GRANT SELECT ON public.gsa_afiliado_pontos_eventos TO authenticated;

CREATE POLICY gsa_affiliate_transfers_own_read ON public.gsa_afiliado_transferencias
FOR SELECT TO authenticated USING (
  EXISTS (
    SELECT 1 FROM public.gsa_afiliados a
    WHERE a.cliente_id = public.gsa_jwt_actor_id()
      AND a.id IN (remetente_afiliado_id, destinatario_afiliado_id)
  )
);
GRANT SELECT ON public.gsa_afiliado_transferencias TO authenticated;

-- Funções internas e legadas nunca devem ser chamadas pelo navegador.
DO $$
DECLARE
  v_function record;
BEGIN
  FOR v_function IN
    SELECT p.oid::regprocedure AS signature
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public'
      AND p.proname IN (
        'gsa_register_affiliate_sale_commission',
        'gsa_affiliate_request_payout',
        'gsa_affiliate_redeem_points',
        'gsa_affiliate_record_conversion',
        'gsa_affiliate_reverse_source',
        'gsa_affiliate_available_balance',
        'gsa_affiliate_release_due_commissions',
        'gsa_affiliate_current_attribution',
        'gsa_affiliate_freeze_attribution',
        'gsa_affiliate_award_points',
        'gsa_affiliate_reverse_points'
      )
  LOOP
    EXECUTE format('REVOKE ALL ON FUNCTION %s FROM PUBLIC, anon, authenticated', v_function.signature);
    EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO service_role', v_function.signature);
  END LOOP;

  FOR v_function IN
    SELECT p.oid::regprocedure AS signature
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public' AND p.proname LIKE 'gsa_admin_%affiliate%'
  LOOP
    EXECUTE format('REVOKE ALL ON FUNCTION %s FROM PUBLIC, anon', v_function.signature);
    EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO authenticated, service_role', v_function.signature);
  END LOOP;
END $$;

-- Os nomes dos módulos de notificação passam a ser canônicos.
UPDATE public.notificacoes
SET modulo = 'afiliados'
WHERE lower(coalesce(modulo, '')) IN ('afiliado','affiliate','affiliates');

-- O pagamento de saque exige referência/comprovante textual e nunca debita
-- a carteira geral do cliente.
CREATE OR REPLACE FUNCTION public.gsa_admin_decide_affiliate_payout(
  p_sessao_id uuid,
  p_session_token text,
  p_payout_id uuid,
  p_action text,
  p_notes text DEFAULT NULL,
  p_paid_at timestamptz DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $$
DECLARE
  v_action text := lower(trim(coalesce(p_action, '')));
  v_payout public.gsa_afiliado_saques%rowtype;
  v_remaining numeric(14,2);
  v_item record;
  v_take numeric(14,2);
  v_client_id uuid;
  v_reference text := nullif(left(trim(coalesce(p_notes, '')), 1000), '');
BEGIN
  PERFORM public.gsa_admin_validate_context(p_sessao_id, p_session_token);
  PERFORM public.gsa_admin_assert_module('afiliados');
  SELECT * INTO v_payout FROM public.gsa_afiliado_saques WHERE id = p_payout_id FOR UPDATE;
  IF v_payout.id IS NULL THEN RAISE EXCEPTION 'Saque não encontrado.'; END IF;
  SELECT cliente_id INTO v_client_id FROM public.gsa_afiliados WHERE id = v_payout.afiliado_id;

  IF v_action = 'approve' THEN
    IF v_payout.status <> 'solicitado' THEN RAISE EXCEPTION 'Somente saques solicitados podem ser aprovados.'; END IF;
    UPDATE public.gsa_afiliado_saques SET status='aprovado', aprovado_em=coalesce(p_paid_at,now()), notas=v_reference, updated_at=now() WHERE id=v_payout.id;
    INSERT INTO public.notificacoes(cliente_id,titulo,mensagem,modulo,tab,destinatario_tipo,acao_origem)
    VALUES (v_client_id,'Solicitação de Saque Aprovada',format('Sua solicitação de saque de R$ %s foi aprovada e está em processamento.',to_char(v_payout.valor,'FM999G999G990D00')),'afiliados','saques','cliente','aprovacao_saque');
  ELSIF v_action = 'reject' THEN
    IF v_payout.status NOT IN ('solicitado','aprovado') THEN RAISE EXCEPTION 'Este saque não pode ser rejeitado.'; END IF;
    IF v_reference IS NULL THEN RAISE EXCEPTION 'Informe o motivo da rejeição.'; END IF;
    UPDATE public.gsa_afiliado_saques SET status='rejeitado', rejeitado_em=coalesce(p_paid_at,now()), notas=v_reference, updated_at=now() WHERE id=v_payout.id;
    INSERT INTO public.notificacoes(cliente_id,titulo,mensagem,modulo,tab,destinatario_tipo,acao_origem)
    VALUES (v_client_id,'Solicitação de Saque Recusada',format('Sua solicitação de saque de R$ %s foi recusada. Motivo: %s',to_char(v_payout.valor,'FM999G999G990D00'),v_reference),'afiliados','saques','cliente','rejeicao_saque');
  ELSIF v_action = 'mark_paid' THEN
    IF v_payout.status <> 'aprovado' THEN RAISE EXCEPTION 'Aprove o saque antes de confirmar o pagamento.'; END IF;
    IF v_reference IS NULL OR length(v_reference) < 4 THEN RAISE EXCEPTION 'Informe a referência ou comprovante do pagamento PIX.'; END IF;
    v_remaining := v_payout.valor;
    FOR v_item IN
      SELECT id,valor,pago_valor FROM public.gsa_afiliado_comissoes
      WHERE afiliado_id=v_payout.afiliado_id AND status='disponivel' AND pago_valor<valor
      ORDER BY disponivel_em,created_at FOR UPDATE
    LOOP
      EXIT WHEN v_remaining <= 0;
      v_take := least(v_remaining,v_item.valor-v_item.pago_valor);
      UPDATE public.gsa_afiliado_comissoes
      SET pago_valor=pago_valor+v_take,
          status=CASE WHEN pago_valor+v_take>=valor THEN 'paga' ELSE 'disponivel' END,
          paga_em=CASE WHEN pago_valor+v_take>=valor THEN coalesce(p_paid_at,now()) ELSE paga_em END,
          updated_at=now()
      WHERE id=v_item.id;
      v_remaining := round(v_remaining-v_take,2);
    END LOOP;
    IF v_remaining > 0 THEN
      UPDATE public.gsa_afiliados
      SET saldo_operacional=saldo_operacional-v_remaining,updated_at=now()
      WHERE id=v_payout.afiliado_id AND saldo_operacional>=v_remaining;
      IF NOT FOUND THEN RAISE EXCEPTION 'Saldo operacional insuficiente para concluir o saque.'; END IF;
    END IF;
    INSERT INTO public.gsa_afiliado_comissao_eventos(afiliado_id,saque_id,tipo,valor_assinado,efetivo_em,metadata)
    VALUES (v_payout.afiliado_id,v_payout.id,'saque',-v_payout.valor,coalesce(p_paid_at,now()),jsonb_build_object('referencia_pagamento',v_reference))
    ON CONFLICT DO NOTHING;
    UPDATE public.gsa_afiliado_saques SET status='pago',pago_em=coalesce(p_paid_at,now()),notas=v_reference,updated_at=now() WHERE id=v_payout.id;
    INSERT INTO public.notificacoes(cliente_id,titulo,mensagem,modulo,tab,destinatario_tipo,acao_origem)
    VALUES (v_client_id,'Pagamento de Saque PIX Concluído',format('O PIX de R$ %s foi concluído. Referência: %s',to_char(v_payout.valor,'FM999G999G990D00'),v_reference),'afiliados','saques','cliente','pagamento_saque');
  ELSE
    RAISE EXCEPTION 'Ação inválida. Use approve, reject ou mark_paid.';
  END IF;

  PERFORM public.gsa_admin_write_audit('afiliados','DECIDIR_SAQUE_AFILIADO','gsa_afiliado_saques',v_payout.id,jsonb_build_object('acao',v_action,'valor',v_payout.valor,'referencia',v_reference));
  RETURN jsonb_build_object('success',true,'payout_id',v_payout.id,'status',(SELECT status FROM public.gsa_afiliado_saques WHERE id=v_payout.id));
END;
$$;

REVOKE ALL ON FUNCTION public.gsa_admin_decide_affiliate_payout(uuid,text,uuid,text,text,timestamptz) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.gsa_admin_decide_affiliate_payout(uuid,text,uuid,text,text,timestamptz) TO authenticated, service_role;

-- Transferência: comissões são consumidas primeiro e o excedente sai do
-- saldo operacional exclusivo, nunca da carteira geral do cliente.
CREATE OR REPLACE FUNCTION public.gsa_client_transfer_affiliate_balance_internal(
  p_sessao_id uuid,p_session_token text,p_request_id uuid,p_destinatario_id uuid,p_valor numeric,p_observacao text DEFAULT NULL
)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public','pg_temp'
AS $$
DECLARE
  v_actor record; v_sender public.gsa_afiliados%rowtype; v_receiver public.gsa_afiliados%rowtype;
  v_value numeric(14,2):=round(coalesce(p_valor,0),2); v_transfer public.gsa_afiliado_transferencias%rowtype;
  v_sender_before numeric(14,2); v_receiver_before numeric(14,2); v_remaining numeric(14,2); v_take numeric(14,2);
  v_commission record; v_code text;
BEGIN
  SELECT * INTO v_actor FROM public.gsa_client_session_actor(p_sessao_id,p_session_token) LIMIT 1;
  IF v_actor.cliente_id IS NULL THEN RAISE EXCEPTION 'Sessão de cliente inválida ou expirada.'; END IF;
  IF p_request_id IS NULL THEN RAISE EXCEPTION 'Identificador da transferência obrigatório.'; END IF;
  IF v_value<1 OR v_value>1000000 THEN RAISE EXCEPTION 'Valor de transferência inválido.'; END IF;
  SELECT * INTO v_sender FROM public.gsa_afiliados WHERE cliente_id=v_actor.cliente_id AND status='ativo' FOR UPDATE;
  SELECT * INTO v_receiver FROM public.gsa_afiliados WHERE id=p_destinatario_id AND status='ativo' FOR UPDATE;
  IF v_sender.id IS NULL OR v_receiver.id IS NULL THEN RAISE EXCEPTION 'Perfil de afiliado ativo não encontrado.'; END IF;
  IF v_sender.id=v_receiver.id THEN RAISE EXCEPTION 'Não é permitido transferir para o próprio perfil.'; END IF;
  SELECT * INTO v_transfer FROM public.gsa_afiliado_transferencias WHERE request_id=p_request_id FOR UPDATE;
  IF FOUND THEN
    IF v_transfer.remetente_afiliado_id<>v_sender.id OR v_transfer.destinatario_afiliado_id<>v_receiver.id OR v_transfer.valor<>v_value THEN RAISE EXCEPTION 'Identificador já utilizado em outra operação.'; END IF;
    RETURN jsonb_build_object('success',true,'idempotent',true,'transfer_id',v_transfer.id,'codigo',v_transfer.codigo);
  END IF;
  PERFORM public.gsa_affiliate_release_due_commissions();
  v_sender_before:=public.gsa_affiliate_available_balance(v_sender.id); v_receiver_before:=public.gsa_affiliate_available_balance(v_receiver.id);
  IF v_value>v_sender_before THEN RAISE EXCEPTION 'Saldo disponível insuficiente para transferência.'; END IF;
  v_remaining:=v_value;
  FOR v_commission IN SELECT id,valor,pago_valor FROM public.gsa_afiliado_comissoes WHERE afiliado_id=v_sender.id AND status='disponivel' AND pago_valor<valor ORDER BY disponivel_em,created_at FOR UPDATE LOOP
    EXIT WHEN v_remaining<=0; v_take:=least(v_remaining,v_commission.valor-v_commission.pago_valor);
    UPDATE public.gsa_afiliado_comissoes SET pago_valor=pago_valor+v_take,status=CASE WHEN pago_valor+v_take>=valor THEN 'paga' ELSE status END,paga_em=CASE WHEN pago_valor+v_take>=valor THEN now() ELSE paga_em END,updated_at=now() WHERE id=v_commission.id;
    v_remaining:=round(v_remaining-v_take,2);
  END LOOP;
  IF v_remaining>0 THEN
    UPDATE public.gsa_afiliados SET saldo_operacional=saldo_operacional-v_remaining,updated_at=now() WHERE id=v_sender.id AND saldo_operacional>=v_remaining;
    IF NOT FOUND THEN RAISE EXCEPTION 'Saldo operacional insuficiente para transferência.'; END IF;
  END IF;
  UPDATE public.gsa_afiliados SET saldo_operacional=saldo_operacional+v_value,updated_at=now() WHERE id=v_receiver.id;
  v_code:='TRF-'||upper(substr(replace(gen_random_uuid()::text,'-',''),1,12));
  INSERT INTO public.gsa_afiliado_transferencias(request_id,remetente_afiliado_id,destinatario_afiliado_id,valor,codigo,observacao,remetente_saldo_antes,remetente_saldo_depois,destinatario_saldo_antes,destinatario_saldo_depois)
  VALUES(p_request_id,v_sender.id,v_receiver.id,v_value,v_code,nullif(left(trim(coalesce(p_observacao,'')),500),''),v_sender_before,public.gsa_affiliate_available_balance(v_sender.id),v_receiver_before,public.gsa_affiliate_available_balance(v_receiver.id)) RETURNING * INTO v_transfer;
  INSERT INTO public.gsa_afiliado_comissao_eventos(afiliado_id,tipo,valor_assinado,efetivo_em,metadata) VALUES
  (v_sender.id,'ajuste',-v_value,now(),jsonb_build_object('transferencia_id',v_transfer.id,'direcao','saida')),
  (v_receiver.id,'ajuste',v_value,now(),jsonb_build_object('transferencia_id',v_transfer.id,'direcao','entrada'));
  PERFORM set_config('gsa.system_override','on',true);
  INSERT INTO public.notificacoes(cliente_id,titulo,mensagem,modulo,tab,item_id,destinatario_tipo,prioridade,acao_origem,contexto) VALUES
  (v_sender.cliente_id,'Transferência de saldo enviada',format('Sua transferência de R$ %s foi enviada.',to_char(v_value,'FM999G999G990D00')),'afiliados','saques',v_transfer.id::text,'cliente','normal','transferencia_afiliado_enviada',jsonb_build_object('transferencia_id',v_transfer.id)),
  (v_receiver.cliente_id,'Transferência de saldo recebida',format('Você recebeu R$ %s em saldo de afiliado.',to_char(v_value,'FM999G999G990D00')),'afiliados','saques',v_transfer.id::text,'cliente','normal','transferencia_afiliado_recebida',jsonb_build_object('transferencia_id',v_transfer.id)),
  (NULL,'Transferência entre afiliados',format('Transferência de R$ %s registrada.',to_char(v_value,'FM999G999G990D00')),'afiliados','transferencias',v_transfer.id::text,'admin','normal','transferencia_afiliado_registrada',jsonb_build_object('transferencia_id',v_transfer.id));
  RETURN jsonb_build_object('success',true,'idempotent',false,'transfer_id',v_transfer.id,'codigo',v_transfer.codigo);
END;
$$;

-- O invólucro público continua validando a sessão através da função interna.
CREATE OR REPLACE FUNCTION public.gsa_client_transfer_affiliate_balance(
  p_sessao_id uuid,p_session_token text,p_request_id uuid,p_destinatario_id uuid,p_valor numeric,p_observacao text DEFAULT NULL
)
RETURNS jsonb LANGUAGE sql SECURITY DEFINER SET search_path TO 'public','pg_temp'
AS $$ SELECT public.gsa_client_transfer_affiliate_balance_internal($1,$2,$3,$4,$5,$6) $$;
REVOKE ALL ON FUNCTION public.gsa_client_transfer_affiliate_balance_internal(uuid,text,uuid,uuid,numeric,text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.gsa_client_transfer_affiliate_balance_internal(uuid,text,uuid,uuid,numeric,text) TO service_role;
REVOKE ALL ON FUNCTION public.gsa_client_transfer_affiliate_balance(uuid,text,uuid,uuid,numeric,text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.gsa_client_transfer_affiliate_balance(uuid,text,uuid,uuid,numeric,text) TO anon, authenticated;

CREATE OR REPLACE FUNCTION public.gsa_client_reverse_received_affiliate_transfer(p_sessao_id uuid,p_session_token text,p_transferencia_id uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public','pg_temp'
AS $$
DECLARE v_actor record; v_receiver public.gsa_afiliados%rowtype; v_sender public.gsa_afiliados%rowtype; v_transfer public.gsa_afiliado_transferencias%rowtype;
BEGIN
  SELECT * INTO v_actor FROM public.gsa_client_session_actor(p_sessao_id,p_session_token) LIMIT 1;
  SELECT * INTO v_receiver FROM public.gsa_afiliados WHERE cliente_id=v_actor.cliente_id AND status='ativo' FOR UPDATE;
  IF v_receiver.id IS NULL THEN RAISE EXCEPTION 'Perfil de afiliado ativo não encontrado.'; END IF;
  SELECT * INTO v_transfer FROM public.gsa_afiliado_transferencias WHERE id=p_transferencia_id FOR UPDATE;
  IF v_transfer.id IS NULL THEN RAISE EXCEPTION 'Transferência não encontrada.'; END IF;
  IF v_transfer.destinatario_afiliado_id<>v_receiver.id THEN RAISE EXCEPTION 'Somente quem recebeu pode estornar.'; END IF;
  IF v_transfer.status='estornada' THEN RETURN jsonb_build_object('success',true,'idempotent',true,'transfer_id',v_transfer.id,'status','estornada'); END IF;
  IF v_transfer.status<>'concluida' THEN RAISE EXCEPTION 'Esta transferência não pode ser estornada.'; END IF;
  SELECT * INTO v_sender FROM public.gsa_afiliados WHERE id=v_transfer.remetente_afiliado_id FOR UPDATE;
  UPDATE public.gsa_afiliados SET saldo_operacional=saldo_operacional-v_transfer.valor,updated_at=now() WHERE id=v_receiver.id AND saldo_operacional>=v_transfer.valor;
  IF NOT FOUND THEN RAISE EXCEPTION 'O saldo recebido já foi utilizado e não pode ser estornado integralmente.'; END IF;
  UPDATE public.gsa_afiliados SET saldo_operacional=saldo_operacional+v_transfer.valor,updated_at=now() WHERE id=v_sender.id;
  UPDATE public.gsa_afiliado_transferencias SET status='estornada',estornada_em=now(),estornada_por_afiliado_id=v_receiver.id,updated_at=now() WHERE id=v_transfer.id;
  INSERT INTO public.gsa_afiliado_comissao_eventos(afiliado_id,tipo,valor_assinado,efetivo_em,metadata) VALUES
  (v_receiver.id,'ajuste',-v_transfer.valor,now(),jsonb_build_object('transferencia_id',v_transfer.id,'operacao','estorno_recebido')),
  (v_sender.id,'ajuste',v_transfer.valor,now(),jsonb_build_object('transferencia_id',v_transfer.id,'operacao','estorno_devolvido'));
  PERFORM set_config('gsa.system_override','on',true);
  INSERT INTO public.notificacoes(cliente_id,titulo,mensagem,modulo,tab,item_id,destinatario_tipo,prioridade,acao_origem,contexto) VALUES
  (v_receiver.cliente_id,'Transferência recebida estornada',format('O estorno de R$ %s foi concluído.',to_char(v_transfer.valor,'FM999G999G990D00')),'afiliados','saques',v_transfer.id::text,'cliente','normal','transferencia_afiliado_estornada',jsonb_build_object('transferencia_id',v_transfer.id)),
  (v_sender.cliente_id,'Transferência devolvida ao seu saldo',format('O destinatário devolveu R$ %s.',to_char(v_transfer.valor,'FM999G999G990D00')),'afiliados','saques',v_transfer.id::text,'cliente','normal','transferencia_afiliado_devolvida',jsonb_build_object('transferencia_id',v_transfer.id)),
  (NULL,'Estorno de transferência entre afiliados',format('A transferência %s foi estornada.',v_transfer.codigo),'afiliados','transferencias',v_transfer.id::text,'admin','normal','transferencia_afiliado_estornada',jsonb_build_object('transferencia_id',v_transfer.id));
  RETURN jsonb_build_object('success',true,'idempotent',false,'transfer_id',v_transfer.id,'status','estornada');
END;
$$;
REVOKE ALL ON FUNCTION public.gsa_client_reverse_received_affiliate_transfer(uuid,text,uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.gsa_client_reverse_received_affiliate_transfer(uuid,text,uuid) TO anon,authenticated;

NOTIFY pgrst, 'reload schema';
COMMIT;
