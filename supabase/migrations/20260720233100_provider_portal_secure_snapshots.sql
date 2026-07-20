BEGIN;

CREATE OR REPLACE FUNCTION public.gsa_provider_pendency_snapshot()
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_context jsonb := public.gsa_provider_context(false);
  v_provider_id uuid := (v_context ->> 'provider_id')::uuid;
  v_source jsonb := '{}'::jsonb;
  v_novas integer := 0;
  v_negociacao integer := 0;
  v_ativas integer := 0;
BEGIN
  BEGIN
    SELECT COALESCE(jsonb_agg(to_jsonb(source_row)) -> 0, '{}'::jsonb)
      INTO v_source
      FROM public.get_provider_pendency_counts(v_provider_id) AS source_row;
  EXCEPTION WHEN undefined_function OR datatype_mismatch OR cannot_coerce THEN
    v_source := '{}'::jsonb;
  END;

  SELECT
    count(*) FILTER (WHERE status IN ('aguardando_aceite', 'aberta')),
    count(*) FILTER (WHERE status IN ('em_negociacao', 'contraproposta_prestador', 'contraproposta_admin_final')),
    count(*) FILTER (WHERE status IN ('ativa', 'em_analise', 'em_ajuste'))
  INTO v_novas, v_negociacao, v_ativas
  FROM public.prestador_demandas
  WHERE prestador_id = v_provider_id;

  RETURN jsonb_build_object(
    'success', true,
    'demandas_novas', v_novas,
    'demandas_negociacao', v_negociacao,
    'demandas_pendentes', v_novas + v_negociacao,
    'demandas_em_execucao', v_ativas,
    'servicos_ativos', COALESCE((v_source ->> 'servicos_ativos')::integer, 0),
    'financeiro_saques_pendentes', COALESCE((v_source ->> 'financeiro_saques_pendentes')::integer, 0),
    'vouchers_ativos', COALESCE((v_source ->> 'vouchers_ativos')::integer, 0),
    'suporte_tickets_ativos', COALESCE((v_source ->> 'suporte_tickets_ativos')::integer, 0),
    'suporte_mensagens_nao_lidas', COALESCE((v_source ->> 'suporte_mensagens_nao_lidas')::integer, 0),
    'promocoes_ativas', COALESCE((v_source ->> 'promocoes_ativas')::integer, 0),
    'moduleDemandas', v_novas + v_negociacao + v_ativas,
    'moduleDemandasAbertas', v_novas + v_negociacao,
    'moduleDemandasAtivas', v_ativas,
    'moduleAgenda', COALESCE((v_source ->> 'agendamentos_pendentes')::integer, 0),
    'moduleFinanceiro', COALESCE((v_source ->> 'financeiro_saques_pendentes')::integer, 0),
    'moduleVouchers', COALESCE((v_source ->> 'vouchers_ativos')::integer, 0),
    'moduleSuporte', COALESCE((v_source ->> 'suporte_tickets_ativos')::integer, 0) + COALESCE((v_source ->> 'suporte_mensagens_nao_lidas')::integer, 0),
    'moduleDocumentos', COALESCE((v_source ->> 'documentos_pendentes')::integer, 0),
    'modulePremios', COALESCE((v_source ->> 'premios_pendentes')::integer, 0),
    'modulePromocoes', COALESCE((v_source ->> 'promocoes_ativas')::integer, 0),
    'total', (v_novas + v_negociacao)
      + COALESCE((v_source ->> 'agendamentos_pendentes')::integer, 0)
      + COALESCE((v_source ->> 'financeiro_saques_pendentes')::integer, 0)
      + COALESCE((v_source ->> 'suporte_tickets_ativos')::integer, 0)
      + COALESCE((v_source ->> 'suporte_mensagens_nao_lidas')::integer, 0)
      + COALESCE((v_source ->> 'documentos_pendentes')::integer, 0)
      + COALESCE((v_source ->> 'premios_pendentes')::integer, 0)
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.gsa_provider_pendency_snapshot() TO authenticated;

COMMIT;
