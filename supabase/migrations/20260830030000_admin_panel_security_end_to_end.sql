BEGIN;

CREATE OR REPLACE FUNCTION public.gsa_admin_session_assert_module(
  p_sessao_id uuid,
  p_session_token text,
  p_module text
) RETURNS TABLE(ator_tipo text, ator_id uuid, ator_nome text)
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_actor record;
  v_context jsonb;
BEGIN
  SELECT * INTO v_actor
    FROM public.gsa_admin_session_actor(p_sessao_id, p_session_token)
   LIMIT 1;
  v_context := public.gsa_admin_context();
  IF v_context->>'actor_type' IS DISTINCT FROM v_actor.ator_tipo
     OR (v_context->>'actor_id')::uuid IS DISTINCT FROM v_actor.ator_id THEN
    RAISE EXCEPTION 'A sessão autenticada não corresponde à sessão administrativa.' USING ERRCODE='42501';
  END IF;
  PERFORM public.gsa_admin_assert_module(p_module);
  ator_tipo := v_actor.ator_tipo;
  ator_id := v_actor.ator_id;
  ator_nome := v_actor.ator_nome;
  RETURN NEXT;
END;
$$;

CREATE TABLE IF NOT EXISTS public.gsa_admin_mutation_requests (
  request_id uuid PRIMARY KEY,
  actor_type text NOT NULL CHECK (actor_type IN ('admin','colaborador')),
  actor_id uuid NOT NULL,
  operation text NOT NULL,
  resource text NOT NULL,
  result jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  completed_at timestamptz
);
ALTER TABLE public.gsa_admin_mutation_requests ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.gsa_admin_mutation_requests FROM PUBLIC, anon, authenticated;
GRANT ALL ON public.gsa_admin_mutation_requests TO service_role;

CREATE OR REPLACE FUNCTION public.gsa_admin_claim_mutation(
  p_request_id uuid, p_actor_type text, p_actor_id uuid,
  p_operation text, p_resource text
) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE v_existing public.gsa_admin_mutation_requests%ROWTYPE;
BEGIN
  INSERT INTO public.gsa_admin_mutation_requests(request_id,actor_type,actor_id,operation,resource)
  VALUES(p_request_id,p_actor_type,p_actor_id,p_operation,p_resource)
  ON CONFLICT (request_id) DO NOTHING;
  IF FOUND THEN RETURN NULL; END IF;
  SELECT * INTO v_existing FROM public.gsa_admin_mutation_requests WHERE request_id=p_request_id;
  IF v_existing.actor_type<>p_actor_type OR v_existing.actor_id<>p_actor_id
     OR v_existing.operation<>p_operation OR v_existing.resource<>p_resource THEN
    RAISE EXCEPTION 'request_id já utilizado em outra operação.' USING ERRCODE='23505';
  END IF;
  IF v_existing.completed_at IS NULL THEN
    RAISE EXCEPTION 'Operação idempotente ainda em processamento.' USING ERRCODE='55P03';
  END IF;
  RETURN v_existing.result;
END;
$$;

CREATE OR REPLACE FUNCTION public.gsa_admin_complete_mutation(
  p_request_id uuid, p_result jsonb
) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
BEGIN
  UPDATE public.gsa_admin_mutation_requests
     SET result=COALESCE(p_result,'{}'::jsonb), completed_at=now()
   WHERE request_id=p_request_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'request_id administrativo não encontrado.'; END IF;
  RETURN COALESCE(p_result,'{}'::jsonb);
END;
$$;

