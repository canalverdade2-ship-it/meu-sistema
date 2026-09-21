BEGIN;

-- Estruturas internas nunca devem ser acessadas pela API pública.
DO $$
DECLARE
  t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['extensions', 'tenants', 'schema_migrations', 'gsa_whatsapp_verifications'] LOOP
    IF to_regclass('public.' || t) IS NOT NULL THEN
      EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', t);
      EXECUTE format('REVOKE ALL ON public.%I FROM PUBLIC, anon, authenticated', t);
      EXECUTE format('GRANT ALL ON public.%I TO service_role', t);
      EXECUTE format('DROP POLICY IF EXISTS gsa_service_role_internal_only ON public.%I', t);
      EXECUTE format('CREATE POLICY gsa_service_role_internal_only ON public.%I AS RESTRICTIVE FOR ALL TO service_role USING (true) WITH CHECK (true)', t);
    END IF;
  END LOOP;
END $$;

-- Solicitações de voucher contêm telefone e hashes; somente o backend acessa.
DO $$
BEGIN
  IF to_regclass('public.gsa_calculator_pro_whatsapp_requests') IS NOT NULL THEN
    ALTER TABLE public.gsa_calculator_pro_whatsapp_requests ENABLE ROW LEVEL SECURITY;
    REVOKE ALL ON public.gsa_calculator_pro_whatsapp_requests FROM PUBLIC, anon, authenticated;
    GRANT ALL ON public.gsa_calculator_pro_whatsapp_requests TO service_role;
    DROP POLICY IF EXISTS gsa_service_role_calculator_requests ON public.gsa_calculator_pro_whatsapp_requests;
    CREATE POLICY gsa_service_role_calculator_requests
      ON public.gsa_calculator_pro_whatsapp_requests
      AS RESTRICTIVE FOR ALL TO service_role USING (true) WITH CHECK (true);
  END IF;
END $$;

-- Catálogo público de parceiros: expõe somente os campos necessários e somente ativos.
DROP VIEW IF EXISTS public.parceiros_publicos;
CREATE VIEW public.parceiros_publicos
WITH (security_barrier = true)
AS
SELECT
  id, slug, name, category, short_description, description, logo_url, cover_url,
  phone, whatsapp, email, website, instagram, facebook, linkedin, street, number,
  complement, neighborhood, city, state, zip_code, maps_url, business_hours,
  service_mode, service_regions, services, products, benefits, featured,
  display_order, status, redemption_has_coupon, redemption_coupon_code,
  redemption_has_voucher, redemption_has_link, redemption_link,
  redemption_auto_redirect, redemption_instructions, redemption_delay_24h,
  created_at, updated_at
FROM public.parceiros
WHERE status = 'ativo';

REVOKE ALL ON public.parceiros FROM PUBLIC, anon;
GRANT SELECT ON public.parceiros_publicos TO anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.parceiros TO authenticated;
GRANT ALL ON public.parceiros TO service_role;
ALTER TABLE public.parceiros ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Public can view active partners" ON public.parceiros;
DROP POLICY IF EXISTS parceiros_public_read ON public.parceiros;
DROP POLICY IF EXISTS gsa_public_read_hardened ON public.parceiros;
DROP POLICY IF EXISTS gsa_management_partners ON public.parceiros;
CREATE POLICY gsa_management_partners
  ON public.parceiros FOR ALL TO authenticated
  USING (public.gsa_jwt_actor_type() IN ('admin', 'colaborador'))
  WITH CHECK (public.gsa_jwt_actor_type() IN ('admin', 'colaborador'));
DROP POLICY IF EXISTS gsa_collaborator_module_parceiros ON public.parceiros;
CREATE POLICY gsa_collaborator_module_parceiros
  ON public.parceiros AS RESTRICTIVE FOR ALL TO authenticated
  USING (public.gsa_admin_restrict_collaborator_to_module('parceiros'))
  WITH CHECK (public.gsa_admin_restrict_collaborator_to_module('parceiros'));

