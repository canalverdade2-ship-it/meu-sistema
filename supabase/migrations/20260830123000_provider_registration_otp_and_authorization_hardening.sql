BEGIN;

CREATE TABLE IF NOT EXISTS public.gsa_provider_registration_challenges (
  id uuid PRIMARY KEY,
  telefone text NOT NULL,
  code_hash text NOT NULL,
  attempts integer NOT NULL DEFAULT 0 CHECK (attempts BETWEEN 0 AND 10),
  expires_at timestamptz NOT NULL,
  verified_at timestamptz,
  verification_token_hash text,
  verification_expires_at timestamptz,
  consumed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS gsa_provider_registration_challenges_phone_idx
  ON public.gsa_provider_registration_challenges (telefone, created_at DESC);
CREATE INDEX IF NOT EXISTS gsa_provider_registration_challenges_cleanup_idx
  ON public.gsa_provider_registration_challenges (expires_at, consumed_at);
ALTER TABLE public.gsa_provider_registration_challenges ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.gsa_provider_registration_challenges FROM PUBLIC, anon, authenticated;
GRANT ALL ON TABLE public.gsa_provider_registration_challenges TO service_role;
DROP POLICY IF EXISTS gsa_provider_registration_challenges_service_only ON public.gsa_provider_registration_challenges;
CREATE POLICY gsa_provider_registration_challenges_service_only ON public.gsa_provider_registration_challenges
  FOR ALL TO service_role USING (true) WITH CHECK (true);

CREATE OR REPLACE FUNCTION public.gsa_verify_provider_registration_challenge(
  p_challenge_id uuid,
  p_telefone text,
  p_code_hash text
) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER
SET search_path TO public, extensions, pg_temp
AS $$DECLARE
  v_phone text := regexp_replace(coalesce(p_telefone, ''), '\D', '', 'g');
  v_row public.gsa_provider_registration_challenges%ROWTYPE;
  v_token text;
BEGIN
  SELECT * INTO v_row
  FROM public.gsa_provider_registration_challenges
  WHERE id = p_challenge_id AND telefone = v_phone
  FOR UPDATE;

  IF NOT FOUND OR v_row.consumed_at IS NOT NULL OR v_row.verified_at IS NOT NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'invalid_or_used_challenge');
  END IF;
  IF now() > v_row.expires_at THEN
    RETURN jsonb_build_object('success', false, 'error', 'expired_code');
  END IF;
  IF v_row.attempts >= 5 THEN
    RETURN jsonb_build_object('success', false, 'error', 'too_many_attempts');
  END IF;

  IF v_row.code_hash IS DISTINCT FROM p_code_hash THEN
    UPDATE public.gsa_provider_registration_challenges
    SET attempts = attempts + 1
    WHERE id = p_challenge_id;
    RETURN jsonb_build_object(
      'success', false,
      'error', 'invalid_code',
      'attempts_left', greatest(0, 4 - v_row.attempts)
    );
  END IF;

  v_token := encode(extensions.gen_random_bytes(32), 'hex');  UPDATE public.gsa_provider_registration_challenges
  SET verified_at = now(),
      verification_token_hash = extensions.crypt(v_token, extensions.gen_salt('bf')),
      verification_expires_at = now() + interval '15 minutes'
  WHERE id = p_challenge_id;

  RETURN jsonb_build_object(
    'success', true,
    'verification_token', v_token,
    'expires_in', 900
  );
END;
$$;

REVOKE ALL ON FUNCTION public.gsa_verify_provider_registration_challenge(uuid,text,text)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.gsa_verify_provider_registration_challenge(uuid,text,text)
  TO service_role;

CREATE OR REPLACE FUNCTION public.gsa_normalize_provider_pix_key(
  p_tipo text,
  p_chave text
) RETURNS text
LANGUAGE plpgsql SECURITY DEFINER
SET search_path TO public, pg_temp
AS $$
DECLARE
  v_type text := lower(trim(coalesce(p_tipo, '')));
  v_key text := trim(coalesce(p_chave, ''));
  v_digits text := regexp_replace(v_key, '\D', '', 'g');
