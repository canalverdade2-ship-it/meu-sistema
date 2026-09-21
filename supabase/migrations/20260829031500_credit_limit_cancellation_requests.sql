BEGIN;

CREATE TABLE IF NOT EXISTS public.loja_credito_cancelamentos_limite (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  protocolo text NOT NULL UNIQUE,
  cliente_id uuid NOT NULL REFERENCES public.clientes(id) ON DELETE CASCADE,
  limite_total_snapshot numeric(14,2) NOT NULL DEFAULT 0,
  limite_disponivel_snapshot numeric(14,2) NOT NULL DEFAULT 0,
  limite_usado_snapshot numeric(14,2) NOT NULL DEFAULT 0,
  status text NOT NULL DEFAULT 'solicitado',
  motivo_decisao text,
  analisado_por uuid,
  analisado_por_tipo text,
  analisado_por_nome text,
  analisado_em timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT loja_credito_cancelamentos_limite_status_check CHECK (
    status IN ('solicitado','em_analise','aprovado','recusado')
  )
);

CREATE UNIQUE INDEX IF NOT EXISTS loja_credito_cancelamento_limite_ativo_uidx
  ON public.loja_credito_cancelamentos_limite(cliente_id)
  WHERE status IN ('solicitado','em_analise');
CREATE INDEX IF NOT EXISTS loja_credito_cancelamento_limite_status_idx
  ON public.loja_credito_cancelamentos_limite(status, created_at DESC);
ALTER TABLE public.loja_credito_cancelamentos_limite ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS loja_credito_cancelamentos_limite_no_direct_access
  ON public.loja_credito_cancelamentos_limite;
CREATE POLICY loja_credito_cancelamentos_limite_no_direct_access
  ON public.loja_credito_cancelamentos_limite
  FOR ALL USING (false) WITH CHECK (false);

REVOKE ALL ON public.loja_credito_cancelamentos_limite FROM PUBLIC, anon, authenticated;
GRANT ALL ON public.loja_credito_cancelamentos_limite TO service_role;

ALTER TABLE public.loja_credito_movimentacoes
  DROP CONSTRAINT IF EXISTS loja_credito_movimentacoes_tipo_check;
ALTER TABLE public.loja_credito_movimentacoes
  ADD CONSTRAINT loja_credito_movimentacoes_tipo_check CHECK (tipo IN (
    'concessao_inicial','compra','amortizacao','ajuste_adm_aumento',
    'ajuste_adm_reducao','solicitacao_aumento_aprovada','estorno_compra',
    'cancelamento_limite'
  ));