-- Configurações públicas passam a usar lista positiva. Webhooks e infraestrutura ficam privados.
DROP POLICY IF EXISTS system_settings_public_read ON public.system_settings;
CREATE POLICY system_settings_public_read
  ON public.system_settings FOR SELECT TO anon, authenticated
  USING (
    key = ANY (ARRAY[
      'afiliado_bonus_boas_vindas_ativo','afiliado_bonus_boas_vindas_valor',
      'afiliado_pontos_ativo','afiliado_pontos_minimo_resgate','afiliado_pontos_resgate_taxa',
      'afiliado_saque_minimo','bonus_cadastro_tipo','bonus_cadastro_valor','bonus_indicador',
      'codigo_cadastro_padrao_ativo','credito_saque_taxa_tipo','credito_saque_taxa_valor',
      'desconto_indicado_porcentagem','indicado_desconto_porcentagem','indicado_recompensa_tipo',
      'indicado_valor_pontos','indicador_limite_carteira','indicador_recompensa_tipo',
      'indicador_valor_pontos','loja_credito_juros_avista','loja_credito_juros_parcelado',
      'loja_taxa_entrega_padrao','modal_indicacao_acao_botao','modal_indicacao_ativo',
      'modal_indicacao_descricao','modal_indicacao_modulo_destino','modal_indicacao_tamanho',
      'modal_indicacao_texto_botao','modal_indicacao_titulo','modal_indicacao_url_botao',
      'modulo_area_vip_ativo','modulo_area_vip_oculto','template_mensagem_indicacao',
      'valor_minimo_saque','whatsapp_float_ativo','whatsapp_float_mensagem',
      'whatsapp_float_posicao','whatsapp_float_tamanho','whatsapp_float_telefone',
      'whatsapp_float_tooltip','loja_pix_desconto_ativo','loja_pix_desconto_porcentagem',
      'loja_pix_desconto_tipo_aplicacao','loja_pix_desconto_categorias',
      'loja_pix_desconto_produtos','loja_pix_desconto_permitir_pontos',
      'loja_pix_desconto_permitir_saldo_carteira'
    ]::text[])
  );

-- Fronteiras administrativas ausentes.
DO $$
DECLARE
  r record;
BEGIN
  FOR r IN SELECT * FROM (VALUES
    ('carteira_lancamentos','financeiro'),
    ('pontos_movimentacoes','fidelidade'),
    ('notificacoes','comunicacao'),
    ('gsa_careers_applications','carreiras'),
    ('gsa_careers_application_history','carreiras'),
    ('emprestimo_templates_contrato','emprestimos'),
    ('loja_estoque_historico','loja'),
    ('promocoes_quantidade_uso','fidelidade')
  ) AS x(table_name,module_name) LOOP
    IF to_regclass('public.' || r.table_name) IS NOT NULL THEN
      EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', r.table_name);
      EXECUTE format('DROP POLICY IF EXISTS gsa_collaborator_module_%I ON public.%I', r.table_name, r.table_name);
      EXECUTE format(
        'CREATE POLICY gsa_collaborator_module_%I ON public.%I AS RESTRICTIVE FOR ALL TO authenticated USING (public.gsa_admin_restrict_collaborator_to_module(%L)) WITH CHECK (public.gsa_admin_restrict_collaborator_to_module(%L))',
        r.table_name, r.table_name, r.module_name, r.module_name
      );
    END IF;
  END LOOP;
END $$;

-- Todo o domínio Viagens exige o módulo Viagens para colaboradores.
DO $$
DECLARE
  t text;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'viagens_cancelamentos','viagens_configuracoes','viagens_fornecedores',
    'viagens_passageiro_documentos','viagens_passageiros','viagens_solicitacoes_reserva',
    'viagens_vouchers','viagens_categorias','viagens_pacotes','viagens_pacote_imagens',
    'viagens_propostas','viagens_reservas','viagens_transacoes','viagens_orcamentos'
  ] LOOP
    IF to_regclass('public.' || t) IS NOT NULL THEN
      EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', t);
      EXECUTE format('DROP POLICY IF EXISTS gsa_collaborator_module_%I ON public.%I', t, t);
      EXECUTE format(
        'CREATE POLICY gsa_collaborator_module_%I ON public.%I AS RESTRICTIVE FOR ALL TO authenticated USING (public.gsa_admin_restrict_collaborator_to_module(''viagens'')) WITH CHECK (public.gsa_admin_restrict_collaborator_to_module(''viagens''))',
        t, t
      );
    END IF;
  END LOOP;
END $$;

-- Dados internos da operação de viagens não são catálogo público.
DROP POLICY IF EXISTS "Leitura pública configuracoes" ON public.viagens_configuracoes;
REVOKE SELECT ON public.viagens_configuracoes FROM PUBLIC, anon;

-- Corrige a condição tautológica e vincula a transação à proposta do passageiro.
DROP POLICY IF EXISTS "Cliente atualiza passageiros" ON public.viagens_passageiros;
CREATE POLICY "Cliente atualiza passageiros"
  ON public.viagens_passageiros FOR UPDATE TO authenticated
  USING (
    public.gsa_jwt_session_is_valid()
    AND public.gsa_jwt_actor_type() = 'cliente'
    AND cliente_id = public.gsa_jwt_actor_id()
    AND EXISTS (
      SELECT 1 FROM public.viagens_transacoes transacao
      WHERE transacao.proposta_id = viagens_passageiros.proposta_id
        AND transacao.cliente_id = public.gsa_jwt_actor_id()
        AND transacao.status = 'pendente'
    )
  )
  WITH CHECK (
    public.gsa_jwt_session_is_valid()
    AND public.gsa_jwt_actor_type() = 'cliente'
    AND cliente_id = public.gsa_jwt_actor_id()
    AND EXISTS (
      SELECT 1 FROM public.viagens_transacoes transacao
      WHERE transacao.proposta_id = viagens_passageiros.proposta_id
        AND transacao.cliente_id = public.gsa_jwt_actor_id()
        AND transacao.status = 'pendente'
    )
  );

