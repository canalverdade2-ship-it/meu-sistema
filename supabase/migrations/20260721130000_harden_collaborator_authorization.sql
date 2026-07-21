BEGIN;

-- Permissões administrativas são exatas. Compatibilidades legadas são aceitas
-- somente dentro do mesmo domínio e nunca ampliam o escopo concedido.
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
  v_grants text[];
BEGIN
  IF v_context ->> 'actor_type' = 'admin' THEN
    RETURN true;
  END IF;

  IF v_requested = 'dashboard' THEN
    RETURN true;
  END IF;

  -- Gestão de acessos é uma atribuição exclusiva do administrador principal.
  IF v_requested = 'acessos' THEN
    RETURN false;
  END IF;

  v_grants := CASE v_requested
    WHEN 'cadastro' THEN ARRAY['cadastro', 'cadastros', 'clientes']
    WHEN 'clientes' THEN ARRAY['cadastro', 'cadastros', 'clientes']
    WHEN 'prestadores' THEN ARRAY['prestadores', 'cadastro', 'cadastros']
    WHEN 'catalogo' THEN ARRAY['catalogo']
    WHEN 'operacoes' THEN ARRAY['operacoes', 'vendas']
    WHEN 'vendas' THEN ARRAY['operacoes', 'vendas']
    WHEN 'demandas' THEN ARRAY['demandas']
    WHEN 'loja' THEN ARRAY['loja']
    WHEN 'classificados' THEN ARRAY['classificados']
    WHEN 'viagens' THEN ARRAY['viagens']
    WHEN 'saude' THEN ARRAY['saude']
    WHEN 'seguros' THEN ARRAY['seguros']
    WHEN 'fidelidade' THEN ARRAY['fidelidade', 'vouchers', 'premios', 'indique-ganhe']
    WHEN 'promocoes' THEN ARRAY['promocoes']
    WHEN 'area_vip' THEN ARRAY['area_vip']
    WHEN 'atendimento' THEN ARRAY['atendimento', 'tickets', 'suporte']
    WHEN 'tickets' THEN ARRAY['atendimento', 'tickets', 'suporte']
    WHEN 'financeiro' THEN ARRAY['financeiro']
    WHEN 'cobranca' THEN ARRAY['cobranca']
    WHEN 'fiscal' THEN ARRAY['fiscal']
    WHEN 'emprestimos' THEN ARRAY['emprestimos']
    WHEN 'credito_loja' THEN ARRAY['credito_loja', 'credito', 'credito-loja']
    WHEN 'relatorios' THEN ARRAY['relatorios']
    WHEN 'configuracoes' THEN ARRAY['configuracoes']
    WHEN 'sistema' THEN ARRAY['sistema']
    ELSE ARRAY[v_requested]
  END;

  RETURN EXISTS (
    SELECT 1
      FROM jsonb_array_elements_text(COALESCE(v_context -> 'modules', '[]'::jsonb)) AS granted(value)
     WHERE lower(trim(granted.value)) = ANY(v_grants)
  );
END;
$$;

-- Nenhum colaborador pode receber a permissão capaz de criar contas, trocar
-- credenciais, suspender usuários ou aprovar exclusões definitivas.
DELETE FROM public.colaborador_modulos
 WHERE lower(trim(modulo_id)) = 'acessos';

CREATE OR REPLACE FUNCTION public.gsa_block_collaborator_access_module()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  IF lower(trim(COALESCE(NEW.modulo_id, ''))) = 'acessos' THEN
    RAISE EXCEPTION 'A Gestão de Acessos é exclusiva do administrador.' USING ERRCODE = '42501';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_gsa_block_collaborator_access_module ON public.colaborador_modulos;
CREATE TRIGGER trg_gsa_block_collaborator_access_module
BEFORE INSERT OR UPDATE OF modulo_id ON public.colaborador_modulos
FOR EACH ROW EXECUTE FUNCTION public.gsa_block_collaborator_access_module();

