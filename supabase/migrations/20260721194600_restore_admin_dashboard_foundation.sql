BEGIN;

-- Restaura somente os objetos ausentes da migration histórica 20260720183000.
-- As funções atuais de contexto, permissões, sanitização e compatibilidade são
-- preservadas; não reaplicamos a migration antiga para não sobrescrever os
-- endurecimentos administrativos posteriores.

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
  v_data jsonb := '{}'::jsonb;
BEGIN
  PERFORM public.gsa_admin_context();

  BEGIN
    EXECUTE 'SELECT public.get_admin_pendency_counts()::jsonb' INTO v_data;
  EXCEPTION WHEN undefined_function OR datatype_mismatch OR cannot_coerce THEN
    v_data := '{}'::jsonb;
  END;

  v_data := COALESCE(v_data, '{}'::jsonb);

  IF NOT public.gsa_admin_has_module('cadastro') THEN
    v_data := v_data || jsonb_build_object(
      'cadastro_clientes_inativos', 0,
      'cadastro_clientes_bloqueados', 0,
      'cadastro_clientes_pendentes', 0,
      'cadastro_docs_pendentes', 0,
      'cadastro_cliente_docs_pendentes', 0,
      'cadastro_vouchers_pendentes', 0,
      'cadastro_premios_pendentes', 0
    );
  END IF;

  IF NOT (public.gsa_admin_has_module('cadastro') OR public.gsa_admin_has_module('prestadores')) THEN
    v_data := v_data || jsonb_build_object(
      'cadastro_prestadores_pendentes', 0,
      'cadastro_prestadores_analise', 0
    );
  END IF;

  IF NOT public.gsa_admin_has_module('financeiro') THEN
    v_data := v_data || jsonb_build_object(
      'financeiro_faturas_vencidas', 0,
      'financeiro_faturas_pendentes', 0,
      'financeiro_saques_pendentes', 0,
      'financeiro_transferencias_analise', 0,
      'financeiro_prestador_saques', 0
    );
  END IF;

  IF NOT public.gsa_admin_has_module('cobranca') THEN
    v_data := v_data || jsonb_build_object(
      'cobranca_pendentes', 0,
      'cobranca_criticas', 0
    );
  END IF;

  IF NOT public.gsa_admin_has_module('fiscal') THEN
    v_data := v_data || jsonb_build_object('fiscal_pendentes', 0);
  END IF;

  IF NOT public.gsa_admin_has_module('operacoes') THEN
    v_data := v_data || jsonb_build_object(
      'vendas_orcamentos_pendentes', 0,
      'vendas_orcamentos_aprovados', 0,
      'vendas_demandas_abertas', 0,
      'vendas_demandas_prestador', 0,
      'vendas_demandas_internas', 0,
      'vendas_demandas_suporte', 0,
      'vendas_os_andamento', 0,
      'vendas_assinaturas_pendentes', 0
    );
  END IF;

  IF NOT public.gsa_admin_has_module('emprestimos') THEN
    v_data := v_data || jsonb_build_object('vendas_emprestimos_pendentes', 0);
  END IF;

  IF NOT public.gsa_admin_has_module('credito_loja') THEN
    v_data := v_data || jsonb_build_object('vendas_credito_pendentes', 0);
  END IF;

  IF NOT public.gsa_admin_has_module('atendimento') THEN
    v_data := v_data || jsonb_build_object(
      'suporte_tickets_abertos', 0,
      'suporte_tickets_em_andamento', 0,
      'suporte_mensagens_nao_lidas', 0
    );
  END IF;

  IF NOT public.gsa_admin_has_module('acessos') THEN
    v_data := v_data || jsonb_build_object('acessos_exclusao_pendentes', 0);
  END IF;

  RETURN v_data;
END;
$$;