CREATE OR REPLACE FUNCTION public.gsa_client_request_credit_limit_cancellation(
  p_sessao_id uuid,
  p_session_token text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public','pg_temp'
AS $$
DECLARE
  v_actor record;
  v_client public.clientes%rowtype;
  v_existing public.loja_credito_cancelamentos_limite%rowtype;
  v_used numeric := 0;
  v_outstanding numeric := 0;
  v_id uuid;
  v_protocol text;
BEGIN
  SELECT * INTO v_actor
  FROM public.gsa_client_session_actor(p_sessao_id,p_session_token)
  LIMIT 1;
  PERFORM pg_advisory_xact_lock(hashtextextended('gsa-store-credit:' || v_actor.cliente_id::text,0));
  SELECT * INTO v_client FROM public.clientes
  WHERE id=v_actor.cliente_id FOR UPDATE;
  IF v_client.id IS NULL THEN RAISE EXCEPTION 'Cliente não encontrado.' USING ERRCODE='P0002'; END IF;

  SELECT * INTO v_existing
  FROM public.loja_credito_cancelamentos_limite
  WHERE cliente_id=v_actor.cliente_id AND status IN ('solicitado','em_analise')
  ORDER BY created_at DESC LIMIT 1;
  IF v_existing.id IS NOT NULL THEN
    RETURN jsonb_build_object('success',true,'idempotent',true,'id',v_existing.id,
      'protocolo',v_existing.protocolo,'status',v_existing.status);
  END IF;

  IF COALESCE(v_client.limite_credito_total,0) <= 0 THEN
    RAISE EXCEPTION 'Não existe limite de crédito ativo para cancelar.' USING ERRCODE='22023';
  END IF;
  v_used := round(greatest(COALESCE(v_client.limite_credito_total,0)-COALESCE(v_client.limite_credito_disponivel,0),0),2);
  IF abs(COALESCE(v_client.limite_credito_total,0)-COALESCE(v_client.limite_credito_disponivel,0)) > 0.01 OR v_used > 0.01 THEN
    RAISE EXCEPTION 'O cancelamento só pode ser solicitado quando não houver nenhum limite utilizado.' USING ERRCODE='22023';
  END IF;

  SELECT COALESCE(sum(greatest(COALESCE(valor_final_pendente,0),0)),0)
    INTO v_outstanding
  FROM public.faturas
  WHERE cliente_id=v_actor.cliente_id
    AND COALESCE(is_amortizacao_credito,false)
    AND status <> 'cancelado';
  IF v_outstanding > 0.01 THEN
    RAISE EXCEPTION 'Existem faturas de crédito com saldo pendente. Quite o saldo antes de solicitar o cancelamento do limite.' USING ERRCODE='22023';
  END IF;
  v_protocol := format('CRED-CAN-%s-%s',to_char(now(),'YYYY'),upper(substr(replace(gen_random_uuid()::text,'-',''),1,6)));
  INSERT INTO public.loja_credito_cancelamentos_limite(
    protocolo,cliente_id,limite_total_snapshot,limite_disponivel_snapshot,limite_usado_snapshot
  ) VALUES (
    v_protocol,v_actor.cliente_id,round(COALESCE(v_client.limite_credito_total,0),2),
    round(COALESCE(v_client.limite_credito_disponivel,0),2),v_used
  ) RETURNING id INTO v_id;

  PERFORM set_config('gsa.system_override','on',true);
  INSERT INTO public.notificacoes(
    cliente_id,titulo,mensagem,modulo,tab,item_id,destinatario_tipo,prioridade,acao_origem,contexto
  ) VALUES (
    NULL,'Solicitação de cancelamento de limite',
    format('%s solicitou o cancelamento total do limite de crédito. Protocolo %s.',v_actor.cliente_nome,v_protocol),
    'financeiro','cancelamentos_limite',v_id::text,'admin','alta',
    'credito_cancelamento_limite_solicitado',jsonb_build_object('cancelamento_id',v_id,'cliente_id',v_actor.cliente_id,'protocolo',v_protocol)
  );

  RETURN jsonb_build_object('success',true,'idempotent',false,'id',v_id,'protocolo',v_protocol,'status','solicitado');
END;
$$;
REVOKE ALL ON FUNCTION public.gsa_client_request_credit_limit_cancellation(uuid,text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.gsa_client_request_credit_limit_cancellation(uuid,text) TO anon,authenticated,service_role;

CREATE OR REPLACE FUNCTION public.gsa_client_credit_limit_cancellations(
  p_sessao_id uuid,
  p_session_token text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
STABLE
SET search_path TO 'public','pg_temp'
AS $$
DECLARE v_actor record; v_result jsonb;
BEGIN
  SELECT * INTO v_actor FROM public.gsa_client_session_actor(p_sessao_id,p_session_token) LIMIT 1;
  SELECT COALESCE(jsonb_agg(jsonb_build_object(
    'id',c.id,'protocolo',c.protocolo,'cliente_id',c.cliente_id,
    'limite_total_snapshot',c.limite_total_snapshot,'limite_disponivel_snapshot',c.limite_disponivel_snapshot,
    'limite_usado_snapshot',c.limite_usado_snapshot,'status',c.status,'motivo_decisao',c.motivo_decisao,
    'analisado_por_nome',c.analisado_por_nome,'analisado_em',c.analisado_em,
    'created_at',c.created_at,'updated_at',c.updated_at
  ) ORDER BY c.created_at DESC),'[]'::jsonb) INTO v_result
  FROM public.loja_credito_cancelamentos_limite c
  WHERE c.cliente_id=v_actor.cliente_id;
  RETURN v_result;
END;
$$;
REVOKE ALL ON FUNCTION public.gsa_client_credit_limit_cancellations(uuid,text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.gsa_client_credit_limit_cancellations(uuid,text) TO anon,authenticated,service_role;

CREATE OR REPLACE FUNCTION public.gsa_admin_credit_limit_cancellations(
  p_sessao_id uuid,
  p_session_token text,
  p_status text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
STABLE
SET search_path TO 'public','pg_temp'
AS $$
DECLARE v_actor record; v_result jsonb;
BEGIN
  SELECT * INTO v_actor FROM public.gsa_admin_session_actor(p_sessao_id,p_session_token) LIMIT 1;
  SELECT COALESCE(jsonb_agg(jsonb_build_object(
    'id',c.id,'protocolo',c.protocolo,'cliente_id',c.cliente_id,'cliente_nome',cli.nome,
    'cliente_email',cli.email,'cliente_telefone',cli.telefone,
    'limite_total_snapshot',c.limite_total_snapshot,'limite_disponivel_snapshot',c.limite_disponivel_snapshot,
    'limite_usado_snapshot',c.limite_usado_snapshot,'status',c.status,'motivo_decisao',c.motivo_decisao,
    'analisado_por_nome',c.analisado_por_nome,'analisado_em',c.analisado_em,
    'created_at',c.created_at,'updated_at',c.updated_at,
    'limite_total_atual',COALESCE(cli.limite_credito_total,0),'limite_disponivel_atual',COALESCE(cli.limite_credito_disponivel,0)
  ) ORDER BY c.created_at DESC),'[]'::jsonb) INTO v_result
  FROM public.loja_credito_cancelamentos_limite c
  JOIN public.clientes cli ON cli.id=c.cliente_id
  WHERE p_status IS NULL OR c.status=p_status;
  RETURN v_result;
END;
$$;
REVOKE ALL ON FUNCTION public.gsa_admin_credit_limit_cancellations(uuid,text,text) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.gsa_admin_credit_limit_cancellations(uuid,text,text) TO authenticated,service_role;

CREATE OR REPLACE FUNCTION public.gsa_admin_review_credit_limit_cancellation(
  p_sessao_id uuid,
  p_session_token text,
  p_cancelamento_id uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public','pg_temp'
AS $$
DECLARE v_actor record; v_req public.loja_credito_cancelamentos_limite%rowtype;
BEGIN
  SELECT * INTO v_actor FROM public.gsa_admin_session_actor(p_sessao_id,p_session_token) LIMIT 1;
  SELECT * INTO v_req FROM public.loja_credito_cancelamentos_limite WHERE id=p_cancelamento_id FOR UPDATE;
  IF v_req.id IS NULL THEN RAISE EXCEPTION 'Solicitação de cancelamento não encontrada.' USING ERRCODE='P0002'; END IF;
  IF v_req.status='em_analise' THEN RETURN jsonb_build_object('success',true,'idempotent',true,'status','em_analise'); END IF;
  IF v_req.status<>'solicitado' THEN RAISE EXCEPTION 'Esta solicitação não pode ser colocada em análise.' USING ERRCODE='22023'; END IF;
  UPDATE public.loja_credito_cancelamentos_limite
    SET status='em_analise',analisado_por=v_actor.ator_id,analisado_por_tipo=v_actor.ator_tipo,
        analisado_por_nome=v_actor.ator_nome,analisado_em=now(),updated_at=now()
  WHERE id=v_req.id;
  PERFORM set_config('gsa.system_override','on',true);
  INSERT INTO public.notificacoes(cliente_id,titulo,mensagem,modulo,tab,item_id,destinatario_tipo,prioridade,acao_origem,contexto)
  VALUES(v_req.cliente_id,'Cancelamento do limite em análise',format('A solicitação %s está sendo analisada.',v_req.protocolo),
    'financeiro','credito',v_req.id::text,'cliente','normal','credito_cancelamento_limite_em_analise',jsonb_build_object('cancelamento_id',v_req.id));
  RETURN jsonb_build_object('success',true,'idempotent',false,'status','em_analise');
END;
$$;
REVOKE ALL ON FUNCTION public.gsa_admin_review_credit_limit_cancellation(uuid,text,uuid) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.gsa_admin_review_credit_limit_cancellation(uuid,text,uuid) TO authenticated,service_role;

CREATE OR REPLACE FUNCTION public.gsa_admin_decide_credit_limit_cancellation(
  p_sessao_id uuid,
  p_session_token text,
  p_cancelamento_id uuid,
  p_aprovar boolean,
  p_motivo text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public','pg_temp'
AS $$
DECLARE
  v_actor record;
  v_req public.loja_credito_cancelamentos_limite%rowtype;
  v_client public.clientes%rowtype;
  v_reason text := trim(COALESCE(p_motivo,''));
  v_used numeric := 0;
  v_outstanding numeric := 0;
BEGIN
  SELECT * INTO v_actor FROM public.gsa_admin_session_actor(p_sessao_id,p_session_token) LIMIT 1;
  SELECT * INTO v_req FROM public.loja_credito_cancelamentos_limite WHERE id=p_cancelamento_id FOR UPDATE;
  IF v_req.id IS NULL THEN RAISE EXCEPTION 'Solicitação de cancelamento não encontrada.' USING ERRCODE='P0002'; END IF;
  IF v_req.status IN ('aprovado','recusado') THEN
    RETURN jsonb_build_object('success',true,'idempotent',true,'status',v_req.status);
  END IF;
  IF v_req.status NOT IN ('solicitado','em_analise') THEN
    RAISE EXCEPTION 'Status da solicitação inválido para decisão.' USING ERRCODE='22023';
  END IF;
  IF NOT p_aprovar THEN
    IF length(v_reason)<5 THEN RAISE EXCEPTION 'Informe o motivo da recusa.' USING ERRCODE='22023'; END IF;
    UPDATE public.loja_credito_cancelamentos_limite
      SET status='recusado',motivo_decisao=left(v_reason,2000),analisado_por=v_actor.ator_id,
          analisado_por_tipo=v_actor.ator_tipo,analisado_por_nome=v_actor.ator_nome,
          analisado_em=now(),updated_at=now()
    WHERE id=v_req.id;
    PERFORM set_config('gsa.system_override','on',true);
    INSERT INTO public.notificacoes(cliente_id,titulo,mensagem,modulo,tab,item_id,destinatario_tipo,prioridade,acao_origem,contexto)
    VALUES(v_req.cliente_id,'Cancelamento de limite não aprovado',
      format('A solicitação %s não foi aprovada. Consulte o motivo no Painel do Cliente.',v_req.protocolo),
      'financeiro','credito',v_req.id::text,'cliente','alta','credito_cancelamento_limite_recusado',
      jsonb_build_object('cancelamento_id',v_req.id,'protocolo',v_req.protocolo));
    RETURN jsonb_build_object('success',true,'status','recusado');
  END IF;

  PERFORM pg_advisory_xact_lock(hashtextextended('gsa-store-credit:' || v_req.cliente_id::text,0));
  SELECT * INTO v_client FROM public.clientes WHERE id=v_req.cliente_id FOR UPDATE;
  IF v_client.id IS NULL THEN RAISE EXCEPTION 'Cliente não encontrado.' USING ERRCODE='P0002'; END IF;
  IF COALESCE(v_client.limite_credito_total,0)<=0 THEN
    RAISE EXCEPTION 'O cliente já não possui limite de crédito ativo.' USING ERRCODE='22023';
  END IF;
  v_used:=round(greatest(COALESCE(v_client.limite_credito_total,0)-COALESCE(v_client.limite_credito_disponivel,0),0),2);
  IF abs(COALESCE(v_client.limite_credito_total,0)-COALESCE(v_client.limite_credito_disponivel,0))>0.01 OR v_used>0.01 THEN
    RAISE EXCEPTION 'O cancelamento não pode ser aprovado porque existe limite utilizado no momento.' USING ERRCODE='22023';
  END IF;
  SELECT COALESCE(sum(greatest(COALESCE(valor_final_pendente,0),0)),0)
    INTO v_outstanding
  FROM public.faturas
  WHERE cliente_id=v_req.cliente_id
    AND COALESCE(is_amortizacao_credito,false)
    AND status<>'cancelado';
  IF v_outstanding>0.01 THEN
    RAISE EXCEPTION 'O cancelamento não pode ser aprovado enquanto houver faturas de crédito com saldo pendente.' USING ERRCODE='22023';
  END IF;

  PERFORM set_config('gsa.credit_release','on',true);
  PERFORM set_config('gsa.system_override','on',true);
  UPDATE public.clientes
    SET limite_credito_total=0,limite_credito_disponivel=0,opcao_pagamento_parcelado=false
  WHERE id=v_req.cliente_id;

  INSERT INTO public.loja_credito_movimentacoes(
    cliente_id,tipo,valor,limite_total_anterior,limite_total_novo,
    limite_disponivel_anterior,limite_disponivel_novo,descricao
  ) VALUES (
    v_req.cliente_id,'cancelamento_limite',round(COALESCE(v_client.limite_credito_total,0),2),
    round(COALESCE(v_client.limite_credito_total,0),2),0,
    round(COALESCE(v_client.limite_credito_disponivel,0),2),0,
    format('Cancelamento total do limite de crédito - Protocolo %s',v_req.protocolo)
  );

  UPDATE public.loja_credito_cancelamentos_limite
    SET status='aprovado',motivo_decisao=NULLIF(left(v_reason,2000),''),
        analisado_por=v_actor.ator_id,analisado_por_tipo=v_actor.ator_tipo,
        analisado_por_nome=v_actor.ator_nome,analisado_em=now(),updated_at=now()
  WHERE id=v_req.id;
  INSERT INTO public.notificacoes(cliente_id,titulo,mensagem,modulo,tab,item_id,destinatario_tipo,prioridade,acao_origem,contexto)
  VALUES(v_req.cliente_id,'Limite de crédito cancelado',
    format('O limite de crédito foi cancelado conforme a solicitação %s.',v_req.protocolo),
    'financeiro','credito',v_req.id::text,'cliente','alta','credito_cancelamento_limite_aprovado',
    jsonb_build_object('cancelamento_id',v_req.id,'protocolo',v_req.protocolo));

  RETURN jsonb_build_object('success',true,'status','aprovado','limite_total_novo',0,'limite_disponivel_novo',0);
END;
$$;
REVOKE ALL ON FUNCTION public.gsa_admin_decide_credit_limit_cancellation(uuid,text,uuid,boolean,text) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.gsa_admin_decide_credit_limit_cancellation(uuid,text,uuid,boolean,text) TO authenticated,service_role;

NOTIFY pgrst, 'reload schema';
COMMIT;
