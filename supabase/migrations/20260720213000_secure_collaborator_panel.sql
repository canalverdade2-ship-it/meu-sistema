-- Segurança central do Painel do Colaborador
CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE OR REPLACE FUNCTION public.gsa_current_actor_type()
RETURNS text
LANGUAGE sql
STABLE
AS $$
  SELECT COALESCE(auth.jwt() -> 'app_metadata' ->> 'gsa_actor_type', '');
$$;

CREATE OR REPLACE FUNCTION public.gsa_current_actor_id()
RETURNS uuid
LANGUAGE plpgsql
STABLE
AS $$
DECLARE
  raw_id text := auth.jwt() -> 'app_metadata' ->> 'gsa_actor_id';
BEGIN
  IF raw_id IS NULL OR raw_id = '' THEN RETURN NULL; END IF;
  RETURN raw_id::uuid;
EXCEPTION WHEN invalid_text_representation THEN
  RETURN NULL;
END;
$$;

CREATE OR REPLACE FUNCTION public.gsa_collaborator_has_module(p_module text)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO public, pg_temp
AS $$
  SELECT CASE
    WHEN public.gsa_current_actor_type() = 'admin' THEN true
    WHEN public.gsa_current_actor_type() <> 'colaborador' THEN false
    ELSE EXISTS (
      SELECT 1
      FROM public.colaboradores c
      LEFT JOIN public.colaborador_modulos cm ON cm.colaborador_id = c.id
      WHERE c.id = public.gsa_current_actor_id()
        AND c.status = 'ativo'
        AND (
          cm.modulo_id = p_module
          OR (p_module = 'catalogo' AND cm.modulo_id = 'cadastro')
          OR (p_module IN ('operacoes','loja','classificados','viagens','saude','seguros') AND cm.modulo_id = 'vendas')
          OR (p_module = 'atendimento' AND cm.modulo_id = 'tickets')
          OR (p_module = 'fidelidade' AND cm.modulo_id IN ('cadastro','area_vip','promocoes'))
          OR (p_module = 'promocoes' AND cm.modulo_id IN ('vendas','area_vip','promocoes'))
        )
    )
  END;
$$;

REVOKE ALL ON FUNCTION public.gsa_current_actor_type() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.gsa_current_actor_id() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.gsa_collaborator_has_module(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.gsa_current_actor_type() TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.gsa_current_actor_id() TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.gsa_collaborator_has_module(text) TO authenticated, service_role;

CREATE TABLE IF NOT EXISTS public.notificacao_leituras_colaborador (
  notificacao_id uuid NOT NULL REFERENCES public.notificacoes(id) ON DELETE CASCADE,
  colaborador_id uuid NOT NULL REFERENCES public.colaboradores(id) ON DELETE CASCADE,
  lida boolean NOT NULL DEFAULT false,
  ocultada boolean NOT NULL DEFAULT false,
  atualizado_em timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (notificacao_id, colaborador_id)
);
ALTER TABLE public.notificacao_leituras_colaborador ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS collaborator_notification_receipts_own ON public.notificacao_leituras_colaborador;
CREATE POLICY collaborator_notification_receipts_own ON public.notificacao_leituras_colaborador
FOR ALL TO authenticated
USING (public.gsa_current_actor_type() = 'admin' OR colaborador_id = public.gsa_current_actor_id())
WITH CHECK (public.gsa_current_actor_type() = 'admin' OR colaborador_id = public.gsa_current_actor_id());

CREATE OR REPLACE FUNCTION public.gsa_get_collaborator_session_access_state(
  p_sessao_id uuid,
  p_session_token text
)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO public, pg_temp
AS $$
DECLARE
  actor_id uuid := public.gsa_current_actor_id();
  result jsonb;
BEGIN
  IF public.gsa_current_actor_type() <> 'colaborador' OR actor_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'not_collaborator');
  END IF;
  SELECT jsonb_build_object(
    'success', true,
    'id', c.id,
    'nome', c.nome,
    'status', c.status,
    'modulos', COALESCE(jsonb_agg(cm.modulo_id) FILTER (WHERE cm.modulo_id IS NOT NULL), '[]'::jsonb)
  ) INTO result
  FROM public.colaboradores c
  LEFT JOIN public.colaborador_modulos cm ON cm.colaborador_id = c.id
  WHERE c.id = actor_id
  GROUP BY c.id, c.nome, c.status;
  RETURN COALESCE(result, jsonb_build_object('success', false, 'error', 'not_found'));