REVOKE ALL ON FUNCTION public.gsa_admin_claim_mutation(uuid,text,uuid,text,text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.gsa_admin_complete_mutation(uuid,jsonb) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.gsa_admin_claim_mutation(uuid,text,uuid,text,text) TO service_role;
GRANT EXECUTE ON FUNCTION public.gsa_admin_complete_mutation(uuid,jsonb) TO service_role;

-- As funções administrativas antigas permanecem apenas para chamadas internas/owner.
REVOKE ALL ON FUNCTION public.gsa_admin_calculator_pro_snapshot() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.gsa_admin_save_scraping_config(jsonb) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.gsa_admin_save_travel_category(jsonb) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.gsa_admin_emprestimo_add_historico(uuid,uuid,text,text,text,uuid,jsonb) FROM PUBLIC, anon, authenticated;

-- Tabelas internas nunca são API de dados do navegador.
DO $$
DECLARE r record; p record;
BEGIN
  FOR r IN SELECT unnest(ARRAY[
    'sistema_sessoes','gsa_auth_identities','gsa_auth_attempts','gsa_auth_rate_limits',
    'gsa_admin_audit_events','gsa_admin_operation_requests','gsa_admin_notification_state',
    'gsa_admin_mutation_requests'
  ]) AS t LOOP
    IF to_regclass('public.'||r.t) IS NOT NULL THEN
      EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY',r.t);
      EXECUTE format('REVOKE ALL ON public.%I FROM PUBLIC, anon, authenticated',r.t);
      FOR p IN SELECT policyname FROM pg_policies
        WHERE schemaname='public' AND tablename=r.t LOOP
        EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I',p.policyname,r.t);
      END LOOP;
    END IF;
  END LOOP;
END $$;

-- Remove políticas públicas verdadeiras das tabelas administrativas/financeiras.
DO $$
DECLARE r record; p record;
BEGIN
  FOR r IN SELECT unnest(ARRAY[
    'admin_notificacoes','colaboradores','colaborador_modulos','cliente_notas_admin',
    'cobrancas','cobranca_historico','pagamentos','extrato_financeiro',
    'emprestimo_documentos','emprestimo_parcelas','orcamentos','ordens_compra','ordens_assinatura',
    'prestador_documentos','prestador_faturas','prestador_saques','prestador_transacoes','prestador_vouchers',
    'automacao_scraping_configs','automacao_scraping_logs','solicitacoes_exclusao'
  ]) AS t LOOP
    IF to_regclass('public.'||r.t) IS NOT NULL THEN
      EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY',r.t);
      EXECUTE format('REVOKE ALL ON public.%I FROM PUBLIC, anon',r.t);
      EXECUTE format('GRANT SELECT,INSERT,UPDATE,DELETE ON public.%I TO authenticated',r.t);
      FOR p IN SELECT policyname FROM pg_policies
        WHERE schemaname='public' AND tablename=r.t
          AND (array_to_string(roles,',') LIKE '%public%' OR array_to_string(roles,',') LIKE '%anon%')
          AND coalesce(qual,'true')='true' AND coalesce(with_check,'true')='true'
      LOOP
        EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I',p.policyname,r.t);
      END LOOP;
      EXECUTE format('DROP POLICY IF EXISTS gsa_management_hardened ON public.%I',r.t);
      EXECUTE format(
        'CREATE POLICY gsa_management_hardened ON public.%I AS PERMISSIVE FOR ALL TO authenticated USING (public.gsa_jwt_actor_type() IN (''admin'',''colaborador'')) WITH CHECK (public.gsa_jwt_actor_type() IN (''admin'',''colaborador''))', r.t
      );
    END IF;
  END LOOP;
END $$;

-- Ownership mínimo para portais autenticados.
DROP POLICY IF EXISTS gsa_client_own_orcamentos_hardened ON public.orcamentos;
CREATE POLICY gsa_client_own_orcamentos_hardened ON public.orcamentos FOR SELECT TO authenticated
USING (public.gsa_jwt_actor_type()='cliente' AND cliente_id=public.gsa_jwt_actor_id());
DROP POLICY IF EXISTS gsa_client_own_ordens_compra_hardened ON public.ordens_compra;
CREATE POLICY gsa_client_own_ordens_compra_hardened ON public.ordens_compra FOR SELECT TO authenticated
USING (public.gsa_jwt_actor_type()='cliente' AND cliente_id=public.gsa_jwt_actor_id());
DROP POLICY IF EXISTS gsa_client_own_ordens_assinatura_hardened ON public.ordens_assinatura;
CREATE POLICY gsa_client_own_ordens_assinatura_hardened ON public.ordens_assinatura FOR SELECT TO authenticated
USING (public.gsa_jwt_actor_type()='cliente' AND cliente_id=public.gsa_jwt_actor_id());
DROP POLICY IF EXISTS gsa_client_own_emprestimo_documentos_hardened ON public.emprestimo_documentos;
CREATE POLICY gsa_client_own_emprestimo_documentos_hardened ON public.emprestimo_documentos FOR SELECT TO authenticated
USING (public.gsa_jwt_actor_type()='cliente' AND cliente_id=public.gsa_jwt_actor_id());
DROP POLICY IF EXISTS gsa_client_own_emprestimo_parcelas_hardened ON public.emprestimo_parcelas;
CREATE POLICY gsa_client_own_emprestimo_parcelas_hardened ON public.emprestimo_parcelas FOR SELECT TO authenticated
USING (public.gsa_jwt_actor_type()='cliente' AND cliente_id=public.gsa_jwt_actor_id());
DROP POLICY IF EXISTS gsa_client_own_cobrancas_hardened ON public.cobrancas;
CREATE POLICY gsa_client_own_cobrancas_hardened ON public.cobrancas FOR SELECT TO authenticated
USING (public.gsa_jwt_actor_type()='cliente' AND cliente_id=public.gsa_jwt_actor_id());
DROP POLICY IF EXISTS gsa_client_own_cobranca_historico_hardened ON public.cobranca_historico;
CREATE POLICY gsa_client_own_cobranca_historico_hardened ON public.cobranca_historico FOR SELECT TO authenticated
USING (public.gsa_jwt_actor_type()='cliente' AND EXISTS (SELECT 1 FROM public.cobrancas c WHERE c.id=cobranca_id AND c.cliente_id=public.gsa_jwt_actor_id()));
DROP POLICY IF EXISTS gsa_client_own_extrato_hardened ON public.extrato_financeiro;
CREATE POLICY gsa_client_own_extrato_hardened ON public.extrato_financeiro FOR SELECT TO authenticated
USING (public.gsa_jwt_actor_type()='cliente' AND cliente_id=public.gsa_jwt_actor_id());
DROP POLICY IF EXISTS gsa_client_own_pagamentos_hardened ON public.pagamentos;
CREATE POLICY gsa_client_own_pagamentos_hardened ON public.pagamentos FOR SELECT TO authenticated
USING (public.gsa_jwt_actor_type()='cliente' AND EXISTS (SELECT 1 FROM public.faturas f WHERE f.id=fatura_id AND f.cliente_id=public.gsa_jwt_actor_id()));

DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['prestador_documentos','prestador_faturas','prestador_saques','prestador_transacoes','prestador_vouchers'] LOOP
    EXECUTE format('DROP POLICY IF EXISTS gsa_provider_own_hardened ON public.%I',t);
    EXECUTE format('CREATE POLICY gsa_provider_own_hardened ON public.%I FOR SELECT TO authenticated USING (public.gsa_jwt_actor_type()=''prestador'' AND prestador_id=public.gsa_jwt_actor_id())',t);
  END LOOP;
END $$;
-- Uma única fronteira RESTRICTIVE por módulo para colaboradores.
DO $$
DECLARE r record;
BEGIN
  FOR r IN SELECT * FROM (VALUES
    ('clientes','cadastro'),('cliente_documentos','cadastro'),('cliente_notas_admin','cadastro'),
    ('prestadores','prestadores'),('prestador_documentos','prestadores'),('prestador_historico','prestadores'),
    ('servicos','catalogo'),('produtos','catalogo'),('assinaturas','catalogo'),
    ('orcamentos','operacoes'),('ordens_servico','operacoes'),('ordens_compra','operacoes'),('ordens_assinatura','operacoes'),
    ('prestador_demandas','demandas'),('prestador_demandas_historico','demandas'),('demanda_comentarios','demandas'),
    ('tickets','atendimento'),('ticket_mensagens','atendimento'),
    ('faturas','financeiro'),('pagamentos','financeiro'),('extrato_financeiro','financeiro'),('saques','financeiro'),('transferencias','financeiro'),
    ('prestador_faturas','financeiro'),('prestador_saques','financeiro'),('prestador_transacoes','financeiro'),
    ('cobrancas','cobranca'),('cobranca_historico','cobranca'),('cobranca_acordo_parcelas','cobranca'),
    ('emprestimos','emprestimos'),('emprestimo_documentos','emprestimos'),('emprestimo_parcelas','emprestimos'),('emprestimo_historico','emprestimos'),
    ('loja_credito_solicitacoes','credito_loja'),('loja_credito_movimentacoes','credito_loja'),('loja_credito_documentos','credito_loja'),
    ('loja_credito_cancelamentos_limite','credito_loja'),('loja_credito_contestacoes','credito_loja'),('loja_credito_contestacao_eventos','credito_loja'),
    ('loja_credito_saques','credito_loja'),('loja_credito_saque_eventos','credito_loja'),
    ('viagens_categorias','viagens'),('viagens_pacotes','viagens'),('viagens_pacote_imagens','viagens'),('viagens_propostas','viagens'),('viagens_reservas','viagens'),
    ('automacao_scraping_configs','sistema'),('automacao_scraping_logs','sistema'),('gsa_whatsapp_ramais','sistema'),
    ('colaboradores','acessos'),('colaborador_modulos','acessos'),('solicitacoes_exclusao','acessos'),
    ('admin_notificacoes','dashboard'),('ordens_fiscais','fiscal'),
    ('prestador_vouchers','prestadores'),('prestador_premios','prestadores'),('prestador_promocoes','prestadores'),
    ('vouchers','fidelidade'),('contratos','operacoes'),('loja_categorias','loja'),
    ('gsa_tv_media_items','sistema'),('gsa_tv_schedule_slots','sistema'),('gsa_tv_channels','sistema'),('gsa_tv_audit_log','sistema')
  ) AS x(table_name,module_name) LOOP
    IF to_regclass('public.'||r.table_name) IS NOT NULL THEN
      EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY',r.table_name);
      EXECUTE format('DROP POLICY IF EXISTS collaborator_module_guard_%I ON public.%I',r.table_name,r.table_name);
      EXECUTE format('DROP POLICY IF EXISTS gsa_collaborator_module_%I ON public.%I',r.table_name,r.table_name);
      EXECUTE format(
        'CREATE POLICY gsa_collaborator_module_%I ON public.%I AS RESTRICTIVE FOR ALL TO authenticated USING (public.gsa_admin_restrict_collaborator_to_module(%L)) WITH CHECK (public.gsa_admin_restrict_collaborator_to_module(%L))',
        r.table_name,r.table_name,r.module_name,r.module_name
      );
    END IF;
  END LOOP;
END $$;

CREATE OR REPLACE FUNCTION public.gsa_admin_table_module(p_table text)
RETURNS text LANGUAGE sql IMMUTABLE AS $$
SELECT CASE p_table
  WHEN 'clientes' THEN 'cadastro' WHEN 'cliente_documentos' THEN 'cadastro' WHEN 'cliente_notas_admin' THEN 'cadastro'
  WHEN 'prestadores' THEN 'prestadores' WHEN 'prestador_documentos' THEN 'prestadores' WHEN 'prestador_historico' THEN 'prestadores'
  WHEN 'servicos' THEN 'catalogo' WHEN 'produtos' THEN 'catalogo' WHEN 'assinaturas' THEN 'catalogo'
  WHEN 'orcamentos' THEN 'operacoes' WHEN 'ordens_servico' THEN 'operacoes' WHEN 'ordens_compra' THEN 'operacoes' WHEN 'ordens_assinatura' THEN 'operacoes'
  WHEN 'prestador_demandas' THEN 'demandas' WHEN 'prestador_demandas_historico' THEN 'demandas' WHEN 'demanda_comentarios' THEN 'demandas'
  WHEN 'tickets' THEN 'atendimento' WHEN 'ticket_mensagens' THEN 'atendimento'
  WHEN 'faturas' THEN 'financeiro' WHEN 'pagamentos' THEN 'financeiro' WHEN 'extrato_financeiro' THEN 'financeiro' WHEN 'saques' THEN 'financeiro' WHEN 'transferencias' THEN 'financeiro'
  WHEN 'prestador_faturas' THEN 'financeiro' WHEN 'prestador_saques' THEN 'financeiro' WHEN 'prestador_transacoes' THEN 'financeiro'
  WHEN 'cobrancas' THEN 'cobranca' WHEN 'cobranca_historico' THEN 'cobranca' WHEN 'cobranca_acordo_parcelas' THEN 'cobranca'
  WHEN 'emprestimos' THEN 'emprestimos' WHEN 'emprestimo_documentos' THEN 'emprestimos' WHEN 'emprestimo_parcelas' THEN 'emprestimos' WHEN 'emprestimo_historico' THEN 'emprestimos'
  WHEN 'loja_credito_solicitacoes' THEN 'credito_loja' WHEN 'loja_credito_movimentacoes' THEN 'credito_loja' WHEN 'loja_credito_documentos' THEN 'credito_loja'
  WHEN 'loja_credito_cancelamentos_limite' THEN 'credito_loja' WHEN 'loja_credito_contestacoes' THEN 'credito_loja' WHEN 'loja_credito_saques' THEN 'credito_loja'
  WHEN 'viagens_categorias' THEN 'viagens' WHEN 'viagens_pacotes' THEN 'viagens' WHEN 'viagens_propostas' THEN 'viagens' WHEN 'viagens_reservas' THEN 'viagens'
  WHEN 'automacao_scraping_configs' THEN 'sistema' WHEN 'automacao_scraping_logs' THEN 'sistema' WHEN 'gsa_whatsapp_ramais' THEN 'sistema'
  WHEN 'colaboradores' THEN 'acessos' WHEN 'colaborador_modulos' THEN 'acessos' WHEN 'solicitacoes_exclusao' THEN 'acessos'
  WHEN 'admin_notificacoes' THEN 'dashboard' WHEN 'ordens_fiscais' THEN 'fiscal'
  WHEN 'prestador_vouchers' THEN 'prestadores' WHEN 'prestador_premios' THEN 'prestadores' WHEN 'prestador_promocoes' THEN 'prestadores'
  WHEN 'vouchers' THEN 'fidelidade' WHEN 'contratos' THEN 'operacoes' WHEN 'loja_categorias' THEN 'loja'
  WHEN 'system_settings' THEN 'configuracoes'
  ELSE 'administrativo' END;
$$;

CREATE OR REPLACE FUNCTION public.gsa_admin_sensitive_change_audit()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE
  v_claims jsonb := COALESCE(auth.jwt(),'{}'::jsonb);
  v_actor_type text := COALESCE(v_claims->'app_metadata'->>'gsa_actor_type','');
  v_actor_id_text text := COALESCE(v_claims->'app_metadata'->>'gsa_actor_id','');
  v_session_id_text text := COALESCE(v_claims->'app_metadata'->>'gsa_session_id','');
  v_actor_id uuid; v_session_id uuid; v_session jsonb; v_row jsonb;
  v_old jsonb := CASE WHEN TG_OP='INSERT' THEN '{}'::jsonb ELSE to_jsonb(OLD) END;
  v_new jsonb := CASE WHEN TG_OP='DELETE' THEN '{}'::jsonb ELSE to_jsonb(NEW) END;
  v_target_id uuid; v_module text;
BEGIN
  IF v_actor_type NOT IN ('admin','colaborador') THEN
    RETURN CASE WHEN TG_OP='DELETE' THEN OLD ELSE NEW END;
  END IF;
  BEGIN
    v_actor_id:=v_actor_id_text::uuid; v_session_id:=v_session_id_text::uuid;
  EXCEPTION WHEN invalid_text_representation THEN
    RAISE EXCEPTION 'Identidade administrativa inválida para auditoria.' USING ERRCODE='42501';
  END;
  SELECT to_jsonb(s) INTO v_session FROM public.sistema_sessoes s WHERE s.id=v_session_id LIMIT 1;
  IF v_session IS NULL
     OR lower(COALESCE(v_session->>'status',v_session->>'situacao','')) NOT IN ('ativo','ativa','active')
     OR COALESCE(v_session->>'ator_tipo',v_session->>'tipo_ator',v_actor_type)<>v_actor_type
     OR COALESCE(v_session->>'ator_id',v_session->>'usuario_id',v_session->>'colaborador_id',v_actor_id::text)<>v_actor_id::text THEN
    RAISE EXCEPTION 'Sessão administrativa inválida para auditoria.' USING ERRCODE='42501';
  END IF;
  v_row:=CASE WHEN TG_OP='DELETE' THEN v_old ELSE v_new END;
  BEGIN v_target_id:=nullif(v_row->>'id','')::uuid;
  EXCEPTION WHEN invalid_text_representation THEN v_target_id:=NULL; END;
  v_module:=public.gsa_admin_table_module(TG_TABLE_NAME);
  INSERT INTO public.gsa_admin_audit_events(actor_type,actor_id,module,action,target_type,target_id,details)
  VALUES(v_actor_type,v_actor_id,v_module,TG_OP||'_'||upper(TG_TABLE_NAME),TG_TABLE_NAME,v_target_id,
    jsonb_strip_nulls(jsonb_build_object(
      'session_id',v_session_id,'old_status',v_old->>'status','new_status',v_new->>'status',
      'old_emission_status',v_old->>'status_emissao','new_emission_status',v_new->>'status_emissao'
    )));
  RETURN CASE WHEN TG_OP='DELETE' THEN OLD ELSE NEW END;
END;
$$;

CREATE OR REPLACE FUNCTION public.gsa_admin_session_change_audit()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE
  v_actor_type text := COALESCE(auth.jwt()->'app_metadata'->>'gsa_actor_type','sistema');
  v_actor_id uuid; v_id uuid;
BEGIN
  BEGIN v_actor_id := nullif(auth.jwt()->'app_metadata'->>'gsa_actor_id','')::uuid;
  EXCEPTION WHEN invalid_text_representation THEN v_actor_id := NULL; END;
  v_id := CASE WHEN TG_OP='DELETE' THEN OLD.id ELSE NEW.id END;
  INSERT INTO public.gsa_admin_audit_events(actor_type,actor_id,module,action,target_type,target_id,details)
  VALUES(CASE WHEN v_actor_type IN ('admin','colaborador') THEN v_actor_type ELSE 'sistema' END,
    v_actor_id,'acessos',TG_OP||'_SISTEMA_SESSOES','sistema_sessoes',v_id,
    jsonb_strip_nulls(jsonb_build_object(
      'old_status',CASE WHEN TG_OP='INSERT' THEN NULL ELSE OLD.status END,
      'new_status',CASE WHEN TG_OP='DELETE' THEN NULL ELSE NEW.status END
    )));
  RETURN CASE WHEN TG_OP='DELETE' THEN OLD ELSE NEW END;
END;
$$;

DROP TRIGGER IF EXISTS trg_audit_cobrancas ON public.cobrancas;
DROP TRIGGER IF EXISTS trg_audit_faturas ON public.faturas;
DROP TRIGGER IF EXISTS trg_gsa_admin_audit_sistema_sessoes ON public.sistema_sessoes;
CREATE TRIGGER trg_gsa_admin_audit_sistema_sessoes
AFTER INSERT OR UPDATE OR DELETE ON public.sistema_sessoes
FOR EACH ROW EXECUTE FUNCTION public.gsa_admin_session_change_audit();

DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'pagamentos','ordens_compra','ordens_assinatura','cliente_notas_admin','cobranca_historico',
    'emprestimo_documentos','emprestimo_parcelas','prestador_documentos','prestador_faturas',
    'prestador_saques','prestador_transacoes','prestador_vouchers','automacao_scraping_configs','solicitacoes_exclusao'
  ] LOOP
    IF to_regclass('public.'||t) IS NOT NULL AND NOT EXISTS (
      SELECT 1 FROM pg_trigger tr JOIN pg_class c ON c.oid=tr.tgrelid
      WHERE c.oid=to_regclass('public.'||t) AND NOT tr.tgisinternal
        AND tr.tgname='trg_gsa_admin_audit_'||t
    ) THEN
      EXECUTE format('CREATE TRIGGER %I AFTER INSERT OR UPDATE OR DELETE ON public.%I FOR EACH ROW EXECUTE FUNCTION public.gsa_admin_sensitive_change_audit()',
        'trg_gsa_admin_audit_'||t,t);
    END IF;
  END LOOP;
