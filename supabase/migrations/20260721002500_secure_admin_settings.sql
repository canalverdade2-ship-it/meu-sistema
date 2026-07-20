BEGIN;

CREATE OR REPLACE FUNCTION public.gsa_admin_allowed_setting_keys()
RETURNS text[]
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT ARRAY[
    'codigo_cadastro_padrao_ativo',
    'codigo_cadastro_padrao',
    'bonus_cadastro_tipo',
    'bonus_cadastro_valor',
    'valor_minimo_saque',
    'vencimento_padrao_servicos',
    'vencimento_padrao_produtos',
    'loja_taxa_entrega_padrao',
    'indicador_recompensa_tipo',
    'indicador_limite_carteira',
    'indicador_valor_pontos',
    'indicado_recompensa_tipo',
    'indicado_desconto_porcentagem',
    'indicado_valor_pontos',
    'template_mensagem_indicacao',
    'bonus_indicador',
    'desconto_indicado_porcentagem',
    'whatsapp_float_ativo',
    'whatsapp_float_telefone',
    'whatsapp_float_mensagem',
    'whatsapp_float_tamanho',
    'whatsapp_float_posicao',
    'whatsapp_float_tooltip',
    'modal_indicacao_ativo',
    'modal_indicacao_titulo',
    'modal_indicacao_descricao',
    'modal_indicacao_url_botao',
    'modal_indicacao_acao_botao',
    'modal_indicacao_modulo_destino',
    'modal_indicacao_texto_botao',
    'modal_indicacao_tamanho',
    'loja_credito_juros_avista',
    'loja_credito_juros_parcelado',
    'cobranca_multa_porcentagem',
    'cobranca_juros_mensal',
    'cobranca_juros_tipo'
  ]::text[];
$$;

CREATE OR REPLACE FUNCTION public.gsa_admin_settings_snapshot(
  p_sessao_id uuid DEFAULT NULL,
  p_session_token text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_company jsonb;
  v_methods jsonb;
  v_settings jsonb;
BEGIN
  PERFORM public.gsa_admin_validate_context(p_sessao_id, p_session_token);
  PERFORM public.gsa_admin_assert_module('configuracoes');

  SELECT to_jsonb(e) INTO v_company FROM public.empresa e ORDER BY e.id LIMIT 1;
  SELECT COALESCE(jsonb_agg(to_jsonb(f) ORDER BY f.nome), '[]'::jsonb)
    INTO v_methods
    FROM public.formas_pagamento f;
  SELECT COALESCE(jsonb_object_agg(s.key, s.value), '{}'::jsonb)
    INTO v_settings
    FROM public.system_settings s
   WHERE s.key = ANY(public.gsa_admin_allowed_setting_keys());

  RETURN jsonb_build_object(
    'company', v_company,
    'payment_methods', v_methods,
    'settings', v_settings
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.gsa_admin_update_settings_secure(
  p_sessao_id uuid DEFAULT NULL,
  p_session_token text DEFAULT NULL,
  p_settings jsonb DEFAULT '[]'::jsonb
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_item jsonb;
  v_key text;
  v_value text;
  v_count integer := 0;
BEGIN
  PERFORM public.gsa_admin_validate_context(p_sessao_id, p_session_token);
  PERFORM public.gsa_admin_assert_module('configuracoes');

  IF jsonb_typeof(COALESCE(p_settings, '[]'::jsonb)) <> 'array' THEN
    RAISE EXCEPTION 'Configurações devem ser enviadas em uma lista.' USING ERRCODE = '22023';
  END IF;

  FOR v_item IN SELECT value FROM jsonb_array_elements(COALESCE(p_settings, '[]'::jsonb)) LOOP
    v_key := trim(COALESCE(v_item ->> 'key', ''));
    v_value := COALESCE(v_item ->> 'value', '');

    IF NOT v_key = ANY(public.gsa_admin_allowed_setting_keys()) THEN
      RAISE EXCEPTION 'A configuração % não pode ser alterada por este painel.', v_key USING ERRCODE = '42501';
    END IF;

    IF length(v_value) > 4000 THEN
      RAISE EXCEPTION 'Valor excessivamente longo para a configuração %.', v_key USING ERRCODE = '22023';
    END IF;

    IF v_key IN ('valor_minimo_saque','loja_taxa_entrega_padrao','indicador_limite_carteira','indicador_valor_pontos','indicado_desconto_porcentagem','indicado_valor_pontos','bonus_cadastro_valor','loja_credito_juros_avista','loja_credito_juros_parcelado','cobranca_multa_porcentagem','cobranca_juros_mensal') THEN
      BEGIN
        IF v_value::numeric < 0 THEN
          RAISE EXCEPTION 'Valor negativo não permitido para %.', v_key USING ERRCODE = '22023';
        END IF;
      EXCEPTION WHEN invalid_text_representation THEN
        RAISE EXCEPTION 'Valor numérico inválido para %.', v_key USING ERRCODE = '22023';
      END;
    END IF;

    IF v_key IN ('vencimento_padrao_servicos','vencimento_padrao_produtos') THEN
      BEGIN
        IF v_value::integer < 1 OR v_value::integer > 365 THEN
          RAISE EXCEPTION 'Prazo inválido para %.', v_key USING ERRCODE = '22023';
        END IF;
      EXCEPTION WHEN invalid_text_representation THEN
        RAISE EXCEPTION 'Prazo inválido para %.', v_key USING ERRCODE = '22023';
      END;
    END IF;

    INSERT INTO public.system_settings (key, value)
    VALUES (v_key, v_value)
    ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value;
    v_count := v_count + 1;
  END LOOP;

  PERFORM public.gsa_admin_write_audit('configuracoes', 'ATUALIZAR_CONFIGURACOES', 'system_settings', NULL, jsonb_build_object('keys', (SELECT jsonb_agg(value ->> 'key') FROM jsonb_array_elements(COALESCE(p_settings, '[]'::jsonb)))));
  RETURN jsonb_build_object('success', true, 'updated', v_count);
END;
$$;

REVOKE ALL ON FUNCTION public.gsa_admin_allowed_setting_keys() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.gsa_admin_settings_snapshot(uuid, text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.gsa_admin_update_settings_secure(uuid, text, jsonb) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.gsa_admin_settings_snapshot(uuid, text) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.gsa_admin_update_settings_secure(uuid, text, jsonb) TO authenticated, service_role;

COMMIT;