BEGIN
  CASE v_type
    WHEN 'cpf' THEN
      IF length(v_digits) <> 11 OR NOT public.gsa_is_valid_cpf(v_digits) THEN
        RAISE EXCEPTION 'Chave PIX CPF inválida';
      END IF;
      RETURN v_digits;    WHEN 'cnpj' THEN
      IF length(v_digits) <> 14 OR NOT public.gsa_is_valid_cnpj(v_digits) THEN
        RAISE EXCEPTION 'Chave PIX CNPJ inválida';
      END IF;
      RETURN v_digits;
    WHEN 'email' THEN
      v_key := lower(v_key);
      IF length(v_key) > 254 OR v_key !~* '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$' THEN
        RAISE EXCEPTION 'Chave PIX e-mail inválida';
      END IF;
      RETURN v_key;
    WHEN 'telefone' THEN
      IF length(v_digits) IN (10,11) THEN v_digits := '55' || v_digits; END IF;
      IF length(v_digits) NOT IN (12,13) OR left(v_digits,2) <> '55' THEN
        RAISE EXCEPTION 'Chave PIX telefone inválida';
      END IF;
      RETURN '+' || v_digits;
    WHEN 'aleatoria' THEN
      IF lower(v_key) !~ '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$' THEN
        RAISE EXCEPTION 'Chave PIX aleatória inválida';
      END IF;
      RETURN lower(v_key);
    ELSE
      RAISE EXCEPTION 'Tipo de chave PIX inválido';
  END CASE;
END;
$$;

REVOKE ALL ON FUNCTION public.gsa_normalize_provider_pix_key(text,text)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.gsa_normalize_provider_pix_key(text,text) TO service_role;

CREATE OR REPLACE FUNCTION public.gsa_is_safe_provider_result_url(p_url text)
RETURNS boolean
LANGUAGE sql IMMUTABLE
SET search_path TO pg_catalog
AS $$
  SELECT p_url IS NULL OR btrim(p_url) = '' OR (
    btrim(p_url) ~* '^https?://[A-Za-z0-9]'
    AND btrim(p_url) !~* '^https?://(localhost|127\.|0\.0\.0\.0|10\.|192\.168\.|172\.(1[6-9]|2[0-9]|3[01])\.)'
  );
$$;REVOKE ALL ON FUNCTION public.gsa_is_safe_provider_result_url(text)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.gsa_is_safe_provider_result_url(text) TO service_role;

CREATE OR REPLACE FUNCTION public.gsa_public_register_provider(
  p_payload jsonb,
  p_verification_token text
) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER
SET search_path TO public, extensions, pg_temp
AS $$
DECLARE
  v_payload jsonb := coalesce(p_payload, '{}'::jsonb);
  v_tipo text := lower(trim(coalesce(v_payload->>'tipo_cadastro', '')));
  v_nome text := trim(coalesce(v_payload->>'nome_razao', ''));
  v_doc text := regexp_replace(coalesce(v_payload->>'documento', ''), '\D', '', 'g');
  v_email text := lower(trim(coalesce(v_payload->>'email', '')));
  v_phone text := regexp_replace(coalesce(v_payload->>'telefone', ''), '\D', '', 'g');
  v_cep text := regexp_replace(coalesce(v_payload->>'cep', ''), '\D', '', 'g');
  v_pin text := regexp_replace(coalesce(v_payload->>'pin', ''), '\D', '', 'g');
  v_challenge public.gsa_provider_registration_challenges%ROWTYPE;
  v_id uuid;