CREATE OR REPLACE FUNCTION public.gsa_admin_dashboard_snapshot_pre_ticket_compat(
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
  v_can_finance boolean := public.gsa_admin_has_module('financeiro');
  v_can_cadastro boolean := public.gsa_admin_has_module('cadastro');
  v_can_operacoes boolean := public.gsa_admin_has_module('operacoes');
  v_can_atendimento boolean := public.gsa_admin_has_module('atendimento');
  v_can_fidelidade boolean := public.gsa_admin_has_module('fidelidade');
  v_can_credit boolean := v_can_finance
    OR public.gsa_admin_has_module('emprestimos')
    OR public.gsa_admin_has_module('credito_loja');
  v_total numeric := 0;
  v_current numeric := 0;
  v_previous numeric := 0;
  v_clients bigint := 0;
  v_promotions bigint := 0;
  v_credit numeric := 0;
  v_lists jsonb := '{}'::jsonb;
BEGIN
  PERFORM public.gsa_admin_context();

  IF v_can_finance THEN
    SELECT COALESCE(sum(f.valor_total), 0)
      INTO v_total
      FROM public.faturas f
     WHERE f.status = 'pago'
       AND f.data_pagamento >= date_trunc('month', now()) - interval '5 months';

    SELECT COALESCE(sum(f.valor_total), 0)
      INTO v_current
      FROM public.faturas f
     WHERE f.status = 'pago'
       AND f.data_pagamento >= date_trunc('month', now())
       AND f.data_pagamento < date_trunc('month', now()) + interval '1 month';

    SELECT COALESCE(sum(f.valor_total), 0)
      INTO v_previous
      FROM public.faturas f
     WHERE f.status = 'pago'
       AND f.data_pagamento >= date_trunc('month', now()) - interval '1 month'
       AND f.data_pagamento < date_trunc('month', now());

    v_lists := v_lists || jsonb_build_object(
      'faturas', COALESCE((
        SELECT jsonb_agg(item ORDER BY sort_date ASC)
          FROM (
            SELECT to_jsonb(f) || jsonb_build_object('cliente_nome', c.nome) AS item,
                   f.data_vencimento AS sort_date
              FROM public.faturas f
              LEFT JOIN public.clientes c ON c.id = f.cliente_id
             WHERE f.status IN ('pendente', 'vencida')
             ORDER BY f.data_vencimento ASC
             LIMIT 5
          ) rows
      ), '[]'::jsonb),
      'saques', COALESCE((
        SELECT jsonb_agg(item ORDER BY sort_date ASC)
          FROM (
            SELECT to_jsonb(s) || jsonb_build_object('cliente_nome', c.nome) AS item,
                   s.data_solicitacao AS sort_date
              FROM public.saques s
              LEFT JOIN public.clientes c ON c.id = s.cliente_id
             WHERE s.status = 'pendente'
             ORDER BY s.data_solicitacao ASC
             LIMIT 5
          ) rows
      ), '[]'::jsonb),
      'cobrancas', COALESCE((
        SELECT jsonb_agg(item ORDER BY sort_date ASC)
          FROM (
            SELECT to_jsonb(cb) || jsonb_build_object('cliente_nome', c.nome) AS item,
                   cb.created_at AS sort_date
              FROM public.cobrancas cb
              LEFT JOIN public.clientes c ON c.id = cb.cliente_id
             WHERE cb.status IN ('pendente', 'em_cobranca', 'acordo_quebrado')
             ORDER BY cb.created_at ASC
             LIMIT 5
          ) rows
      ), '[]'::jsonb)
    );
  END IF;

  IF v_can_credit THEN
    SELECT COALESCE(sum(e.valor_solicitado), 0)
      INTO v_credit
      FROM public.emprestimos e
     WHERE e.status IN ('analise', 'pendente', 'aguardando_assinatura');

    v_lists := v_lists || jsonb_build_object(
      'emprestimos', COALESCE((
        SELECT jsonb_agg(item ORDER BY sort_date ASC)
          FROM (
            SELECT to_jsonb(e) || jsonb_build_object('cliente_nome', c.nome) AS item,
                   e.created_at AS sort_date
              FROM public.emprestimos e
              LEFT JOIN public.clientes c ON c.id = e.cliente_id
             WHERE e.status IN ('analise', 'pendente', 'aguardando_assinatura')
             ORDER BY e.created_at ASC
             LIMIT 5
          ) rows
      ), '[]'::jsonb)
    );
  END IF;

  IF v_can_cadastro THEN
    SELECT count(*) INTO v_clients FROM public.clientes;
  END IF;

  IF v_can_fidelidade THEN
    SELECT count(*) INTO v_promotions
      FROM public.cliente_promocoes
     WHERE status = 'ativa';
  END IF;

  IF v_can_operacoes THEN
    v_lists := v_lists || jsonb_build_object(
      'orcamentos', COALESCE((
        SELECT jsonb_agg(item ORDER BY sort_date ASC)
          FROM (
            SELECT to_jsonb(o) || jsonb_build_object('cliente_nome', c.nome) AS item,
                   o.data_criacao AS sort_date
              FROM public.orcamentos o
              LEFT JOIN public.clientes c ON c.id = o.cliente_id
             WHERE o.status IN ('aberto', 'negociação', 'em revisão')
               AND COALESCE(o.categoria, '') <> 'emprestimo'
             ORDER BY o.data_criacao ASC
             LIMIT 5
          ) rows
      ), '[]'::jsonb)
    );
  END IF;

  IF v_can_atendimento THEN
    v_lists := v_lists || jsonb_build_object('tickets', '[]'::jsonb);
  END IF;

  RETURN jsonb_build_object(
    'permissions', jsonb_build_object(
      'financeiro', v_can_finance,
      'cadastro', v_can_cadastro,
      'operacoes', v_can_operacoes,
      'atendimento', v_can_atendimento,
      'fidelidade', v_can_fidelidade,
      'emprestimos', public.gsa_admin_has_module('emprestimos'),
      'credito_loja', public.gsa_admin_has_module('credito_loja')
    ),
    'stats', jsonb_build_object(
      'faturamento_seis_meses', v_total,
      'faturamento_mes_atual', v_current,
      'faturamento_mes_anterior', v_previous,
      'clientes_total', v_clients,
      'promocoes_ativas', v_promotions,
      'credito_pendente_total', v_credit
    ),
    'lists', v_lists
  );
END;
$$;

REVOKE ALL ON FUNCTION public.gsa_admin_get_pendency_counts_secure(uuid, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.gsa_admin_get_pendency_counts_secure(uuid, text) TO authenticated, service_role;

REVOKE ALL ON FUNCTION public.gsa_admin_dashboard_snapshot_pre_ticket_compat(uuid, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.gsa_admin_dashboard_snapshot_pre_ticket_compat(uuid, text) TO service_role;

NOTIFY pgrst, 'reload schema';

COMMIT;