DO $sync_modules$
DECLARE
  v_id uuid;
BEGIN
  IF to_regprocedure('public.gsa_sync_colaborador_modules(uuid)') IS NULL THEN
    RETURN;
  END IF;

  FOR v_id IN SELECT id FROM public.colaboradores LOOP
    PERFORM public.gsa_sync_colaborador_modules(v_id);
  END LOOP;
END;
$sync_modules$;

-- A política mais recente havia voltado a classificar Prestadores como Cadastro.
-- As políticas abaixo restauram a fronteira explícita entre clientes e prestadores.
DO $provider_policies$
BEGIN
  IF to_regclass('public.prestadores') IS NOT NULL THEN
    ALTER TABLE public.prestadores ENABLE ROW LEVEL SECURITY;
    DROP POLICY IF EXISTS gsa_collaborator_module_prestadores ON public.prestadores;
    CREATE POLICY gsa_collaborator_module_prestadores
      ON public.prestadores AS RESTRICTIVE FOR ALL TO authenticated
      USING (public.gsa_admin_restrict_collaborator_to_module('prestadores'))
      WITH CHECK (public.gsa_admin_restrict_collaborator_to_module('prestadores'));
  END IF;

  IF to_regclass('public.prestador_documentos') IS NOT NULL THEN
    ALTER TABLE public.prestador_documentos ENABLE ROW LEVEL SECURITY;
    DROP POLICY IF EXISTS gsa_collaborator_module_prestador_documentos ON public.prestador_documentos;
    CREATE POLICY gsa_collaborator_module_prestador_documentos
      ON public.prestador_documentos AS RESTRICTIVE FOR ALL TO authenticated
      USING (public.gsa_admin_restrict_collaborator_to_module('prestadores'))
      WITH CHECK (public.gsa_admin_restrict_collaborator_to_module('prestadores'));
  END IF;
END;
$provider_policies$;

CREATE OR REPLACE FUNCTION public.gsa_collaborator_can_access_demand(p_demanda_id uuid)
RETURNS boolean
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_context jsonb := public.gsa_admin_context();
  v_actor_id uuid := (v_context ->> 'actor_id')::uuid;
BEGIN
  IF v_context ->> 'actor_type' = 'admin' THEN
    RETURN true;
  END IF;
  IF public.gsa_admin_has_module('operacoes') THEN
    RETURN true;
  END IF;
  IF NOT public.gsa_admin_has_module('demandas') THEN
    RETURN false;
  END IF;

  RETURN EXISTS (
    SELECT 1
      FROM public.prestador_demandas d
     WHERE d.id = p_demanda_id
       AND d.colaborador_id = v_actor_id
  );
END;
$$;

DO $demand_policies$
BEGIN
  IF to_regclass('public.prestador_demandas') IS NOT NULL THEN
    ALTER TABLE public.prestador_demandas ENABLE ROW LEVEL SECURITY;
    DROP POLICY IF EXISTS gsa_collaborator_module_prestador_demandas ON public.prestador_demandas;
    CREATE POLICY gsa_collaborator_module_prestador_demandas
      ON public.prestador_demandas AS RESTRICTIVE FOR ALL TO authenticated
      USING (
        public.gsa_current_actor_type() <> 'colaborador'
        OR public.gsa_admin_has_module('operacoes')
        OR (
          public.gsa_admin_has_module('demandas')
          AND colaborador_id = public.gsa_current_actor_id()
        )
      )
      WITH CHECK (
        public.gsa_current_actor_type() <> 'colaborador'
        OR public.gsa_admin_has_module('operacoes')
        OR (
          public.gsa_admin_has_module('demandas')
          AND colaborador_id = public.gsa_current_actor_id()
        )
      );
  END IF;

  IF to_regclass('public.prestador_demandas_historico') IS NOT NULL THEN
    ALTER TABLE public.prestador_demandas_historico ENABLE ROW LEVEL SECURITY;
    DROP POLICY IF EXISTS gsa_collaborator_demand_history_scope ON public.prestador_demandas_historico;
    CREATE POLICY gsa_collaborator_demand_history_scope
      ON public.prestador_demandas_historico AS RESTRICTIVE FOR ALL TO authenticated
      USING (
        public.gsa_current_actor_type() <> 'colaborador'
        OR public.gsa_collaborator_can_access_demand(demanda_id)
      )
      WITH CHECK (
        public.gsa_current_actor_type() <> 'colaborador'
        OR public.gsa_collaborator_can_access_demand(demanda_id)
      );
  END IF;