DROP POLICY IF EXISTS "Cliente deleta passageiros" ON public.viagens_passageiros;
CREATE POLICY "Cliente deleta passageiros"
  ON public.viagens_passageiros FOR DELETE TO authenticated
  USING (
    public.gsa_jwt_session_is_valid()
    AND public.gsa_jwt_actor_type() = 'cliente'
    AND cliente_id = public.gsa_jwt_actor_id()
    AND EXISTS (
      SELECT 1 FROM public.viagens_transacoes transacao
      WHERE transacao.proposta_id = viagens_passageiros.proposta_id
        AND transacao.cliente_id = public.gsa_jwt_actor_id()
        AND transacao.status = 'pendente'
    )
  );

-- Encapsula a importação legada em uma fronteira de sessão + módulo.
DO $$
BEGIN
  IF to_regprocedure('public.gsa_admin_import_products_batch_v2_internal(uuid,text,jsonb)') IS NULL
     AND to_regprocedure('public.gsa_admin_import_products_batch_v2(uuid,text,jsonb)') IS NOT NULL THEN
    ALTER FUNCTION public.gsa_admin_import_products_batch_v2(uuid,text,jsonb)
      RENAME TO gsa_admin_import_products_batch_v2_internal;
  END IF;
END $$;
ALTER FUNCTION public.gsa_admin_import_products_batch_v2_internal(uuid,text,jsonb)
  SET search_path = public, pg_temp;
REVOKE ALL ON FUNCTION public.gsa_admin_import_products_batch_v2_internal(uuid,text,jsonb)
  FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.gsa_admin_import_products_batch_v2(
  p_sessao_id uuid, p_session_token text, p_items jsonb
) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp
AS $$
BEGIN
  PERFORM 1 FROM public.gsa_admin_session_assert_module(
    p_sessao_id, p_session_token, 'catalogo'
  ) LIMIT 1;
  RETURN public.gsa_admin_import_products_batch_v2_internal(p_sessao_id, p_session_token, p_items);
END;
$$;
REVOKE ALL ON FUNCTION public.gsa_admin_import_products_batch_v2(uuid,text,jsonb) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.gsa_admin_import_products_batch_v2(uuid,text,jsonb) TO authenticated, service_role;

-- Encapsula o disparo manual de scraping; a função interna não fica exposta.
DO $$
BEGIN
  IF to_regprocedure('public.gsa_admin_trigger_scraping_now_internal(text,text,uuid)') IS NULL
     AND to_regprocedure('public.gsa_admin_trigger_scraping_now(text,text,uuid)') IS NOT NULL THEN
    ALTER FUNCTION public.gsa_admin_trigger_scraping_now(text,text,uuid)
      RENAME TO gsa_admin_trigger_scraping_now_internal;
  END IF;
END $$;
ALTER FUNCTION public.gsa_admin_trigger_scraping_now_internal(text,text,uuid)
  SET search_path = public, pg_temp;
REVOKE ALL ON FUNCTION public.gsa_admin_trigger_scraping_now_internal(text,text,uuid)
  FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.gsa_admin_trigger_scraping_now(
  p_sessao_id text, p_session_token text, p_automacao_id uuid
) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp
AS $$
BEGIN
  PERFORM 1 FROM public.gsa_admin_session_assert_module(
    nullif(trim(p_sessao_id), '')::uuid, p_session_token, 'sistema'
  ) LIMIT 1;
  RETURN public.gsa_admin_trigger_scraping_now_internal(p_sessao_id, p_session_token, p_automacao_id);
