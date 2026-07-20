BEGIN;

ALTER TABLE public.colaboradores
  ADD COLUMN IF NOT EXISTS credencial_hash text;

CREATE OR REPLACE FUNCTION public.gsa_sync_colaborador_modules(p_colaborador_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_modules jsonb;
BEGIN
  SELECT COALESCE(jsonb_agg(DISTINCT cm.modulo_id ORDER BY cm.modulo_id), '[]'::jsonb)
    INTO v_modules
    FROM public.colaborador_modulos cm
   WHERE cm.colaborador_id = p_colaborador_id;

  IF EXISTS (
    SELECT 1
      FROM information_schema.columns
     WHERE table_schema = 'public'
       AND table_name = 'colaboradores'
       AND column_name = 'modulos'
  ) THEN
    EXECUTE 'UPDATE public.colaboradores SET modulos = $1 WHERE id = $2'
      USING v_modules, p_colaborador_id;
  END IF;
END;
$$;

CREATE OR REPLACE FUNCTION public.gsa_sync_colaborador_modules_trigger()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  PERFORM public.gsa_sync_colaborador_modules(COALESCE(NEW.colaborador_id, OLD.colaborador_id));
  RETURN COALESCE(NEW, OLD);
END;
$$;

DROP TRIGGER IF EXISTS trg_gsa_sync_colaborador_modules ON public.colaborador_modulos;
CREATE TRIGGER trg_gsa_sync_colaborador_modules
AFTER INSERT OR UPDATE OR DELETE ON public.colaborador_modulos
FOR EACH ROW EXECUTE FUNCTION public.gsa_sync_colaborador_modules_trigger();

DO $$
DECLARE
  v_id uuid;
BEGIN
  FOR v_id IN SELECT id FROM public.colaboradores LOOP
    PERFORM public.gsa_sync_colaborador_modules(v_id);
  END LOOP;
END;
$$;

CREATE OR REPLACE FUNCTION public.gsa_admin_access_snapshot(
  p_sessao_id uuid DEFAULT NULL,
  p_session_token text DEFAULT NULL,
  p_limit integer DEFAULT 500
)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_context jsonb := public.gsa_admin_validate_context(p_sessao_id, p_session_token);
  v_limit integer := LEAST(GREATEST(COALESCE(p_limit, 500), 1), 2000);
  v_functions jsonb;
  v_collaborators jsonb;
  v_requests jsonb;
  v_sessions jsonb;
BEGIN
  PERFORM public.gsa_admin_assert_module('acessos');

  SELECT COALESCE(jsonb_agg(to_jsonb(f) ORDER BY f.nome), '[]'::jsonb)
    INTO v_functions
    FROM public.funcoes f;

  SELECT COALESCE(jsonb_agg(row_data ORDER BY created_at DESC), '[]'::jsonb)
    INTO v_collaborators
    FROM (
      SELECT
        jsonb_build_object(
          'id', c.id,
          'nome', c.nome,
          'email', c.email,
          'telefone', c.telefone,
          'status', c.status,
          'funcao_id', c.funcao_id,
          'created_at', c.created_at,
          'funcoes', CASE WHEN f.id IS NULL THEN NULL ELSE jsonb_build_object('id', f.id, 'nome', f.nome) END,
          'modulos', COALESCE(jsonb_agg(DISTINCT cm.modulo_id) FILTER (WHERE cm.modulo_id IS NOT NULL), '[]'::jsonb)
        ) AS row_data,
        c.created_at
      FROM public.colaboradores c
      LEFT JOIN public.funcoes f ON f.id = c.funcao_id
      LEFT JOIN public.colaborador_modulos cm ON cm.colaborador_id = c.id
      GROUP BY c.id, f.id
      ORDER BY c.created_at DESC
      LIMIT v_limit
    ) rows;

  SELECT COALESCE(jsonb_agg(row_data ORDER BY created_at DESC), '[]'::jsonb)
    INTO v_requests
    FROM (
      SELECT
        to_jsonb(s) || jsonb_build_object('colaborador_nome', c.nome) AS row_data,
        s.created_at
      FROM public.solicitacoes_exclusao s
      LEFT JOIN public.colaboradores c ON c.id = s.colaborador_id
      ORDER BY s.created_at DESC
      LIMIT v_limit
    ) rows;

  SELECT COALESCE(jsonb_agg(to_jsonb(rows) ORDER BY rows.criado_em DESC), '[]'::jsonb)
    INTO v_sessions
    FROM (
      SELECT s.*
        FROM public.sistema_sessoes s
       ORDER BY s.criado_em DESC
       LIMIT v_limit
    ) rows;

  RETURN jsonb_build_object(
    'actor', v_context,
    'functions', v_functions,
    'collaborators', v_collaborators,
    'deletion_requests', v_requests,
    'sessions', v_sessions
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.gsa_admin_save_function(
  p_sessao_id uuid DEFAULT NULL,
  p_session_token text DEFAULT NULL,
  p_id uuid DEFAULT NULL,
  p_nome text DEFAULT NULL,
  p_descricao text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_id uuid := p_id;
BEGIN
  PERFORM public.gsa_admin_validate_context(p_sessao_id, p_session_token);
  PERFORM public.gsa_admin_assert_module('acessos');

  IF length(trim(COALESCE(p_nome, ''))) < 2 THEN
    RAISE EXCEPTION 'Informe um nome válido para a função.' USING ERRCODE = '22023';
  END IF;

  IF v_id IS NULL THEN
    INSERT INTO public.funcoes (nome, descricao)
    VALUES (trim(p_nome), nullif(trim(COALESCE(p_descricao, '')), ''))
    RETURNING id INTO v_id;
  ELSE
    UPDATE public.funcoes
       SET nome = trim(p_nome),
           descricao = nullif(trim(COALESCE(p_descricao, '')), '')
     WHERE id = v_id;
    IF NOT FOUND THEN
      RAISE EXCEPTION 'Função não encontrada.' USING ERRCODE = 'P0002';
    END IF;
  END IF;

  PERFORM public.gsa_admin_write_audit('acessos', CASE WHEN p_id IS NULL THEN 'CRIAR_FUNCAO' ELSE 'EDITAR_FUNCAO' END, 'funcoes', v_id, jsonb_build_object('nome', trim(p_nome)));
  RETURN jsonb_build_object('success', true, 'id', v_id);
END;
$$;

CREATE OR REPLACE FUNCTION public.gsa_admin_save_collaborator(
  p_sessao_id uuid DEFAULT NULL,
  p_session_token text DEFAULT NULL,
  p_id uuid DEFAULT NULL,
  p_payload jsonb DEFAULT '{}'::jsonb,
  p_modules text[] DEFAULT ARRAY[]::text[]
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_id uuid := p_id;
  v_is_new boolean := p_id IS NULL;
  v_name text := trim(COALESCE(p_payload ->> 'nome', ''));
  v_email text := lower(nullif(trim(COALESCE(p_payload ->> 'email', '')), ''));
  v_phone text := regexp_replace(COALESCE(p_payload ->> 'telefone', ''), '\D', '', 'g');
  v_function_id uuid;
  v_initial_credential text;
  v_module text;
  v_allowed_modules constant text[] := ARRAY[
    'dashboard','cadastro','catalogo','operacoes','loja','classificados','viagens','saude','seguros',
    'fidelidade','atendimento','financeiro','cobranca','fiscal','emprestimos','credito_loja',
    'relatorios','configuracoes','acessos','demandas','sistema','promocoes','area_vip'
  ];
BEGIN
  PERFORM public.gsa_admin_validate_context(p_sessao_id, p_session_token);
  PERFORM public.gsa_admin_assert_module('acessos');

  IF length(v_name) < 2 THEN
    RAISE EXCEPTION 'Informe o nome do colaborador.' USING ERRCODE = '22023';
  END IF;

  BEGIN
    v_function_id := nullif(p_payload ->> 'funcao_id', '')::uuid;
  EXCEPTION WHEN invalid_text_representation THEN
    RAISE EXCEPTION 'Função inválida.' USING ERRCODE = '22023';
  END;

  FOREACH v_module IN ARRAY COALESCE(p_modules, ARRAY[]::text[]) LOOP
    IF NOT lower(trim(v_module)) = ANY(v_allowed_modules) THEN
      RAISE EXCEPTION 'Módulo administrativo inválido: %.', v_module USING ERRCODE = '22023';
    END IF;
  END LOOP;

  IF v_is_new THEN
    -- Credencial de alta entropia, criada no servidor e devolvida uma única vez.
    -- O hash é persistido para a futura remoção total da coluna legada.
    v_initial_credential := upper(encode(gen_random_bytes(12), 'hex'));

    INSERT INTO public.colaboradores (
      nome, email, telefone, funcao_id, status, credencial_acesso, credencial_hash
    ) VALUES (
      v_name, v_email, nullif(v_phone, ''), v_function_id, 'ativo',
      v_initial_credential, crypt(v_initial_credential, gen_salt('bf', 12))
    ) RETURNING id INTO v_id;
  ELSE
    UPDATE public.colaboradores
       SET nome = v_name,
           email = v_email,
           telefone = nullif(v_phone, ''),
           funcao_id = v_function_id
     WHERE id = v_id;
    IF NOT FOUND THEN
      RAISE EXCEPTION 'Colaborador não encontrado.' USING ERRCODE = 'P0002';
    END IF;
  END IF;

  DELETE FROM public.colaborador_modulos WHERE colaborador_id = v_id;

  INSERT INTO public.colaborador_modulos (colaborador_id, modulo_id)
  SELECT v_id, module_name
    FROM (
      SELECT DISTINCT lower(trim(value)) AS module_name
        FROM unnest(COALESCE(p_modules, ARRAY[]::text[])) AS value
    ) normalized
   WHERE module_name <> '';

  PERFORM public.gsa_sync_colaborador_modules(v_id);
  PERFORM public.gsa_admin_write_audit(
    'acessos',
    CASE WHEN v_is_new THEN 'CRIAR_COLABORADOR' ELSE 'EDITAR_COLABORADOR' END,
    'colaboradores',
    v_id,
    jsonb_build_object('nome', v_name, 'modules', to_jsonb(COALESCE(p_modules, ARRAY[]::text[])))
  );

  RETURN jsonb_build_object(
    'success', true,
    'id', v_id,
    'initial_credential', CASE WHEN v_is_new THEN v_initial_credential ELSE NULL END
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.gsa_admin_rotate_collaborator_credential(
  p_sessao_id uuid DEFAULT NULL,
  p_session_token text DEFAULT NULL,
  p_colaborador_id uuid DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_credential text := upper(encode(gen_random_bytes(12), 'hex'));
BEGIN
  PERFORM public.gsa_admin_validate_context(p_sessao_id, p_session_token);
  PERFORM public.gsa_admin_assert_module('acessos');

  UPDATE public.colaboradores
     SET credencial_acesso = v_credential,
         credencial_hash = crypt(v_credential, gen_salt('bf', 12))
   WHERE id = p_colaborador_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Colaborador não encontrado.' USING ERRCODE = 'P0002';
  END IF;

  -- Revoga todas as sessões existentes para obrigar novo login.
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
     WHERE table_schema = 'public' AND table_name = 'sistema_sessoes' AND column_name = 'ator_id'
  ) THEN
    EXECUTE 'UPDATE public.sistema_sessoes SET status = ''encerrado'' WHERE ator_id = $1 AND status IN (''ativo'', ''ativa'', ''active'')'
      USING p_colaborador_id;
  ELSIF EXISTS (
    SELECT 1 FROM information_schema.columns
     WHERE table_schema = 'public' AND table_name = 'sistema_sessoes' AND column_name = 'usuario_id'
  ) THEN
    EXECUTE 'UPDATE public.sistema_sessoes SET status = ''encerrado'' WHERE usuario_id = $1 AND status IN (''ativo'', ''ativa'', ''active'')'
      USING p_colaborador_id;
  END IF;

  PERFORM public.gsa_admin_write_audit('acessos', 'ROTACIONAR_CREDENCIAL', 'colaboradores', p_colaborador_id, '{}'::jsonb);
  RETURN jsonb_build_object('success', true, 'initial_credential', v_credential);
END;
$$;

CREATE OR REPLACE FUNCTION public.gsa_admin_set_collaborator_status(
  p_sessao_id uuid DEFAULT NULL,
  p_session_token text DEFAULT NULL,
  p_colaborador_id uuid DEFAULT NULL,
  p_status text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_status text := lower(trim(COALESCE(p_status, '')));
BEGIN
  PERFORM public.gsa_admin_validate_context(p_sessao_id, p_session_token);
  PERFORM public.gsa_admin_assert_module('acessos');

  IF v_status NOT IN ('ativo', 'suspenso') THEN
    RAISE EXCEPTION 'Status de colaborador inválido.' USING ERRCODE = '22023';
  END IF;

  UPDATE public.colaboradores SET status = v_status WHERE id = p_colaborador_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Colaborador não encontrado.' USING ERRCODE = 'P0002';
  END IF;

  IF v_status = 'suspenso' THEN
    IF EXISTS (
      SELECT 1 FROM information_schema.columns
       WHERE table_schema = 'public' AND table_name = 'sistema_sessoes' AND column_name = 'ator_id'
    ) THEN
      EXECUTE 'UPDATE public.sistema_sessoes SET status = ''encerrado'' WHERE ator_id = $1 AND status IN (''ativo'', ''ativa'', ''active'')'
        USING p_colaborador_id;
    ELSIF EXISTS (
      SELECT 1 FROM information_schema.columns
       WHERE table_schema = 'public' AND table_name = 'sistema_sessoes' AND column_name = 'usuario_id'
    ) THEN
      EXECUTE 'UPDATE public.sistema_sessoes SET status = ''encerrado'' WHERE usuario_id = $1 AND status IN (''ativo'', ''ativa'', ''active'')'
        USING p_colaborador_id;
    END IF;
  END IF;

  PERFORM public.gsa_admin_write_audit('acessos', 'ALTERAR_STATUS_COLABORADOR', 'colaboradores', p_colaborador_id, jsonb_build_object('status', v_status));
  RETURN jsonb_build_object('success', true, 'status', v_status);
END;
$$;

CREATE OR REPLACE FUNCTION public.gsa_admin_review_deletion_request(
  p_sessao_id uuid DEFAULT NULL,
  p_session_token text DEFAULT NULL,
  p_request_id uuid DEFAULT NULL,
  p_decision text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_request public.solicitacoes_exclusao%ROWTYPE;
  v_decision text := lower(trim(COALESCE(p_decision, '')));
  v_allowed_tables constant text[] := ARRAY[
    'clientes','prestadores','funcoes','colaboradores','servicos','produtos','assinaturas',
    'orcamentos','ordens_servico','tickets','vouchers','premios','formas_pagamento'
  ];
BEGIN
  PERFORM public.gsa_admin_validate_context(p_sessao_id, p_session_token);
  PERFORM public.gsa_admin_assert_module('acessos');

  IF v_decision NOT IN ('aprovar', 'rejeitar') THEN
    RAISE EXCEPTION 'Decisão inválida.' USING ERRCODE = '22023';
  END IF;

  SELECT * INTO v_request
    FROM public.solicitacoes_exclusao
   WHERE id = p_request_id
   FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Solicitação de exclusão não encontrada.' USING ERRCODE = 'P0002';
  END IF;

  IF lower(COALESCE(v_request.status, 'pendente')) <> 'pendente' THEN
    RETURN jsonb_build_object('success', true, 'already_processed', true, 'status', v_request.status);
  END IF;

  IF v_decision = 'aprovar' THEN
    IF NOT lower(v_request.tabela) = ANY(v_allowed_tables) THEN
      RAISE EXCEPTION 'A tabela solicitada não é permitida para exclusão administrativa.' USING ERRCODE = '42501';
    END IF;

    EXECUTE format('DELETE FROM public.%I WHERE id = $1', lower(v_request.tabela))
      USING v_request.registro_id;

    UPDATE public.solicitacoes_exclusao
       SET status = 'aprovado', data_decisao = now()
     WHERE id = p_request_id;
  ELSE
    UPDATE public.solicitacoes_exclusao
       SET status = 'rejeitado', data_decisao = now()
     WHERE id = p_request_id;
  END IF;

  PERFORM public.gsa_admin_write_audit(
    'acessos',
    CASE WHEN v_decision = 'aprovar' THEN 'APROVAR_EXCLUSAO' ELSE 'REJEITAR_EXCLUSAO' END,
    v_request.tabela,
    v_request.registro_id,
    jsonb_build_object('request_id', p_request_id)
  );

  RETURN jsonb_build_object('success', true, 'status', CASE WHEN v_decision = 'aprovar' THEN 'aprovado' ELSE 'rejeitado' END);
END;
$$;

CREATE OR REPLACE FUNCTION public.gsa_admin_resource_config(p_resource text)
RETURNS jsonb
LANGUAGE plpgsql
IMMUTABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_resource text := lower(trim(COALESCE(p_resource, '')));
BEGIN
  RETURN CASE v_resource
    WHEN 'classificados_anuncios' THEN jsonb_build_object('table','classificados_anuncios','module','classificados','status_column','status')
    WHEN 'classificados_mensagens' THEN jsonb_build_object('table','classificados_mensagens','module','classificados','status_column','status_moderacao')
    WHEN 'classificados_transacoes' THEN jsonb_build_object('table','classificados_transacoes','module','classificados','status_column','status')
    WHEN 'saude_parceiros' THEN jsonb_build_object('table','saude_parceiros','module','saude','status_column','status')
    WHEN 'saude_produtos' THEN jsonb_build_object('table','saude_produtos','module','saude','status_column','status')
    WHEN 'saude_cotacoes' THEN jsonb_build_object('table','saude_cotacoes','module','saude','status_column','status')
    WHEN 'saude_propostas' THEN jsonb_build_object('table','saude_propostas','module','saude','status_column','status')
    WHEN 'saude_contratos' THEN jsonb_build_object('table','saude_contratos','module','saude','status_column','status')
    WHEN 'saude_assessorias' THEN jsonb_build_object('table','saude_assessorias','module','saude','status_column','status')
    WHEN 'saude_comissoes' THEN jsonb_build_object('table','saude_comissoes','module','saude','status_column','status')
    WHEN 'saude_documentos' THEN jsonb_build_object('table','saude_documentos','module','saude','status_column','status')
    WHEN 'saude_atendimentos' THEN jsonb_build_object('table','saude_atendimentos','module','saude','status_column','status')
    WHEN 'seguros_parceiros' THEN jsonb_build_object('table','seguros_parceiros','module','seguros','status_column','status')
    WHEN 'seguros_produtos' THEN jsonb_build_object('table','seguros_produtos','module','seguros','status_column','status')
    WHEN 'seguros_cotacoes' THEN jsonb_build_object('table','seguros_cotacoes','module','seguros','status_column','status')
    WHEN 'seguros_propostas' THEN jsonb_build_object('table','seguros_propostas','module','seguros','status_column','status')
    WHEN 'seguros_apolices' THEN jsonb_build_object('table','seguros_apolices','module','seguros','status_column','status')
    WHEN 'seguros_assessorias' THEN jsonb_build_object('table','seguros_assessorias','module','seguros','status_column','status')
    WHEN 'seguros_comissoes' THEN jsonb_build_object('table','seguros_comissoes','module','seguros','status_column','status')
    WHEN 'seguros_documentos' THEN jsonb_build_object('table','seguros_documentos','module','seguros','status_column','status')
    WHEN 'seguros_assistencias' THEN jsonb_build_object('table','seguros_assistencias','module','seguros','status_column','status')
    WHEN 'seguros_sinistros' THEN jsonb_build_object('table','seguros_sinistros','module','seguros','status_column','status')
    WHEN 'seguros_atendimentos' THEN jsonb_build_object('table','seguros_atendimentos','module','seguros','status_column','status')
    WHEN 'ordens_fiscais' THEN jsonb_build_object('table','ordens_fiscais','module','fiscal','status_column','status_emissao')
    WHEN 'empresa' THEN jsonb_build_object('table','empresa','module','configuracoes','status_column',NULL)
    WHEN 'formas_pagamento' THEN jsonb_build_object('table','formas_pagamento','module','configuracoes','status_column','ativo')
    ELSE NULL
  END;
END;
$$;

CREATE OR REPLACE FUNCTION public.gsa_admin_list_resource(
  p_sessao_id uuid DEFAULT NULL,
  p_session_token text DEFAULT NULL,
  p_resource text DEFAULT NULL,
  p_page integer DEFAULT 1,
  p_page_size integer DEFAULT 50,
  p_search text DEFAULT NULL,
  p_status text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_config jsonb := public.gsa_admin_resource_config(p_resource);
  v_table text;
  v_module text;
  v_status_column text;
  v_page integer := GREATEST(COALESCE(p_page, 1), 1);
  v_page_size integer := LEAST(GREATEST(COALESCE(p_page_size, 50), 1), 250);
  v_offset integer;
  v_search text := trim(COALESCE(p_search, ''));
  v_where text := ' WHERE true ';
  v_count bigint;
  v_items jsonb;
BEGIN
  PERFORM public.gsa_admin_validate_context(p_sessao_id, p_session_token);

  IF v_config IS NULL THEN
    RAISE EXCEPTION 'Recurso administrativo não permitido.' USING ERRCODE = '42501';
  END IF;

  v_table := v_config ->> 'table';
  v_module := v_config ->> 'module';
  v_status_column := v_config ->> 'status_column';
  PERFORM public.gsa_admin_assert_module(v_module);

  IF v_search <> '' THEN
    v_where := v_where || ' AND to_jsonb(t)::text ILIKE ''%'' || $1 || ''%'' ';
  END IF;

  IF nullif(trim(COALESCE(p_status, '')), '') IS NOT NULL AND nullif(v_status_column, '') IS NOT NULL THEN
    v_where := v_where || format(' AND lower(COALESCE(t.%I::text, '''')) = lower($2) ', v_status_column);
  END IF;

  v_offset := (v_page - 1) * v_page_size;

  EXECUTE format('SELECT count(*) FROM public.%I t %s', v_table, v_where)
    INTO v_count
    USING v_search, p_status;

  EXECUTE format(
    'SELECT COALESCE(jsonb_agg(to_jsonb(rows)), ''[]''::jsonb) FROM (' ||
    ' SELECT t.* FROM public.%I t %s' ||
    ' ORDER BY COALESCE((to_jsonb(t)->>''created_at'')::timestamptz, now()) DESC' ||
    ' LIMIT %s OFFSET %s) rows',
    v_table, v_where, v_page_size, v_offset
  ) INTO v_items USING v_search, p_status;

  RETURN jsonb_build_object(
    'items', COALESCE(v_items, '[]'::jsonb),
    'total', COALESCE(v_count, 0),
    'page', v_page,
    'page_size', v_page_size
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.gsa_admin_update_resource_status(
  p_sessao_id uuid DEFAULT NULL,
  p_session_token text DEFAULT NULL,
  p_resource text DEFAULT NULL,
  p_id uuid DEFAULT NULL,
  p_status text DEFAULT NULL,
  p_reason text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_config jsonb := public.gsa_admin_resource_config(p_resource);
  v_table text;
  v_module text;
  v_status_column text;
  v_sql text;
BEGIN
  PERFORM public.gsa_admin_validate_context(p_sessao_id, p_session_token);
  IF v_config IS NULL THEN
    RAISE EXCEPTION 'Recurso administrativo não permitido.' USING ERRCODE = '42501';
  END IF;

  v_table := v_config ->> 'table';
  v_module := v_config ->> 'module';
  v_status_column := v_config ->> 'status_column';
  PERFORM public.gsa_admin_assert_module(v_module);

  IF nullif(v_status_column, '') IS NULL THEN
    RAISE EXCEPTION 'Este recurso não possui status administrativo.' USING ERRCODE = '22023';
  END IF;

  v_sql := format('UPDATE public.%I SET %I = $1', v_table, v_status_column);

  IF v_table = 'classificados_anuncios' THEN
    v_sql := v_sql || ', motivo_rejeicao = CASE WHEN lower($1) = ''rejeitado'' THEN nullif(trim($2), '''') ELSE NULL END';
  ELSIF v_table = 'ordens_fiscais' THEN
    v_sql := v_sql || ', observacoes = concat_ws('' | '', nullif(observacoes, ''''), nullif(trim($2), ''''))';
  END IF;

  IF EXISTS (
    SELECT 1 FROM information_schema.columns
     WHERE table_schema = 'public' AND table_name = v_table AND column_name = 'updated_at'
  ) THEN
    v_sql := v_sql || ', updated_at = now()';
  END IF;

  v_sql := v_sql || ' WHERE id = $3';
  EXECUTE v_sql USING p_status, p_reason, p_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Registro não encontrado.' USING ERRCODE = 'P0002';
  END IF;

  PERFORM public.gsa_admin_write_audit(v_module, 'ALTERAR_STATUS', v_table, p_id, jsonb_build_object('status', p_status, 'reason', p_reason));
  RETURN jsonb_build_object('success', true, 'id', p_id, 'status', p_status);
END;
$$;

CREATE OR REPLACE FUNCTION public.gsa_admin_classified_action(
  p_sessao_id uuid DEFAULT NULL,
  p_session_token text DEFAULT NULL,
  p_entity text DEFAULT NULL,
  p_id uuid DEFAULT NULL,
  p_related_id uuid DEFAULT NULL,
  p_action text DEFAULT NULL,
  p_reason text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_action text := lower(trim(COALESCE(p_action, '')));
BEGIN
  PERFORM public.gsa_admin_validate_context(p_sessao_id, p_session_token);
  PERFORM public.gsa_admin_assert_module('classificados');

  IF p_entity = 'anuncio' THEN
    IF v_action = 'aprovar' THEN
      UPDATE public.classificados_anuncios SET status = 'publicado', motivo_rejeicao = NULL WHERE id = p_id;
    ELSIF v_action = 'rejeitar' THEN
      IF length(trim(COALESCE(p_reason, ''))) < 3 THEN
        RAISE EXCEPTION 'Informe o motivo da rejeição.' USING ERRCODE = '22023';
      END IF;
      UPDATE public.classificados_anuncios SET status = 'rejeitado', motivo_rejeicao = trim(p_reason) WHERE id = p_id;
    ELSE
      RAISE EXCEPTION 'Ação de anúncio inválida.' USING ERRCODE = '22023';
    END IF;
  ELSIF p_entity = 'mensagem' THEN
    IF v_action NOT IN ('aprovar', 'rejeitar') THEN
      RAISE EXCEPTION 'Ação de mensagem inválida.' USING ERRCODE = '22023';
    END IF;
    PERFORM public.rpc_moderar_mensagem_classificado(
      p_id,
      p_related_id,
      CASE WHEN v_action = 'aprovar' THEN 'approve' ELSE 'reject' END
    );
  ELSE
    RAISE EXCEPTION 'Entidade de classificado inválida.' USING ERRCODE = '22023';
  END IF;

  IF NOT FOUND AND p_entity = 'anuncio' THEN
    RAISE EXCEPTION 'Registro não encontrado.' USING ERRCODE = 'P0002';
  END IF;

  PERFORM public.gsa_admin_write_audit('classificados', upper(v_action), p_entity, p_id, jsonb_build_object('related_id', p_related_id, 'reason', p_reason));
  RETURN jsonb_build_object('success', true);
END;
$$;

CREATE OR REPLACE FUNCTION public.gsa_admin_save_protection_entity(
  p_sessao_id uuid DEFAULT NULL,
  p_session_token text DEFAULT NULL,
  p_domain text DEFAULT NULL,
  p_kind text DEFAULT NULL,
  p_id uuid DEFAULT NULL,
  p_payload jsonb DEFAULT '{}'::jsonb
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_domain text := lower(trim(COALESCE(p_domain, '')));
  v_kind text := lower(trim(COALESCE(p_kind, '')));
  v_table text;
  v_id uuid := p_id;
  v_name text := trim(COALESCE(p_payload ->> 'nome', ''));
BEGIN
  PERFORM public.gsa_admin_validate_context(p_sessao_id, p_session_token);
  IF v_domain NOT IN ('saude', 'seguros') THEN
    RAISE EXCEPTION 'Domínio de proteção inválido.' USING ERRCODE = '22023';
  END IF;
  PERFORM public.gsa_admin_assert_module(v_domain);

  IF v_kind = 'parceiro' THEN
    v_table := v_domain || '_parceiros';
    IF length(v_name) < 2 THEN
      RAISE EXCEPTION 'Informe o nome do parceiro.' USING ERRCODE = '22023';
    END IF;

    IF v_id IS NULL THEN
      EXECUTE format(
        'INSERT INTO public.%I (nome, documento, site, contato, comissao_tipo, comissao_valor, observacoes, status) VALUES ($1,$2,$3,$4,$5,$6,$7,$8) RETURNING id',
        v_table
      ) INTO v_id USING
        v_name,
        nullif(trim(COALESCE(p_payload ->> 'documento', '')), ''),
        nullif(trim(COALESCE(p_payload ->> 'site', '')), ''),
        nullif(trim(COALESCE(p_payload ->> 'contato', '')), ''),
        COALESCE(nullif(trim(COALESCE(p_payload ->> 'comissao_tipo', '')), ''), 'porcentagem'),
        COALESCE((p_payload ->> 'comissao_valor')::numeric, 0),
        nullif(trim(COALESCE(p_payload ->> 'observacoes', '')), ''),
        COALESCE(nullif(trim(COALESCE(p_payload ->> 'status', '')), ''), 'ativo');
    ELSE
      EXECUTE format(
        'UPDATE public.%I SET nome=$1, documento=$2, site=$3, contato=$4, comissao_tipo=$5, comissao_valor=$6, observacoes=$7, status=$8, updated_at=now() WHERE id=$9',
        v_table
      ) USING
        v_name,
        nullif(trim(COALESCE(p_payload ->> 'documento', '')), ''),
        nullif(trim(COALESCE(p_payload ->> 'site', '')), ''),
        nullif(trim(COALESCE(p_payload ->> 'contato', '')), ''),
        COALESCE(nullif(trim(COALESCE(p_payload ->> 'comissao_tipo', '')), ''), 'porcentagem'),
        COALESCE((p_payload ->> 'comissao_valor')::numeric, 0),
        nullif(trim(COALESCE(p_payload ->> 'observacoes', '')), ''),
        COALESCE(nullif(trim(COALESCE(p_payload ->> 'status', '')), ''), 'ativo'),
        v_id;
    END IF;
  ELSIF v_kind = 'produto' THEN
    v_table := v_domain || '_produtos';
    IF length(v_name) < 2 THEN
      RAISE EXCEPTION 'Informe o nome do produto.' USING ERRCODE = '22023';
    END IF;

    IF v_id IS NULL THEN
      EXECUTE format(
        'INSERT INTO public.%I (nome, slug, parceiro_id, categoria, imagem_url, preco_referencia, resumo, destaque, status) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9) RETURNING id',
        v_table
      ) INTO v_id USING
        v_name,
        lower(COALESCE(nullif(trim(p_payload ->> 'slug'), ''), regexp_replace(unaccent(v_name), '[^a-zA-Z0-9]+', '-', 'g'))),
        nullif(p_payload ->> 'parceiro_id', '')::uuid,
        nullif(trim(COALESCE(p_payload ->> 'categoria', '')), ''),
        nullif(trim(COALESCE(p_payload ->> 'imagem_url', '')), ''),
        nullif(p_payload ->> 'preco_referencia', '')::numeric,
        nullif(trim(COALESCE(p_payload ->> 'resumo', '')), ''),
        COALESCE((p_payload ->> 'destaque')::boolean, false),
        COALESCE(nullif(trim(COALESCE(p_payload ->> 'status', '')), ''), 'rascunho');
    ELSE
      EXECUTE format(
        'UPDATE public.%I SET nome=$1, slug=$2, parceiro_id=$3, categoria=$4, imagem_url=$5, preco_referencia=$6, resumo=$7, destaque=$8, status=$9, updated_at=now() WHERE id=$10',
        v_table
      ) USING
        v_name,
        lower(COALESCE(nullif(trim(p_payload ->> 'slug'), ''), regexp_replace(unaccent(v_name), '[^a-zA-Z0-9]+', '-', 'g'))),
        nullif(p_payload ->> 'parceiro_id', '')::uuid,
        nullif(trim(COALESCE(p_payload ->> 'categoria', '')), ''),
        nullif(trim(COALESCE(p_payload ->> 'imagem_url', '')), ''),
        nullif(p_payload ->> 'preco_referencia', '')::numeric,
        nullif(trim(COALESCE(p_payload ->> 'resumo', '')), ''),
        COALESCE((p_payload ->> 'destaque')::boolean, false),
        COALESCE(nullif(trim(COALESCE(p_payload ->> 'status', '')), ''), 'rascunho'),
        v_id;
    END IF;
  ELSE
    RAISE EXCEPTION 'Tipo de entidade de proteção inválido.' USING ERRCODE = '22023';
  END IF;

  IF NOT FOUND AND p_id IS NOT NULL THEN
    RAISE EXCEPTION 'Registro não encontrado.' USING ERRCODE = 'P0002';
  END IF;

  PERFORM public.gsa_admin_write_audit(v_domain, CASE WHEN p_id IS NULL THEN 'CRIAR' ELSE 'EDITAR' END, v_table, v_id, jsonb_build_object('kind', v_kind));
  RETURN jsonb_build_object('success', true, 'id', v_id);
END;
$$;

CREATE OR REPLACE FUNCTION public.gsa_admin_create_protection_proposal(
  p_sessao_id uuid DEFAULT NULL,
  p_session_token text DEFAULT NULL,
  p_domain text DEFAULT NULL,
  p_payload jsonb DEFAULT '{}'::jsonb
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_domain text := lower(trim(COALESCE(p_domain, '')));
  v_quote_table text;
  v_proposal_table text;
  v_quote jsonb;
  v_quote_id uuid := nullif(p_payload ->> 'cotacao_id', '')::uuid;
  v_partner_id uuid := nullif(p_payload ->> 'parceiro_id', '')::uuid;
  v_product_id uuid := nullif(p_payload ->> 'produto_id', '')::uuid;
  v_id uuid;
  v_protocol text;
  v_amount numeric := nullif(p_payload ->> 'valor', '')::numeric;
  v_validity integer := LEAST(GREATEST(COALESCE((p_payload ->> 'validade_dias')::integer, 5), 1), 90);
BEGIN
  PERFORM public.gsa_admin_validate_context(p_sessao_id, p_session_token);
  IF v_domain NOT IN ('saude', 'seguros') THEN
    RAISE EXCEPTION 'Domínio de proteção inválido.' USING ERRCODE = '22023';
  END IF;
  PERFORM public.gsa_admin_assert_module(v_domain);

  IF v_quote_id IS NULL OR v_partner_id IS NULL OR v_amount IS NULL OR v_amount <= 0 THEN
    RAISE EXCEPTION 'Cotação, parceiro e valor são obrigatórios.' USING ERRCODE = '22023';
  END IF;

  v_quote_table := v_domain || '_cotacoes';
  v_proposal_table := v_domain || '_propostas';
  EXECUTE format('SELECT to_jsonb(q) FROM public.%I q WHERE q.id=$1 FOR UPDATE', v_quote_table)
    INTO v_quote USING v_quote_id;
  IF v_quote IS NULL THEN
    RAISE EXCEPTION 'Cotação não encontrada.' USING ERRCODE = 'P0002';
  END IF;

  v_protocol := upper(CASE WHEN v_domain = 'saude' THEN 'SAU' ELSE 'SEG' END || '-PROP-' || substr(encode(gen_random_bytes(8), 'hex'), 1, 12));

  IF v_domain = 'saude' THEN
    INSERT INTO public.saude_propostas (
      cotacao_id, cliente_id, parceiro_id, produto_id, protocolo, titulo,
      mensalidade_operadora, taxa_assessoria_gsa, validade_ate, status
    ) VALUES (
      v_quote_id, (v_quote ->> 'cliente_id')::uuid, v_partner_id, v_product_id, v_protocol,
      COALESCE(nullif(trim(p_payload ->> 'titulo'), ''), 'Proposta ' || v_protocol),
      v_amount, COALESCE(nullif(p_payload ->> 'taxa_assessoria_gsa', '')::numeric, 0),
      now() + make_interval(days => v_validity), 'enviada'
    ) RETURNING id INTO v_id;
  ELSE
    INSERT INTO public.seguros_propostas (
      cotacao_id, cliente_id, parceiro_id, produto_id, protocolo, titulo,
      premio_seguradora, franquia, taxa_assessoria_gsa, validade_ate, status
    ) VALUES (
      v_quote_id, (v_quote ->> 'cliente_id')::uuid, v_partner_id, v_product_id, v_protocol,
      COALESCE(nullif(trim(p_payload ->> 'titulo'), ''), 'Proposta ' || v_protocol),
      v_amount, nullif(p_payload ->> 'franquia', '')::numeric,
      COALESCE(nullif(p_payload ->> 'taxa_assessoria_gsa', '')::numeric, 0),
      now() + make_interval(days => v_validity), 'enviada'
    ) RETURNING id INTO v_id;
  END IF;

  EXECUTE format('UPDATE public.%I SET status=''propostas_disponiveis'', updated_at=now() WHERE id=$1', v_quote_table)
    USING v_quote_id;

  PERFORM public.gsa_admin_write_audit(v_domain, 'CRIAR_PROPOSTA', v_proposal_table, v_id, jsonb_build_object('quote_id', v_quote_id, 'amount', v_amount));
  RETURN jsonb_build_object('success', true, 'id', v_id, 'protocol', v_protocol);
END;
$$;

CREATE OR REPLACE FUNCTION public.gsa_admin_save_company(
  p_sessao_id uuid DEFAULT NULL,
  p_session_token text DEFAULT NULL,
  p_payload jsonb DEFAULT '{}'::jsonb
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_id uuid;
BEGIN
  PERFORM public.gsa_admin_validate_context(p_sessao_id, p_session_token);
  PERFORM public.gsa_admin_assert_module('configuracoes');

  SELECT id INTO v_id FROM public.empresa ORDER BY id LIMIT 1 FOR UPDATE;
  IF v_id IS NULL THEN
    INSERT INTO public.empresa (razao_social, cnpj, telefone, responsavel)
    VALUES (
      nullif(trim(p_payload ->> 'razao_social'), ''),
      regexp_replace(COALESCE(p_payload ->> 'cnpj', ''), '\D', '', 'g'),
      regexp_replace(COALESCE(p_payload ->> 'telefone', ''), '\D', '', 'g'),
      nullif(trim(p_payload ->> 'responsavel'), '')
    ) RETURNING id INTO v_id;
  ELSE
    UPDATE public.empresa
       SET razao_social = nullif(trim(p_payload ->> 'razao_social'), ''),
           cnpj = regexp_replace(COALESCE(p_payload ->> 'cnpj', ''), '\D', '', 'g'),
           telefone = regexp_replace(COALESCE(p_payload ->> 'telefone', ''), '\D', '', 'g'),
           responsavel = nullif(trim(p_payload ->> 'responsavel'), '')
     WHERE id = v_id;
  END IF;

  PERFORM public.gsa_admin_write_audit('configuracoes', 'SALVAR_EMPRESA', 'empresa', v_id, '{}'::jsonb);
  RETURN jsonb_build_object('success', true, 'id', v_id);
END;
$$;

CREATE OR REPLACE FUNCTION public.gsa_admin_save_payment_method(
  p_sessao_id uuid DEFAULT NULL,
  p_session_token text DEFAULT NULL,
  p_id uuid DEFAULT NULL,
  p_payload jsonb DEFAULT '{}'::jsonb
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_id uuid := p_id;
  v_name text := trim(COALESCE(p_payload ->> 'nome', ''));
BEGIN
  PERFORM public.gsa_admin_validate_context(p_sessao_id, p_session_token);
  PERFORM public.gsa_admin_assert_module('configuracoes');
  IF length(v_name) < 2 THEN
    RAISE EXCEPTION 'Informe o nome da forma de pagamento.' USING ERRCODE = '22023';
  END IF;

  IF v_id IS NULL THEN
    INSERT INTO public.formas_pagamento (nome, slug, tipo, instrucoes, ativo)
    VALUES (
      v_name,
      COALESCE(nullif(trim(p_payload ->> 'slug'), ''), lower(regexp_replace(unaccent(v_name), '[^a-zA-Z0-9]+', '-', 'g'))),
      COALESCE(nullif(trim(p_payload ->> 'tipo'), ''), 'manual'),
      nullif(trim(p_payload ->> 'instrucoes'), ''),
      COALESCE((p_payload ->> 'ativo')::boolean, true)
    ) RETURNING id INTO v_id;
  ELSE
    UPDATE public.formas_pagamento
       SET nome = v_name,
           slug = COALESCE(nullif(trim(p_payload ->> 'slug'), ''), lower(regexp_replace(unaccent(v_name), '[^a-zA-Z0-9]+', '-', 'g'))),
           tipo = COALESCE(nullif(trim(p_payload ->> 'tipo'), ''), 'manual'),
           instrucoes = nullif(trim(p_payload ->> 'instrucoes'), ''),
           ativo = COALESCE((p_payload ->> 'ativo')::boolean, true)
     WHERE id = v_id;
    IF NOT FOUND THEN
      RAISE EXCEPTION 'Forma de pagamento não encontrada.' USING ERRCODE = 'P0002';
    END IF;
  END IF;

  PERFORM public.gsa_admin_write_audit('configuracoes', CASE WHEN p_id IS NULL THEN 'CRIAR_FORMA_PAGAMENTO' ELSE 'EDITAR_FORMA_PAGAMENTO' END, 'formas_pagamento', v_id, '{}'::jsonb);
  RETURN jsonb_build_object('success', true, 'id', v_id);
END;
$$;

CREATE OR REPLACE FUNCTION public.gsa_admin_fiscal_update(
  p_sessao_id uuid DEFAULT NULL,
  p_session_token text DEFAULT NULL,
  p_ordem_id uuid DEFAULT NULL,
  p_action text DEFAULT NULL,
  p_payload jsonb DEFAULT '{}'::jsonb
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_action text := lower(trim(COALESCE(p_action, '')));
BEGIN
  PERFORM public.gsa_admin_validate_context(p_sessao_id, p_session_token);
  PERFORM public.gsa_admin_assert_module('fiscal');

  IF v_action = 'anexar' THEN
    UPDATE public.ordens_fiscais
       SET arquivo_nf_url = nullif(trim(p_payload ->> 'pdf_reference'), ''),
           arquivo_nf_xml_url = nullif(trim(p_payload ->> 'xml_reference'), ''),
           numero_nota = nullif(trim(p_payload ->> 'numero_nota'), ''),
           status_emissao = 'emitida',
           data_emissao = now(),
           observacoes = concat_ws(' | ', nullif(observacoes, ''), 'Nota fiscal anexada com armazenamento privado')
     WHERE id = p_ordem_id;
  ELSIF v_action = 'status' THEN
    UPDATE public.ordens_fiscais
       SET status_emissao = nullif(trim(p_payload ->> 'status'), ''),
           observacoes = concat_ws(' | ', nullif(observacoes, ''), nullif(trim(p_payload ->> 'observacoes'), ''))
     WHERE id = p_ordem_id;
  ELSIF v_action = 'arquivar' THEN
    UPDATE public.ordens_fiscais
       SET status_emissao = 'arquivada',
           observacoes = concat_ws(' | ', nullif(observacoes, ''), 'Ordem fiscal arquivada administrativamente')
     WHERE id = p_ordem_id;
  ELSE
    RAISE EXCEPTION 'Ação fiscal inválida.' USING ERRCODE = '22023';
  END IF;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Ordem fiscal não encontrada.' USING ERRCODE = 'P0002';
  END IF;

  PERFORM public.gsa_admin_write_audit('fiscal', upper(v_action), 'ordens_fiscais', p_ordem_id, p_payload);
  RETURN jsonb_build_object('success', true, 'id', p_ordem_id);
END;
$$;

CREATE OR REPLACE FUNCTION public.gsa_admin_system_snapshot(
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
  v_metrics jsonb := '{}'::jsonb;
  v_tables jsonb;
BEGIN
  PERFORM public.gsa_admin_validate_context(p_sessao_id, p_session_token);
  PERFORM public.gsa_admin_assert_module('sistema');

  BEGIN
    EXECUTE 'SELECT to_jsonb(m) FROM public.get_system_metrics() m LIMIT 1' INTO v_metrics;
  EXCEPTION WHEN undefined_function THEN
    v_metrics := '{}'::jsonb;
  END;

  SELECT COALESCE(jsonb_agg(jsonb_build_object(
    'table', schemaname || '.' || relname,
    'estimated_rows', n_live_tup,
    'dead_rows', n_dead_tup,
    'last_analyze', last_analyze,
    'last_autoanalyze', last_autoanalyze
  ) ORDER BY n_live_tup DESC), '[]'::jsonb)
  INTO v_tables
  FROM pg_stat_user_tables;

  RETURN jsonb_build_object('metrics', COALESCE(v_metrics, '{}'::jsonb), 'tables', v_tables, 'generated_at', now());
END;
$$;

REVOKE ALL ON FUNCTION public.gsa_sync_colaborador_modules(uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.gsa_admin_resource_config(text) FROM PUBLIC, anon, authenticated;

REVOKE ALL ON FUNCTION public.gsa_admin_access_snapshot(uuid, text, integer) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.gsa_admin_save_function(uuid, text, uuid, text, text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.gsa_admin_save_collaborator(uuid, text, uuid, jsonb, text[]) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.gsa_admin_rotate_collaborator_credential(uuid, text, uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.gsa_admin_set_collaborator_status(uuid, text, uuid, text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.gsa_admin_review_deletion_request(uuid, text, uuid, text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.gsa_admin_list_resource(uuid, text, text, integer, integer, text, text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.gsa_admin_update_resource_status(uuid, text, text, uuid, text, text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.gsa_admin_classified_action(uuid, text, text, uuid, uuid, text, text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.gsa_admin_save_protection_entity(uuid, text, text, text, uuid, jsonb) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.gsa_admin_create_protection_proposal(uuid, text, text, jsonb) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.gsa_admin_save_company(uuid, text, jsonb) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.gsa_admin_save_payment_method(uuid, text, uuid, jsonb) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.gsa_admin_fiscal_update(uuid, text, uuid, text, jsonb) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.gsa_admin_system_snapshot(uuid, text) FROM PUBLIC, anon;

GRANT EXECUTE ON FUNCTION public.gsa_admin_access_snapshot(uuid, text, integer) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.gsa_admin_save_function(uuid, text, uuid, text, text) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.gsa_admin_save_collaborator(uuid, text, uuid, jsonb, text[]) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.gsa_admin_rotate_collaborator_credential(uuid, text, uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.gsa_admin_set_collaborator_status(uuid, text, uuid, text) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.gsa_admin_review_deletion_request(uuid, text, uuid, text) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.gsa_admin_list_resource(uuid, text, text, integer, integer, text, text) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.gsa_admin_update_resource_status(uuid, text, text, uuid, text, text) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.gsa_admin_classified_action(uuid, text, text, uuid, uuid, text, text) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.gsa_admin_save_protection_entity(uuid, text, text, text, uuid, jsonb) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.gsa_admin_create_protection_proposal(uuid, text, text, jsonb) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.gsa_admin_save_company(uuid, text, jsonb) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.gsa_admin_save_payment_method(uuid, text, uuid, jsonb) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.gsa_admin_fiscal_update(uuid, text, uuid, text, jsonb) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.gsa_admin_system_snapshot(uuid, text) TO authenticated, service_role;

COMMIT;
