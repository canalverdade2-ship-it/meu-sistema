BEGIN;

-- Centraliza a identidade e as permissões do colaborador na relação
-- colaborador_modulos. A coluna legada colaboradores.modulos continua sendo
-- sincronizada apenas para compatibilidade com instalações anteriores.
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
  v_id uuid;
  v_status text;
  v_modules jsonb := '[]'::jsonb;
BEGIN
  IF v_type NOT IN ('admin', 'colaborador') OR v_id_text = '' THEN
    RAISE EXCEPTION 'Sessão administrativa inválida ou expirada.' USING ERRCODE = '42501';
  END IF;
  BEGIN
    v_id := v_id_text::uuid;
  EXCEPTION WHEN invalid_text_representation THEN
    RAISE EXCEPTION 'Identidade administrativa inválida.' USING ERRCODE = '42501';
  END;
  IF v_type = 'colaborador' THEN
    SELECT c.status,
           COALESCE(jsonb_agg(DISTINCT cm.modulo_id) FILTER (WHERE cm.modulo_id IS NOT NULL), '[]'::jsonb)
      INTO v_status, v_modules
      FROM public.colaboradores c
      LEFT JOIN public.colaborador_modulos cm ON cm.colaborador_id = c.id
     WHERE c.id = v_id
     GROUP BY c.id, c.status;
    IF v_status IS NULL OR v_status <> 'ativo' THEN
      RAISE EXCEPTION 'Acesso do colaborador revogado.' USING ERRCODE = '42501';
    END IF;
  END IF;
  RETURN jsonb_build_object('actor_type', v_type, 'actor_id', v_id, 'modules', COALESCE(v_modules, '[]'::jsonb));
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
  v_aliases text[];
