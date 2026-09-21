BEGIN;

CREATE TABLE IF NOT EXISTS public.loja_credito_saques (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  protocolo text NOT NULL UNIQUE,
  cliente_id uuid NOT NULL REFERENCES public.clientes(id) ON DELETE CASCADE,
  valor_solicitado numeric(14,2) NOT NULL CHECK (valor_solicitado > 0),
  taxa_tipo text NOT NULL CHECK (taxa_tipo IN ('percentual','fixa')),
  taxa_config_valor numeric(14,4) NOT NULL DEFAULT 0 CHECK (taxa_config_valor >= 0),
  taxa_calculada numeric(14,2) NOT NULL DEFAULT 0 CHECK (taxa_calculada >= 0),
  valor_total_fatura numeric(14,2) NOT NULL CHECK (valor_total_fatura > 0),
  limite_disponivel_snapshot numeric(14,2) NOT NULL DEFAULT 0,
  valor_bloqueado numeric(14,2) NOT NULL DEFAULT 0 CHECK (valor_bloqueado >= 0),
  criterio_cadastro_30d_ok boolean NOT NULL DEFAULT false,
  criterio_credito_100_ok boolean NOT NULL DEFAULT false,
  analise_reforcada boolean NOT NULL DEFAULT false,
  pix_tipo text NOT NULL,
  pix_chave text NOT NULL,
  documento_foto jsonb,
  comprovante_endereco jsonb,
  status text NOT NULL DEFAULT 'aguardando_documentos',
  prazo_analise timestamptz,
  motivo_decisao text,
  analisado_por uuid,
  analisado_por_tipo text,
  analisado_por_nome text,
  analisado_em timestamptz,
  aprovado_em timestamptz,
  liberado_em timestamptz,
  referencia_pagamento text,
  fatura_id uuid REFERENCES public.faturas(id) ON DELETE SET NULL,
  movimentacao_id uuid REFERENCES public.loja_credito_movimentacoes(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);ALTER TABLE public.loja_credito_saques DROP CONSTRAINT IF EXISTS loja_credito_saques_status_check;
ALTER TABLE public.loja_credito_saques ADD CONSTRAINT loja_credito_saques_status_check CHECK (status IN (
  'aguardando_documentos','em_analise','analise_reforcada','aprovado','recusado','cancelado_cliente','liberado'
));
CREATE UNIQUE INDEX IF NOT EXISTS loja_credito_saques_ativo_uidx
  ON public.loja_credito_saques(cliente_id)
  WHERE status IN ('aguardando_documentos','em_analise','analise_reforcada','aprovado');
CREATE INDEX IF NOT EXISTS loja_credito_saques_status_data_idx
  ON public.loja_credito_saques(status, created_at DESC);

CREATE TABLE IF NOT EXISTS public.loja_credito_saque_eventos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  saque_id uuid NOT NULL REFERENCES public.loja_credito_saques(id) ON DELETE CASCADE,
  tipo text NOT NULL,
  titulo text NOT NULL,
  descricao text,
  ator_tipo text NOT NULL DEFAULT 'sistema',
  ator_id uuid,
  ator_nome text,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  ocorrido_em timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS loja_credito_saque_eventos_idx
  ON public.loja_credito_saque_eventos(saque_id, ocorrido_em, id);

ALTER TABLE public.loja_credito_saques ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.loja_credito_saque_eventos ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS loja_credito_saques_no_direct_access ON public.loja_credito_saques;
CREATE POLICY loja_credito_saques_no_direct_access ON public.loja_credito_saques FOR ALL USING (false) WITH CHECK (false);
DROP POLICY IF EXISTS loja_credito_saque_eventos_no_direct_access ON public.loja_credito_saque_eventos;
CREATE POLICY loja_credito_saque_eventos_no_direct_access ON public.loja_credito_saque_eventos FOR ALL USING (false) WITH CHECK (false);
REVOKE ALL ON public.loja_credito_saques, public.loja_credito_saque_eventos FROM PUBLIC, anon, authenticated;
GRANT ALL ON public.loja_credito_saques, public.loja_credito_saque_eventos TO service_role;INSERT INTO public.system_settings(key,value) VALUES
  ('credito_saque_taxa_tipo','percentual'),
  ('credito_saque_taxa_valor','0')
ON CONFLICT (key) DO NOTHING;

CREATE OR REPLACE FUNCTION public.gsa_admin_allowed_setting_keys()
RETURNS text[] LANGUAGE sql IMMUTABLE AS $$
SELECT ARRAY[
  'codigo_cadastro_padrao_ativo','codigo_cadastro_padrao','bonus_cadastro_tipo','bonus_cadastro_valor',
  'valor_minimo_saque','vencimento_padrao_servicos','vencimento_padrao_produtos','loja_taxa_entrega_padrao',
  'indicador_recompensa_tipo','indicador_limite_carteira','indicador_valor_pontos','indicado_recompensa_tipo',
  'indicado_desconto_porcentagem','indicado_valor_pontos','template_mensagem_indicacao','bonus_indicador',
  'desconto_indicado_porcentagem','whatsapp_float_ativo','whatsapp_float_telefone','whatsapp_float_mensagem',
  'whatsapp_float_tamanho','whatsapp_float_posicao','whatsapp_float_tooltip','whatsapp_admin_notificacoes',
  'whatsapp_n8n_webhook_url','modal_indicacao_ativo','modal_indicacao_titulo','modal_indicacao_descricao',
  'modal_indicacao_url_botao','modal_indicacao_acao_botao','modal_indicacao_modulo_destino','modal_indicacao_texto_botao',
  'modal_indicacao_tamanho','loja_credito_juros_avista','loja_credito_juros_parcelado','cobranca_multa_porcentagem',
  'cobranca_juros_mensal','cobranca_juros_tipo','credito_saque_taxa_tipo','credito_saque_taxa_valor'
]::text[];
$$;

CREATE OR REPLACE FUNCTION public.gsa_admin_update_settings_secure(
  p_sessao_id uuid DEFAULT NULL, p_session_token text DEFAULT NULL, p_settings jsonb DEFAULT '[]'::jsonb
) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public','pg_temp' AS $$
DECLARE v_item jsonb; v_key text; v_value text; v_count integer := 0;
BEGIN
  PERFORM public.gsa_admin_validate_context(p_sessao_id,p_session_token);
  PERFORM public.gsa_admin_assert_module('configuracoes');
  IF jsonb_typeof(COALESCE(p_settings,'[]'::jsonb)) <> 'array' THEN RAISE EXCEPTION 'Configurações devem ser enviadas em uma lista.' USING ERRCODE='22023'; END IF;  FOR v_item IN SELECT value FROM jsonb_array_elements(COALESCE(p_settings,'[]'::jsonb)) LOOP
    v_key := trim(COALESCE(v_item->>'key','')); v_value := COALESCE(v_item->>'value','');
    IF NOT v_key = ANY(public.gsa_admin_allowed_setting_keys()) THEN RAISE EXCEPTION 'A configuração % não pode ser alterada por este painel.',v_key USING ERRCODE='42501'; END IF;
    IF length(v_value)>4000 THEN RAISE EXCEPTION 'Valor excessivamente longo para a configuração %.',v_key USING ERRCODE='22023'; END IF;
    IF v_key='credito_saque_taxa_tipo' AND v_value NOT IN ('percentual','fixa') THEN
      RAISE EXCEPTION 'Tipo de taxa de saque inválido.' USING ERRCODE='22023';
    END IF;
    IF v_key IN ('valor_minimo_saque','loja_taxa_entrega_padrao','indicador_limite_carteira','indicador_valor_pontos',
      'indicado_desconto_porcentagem','indicado_valor_pontos','bonus_cadastro_valor','loja_credito_juros_avista',
      'loja_credito_juros_parcelado','cobranca_multa_porcentagem','cobranca_juros_mensal','credito_saque_taxa_valor') THEN
      BEGIN
        IF v_value::numeric<0 THEN RAISE EXCEPTION 'Valor negativo não permitido para %.',v_key USING ERRCODE='22023'; END IF;
        IF v_key='credito_saque_taxa_valor' AND (SELECT value FROM public.system_settings WHERE key='credito_saque_taxa_tipo')='percentual' AND v_value::numeric>100 THEN
          RAISE EXCEPTION 'A taxa percentual de saque não pode ultrapassar 100%%.' USING ERRCODE='22023';
        END IF;
      EXCEPTION WHEN invalid_text_representation THEN RAISE EXCEPTION 'Valor numérico inválido para %.',v_key USING ERRCODE='22023'; END;
    END IF;
    IF v_key IN ('vencimento_padrao_servicos','vencimento_padrao_produtos') THEN
      BEGIN IF v_value::integer<1 OR v_value::integer>365 THEN RAISE EXCEPTION 'Prazo inválido para %.',v_key USING ERRCODE='22023'; END IF;
      EXCEPTION WHEN invalid_text_representation THEN RAISE EXCEPTION 'Prazo inválido para %.',v_key USING ERRCODE='22023'; END;
    END IF;
    INSERT INTO public.system_settings(key,value) VALUES(v_key,v_value) ON CONFLICT(key) DO UPDATE SET value=EXCLUDED.value;
    v_count:=v_count+1;
  END LOOP;
  PERFORM public.gsa_admin_write_audit('configuracoes','ATUALIZAR_CONFIGURACOES','system_settings',NULL,
    jsonb_build_object('keys',(SELECT jsonb_agg(value->>'key') FROM jsonb_array_elements(COALESCE(p_settings,'[]'::jsonb)))));
  RETURN jsonb_build_object('success',true,'updated',v_count);
END;
$$;ALTER TABLE public.loja_credito_movimentacoes DROP CONSTRAINT IF EXISTS loja_credito_movimentacoes_tipo_check;
ALTER TABLE public.loja_credito_movimentacoes ADD CONSTRAINT loja_credito_movimentacoes_tipo_check CHECK (tipo IN (
  'concessao_inicial','compra','amortizacao','ajuste_adm_aumento','ajuste_adm_reducao',
  'solicitacao_aumento_aprovada','estorno_compra','cancelamento_limite','saque_credito'
));

CREATE OR REPLACE FUNCTION public.gsa_credit_withdrawal_fee(p_valor numeric)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO 'public','pg_temp' AS $$
DECLARE v_tipo text; v_cfg numeric; v_taxa numeric; v_total numeric;
BEGIN
  SELECT COALESCE((SELECT value FROM public.system_settings WHERE key='credito_saque_taxa_tipo'),'percentual') INTO v_tipo;
  IF v_tipo NOT IN ('percentual','fixa') THEN v_tipo:='percentual'; END IF;
  BEGIN SELECT COALESCE((SELECT value::numeric FROM public.system_settings WHERE key='credito_saque_taxa_valor'),0) INTO v_cfg;
  EXCEPTION WHEN invalid_text_representation THEN v_cfg:=0; END;
  v_cfg:=greatest(COALESCE(v_cfg,0),0);
  v_taxa:=CASE WHEN v_tipo='fixa' THEN round(v_cfg,2) ELSE round(greatest(COALESCE(p_valor,0),0)*v_cfg/100,2) END;
  v_total:=round(greatest(COALESCE(p_valor,0),0)+v_taxa,2);
  RETURN jsonb_build_object('taxa_tipo',v_tipo,'taxa_config_valor',v_cfg,'taxa_calculada',v_taxa,'valor_total_fatura',v_total);
END;
$$;
REVOKE ALL ON FUNCTION public.gsa_credit_withdrawal_fee(numeric) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.gsa_credit_withdrawal_fee(numeric) TO service_role;

CREATE OR REPLACE FUNCTION public.gsa_client_credit_withdrawal_quote(
  p_sessao_id uuid, p_session_token text, p_valor numeric DEFAULT 0
) RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO 'public','pg_temp' AS $$
DECLARE v_actor record; v_client public.clientes%rowtype; v_fee jsonb; v_eff numeric; v_cfg numeric; v_max numeric; v_age integer;
BEGIN
  SELECT * INTO v_actor FROM public.gsa_client_session_actor(p_sessao_id,p_session_token) LIMIT 1;
  SELECT * INTO v_client FROM public.clientes WHERE id=v_actor.cliente_id;
  IF v_client.id IS NULL THEN RAISE EXCEPTION 'Cliente não encontrado.' USING ERRCODE='P0002'; END IF;
  v_eff:=greatest(round(COALESCE(v_client.limite_credito_disponivel,0)-COALESCE(v_client.limite_credito_bloqueado,0),2),0);
  v_fee:=public.gsa_credit_withdrawal_fee(greatest(COALESCE(p_valor,0),0));
  v_cfg:=COALESCE((v_fee->>'taxa_config_valor')::numeric,0);
  v_max:=CASE WHEN v_fee->>'taxa_tipo'='fixa' THEN greatest(v_eff-v_cfg,0) ELSE CASE WHEN 100+v_cfg>0 THEN trunc(v_eff*100/(100+v_cfg),2) ELSE 0 END END;
  v_age:=greatest(floor(extract(epoch FROM (now()-COALESCE(v_client.data_cadastro,now())))/86400)::integer,0);  RETURN v_fee || jsonb_build_object(
    'credito_disponivel_efetivo',v_eff,'valor_maximo_saque',greatest(round(v_max,2),0),'dias_cadastro',v_age,
    'criterio_cadastro_30d_ok',COALESCE(v_client.data_cadastro,now())<=now()-interval '30 days',
    'criterio_credito_100_ok',v_eff>100,
    'analise_reforcada',NOT (COALESCE(v_client.data_cadastro,now())<=now()-interval '30 days' AND v_eff>100),
    'pode_solicitar',v_eff>0 AND COALESCE(p_valor,0)>0 AND (v_fee->>'valor_total_fatura')::numeric<=v_eff,
    'prazo_analise_horas',72,'prazo_fatura_dias',30
  );
END;
$$;
REVOKE ALL ON FUNCTION public.gsa_client_credit_withdrawal_quote(uuid,text,numeric) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.gsa_client_credit_withdrawal_quote(uuid,text,numeric) TO anon,authenticated,service_role;

CREATE OR REPLACE FUNCTION public.gsa_client_create_credit_withdrawal(
  p_sessao_id uuid, p_session_token text, p_request_id uuid,
  p_valor numeric, p_pix_tipo text, p_pix_chave text
) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public','pg_temp' AS $$
DECLARE v_actor record; v_client public.clientes%rowtype; v_existing public.loja_credito_saques%rowtype;
  v_fee jsonb; v_eff numeric; v_total numeric; v_taxa numeric; v_tipo text; v_cfg numeric; v_id uuid; v_protocol text;
  v_cad_ok boolean; v_cred_ok boolean; v_pix_tipo text:=lower(trim(COALESCE(p_pix_tipo,''))); v_pix text:=trim(COALESCE(p_pix_chave,''));
BEGIN
  SELECT * INTO v_actor FROM public.gsa_client_session_actor(p_sessao_id,p_session_token) LIMIT 1;
  IF p_request_id IS NULL THEN RAISE EXCEPTION 'Identificador da solicitação inválido.' USING ERRCODE='22023'; END IF;
  IF round(COALESCE(p_valor,0),2)<=0 THEN RAISE EXCEPTION 'Informe um valor de saque maior que zero.' USING ERRCODE='22023'; END IF;
  IF v_pix_tipo NOT IN ('cpf','cnpj','email','telefone','aleatoria') OR length(v_pix)<3 THEN RAISE EXCEPTION 'Informe uma chave PIX válida.' USING ERRCODE='22023'; END IF;
  PERFORM pg_advisory_xact_lock(hashtextextended('gsa-store-credit:'||v_actor.cliente_id::text,0));
  SELECT * INTO v_client FROM public.clientes WHERE id=v_actor.cliente_id FOR UPDATE;
  SELECT * INTO v_existing FROM public.loja_credito_saques WHERE id=p_request_id AND cliente_id=v_actor.cliente_id;
  IF v_existing.id IS NOT NULL THEN RETURN to_jsonb(v_existing)||jsonb_build_object('success',true,'idempotent',true); END IF;
  IF EXISTS(SELECT 1 FROM public.loja_credito_saques WHERE cliente_id=v_actor.cliente_id AND status IN ('aguardando_documentos','em_analise','analise_reforcada','aprovado')) THEN
    RAISE EXCEPTION 'Já existe uma solicitação de saque de crédito em andamento.' USING ERRCODE='23505';
  END IF;  v_eff:=greatest(round(COALESCE(v_client.limite_credito_disponivel,0)-COALESCE(v_client.limite_credito_bloqueado,0),2),0);
  IF v_eff<=0 THEN RAISE EXCEPTION 'Não há crédito disponível para solicitar saque.' USING ERRCODE='22023'; END IF;
  v_fee:=public.gsa_credit_withdrawal_fee(round(p_valor,2));
  v_total:=(v_fee->>'valor_total_fatura')::numeric; v_taxa:=(v_fee->>'taxa_calculada')::numeric;
  v_tipo:=v_fee->>'taxa_tipo'; v_cfg:=(v_fee->>'taxa_config_valor')::numeric;
  IF v_total>v_eff+0.001 THEN RAISE EXCEPTION 'O valor do saque somado à taxa ultrapassa o crédito disponível.' USING ERRCODE='22023'; END IF;
  v_cad_ok:=COALESCE(v_client.data_cadastro,now())<=now()-interval '30 days'; v_cred_ok:=v_eff>100;
  LOOP v_protocol:='SAQ-CRE-'||to_char(clock_timestamp(),'YYYY')||'-'||upper(substr(md5(random()::text||clock_timestamp()::text),1,6));
    EXIT WHEN NOT EXISTS(SELECT 1 FROM public.loja_credito_saques WHERE protocolo=v_protocol); END LOOP;
  PERFORM set_config('gsa.credit_release','on',true); PERFORM set_config('gsa.system_override','on',true);
  UPDATE public.clientes SET limite_credito_bloqueado=round(COALESCE(limite_credito_bloqueado,0)+v_total,2) WHERE id=v_actor.cliente_id;
  INSERT INTO public.loja_credito_saques(
    id,protocolo,cliente_id,valor_solicitado,taxa_tipo,taxa_config_valor,taxa_calculada,valor_total_fatura,
    limite_disponivel_snapshot,valor_bloqueado,criterio_cadastro_30d_ok,criterio_credito_100_ok,analise_reforcada,pix_tipo,pix_chave
  ) VALUES(p_request_id,v_protocol,v_actor.cliente_id,round(p_valor,2),v_tipo,v_cfg,v_taxa,v_total,v_eff,v_total,v_cad_ok,v_cred_ok,NOT(v_cad_ok AND v_cred_ok),v_pix_tipo,v_pix)
  RETURNING id INTO v_id;
  INSERT INTO public.loja_credito_saque_eventos(saque_id,tipo,titulo,descricao,ator_tipo,ator_id,ator_nome,metadata)
  VALUES(v_id,'solicitacao','Solicitação registrada','O valor total da operação foi reservado no Crédito GSA e aguarda o envio dos documentos.','cliente',v_actor.cliente_id,v_actor.cliente_nome,
    jsonb_build_object('valor_solicitado',round(p_valor,2),'taxa',v_taxa,'valor_total_fatura',v_total,'analise_reforcada',NOT(v_cad_ok AND v_cred_ok)));
  INSERT INTO public.notificacoes(cliente_id,titulo,mensagem,modulo,tab,item_id,destinatario_tipo,prioridade,acao_origem,contexto)
  VALUES(v_actor.cliente_id,'Envie os documentos do saque de crédito',
    format('A solicitação %s foi registrada. Envie um documento oficial com foto e um comprovante de endereço para iniciar a análise.',v_protocol),
    'financeiro','credito',v_id::text,'cliente','alta','credito_saque_documentos_pendentes',jsonb_build_object('saque_id',v_id,'protocolo',v_protocol));
  RETURN jsonb_build_object('success',true,'idempotent',false,'id',v_id,'protocolo',v_protocol,'status','aguardando_documentos',
    'valor_solicitado',round(p_valor,2),'taxa_calculada',v_taxa,'valor_total_fatura',v_total,'analise_reforcada',NOT(v_cad_ok AND v_cred_ok));
END;
$$;
REVOKE ALL ON FUNCTION public.gsa_client_create_credit_withdrawal(uuid,text,uuid,numeric,text,text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.gsa_client_create_credit_withdrawal(uuid,text,uuid,numeric,text,text) TO anon,authenticated,service_role;CREATE OR REPLACE FUNCTION public.gsa_client_submit_credit_withdrawal_documents(
  p_sessao_id uuid,p_session_token text,p_saque_id uuid,p_documento_foto jsonb,p_comprovante_endereco jsonb
) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public','pg_temp' AS $$
DECLARE v_actor record; v_req public.loja_credito_saques%rowtype; v_doc_path text; v_addr_path text; v_status text;
BEGIN
  SELECT * INTO v_actor FROM public.gsa_client_session_actor(p_sessao_id,p_session_token) LIMIT 1;
  SELECT * INTO v_req FROM public.loja_credito_saques WHERE id=p_saque_id AND cliente_id=v_actor.cliente_id FOR UPDATE;
  IF v_req.id IS NULL THEN RAISE EXCEPTION 'Solicitação de saque não encontrada.' USING ERRCODE='P0002'; END IF;
  IF v_req.status IN ('em_analise','analise_reforcada','aprovado','liberado') AND v_req.documento_foto IS NOT NULL AND v_req.comprovante_endereco IS NOT NULL THEN
    RETURN jsonb_build_object('success',true,'idempotent',true,'status',v_req.status,'prazo_analise',v_req.prazo_analise);
  END IF;
  IF v_req.status<>'aguardando_documentos' THEN RAISE EXCEPTION 'Os documentos não podem ser enviados neste status.' USING ERRCODE='22023'; END IF;
  IF jsonb_typeof(p_documento_foto)<>'object' OR jsonb_typeof(p_comprovante_endereco)<>'object' THEN RAISE EXCEPTION 'Envie os dois documentos obrigatórios.' USING ERRCODE='22023'; END IF;
  v_doc_path:=COALESCE(p_documento_foto->>'path',''); v_addr_path:=COALESCE(p_comprovante_endereco->>'path','');
  IF v_doc_path NOT LIKE 'private/client-docs/'||v_actor.cliente_id::text||'/credit-withdrawal/%' OR
     v_addr_path NOT LIKE 'private/client-docs/'||v_actor.cliente_id::text||'/credit-withdrawal/%' THEN
    RAISE EXCEPTION 'Caminho de documento inválido para esta conta.' USING ERRCODE='42501';
  END IF;
  v_status:=CASE WHEN v_req.analise_reforcada THEN 'analise_reforcada' ELSE 'em_analise' END;
  UPDATE public.loja_credito_saques SET documento_foto=p_documento_foto,comprovante_endereco=p_comprovante_endereco,
    status=v_status,prazo_analise=now()+interval '72 hours',updated_at=now() WHERE id=v_req.id;
  INSERT INTO public.loja_credito_saque_eventos(saque_id,tipo,titulo,descricao,ator_tipo,ator_id,ator_nome)
  VALUES(v_req.id,'documentos_enviados',CASE WHEN v_req.analise_reforcada THEN 'Documentos enviados — análise reforçada' ELSE 'Documentos enviados — em análise' END,
    CASE WHEN v_req.analise_reforcada THEN 'Uma ou mais regras de elegibilidade padrão não foram atendidas; o pedido seguirá por análise minuciosa.' ELSE 'Os documentos foram recebidos e a análise foi iniciada.' END,
    'cliente',v_actor.cliente_id,v_actor.cliente_nome);
  PERFORM set_config('gsa.system_override','on',true);  INSERT INTO public.notificacoes(cliente_id,titulo,mensagem,modulo,tab,item_id,destinatario_tipo,prioridade,acao_origem,contexto) VALUES
  (v_actor.cliente_id,CASE WHEN v_req.analise_reforcada THEN 'Saque em análise minuciosa' ELSE 'Saque de crédito em análise' END,
   CASE WHEN v_req.analise_reforcada THEN format('Os documentos da solicitação %s foram recebidos. Como uma ou mais regras de liberação padrão não foram atendidas, o sistema fará uma análise minuciosa em até 72 horas.',v_req.protocolo)
   ELSE format('Os documentos da solicitação %s foram recebidos. O sistema fará a análise em até 72 horas.',v_req.protocolo) END,
   'financeiro','credito',v_req.id::text,'cliente','normal','credito_saque_em_analise',jsonb_build_object('saque_id',v_req.id,'protocolo',v_req.protocolo,'analise_reforcada',v_req.analise_reforcada)),
  (NULL,'Nova solicitação de saque de crédito',
   format('%s solicitou saque de R$ %s. Total da fatura: R$ %s. %s',v_actor.cliente_nome,to_char(v_req.valor_solicitado,'FM999G999G990D00'),to_char(v_req.valor_total_fatura,'FM999G999G990D00'),
     CASE WHEN v_req.analise_reforcada THEN 'Requer análise minuciosa.' ELSE 'Elegibilidade padrão atendida.' END),
   'financeiro','saques_credito',v_req.id::text,'admin',CASE WHEN v_req.analise_reforcada THEN 'alta' ELSE 'normal' END,'credito_saque_documentos_enviados',
   jsonb_build_object('saque_id',v_req.id,'cliente_id',v_actor.cliente_id,'protocolo',v_req.protocolo,'analise_reforcada',v_req.analise_reforcada));
  RETURN jsonb_build_object('success',true,'status',v_status,'prazo_analise',now()+interval '72 hours','analise_reforcada',v_req.analise_reforcada);
END;
$$;
REVOKE ALL ON FUNCTION public.gsa_client_submit_credit_withdrawal_documents(uuid,text,uuid,jsonb,jsonb) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.gsa_client_submit_credit_withdrawal_documents(uuid,text,uuid,jsonb,jsonb) TO anon,authenticated,service_role;

CREATE OR REPLACE FUNCTION public.gsa_client_credit_withdrawals(p_sessao_id uuid,p_session_token text)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO 'public','pg_temp' AS $$
DECLARE v_actor record; v_result jsonb;
BEGIN
  SELECT * INTO v_actor FROM public.gsa_client_session_actor(p_sessao_id,p_session_token) LIMIT 1;
  SELECT COALESCE(jsonb_agg(to_jsonb(s)-'pix_chave'||jsonb_build_object('pix_chave_mascarada',
    CASE WHEN length(s.pix_chave)<=6 THEN '***' ELSE left(s.pix_chave,3)||'***'||right(s.pix_chave,3) END) ORDER BY s.created_at DESC),'[]'::jsonb)
  INTO v_result FROM public.loja_credito_saques s WHERE s.cliente_id=v_actor.cliente_id;
  RETURN v_result;
END;
$$;
REVOKE ALL ON FUNCTION public.gsa_client_credit_withdrawals(uuid,text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.gsa_client_credit_withdrawals(uuid,text) TO anon,authenticated,service_role;CREATE OR REPLACE FUNCTION public.gsa_client_cancel_credit_withdrawal(
  p_sessao_id uuid,p_session_token text,p_saque_id uuid
) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public','pg_temp' AS $$
DECLARE v_actor record; v_req public.loja_credito_saques%rowtype;
BEGIN
  SELECT * INTO v_actor FROM public.gsa_client_session_actor(p_sessao_id,p_session_token) LIMIT 1;
  SELECT * INTO v_req FROM public.loja_credito_saques WHERE id=p_saque_id AND cliente_id=v_actor.cliente_id FOR UPDATE;
  IF v_req.id IS NULL THEN RAISE EXCEPTION 'Solicitação de saque não encontrada.' USING ERRCODE='P0002'; END IF;
  IF v_req.status='cancelado_cliente' THEN RETURN jsonb_build_object('success',true,'idempotent',true,'status','cancelado_cliente'); END IF;
  IF v_req.status NOT IN ('aguardando_documentos','em_analise','analise_reforcada') THEN RAISE EXCEPTION 'Esta solicitação não pode mais ser cancelada.' USING ERRCODE='22023'; END IF;
  PERFORM pg_advisory_xact_lock(hashtextextended('gsa-store-credit:'||v_actor.cliente_id::text,0));
  PERFORM set_config('gsa.credit_release','on',true); PERFORM set_config('gsa.system_override','on',true);
  UPDATE public.clientes SET limite_credito_bloqueado=greatest(round(COALESCE(limite_credito_bloqueado,0)-v_req.valor_bloqueado,2),0) WHERE id=v_actor.cliente_id;
  UPDATE public.loja_credito_saques SET status='cancelado_cliente',valor_bloqueado=0,updated_at=now() WHERE id=v_req.id;
  INSERT INTO public.loja_credito_saque_eventos(saque_id,tipo,titulo,descricao,ator_tipo,ator_id,ator_nome)
  VALUES(v_req.id,'cancelamento_cliente','Solicitação cancelada','O cliente cancelou o saque antes da liberação. A reserva do crédito foi removida.','cliente',v_actor.cliente_id,v_actor.cliente_nome);
  INSERT INTO public.notificacoes(cliente_id,titulo,mensagem,modulo,tab,item_id,destinatario_tipo,prioridade,acao_origem,contexto)
  VALUES(NULL,'Saque de crédito cancelado pelo cliente',format('A solicitação %s foi cancelada pelo cliente.',v_req.protocolo),'financeiro','saques_credito',v_req.id::text,'admin','normal','credito_saque_cancelado_cliente',jsonb_build_object('saque_id',v_req.id));
  RETURN jsonb_build_object('success',true,'idempotent',false,'status','cancelado_cliente');
END;
$$;
REVOKE ALL ON FUNCTION public.gsa_client_cancel_credit_withdrawal(uuid,text,uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.gsa_client_cancel_credit_withdrawal(uuid,text,uuid) TO anon,authenticated,service_role;

CREATE OR REPLACE FUNCTION public.gsa_admin_credit_withdrawals(p_sessao_id uuid,p_session_token text,p_status text DEFAULT NULL)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO 'public','pg_temp' AS $$
DECLARE v_actor record; v_result jsonb;
BEGIN
  SELECT * INTO v_actor FROM public.gsa_admin_session_actor(p_sessao_id,p_session_token) LIMIT 1;
  SELECT COALESCE(jsonb_agg(to_jsonb(s)||jsonb_build_object('cliente_nome',c.nome,'cliente_email',c.email,'cliente_telefone',c.telefone,
    'cliente_data_cadastro',c.data_cadastro,'limite_total_atual',COALESCE(c.limite_credito_total,0),'limite_disponivel_atual',COALESCE(c.limite_credito_disponivel,0),
    'limite_bloqueado_atual',COALESCE(c.limite_credito_bloqueado,0)) ORDER BY s.created_at DESC),'[]'::jsonb) INTO v_result
  FROM public.loja_credito_saques s JOIN public.clientes c ON c.id=s.cliente_id WHERE p_status IS NULL OR s.status=p_status;
  RETURN v_result;
END;
$$;REVOKE ALL ON FUNCTION public.gsa_admin_credit_withdrawals(uuid,text,text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.gsa_admin_credit_withdrawals(uuid,text,text) TO anon,authenticated,service_role;

CREATE OR REPLACE FUNCTION public.gsa_admin_credit_withdrawal_details(p_sessao_id uuid,p_session_token text,p_saque_id uuid)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO 'public','pg_temp' AS $$
DECLARE v_actor record; v_data jsonb; v_events jsonb;
BEGIN
  SELECT * INTO v_actor FROM public.gsa_admin_session_actor(p_sessao_id,p_session_token) LIMIT 1;
  SELECT to_jsonb(s)||jsonb_build_object('cliente_nome',c.nome,'cliente_email',c.email,'cliente_telefone',c.telefone,
    'cliente_data_cadastro',c.data_cadastro,'limite_total_atual',COALESCE(c.limite_credito_total,0),'limite_disponivel_atual',COALESCE(c.limite_credito_disponivel,0),
    'limite_bloqueado_atual',COALESCE(c.limite_credito_bloqueado,0)) INTO v_data
  FROM public.loja_credito_saques s JOIN public.clientes c ON c.id=s.cliente_id WHERE s.id=p_saque_id;
  IF v_data IS NULL THEN RAISE EXCEPTION 'Solicitação de saque não encontrada.' USING ERRCODE='P0002'; END IF;
  SELECT COALESCE(jsonb_agg(to_jsonb(e) ORDER BY e.ocorrido_em,e.id),'[]'::jsonb) INTO v_events
  FROM public.loja_credito_saque_eventos e WHERE e.saque_id=p_saque_id;
  RETURN v_data||jsonb_build_object('eventos',v_events);
END;
$$;
REVOKE ALL ON FUNCTION public.gsa_admin_credit_withdrawal_details(uuid,text,uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.gsa_admin_credit_withdrawal_details(uuid,text,uuid) TO anon,authenticated,service_role;

CREATE OR REPLACE FUNCTION public.gsa_admin_decide_credit_withdrawal(
  p_sessao_id uuid,p_session_token text,p_saque_id uuid,p_aprovar boolean,p_motivo text DEFAULT NULL
) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public','pg_temp' AS $$
DECLARE v_actor record; v_req public.loja_credito_saques%rowtype; v_reason text:=trim(COALESCE(p_motivo,''));
BEGIN
  SELECT * INTO v_actor FROM public.gsa_admin_session_actor(p_sessao_id,p_session_token) LIMIT 1;
  SELECT * INTO v_req FROM public.loja_credito_saques WHERE id=p_saque_id FOR UPDATE;
  IF v_req.id IS NULL THEN RAISE EXCEPTION 'Solicitação de saque não encontrada.' USING ERRCODE='P0002'; END IF;
  IF v_req.status IN ('aprovado','recusado','liberado') THEN RETURN jsonb_build_object('success',true,'idempotent',true,'status',v_req.status); END IF;
  IF v_req.status NOT IN ('em_analise','analise_reforcada') THEN RAISE EXCEPTION 'A solicitação ainda não está pronta para decisão.' USING ERRCODE='22023'; END IF;
  IF v_req.documento_foto IS NULL OR v_req.comprovante_endereco IS NULL THEN RAISE EXCEPTION 'Os documentos obrigatórios ainda não foram enviados.' USING ERRCODE='22023'; END IF;  PERFORM set_config('gsa.system_override','on',true);
  IF NOT p_aprovar THEN
    IF length(v_reason)<5 THEN RAISE EXCEPTION 'Informe o motivo da não aprovação.' USING ERRCODE='22023'; END IF;
    PERFORM pg_advisory_xact_lock(hashtextextended('gsa-store-credit:'||v_req.cliente_id::text,0));
    PERFORM set_config('gsa.credit_release','on',true);
    UPDATE public.clientes SET limite_credito_bloqueado=greatest(round(COALESCE(limite_credito_bloqueado,0)-v_req.valor_bloqueado,2),0) WHERE id=v_req.cliente_id;
    UPDATE public.loja_credito_saques SET status='recusado',valor_bloqueado=0,motivo_decisao=left(v_reason,2000),
      analisado_por=v_actor.ator_id,analisado_por_tipo=v_actor.ator_tipo,analisado_por_nome=v_actor.ator_nome,analisado_em=now(),updated_at=now() WHERE id=v_req.id;
    INSERT INTO public.loja_credito_saque_eventos(saque_id,tipo,titulo,descricao,ator_tipo,ator_id,ator_nome)
    VALUES(v_req.id,'recusa','Saque não aprovado',left(v_reason,2000),v_actor.ator_tipo,v_actor.ator_id,v_actor.ator_nome);
    INSERT INTO public.notificacoes(cliente_id,titulo,mensagem,modulo,tab,item_id,destinatario_tipo,prioridade,acao_origem,contexto)
    VALUES(v_req.cliente_id,'Saque de crédito não aprovado',format('A solicitação %s foi analisada e não aprovada. Consulte o motivo no seu painel.',v_req.protocolo),
      'financeiro','credito',v_req.id::text,'cliente','alta','credito_saque_recusado',jsonb_build_object('saque_id',v_req.id,'protocolo',v_req.protocolo));
    RETURN jsonb_build_object('success',true,'status','recusado');
  END IF;
  UPDATE public.loja_credito_saques SET status='aprovado',motivo_decisao=NULLIF(left(v_reason,2000),''),
    analisado_por=v_actor.ator_id,analisado_por_tipo=v_actor.ator_tipo,analisado_por_nome=v_actor.ator_nome,analisado_em=now(),aprovado_em=now(),updated_at=now() WHERE id=v_req.id;
  INSERT INTO public.loja_credito_saque_eventos(saque_id,tipo,titulo,descricao,ator_tipo,ator_id,ator_nome)
  VALUES(v_req.id,'aprovacao','Saque aprovado para liberação','A análise foi concluída. O valor permanece reservado até a confirmação do pagamento via PIX.',v_actor.ator_tipo,v_actor.ator_id,v_actor.ator_nome);
  INSERT INTO public.notificacoes(cliente_id,titulo,mensagem,modulo,tab,item_id,destinatario_tipo,prioridade,acao_origem,contexto)
  VALUES(v_req.cliente_id,'Saque aprovado para liberação',format('A solicitação %s foi aprovada. O sistema está aguardando a confirmação da liberação via PIX.',v_req.protocolo),
    'financeiro','credito',v_req.id::text,'cliente','alta','credito_saque_aprovado',jsonb_build_object('saque_id',v_req.id,'protocolo',v_req.protocolo));
  RETURN jsonb_build_object('success',true,'status','aprovado');
END;
$$;
REVOKE ALL ON FUNCTION public.gsa_admin_decide_credit_withdrawal(uuid,text,uuid,boolean,text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.gsa_admin_decide_credit_withdrawal(uuid,text,uuid,boolean,text) TO anon,authenticated,service_role;CREATE OR REPLACE FUNCTION public.gsa_admin_mark_credit_withdrawal_paid(
  p_sessao_id uuid,p_session_token text,p_saque_id uuid,p_referencia_pagamento text
) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public','pg_temp' AS $$
DECLARE v_actor record; v_req public.loja_credito_saques%rowtype; v_client public.clientes%rowtype;
  v_ref text:=trim(COALESCE(p_referencia_pagamento,'')); v_limit_before numeric; v_limit_after numeric; v_fatura_id uuid; v_mov_id uuid; v_codigo text;
BEGIN
  SELECT * INTO v_actor FROM public.gsa_admin_session_actor(p_sessao_id,p_session_token) LIMIT 1;
  IF length(v_ref)<3 THEN RAISE EXCEPTION 'Informe a referência/comprovante do pagamento PIX.' USING ERRCODE='22023'; END IF;
  SELECT * INTO v_req FROM public.loja_credito_saques WHERE id=p_saque_id FOR UPDATE;
  IF v_req.id IS NULL THEN RAISE EXCEPTION 'Solicitação de saque não encontrada.' USING ERRCODE='P0002'; END IF;
  IF v_req.status='liberado' THEN RETURN jsonb_build_object('success',true,'idempotent',true,'status','liberado','fatura_id',v_req.fatura_id); END IF;
  IF v_req.status<>'aprovado' THEN RAISE EXCEPTION 'O saque precisa estar aprovado antes da confirmação do PIX.' USING ERRCODE='22023'; END IF;
  PERFORM pg_advisory_xact_lock(hashtextextended('gsa-store-credit:'||v_req.cliente_id::text,0));
  SELECT * INTO v_client FROM public.clientes WHERE id=v_req.cliente_id FOR UPDATE;
  IF v_client.id IS NULL THEN RAISE EXCEPTION 'Cliente não encontrado.' USING ERRCODE='P0002'; END IF;
  IF v_req.valor_bloqueado<=0 OR COALESCE(v_client.limite_credito_bloqueado,0)+0.001<v_req.valor_bloqueado THEN RAISE EXCEPTION 'A reserva financeira deste saque não está íntegra.' USING ERRCODE='22023'; END IF;
  IF COALESCE(v_client.limite_credito_disponivel,0)+0.001<v_req.valor_total_fatura THEN RAISE EXCEPTION 'O limite disponível não comporta mais esta liberação.' USING ERRCODE='22023'; END IF;
  PERFORM set_config('gsa.credit_release','on',true); PERFORM set_config('gsa.system_override','on',true);
  v_limit_before:=round(COALESCE(v_client.limite_credito_disponivel,0),2); v_limit_after:=round(v_limit_before-v_req.valor_total_fatura,2);
  UPDATE public.clientes SET limite_credito_disponivel=v_limit_after,
    limite_credito_bloqueado=greatest(round(COALESCE(limite_credito_bloqueado,0)-v_req.valor_bloqueado,2),0) WHERE id=v_req.cliente_id;
  INSERT INTO public.loja_credito_movimentacoes(cliente_id,tipo,valor,limite_total_anterior,limite_total_novo,limite_disponivel_anterior,limite_disponivel_novo,descricao)
  VALUES(v_req.cliente_id,'saque_credito',v_req.valor_total_fatura,COALESCE(v_client.limite_credito_total,0),COALESCE(v_client.limite_credito_total,0),
    v_limit_before,v_limit_after,format('Saque Crédito GSA %s - Valor R$ %s + taxa R$ %s',v_req.protocolo,to_char(v_req.valor_solicitado,'FM999G999G990D00'),to_char(v_req.taxa_calculada,'FM999G999G990D00')))
  RETURNING id INTO v_mov_id;
  v_codigo:='FAT-SAQ-'||upper(substr(replace(gen_random_uuid()::text,'-',''),1,10));  INSERT INTO public.faturas(
    codigo_fatura,cliente_id,valor_total,valor_final_pendente,valor_base_original,status,tipo,data_emissao,data_vencimento,
    gerada_automaticamente,is_amortizacao_credito,forma_pagamento_escolhida,itens_faturados,observacoes,metadata
  ) VALUES(
    v_codigo,v_req.cliente_id,v_req.valor_total_fatura,v_req.valor_total_fatura,v_req.valor_total_fatura,'pendente','avulsa',current_date,current_date+30,
    true,true,NULL,jsonb_build_array(
      jsonb_build_object('tipo','saque_credito','descricao','Saque de Crédito GSA','valor_unitario',v_req.valor_solicitado,'quantidade',1,'subtotal',v_req.valor_solicitado),
      jsonb_build_object('tipo','taxa_saque','descricao','Taxa de saque','valor_unitario',v_req.taxa_calculada,'quantidade',1,'subtotal',v_req.taxa_calculada)
    ),format('Fatura do saque de crédito %s. PIX confirmado pela referência %s.',v_req.protocolo,left(v_ref,120)),
    jsonb_build_object('origem','saque_credito','saque_id',v_req.id,'protocolo',v_req.protocolo,'valor_solicitado',v_req.valor_solicitado,
      'taxa_tipo',v_req.taxa_tipo,'taxa_config_valor',v_req.taxa_config_valor,'taxa_calculada',v_req.taxa_calculada,'referencia_pagamento',left(v_ref,500))
  ) RETURNING id INTO v_fatura_id;
  UPDATE public.loja_credito_saques SET status='liberado',valor_bloqueado=0,referencia_pagamento=left(v_ref,500),
    fatura_id=v_fatura_id,movimentacao_id=v_mov_id,liberado_em=now(),updated_at=now() WHERE id=v_req.id;
  INSERT INTO public.loja_credito_saque_eventos(saque_id,tipo,titulo,descricao,ator_tipo,ator_id,ator_nome,metadata)
  VALUES(v_req.id,'liberacao','Saque liberado e fatura gerada',format('O PIX de R$ %s foi confirmado. A fatura de R$ %s vence em 30 dias.',
    to_char(v_req.valor_solicitado,'FM999G999G990D00'),to_char(v_req.valor_total_fatura,'FM999G999G990D00')),v_actor.ator_tipo,v_actor.ator_id,v_actor.ator_nome,
    jsonb_build_object('fatura_id',v_fatura_id,'movimentacao_id',v_mov_id,'referencia_pagamento',left(v_ref,500)));
  INSERT INTO public.notificacoes(cliente_id,titulo,mensagem,modulo,tab,item_id,destinatario_tipo,prioridade,acao_origem,contexto)
  VALUES(v_req.cliente_id,'Saque de crédito liberado',format('O saque %s de R$ %s foi liberado via PIX. A fatura de R$ %s vence em %s.',v_req.protocolo,
    to_char(v_req.valor_solicitado,'FM999G999G990D00'),to_char(v_req.valor_total_fatura,'FM999G999G990D00'),to_char(current_date+30,'DD/MM/YYYY')),
    'financeiro','faturas',v_fatura_id::text,'cliente','alta','credito_saque_liberado',jsonb_build_object('saque_id',v_req.id,'fatura_id',v_fatura_id,'protocolo',v_req.protocolo));
  RETURN jsonb_build_object('success',true,'status','liberado','fatura_id',v_fatura_id,'movimentacao_id',v_mov_id,'data_vencimento',current_date+30);
END;
$$;
REVOKE ALL ON FUNCTION public.gsa_admin_mark_credit_withdrawal_paid(uuid,text,uuid,text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.gsa_admin_mark_credit_withdrawal_paid(uuid,text,uuid,text) TO anon,authenticated,service_role;

NOTIFY pgrst,'reload schema';
COMMIT;