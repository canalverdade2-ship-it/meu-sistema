BEGIN;

-- Endurecimento central do painel administrativo.
-- Esta migration mantém compatibilidade com as RPCs existentes, mas passa a
-- validar a sessão presente no JWT, o estado atual do colaborador e as
-- permissões persistidas na tabela colaborador_modulos.

CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE INDEX IF NOT EXISTS idx_colaborador_modulos_colaborador_modulo
  ON public.colaborador_modulos (colaborador_id, modulo_id);

CREATE INDEX IF NOT EXISTS idx_sistema_sessoes_status
  ON public.sistema_sessoes (status);

CREATE OR REPLACE FUNCTION public.gsa_admin_context()
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_claims jsonb := COALESCE(auth.jwt(), '{}'::jsonb);
  v_type text := COALESCE(v_claims -> 'app_metadata' ->> 'gsa_actor_type', '');
  v_id_text text := COALESCE(v_claims -> 'app_metadata' ->> 'gsa_actor_id', '');
  v_session_id_text text := COALESCE(v_claims -> 'app_metadata' ->> 'gsa_session_id', '');
  v_id uuid;
  v_session_id uuid;
  v_session jsonb;
  v_session_status text;
  v_session_actor_type text;
  v_session_actor_id text;
  v_session_expires text;
  v_colaborador jsonb;
  v_colaborador_status text;
  v_modules jsonb := '[]'::jsonb;
  v_actor_name text;