BEGIN
  IF v_context ->> 'actor_type' = 'admin' THEN RETURN true; END IF;
  IF p_module = 'dashboard' THEN RETURN true; END IF;
  v_aliases := CASE p_module
    WHEN 'cadastro' THEN ARRAY['cadastro']
    WHEN 'prestadores' THEN ARRAY['prestadores', 'cadastro']
    WHEN 'catalogo' THEN ARRAY['catalogo', 'cadastro']
    WHEN 'operacoes' THEN ARRAY['operacoes', 'vendas']
    WHEN 'vendas' THEN ARRAY['vendas']
    WHEN 'demandas' THEN ARRAY['demandas']
    WHEN 'loja' THEN ARRAY['loja', 'vendas']
    WHEN 'classificados' THEN ARRAY['classificados', 'loja', 'vendas']
    WHEN 'viagens' THEN ARRAY['viagens', 'loja', 'vendas']
    WHEN 'saude' THEN ARRAY['saude', 'loja', 'vendas']
    WHEN 'seguros' THEN ARRAY['seguros', 'loja', 'vendas']
    WHEN 'financeiro' THEN ARRAY['financeiro']
    WHEN 'cobranca' THEN ARRAY['cobranca']
    WHEN 'fiscal' THEN ARRAY['fiscal']
    WHEN 'fidelidade' THEN ARRAY['fidelidade', 'cadastro', 'area_vip', 'promocoes']
    WHEN 'atendimento' THEN ARRAY['atendimento', 'tickets', 'suporte']
    WHEN 'relatorios' THEN ARRAY['relatorios']
    WHEN 'configuracoes' THEN ARRAY['configuracoes']
    WHEN 'acessos' THEN ARRAY['acessos']
    WHEN 'sistema' THEN ARRAY['sistema']
    WHEN 'promocoes' THEN ARRAY['promocoes', 'area_vip', 'vendas']
    WHEN 'area_vip' THEN ARRAY['area_vip']
    ELSE ARRAY[p_module]
  END;
  RETURN EXISTS (
    SELECT 1 FROM jsonb_array_elements_text(COALESCE(v_context -> 'modules', '[]'::jsonb)) AS granted(value)
    WHERE granted.value = ANY(v_aliases)
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.gsa_current_actor_type()
RETURNS text LANGUAGE sql STABLE AS $$
  SELECT COALESCE(auth.jwt() -> 'app_metadata' ->> 'gsa_actor_type', '');
$$;

CREATE OR REPLACE FUNCTION public.gsa_current_actor_id()
RETURNS uuid LANGUAGE plpgsql STABLE AS $$
DECLARE v_raw text := auth.jwt() -> 'app_metadata' ->> 'gsa_actor_id';
BEGIN
  IF v_raw IS NULL OR v_raw = '' THEN RETURN NULL; END IF;
  RETURN v_raw::uuid;
EXCEPTION WHEN invalid_text_representation THEN RETURN NULL;
END;
$$;

CREATE OR REPLACE FUNCTION public.gsa_collaborator_has_module(p_module text)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public, pg_temp AS $$
  SELECT CASE
    WHEN public.gsa_current_actor_type() = 'admin' THEN true
    WHEN public.gsa_current_actor_type() <> 'colaborador' THEN false
    ELSE public.gsa_admin_has_module(p_module)
  END;
$$;

REVOKE ALL ON FUNCTION public.gsa_current_actor_type() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.gsa_current_actor_id() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.gsa_collaborator_has_module(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.gsa_current_actor_type() TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.gsa_current_actor_id() TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.gsa_collaborator_has_module(text) TO authenticated, service_role;

ALTER TABLE public.colaboradores ADD COLUMN IF NOT EXISTS credencial_hash text;

CREATE OR REPLACE FUNCTION public.gsa_hash_collaborator_credential()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, extensions, pg_temp AS $$
BEGIN
  IF (TG_OP = 'INSERT' OR NEW.credencial_acesso IS DISTINCT FROM OLD.credencial_acesso)
     AND NULLIF(NEW.credencial_acesso, '') IS NOT NULL THEN
    NEW.credencial_hash := extensions.crypt(NEW.credencial_acesso, extensions.gen_salt('bf', 12));
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_hash_collaborator_credential ON public.colaboradores;
CREATE TRIGGER trg_hash_collaborator_credential
BEFORE INSERT OR UPDATE OF credencial_acesso ON public.colaboradores
FOR EACH ROW EXECUTE FUNCTION public.gsa_hash_collaborator_credential();

CREATE OR REPLACE FUNCTION public.gsa_get_collaborator_session_access_state(p_sessao_id uuid, p_session_token text)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE v_actor_id uuid := public.gsa_current_actor_id(); v_result jsonb;
BEGIN
  IF public.gsa_current_actor_type() <> 'colaborador' OR v_actor_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'not_collaborator');
  END IF;
  SELECT jsonb_build_object(
    'success', true, 'id', c.id, 'nome', c.nome, 'status', c.status,
    'modulos', COALESCE(jsonb_agg(DISTINCT cm.modulo_id) FILTER (WHERE cm.modulo_id IS NOT NULL), '[]'::jsonb)
  ) INTO v_result
  FROM public.colaboradores c
  LEFT JOIN public.colaborador_modulos cm ON cm.colaborador_id = c.id
  WHERE c.id = v_actor_id
  GROUP BY c.id, c.nome, c.status;
  RETURN COALESCE(v_result, jsonb_build_object('success', false, 'error', 'not_found'));
END;
$$;
REVOKE ALL ON FUNCTION public.gsa_get_collaborator_session_access_state(uuid, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.gsa_get_collaborator_session_access_state(uuid, text) TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.gsa_close_collaborator_sessions(p_colaborador_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
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
REVOKE ALL ON FUNCTION public.gsa_close_collaborator_sessions(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.gsa_close_collaborator_sessions(uuid) TO service_role;

CREATE OR REPLACE FUNCTION public.gsa_admin_replace_collaborator_modules(
  p_sessao_id uuid, p_session_token text, p_colaborador_id uuid, p_modulos text[]
)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE
  v_modules text[] := ARRAY(
    SELECT DISTINCT module_id FROM unnest(COALESCE(p_modulos, ARRAY[]::text[])) AS module_id
    WHERE module_id IS NOT NULL AND btrim(module_id) <> ''
  );
BEGIN
  PERFORM public.gsa_admin_assert_module('acessos');
  IF NOT EXISTS (SELECT 1 FROM public.colaboradores WHERE id = p_colaborador_id) THEN
    RAISE EXCEPTION 'Colaborador não encontrado.' USING ERRCODE = 'P0002';
  END IF;
  DELETE FROM public.colaborador_modulos WHERE colaborador_id = p_colaborador_id;
  INSERT INTO public.colaborador_modulos (colaborador_id, modulo_id)
  SELECT p_colaborador_id, module_id FROM unnest(v_modules) AS module_id ON CONFLICT DO NOTHING;
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'colaboradores' AND column_name = 'modulos') THEN
    EXECUTE 'UPDATE public.colaboradores SET modulos = $2::jsonb WHERE id = $1' USING p_colaborador_id, to_jsonb(v_modules);
  END IF;
  PERFORM public.gsa_close_collaborator_sessions(p_colaborador_id);
  PERFORM public.gsa_admin_write_audit('acessos', 'ATUALIZAR_PERMISSOES_COLABORADOR', 'colaborador', p_colaborador_id, jsonb_build_object('modulos', to_jsonb(v_modules)));
  RETURN jsonb_build_object('success', true, 'modulos', to_jsonb(v_modules));
END;
$$;
REVOKE ALL ON FUNCTION public.gsa_admin_replace_collaborator_modules(uuid, text, uuid, text[]) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.gsa_admin_replace_collaborator_modules(uuid, text, uuid, text[]) TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.gsa_revoke_collaborator_session_on_status()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
BEGIN
  IF NEW.status IS DISTINCT FROM OLD.status AND NEW.status <> 'ativo' THEN
    PERFORM public.gsa_close_collaborator_sessions(NEW.id);
  END IF;
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS trg_revoke_collaborator_status ON public.colaboradores;
CREATE TRIGGER trg_revoke_collaborator_status AFTER UPDATE OF status ON public.colaboradores
FOR EACH ROW EXECUTE FUNCTION public.gsa_revoke_collaborator_session_on_status();

CREATE OR REPLACE FUNCTION public.gsa_revoke_collaborator_session_on_modules()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
BEGIN
  PERFORM public.gsa_close_collaborator_sessions(COALESCE(NEW.colaborador_id, OLD.colaborador_id));
  RETURN COALESCE(NEW, OLD);
END;
$$;
DROP TRIGGER IF EXISTS trg_revoke_collaborator_modules ON public.colaborador_modulos;
CREATE TRIGGER trg_revoke_collaborator_modules AFTER INSERT OR UPDATE OR DELETE ON public.colaborador_modulos
FOR EACH ROW EXECUTE FUNCTION public.gsa_revoke_collaborator_session_on_modules();

DO $$
DECLARE v_item record; v_policy text;
BEGIN
  FOR v_item IN SELECT * FROM (VALUES
    ('clientes', 'cadastro'), ('cliente_documentos', 'cadastro'), ('indicacoes', 'cadastro'),
    ('vouchers', 'cadastro'), ('cliente_premios', 'cadastro'), ('prestadores', 'prestadores'),
    ('prestador_documentos', 'prestadores'), ('servicos', 'catalogo'), ('produtos', 'catalogo'),
    ('assinaturas', 'catalogo'), ('categorias', 'catalogo'), ('categorias_loja', 'catalogo'),
    ('orcamentos', 'operacoes'), ('ordens_servico', 'operacoes'), ('ordens_compra', 'operacoes'),
    ('ordens_assinatura', 'operacoes'), ('loja_solicitacoes', 'operacoes'), ('loja_avaliacoes', 'operacoes'),
    ('loja_credito_solicitacoes', 'operacoes'), ('loja_credito_documentos', 'operacoes'),
    ('faturas', 'financeiro'), ('saques', 'financeiro'), ('transferencias', 'financeiro'),
    ('prestador_saques', 'financeiro'), ('emprestimos', 'financeiro'), ('cobrancas', 'cobranca'),
    ('tickets', 'atendimento'), ('ticket_mensagens', 'atendimento'), ('ordens_fiscais', 'fiscal'),
    ('solicitacoes_exclusao', 'acessos')
  ) AS mapping(table_name, module_name)
  LOOP
    IF to_regclass('public.' || v_item.table_name) IS NULL THEN CONTINUE; END IF;
    v_policy := 'collaborator_module_guard_' || v_item.table_name;
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', v_item.table_name);
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', v_policy, v_item.table_name);
    EXECUTE format(
      'CREATE POLICY %I ON public.%I AS RESTRICTIVE FOR ALL TO authenticated USING (public.gsa_current_actor_type() <> ''colaborador'' OR public.gsa_collaborator_has_module(%L)) WITH CHECK (public.gsa_current_actor_type() <> ''colaborador'' OR public.gsa_collaborator_has_module(%L))',
      v_policy, v_item.table_name, v_item.module_name, v_item.module_name
    );
  END LOOP;
END;
$$;

ALTER TABLE public.colaboradores ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS collaborator_self_or_access_read ON public.colaboradores;
CREATE POLICY collaborator_self_or_access_read ON public.colaboradores AS RESTRICTIVE FOR SELECT TO authenticated
USING (public.gsa_current_actor_type() <> 'colaborador' OR id = public.gsa_current_actor_id() OR public.gsa_collaborator_has_module('acessos'));
DROP POLICY IF EXISTS collaborator_access_insert ON public.colaboradores;
CREATE POLICY collaborator_access_insert ON public.colaboradores AS RESTRICTIVE FOR INSERT TO authenticated
WITH CHECK (public.gsa_current_actor_type() <> 'colaborador' OR public.gsa_collaborator_has_module('acessos'));
DROP POLICY IF EXISTS collaborator_access_update ON public.colaboradores;
CREATE POLICY collaborator_access_update ON public.colaboradores AS RESTRICTIVE FOR UPDATE TO authenticated
USING (public.gsa_current_actor_type() <> 'colaborador' OR public.gsa_collaborator_has_module('acessos'))
WITH CHECK (public.gsa_current_actor_type() <> 'colaborador' OR public.gsa_collaborator_has_module('acessos'));
DROP POLICY IF EXISTS collaborator_access_delete ON public.colaboradores;
CREATE POLICY collaborator_access_delete ON public.colaboradores AS RESTRICTIVE FOR DELETE TO authenticated
USING (public.gsa_current_actor_type() <> 'colaborador' OR public.gsa_collaborator_has_module('acessos'));

ALTER TABLE public.colaborador_modulos ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS collaborator_modules_read ON public.colaborador_modulos;
CREATE POLICY collaborator_modules_read ON public.colaborador_modulos AS RESTRICTIVE FOR SELECT TO authenticated
USING (public.gsa_current_actor_type() <> 'colaborador' OR colaborador_id = public.gsa_current_actor_id() OR public.gsa_collaborator_has_module('acessos'));
DROP POLICY IF EXISTS collaborator_modules_insert ON public.colaborador_modulos;
CREATE POLICY collaborator_modules_insert ON public.colaborador_modulos AS RESTRICTIVE FOR INSERT TO authenticated
WITH CHECK (public.gsa_current_actor_type() <> 'colaborador' OR public.gsa_collaborator_has_module('acessos'));
DROP POLICY IF EXISTS collaborator_modules_update ON public.colaborador_modulos;
CREATE POLICY collaborator_modules_update ON public.colaborador_modulos AS RESTRICTIVE FOR UPDATE TO authenticated
USING (public.gsa_current_actor_type() <> 'colaborador' OR public.gsa_collaborator_has_module('acessos'))
WITH CHECK (public.gsa_current_actor_type() <> 'colaborador' OR public.gsa_collaborator_has_module('acessos'));
DROP POLICY IF EXISTS collaborator_modules_delete ON public.colaborador_modulos;
CREATE POLICY collaborator_modules_delete ON public.colaborador_modulos AS RESTRICTIVE FOR DELETE TO authenticated
USING (public.gsa_current_actor_type() <> 'colaborador' OR public.gsa_collaborator_has_module('acessos'));

ALTER TABLE public.admin_notificacoes ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS collaborator_cannot_access_admin_notifications ON public.admin_notificacoes;
CREATE POLICY collaborator_cannot_access_admin_notifications ON public.admin_notificacoes AS RESTRICTIVE FOR ALL TO authenticated
USING (public.gsa_current_actor_type() <> 'colaborador') WITH CHECK (public.gsa_current_actor_type() <> 'colaborador');

ALTER TABLE public.notificacoes ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS collaborator_notification_visibility ON public.notificacoes;
CREATE POLICY collaborator_notification_visibility ON public.notificacoes AS RESTRICTIVE FOR SELECT TO authenticated
USING (
  public.gsa_current_actor_type() <> 'colaborador'
  OR destinatario_tipo = 'broadcast_todos'
  OR (destinatario_tipo = 'colaborador' AND colaborador_id = public.gsa_current_actor_id())
);

ALTER TABLE public.prestador_demandas ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS collaborator_assigned_demands_only ON public.prestador_demandas;
CREATE POLICY collaborator_assigned_demands_only ON public.prestador_demandas AS RESTRICTIVE FOR ALL TO authenticated
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

COMMIT;