END $$;

-- Exclusão de categoria de viagens, agora idempotente e com sessão/módulo.
CREATE OR REPLACE FUNCTION public.gsa_admin_delete_travel_category(
  p_sessao_id uuid, p_session_token text, p_categoria_id uuid, p_request_id uuid
) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE v_actor record; v_cached jsonb; v_result jsonb;
BEGIN
  SELECT * INTO v_actor FROM public.gsa_admin_session_assert_module(p_sessao_id,p_session_token,'viagens') LIMIT 1;
  v_cached:=public.gsa_admin_claim_mutation(p_request_id,v_actor.ator_tipo,v_actor.ator_id,'delete_travel_category',p_categoria_id::text);
  IF v_cached IS NOT NULL THEN RETURN v_cached; END IF;
  DELETE FROM public.viagens_categorias WHERE id=p_categoria_id RETURNING jsonb_build_object('id',id,'deleted',true) INTO v_result;
  IF v_result IS NULL THEN RAISE EXCEPTION 'Categoria de viagem não encontrada.' USING ERRCODE='P0002'; END IF;
  RETURN public.gsa_admin_complete_mutation(p_request_id,v_result);
END;
$$;

CREATE OR REPLACE FUNCTION public.gsa_admin_whatsapp_mutation(
  p_sessao_id uuid, p_session_token text, p_action text, p_payload jsonb, p_request_id uuid
) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE v_actor record; v_cached jsonb; v_result jsonb; v_action text:=lower(trim(p_action));
  v_id uuid; v_item jsonb; v_key text; v_value text;