BEGIN
  IF pg_column_size(v_payload) > 24576 THEN RAISE EXCEPTION 'Dados excedem o limite permitido.'; END IF;
  PERFORM public.gsa_assert_public_rate_limit('cadastro_prestador_ip', 'cadastro', 10, interval '1 hour');
  PERFORM public.gsa_assert_public_rate_limit('cadastro_prestador_documento', v_doc, 5, interval '1 hour');
  PERFORM public.gsa_assert_public_rate_limit('cadastro_prestador_telefone', v_phone, 5, interval '1 hour');

  IF v_tipo NOT IN ('cpf', 'cnpj') THEN RAISE EXCEPTION 'Tipo de documento inválido.'; END IF;
  IF v_tipo = 'cpf' AND NOT public.gsa_is_valid_cpf(v_doc) THEN RAISE EXCEPTION 'CPF inválido.'; END IF;
  IF v_tipo = 'cnpj' AND NOT public.gsa_is_valid_cnpj(v_doc) THEN RAISE EXCEPTION 'CNPJ inválido.'; END IF;
  IF length(v_nome) < 3 OR length(v_nome) > 180 THEN RAISE EXCEPTION 'Informe o nome ou razão social.'; END IF;
  IF v_tipo = 'cnpj' AND length(trim(coalesce(v_payload->>'nome_responsavel', ''))) < 3 THEN RAISE EXCEPTION 'Informe o responsável pela empresa.'; END IF;  IF length(v_email) > 254 OR v_email !~* '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$' THEN RAISE EXCEPTION 'E-mail inválido.'; END IF;
  IF length(v_phone) NOT IN (10,11) THEN RAISE EXCEPTION 'Telefone inválido.'; END IF;
  IF v_cep <> '' AND length(v_cep) <> 8 THEN RAISE EXCEPTION 'CEP inválido.'; END IF;
  IF length(trim(coalesce(v_payload->>'numero', ''))) < 1 OR length(trim(coalesce(v_payload->>'numero', ''))) > 30 THEN RAISE EXCEPTION 'Número do endereço inválido.'; END IF;
  IF length(trim(coalesce(v_payload->>'area_servico', ''))) < 2 OR length(trim(coalesce(v_payload->>'area_servico', ''))) > 160 THEN RAISE EXCEPTION 'Informe a área de serviço.'; END IF;
  IF length(coalesce(v_payload->>'observacoes', '')) > 2000 THEN RAISE EXCEPTION 'Observações excedem o limite permitido.'; END IF;
  IF v_pin !~ '^\d{4}$' THEN RAISE EXCEPTION 'PIN de acesso inválido.'; END IF;
  IF coalesce(length(p_verification_token), 0) < 32 THEN RAISE EXCEPTION 'Verificação do WhatsApp obrigatória.'; END IF;

  SELECT * INTO v_challenge
  FROM public.gsa_provider_registration_challenges c
  WHERE c.telefone = v_phone
    AND c.verified_at IS NOT NULL
    AND c.consumed_at IS NULL
    AND c.verification_expires_at > now()
    AND c.verification_token_hash IS NOT NULL
    AND extensions.crypt(p_verification_token, c.verification_token_hash) = c.verification_token_hash
  ORDER BY c.verified_at DESC
  LIMIT 1
  FOR UPDATE;

  IF NOT FOUND THEN RAISE EXCEPTION 'Verificação do WhatsApp inválida ou expirada.' USING ERRCODE='42501'; END IF;
  IF EXISTS (SELECT 1 FROM public.prestadores WHERE documento = v_doc) THEN
    RAISE EXCEPTION 'Cadastro não concluído. Verifique os dados ou procure o suporte.';
  END IF;

  UPDATE public.gsa_provider_registration_challenges
  SET consumed_at = now()
  WHERE id = v_challenge.id;

  INSERT INTO public.prestadores(
    tipo_cadastro,nome_razao,nome_responsavel,documento,email,telefone,cep,numero,
    area_servico,observacoes,status,pin_hash
  ) VALUES (    v_tipo,v_nome,
    CASE WHEN v_tipo='cnpj' THEN trim(v_payload->>'nome_responsavel') END,
    v_doc,v_email,v_phone,nullif(v_cep,''),nullif(trim(v_payload->>'numero'),''),
    trim(v_payload->>'area_servico'),nullif(trim(coalesce(v_payload->>'observacoes','')),''),
    'pendente', extensions.crypt(v_pin, extensions.gen_salt('bf'))
  ) RETURNING id INTO v_id;

  PERFORM set_config('gsa.system_override','on',true);
  INSERT INTO public.notificacoes(
    titulo,mensagem,modulo,tab,item_id,tipo,destinatario_tipo,prioridade,acao_origem,contexto
  ) VALUES (
    'Novo cadastro de prestador',
    'O prestador ' || v_nome || ' verificou o WhatsApp e aguarda análise do sistema.',
    'cadastro','pendente',v_id::text,'sistema','admin','alta','cadastro_prestador',
    jsonb_build_object('prestador_id',v_id,'whatsapp_verificado',true)
  );

  RETURN jsonb_build_object('success',true,'prestador_id',v_id,'status','pendente');