END;
$$;
REVOKE ALL ON FUNCTION public.gsa_get_collaborator_session_access_state(uuid, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.gsa_get_collaborator_session_access_state(uuid, text) TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.gsa_admin_replace_collaborator_modules(
  p_sessao_id uuid,
  p_session_token text,
  p_colaborador_id uuid,
  p_modulos text[]
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO public, pg_temp
AS $$
BEGIN
  IF public.gsa_current_actor_type() <> 'admin'
     AND NOT public.gsa_collaborator_has_module('acessos') THEN
    RAISE EXCEPTION 'Acesso negado' USING ERRCODE = '42501';
  END IF;

  DELETE FROM public.colaborador_modulos WHERE colaborador_id = p_colaborador_id;
  INSERT INTO public.colaborador_modulos (colaborador_id, modulo_id)
  SELECT p_colaborador_id, module_id
  FROM unnest(COALESCE(p_modulos, ARRAY[]::text[])) AS module_id
  WHERE module_id <> ''
  ON CONFLICT DO NOTHING;

  RETURN jsonb_build_object('success', true);
END;
$$;
REVOKE ALL ON FUNCTION public.gsa_admin_replace_collaborator_modules(uuid, text, uuid, text[]) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.gsa_admin_replace_collaborator_modules(uuid, text, uuid, text[]) TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.gsa_close_collaborator_sessions(p_colaborador_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO public, pg_temp
AS $$
BEGIN
  IF to_regclass('public.sistema_sessoes') IS NULL THEN RETURN; END IF;
  BEGIN
    EXECUTE 'UPDATE public.sistema_sessoes SET status = ''encerrado'' WHERE ator_tipo = ''colaborador'' AND ator_id = $1 AND status <> ''encerrado''' USING p_colaborador_id;
  EXCEPTION WHEN undefined_column THEN
    BEGIN
      EXECUTE 'UPDATE public.sistema_sessoes SET status = ''encerrado'' WHERE usuario_tipo = ''colaborador'' AND usuario_id = $1 AND status <> ''encerrado''' USING p_colaborador_id;
    EXCEPTION WHEN undefined_column THEN NULL;
    END;
  END;
END;
$$;

CREATE OR REPLACE FUNCTION public.gsa_revoke_collaborator_session_on_status()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO public, pg_temp
AS $$
BEGIN
  IF NEW.status IS DISTINCT FROM OLD.status AND NEW.status <> 'ativo' THEN
    PERFORM public.gsa_close_collaborator_sessions(NEW.id);
  END IF;
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS trg_revoke_collaborator_status ON public.colaboradores;
CREATE TRIGGER trg_revoke_collaborator_status
AFTER UPDATE OF status ON public.colaboradores
FOR EACH ROW EXECUTE FUNCTION public.gsa_revoke_collaborator_session_on_status();

CREATE OR REPLACE FUNCTION public.gsa_revoke_collaborator_session_on_modules()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO public, pg_temp
AS $$
BEGIN
  PERFORM public.gsa_close_collaborator_sessions(COALESCE(NEW.colaborador_id, OLD.colaborador_id));
  RETURN COALESCE(NEW, OLD);
END;
$$;
DROP TRIGGER IF EXISTS trg_revoke_collaborator_modules ON public.colaborador_modulos;
CREATE TRIGGER trg_revoke_collaborator_modules
AFTER INSERT OR UPDATE OR DELETE ON public.colaborador_modulos
FOR EACH ROW EXECUTE FUNCTION public.gsa_revoke_collaborator_session_on_modules();

DO $$
DECLARE
  item record;
  policy_name text;
BEGIN
  FOR item IN SELECT * FROM (VALUES
    ('clientes','cadastro'), ('prestadores','cadastro'), ('cliente_documentos','cadastro'), ('prestador_documentos','cadastro'),
    ('indicacoes','cadastro'), ('vouchers','cadastro'), ('cliente_premios','cadastro'),
    ('servicos','catalogo'), ('produtos','catalogo'), ('assinaturas','catalogo'), ('categorias','catalogo'), ('categorias_loja','catalogo'),
    ('orcamentos','operacoes'), ('ordens_servico','operacoes'), ('ordens_compra','operacoes'), ('ordens_assinatura','operacoes'),
    ('loja_solicitacoes','operacoes'), ('loja_avaliacoes','operacoes'), ('loja_credito_solicitacoes','operacoes'), ('loja_credito_documentos','operacoes'),
    ('faturas','financeiro'), ('saques','financeiro'), ('transferencias','financeiro'), ('prestador_saques','financeiro'), ('emprestimos','financeiro'),
    ('cobrancas','cobranca'), ('tickets','atendimento'), ('ticket_mensagens','atendimento'), ('ordens_fiscais','fiscal'),
    ('solicitacoes_exclusao','acessos'), ('sistema_sessoes','acessos'), ('sistema_logs','acessos')
  ) AS mapping(table_name, module_name)
  LOOP
    IF to_regclass('public.' || item.table_name) IS NULL THEN CONTINUE; END IF;
    policy_name := 'collaborator_module_guard_' || item.table_name;
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', item.table_name);
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', policy_name, item.table_name);
    EXECUTE format(
      'CREATE POLICY %I ON public.%I AS RESTRICTIVE FOR ALL TO authenticated USING (public.gsa_current_actor_type() <> ''colaborador'' OR public.gsa_collaborator_has_module(%L)) WITH CHECK (public.gsa_current_actor_type() <> ''colaborador'' OR public.gsa_collaborator_has_module(%L))',
      policy_name, item.table_name, item.module_name, item.module_name
    );
  END LOOP;
END;
$$;

ALTER TABLE public.colaboradores ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS collaborator_self_or_access_read ON public.colaboradores;
CREATE POLICY collaborator_self_or_access_read ON public.colaboradores AS RESTRICTIVE
FOR SELECT TO authenticated
USING (public.gsa_current_actor_type() <> 'colaborador' OR id = public.gsa_current_actor_id() OR public.gsa_collaborator_has_module('acessos'));
DROP POLICY IF EXISTS collaborator_access_write ON public.colaboradores;
DROP POLICY IF EXISTS collaborator_access_insert ON public.colaboradores;
DROP POLICY IF EXISTS collaborator_access_update ON public.colaboradores;
DROP POLICY IF EXISTS collaborator_access_delete ON public.colaboradores;
CREATE POLICY collaborator_access_insert ON public.colaboradores AS RESTRICTIVE
FOR INSERT TO authenticated
WITH CHECK (public.gsa_current_actor_type() <> 'colaborador' OR public.gsa_collaborator_has_module('acessos'));
CREATE POLICY collaborator_access_update ON public.colaboradores AS RESTRICTIVE
FOR UPDATE TO authenticated
USING (public.gsa_current_actor_type() <> 'colaborador' OR public.gsa_collaborator_has_module('acessos'))
WITH CHECK (public.gsa_current_actor_type() <> 'colaborador' OR public.gsa_collaborator_has_module('acessos'));
CREATE POLICY collaborator_access_delete ON public.colaboradores AS RESTRICTIVE
FOR DELETE TO authenticated
USING (public.gsa_current_actor_type() <> 'colaborador' OR public.gsa_collaborator_has_module('acessos'));

ALTER TABLE public.colaborador_modulos ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS collaborator_modules_read ON public.colaborador_modulos;
CREATE POLICY collaborator_modules_read ON public.colaborador_modulos AS RESTRICTIVE
FOR SELECT TO authenticated
USING (public.gsa_current_actor_type() <> 'colaborador' OR colaborador_id = public.gsa_current_actor_id() OR public.gsa_collaborator_has_module('acessos'));
DROP POLICY IF EXISTS collaborator_modules_write ON public.colaborador_modulos;
DROP POLICY IF EXISTS collaborator_modules_insert ON public.colaborador_modulos;
DROP POLICY IF EXISTS collaborator_modules_update ON public.colaborador_modulos;
DROP POLICY IF EXISTS collaborator_modules_delete ON public.colaborador_modulos;
CREATE POLICY collaborator_modules_insert ON public.colaborador_modulos AS RESTRICTIVE
FOR INSERT TO authenticated
WITH CHECK (public.gsa_current_actor_type() <> 'colaborador' OR public.gsa_collaborator_has_module('acessos'));
CREATE POLICY collaborator_modules_update ON public.colaborador_modulos AS RESTRICTIVE
FOR UPDATE TO authenticated
USING (public.gsa_current_actor_type() <> 'colaborador' OR public.gsa_collaborator_has_module('acessos'))
WITH CHECK (public.gsa_current_actor_type() <> 'colaborador' OR public.gsa_collaborator_has_module('acessos'));
CREATE POLICY collaborator_modules_delete ON public.colaborador_modulos AS RESTRICTIVE
FOR DELETE TO authenticated
USING (public.gsa_current_actor_type() <> 'colaborador' OR public.gsa_collaborator_has_module('acessos'));

ALTER TABLE public.admin_notificacoes ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS collaborator_cannot_access_admin_notifications ON public.admin_notificacoes;
CREATE POLICY collaborator_cannot_access_admin_notifications ON public.admin_notificacoes AS RESTRICTIVE
FOR ALL TO authenticated
USING (public.gsa_current_actor_type() <> 'colaborador')
WITH CHECK (public.gsa_current_actor_type() <> 'colaborador');

ALTER TABLE public.notificacoes ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS collaborator_notification_visibility ON public.notificacoes;
CREATE POLICY collaborator_notification_visibility ON public.notificacoes AS RESTRICTIVE
FOR SELECT TO authenticated
USING (
  public.gsa_current_actor_type() <> 'colaborador'
  OR destinatario_tipo = 'broadcast_todos'
  OR (destinatario_tipo = 'colaborador' AND colaborador_id = public.gsa_current_actor_id())
);
DROP POLICY IF EXISTS collaborator_notification_mutation ON public.notificacoes;
CREATE POLICY collaborator_notification_mutation ON public.notificacoes AS RESTRICTIVE
FOR UPDATE TO authenticated
USING (public.gsa_current_actor_type() <> 'colaborador' OR (destinatario_tipo = 'colaborador' AND colaborador_id = public.gsa_current_actor_id()))
WITH CHECK (public.gsa_current_actor_type() <> 'colaborador' OR (destinatario_tipo = 'colaborador' AND colaborador_id = public.gsa_current_actor_id()));

ALTER TABLE public.prestador_demandas ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS collaborator_assigned_demands_only ON public.prestador_demandas;
CREATE POLICY collaborator_assigned_demands_only ON public.prestador_demandas AS RESTRICTIVE
FOR ALL TO authenticated
USING (
  public.gsa_current_actor_type() <> 'colaborador'
  OR public.gsa_collaborator_has_module('operacoes')
  OR (public.gsa_collaborator_has_module('demandas') AND colaborador_id = public.gsa_current_actor_id())
)
WITH CHECK (
  public.gsa_current_actor_type() <> 'colaborador'
  OR public.gsa_collaborator_has_module('operacoes')
  OR (public.gsa_collaborator_has_module('demandas') AND colaborador_id = public.gsa_current_actor_id())
);