BEGIN
  SELECT * INTO v_actor FROM public.gsa_admin_session_assert_module(p_sessao_id,p_session_token,'sistema') LIMIT 1;
  v_cached:=public.gsa_admin_claim_mutation(p_request_id,v_actor.ator_tipo,v_actor.ator_id,'whatsapp_'||v_action,coalesce(p_payload->>'id',p_payload->>'key','whatsapp'));
  IF v_cached IS NOT NULL THEN RETURN v_cached; END IF;
  IF v_action='save_setting' THEN
    v_key:=trim(coalesce(p_payload->>'key','')); v_value:=coalesce(p_payload->>'value','');
    IF v_key !~ '^(gsa_whatsapp_|whatsapp_)[a-z0-9_]{1,80}$' OR length(v_value)>200000 THEN
      RAISE EXCEPTION 'Configuração de WhatsApp inválida.';
    END IF;
    INSERT INTO public.system_settings(key,value,updated_at) VALUES(v_key,v_value,now())
    ON CONFLICT (key) DO UPDATE SET value=excluded.value,updated_at=now();
    v_result:=jsonb_build_object('success',true,'key',v_key);
  ELSIF v_action='delete_setting' THEN
    v_key:=trim(coalesce(p_payload->>'key',''));
    IF v_key !~ '^(gsa_whatsapp_|whatsapp_)[a-z0-9_]{1,80}$' THEN RAISE EXCEPTION 'Chave inválida.'; END IF;
    DELETE FROM public.system_settings WHERE key=v_key;
    v_result:=jsonb_build_object('success',true,'key',v_key,'deleted',true);
  ELSIF v_action='upsert_ramal' THEN
    v_id:=nullif(p_payload->>'id','')::uuid;
    IF v_id IS NULL THEN
      INSERT INTO public.gsa_whatsapp_ramais(setor_nome,codigo_setor,numero_whatsapp,responsavel_nome,ativo,ordem)
      VALUES(trim(p_payload->>'setor_nome'),trim(p_payload->>'codigo_setor'),trim(p_payload->>'numero_whatsapp'),
        trim(p_payload->>'responsavel_nome'),coalesce((p_payload->>'ativo')::boolean,true),coalesce((p_payload->>'ordem')::int,1))
      RETURNING to_jsonb(gsa_whatsapp_ramais) INTO v_result;
    ELSE
      UPDATE public.gsa_whatsapp_ramais r SET
        setor_nome=CASE WHEN p_payload?'setor_nome' THEN trim(p_payload->>'setor_nome') ELSE r.setor_nome END,
        codigo_setor=CASE WHEN p_payload?'codigo_setor' THEN trim(p_payload->>'codigo_setor') ELSE r.codigo_setor END,
        numero_whatsapp=CASE WHEN p_payload?'numero_whatsapp' THEN trim(p_payload->>'numero_whatsapp') ELSE r.numero_whatsapp END,
        responsavel_nome=CASE WHEN p_payload?'responsavel_nome' THEN trim(p_payload->>'responsavel_nome') ELSE r.responsavel_nome END,
        ativo=CASE WHEN p_payload?'ativo' THEN (p_payload->>'ativo')::boolean ELSE r.ativo END,
        ordem=CASE WHEN p_payload?'ordem' THEN (p_payload->>'ordem')::int ELSE r.ordem END, updated_at=now()
      WHERE r.id=v_id RETURNING to_jsonb(r) INTO v_result;
    END IF;
    IF v_result IS NULL THEN RAISE EXCEPTION 'Ramal não encontrado.' USING ERRCODE='P0002'; END IF;
  ELSIF v_action='delete_ramal' THEN
    v_id:=(p_payload->>'id')::uuid;
    DELETE FROM public.gsa_whatsapp_ramais r WHERE r.id=v_id RETURNING jsonb_build_object('id',r.id,'deleted',true) INTO v_result;
    IF v_result IS NULL THEN RAISE EXCEPTION 'Ramal não encontrado.' USING ERRCODE='P0002'; END IF;
  ELSIF v_action='reorder_ramais' THEN
    IF jsonb_typeof(p_payload->'items')<>'array' THEN RAISE EXCEPTION 'Lista de ramais inválida.'; END IF;
    FOR v_item IN SELECT value FROM jsonb_array_elements(p_payload->'items') LOOP
      UPDATE public.gsa_whatsapp_ramais
         SET ordem=(v_item->>'ordem')::int,updated_at=now()
       WHERE id=(v_item->>'id')::uuid;
    END LOOP;
    v_result:=jsonb_build_object('success',true,'updated',jsonb_array_length(p_payload->'items'));
  ELSE
    RAISE EXCEPTION 'Ação de WhatsApp não permitida.';
  END IF;
  RETURN public.gsa_admin_complete_mutation(p_request_id,v_result);
END;
$$;

CREATE OR REPLACE FUNCTION public.gsa_admin_update_provider_demand(
  p_sessao_id uuid, p_session_token text, p_demanda_id uuid,
  p_expected_status text, p_patch jsonb, p_request_id uuid
) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE v_actor record; v_cached jsonb; v_result jsonb; v_row public.prestador_demandas%ROWTYPE;
BEGIN
  SELECT * INTO v_actor FROM public.gsa_admin_session_assert_module(p_sessao_id,p_session_token,'demandas') LIMIT 1;
  v_cached:=public.gsa_admin_claim_mutation(p_request_id,v_actor.ator_tipo,v_actor.ator_id,'update_provider_demand',p_demanda_id::text);
  IF v_cached IS NOT NULL THEN RETURN v_cached; END IF;
  IF EXISTS (SELECT 1 FROM jsonb_object_keys(p_patch) k WHERE k NOT IN (
    'status','prestador_id','colaborador_id','valor_proposto_admin','valor_final','data_inicio','data_conclusao',
    'prazo_entrega','prazo_limite','prioridade','motivo_negociacao','is_contraproposta_final','status_ajuste',
    'ajuste_solicitado','prazo_ajuste','notas_internas','status_aceite','motivo_recusa')) THEN
    RAISE EXCEPTION 'Campo de demanda não permitido.' USING ERRCODE='42501';
  END IF;
  v_row:=jsonb_populate_record(NULL::public.prestador_demandas,p_patch);
  UPDATE public.prestador_demandas d SET
    status=CASE WHEN p_patch?'status' THEN v_row.status ELSE d.status END,
    prestador_id=CASE WHEN p_patch?'prestador_id' THEN v_row.prestador_id ELSE d.prestador_id END,
    colaborador_id=CASE WHEN p_patch?'colaborador_id' THEN v_row.colaborador_id ELSE d.colaborador_id END,
    valor_proposto_admin=CASE WHEN p_patch?'valor_proposto_admin' THEN v_row.valor_proposto_admin ELSE d.valor_proposto_admin END,
    valor_final=CASE WHEN p_patch?'valor_final' THEN v_row.valor_final ELSE d.valor_final END,
    data_inicio=CASE WHEN p_patch?'data_inicio' THEN v_row.data_inicio ELSE d.data_inicio END,
    data_conclusao=CASE WHEN p_patch?'data_conclusao' THEN v_row.data_conclusao ELSE d.data_conclusao END,
    prazo_entrega=CASE WHEN p_patch?'prazo_entrega' THEN v_row.prazo_entrega ELSE d.prazo_entrega END,
    prazo_limite=CASE WHEN p_patch?'prazo_limite' THEN v_row.prazo_limite ELSE d.prazo_limite END,
    prioridade=CASE WHEN p_patch?'prioridade' THEN v_row.prioridade ELSE d.prioridade END,
    motivo_negociacao=CASE WHEN p_patch?'motivo_negociacao' THEN v_row.motivo_negociacao ELSE d.motivo_negociacao END,
    is_contraproposta_final=CASE WHEN p_patch?'is_contraproposta_final' THEN v_row.is_contraproposta_final ELSE d.is_contraproposta_final END,
    status_ajuste=CASE WHEN p_patch?'status_ajuste' THEN v_row.status_ajuste ELSE d.status_ajuste END,
    ajuste_solicitado=CASE WHEN p_patch?'ajuste_solicitado' THEN v_row.ajuste_solicitado ELSE d.ajuste_solicitado END,
    prazo_ajuste=CASE WHEN p_patch?'prazo_ajuste' THEN v_row.prazo_ajuste ELSE d.prazo_ajuste END,
    notas_internas=CASE WHEN p_patch?'notas_internas' THEN v_row.notas_internas ELSE d.notas_internas END,
    status_aceite=CASE WHEN p_patch?'status_aceite' THEN v_row.status_aceite ELSE d.status_aceite END,
    motivo_recusa=CASE WHEN p_patch?'motivo_recusa' THEN v_row.motivo_recusa ELSE d.motivo_recusa END,
    updated_at=now()
  WHERE d.id=p_demanda_id AND (p_expected_status IS NULL OR d.status=p_expected_status)
  RETURNING to_jsonb(d) INTO v_result;
  IF v_result IS NULL THEN RAISE EXCEPTION 'Demanda alterada por outra sessão ou não encontrada.' USING ERRCODE='40001'; END IF;
  RETURN public.gsa_admin_complete_mutation(p_request_id,v_result);
END;
$$;