END;
$demand_policies$;

-- As RPCs de leitura passam a validar também o segredo da sessão, não apenas o JWT.
DO $wrap_pendency$
BEGIN
  IF to_regprocedure('public.gsa_admin_get_pendency_counts_pre_collaborator_boundary(uuid,text)') IS NULL
     AND to_regprocedure('public.gsa_admin_get_pendency_counts_secure(uuid,text)') IS NOT NULL THEN
    ALTER FUNCTION public.gsa_admin_get_pendency_counts_secure(uuid, text)
      RENAME TO gsa_admin_get_pendency_counts_pre_collaborator_boundary;
  END IF;
END;
$wrap_pendency$;

CREATE OR REPLACE FUNCTION public.gsa_admin_get_pendency_counts_secure(
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
  v_result jsonb := public.gsa_admin_get_pendency_counts_pre_collaborator_boundary(p_sessao_id, p_session_token);
  v_provider_pending bigint := 0;
  v_provider_analysis bigint := 0;
  v_demands bigint := 0;
BEGIN
  IF v_context ->> 'actor_type' = 'colaborador'
     AND public.gsa_admin_has_module('prestadores')
     AND NOT public.gsa_admin_has_module('cadastro')
     AND to_regclass('public.prestadores') IS NOT NULL THEN
    EXECUTE 'SELECT count(*) FILTER (WHERE lower(COALESCE(status, '''')) = ''pendente''), count(*) FILTER (WHERE lower(COALESCE(status, '''')) IN (''em_analise'', ''em análise'')) FROM public.prestadores'
      INTO v_provider_pending, v_provider_analysis;
    v_result := v_result || jsonb_build_object(
      'cadastro_prestadores_pendentes', COALESCE(v_provider_pending, 0),
      'cadastro_prestadores_analise', COALESCE(v_provider_analysis, 0)
    );
  END IF;

  IF v_context ->> 'actor_type' = 'colaborador'
     AND public.gsa_admin_has_module('demandas')
     AND NOT public.gsa_admin_has_module('operacoes')
     AND to_regclass('public.prestador_demandas') IS NOT NULL THEN
    EXECUTE 'SELECT count(*) FROM public.prestador_demandas WHERE colaborador_id = $1 AND lower(COALESCE(status, '''')) NOT IN (''concluida'', ''concluida_interna'', ''finalizada'', ''cancelada'')'
      INTO v_demands
      USING (v_context ->> 'actor_id')::uuid;
    v_result := v_result || jsonb_build_object(
      'vendas_demandas_internas', COALESCE(v_demands, 0),
      'vendas_demandas_ativas', COALESCE(v_demands, 0)
    );
  END IF;

  RETURN COALESCE(v_result, '{}'::jsonb);
END;
$$;

DO $wrap_dashboard$
BEGIN
  IF to_regprocedure('public.gsa_admin_dashboard_snapshot_pre_collaborator_boundary(uuid,text)') IS NULL
     AND to_regprocedure('public.gsa_admin_dashboard_snapshot(uuid,text)') IS NOT NULL THEN
    ALTER FUNCTION public.gsa_admin_dashboard_snapshot(uuid, text)
      RENAME TO gsa_admin_dashboard_snapshot_pre_collaborator_boundary;
  END IF;
END;
$wrap_dashboard$;

CREATE OR REPLACE FUNCTION public.gsa_admin_dashboard_snapshot(
  p_sessao_id uuid DEFAULT NULL,
  p_session_token text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  PERFORM public.gsa_admin_validate_context(p_sessao_id, p_session_token);
  RETURN public.gsa_admin_dashboard_snapshot_pre_collaborator_boundary(p_sessao_id, p_session_token);
END;
$$;

-- Snapshot mínimo e autorizado do painel do colaborador.
CREATE OR REPLACE FUNCTION public.gsa_collaborator_dashboard_snapshot(
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
  v_actor_id uuid := (v_context ->> 'actor_id')::uuid;
  v_metrics jsonb := '{}'::jsonb;
  v_amounts jsonb := '{}'::jsonb;
  v_assigned jsonb := '[]'::jsonb;
  v_a numeric := 0;
  v_b numeric := 0;
BEGIN
  IF v_context ->> 'actor_type' <> 'colaborador' THEN
    RAISE EXCEPTION 'Esta visão é exclusiva do colaborador.' USING ERRCODE = '42501';
  END IF;

  IF public.gsa_admin_has_module('cadastro') AND to_regclass('public.clientes') IS NOT NULL THEN
    EXECUTE 'SELECT count(*) FILTER (WHERE lower(COALESCE(status, '''')) = ''ativo''), count(*) FILTER (WHERE lower(COALESCE(status, '''')) IN (''pendente'', ''inativo'', ''bloqueado'')) FROM public.clientes'
      INTO v_a, v_b;
    v_metrics := v_metrics || jsonb_build_object('clientes', COALESCE(v_a, 0), 'cadastrosPendentes', COALESCE(v_b, 0));
  END IF;

  IF public.gsa_admin_has_module('prestadores') AND to_regclass('public.prestadores') IS NOT NULL THEN
    EXECUTE 'SELECT count(*) FROM public.prestadores WHERE lower(COALESCE(status, '''')) IN (''pendente'', ''em_analise'', ''em análise'')'
      INTO v_a;
    v_metrics := v_metrics || jsonb_build_object('prestadoresPendentes', COALESCE(v_a, 0));
  END IF;

  IF public.gsa_admin_has_module('operacoes') THEN
    IF to_regclass('public.orcamentos') IS NOT NULL THEN
      EXECUTE 'SELECT count(*) FROM public.orcamentos WHERE lower(COALESCE(status, '''')) IN (''aberto'', ''negociação'', ''negociacao'', ''em revisão'', ''em_revisao'')'
        INTO v_a;
      v_metrics := v_metrics || jsonb_build_object('orcamentos', COALESCE(v_a, 0));
    END IF;
    IF to_regclass('public.ordens_servico') IS NOT NULL THEN
      EXECUTE 'SELECT count(*) FROM public.ordens_servico WHERE lower(COALESCE(status, '''')) IN (''aberto'', ''aguardando'', ''andamento'', ''em_andamento'')'
        INTO v_a;
      v_metrics := v_metrics || jsonb_build_object('ordens', COALESCE(v_a, 0));
    END IF;
  END IF;

  IF public.gsa_admin_has_module('demandas') AND to_regclass('public.prestador_demandas') IS NOT NULL THEN
    EXECUTE 'SELECT count(*) FROM public.prestador_demandas WHERE colaborador_id = $1 AND lower(COALESCE(status, '''')) NOT IN (''concluida'', ''concluida_interna'', ''finalizada'', ''cancelada'')'
      INTO v_a USING v_actor_id;
    v_metrics := v_metrics || jsonb_build_object('demandas', COALESCE(v_a, 0));

    EXECUTE $sql$
      SELECT COALESCE(jsonb_agg(item ORDER BY created_at DESC), '[]'::jsonb)
      FROM (
        SELECT
          jsonb_strip_nulls(
            jsonb_build_object(
              'id', d.id,
              'titulo', d.titulo,
              'status', d.status,
              'prioridade', d.prioridade,
              'prazo_limite', d.prazo_limite,
              'created_at', d.created_at,
              'os_id', d.os_id,
              'ordem_servico', CASE WHEN os.id IS NULL THEN NULL ELSE jsonb_build_object(
                'id', os.id,
                'codigo_os', os.codigo_os,
                'cliente_id', os.cliente_id,
                'cliente', CASE WHEN c.id IS NULL THEN NULL ELSE jsonb_build_object('id', c.id, 'nome', c.nome) END
              ) END
            )
          ) AS item,
          d.created_at
        FROM public.prestador_demandas d
        LEFT JOIN public.ordens_servico os ON os.id = d.os_id
        LEFT JOIN public.clientes c ON c.id = os.cliente_id
        WHERE d.colaborador_id = $1
        ORDER BY d.created_at DESC
        LIMIT 6
      ) scoped
    $sql$ INTO v_assigned USING v_actor_id;
  END IF;

  IF public.gsa_admin_has_module('financeiro') THEN
    IF to_regclass('public.faturas') IS NOT NULL THEN
      EXECUTE 'SELECT count(*) FROM public.faturas WHERE lower(COALESCE(status, '''')) IN (''pendente'', ''vencida'')' INTO v_a;
      v_metrics := v_metrics || jsonb_build_object('faturas', COALESCE(v_a, 0));
    END IF;
    IF to_regclass('public.saques') IS NOT NULL THEN
      EXECUTE 'SELECT count(*) FROM public.saques WHERE lower(COALESCE(status, '''')) = ''pendente''' INTO v_a;
      v_metrics := v_metrics || jsonb_build_object('saques', COALESCE(v_a, 0));
    END IF;
  END IF;

  IF public.gsa_admin_has_module('emprestimos') AND to_regclass('public.emprestimos') IS NOT NULL THEN
    EXECUTE 'SELECT count(*), COALESCE(sum(valor_solicitado), 0) FROM public.emprestimos WHERE lower(COALESCE(status, '''')) IN (''analise'', ''pendente'', ''aguardando_assinatura'')'
      INTO v_a, v_b;
    v_metrics := v_metrics || jsonb_build_object('emprestimos', COALESCE(v_a, 0));
    v_amounts := v_amounts || jsonb_build_object('credito', COALESCE(v_b, 0));
  END IF;

  IF public.gsa_admin_has_module('cobranca') AND to_regclass('public.cobrancas') IS NOT NULL THEN
    EXECUTE 'SELECT count(*) FROM public.cobrancas WHERE lower(COALESCE(status, '''')) IN (''pendente'', ''em_cobranca'', ''acordo_quebrado'')' INTO v_a;
    v_metrics := v_metrics || jsonb_build_object('cobrancas', COALESCE(v_a, 0));
  END IF;

  IF public.gsa_admin_has_module('atendimento') AND to_regclass('public.tickets') IS NOT NULL THEN
    EXECUTE 'SELECT count(*) FROM public.tickets WHERE lower(replace(COALESCE(status, ''''), '' '', ''_'')) IN (''aberto'', ''em_andamento'')' INTO v_a;
    v_metrics := v_metrics || jsonb_build_object('tickets', COALESCE(v_a, 0));
  END IF;

  IF public.gsa_admin_has_module('fiscal') AND to_regclass('public.ordens_fiscais') IS NOT NULL THEN
    EXECUTE 'SELECT count(*) FROM public.ordens_fiscais WHERE lower(COALESCE(status_emissao, '''')) IN (''pendente'', ''erro'')' INTO v_a;
    v_metrics := v_metrics || jsonb_build_object('fiscal', COALESCE(v_a, 0));
  END IF;

  RETURN jsonb_build_object(
    'metrics', v_metrics,
    'amounts', v_amounts,
    'assigned_demands', v_assigned,
    'generated_at', now()
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.gsa_collaborator_list_demands(
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
  v_actor_id uuid := (v_context ->> 'actor_id')::uuid;
  v_result jsonb;
BEGIN
  IF v_context ->> 'actor_type' <> 'colaborador' OR NOT public.gsa_admin_has_module('demandas') THEN
    RAISE EXCEPTION 'O colaborador não possui acesso às demandas internas.' USING ERRCODE = '42501';
  END IF;

  SELECT COALESCE(jsonb_agg(item ORDER BY created_at DESC), '[]'::jsonb)
    INTO v_result
    FROM (
      SELECT
        jsonb_strip_nulls(
          to_jsonb(d)
          || jsonb_build_object(
            'ordem_servico', CASE WHEN os.id IS NULL THEN NULL ELSE jsonb_build_object(
              'id', os.id,
              'codigo_os', os.codigo_os,
              'cliente_id', os.cliente_id,
              'cliente', CASE WHEN c.id IS NULL THEN NULL ELSE jsonb_build_object('id', c.id, 'nome', c.nome) END
            ) END,
            'colaborador', jsonb_build_object('id', v_actor_id, 'nome', v_context ->> 'actor_name'),
            'prestador', CASE WHEN p.id IS NULL THEN NULL ELSE jsonb_build_object('id', p.id, 'nome_razao', p.nome_razao) END
          )
        ) AS item,
        d.created_at
      FROM public.prestador_demandas d
      LEFT JOIN public.ordens_servico os ON os.id = d.os_id
      LEFT JOIN public.clientes c ON c.id = os.cliente_id
      LEFT JOIN public.prestadores p ON p.id = d.prestador_id
      WHERE d.colaborador_id = v_actor_id
      ORDER BY d.created_at DESC
      LIMIT LEAST(GREATEST(COALESCE(p_limit, 500), 1), 1000)
    ) scoped;

  RETURN COALESCE(v_result, '[]'::jsonb);
END;
$$;

CREATE OR REPLACE FUNCTION public.gsa_collaborator_demand_history(
  p_sessao_id uuid DEFAULT NULL,
  p_session_token text DEFAULT NULL,
  p_demanda_id uuid DEFAULT NULL,
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
  v_result jsonb;
BEGIN
  IF v_context ->> 'actor_type' <> 'colaborador'
     OR NOT public.gsa_admin_has_module('demandas')
     OR NOT public.gsa_collaborator_can_access_demand(p_demanda_id) THEN
    RAISE EXCEPTION 'Histórico da demanda não autorizado.' USING ERRCODE = '42501';
  END IF;

  SELECT COALESCE(jsonb_agg(item ORDER BY created_at DESC), '[]'::jsonb)
    INTO v_result
    FROM (
      SELECT
        jsonb_strip_nulls(
          to_jsonb(h)
          || jsonb_build_object(
            'origem', CASE WHEN co.id IS NULL THEN NULL ELSE jsonb_build_object('id', co.id, 'nome', co.nome) END,
            'destino', CASE WHEN cd.id IS NULL THEN NULL ELSE jsonb_build_object('id', cd.id, 'nome', cd.nome) END,
            'destino_prestador', CASE WHEN pd.id IS NULL THEN NULL ELSE jsonb_build_object('id', pd.id, 'nome_razao', pd.nome_razao) END,
            'origem_prestador', CASE WHEN po.id IS NULL THEN NULL ELSE jsonb_build_object('id', po.id, 'nome_razao', po.nome_razao) END
          )
        ) AS item,
        h.created_at
      FROM public.prestador_demandas_historico h
      LEFT JOIN public.colaboradores co ON co.id = h.colaborador_origem_id
      LEFT JOIN public.colaboradores cd ON cd.id = h.colaborador_destino_id
      LEFT JOIN public.prestadores pd ON pd.id = h.prestador_destino_id
      LEFT JOIN public.prestadores po ON po.id = h.prestador_origem_id
      WHERE h.demanda_id = p_demanda_id
      ORDER BY h.created_at DESC
      LIMIT LEAST(GREATEST(COALESCE(p_limit, 500), 1), 1000)
    ) scoped;

  RETURN COALESCE(v_result, '[]'::jsonb);
END;
$$;

-- Classificação precisa da trilha automática e cobertura do histórico das demandas.
CREATE OR REPLACE FUNCTION public.gsa_admin_sensitive_change_audit()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_claims jsonb := COALESCE(auth.jwt(), '{}'::jsonb);
  v_actor_type text := COALESCE(v_claims -> 'app_metadata' ->> 'gsa_actor_type', '');
  v_actor_id_text text := COALESCE(v_claims -> 'app_metadata' ->> 'gsa_actor_id', '');
  v_session_id_text text := COALESCE(v_claims -> 'app_metadata' ->> 'gsa_session_id', '');
  v_actor_id uuid;
  v_session_id uuid;
  v_session jsonb;
  v_row jsonb;
  v_old jsonb := CASE WHEN TG_OP = 'INSERT' THEN '{}'::jsonb ELSE to_jsonb(OLD) END;
  v_new jsonb := CASE WHEN TG_OP = 'DELETE' THEN '{}'::jsonb ELSE to_jsonb(NEW) END;
  v_target_id uuid;
  v_module text;
BEGIN
  IF v_actor_type NOT IN ('admin', 'colaborador') THEN
    RETURN CASE WHEN TG_OP = 'DELETE' THEN OLD ELSE NEW END;
  END IF;

  BEGIN
    v_actor_id := v_actor_id_text::uuid;
    v_session_id := v_session_id_text::uuid;
  EXCEPTION WHEN invalid_text_representation THEN
    RAISE EXCEPTION 'Identidade administrativa inválida para auditoria.' USING ERRCODE = '42501';
  END;

  SELECT to_jsonb(s)
    INTO v_session
    FROM public.sistema_sessoes s
   WHERE s.id = v_session_id
   LIMIT 1;

  IF v_session IS NULL
     OR lower(COALESCE(v_session ->> 'status', v_session ->> 'situacao', '')) NOT IN ('ativo', 'ativa', 'active')
     OR COALESCE(v_session ->> 'ator_tipo', v_session ->> 'tipo_ator', v_actor_type) <> v_actor_type
     OR COALESCE(v_session ->> 'ator_id', v_session ->> 'usuario_id', v_session ->> 'colaborador_id', v_actor_id::text) <> v_actor_id::text THEN
    RAISE EXCEPTION 'Sessão administrativa inválida para auditoria.' USING ERRCODE = '42501';
  END IF;

  v_row := CASE WHEN TG_OP = 'DELETE' THEN v_old ELSE v_new END;
  BEGIN
    v_target_id := nullif(v_row ->> 'id', '')::uuid;
  EXCEPTION WHEN invalid_text_representation THEN
    v_target_id := NULL;
  END;

  v_module := CASE TG_TABLE_NAME
    WHEN 'clientes' THEN 'cadastro'
    WHEN 'cliente_documentos' THEN 'cadastro'
    WHEN 'prestadores' THEN 'prestadores'
    WHEN 'prestador_documentos' THEN 'prestadores'
    WHEN 'servicos' THEN 'catalogo'
    WHEN 'produtos' THEN 'catalogo'
    WHEN 'assinaturas' THEN 'catalogo'
    WHEN 'orcamentos' THEN 'operacoes'
    WHEN 'ordens_servico' THEN 'operacoes'
    WHEN 'prestador_demandas' THEN 'demandas'
    WHEN 'prestador_demandas_historico' THEN 'demandas'
    WHEN 'classificados_anuncios' THEN 'classificados'
    WHEN 'classificados_mensagens' THEN 'classificados'
    WHEN 'viagens_orcamentos' THEN 'viagens'
    WHEN 'viagens_pacotes' THEN 'viagens'
    WHEN 'viagens_propostas' THEN 'viagens'
    WHEN 'viagens_reservas' THEN 'viagens'
    WHEN 'saude_parceiros' THEN 'saude'
    WHEN 'saude_produtos' THEN 'saude'
    WHEN 'saude_cotacoes' THEN 'saude'
    WHEN 'saude_propostas' THEN 'saude'
    WHEN 'saude_contratos' THEN 'saude'
    WHEN 'seguros_parceiros' THEN 'seguros'
    WHEN 'seguros_produtos' THEN 'seguros'
    WHEN 'seguros_cotacoes' THEN 'seguros'
    WHEN 'seguros_propostas' THEN 'seguros'
    WHEN 'seguros_apolices' THEN 'seguros'
    WHEN 'tickets' THEN 'atendimento'
    WHEN 'ticket_mensagens' THEN 'atendimento'
    WHEN 'faturas' THEN 'financeiro'
    WHEN 'saques' THEN 'financeiro'
    WHEN 'transferencias' THEN 'financeiro'
    WHEN 'cobrancas' THEN 'cobranca'
    WHEN 'cobranca_acordo_parcelas' THEN 'cobranca'
    WHEN 'ordens_fiscais' THEN 'fiscal'
    WHEN 'emprestimos' THEN 'emprestimos'
    WHEN 'emprestimo_documentos' THEN 'emprestimos'
    WHEN 'loja_credito_solicitacoes' THEN 'credito_loja'
    WHEN 'loja_credito_movimentacoes' THEN 'credito_loja'
    WHEN 'empresa' THEN 'configuracoes'
    WHEN 'formas_pagamento' THEN 'configuracoes'
    WHEN 'system_settings' THEN 'configuracoes'
    WHEN 'colaboradores' THEN 'acessos'
    WHEN 'colaborador_modulos' THEN 'acessos'
    ELSE 'administrativo'
  END;

  INSERT INTO public.gsa_admin_audit_events (
    actor_type, actor_id, module, action, target_type, target_id, details
  ) VALUES (
    v_actor_type,
    v_actor_id,
    v_module,
    TG_OP || '_' || upper(TG_TABLE_NAME),
    TG_TABLE_NAME,
    v_target_id,
    jsonb_strip_nulls(jsonb_build_object(
      'session_id', v_session_id,
      'old_status', v_old ->> 'status',
      'new_status', v_new ->> 'status',
      'old_emission_status', v_old ->> 'status_emissao',
      'new_emission_status', v_new ->> 'status_emissao'
    ))
  );

  RETURN CASE WHEN TG_OP = 'DELETE' THEN OLD ELSE NEW END;
END;
$$;

DO $history_audit$
BEGIN
  IF to_regclass('public.prestador_demandas_historico') IS NOT NULL THEN
    DROP TRIGGER IF EXISTS trg_gsa_admin_audit_prestador_demandas_historico ON public.prestador_demandas_historico;
    CREATE TRIGGER trg_gsa_admin_audit_prestador_demandas_historico
      AFTER INSERT OR UPDATE OR DELETE ON public.prestador_demandas_historico
      FOR EACH ROW EXECUTE FUNCTION public.gsa_admin_sensitive_change_audit();
  END IF;
END;
$history_audit$;

REVOKE ALL ON FUNCTION public.gsa_block_collaborator_access_module() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.gsa_collaborator_can_access_demand(uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.gsa_admin_get_pendency_counts_secure(uuid, text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.gsa_admin_dashboard_snapshot(uuid, text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.gsa_collaborator_dashboard_snapshot(uuid, text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.gsa_collaborator_list_demands(uuid, text, integer) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.gsa_collaborator_demand_history(uuid, text, uuid, integer) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.gsa_admin_sensitive_change_audit() FROM PUBLIC, anon, authenticated;

GRANT EXECUTE ON FUNCTION public.gsa_collaborator_can_access_demand(uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.gsa_admin_get_pendency_counts_secure(uuid, text) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.gsa_admin_dashboard_snapshot(uuid, text) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.gsa_collaborator_dashboard_snapshot(uuid, text) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.gsa_collaborator_list_demands(uuid, text, integer) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.gsa_collaborator_demand_history(uuid, text, uuid, integer) TO authenticated, service_role;

COMMIT;