BEGIN
  IF v_type NOT IN ('admin', 'colaborador') OR v_id_text = '' OR v_session_id_text = '' THEN
    RAISE EXCEPTION 'Sessão administrativa inválida ou expirada.' USING ERRCODE = '42501';
  END IF;

  BEGIN
    v_id := v_id_text::uuid;
    v_session_id := v_session_id_text::uuid;
  EXCEPTION WHEN invalid_text_representation THEN
    RAISE EXCEPTION 'Identidade administrativa inválida.' USING ERRCODE = '42501';
  END;

  SELECT to_jsonb(s)
    INTO v_session
    FROM public.sistema_sessoes s
   WHERE s.id = v_session_id
   LIMIT 1;

  IF v_session IS NULL THEN
    RAISE EXCEPTION 'Sessão administrativa revogada.' USING ERRCODE = '42501';
  END IF;

  v_session_status := lower(COALESCE(
    v_session ->> 'status',
    v_session ->> 'situacao',
    ''
  ));

  IF v_session_status NOT IN ('ativo', 'ativa', 'active') THEN
    RAISE EXCEPTION 'Sessão administrativa encerrada.' USING ERRCODE = '42501';
  END IF;

  v_session_actor_type := COALESCE(
    v_session ->> 'ator_tipo',
    v_session ->> 'tipo_ator',
    v_session ->> 'usuario_tipo',
    ''
  );
  v_session_actor_id := COALESCE(
    v_session ->> 'ator_id',
    v_session ->> 'usuario_id',
    v_session ->> 'colaborador_id',
    ''
  );

  IF v_session_actor_type <> '' AND v_session_actor_type <> v_type THEN
    RAISE EXCEPTION 'A sessão não pertence ao ator autenticado.' USING ERRCODE = '42501';
  END IF;

  IF v_session_actor_id <> '' AND v_session_actor_id <> v_id::text THEN
    RAISE EXCEPTION 'A sessão não pertence ao usuário autenticado.' USING ERRCODE = '42501';
  END IF;

  v_session_expires := COALESCE(
    v_session ->> 'expira_em',
    v_session ->> 'expires_at',
    v_session ->> 'data_expiracao',
    ''
  );

  IF v_session_expires <> '' THEN
    BEGIN
      IF v_session_expires::timestamptz <= now() THEN
        RAISE EXCEPTION 'Sessão administrativa expirada.' USING ERRCODE = '42501';
      END IF;
    EXCEPTION WHEN invalid_text_representation OR datetime_field_overflow THEN
      RAISE EXCEPTION 'Data de expiração da sessão inválida.' USING ERRCODE = '42501';
    END;
  END IF;

  IF v_type = 'colaborador' THEN
    SELECT to_jsonb(c)
      INTO v_colaborador
      FROM public.colaboradores c
     WHERE c.id = v_id
     LIMIT 1;

    IF v_colaborador IS NULL THEN
      RAISE EXCEPTION 'Colaborador não encontrado.' USING ERRCODE = '42501';
    END IF;

    v_colaborador_status := lower(COALESCE(v_colaborador ->> 'status', 'ativo'));
    IF v_colaborador_status IN ('suspenso', 'bloqueado', 'inativo', 'excluido', 'excluído', 'cancelado') THEN
      RAISE EXCEPTION 'Acesso do colaborador revogado.' USING ERRCODE = '42501';
    END IF;

    SELECT COALESCE(jsonb_agg(DISTINCT cm.modulo_id ORDER BY cm.modulo_id), '[]'::jsonb)
      INTO v_modules
      FROM public.colaborador_modulos cm
     WHERE cm.colaborador_id = v_id;

    -- Compatibilidade com instalações antigas que ainda mantêm o array na
    -- própria tabela de colaboradores. A tabela de relacionamento é a fonte
    -- principal e somente usamos o legado quando ela está vazia.
    IF jsonb_array_length(v_modules) = 0 THEN
      v_modules := COALESCE(v_colaborador -> 'modulos', '[]'::jsonb);
      IF jsonb_typeof(v_modules) <> 'array' THEN
        v_modules := '[]'::jsonb;
      END IF;
    END IF;

    v_actor_name := COALESCE(v_colaborador ->> 'nome', 'Colaborador');
  ELSE
    v_actor_name := COALESCE(
      v_session ->> 'ator_nome',
      v_session ->> 'usuario_nome',
      'Administrador'
    );
  END IF;

  RETURN jsonb_build_object(
    'actor_type', v_type,
    'actor_id', v_id,
    'actor_name', v_actor_name,
    'session_id', v_session_id,
    'modules', v_modules
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.gsa_admin_validate_context(
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
  v_context jsonb := public.gsa_admin_context();
  v_validation jsonb;
BEGIN
  IF p_sessao_id IS NOT NULL
     AND p_sessao_id::text <> COALESCE(v_context ->> 'session_id', '') THEN
    RAISE EXCEPTION 'A sessão informada não corresponde ao JWT atual.' USING ERRCODE = '42501';
  END IF;

  IF p_sessao_id IS NOT NULL OR p_session_token IS NOT NULL THEN
    IF p_sessao_id IS NULL OR COALESCE(p_session_token, '') = '' THEN
      RAISE EXCEPTION 'Identificação completa da sessão é obrigatória.' USING ERRCODE = '42501';
    END IF;

    BEGIN
      EXECUTE
        'SELECT to_jsonb(v) FROM public.gsa_validate_session($1, $2) v LIMIT 1'
        INTO v_validation
        USING p_sessao_id, p_session_token;
    EXCEPTION WHEN undefined_function THEN
      RAISE EXCEPTION 'Validador de sessão não disponível.' USING ERRCODE = '42501';
    END;

    IF v_validation IS NULL
       OR lower(COALESCE(v_validation ->> 'is_valid', 'false')) NOT IN ('true', 't', '1') THEN
      RAISE EXCEPTION 'Sessão administrativa inválida ou expirada.' USING ERRCODE = '42501';
    END IF;
  END IF;

  RETURN v_context;
END;
$$;

CREATE OR REPLACE FUNCTION public.gsa_admin_has_module(p_module text)
RETURNS boolean
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_context jsonb := public.gsa_admin_context();
  v_requested text := lower(trim(COALESCE(p_module, '')));
  v_aliases text[];
BEGIN
  IF v_context ->> 'actor_type' = 'admin' THEN
    RETURN true;
  END IF;

  IF v_requested = 'dashboard' THEN
    RETURN true;
  END IF;

  -- Os aliases abaixo existem apenas para compatibilidade de nomes dentro do
  -- mesmo domínio. Uma permissão de vendas não libera Viagens, Saúde, Seguros
  -- ou Classificados.
  v_aliases := CASE v_requested
    WHEN 'cadastro' THEN ARRAY['cadastro', 'clientes', 'prestadores']
    WHEN 'clientes' THEN ARRAY['cadastro', 'clientes']
    WHEN 'prestadores' THEN ARRAY['cadastro', 'prestadores']
    WHEN 'catalogo' THEN ARRAY['catalogo']
    WHEN 'operacoes' THEN ARRAY['operacoes', 'vendas', 'demandas']
    WHEN 'vendas' THEN ARRAY['operacoes', 'vendas']
    WHEN 'demandas' THEN ARRAY['operacoes', 'demandas']
    WHEN 'loja' THEN ARRAY['loja']
    WHEN 'classificados' THEN ARRAY['classificados']
    WHEN 'viagens' THEN ARRAY['viagens']
    WHEN 'saude' THEN ARRAY['saude']
    WHEN 'seguros' THEN ARRAY['seguros']
    WHEN 'fidelidade' THEN ARRAY['fidelidade', 'area_vip', 'promocoes']
    WHEN 'area_vip' THEN ARRAY['fidelidade', 'area_vip']
    WHEN 'promocoes' THEN ARRAY['fidelidade', 'promocoes']
    WHEN 'atendimento' THEN ARRAY['atendimento', 'tickets', 'suporte']
    WHEN 'tickets' THEN ARRAY['atendimento', 'tickets', 'suporte']
    WHEN 'financeiro' THEN ARRAY['financeiro']
    WHEN 'cobranca' THEN ARRAY['cobranca']
    WHEN 'fiscal' THEN ARRAY['fiscal']
    WHEN 'emprestimos' THEN ARRAY['emprestimos']
    WHEN 'credito_loja' THEN ARRAY['credito_loja']
    WHEN 'relatorios' THEN ARRAY['relatorios']
    WHEN 'configuracoes' THEN ARRAY['configuracoes']
    WHEN 'acessos' THEN ARRAY['acessos']
    WHEN 'sistema' THEN ARRAY['sistema']
    ELSE ARRAY[v_requested]
  END;

  RETURN EXISTS (
    SELECT 1
      FROM jsonb_array_elements_text(COALESCE(v_context -> 'modules', '[]'::jsonb)) AS granted(value)
     WHERE lower(trim(granted.value)) = ANY(v_aliases)
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.gsa_admin_assert_module(p_module text)
RETURNS void
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  IF NOT public.gsa_admin_has_module(p_module) THEN
    RAISE EXCEPTION 'Você não possui permissão para acessar o módulo %.', p_module USING ERRCODE = '42501';
  END IF;
END;
$$;

CREATE OR REPLACE FUNCTION public.gsa_admin_get_context_secure(
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
  v_context jsonb := public.gsa_admin_validate_context(p_sessao_id, p_session_token);
BEGIN
  RETURN jsonb_build_object(
    'actor_type', v_context ->> 'actor_type',
    'actor_id', v_context ->> 'actor_id',
    'actor_name', v_context ->> 'actor_name',
    'modules', COALESCE(v_context -> 'modules', '[]'::jsonb),
    'session_id', v_context ->> 'session_id'
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.gsa_admin_notification_visible(
  p_module text,
  p_destinatario_tipo text,
  p_colaborador_id text
)
RETURNS boolean
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_context jsonb := public.gsa_admin_context();
  v_actor_type text := v_context ->> 'actor_type';
  v_actor_id text := v_context ->> 'actor_id';
  v_destination text := lower(COALESCE(p_destinatario_tipo, ''));
BEGIN
  IF v_actor_type = 'admin' THEN
    RETURN v_destination IN ('', 'admin', 'broadcast_todos', 'todos');
  END IF;

  IF COALESCE(trim(p_module), '') <> '' AND NOT public.gsa_admin_has_module(p_module) THEN
    RETURN false;
  END IF;

  IF v_destination IN ('broadcast_todos', 'todos') THEN
    RETURN true;
  END IF;

  RETURN v_destination = 'colaborador' AND COALESCE(p_colaborador_id, '') = v_actor_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.gsa_admin_list_notifications(
  p_sessao_id uuid DEFAULT NULL,
  p_session_token text DEFAULT NULL,
  p_limit integer DEFAULT 50
)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_context jsonb := public.gsa_admin_validate_context(p_sessao_id, p_session_token);
  v_actor_type text := v_context ->> 'actor_type';
  v_actor_id uuid := (v_context ->> 'actor_id')::uuid;
  v_result jsonb;
  v_limit integer := LEAST(GREATEST(COALESCE(p_limit, 50), 1), 10000);
BEGIN
  SELECT COALESCE(jsonb_agg(rows.item ORDER BY rows.created_at DESC), '[]'::jsonb)
    INTO v_result
    FROM (
      SELECT item, created_at
        FROM (
          SELECT
            jsonb_build_object(
              'id', 'admin_' || n.id::text,
              'source_table', 'admin_notificacoes',
              'titulo', COALESCE(to_jsonb(n) ->> 'titulo', 'Notificação administrativa'),
              'mensagem', COALESCE(to_jsonb(n) ->> 'mensagem', ''),
              'modulo', to_jsonb(n) ->> 'modulo',
              'tab', to_jsonb(n) ->> 'tab',
              'item_id', COALESCE(to_jsonb(n) ->> 'item_id', to_jsonb(n) ->> 'registro_id'),
              'tipo', COALESCE(to_jsonb(n) ->> 'tipo', 'administrativa'),
              'prioridade', COALESCE(to_jsonb(n) ->> 'prioridade', 'normal'),
              'created_at', COALESCE((to_jsonb(n) ->> 'created_at')::timestamptz, now()),
              'lida', state.read_at IS NOT NULL
            ) AS item,
            COALESCE((to_jsonb(n) ->> 'created_at')::timestamptz, now()) AS created_at
          FROM public.admin_notificacoes n
          LEFT JOIN public.gsa_admin_notification_state state
            ON state.actor_type = v_actor_type
           AND state.actor_id = v_actor_id
           AND state.source_table = 'admin_notificacoes'
           AND state.notification_id = n.id::text
          WHERE state.dismissed_at IS NULL
            AND public.gsa_admin_notification_visible(
              to_jsonb(n) ->> 'modulo',
              COALESCE(to_jsonb(n) ->> 'destinatario_tipo', 'admin'),
              COALESCE(to_jsonb(n) ->> 'colaborador_id', to_jsonb(n) ->> 'destinatario_id')
            )

          UNION ALL

          SELECT
            jsonb_build_object(
              'id', 'gen_' || n.id::text,
              'source_table', 'notificacoes',
              'titulo', COALESCE(to_jsonb(n) ->> 'titulo', 'Notificação'),
              'mensagem', COALESCE(to_jsonb(n) ->> 'mensagem', ''),
              'modulo', to_jsonb(n) ->> 'modulo',
              'tab', to_jsonb(n) ->> 'tab',
              'item_id', COALESCE(to_jsonb(n) ->> 'item_id', to_jsonb(n) ->> 'registro_id'),
              'tipo', COALESCE(to_jsonb(n) ->> 'tipo', 'geral'),
              'prioridade', COALESCE(to_jsonb(n) ->> 'prioridade', 'normal'),
              'acao_origem', to_jsonb(n) ->> 'acao_origem',
              'destinatario_tipo', to_jsonb(n) ->> 'destinatario_tipo',
              'created_at', COALESCE((to_jsonb(n) ->> 'data_criacao')::timestamptz, (to_jsonb(n) ->> 'created_at')::timestamptz, now()),
              'lida', state.read_at IS NOT NULL
            ) AS item,
            COALESCE((to_jsonb(n) ->> 'data_criacao')::timestamptz, (to_jsonb(n) ->> 'created_at')::timestamptz, now()) AS created_at
          FROM public.notificacoes n
          LEFT JOIN public.gsa_admin_notification_state state
            ON state.actor_type = v_actor_type
           AND state.actor_id = v_actor_id
           AND state.source_table = 'notificacoes'
           AND state.notification_id = n.id::text
          WHERE state.dismissed_at IS NULL
            AND public.gsa_admin_notification_visible(
              to_jsonb(n) ->> 'modulo',
              COALESCE(to_jsonb(n) ->> 'destinatario_tipo', 'admin'),
              COALESCE(to_jsonb(n) ->> 'colaborador_id', to_jsonb(n) ->> 'destinatario_id')
            )
        ) visible
       ORDER BY visible.created_at DESC
       LIMIT v_limit
    ) rows;

  RETURN COALESCE(v_result, '[]'::jsonb);
END;
$$;

CREATE OR REPLACE FUNCTION public.gsa_admin_mark_all_notifications(
  p_sessao_id uuid DEFAULT NULL,
  p_session_token text DEFAULT NULL,
  p_dismiss boolean DEFAULT false
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_item jsonb;
  v_count integer := 0;
BEGIN
  PERFORM public.gsa_admin_validate_context(p_sessao_id, p_session_token);

  FOR v_item IN
    SELECT value
      FROM jsonb_array_elements(public.gsa_admin_list_notifications(p_sessao_id, p_session_token, 10000))
  LOOP
    PERFORM public.gsa_admin_set_notification_state(
      p_sessao_id,
      p_session_token,
      v_item ->> 'id',
      true,
      p_dismiss
    );
    v_count := v_count + 1;
  END LOOP;

  RETURN jsonb_build_object('success', true, 'processed', v_count);
END;
$$;

-- Corrige a diferença histórica entre "em andamento" e "em_andamento" nas
-- contagens do painel, sem exigir uma migração destrutiva imediata dos dados.
CREATE OR REPLACE FUNCTION public.gsa_admin_ticket_is_in_progress(p_status text)
RETURNS boolean
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT lower(replace(trim(COALESCE(p_status, '')), ' ', '_')) = 'em_andamento';
$$;

REVOKE ALL ON FUNCTION public.gsa_admin_context() FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.gsa_admin_validate_context(uuid, text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.gsa_admin_has_module(text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.gsa_admin_assert_module(text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.gsa_admin_get_context_secure(uuid, text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.gsa_admin_notification_visible(text, text, text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.gsa_admin_list_notifications(uuid, text, integer) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.gsa_admin_mark_all_notifications(uuid, text, boolean) FROM PUBLIC, anon;

GRANT EXECUTE ON FUNCTION public.gsa_admin_context() TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.gsa_admin_validate_context(uuid, text) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.gsa_admin_has_module(text) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.gsa_admin_assert_module(text) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.gsa_admin_get_context_secure(uuid, text) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.gsa_admin_list_notifications(uuid, text, integer) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.gsa_admin_mark_all_notifications(uuid, text, boolean) TO authenticated, service_role;

COMMIT;