CREATE OR REPLACE FUNCTION public.gsa_admin_create_provider(
  p_sessao_id uuid, p_session_token text, p_payload jsonb, p_request_id uuid
) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE v_actor record; v_cached jsonb; v_result jsonb; v_id uuid; v_credential text; i int;
BEGIN
  SELECT * INTO v_actor FROM public.gsa_admin_session_assert_module(p_sessao_id,p_session_token,'prestadores') LIMIT 1;
  v_cached:=public.gsa_admin_claim_mutation(p_request_id,v_actor.ator_tipo,v_actor.ator_id,'create_provider',coalesce(p_payload->>'documento','provider'));
  IF v_cached IS NOT NULL THEN RETURN v_cached; END IF;
  IF trim(coalesce(p_payload->>'nome_razao',''))='' OR trim(coalesce(p_payload->>'documento',''))=''
     OR trim(coalesce(p_payload->>'email',''))='' OR trim(coalesce(p_payload->>'telefone',''))='' THEN
    RAISE EXCEPTION 'Nome, documento, e-mail e telefone são obrigatórios.';
  END IF;
  FOR i IN 1..20 LOOP
    v_credential:=(100000+floor(random()*900000))::int::text;
    EXIT WHEN NOT EXISTS (SELECT 1 FROM public.prestadores WHERE credencial_acesso=v_credential);
  END LOOP;
  INSERT INTO public.prestadores(tipo_cadastro,nome_razao,nome_responsavel,documento,email,telefone,cep,area_servico,observacoes,status,credencial_acesso,numero,nome_completo)
  VALUES(coalesce(nullif(trim(p_payload->>'tipo_cadastro'),''),'PF'),trim(p_payload->>'nome_razao'),nullif(trim(p_payload->>'nome_responsavel'),''),
    regexp_replace(p_payload->>'documento','\D','','g'),lower(trim(p_payload->>'email')),regexp_replace(p_payload->>'telefone','\D','','g'),
    nullif(trim(p_payload->>'cep'),''),nullif(trim(p_payload->>'area_servico'),''),nullif(trim(p_payload->>'observacoes'),''),
    coalesce(nullif(trim(p_payload->>'status'),''),'ativo'),v_credential,nullif(trim(p_payload->>'numero'),''),nullif(trim(p_payload->>'nome_completo'),''))
  RETURNING id INTO v_id;
  INSERT INTO public.prestador_historico(prestador_id,acao,descricao)
  VALUES(v_id,'Cadastro realizado via painel Enterprise','Cadastro administrativo protegido por sessão e RBAC.');
  v_result:=jsonb_build_object('id',v_id,'credencial_acesso',v_credential,'success',true);
  RETURN public.gsa_admin_complete_mutation(p_request_id,v_result);
END;
$$;

CREATE OR REPLACE FUNCTION public.gsa_admin_service_mutation(
  p_sessao_id uuid, p_session_token text, p_action text, p_servico_id uuid,
  p_payload jsonb, p_request_id uuid
) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE v_actor record; v_cached jsonb; v_result jsonb; v_row public.servicos%ROWTYPE; v_action text:=lower(trim(p_action));
BEGIN
  SELECT * INTO v_actor FROM public.gsa_admin_session_assert_module(p_sessao_id,p_session_token,'catalogo') LIMIT 1;
  v_cached:=public.gsa_admin_claim_mutation(p_request_id,v_actor.ator_tipo,v_actor.ator_id,'service_'||v_action,coalesce(p_servico_id::text,p_payload->>'nome','service'));
  IF v_cached IS NOT NULL THEN RETURN v_cached; END IF;
  IF v_action='delete' THEN
    DELETE FROM public.servicos s WHERE s.id=p_servico_id RETURNING jsonb_build_object('id',s.id,'deleted',true) INTO v_result;
    IF v_result IS NULL THEN RAISE EXCEPTION 'Serviço não encontrado.' USING ERRCODE='P0002'; END IF;
    RETURN public.gsa_admin_complete_mutation(p_request_id,v_result);
  END IF;
  IF v_action<>'save' THEN RAISE EXCEPTION 'Ação de serviço não permitida.'; END IF;
  IF EXISTS (SELECT 1 FROM jsonb_object_keys(coalesce(p_payload,'{}'::jsonb)) k WHERE k NOT IN (
    'nome','descricao','valor','status','ocultar_valor','tipo_cliente','categoria','visivel_na_loja',
    'imagem_url','imagem_url_2','imagem_url_3','imagem_url_4','imagem_url_5','categoria_id','ordem_exibicao',
    'orcamento_disponivel','subtitulo_catalogo','visivel_catalogo_publico','disponivel_orcamento','ordem_catalogo')) THEN
    RAISE EXCEPTION 'Campo de serviço não permitido.' USING ERRCODE='42501';
  END IF;
  v_row:=jsonb_populate_record(NULL::public.servicos,coalesce(p_payload,'{}'::jsonb));
  IF p_servico_id IS NULL THEN
    IF trim(coalesce(v_row.nome,''))='' OR v_row.valor IS NULL OR v_row.valor<0 THEN RAISE EXCEPTION 'Nome e valor válido são obrigatórios.'; END IF;
    INSERT INTO public.servicos(nome,descricao,valor,status,ocultar_valor,tipo_cliente,categoria,visivel_na_loja,
      imagem_url,imagem_url_2,imagem_url_3,imagem_url_4,imagem_url_5,categoria_id,ordem_exibicao,orcamento_disponivel,
      subtitulo_catalogo,visivel_catalogo_publico,disponivel_orcamento,ordem_catalogo)
    VALUES(v_row.nome,v_row.descricao,v_row.valor,coalesce(v_row.status,'ativo'),coalesce(v_row.ocultar_valor,false),coalesce(v_row.tipo_cliente,'pf'),v_row.categoria,coalesce(v_row.visivel_na_loja,false),
      v_row.imagem_url,v_row.imagem_url_2,v_row.imagem_url_3,v_row.imagem_url_4,v_row.imagem_url_5,v_row.categoria_id,coalesce(v_row.ordem_exibicao,0),coalesce(v_row.orcamento_disponivel,true),
      v_row.subtitulo_catalogo,coalesce(v_row.visivel_catalogo_publico,true),coalesce(v_row.disponivel_orcamento,true),coalesce(v_row.ordem_catalogo,0))
    RETURNING to_jsonb(servicos) INTO v_result;
  ELSE
    UPDATE public.servicos s SET
      nome=CASE WHEN p_payload?'nome' THEN v_row.nome ELSE s.nome END,
      descricao=CASE WHEN p_payload?'descricao' THEN v_row.descricao ELSE s.descricao END,
      valor=CASE WHEN p_payload?'valor' THEN v_row.valor ELSE s.valor END,
      status=CASE WHEN p_payload?'status' THEN v_row.status ELSE s.status END,
      ocultar_valor=CASE WHEN p_payload?'ocultar_valor' THEN v_row.ocultar_valor ELSE s.ocultar_valor END,
      tipo_cliente=CASE WHEN p_payload?'tipo_cliente' THEN v_row.tipo_cliente ELSE s.tipo_cliente END,
      categoria=CASE WHEN p_payload?'categoria' THEN v_row.categoria ELSE s.categoria END,
      visivel_na_loja=CASE WHEN p_payload?'visivel_na_loja' THEN v_row.visivel_na_loja ELSE s.visivel_na_loja END,
      imagem_url=CASE WHEN p_payload?'imagem_url' THEN v_row.imagem_url ELSE s.imagem_url END,
      imagem_url_2=CASE WHEN p_payload?'imagem_url_2' THEN v_row.imagem_url_2 ELSE s.imagem_url_2 END,
      imagem_url_3=CASE WHEN p_payload?'imagem_url_3' THEN v_row.imagem_url_3 ELSE s.imagem_url_3 END,
      imagem_url_4=CASE WHEN p_payload?'imagem_url_4' THEN v_row.imagem_url_4 ELSE s.imagem_url_4 END,
      imagem_url_5=CASE WHEN p_payload?'imagem_url_5' THEN v_row.imagem_url_5 ELSE s.imagem_url_5 END,
      categoria_id=CASE WHEN p_payload?'categoria_id' THEN v_row.categoria_id ELSE s.categoria_id END,
      ordem_exibicao=CASE WHEN p_payload?'ordem_exibicao' THEN v_row.ordem_exibicao ELSE s.ordem_exibicao END,
      orcamento_disponivel=CASE WHEN p_payload?'orcamento_disponivel' THEN v_row.orcamento_disponivel ELSE s.orcamento_disponivel END,
      subtitulo_catalogo=CASE WHEN p_payload?'subtitulo_catalogo' THEN v_row.subtitulo_catalogo ELSE s.subtitulo_catalogo END,
      visivel_catalogo_publico=CASE WHEN p_payload?'visivel_catalogo_publico' THEN v_row.visivel_catalogo_publico ELSE s.visivel_catalogo_publico END,
      disponivel_orcamento=CASE WHEN p_payload?'disponivel_orcamento' THEN v_row.disponivel_orcamento ELSE s.disponivel_orcamento END,
      ordem_catalogo=CASE WHEN p_payload?'ordem_catalogo' THEN v_row.ordem_catalogo ELSE s.ordem_catalogo END
    WHERE s.id=p_servico_id RETURNING to_jsonb(s) INTO v_result;
    IF v_result IS NULL THEN RAISE EXCEPTION 'Serviço não encontrado.' USING ERRCODE='P0002'; END IF;
  END IF;
  RETURN public.gsa_admin_complete_mutation(p_request_id,v_result);