EXCEPTION WHEN unique_violation THEN
  RAISE EXCEPTION 'Cadastro não concluído. Verifique os dados ou procure o suporte.';
END;
$$;

DROP FUNCTION IF EXISTS public.gsa_public_register_provider(jsonb);
REVOKE ALL ON FUNCTION public.gsa_public_register_provider(jsonb,text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.gsa_public_register_provider(jsonb,text) TO anon, authenticated, service_role;

-- O código de confirmação nunca pode voltar ao navegador. Todos os formulários
-- usam o gateway gsa-auth-session, que gera, envia e valida o código no servidor.
CREATE OR REPLACE FUNCTION public.gsa_solicitar_pin_whatsapp(p_telefone text)
RETURNS text
LANGUAGE plpgsql SECURITY DEFINER
SET search_path TO public, pg_temp
AS $$
BEGIN
  RAISE EXCEPTION 'Fluxo legado de PIN desativado. Use o gateway seguro de autenticação.' USING ERRCODE='42501';
END;
$$;

CREATE OR REPLACE FUNCTION public.gsa_validar_pin_whatsapp(p_telefone text,p_pin text)
RETURNS boolean
LANGUAGE plpgsql SECURITY DEFINER
SET search_path TO public, pg_temp
AS $$
BEGIN
  RAISE EXCEPTION 'Fluxo legado de PIN desativado. Use o gateway seguro de autenticação.' USING ERRCODE='42501';
END;
$$;

REVOKE ALL ON FUNCTION public.gsa_solicitar_pin_whatsapp(text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.gsa_validar_pin_whatsapp(text,text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.gsa_solicitar_pin_whatsapp(text) TO service_role;
GRANT EXECUTE ON FUNCTION public.gsa_validar_pin_whatsapp(text,text) TO service_role;

CREATE OR REPLACE FUNCTION public.gsa_assert_current_provider()
RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER
SET search_path TO public, pg_temp
AS $$
BEGIN
  RETURN (public.gsa_provider_context(true)->>'provider_id')::uuid;
END;
$$;REVOKE ALL ON FUNCTION public.gsa_assert_current_provider() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.gsa_assert_current_provider() TO service_role;

CREATE OR REPLACE FUNCTION public.gsa_login_pin(p_documento text,p_pin text,p_tipo text)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER
SET search_path TO public, extensions, pg_temp
AS $$
DECLARE
  v_record record;
  v_documento text := regexp_replace(coalesce(p_documento,''),'\D','','g');
  v_scope text;
  v_rate_key text;
  v_attempts integer;
  v_session jsonb;
BEGIN
  IF p_tipo NOT IN ('cliente','prestador','fornecedor') THEN
    RETURN jsonb_build_object('valid',false,'error','Tipo de acesso inválido.');
  END IF;
  IF p_pin !~ '^\d{4}$' THEN RETURN jsonb_build_object('valid',false,'error','Senha inválida.'); END IF;

  v_scope := 'pin_' || p_tipo;
  v_rate_key := public.gsa_assert_auth_rate_limit(v_scope,v_documento,8,interval '15 minutes');

  IF p_tipo='cliente' THEN
    SELECT id,nome,status,cadastro_aprovado,pin_hash,pin_tentativas,pin_bloqueado
    INTO v_record FROM public.clientes
    WHERE regexp_replace(coalesce(cpf,cnpj,''),'\D','','g')=v_documento LIMIT 1 FOR UPDATE;
  ELSIF p_tipo='prestador' THEN
    SELECT id,nome_razao AS nome,status,true AS cadastro_aprovado,pin_hash,pin_tentativas,pin_bloqueado
    INTO v_record FROM public.prestadores
    WHERE regexp_replace(coalesce(documento,''),'\D','','g')=v_documento LIMIT 1 FOR UPDATE;
  ELSE
    SELECT id,coalesce(nome_fantasia,razao_social) AS nome,status,status='ativo' AS cadastro_aprovado,
           pin_hash,pin_tentativas,pin_bloqueado
    INTO v_record FROM public.fornecedores
    WHERE documento=v_documento LIMIT 1 FOR UPDATE;
  END IF;  IF v_record.id IS NULL THEN
    PERFORM public.gsa_record_auth_attempt(v_scope,v_rate_key,false);
    RETURN jsonb_build_object('valid',false,'error','Credenciais inválidas.');
  END IF;
  IF v_record.pin_hash IS NULL THEN
    PERFORM public.gsa_record_auth_attempt(v_scope,v_rate_key,false);
    RETURN jsonb_build_object('valid',false,'error','primeiro_acesso','nome',v_record.nome);
  END IF;
  IF coalesce(v_record.pin_bloqueado,false) THEN
    RETURN jsonb_build_object('valid',false,'error','blocked','nome',v_record.nome);
  END IF;

  IF p_tipo='prestador' AND v_record.status <> 'ativo' THEN
    PERFORM public.gsa_record_auth_attempt(v_scope,v_rate_key,false);
    RETURN jsonb_build_object('valid',false,'error','Cadastro ainda não aprovado ou indisponível.');
  END IF;
  IF p_tipo='fornecedor' AND v_record.status <> 'ativo' THEN
    PERFORM public.gsa_record_auth_attempt(v_scope,v_rate_key,false);
    RETURN jsonb_build_object('valid',false,'error','Cadastro ainda não aprovado ou indisponível.');
  END IF;

  IF extensions.crypt(p_pin,v_record.pin_hash) <> v_record.pin_hash THEN
    v_attempts := coalesce(v_record.pin_tentativas,0)+1;
    IF p_tipo='cliente' THEN
      UPDATE public.clientes SET pin_tentativas=v_attempts,pin_bloqueado=v_attempts>=4 WHERE id=v_record.id;
    ELSIF p_tipo='prestador' THEN
      UPDATE public.prestadores SET pin_tentativas=v_attempts,pin_bloqueado=v_attempts>=4 WHERE id=v_record.id;
    ELSE
      UPDATE public.fornecedores SET pin_tentativas=v_attempts,pin_bloqueado=v_attempts>=4 WHERE id=v_record.id;
    END IF;
    PERFORM public.gsa_record_auth_attempt(v_scope,v_rate_key,false);
    RETURN jsonb_build_object('valid',false,'error',CASE WHEN v_attempts>=4 THEN 'blocked' ELSE 'wrong_pin' END,
      'attempts_left',greatest(0,4-v_attempts));
  END IF;

  IF p_tipo='cliente' AND v_record.status='inativo' AND coalesce(v_record.cadastro_aprovado,true) THEN
    PERFORM public.gsa_reactivate_client_after_pin(v_record.id); v_record.status := 'ativo';
  END IF;  IF p_tipo='cliente' THEN UPDATE public.clientes SET pin_tentativas=0 WHERE id=v_record.id;
  ELSIF p_tipo='prestador' THEN UPDATE public.prestadores SET pin_tentativas=0 WHERE id=v_record.id;
  ELSE UPDATE public.fornecedores SET pin_tentativas=0 WHERE id=v_record.id;
  END IF;

  v_session := public.gsa_create_session_internal(p_tipo,v_record.id,v_record.nome,'{}'::jsonb);
  PERFORM public.gsa_record_auth_attempt(v_scope,v_rate_key,true);
  RETURN jsonb_build_object('valid',true,'id',v_record.id,'nome',v_record.nome,'status',v_record.status,'session',v_session);
END;
$$;

CREATE OR REPLACE FUNCTION public.gsa_provider_request_withdrawal(
  p_valor numeric,p_tipo_chave_pix text,p_chave_pix text
) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER
SET search_path TO public, pg_temp
AS $$
DECLARE
  v_provider_id uuid := public.gsa_assert_current_provider();
  v_balance numeric := 0;
  v_saque_id uuid;
  v_pix_type text := lower(trim(coalesce(p_tipo_chave_pix,'')));
  v_pix_key text;
BEGIN
  IF p_valor IS NULL OR p_valor <= 0 THEN RAISE EXCEPTION 'Valor de saque inválido'; END IF;
  v_pix_key := public.gsa_normalize_provider_pix_key(v_pix_type,p_chave_pix);

  PERFORM 1 FROM public.prestadores WHERE id=v_provider_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Prestador não encontrado'; END IF;
  IF EXISTS (SELECT 1 FROM public.prestador_saques WHERE prestador_id=v_provider_id AND status IN ('pendente','em_analise','em_processamento')) THEN
    RAISE EXCEPTION 'Já existe um saque pendente';
  END IF;

  SELECT coalesce(sum(CASE WHEN tipo='credito' THEN valor ELSE -valor END),0)
  INTO v_balance FROM public.prestador_transacoes
  WHERE prestador_id=v_provider_id AND status='concluido';
  IF p_valor > v_balance THEN RAISE EXCEPTION 'Saldo insuficiente'; END IF;  INSERT INTO public.prestador_saques(
    prestador_id,valor,valor_liquido,taxa_aplicada,tipo_chave_pix,chave_pix,status,data_vencimento
  ) VALUES (
    v_provider_id,p_valor,p_valor,0,v_pix_type,v_pix_key,'pendente',now()+interval '7 days'
  ) RETURNING id INTO v_saque_id;

  INSERT INTO public.prestador_transacoes(prestador_id,tipo,valor,descricao,status,saque_id)
  VALUES (v_provider_id,'debito',p_valor,'Solicitação de saque via PIX','concluido',v_saque_id);

  RETURN jsonb_build_object('success',true,'saque_id',v_saque_id,'saldo_anterior',v_balance);
END;
$$;

CREATE OR REPLACE FUNCTION public.gsa_provider_update_profile(
  p_telefone text,p_cep text,p_numero text,p_area_servico text
) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER
SET search_path TO public, pg_temp
AS $$
DECLARE
  v_provider_id uuid := public.gsa_assert_current_provider();
  v_phone text := regexp_replace(coalesce(p_telefone,''),'\D','','g');
  v_cep text := regexp_replace(coalesce(p_cep,''),'\D','','g');
  v_number text := trim(coalesce(p_numero,''));
  v_area text := trim(coalesce(p_area_servico,''));
BEGIN
  IF length(v_phone) NOT IN (10,11) THEN RAISE EXCEPTION 'Telefone inválido'; END IF;
  IF length(v_cep) <> 8 THEN RAISE EXCEPTION 'CEP inválido'; END IF;
  IF length(v_number) < 1 OR length(v_number) > 30 THEN RAISE EXCEPTION 'Número do endereço inválido'; END IF;
  IF length(v_area) < 2 OR length(v_area) > 160 THEN RAISE EXCEPTION 'Área de serviço inválida'; END IF;

  UPDATE public.prestadores
  SET telefone=v_phone,cep=v_cep,numero=v_number,area_servico=v_area,updated_at=now()
  WHERE id=v_provider_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Prestador não encontrado'; END IF;
  RETURN jsonb_build_object('success',true);
END;
$$;

CREATE OR REPLACE FUNCTION public.gsa_provider_transition_demand(
  p_demanda_id uuid,p_action text,p_payload jsonb DEFAULT '{}'::jsonb
) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER
SET search_path TO public, pg_temp
AS $$DECLARE
  v_provider_id uuid := public.gsa_assert_current_provider();
  v_demand public.prestador_demandas%ROWTYPE;
  v_value numeric;
  v_reason text;
  v_files jsonb := '[]'::jsonb;
  v_link text;
  v_event text;
  v_history text;
BEGIN
  SELECT * INTO v_demand FROM public.prestador_demandas
  WHERE id=p_demanda_id AND prestador_id=v_provider_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Demanda não encontrada para este prestador'; END IF;

  CASE p_action
    WHEN 'accept' THEN
      IF v_demand.status NOT IN ('aguardando_aceite','aberta','em_negociacao','contraproposta_admin_final') THEN
        RAISE EXCEPTION 'A demanda não está disponível para aceite';
      END IF;
      v_value := coalesce(v_demand.valor_proposto_admin,v_demand.valor_final,v_demand.valor_proposto_prestador);
      IF v_value IS NULL OR v_value <= 0 THEN RAISE EXCEPTION 'Demanda sem valor válido para aceite'; END IF;
      UPDATE public.prestador_demandas SET status='ativa',data_inicio=now(),valor_final=v_value WHERE id=p_demanda_id;
      v_event:='aceite'; v_history:='Proposta aceita pelo prestador pelo valor de '||v_value::text;

    WHEN 'reject' THEN
      IF v_demand.status NOT IN ('aguardando_aceite','aberta','em_negociacao','contraproposta_admin_final') THEN
        RAISE EXCEPTION 'A demanda não está disponível para recusa';
      END IF;
      v_reason:=nullif(trim(p_payload->>'motivo'),'');
      IF v_reason IS NULL OR length(v_reason)<3 THEN RAISE EXCEPTION 'Informe o motivo da recusa'; END IF;
      UPDATE public.prestador_demandas SET status='aguardando_atribuicao',prestador_id=NULL WHERE id=p_demanda_id;
      v_event:='recusa'; v_history:='Proposta recusada pelo prestador. Motivo: '||v_reason;

    WHEN 'counteroffer' THEN
      IF v_demand.status NOT IN ('aguardando_aceite','aberta','em_negociacao','contraproposta_admin_final') THEN
        RAISE EXCEPTION 'A demanda não está disponível para negociação';
      END IF;
      v_value:=nullif(p_payload->>'valor','')::numeric;
      IF v_value IS NULL OR v_value<=0 THEN RAISE EXCEPTION 'Valor da contraproposta inválido'; END IF;
      v_reason:=nullif(trim(p_payload->>'motivo'),'');
      UPDATE public.prestador_demandas SET status='contraproposta_prestador',valor_proposto_prestador=v_value,motivo_negociacao=v_reason WHERE id=p_demanda_id;
      v_event:='negociacao'; v_history:='Contraproposta do prestador: '||v_value::text||coalesce('. '||v_reason,'');    WHEN 'deliver' THEN
      IF v_demand.status NOT IN ('ativa','em_ajuste') THEN RAISE EXCEPTION 'A demanda não está disponível para entrega'; END IF;
      v_files:=coalesce(p_payload->'arquivos','[]'::jsonb);
      IF jsonb_typeof(v_files)<>'array' OR jsonb_array_length(v_files)>5 THEN RAISE EXCEPTION 'Lista de arquivos da entrega inválida'; END IF;
      v_link:=nullif(trim(p_payload->>'link'),'');
      IF NOT public.gsa_is_safe_provider_result_url(v_link) THEN RAISE EXCEPTION 'Link da entrega inválido ou inseguro'; END IF;
      UPDATE public.prestador_demandas
      SET status='em_analise',
          data_entrega_prestador=now(),
          observacao_entrega=nullif(left(trim(coalesce(p_payload->>'observacao','')),2000),''),
          link_resultado=v_link,
          arquivos_resultado=coalesce(arquivos_resultado,'[]'::jsonb)||v_files,
          status_ajuste=CASE WHEN status_ajuste='solicitado' THEN 'entregue' ELSE status_ajuste END
      WHERE id=p_demanda_id;
      v_event:='entrega'; v_history:='Entrega realizada pelo prestador e enviada para análise.';

    WHEN 'return' THEN
      IF v_demand.status NOT IN ('ativa','em_ajuste') THEN RAISE EXCEPTION 'A demanda não pode ser devolvida neste status'; END IF;
      v_reason:=nullif(trim(p_payload->>'motivo'),'');
      IF v_reason IS NULL OR length(v_reason)<3 THEN RAISE EXCEPTION 'Informe o motivo da devolução'; END IF;
      v_files:=coalesce(p_payload->'arquivos','[]'::jsonb);
      IF jsonb_typeof(v_files)<>'array' OR jsonb_array_length(v_files)>5 THEN RAISE EXCEPTION 'Lista de anexos da devolução inválida'; END IF;
      UPDATE public.prestador_demandas
      SET prestador_id=NULL,status='aguardando_atribuicao',
          detalhes=coalesce(detalhes,descricao,'')||E'\n\n--- DEVOLUÇÃO DO PRESTADOR ---\nMotivo: '||v_reason,
          arquivos_transferencia=coalesce(arquivos_transferencia,'[]'::jsonb)||v_files
      WHERE id=p_demanda_id;
      v_event:='transferencia'; v_history:='Demanda devolvida para a equipe interna. Motivo: '||v_reason;
    ELSE
      RAISE EXCEPTION 'Ação de demanda inválida';
  END CASE;

  INSERT INTO public.prestador_demandas_historico(
    demanda_id,tipo_evento,motivo,prestador_origem_id,valor_proposto
  ) VALUES (
    p_demanda_id,v_event,v_history,v_provider_id,
    CASE WHEN p_action='counteroffer' THEN v_value ELSE NULL END
  );
  RETURN jsonb_build_object('success',true,'action',p_action);
END;
$$;

DO $$
DECLARE r record;
BEGIN
  FOR r IN
    SELECT p.oid::regprocedure AS signature
    FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
    WHERE n.nspname='public' AND p.proname LIKE 'gsa_provider_%'
  LOOP
    EXECUTE format('REVOKE ALL ON FUNCTION %s FROM PUBLIC, anon',r.signature);
  END LOOP;
END;
$$;

REVOKE ALL ON FUNCTION public.gsa_provider_context(boolean) FROM authenticated;
REVOKE ALL ON FUNCTION public.gsa_provider_insert_admin_notification(text,text,text,text,uuid,text,jsonb) FROM authenticated;
REVOKE ALL ON FUNCTION public.gsa_provider_write_audit(text,text,uuid,jsonb) FROM authenticated;
REVOKE ALL ON FUNCTION public.gsa_provider_session_actor(uuid,text) FROM authenticated;GRANT EXECUTE ON FUNCTION public.gsa_provider_financial_snapshot() TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.gsa_provider_dashboard_snapshot() TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.gsa_provider_pendency_snapshot() TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.gsa_provider_request_withdrawal(numeric,text,text) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.gsa_provider_cancel_withdrawal(uuid,text) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.gsa_provider_redeem_voucher(uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.gsa_provider_redeem_prize(uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.gsa_provider_activate_promotion(uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.gsa_provider_update_profile(text,text,text,text) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.gsa_provider_create_schedule(uuid,timestamptz,timestamptz,text) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.gsa_provider_complete_schedule(uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.gsa_provider_delete_schedule(uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.gsa_provider_submit_document(uuid,text[]) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.gsa_provider_transition_demand(uuid,text,jsonb) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.gsa_provider_create_ticket(text,text,boolean) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.gsa_provider_send_ticket_message(uuid,text,text,text) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.gsa_provider_request_profile_change(text,text,text) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.gsa_provider_request_demand_support(uuid,text) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.gsa_provider_mark_notification_read(uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.gsa_provider_mark_all_notifications_read() TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.gsa_provider_session_access_state() TO authenticated, service_role;

GRANT EXECUTE ON FUNCTION public.gsa_provider_context(boolean) TO service_role;
GRANT EXECUTE ON FUNCTION public.gsa_provider_insert_admin_notification(text,text,text,text,uuid,text,jsonb) TO service_role;
GRANT EXECUTE ON FUNCTION public.gsa_provider_write_audit(text,text,uuid,jsonb) TO service_role;
GRANT EXECUTE ON FUNCTION public.gsa_provider_session_actor(uuid,text) TO service_role;

DELETE FROM public.gsa_whatsapp_verifications
WHERE expires_at < now() - interval '1 day';
DELETE FROM public.gsa_provider_registration_challenges
WHERE created_at < now() - interval '2 days';

NOTIFY pgrst,'reload schema';
COMMIT;
