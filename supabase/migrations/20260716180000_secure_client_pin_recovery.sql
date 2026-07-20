-- Create gsa_get_client_session_access_state function
CREATE OR REPLACE FUNCTION public.gsa_get_client_session_access_state(
  p_sessao_id uuid,
  p_session_token text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_session record;
  v_precisa boolean;
BEGIN
  SELECT * INTO v_session
  FROM public.gsa_validate_session(p_sessao_id, p_session_token)
  LIMIT 1;

  IF NOT coalesce(v_session.is_valid, false)
     OR v_session.ator_tipo <> 'cliente'
     OR v_session.ator_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Sessao de cliente invalida ou expirada.');
  END IF;

  v_precisa := coalesce((v_session.metadata->>'precisa_trocar_senha')::boolean, false);

  RETURN jsonb_build_object(
    'success', true,
    'recovery_only', v_precisa,
    'precisa_trocar_senha', v_precisa
  );
END;
$$;

-- Ensure permissions for gsa_get_client_session_access_state
REVOKE ALL ON FUNCTION public.gsa_get_client_session_access_state(uuid, text) FROM public, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.gsa_get_client_session_access_state(uuid, text) TO anon, authenticated;


-- Update gsa_client_session_actor to block if precisa_trocar_senha is true
CREATE OR REPLACE FUNCTION public.gsa_client_session_actor(
  p_sessao_id uuid,
  p_session_token text
)
RETURNS TABLE(cliente_id uuid, cliente_nome text)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_session record;
BEGIN
  SELECT * INTO v_session
  FROM public.gsa_validate_session(p_sessao_id, p_session_token)
  LIMIT 1;

  IF NOT coalesce(v_session.is_valid, false)
     OR v_session.ator_tipo <> 'cliente'
     OR v_session.ator_id IS NULL THEN
    RAISE EXCEPTION 'Sessao de cliente invalida ou expirada.';
  END IF;

  IF coalesce((v_session.metadata->>'precisa_trocar_senha')::boolean, false) THEN
    RAISE EXCEPTION 'Troca de senha obrigatória antes de acessar esta operação.';
  END IF;

  RETURN QUERY SELECT v_session.ator_id, v_session.ator_nome;
END;
$$;


-- Update gsa_change_own_pin to block if precisa_trocar_senha is true
CREATE OR REPLACE FUNCTION public.gsa_change_own_pin(
  p_sessao_id uuid,
  p_session_token text,
  p_current_pin text,
  p_new_pin text
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  v_session record;
BEGIN
  SELECT * INTO v_session
  FROM public.gsa_validate_session(p_sessao_id, p_session_token)
  LIMIT 1;

  IF NOT coalesce(v_session.is_valid, false)
     OR v_session.ator_tipo NOT IN ('cliente', 'prestador') THEN
    RAISE EXCEPTION 'Sessao invalida ou expirada.';
  END IF;
  
  IF coalesce((v_session.metadata->>'precisa_trocar_senha')::boolean, false) THEN
    RAISE EXCEPTION 'Utilize o fluxo de recuperação de senha.';
  END IF;

  IF NOT public.gsa_verify_own_pin(p_sessao_id, p_session_token, p_current_pin) THEN
    RAISE EXCEPTION 'Senha atual incorreta.';
  END IF;
  IF p_new_pin !~ '^\d{4}$' THEN
    RAISE EXCEPTION 'A nova senha deve ter exatamente 4 digitos.';
  END IF;
  IF p_new_pin = p_current_pin THEN
    RAISE EXCEPTION 'A nova senha deve ser diferente da senha atual.';
  END IF;

  IF v_session.ator_tipo = 'cliente' THEN
    UPDATE public.clientes
       SET pin_hash = extensions.crypt(p_new_pin, extensions.gen_salt('bf', 12)),
           pin_tentativas = 0,
           pin_bloqueado = false,
           updated_at = now()
     WHERE id = v_session.ator_id;
  ELSE
    UPDATE public.prestadores
       SET pin_hash = extensions.crypt(p_new_pin, extensions.gen_salt('bf', 12)),
           pin_tentativas = 0,
           pin_bloqueado = false,
           updated_at = now()
     WHERE id = v_session.ator_id;
  END IF;

  INSERT INTO public.sistema_logs(acao, detalhes, ator_tipo, ator_id, ator_nome)
  VALUES (
    'ALTERAR_PIN',
    'Senha de acesso alterada pelo proprio usuario.',
    v_session.ator_tipo,
    v_session.ator_id,
    v_session.ator_nome
  );

  RETURN true;
END;
$$;


-- Redefine gsa_update_client_pin securely
CREATE OR REPLACE FUNCTION public.gsa_update_client_pin(
  p_sessao_id uuid,
  p_session_token text,
  p_new_pin text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  v_session record;
BEGIN
  SELECT * INTO v_session
  FROM public.gsa_validate_session(p_sessao_id, p_session_token)
  LIMIT 1;

  IF NOT coalesce(v_session.is_valid, false)
     OR v_session.ator_tipo <> 'cliente'
     OR v_session.ator_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Sessao de cliente invalida ou expirada.');
  END IF;

  IF NOT coalesce((v_session.metadata->>'precisa_trocar_senha')::boolean, false) THEN
    RETURN jsonb_build_object('success', false, 'error', 'A sessão não está em modo de recuperação.');
  END IF;

  IF p_new_pin !~ '^\d{4}$' THEN
    RETURN jsonb_build_object('success', false, 'error', 'A nova senha deve ter exatamente 4 digitos.');
  END IF;
  
  IF EXISTS (
      SELECT 1 FROM public.clientes 
      WHERE id = v_session.ator_id 
      AND pin_hash = extensions.crypt(p_new_pin, pin_hash)
  ) THEN
      RETURN jsonb_build_object('success', false, 'error', 'A nova senha deve ser diferente da atual.');
  END IF;

  UPDATE public.clientes
     SET pin_hash = extensions.crypt(p_new_pin, extensions.gen_salt('bf', 12)),
         pin_tentativas = 0,
         pin_bloqueado = false,
         updated_at = now()
   WHERE id = v_session.ator_id;

  UPDATE public.sistema_sessoes
     SET metadata = jsonb_set(
                      jsonb_set(coalesce(metadata, '{}'::jsonb), '{precisa_trocar_senha}', 'false'), 
                      '{recuperacao_concluida_em}', 
                      to_jsonb(now()::text)
                    )
   WHERE id = p_sessao_id;

  INSERT INTO public.sistema_logs(acao, detalhes, ator_tipo, ator_id, ator_nome)
  VALUES (
    'CONCLUIR_RECUPERACAO_PIN',
    'Nova senha configurada com sucesso e sessao liberada.',
    v_session.ator_tipo,
    v_session.ator_id,
    v_session.ator_nome
  );

  RETURN jsonb_build_object(
    'success', true, 
    'precisa_trocar_senha', false,
    'recovery_only', false
  );
END;
$$;


-- Drop old cliente_operational_write
DROP FUNCTION IF EXISTS public.cliente_operational_write(uuid, text, text, jsonb, jsonb);

-- Redefine cliente_operational_write to use session tokens
CREATE OR REPLACE FUNCTION public.cliente_operational_write(
  p_sessao_id uuid,
  p_session_token text,
  p_table text,
  p_action text,
  p_data jsonb DEFAULT '{}'::jsonb,
  p_filter jsonb DEFAULT '{}'::jsonb
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_session record;
  p_cliente_id uuid;
  v_allowed text[] := ARRAY[
    'tickets',
    'ticket_mensagens',
    'cliente_documentos',
    'loja_carrinhos',
    'cliente_cupons',
    'cupons_ativados',
    'cliente_promocoes',
    'promocoes_quantidade_uso',
    'promocoes_quantidade_ativadas',
    'loja_solicitacoes',
    'loja_avaliacoes',
    'emprestimos',
    'emprestimo_documentos',
    'emprestimo_historico',
    'emprestimo_comentarios',
    'orcamentos',
    'loja_credito_solicitacoes',
    'loja_credito_documentos',
    'indicacoes',
    'vouchers',
    'ordens_assinatura',
    'ordens_servico',
    'os_notas',
    'os_suporte_mensagens',
    'premios',
    'solicitacoes_premios',
    'cliente_premios',
    'fatura_contestacoes',
    'clientes'
  ];
  v_table text := lower(trim(p_table));
  v_action text := lower(trim(p_action));
  v_data jsonb := coalesce(p_data, '{}'::jsonb);
  v_filter jsonb := coalesce(p_filter, '{}'::jsonb);
  v_sql text;
  v_cols text;
  v_vals text;
  v_sets text;
  v_where text := '';
  v_result jsonb;
  v_has_cliente_id boolean;
  v_key text;
  v_value jsonb;
  v_idx integer := 0;
BEGIN
  SELECT * INTO v_session
  FROM public.gsa_validate_session(p_sessao_id, p_session_token)
  LIMIT 1;

  IF NOT coalesce(v_session.is_valid, false) OR v_session.ator_tipo <> 'cliente' THEN
    RAISE EXCEPTION 'Sessao de cliente invalida ou expirada.';
  END IF;
  
  IF coalesce((v_session.metadata->>'precisa_trocar_senha')::boolean, false) THEN
    RAISE EXCEPTION 'Troca de senha obrigatória antes de acessar esta operação.';
  END IF;

  p_cliente_id := v_session.ator_id;

  IF p_cliente_id IS NULL THEN
    RAISE EXCEPTION 'Cliente obrigatorio.';
  END IF;

  IF NOT (v_table = ANY(v_allowed)) THEN
    RAISE EXCEPTION 'Tabela nao permitida para escrita operacional: %', v_table;
  END IF;

  IF v_action NOT IN ('insert', 'update', 'delete') THEN
    RAISE EXCEPTION 'Acao nao permitida: %', v_action;
  END IF;

  SELECT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = v_table
      AND column_name = 'cliente_id'
  ) INTO v_has_cliente_id;

  IF v_table = 'clientes' THEN
    v_filter := v_filter || jsonb_build_object('id', p_cliente_id);
  ELSIF v_table = 'indicacoes' THEN
    v_data := v_data || jsonb_build_object('indicador_id', p_cliente_id);
    v_filter := v_filter || jsonb_build_object('indicador_id', p_cliente_id);
  ELSIF v_has_cliente_id THEN
    v_data := v_data || jsonb_build_object('cliente_id', p_cliente_id);
    v_filter := v_filter || jsonb_build_object('cliente_id', p_cliente_id);
  END IF;

  IF v_action = 'insert' THEN
    SELECT string_agg(format('%I', key), ', '),
           string_agg(format('%L', value #>> '{}'), ', ')
    INTO v_cols, v_vals
    FROM jsonb_each(v_data)
    WHERE value IS NOT NULL AND value <> 'null'::jsonb;

    IF v_cols IS NULL THEN
      RAISE EXCEPTION 'Dados obrigatorios para insercao.';
    END IF;

    v_sql := format('INSERT INTO public.%I (%s) VALUES (%s) RETURNING to_jsonb(%I.*)', v_table, v_cols, v_vals, v_table);
    EXECUTE v_sql INTO v_result;
    RETURN jsonb_build_object('success', true, 'data', v_result);
  END IF;

  FOR v_key, v_value IN SELECT key, value FROM jsonb_each(v_filter) LOOP
    v_idx := v_idx + 1;
    IF v_idx > 1 THEN v_where := v_where || ' AND '; END IF;
    v_where := v_where || format('%I = %L', v_key, v_value #>> '{}');
  END LOOP;

  IF v_where = '' THEN
    RAISE EXCEPTION 'Filtro obrigatorio para update/delete.';
  END IF;

  IF v_action = 'update' THEN
    SELECT string_agg(format('%I = %L', key, value #>> '{}'), ', ')
    INTO v_sets
    FROM jsonb_each(v_data)
    WHERE key <> 'cliente_id' AND value IS NOT NULL AND value <> 'null'::jsonb;

    IF v_sets IS NULL THEN
      RAISE EXCEPTION 'Dados obrigatorios para atualizacao.';
    END IF;

    v_sql := format('UPDATE public.%I SET %s WHERE %s RETURNING to_jsonb(%I.*)', v_table, v_sets, v_where, v_table);
    EXECUTE v_sql INTO v_result;
    IF v_result IS NULL THEN RAISE EXCEPTION 'Registro nao encontrado ou sem permissao.'; END IF;
    RETURN jsonb_build_object('success', true, 'data', v_result);
  END IF;

  v_sql := format('DELETE FROM public.%I WHERE %s RETURNING to_jsonb(%I.*)', v_table, v_where, v_table);
  EXECUTE v_sql INTO v_result;
  IF v_result IS NULL THEN RAISE EXCEPTION 'Registro nao encontrado ou sem permissao.'; END IF;
  RETURN jsonb_build_object('success', true, 'data', v_result);
END;
$$;

GRANT EXECUTE ON FUNCTION public.cliente_operational_write(uuid, text, text, text, jsonb, jsonb) TO anon, authenticated;
