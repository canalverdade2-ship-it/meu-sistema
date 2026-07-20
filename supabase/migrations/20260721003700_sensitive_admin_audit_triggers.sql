BEGIN;

CREATE OR REPLACE FUNCTION public.gsa_admin_sensitive_change_audit()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_claims jsonb := COALESCE(auth.jwt(), '{}'::jsonb);
  v_actor_type text := COALESCE(v_claims -> 'app_metadata' ->> 'gsa_actor_type', '');
  v_row jsonb;
  v_old jsonb := CASE WHEN TG_OP = 'INSERT' THEN '{}'::jsonb ELSE to_jsonb(OLD) END;
  v_new jsonb := CASE WHEN TG_OP = 'DELETE' THEN '{}'::jsonb ELSE to_jsonb(NEW) END;
  v_target_id uuid;
  v_module text;
BEGIN
  IF v_actor_type NOT IN ('admin', 'colaborador') THEN
    RETURN CASE WHEN TG_OP = 'DELETE' THEN OLD ELSE NEW END;
  END IF;

  PERFORM public.gsa_admin_context();
  v_row := CASE WHEN TG_OP = 'DELETE' THEN v_old ELSE v_new END;

  BEGIN
    v_target_id := nullif(v_row ->> 'id', '')::uuid;
  EXCEPTION WHEN invalid_text_representation THEN
    v_target_id := NULL;
  END;

  v_module := CASE TG_TABLE_NAME
    WHEN 'clientes' THEN 'cadastro'
    WHEN 'prestadores' THEN 'cadastro'
    WHEN 'cliente_documentos' THEN 'cadastro'
    WHEN 'prestador_documentos' THEN 'cadastro'
    WHEN 'servicos' THEN 'catalogo'
    WHEN 'produtos' THEN 'catalogo'
    WHEN 'assinaturas' THEN 'catalogo'
    WHEN 'orcamentos' THEN 'operacoes'
    WHEN 'ordens_servico' THEN 'operacoes'
    WHEN 'prestador_demandas' THEN 'operacoes'
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

  PERFORM public.gsa_admin_write_audit(
    v_module,
    TG_OP || '_' || upper(TG_TABLE_NAME),
    TG_TABLE_NAME,
    v_target_id,
    jsonb_strip_nulls(jsonb_build_object(
      'old_status', v_old ->> 'status',
      'new_status', v_new ->> 'status',
      'old_emission_status', v_old ->> 'status_emissao',
      'new_emission_status', v_new ->> 'status_emissao'
    ))
  );

  RETURN CASE WHEN TG_OP = 'DELETE' THEN OLD ELSE NEW END;
END;
$$;

DO $attach_triggers$
DECLARE
  v_table text;
  v_trigger text;
BEGIN
  FOREACH v_table IN ARRAY ARRAY[
    'clientes','prestadores','cliente_documentos','prestador_documentos',
    'servicos','produtos','assinaturas','orcamentos','ordens_servico','prestador_demandas',
    'classificados_anuncios','classificados_mensagens',
    'viagens_orcamentos','viagens_pacotes','viagens_propostas','viagens_reservas',
    'saude_parceiros','saude_produtos','saude_cotacoes','saude_propostas','saude_contratos',
    'seguros_parceiros','seguros_produtos','seguros_cotacoes','seguros_propostas','seguros_apolices',
    'tickets','ticket_mensagens','faturas','saques','transferencias','cobrancas',
    'cobranca_acordo_parcelas','ordens_fiscais','emprestimos','emprestimo_documentos',
    'loja_credito_solicitacoes','loja_credito_movimentacoes','empresa','formas_pagamento',
    'system_settings','colaboradores','colaborador_modulos'
  ]::text[] LOOP
    IF to_regclass(format('public.%I', v_table)) IS NULL THEN
      CONTINUE;
    END IF;

    v_trigger := left('trg_gsa_admin_audit_' || v_table, 63);
    EXECUTE format('DROP TRIGGER IF EXISTS %I ON public.%I', v_trigger, v_table);
    EXECUTE format(
      'CREATE TRIGGER %I AFTER INSERT OR UPDATE OR DELETE ON public.%I FOR EACH ROW EXECUTE FUNCTION public.gsa_admin_sensitive_change_audit()',
      v_trigger,
      v_table
    );
  END LOOP;
END;
$attach_triggers$;

REVOKE ALL ON FUNCTION public.gsa_admin_sensitive_change_audit() FROM PUBLIC, anon, authenticated;

COMMIT;