END;
$$;

CREATE OR REPLACE FUNCTION public.gsa_admin_create_crm_client(
  p_sessao_id uuid, p_session_token text, p_payload jsonb, p_request_id uuid
) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE v_actor record; v_cached jsonb; v_result jsonb; v_row public.clientes%ROWTYPE;
BEGIN
  SELECT * INTO v_actor FROM public.gsa_admin_session_assert_module(p_sessao_id,p_session_token,'cadastro') LIMIT 1;
  v_cached:=public.gsa_admin_claim_mutation(p_request_id,v_actor.ator_tipo,v_actor.ator_id,'create_crm_client',coalesce(p_payload->>'cpf',p_payload->>'cnpj',p_payload->>'email','client'));
  IF v_cached IS NOT NULL THEN RETURN v_cached; END IF;
  IF EXISTS (SELECT 1 FROM jsonb_object_keys(coalesce(p_payload,'{}'::jsonb)) k WHERE k NOT IN (
    'nome','email','cpf','cnpj','tipo_pessoa','telefone','data_nascimento','cep','endereco','numero','bairro','cidade','estado','observacoes','status','cadastro_origem')) THEN
    RAISE EXCEPTION 'Campo de cliente não permitido.' USING ERRCODE='42501';
  END IF;
  v_row:=jsonb_populate_record(NULL::public.clientes,coalesce(p_payload,'{}'::jsonb));
  IF trim(coalesce(v_row.nome,''))='' THEN RAISE EXCEPTION 'Nome do cliente é obrigatório.'; END IF;
  INSERT INTO public.clientes(nome,email,cpf,cnpj,tipo_pessoa,telefone,data_nascimento,cep,endereco,numero,bairro,cidade,estado,observacoes,status,cadastro_origem)
  VALUES(v_row.nome,lower(v_row.email),nullif(regexp_replace(coalesce(v_row.cpf,''),'\D','','g'),''),nullif(regexp_replace(coalesce(v_row.cnpj,''),'\D','','g'),''),
    coalesce(v_row.tipo_pessoa,'pf'),v_row.telefone,v_row.data_nascimento,v_row.cep,v_row.endereco,v_row.numero,v_row.bairro,v_row.cidade,v_row.estado,v_row.observacoes,coalesce(v_row.status,'ativo'),coalesce(v_row.cadastro_origem,'crm_admin'))
  RETURNING to_jsonb(clientes) - 'pin_hash' INTO v_result;
  RETURN public.gsa_admin_complete_mutation(p_request_id,v_result);
END;
$$;

-- Catálogos públicos continuam legíveis, mas nunca graváveis por anon.
DO $$
DECLARE t text; p record;
BEGIN
  FOREACH t IN ARRAY ARRAY['assinaturas','produtos','servicos','loja_categorias','cupons_loja','promocoes',
    'gsa_tv_channels','gsa_tv_media_items','gsa_tv_schedule_slots','viagens_categorias','viagens_pacotes','viagens_pacote_imagens'] LOOP
    IF to_regclass('public.'||t) IS NOT NULL THEN
      EXECUTE format('REVOKE INSERT,UPDATE,DELETE,TRUNCATE,REFERENCES,TRIGGER ON public.%I FROM PUBLIC, anon',t);
      FOR p IN SELECT policyname FROM pg_policies WHERE schemaname='public' AND tablename=t
        AND cmd='ALL' AND (array_to_string(roles,',') LIKE '%public%' OR array_to_string(roles,',') LIKE '%anon%')
      LOOP EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I',p.policyname,t); END LOOP;
      EXECUTE format('DROP POLICY IF EXISTS gsa_public_read_hardened ON public.%I',t);
      EXECUTE format('CREATE POLICY gsa_public_read_hardened ON public.%I AS PERMISSIVE FOR SELECT TO anon,authenticated USING (true)',t);
      EXECUTE format('GRANT SELECT ON public.%I TO anon,authenticated',t);
    END IF;
  END LOOP;
END $$;

-- Operações administrativas sem motivo legítimo para acesso anônimo.
DO $$
DECLARE t text; p record;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'contratos','demanda_comentarios','documentos_prestador','gsa_tv_audit_log','gsa_whatsapp_ramais','ordens_fiscais',
    'os_notas','os_suporte_mensagens','prestador_demandas','prestador_demandas_historico','prestador_documentos','prestador_historico',
    'prestador_premios','prestador_promocoes','prestador_promocoes_ativacoes','prestador_suporte_demandas','prestador_agendamentos',
    'prestador_vouchers','prestadores','ticket_mensagens','viagens_propostas','vouchers','indicacoes','level_history','points_transactions',
    'cliente_promocoes','loja_credito_documentos','loja_credito_movimentacoes','loja_reembolsos','gsa_voucher_resgates','produto_importacao_origem',
    'gsa_client_operation_requests','gsa_client_recovery_challenges','gsa_provider_audit_events','gsa_public_budget_rate_limits','gsa_public_rate_limits','sistema_logs','debug_admin_rpc'
  ] LOOP
    IF to_regclass('public.'||t) IS NOT NULL THEN
      EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY',t);
      EXECUTE format('REVOKE ALL ON public.%I FROM PUBLIC, anon',t);
      EXECUTE format('GRANT SELECT,INSERT,UPDATE,DELETE ON public.%I TO authenticated',t);
      FOR p IN SELECT policyname FROM pg_policies WHERE schemaname='public' AND tablename=t
        AND (array_to_string(roles,',') LIKE '%public%' OR array_to_string(roles,',') LIKE '%anon%')
      LOOP EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I',p.policyname,t); END LOOP;
      EXECUTE format('DROP POLICY IF EXISTS gsa_management_hardened ON public.%I',t);
      EXECUTE format('CREATE POLICY gsa_management_hardened ON public.%I AS PERMISSIVE FOR ALL TO authenticated USING (public.gsa_jwt_actor_type() IN (''admin'',''colaborador'')) WITH CHECK (public.gsa_jwt_actor_type() IN (''admin'',''colaborador''))',t);
      EXECUTE format('DROP POLICY IF EXISTS gsa_collaborator_fail_closed_hardened ON public.%I',t);
      EXECUTE format('CREATE POLICY gsa_collaborator_fail_closed_hardened ON public.%I AS RESTRICTIVE FOR ALL TO authenticated USING (public.gsa_admin_restrict_collaborator_to_module(public.gsa_admin_table_module(%L))) WITH CHECK (public.gsa_admin_restrict_collaborator_to_module(public.gsa_admin_table_module(%L)))',t,t,t);
    END IF;
  END LOOP;
END $$;

-- Tabelas de suporte/loja que estavam públicas e contêm dados de operação.
DO $$
DECLARE t text; p record;
BEGIN
  FOREACH t IN ARRAY ARRAY['loja_solicitacoes','orcamento_timeline','ordens_servico'] LOOP
    IF to_regclass('public.'||t) IS NOT NULL THEN
      EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY',t);
      EXECUTE format('REVOKE ALL ON public.%I FROM PUBLIC, anon',t);
      EXECUTE format('GRANT SELECT,INSERT,UPDATE,DELETE ON public.%I TO authenticated',t);
      FOR p IN SELECT policyname FROM pg_policies WHERE schemaname='public' AND tablename=t
        AND (array_to_string(roles,',') LIKE '%public%' OR array_to_string(roles,',') LIKE '%anon%')
      LOOP EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I',p.policyname,t); END LOOP;
      EXECUTE format('DROP POLICY IF EXISTS gsa_management_hardened ON public.%I',t);
      EXECUTE format('CREATE POLICY gsa_management_hardened ON public.%I AS PERMISSIVE FOR ALL TO authenticated USING (public.gsa_jwt_actor_type() IN (''admin'',''colaborador'')) WITH CHECK (public.gsa_jwt_actor_type() IN (''admin'',''colaborador''))',t);
    END IF;
  END LOOP;
END $$;

DROP POLICY IF EXISTS gsa_client_own_loja_solicitacoes_hardened ON public.loja_solicitacoes;
CREATE POLICY gsa_client_own_loja_solicitacoes_hardened ON public.loja_solicitacoes FOR ALL TO authenticated
USING (public.gsa_jwt_actor_type()='cliente' AND cliente_id=public.gsa_jwt_actor_id())
WITH CHECK (public.gsa_jwt_actor_type()='cliente' AND cliente_id=public.gsa_jwt_actor_id());
DROP POLICY IF EXISTS gsa_client_own_orcamento_timeline_hardened ON public.orcamento_timeline;
CREATE POLICY gsa_client_own_orcamento_timeline_hardened ON public.orcamento_timeline FOR SELECT TO authenticated
USING (public.gsa_jwt_actor_type()='cliente' AND cliente_id=public.gsa_jwt_actor_id());

DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='ordens_servico' AND column_name='cliente_id') THEN
    DROP POLICY IF EXISTS gsa_client_own_ordens_servico_hardened ON public.ordens_servico;
    CREATE POLICY gsa_client_own_ordens_servico_hardened ON public.ordens_servico FOR SELECT TO authenticated
      USING (public.gsa_jwt_actor_type()='cliente' AND cliente_id=public.gsa_jwt_actor_id());
  END IF;
END $$;

DROP POLICY IF EXISTS gsa_client_own_indicacoes_hardened ON public.indicacoes;
CREATE POLICY gsa_client_own_indicacoes_hardened ON public.indicacoes FOR SELECT TO authenticated
USING (public.gsa_jwt_actor_type()='cliente' AND indicador_id=public.gsa_jwt_actor_id());
DROP POLICY IF EXISTS gsa_client_own_level_history_hardened ON public.level_history;
CREATE POLICY gsa_client_own_level_history_hardened ON public.level_history FOR SELECT TO authenticated
USING (public.gsa_jwt_actor_type()='cliente' AND cliente_id=public.gsa_jwt_actor_id());
DROP POLICY IF EXISTS gsa_client_own_points_transactions_hardened ON public.points_transactions;
CREATE POLICY gsa_client_own_points_transactions_hardened ON public.points_transactions FOR SELECT TO authenticated
USING (public.gsa_jwt_actor_type()='cliente' AND cliente_id=public.gsa_jwt_actor_id());
DROP POLICY IF EXISTS gsa_client_own_promocoes_hardened ON public.cliente_promocoes;
CREATE POLICY gsa_client_own_promocoes_hardened ON public.cliente_promocoes FOR SELECT TO authenticated
USING (public.gsa_jwt_actor_type()='cliente' AND cliente_id=public.gsa_jwt_actor_id());
DROP POLICY IF EXISTS gsa_client_own_credit_docs_hardened ON public.loja_credito_documentos;
CREATE POLICY gsa_client_own_credit_docs_hardened ON public.loja_credito_documentos FOR SELECT TO authenticated
USING (public.gsa_jwt_actor_type()='cliente' AND EXISTS (
  SELECT 1 FROM public.loja_credito_solicitacoes s WHERE s.id=solicitacao_id AND s.cliente_id=public.gsa_jwt_actor_id()));
DROP POLICY IF EXISTS gsa_client_own_credit_moves_hardened ON public.loja_credito_movimentacoes;
CREATE POLICY gsa_client_own_credit_moves_hardened ON public.loja_credito_movimentacoes FOR SELECT TO authenticated
USING (public.gsa_jwt_actor_type()='cliente' AND cliente_id=public.gsa_jwt_actor_id());
DROP POLICY IF EXISTS gsa_client_own_refunds_hardened ON public.loja_reembolsos;
CREATE POLICY gsa_client_own_refunds_hardened ON public.loja_reembolsos FOR SELECT TO authenticated
USING (public.gsa_jwt_actor_type()='cliente' AND cliente_id=public.gsa_jwt_actor_id());
DROP POLICY IF EXISTS gsa_client_own_voucher_redemptions_hardened ON public.gsa_voucher_resgates;
CREATE POLICY gsa_client_own_voucher_redemptions_hardened ON public.gsa_voucher_resgates FOR SELECT TO authenticated
USING (public.gsa_jwt_actor_type()='cliente' AND cliente_id=public.gsa_jwt_actor_id());
DROP POLICY IF EXISTS gsa_client_own_contracts_hardened ON public.contratos;
CREATE POLICY gsa_client_own_contracts_hardened ON public.contratos FOR SELECT TO authenticated
USING (public.gsa_jwt_actor_type()='cliente' AND cliente_id=public.gsa_jwt_actor_id());
DROP POLICY IF EXISTS gsa_client_own_travel_proposals_hardened ON public.viagens_propostas;
CREATE POLICY gsa_client_own_travel_proposals_hardened ON public.viagens_propostas FOR SELECT TO authenticated
USING (public.gsa_jwt_actor_type()='cliente' AND cliente_id=public.gsa_jwt_actor_id());

DROP POLICY IF EXISTS gsa_provider_own_provider_hardened ON public.prestadores;
CREATE POLICY gsa_provider_own_provider_hardened ON public.prestadores FOR SELECT TO authenticated
USING (public.gsa_jwt_actor_type()='prestador' AND id=public.gsa_jwt_actor_id());
DROP POLICY IF EXISTS gsa_provider_own_demandas_hardened ON public.prestador_demandas;
CREATE POLICY gsa_provider_own_demandas_hardened ON public.prestador_demandas FOR SELECT TO authenticated
USING (public.gsa_jwt_actor_type()='prestador' AND prestador_id=public.gsa_jwt_actor_id());
DROP POLICY IF EXISTS gsa_provider_own_demand_history_hardened ON public.prestador_demandas_historico;
CREATE POLICY gsa_provider_own_demand_history_hardened ON public.prestador_demandas_historico FOR SELECT TO authenticated
USING (public.gsa_jwt_actor_type()='prestador' AND EXISTS (
  SELECT 1 FROM public.prestador_demandas d WHERE d.id=demanda_id AND d.prestador_id=public.gsa_jwt_actor_id()));
DROP POLICY IF EXISTS gsa_provider_own_history_hardened ON public.prestador_historico;
CREATE POLICY gsa_provider_own_history_hardened ON public.prestador_historico FOR SELECT TO authenticated
USING (public.gsa_jwt_actor_type()='prestador' AND prestador_id=public.gsa_jwt_actor_id());
DROP POLICY IF EXISTS gsa_provider_own_premios_hardened ON public.prestador_premios;
CREATE POLICY gsa_provider_own_premios_hardened ON public.prestador_premios FOR SELECT TO authenticated
USING (public.gsa_jwt_actor_type()='prestador' AND prestador_id=public.gsa_jwt_actor_id());
DROP POLICY IF EXISTS gsa_provider_promotions_read_hardened ON public.prestador_promocoes;
CREATE POLICY gsa_provider_promotions_read_hardened ON public.prestador_promocoes FOR SELECT TO authenticated
USING (public.gsa_jwt_actor_type()='prestador');
DROP POLICY IF EXISTS gsa_provider_own_promo_activation_hardened ON public.prestador_promocoes_ativacoes;
CREATE POLICY gsa_provider_own_promo_activation_hardened ON public.prestador_promocoes_ativacoes FOR SELECT TO authenticated
USING (public.gsa_jwt_actor_type()='prestador' AND prestador_id=public.gsa_jwt_actor_id());
DROP POLICY IF EXISTS gsa_provider_own_agendamentos_hardened ON public.prestador_agendamentos;
CREATE POLICY gsa_provider_own_agendamentos_hardened ON public.prestador_agendamentos FOR SELECT TO authenticated
USING (public.gsa_jwt_actor_type()='prestador' AND prestador_id=public.gsa_jwt_actor_id());
DROP POLICY IF EXISTS gsa_provider_own_support_hardened ON public.prestador_suporte_demandas;
CREATE POLICY gsa_provider_own_support_hardened ON public.prestador_suporte_demandas FOR SELECT TO authenticated
USING (public.gsa_jwt_actor_type()='prestador' AND prestador_id=public.gsa_jwt_actor_id());

DROP POLICY IF EXISTS gsa_ticket_messages_owner_hardened ON public.ticket_mensagens;
CREATE POLICY gsa_ticket_messages_owner_hardened ON public.ticket_mensagens FOR SELECT TO authenticated
USING (EXISTS (SELECT 1 FROM public.tickets t WHERE t.id=ticket_id AND (
  (public.gsa_jwt_actor_type()='cliente' AND t.cliente_id=public.gsa_jwt_actor_id()) OR
  (public.gsa_jwt_actor_type()='prestador' AND t.prestador_id=public.gsa_jwt_actor_id()))));

-- Outros catálogos públicos: somente leitura.
DO $$
DECLARE t text; p record;
BEGIN
  FOREACH t IN ARRAY ARRAY['client_levels','empresa','formas_pagamento','gsa_service_package_items','gsa_service_packages','servicos_pacotes','promocoes_quantidade'] LOOP
    IF to_regclass('public.'||t) IS NOT NULL THEN
      EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY',t);
      EXECUTE format('REVOKE INSERT,UPDATE,DELETE,TRUNCATE,REFERENCES,TRIGGER ON public.%I FROM PUBLIC, anon',t);
      FOR p IN SELECT policyname FROM pg_policies WHERE schemaname='public' AND tablename=t AND cmd='ALL'
        AND (array_to_string(roles,',') LIKE '%public%' OR array_to_string(roles,',') LIKE '%anon%')
      LOOP EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I',p.policyname,t); END LOOP;
      EXECUTE format('DROP POLICY IF EXISTS gsa_public_read_hardened ON public.%I',t);
      EXECUTE format('CREATE POLICY gsa_public_read_hardened ON public.%I FOR SELECT TO anon,authenticated USING (true)',t);
      EXECUTE format('GRANT SELECT ON public.%I TO anon,authenticated',t);
    END IF;
  END LOOP;