END;
$$;
REVOKE ALL ON FUNCTION public.gsa_admin_trigger_scraping_now(text,text,uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.gsa_admin_trigger_scraping_now(text,text,uuid) TO authenticated, service_role;

-- Logs de scraping só podem ser gravados pela operação autenticada ou service role.
DO $$
BEGIN
  IF to_regprocedure('public.gsa_admin_log_scraping_step_internal(text,text,uuid,text,text,text,integer,jsonb)') IS NULL
     AND to_regprocedure('public.gsa_admin_log_scraping_step(text,text,uuid,text,text,text,integer,jsonb)') IS NOT NULL THEN
    ALTER FUNCTION public.gsa_admin_log_scraping_step(text,text,uuid,text,text,text,integer,jsonb)
      RENAME TO gsa_admin_log_scraping_step_internal;
  END IF;
END $$;
ALTER FUNCTION public.gsa_admin_log_scraping_step_internal(text,text,uuid,text,text,text,integer,jsonb)
  SET search_path = public, pg_temp;
REVOKE ALL ON FUNCTION public.gsa_admin_log_scraping_step_internal(text,text,uuid,text,text,text,integer,jsonb)
  FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.gsa_admin_log_scraping_step(
  p_sessao_id text DEFAULT NULL, p_session_token text DEFAULT NULL,
  p_automacao_id uuid DEFAULT NULL, p_passo text DEFAULT 'progresso',
  p_status text DEFAULT 'em_andamento', p_mensagem text DEFAULT '',
  p_progresso integer DEFAULT 50, p_detalhes jsonb DEFAULT NULL
) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp
AS $$
BEGIN
  PERFORM 1 FROM public.gsa_admin_session_assert_module(
    nullif(trim(p_sessao_id), '')::uuid, p_session_token, 'sistema'
  ) LIMIT 1;
  RETURN public.gsa_admin_log_scraping_step_internal(
    p_sessao_id,p_session_token,p_automacao_id,p_passo,p_status,p_mensagem,p_progresso,p_detalhes
  );
END;
$$;
REVOKE ALL ON FUNCTION public.gsa_admin_log_scraping_step(text,text,uuid,text,text,text,integer,jsonb)
  FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.gsa_admin_log_scraping_step(text,text,uuid,text,text,text,integer,jsonb)
  TO authenticated, service_role;

-- Sessões administrativas inativas são encerradas e passam a ter expiração automática.
CREATE OR REPLACE FUNCTION public.gsa_admin_session_change_audit()
RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp
AS $$
DECLARE
  v_actor_type text := COALESCE(auth.jwt()->'app_metadata'->>'gsa_actor_type','sistema');
  v_actor_id uuid;
  v_id uuid;
  v_session_actor_id uuid;
BEGIN
  BEGIN
    v_actor_id := nullif(auth.jwt()->'app_metadata'->>'gsa_actor_id','')::uuid;
  EXCEPTION WHEN invalid_text_representation THEN
    v_actor_id := NULL;
  END;
  v_id := CASE WHEN TG_OP='DELETE' THEN OLD.id ELSE NEW.id END;
  v_session_actor_id := CASE WHEN TG_OP='DELETE' THEN OLD.ator_id ELSE NEW.ator_id END;
  INSERT INTO public.gsa_admin_audit_events(
    actor_type,actor_id,module,action,target_type,target_id,details
  ) VALUES (
    CASE WHEN v_actor_type IN ('admin','colaborador') THEN v_actor_type ELSE 'sistema' END,
    COALESCE(v_actor_id,v_session_actor_id),
    'acessos',TG_OP||'_SISTEMA_SESSOES','sistema_sessoes',v_id,
    jsonb_strip_nulls(jsonb_build_object(
      'old_status',CASE WHEN TG_OP='INSERT' THEN NULL ELSE OLD.status END,
      'new_status',CASE WHEN TG_OP='DELETE' THEN NULL ELSE NEW.status END
    ))
  );
  RETURN CASE WHEN TG_OP='DELETE' THEN OLD ELSE NEW END;
END;
$$;
REVOKE ALL ON FUNCTION public.gsa_admin_session_change_audit() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.gsa_admin_session_change_audit() TO service_role;

UPDATE public.sistema_sessoes
SET status = 'encerrado', encerrado_em = COALESCE(encerrado_em, now())
WHERE status = 'ativo' AND ultimo_acesso < now() - interval '24 hours';

CREATE OR REPLACE FUNCTION public.gsa_expire_stale_admin_sessions()
RETURNS integer
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp
AS $$
DECLARE v_count integer;
BEGIN
  UPDATE public.sistema_sessoes
     SET status='encerrado', encerrado_em=COALESCE(encerrado_em,now())
   WHERE status='ativo' AND ultimo_acesso < now() - interval '24 hours';
  GET DIAGNOSTICS v_count = ROW_COUNT;
  RETURN v_count;
END;
$$;
REVOKE ALL ON FUNCTION public.gsa_expire_stale_admin_sessions() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.gsa_expire_stale_admin_sessions() TO service_role;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_extension WHERE extname='pg_cron') THEN
    IF NOT EXISTS (SELECT 1 FROM cron.job WHERE jobname='gsa-expire-stale-admin-sessions') THEN
      PERFORM cron.schedule('gsa-expire-stale-admin-sessions','*/15 * * * *',
        'SELECT public.gsa_expire_stale_admin_sessions()');
    END IF;
  END IF;
EXCEPTION WHEN undefined_table OR insufficient_privilege THEN
  NULL;
END $$;

NOTIFY pgrst, 'reload schema';
COMMIT;
