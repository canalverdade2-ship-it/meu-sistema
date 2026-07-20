BEGIN;

CREATE OR REPLACE FUNCTION public.gsa_admin_restrict_collaborator_to_module(p_module text)
RETURNS boolean
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_type text := COALESCE(auth.jwt() -> 'app_metadata' ->> 'gsa_actor_type', '');
BEGIN
  -- As políticas permissivas existentes continuam governando clientes,
  -- prestadores e administradores. Esta função acrescenta uma fronteira
  -- restritiva somente aos colaboradores administrativos.
  IF v_type <> 'colaborador' THEN
    RETURN true;
  END IF;

  RETURN public.gsa_admin_has_module(p_module);
END;
$$;

REVOKE ALL ON FUNCTION public.gsa_admin_restrict_collaborator_to_module(text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.gsa_admin_restrict_collaborator_to_module(text) TO authenticated, service_role;

DO $policies$
DECLARE
  v_item record;
  v_policy_name text;
BEGIN
  FOR v_item IN
    SELECT * FROM (VALUES
      ('clientes', 'cadastro'),
      ('prestadores', 'cadastro'),
      ('cliente_documentos', 'cadastro'),
      ('prestador_documentos', 'cadastro'),
      ('servicos', 'catalogo'),
      ('produtos', 'catalogo'),
      ('assinaturas', 'catalogo'),
      ('categorias_loja', 'catalogo'),
      ('orcamentos', 'operacoes'),
      ('ordens_servico', 'operacoes'),
      ('prestador_demandas', 'operacoes'),
      ('ordens_compra', 'operacoes'),
      ('ordens_assinatura', 'operacoes'),
      ('classificados_anuncios', 'classificados'),
      ('classificados_mensagens', 'classificados'),
      ('classificados_propostas', 'classificados'),
      ('classificados_transacoes', 'classificados'),
      ('viagens_orcamentos', 'viagens'),
      ('viagens_pacotes', 'viagens'),
      ('viagens_propostas', 'viagens'),
      ('viagens_reservas', 'viagens'),
      ('viagens_transacoes', 'viagens'),
      ('saude_parceiros', 'saude'),
      ('saude_produtos', 'saude'),
      ('saude_cotacoes', 'saude'),
      ('saude_propostas', 'saude'),
      ('saude_contratos', 'saude'),
      ('saude_assessorias', 'saude'),
      ('saude_comissoes', 'saude'),
      ('saude_documentos', 'saude'),
      ('saude_atendimentos', 'saude'),
      ('seguros_parceiros', 'seguros'),
      ('seguros_produtos', 'seguros'),
      ('seguros_cotacoes', 'seguros'),
      ('seguros_propostas', 'seguros'),
      ('seguros_apolices', 'seguros'),
      ('seguros_assessorias', 'seguros'),
      ('seguros_comissoes', 'seguros'),
      ('seguros_documentos', 'seguros'),
      ('seguros_assistencias', 'seguros'),
      ('seguros_sinistros', 'seguros'),
      ('seguros_atendimentos', 'seguros'),
      ('indicacoes', 'fidelidade'),
      ('vouchers', 'promocoes'),
      ('premios', 'promocoes'),
      ('cliente_promocoes', 'promocoes'),
      ('promocoes_quantidade', 'promocoes'),
      ('tickets', 'atendimento'),
      ('ticket_mensagens', 'atendimento'),
      ('faturas', 'financeiro'),
      ('saques', 'financeiro'),
      ('transferencias', 'financeiro'),
      ('movimentacoes_carteira', 'financeiro'),
      ('cobrancas', 'cobranca'),
      ('cobranca_historico', 'cobranca'),
      ('cobranca_acordo_parcelas', 'cobranca'),
      ('ordens_fiscais', 'fiscal'),
      ('emprestimos', 'emprestimos'),
      ('emprestimo_historico', 'emprestimos'),
      ('emprestimo_comentarios', 'emprestimos'),
      ('emprestimo_parcelas', 'emprestimos'),
      ('emprestimo_documentos', 'emprestimos'),
      ('loja_credito_solicitacoes', 'credito_loja'),
      ('loja_credito_movimentacoes', 'credito_loja'),
      ('empresa', 'configuracoes'),
      ('system_settings', 'configuracoes'),
      ('formas_pagamento', 'configuracoes'),
      ('colaboradores', 'acessos'),
      ('colaborador_modulos', 'acessos'),
      ('funcoes', 'acessos'),
      ('solicitacoes_exclusao', 'acessos'),
      ('sistema_sessoes', 'acessos'),
      ('sistema_logs', 'acessos'),
      ('admin_notificacoes', 'dashboard')
    ) AS mapping(table_name, module_name)
  LOOP
    IF to_regclass(format('public.%I', v_item.table_name)) IS NULL THEN
      CONTINUE;
    END IF;

    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', v_item.table_name);
    v_policy_name := left('gsa_collaborator_module_' || v_item.table_name, 63);
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', v_policy_name, v_item.table_name);
    EXECUTE format(
      'CREATE POLICY %I ON public.%I AS RESTRICTIVE FOR ALL TO authenticated USING (public.gsa_admin_restrict_collaborator_to_module(%L)) WITH CHECK (public.gsa_admin_restrict_collaborator_to_module(%L))',
      v_policy_name,
      v_item.table_name,
      v_item.module_name,
      v_item.module_name
    );
  END LOOP;
END;
$policies$;

-- A identidade de logs administrativos não pode ser escolhida pelo navegador.
CREATE OR REPLACE FUNCTION public.gsa_enforce_admin_log_identity()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_type text := COALESCE(auth.jwt() -> 'app_metadata' ->> 'gsa_actor_type', '');
  v_context jsonb;
BEGIN
  IF v_type IN ('admin', 'colaborador') THEN
    v_context := public.gsa_admin_context();
    NEW.ator_tipo := v_context ->> 'actor_type';
    NEW.ator_id := (v_context ->> 'actor_id')::uuid;
    NEW.ator_nome := COALESCE(v_context ->> 'actor_name', NEW.ator_nome, 'Administrador');
  END IF;
  RETURN NEW;
END;
$$;

DO $log_trigger$
BEGIN
  IF to_regclass('public.sistema_logs') IS NOT NULL THEN
    DROP TRIGGER IF EXISTS trg_gsa_enforce_admin_log_identity ON public.sistema_logs;
    CREATE TRIGGER trg_gsa_enforce_admin_log_identity
    BEFORE INSERT ON public.sistema_logs
    FOR EACH ROW EXECUTE FUNCTION public.gsa_enforce_admin_log_identity();
  END IF;
END;
$log_trigger$;

-- As tabelas internas de auditoria permanecem inacessíveis por CRUD direto.
REVOKE ALL ON public.gsa_admin_audit_events FROM anon, authenticated;
REVOKE ALL ON public.gsa_admin_notification_state FROM anon, authenticated;

COMMIT;