END $$;

-- Dados internos adicionais do painel.
DO $$
DECLARE t text; p record;
BEGIN
  FOREACH t IN ARRAY ARRAY['funcoes','emprestimo_comentarios','emprestimo_historico','emprestimo_templates_contrato',
    'loja_estoque_historico','promocoes_quantidade_uso','gsa_careers_applications','gsa_careers_application_history'] LOOP
    IF to_regclass('public.'||t) IS NOT NULL THEN
      EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY',t);
      EXECUTE format('REVOKE ALL ON public.%I FROM PUBLIC, anon',t);
      EXECUTE format('GRANT SELECT,INSERT,UPDATE,DELETE ON public.%I TO authenticated',t);
      FOR p IN SELECT policyname FROM pg_policies WHERE schemaname='public' AND tablename=t
        AND (array_to_string(roles,',') LIKE '%public%' OR array_to_string(roles,',') LIKE '%anon%')
      LOOP EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I',p.policyname,t); END LOOP;
      EXECUTE format('DROP POLICY IF EXISTS gsa_management_hardened ON public.%I',t);
      EXECUTE format('CREATE POLICY gsa_management_hardened ON public.%I FOR ALL TO authenticated USING (public.gsa_jwt_actor_type() IN (''admin'',''colaborador'')) WITH CHECK (public.gsa_jwt_actor_type() IN (''admin'',''colaborador''))',t);
    END IF;
  END LOOP;
END $$;

DROP POLICY IF EXISTS gsa_client_own_loan_comments_hardened ON public.emprestimo_comentarios;
CREATE POLICY gsa_client_own_loan_comments_hardened ON public.emprestimo_comentarios FOR SELECT TO authenticated
USING (public.gsa_jwt_actor_type()='cliente' AND EXISTS (
  SELECT 1 FROM public.emprestimos e WHERE e.id=emprestimo_id AND e.cliente_id=public.gsa_jwt_actor_id()));
DROP POLICY IF EXISTS gsa_client_own_loan_history_hardened ON public.emprestimo_historico;
CREATE POLICY gsa_client_own_loan_history_hardened ON public.emprestimo_historico FOR SELECT TO authenticated
USING (public.gsa_jwt_actor_type()='cliente' AND EXISTS (
  SELECT 1 FROM public.emprestimos e WHERE e.id=emprestimo_id AND e.cliente_id=public.gsa_jwt_actor_id()));
DROP POLICY IF EXISTS gsa_client_own_promo_usage_hardened ON public.promocoes_quantidade_uso;
CREATE POLICY gsa_client_own_promo_usage_hardened ON public.promocoes_quantidade_uso FOR SELECT TO authenticated
USING (public.gsa_jwt_actor_type()='cliente' AND cliente_id=public.gsa_jwt_actor_id());

-- Idempotência, recuperação e rate-limit nunca são tabelas de navegador.
DO $$
DECLARE t text; p record;
BEGIN
  FOREACH t IN ARRAY ARRAY['gsa_client_operation_requests','gsa_client_recovery_challenges','gsa_public_budget_rate_limits','gsa_public_rate_limits','debug_admin_rpc'] LOOP
    IF to_regclass('public.'||t) IS NOT NULL THEN
      EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY',t);
      EXECUTE format('REVOKE ALL ON public.%I FROM PUBLIC, anon, authenticated',t);
      EXECUTE format('GRANT ALL ON public.%I TO service_role',t);
      FOR p IN SELECT policyname FROM pg_policies WHERE schemaname='public' AND tablename=t LOOP
        EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I',p.policyname,t);
      END LOOP;
    END IF;
  END LOOP;
END $$;

CREATE OR REPLACE FUNCTION public.gsa_admin_notification_has_access(p_tipo text,p_link text)
RETURNS boolean LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE v_ctx jsonb; v_text text:=lower(coalesce(p_tipo,'')||' '||coalesce(p_link,'')); v_module text;
BEGIN
  v_ctx:=public.gsa_admin_context();
  IF v_ctx->>'actor_type'='admin' THEN RETURN true; END IF;
  v_module:=CASE
    WHEN v_text ~ 'credito' THEN 'credito_loja'
    WHEN v_text ~ 'emprest' THEN 'emprestimos'
    WHEN v_text ~ 'cobranc' THEN 'cobranca'
    WHEN v_text ~ 'finance|fatura|pagamento|saque|transfer' THEN 'financeiro'
    WHEN v_text ~ 'ticket|suporte|atendimento' THEN 'atendimento'
    WHEN v_text ~ 'prestador' THEN 'prestadores'
    WHEN v_text ~ 'demanda' THEN 'demandas'
    WHEN v_text ~ 'viagem' THEN 'viagens'
    WHEN v_text ~ 'classific' THEN 'classificados'
    WHEN v_text ~ 'fiscal' THEN 'fiscal'
    WHEN v_text ~ 'voucher|fidelidade|promo' THEN 'fidelidade'
    WHEN v_text ~ 'cliente|cadastro' THEN 'cadastro'
    WHEN v_text ~ 'loja|produto|assinatura|catalog' THEN 'loja'
    WHEN v_text ~ 'sistema|infra|whatsapp|automacao' THEN 'sistema'
    WHEN v_text ~ 'config' THEN 'configuracoes'
    ELSE NULL END;
  RETURN v_module IS NOT NULL AND public.gsa_admin_has_module(v_module);
END;
$$;

DROP POLICY IF EXISTS gsa_management_hardened ON public.admin_notificacoes;
DROP POLICY IF EXISTS gsa_collaborator_module_admin_notificacoes ON public.admin_notificacoes;
DROP POLICY IF EXISTS gsa_admin_notifications_select_hardened ON public.admin_notificacoes;
CREATE POLICY gsa_admin_notifications_select_hardened ON public.admin_notificacoes FOR SELECT TO authenticated
USING (public.gsa_admin_notification_has_access(tipo,link));
DROP POLICY IF EXISTS gsa_admin_notifications_update_hardened ON public.admin_notificacoes;
CREATE POLICY gsa_admin_notifications_update_hardened ON public.admin_notificacoes FOR UPDATE TO authenticated
USING (public.gsa_admin_notification_has_access(tipo,link))
WITH CHECK (public.gsa_admin_notification_has_access(tipo,link));
DROP POLICY IF EXISTS gsa_admin_notifications_insert_hardened ON public.admin_notificacoes;
CREATE POLICY gsa_admin_notifications_insert_hardened ON public.admin_notificacoes FOR INSERT TO authenticated
WITH CHECK ((public.gsa_admin_context()->>'actor_type')='admin');
DROP POLICY IF EXISTS gsa_admin_notifications_delete_hardened ON public.admin_notificacoes;
CREATE POLICY gsa_admin_notifications_delete_hardened ON public.admin_notificacoes FOR DELETE TO authenticated
USING ((public.gsa_admin_context()->>'actor_type')='admin');

REVOKE ALL ON FUNCTION public.gsa_admin_session_assert_module(uuid,text,text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.gsa_admin_delete_travel_category(uuid,text,uuid,uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.gsa_admin_whatsapp_mutation(uuid,text,text,jsonb,uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.gsa_admin_update_provider_demand(uuid,text,uuid,text,jsonb,uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.gsa_admin_create_provider(uuid,text,jsonb,uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.gsa_admin_service_mutation(uuid,text,text,uuid,jsonb,uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.gsa_admin_create_crm_client(uuid,text,jsonb,uuid) FROM PUBLIC, anon;

GRANT EXECUTE ON FUNCTION public.gsa_admin_session_assert_module(uuid,text,text) TO authenticated,service_role;
GRANT EXECUTE ON FUNCTION public.gsa_admin_delete_travel_category(uuid,text,uuid,uuid) TO authenticated,service_role;
GRANT EXECUTE ON FUNCTION public.gsa_admin_whatsapp_mutation(uuid,text,text,jsonb,uuid) TO authenticated,service_role;
GRANT EXECUTE ON FUNCTION public.gsa_admin_update_provider_demand(uuid,text,uuid,text,jsonb,uuid) TO authenticated,service_role;
GRANT EXECUTE ON FUNCTION public.gsa_admin_create_provider(uuid,text,jsonb,uuid) TO authenticated,service_role;
GRANT EXECUTE ON FUNCTION public.gsa_admin_service_mutation(uuid,text,text,uuid,jsonb,uuid) TO authenticated,service_role;
GRANT EXECUTE ON FUNCTION public.gsa_admin_create_crm_client(uuid,text,jsonb,uuid) TO authenticated,service_role;

NOTIFY pgrst, 'reload schema';
COMMIT;
