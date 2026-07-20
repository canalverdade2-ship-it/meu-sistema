BEGIN;

CREATE TABLE IF NOT EXISTS public.gsa_admin_audit_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_type text NOT NULL,
  actor_id uuid NOT NULL,
  module text NOT NULL,
  action text NOT NULL,
  target_type text,
  target_id uuid,
  details jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.gsa_admin_notification_state (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_type text NOT NULL,
  actor_id uuid NOT NULL,
  source_table text NOT NULL,
  notification_id text NOT NULL,
  read_at timestamptz,
  dismissed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (actor_type, actor_id, source_table, notification_id)
);

ALTER TABLE public.gsa_admin_audit_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.gsa_admin_notification_state ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON public.gsa_admin_audit_events FROM anon, authenticated;
REVOKE ALL ON public.gsa_admin_notification_state FROM anon, authenticated;

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
  v_colaborador jsonb;
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
    SELECT to_jsonb(c)
      INTO v_colaborador
      FROM public.colaboradores c
     WHERE c.id = v_id
     LIMIT 1;

    IF v_colaborador IS NULL
       OR COALESCE(v_colaborador ->> 'status', 'ativo') IN ('bloqueado', 'inativo', 'excluido') THEN
      RAISE EXCEPTION 'Acesso do colaborador revogado.' USING ERRCODE = '42501';
    END IF;

    v_modules := COALESCE(v_colaborador -> 'modulos', '[]'::jsonb);
    IF jsonb_typeof(v_modules) <> 'array' THEN
      v_modules := '[]'::jsonb;
    END IF;
  END IF;

  RETURN jsonb_build_object(
    'actor_type', v_type,
    'actor_id', v_id,
    'modules', v_modules
  );
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
  v_type text := v_context ->> 'actor_type';
  v_modules jsonb := COALESCE(v_context -> 'modules', '[]'::jsonb);
  v_aliases text[];
BEGIN
  IF v_type = 'admin' THEN
    RETURN true;
  END IF;

  IF p_module IN ('dashboard', 'demandas') THEN
    RETURN true;
  END IF;

  v_aliases := CASE p_module
    WHEN 'cadastro' THEN ARRAY['cadastro', 'prestadores', 'clientes']
    WHEN 'catalogo' THEN ARRAY['catalogo', 'cadastro']
    WHEN 'operacoes' THEN ARRAY['operacoes', 'vendas', 'demandas']
    WHEN 'loja' THEN ARRAY['loja', 'cadastro', 'vendas']
    WHEN 'classificados' THEN ARRAY['classificados', 'loja', 'vendas']
    WHEN 'viagens' THEN ARRAY['viagens', 'loja', 'vendas']
    WHEN 'saude' THEN ARRAY['saude', 'loja', 'vendas']
    WHEN 'seguros' THEN ARRAY['seguros', 'loja', 'vendas']
    WHEN 'fidelidade' THEN ARRAY['fidelidade', 'cadastro', 'area_vip', 'promocoes']
    WHEN 'atendimento' THEN ARRAY['atendimento', 'tickets', 'suporte']
    WHEN 'financeiro' THEN ARRAY['financeiro', 'cobranca', 'fiscal', 'emprestimos', 'credito_loja']
    WHEN 'relatorios' THEN ARRAY['relatorios']
    WHEN 'configuracoes' THEN ARRAY['configuracoes']
    WHEN 'acessos' THEN ARRAY['acessos']
    WHEN 'sistema' THEN ARRAY['sistema']
    ELSE ARRAY[p_module]
  END;

  RETURN EXISTS (
    SELECT 1
      FROM jsonb_array_elements_text(v_modules) AS item(value)
     WHERE item.value = ANY(v_aliases)
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

CREATE OR REPLACE FUNCTION public.gsa_admin_write_audit(
  p_module text,
  p_action text,
  p_target_type text DEFAULT NULL,
  p_target_id uuid DEFAULT NULL,
  p_details jsonb DEFAULT '{}'::jsonb
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_context jsonb := public.gsa_admin_context();
  v_id uuid;
BEGIN
  INSERT INTO public.gsa_admin_audit_events (
    actor_type, actor_id, module, action, target_type, target_id, details
  ) VALUES (
    v_context ->> 'actor_type',
    (v_context ->> 'actor_id')::uuid,
    p_module,
    p_action,
    p_target_type,
    p_target_id,
    COALESCE(p_details, '{}'::jsonb)
  ) RETURNING id INTO v_id;
  RETURN v_id;
END;
$$;

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
    EXECUTE 'SELECT to_jsonb(public.get_admin_pendency_counts())' INTO v_data;
  EXCEPTION WHEN undefined_function THEN
    v_data := '{}'::jsonb;
  END;

  v_data := COALESCE(v_data, '{}'::jsonb);

  IF NOT public.gsa_admin_has_module('cadastro') THEN
    v_data := v_data || jsonb_build_object(
      'cadastro_clientes_inativos', 0,
      'cadastro_clientes_bloqueados', 0,
      'cadastro_clientes_pendentes', 0,
      'cadastro_prestadores_pendentes', 0,
      'cadastro_prestadores_analise', 0,
      'cadastro_docs_pendentes', 0,
      'cadastro_cliente_docs_pendentes', 0,
      'cadastro_vouchers_pendentes', 0,
      'cadastro_premios_pendentes', 0
    );
  END IF;

  IF NOT public.gsa_admin_has_module('financeiro') THEN
    v_data := v_data || jsonb_build_object(
      'financeiro_faturas_vencidas', 0,
      'financeiro_faturas_pendentes', 0,
      'financeiro_saques_pendentes', 0,
      'financeiro_transferencias_analise', 0,
      'financeiro_prestador_saques', 0,
      'cobranca_pendentes', 0,
      'cobranca_criticas', 0,
      'fiscal_pendentes', 0
    );
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
      'vendas_emprestimos_pendentes', 0,
      'vendas_credito_pendentes', 0
    );
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
  v_context jsonb := public.gsa_admin_context();
  v_actor_type text := v_context ->> 'actor_type';
  v_actor_id uuid := (v_context ->> 'actor_id')::uuid;
  v_result jsonb;
BEGIN
  SELECT COALESCE(jsonb_agg(item ORDER BY item.created_at DESC), '[]'::jsonb)
    INTO v_result
    FROM (
      SELECT jsonb_build_object(
        'id', 'admin_' || n.id::text,
        'source_table', 'admin_notificacoes',
        'titulo', n.titulo,
        'mensagem', n.mensagem,
        'modulo', n.modulo,
        'tab', n.tab,
        'item_id', n.item_id,
        'tipo', COALESCE(n.tipo, 'administrativa'),
        'prioridade', COALESCE(n.prioridade, 'normal'),
        'created_at', n.created_at,
        'lida', COALESCE(s.read_at IS NOT NULL, false)
      ) AS item,
      n.created_at
      FROM public.admin_notificacoes n
      LEFT JOIN public.gsa_admin_notification_state s
        ON s.actor_type = v_actor_type
       AND s.actor_id = v_actor_id
       AND s.source_table = 'admin_notificacoes'
       AND s.notification_id = n.id::text
      WHERE s.dismissed_at IS NULL

      UNION ALL

      SELECT jsonb_build_object(
        'id', 'gen_' || n.id::text,
        'source_table', 'notificacoes',
        'titulo', n.titulo,
        'mensagem', n.mensagem,
        'modulo', n.modulo,
        'tab', n.tab,
        'item_id', n.item_id,
        'tipo', COALESCE(n.tipo, 'geral'),
        'prioridade', COALESCE(n.prioridade, 'normal'),
        'acao_origem', n.acao_origem,
        'destinatario_tipo', n.destinatario_tipo,
        'created_at', n.data_criacao,
        'lida', COALESCE(s.read_at IS NOT NULL, false)
      ) AS item,
      n.data_criacao AS created_at
      FROM public.notificacoes n
      LEFT JOIN public.gsa_admin_notification_state s
        ON s.actor_type = v_actor_type
       AND s.actor_id = v_actor_id
       AND s.source_table = 'notificacoes'
       AND s.notification_id = n.id::text
      WHERE s.dismissed_at IS NULL
        AND (
          n.destinatario_tipo IN ('admin', 'broadcast_todos')
          OR (
            v_actor_type = 'colaborador'
            AND n.destinatario_tipo = 'colaborador'
            AND n.colaborador_id = v_actor_id
          )
        )
    ) visible
    ORDER BY visible.created_at DESC
    LIMIT LEAST(GREATEST(COALESCE(p_limit, 50), 1), 100);

  RETURN COALESCE(v_result, '[]'::jsonb);
END;
$$;

CREATE OR REPLACE FUNCTION public.gsa_admin_set_notification_state(
  p_sessao_id uuid DEFAULT NULL,
  p_session_token text DEFAULT NULL,
  p_notification_id text DEFAULT NULL,
  p_read boolean DEFAULT true,
  p_dismiss boolean DEFAULT false
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_context jsonb := public.gsa_admin_context();
  v_source text;
  v_original_id text;
BEGIN
  IF p_notification_id LIKE 'admin_%' THEN
    v_source := 'admin_notificacoes';
    v_original_id := substring(p_notification_id FROM 7);
  ELSIF p_notification_id LIKE 'gen_%' THEN
    v_source := 'notificacoes';
    v_original_id := substring(p_notification_id FROM 5);
  ELSE
    RAISE EXCEPTION 'Identificador de notificação inválido.' USING ERRCODE = '22023';
  END IF;

  INSERT INTO public.gsa_admin_notification_state (
    actor_type, actor_id, source_table, notification_id, read_at, dismissed_at, updated_at
  ) VALUES (
    v_context ->> 'actor_type',
    (v_context ->> 'actor_id')::uuid,
    v_source,
    v_original_id,
    CASE WHEN p_read THEN now() ELSE NULL END,
    CASE WHEN p_dismiss THEN now() ELSE NULL END,
    now()
  )
  ON CONFLICT (actor_type, actor_id, source_table, notification_id)
  DO UPDATE SET
    read_at = CASE WHEN p_read THEN now() ELSE NULL END,
    dismissed_at = CASE WHEN p_dismiss THEN now() ELSE gsa_admin_notification_state.dismissed_at END,
    updated_at = now();

  RETURN jsonb_build_object('success', true);
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
BEGIN
  FOR v_item IN
    SELECT value FROM jsonb_array_elements(public.gsa_admin_list_notifications(p_sessao_id, p_session_token, 100))
  LOOP
    PERFORM public.gsa_admin_set_notification_state(
      p_sessao_id,
      p_session_token,
      v_item ->> 'id',
      true,
      p_dismiss
    );
  END LOOP;

  RETURN jsonb_build_object('success', true);
END;
$$;

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
DECLARE
  v_can_finance boolean := public.gsa_admin_has_module('financeiro');
  v_can_cadastro boolean := public.gsa_admin_has_module('cadastro');
  v_can_operacoes boolean := public.gsa_admin_has_module('operacoes');
  v_can_atendimento boolean := public.gsa_admin_has_module('atendimento');
  v_can_fidelidade boolean := public.gsa_admin_has_module('fidelidade');
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

    SELECT COALESCE(sum(e.valor_solicitado), 0)
      INTO v_credit
      FROM public.emprestimos e
     WHERE e.status IN ('analise', 'pendente', 'aguardando_assinatura');

    v_lists := v_lists || jsonb_build_object(
      'faturas', COALESCE((
        SELECT jsonb_agg(to_jsonb(q)) FROM (
          SELECT f.id, f.codigo_fatura, f.valor_total, f.valor_final_pendente,
                 f.status, f.data_vencimento, f.cliente_id, c.nome AS cliente_nome
            FROM public.faturas f
            LEFT JOIN public.clientes c ON c.id = f.cliente_id
           WHERE f.status IN ('pendente', 'vencida')
           ORDER BY f.data_vencimento ASC
           LIMIT 5
        ) q
      ), '[]'::jsonb),
      'saques', COALESCE((
        SELECT jsonb_agg(to_jsonb(q)) FROM (
          SELECT s.id, s.valor, s.status, s.data_solicitacao, s.cliente_id, c.nome AS cliente_nome
            FROM public.saques s
            LEFT JOIN public.clientes c ON c.id = s.cliente_id
           WHERE s.status = 'pendente'
           ORDER BY s.data_solicitacao ASC
           LIMIT 5
        ) q
      ), '[]'::jsonb),
      'emprestimos', COALESCE((
        SELECT jsonb_agg(to_jsonb(q)) FROM (
          SELECT e.id, e.valor_solicitado, e.status, e.created_at, e.cliente_id, c.nome AS cliente_nome
            FROM public.emprestimos e
            LEFT JOIN public.clientes c ON c.id = e.cliente_id
           WHERE e.status IN ('analise', 'pendente', 'aguardando_assinatura')
           ORDER BY e.created_at ASC
           LIMIT 5
        ) q
      ), '[]'::jsonb),
      'cobrancas', COALESCE((
        SELECT jsonb_agg(to_jsonb(q)) FROM (
          SELECT cb.id, cb.status, cb.created_at, cb.cliente_id, c.nome AS cliente_nome
            FROM public.cobrancas cb
            LEFT JOIN public.clientes c ON c.id = cb.cliente_id
           WHERE cb.status IN ('pendente', 'em_cobranca', 'acordo_quebrado')
           ORDER BY cb.created_at ASC
           LIMIT 5
        ) q
      ), '[]'::jsonb)
    );
  END IF;

  IF v_can_cadastro THEN
    SELECT count(*) INTO v_clients FROM public.clientes;
  END IF;

  IF v_can_fidelidade THEN
    SELECT count(*) INTO v_promotions FROM public.cliente_promocoes WHERE status = 'ativa';
  END IF;

  IF v_can_operacoes THEN
    v_lists := v_lists || jsonb_build_object(
      'orcamentos', COALESCE((
        SELECT jsonb_agg(to_jsonb(q)) FROM (
          SELECT o.id, o.codigo_orcamento, o.status, o.data_criacao, o.cliente_id, c.nome AS cliente_nome
            FROM public.orcamentos o
            LEFT JOIN public.clientes c ON c.id = o.cliente_id
           WHERE o.status IN ('aberto', 'negociação', 'em revisão')
             AND COALESCE(o.categoria, '') <> 'emprestimo'
           ORDER BY o.data_criacao ASC
           LIMIT 5
        ) q
      ), '[]'::jsonb)
    );
  END IF;

  IF v_can_atendimento THEN
    v_lists := v_lists || jsonb_build_object(
      'tickets', COALESCE((
        SELECT jsonb_agg(to_jsonb(q)) FROM (
          SELECT t.id, t.titulo, t.status, t.data_abertura, t.cliente_id, c.nome AS cliente_nome
            FROM public.tickets t
            LEFT JOIN public.clientes c ON c.id = t.cliente_id
           WHERE t.status IN ('aberto', 'em_andamento')
           ORDER BY t.data_abertura ASC
           LIMIT 5
        ) q
      ), '[]'::jsonb)
    );
  END IF;

  RETURN jsonb_build_object(
    'permissions', jsonb_build_object(
      'financeiro', v_can_finance,
      'cadastro', v_can_cadastro,
      'operacoes', v_can_operacoes,
      'atendimento', v_can_atendimento,
      'fidelidade', v_can_fidelidade
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

CREATE OR REPLACE FUNCTION public.gsa_admin_travel_list(
  p_sessao_id uuid DEFAULT NULL,
  p_session_token text DEFAULT NULL,
  p_kind text DEFAULT 'solicitacoes',
  p_page integer DEFAULT 1,
  p_page_size integer DEFAULT 20,
  p_search text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_offset integer := (GREATEST(COALESCE(p_page, 1), 1) - 1) * LEAST(GREATEST(COALESCE(p_page_size, 20), 1), 100);
  v_size integer := LEAST(GREATEST(COALESCE(p_page_size, 20), 1), 100);
  v_items jsonb := '[]'::jsonb;
  v_total bigint := 0;
  v_search text := NULLIF(trim(COALESCE(p_search, '')), '');
BEGIN
  PERFORM public.gsa_admin_assert_module('viagens');

  IF p_kind = 'solicitacoes' THEN
    SELECT count(*) INTO v_total
      FROM public.viagens_orcamentos o
     WHERE v_search IS NULL OR concat_ws(' ', o.protocolo, o.nome, o.email, o.telefone, o.origem, o.destino) ILIKE '%' || v_search || '%';

    SELECT COALESCE(jsonb_agg(to_jsonb(q)), '[]'::jsonb) INTO v_items FROM (
      SELECT o.*, jsonb_build_object('titulo', p.titulo, 'preco_venda', p.preco_venda) AS viagens_pacotes
        FROM public.viagens_orcamentos o
        LEFT JOIN public.viagens_pacotes p ON p.id = o.pacote_id
       WHERE v_search IS NULL OR concat_ws(' ', o.protocolo, o.nome, o.email, o.telefone, o.origem, o.destino) ILIKE '%' || v_search || '%'
       ORDER BY o.created_at DESC
       LIMIT v_size OFFSET v_offset
    ) q;
  ELSIF p_kind = 'pacotes' THEN
    SELECT count(*) INTO v_total
      FROM public.viagens_pacotes p
     WHERE v_search IS NULL OR concat_ws(' ', p.titulo, p.origem, p.destino, p.categoria) ILIKE '%' || v_search || '%';

    SELECT COALESCE(jsonb_agg(to_jsonb(q)), '[]'::jsonb) INTO v_items FROM (
      SELECT p.*,
             COALESCE((SELECT jsonb_agg(to_jsonb(i) ORDER BY i.ordem) FROM public.viagens_pacote_imagens i WHERE i.pacote_id = p.id), '[]'::jsonb) AS viagens_pacote_imagens
        FROM public.viagens_pacotes p
       WHERE v_search IS NULL OR concat_ws(' ', p.titulo, p.origem, p.destino, p.categoria) ILIKE '%' || v_search || '%'
       ORDER BY p.created_at DESC
       LIMIT v_size OFFSET v_offset
    ) q;
  ELSIF p_kind = 'propostas' THEN
    SELECT count(*) INTO v_total FROM public.viagens_propostas;
    SELECT COALESCE(jsonb_agg(to_jsonb(q)), '[]'::jsonb) INTO v_items FROM (
      SELECT p.*, c.nome AS cliente_nome
        FROM public.viagens_propostas p
        LEFT JOIN public.clientes c ON c.id = p.cliente_id
       ORDER BY p.created_at DESC
       LIMIT v_size OFFSET v_offset
    ) q;
  ELSIF p_kind = 'transacoes' THEN
    SELECT count(*) INTO v_total FROM public.viagens_transacoes;
    SELECT COALESCE(jsonb_agg(to_jsonb(q)), '[]'::jsonb) INTO v_items FROM (
      SELECT t.*, c.nome AS cliente_nome
        FROM public.viagens_transacoes t
        LEFT JOIN public.clientes c ON c.id = t.cliente_id
       ORDER BY t.created_at DESC
       LIMIT v_size OFFSET v_offset
    ) q;
  ELSE
    RAISE EXCEPTION 'Tipo de listagem inválido.' USING ERRCODE = '22023';
  END IF;

  RETURN jsonb_build_object('items', v_items, 'total', v_total, 'page', GREATEST(COALESCE(p_page, 1), 1), 'page_size', v_size);
END;
$$;

CREATE OR REPLACE FUNCTION public.gsa_admin_travel_link_lead(
  p_sessao_id uuid DEFAULT NULL,
  p_session_token text DEFAULT NULL,
  p_quote_id uuid DEFAULT NULL,
  p_client_id uuid DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  PERFORM public.gsa_admin_assert_module('viagens');

  UPDATE public.viagens_orcamentos
     SET cliente_id = p_client_id, updated_at = now()
   WHERE id = p_quote_id
     AND cliente_id IS NULL;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Orçamento não encontrado ou já vinculado.' USING ERRCODE = 'P0002';
  END IF;

  PERFORM public.gsa_admin_write_audit('viagens', 'VINCULAR_LEAD_CLIENTE', 'viagens_orcamentos', p_quote_id, jsonb_build_object('cliente_id', p_client_id));
  RETURN jsonb_build_object('success', true);
END;
$$;

CREATE OR REPLACE FUNCTION public.gsa_admin_travel_update_status(
  p_sessao_id uuid DEFAULT NULL,
  p_session_token text DEFAULT NULL,
  p_entity text DEFAULT NULL,
  p_id uuid DEFAULT NULL,
  p_status text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  PERFORM public.gsa_admin_assert_module('viagens');

  IF p_entity = 'orcamento' THEN
    UPDATE public.viagens_orcamentos SET status = p_status, updated_at = now() WHERE id = p_id;
  ELSIF p_entity = 'pacote' THEN
    UPDATE public.viagens_pacotes SET status = p_status, updated_at = now() WHERE id = p_id;
  ELSE
    RAISE EXCEPTION 'Entidade inválida.' USING ERRCODE = '22023';
  END IF;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Registro não encontrado.' USING ERRCODE = 'P0002';
  END IF;

  PERFORM public.gsa_admin_write_audit('viagens', 'ALTERAR_STATUS', p_entity, p_id, jsonb_build_object('status', p_status));
  RETURN jsonb_build_object('success', true);
END;
$$;

CREATE OR REPLACE FUNCTION public.gsa_admin_travel_create_proposal(
  p_sessao_id uuid DEFAULT NULL,
  p_session_token text DEFAULT NULL,
  p_quote_id uuid DEFAULT NULL,
  p_title text DEFAULT NULL,
  p_total numeric DEFAULT NULL,
  p_max_installments integer DEFAULT 1,
  p_acceptance_hours integer DEFAULT 48,
  p_payment_days integer DEFAULT 2,
  p_conditions text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_quote public.viagens_orcamentos%ROWTYPE;
  v_reservation_id uuid;
  v_proposal_id uuid;
  v_snapshot jsonb;
  v_acceptance_deadline timestamptz;
  v_payment_deadline timestamptz;
BEGIN
  PERFORM public.gsa_admin_assert_module('viagens');

  IF p_total IS NULL OR p_total <= 0 OR trim(COALESCE(p_title, '')) = '' THEN
    RAISE EXCEPTION 'Título e valor total são obrigatórios.' USING ERRCODE = '22023';
  END IF;

  SELECT * INTO v_quote
    FROM public.viagens_orcamentos
   WHERE id = p_quote_id
   FOR UPDATE;

  IF NOT FOUND OR v_quote.cliente_id IS NULL THEN
    RAISE EXCEPTION 'Orçamento não encontrado ou sem cliente vinculado.' USING ERRCODE = 'P0002';
  END IF;

  IF EXISTS (
    SELECT 1
      FROM public.viagens_solicitacoes_reserva r
      JOIN public.viagens_propostas p ON p.reserva_id = r.id
     WHERE r.snapshot_pacote ->> 'protocolo_orcamento' = v_quote.protocolo
       AND p.status IN ('enviada', 'visualizada', 'aceita')
  ) THEN
    RAISE EXCEPTION 'Já existe uma proposta ativa para este orçamento.' USING ERRCODE = '23505';
  END IF;

  v_acceptance_deadline := now() + make_interval(hours => GREATEST(COALESCE(p_acceptance_hours, 48), 1));
  v_payment_deadline := v_acceptance_deadline + make_interval(days => GREATEST(COALESCE(p_payment_days, 2), 1));
  v_snapshot := jsonb_build_object(
    'titulo', trim(p_title),
    'origem', v_quote.origem,
    'destino', v_quote.destino,
    'data_ida', v_quote.data_ida,
    'data_volta', v_quote.data_volta,
    'adultos', v_quote.adultos,
    'criancas', v_quote.criancas,
    'bebes', v_quote.bebes,
    'preferencia_hospedagem', v_quote.preferencia_hospedagem,
    'observacoes', v_quote.observacoes,
    'pacote_id', v_quote.pacote_id,
    'protocolo_orcamento', v_quote.protocolo
  );

  INSERT INTO public.viagens_solicitacoes_reserva (
    pacote_id, cliente_id, protocolo, adultos, criancas, bebes,
    snapshot_pacote, status, observacoes_cliente
  ) VALUES (
    v_quote.pacote_id,
    v_quote.cliente_id,
    'RES-' || upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 8)),
    COALESCE(v_quote.adultos, 1),
    COALESCE(v_quote.criancas, 0),
    COALESCE(v_quote.bebes, 0),
    v_snapshot,
    'proposta_disponivel',
    v_quote.observacoes
  ) RETURNING id INTO v_reservation_id;

  INSERT INTO public.viagens_propostas (
    reserva_id, cliente_id, snapshot_completo, valor_total,
    parcelamento_permitido, condicoes, prazo_aceitacao, prazo_pagamento, status
  ) VALUES (
    v_reservation_id,
    v_quote.cliente_id,
    v_snapshot,
    p_total,
    GREATEST(COALESCE(p_max_installments, 1), 1),
    NULLIF(trim(COALESCE(p_conditions, '')), ''),
    v_acceptance_deadline,
    v_payment_deadline,
    'enviada'
  ) RETURNING id INTO v_proposal_id;

  UPDATE public.viagens_orcamentos
     SET status = 'propostas_disponiveis', updated_at = now()
   WHERE id = p_quote_id;

  PERFORM public.gsa_admin_write_audit(
    'viagens', 'CRIAR_PROPOSTA', 'viagens_propostas', v_proposal_id,
    jsonb_build_object('orcamento_id', p_quote_id, 'reserva_id', v_reservation_id, 'valor_total', p_total)
  );

  RETURN jsonb_build_object('success', true, 'proposal_id', v_proposal_id, 'reservation_id', v_reservation_id);
END;
$$;

CREATE OR REPLACE FUNCTION public.gsa_admin_travel_create_package(
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
  v_title text := trim(COALESCE(p_payload ->> 'titulo', ''));
  v_destination text := trim(COALESCE(p_payload ->> 'destino', ''));
  v_price numeric := NULLIF(p_payload ->> 'preco_venda', '')::numeric;
  v_slug text;
BEGIN
  PERFORM public.gsa_admin_assert_module('viagens');

  IF v_title = '' OR v_destination = '' OR v_price IS NULL OR v_price <= 0 THEN
    RAISE EXCEPTION 'Título, destino e preço válidos são obrigatórios.' USING ERRCODE = '22023';
  END IF;

  v_slug := regexp_replace(lower(unaccent(v_title)), '[^a-z0-9]+', '-', 'g');
  v_slug := trim(both '-' FROM v_slug) || '-' || substr(replace(gen_random_uuid()::text, '-', ''), 1, 6);

  INSERT INTO public.viagens_pacotes (
    titulo, slug, categoria, origem, destino, data_ida, data_volta,
    dias, noites, preco_venda, parcelamento_maximo, status
  ) VALUES (
    v_title,
    v_slug,
    COALESCE(NULLIF(p_payload ->> 'categoria', ''), 'nacional'),
    NULLIF(trim(COALESCE(p_payload ->> 'origem', '')), ''),
    v_destination,
    NULLIF(p_payload ->> 'data_ida', '')::date,
    NULLIF(p_payload ->> 'data_volta', '')::date,
    NULLIF(p_payload ->> 'dias', '')::integer,
    NULLIF(p_payload ->> 'noites', '')::integer,
    v_price,
    GREATEST(COALESCE(NULLIF(p_payload ->> 'parcelamento_maximo', '')::integer, 1), 1),
    'rascunho'
  ) RETURNING id INTO v_id;

  IF NULLIF(trim(COALESCE(p_payload ->> 'imagem_url', '')), '') IS NOT NULL THEN
    INSERT INTO public.viagens_pacote_imagens (pacote_id, url, is_capa, ordem)
    VALUES (v_id, trim(p_payload ->> 'imagem_url'), true, 0);
  END IF;

  PERFORM public.gsa_admin_write_audit('viagens', 'CRIAR_PACOTE', 'viagens_pacotes', v_id, p_payload);
  RETURN jsonb_build_object('success', true, 'id', v_id);
END;
$$;

REVOKE ALL ON FUNCTION public.gsa_admin_context() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.gsa_admin_has_module(text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.gsa_admin_assert_module(text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.gsa_admin_write_audit(text, text, text, uuid, jsonb) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.gsa_admin_get_pendency_counts_secure(uuid, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.gsa_admin_list_notifications(uuid, text, integer) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.gsa_admin_set_notification_state(uuid, text, text, boolean, boolean) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.gsa_admin_mark_all_notifications(uuid, text, boolean) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.gsa_admin_dashboard_snapshot(uuid, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.gsa_admin_travel_list(uuid, text, text, integer, integer, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.gsa_admin_travel_link_lead(uuid, text, uuid, uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.gsa_admin_travel_update_status(uuid, text, text, uuid, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.gsa_admin_travel_create_proposal(uuid, text, uuid, text, numeric, integer, integer, integer, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.gsa_admin_travel_create_package(uuid, text, jsonb) FROM PUBLIC;

GRANT EXECUTE ON FUNCTION public.gsa_admin_get_pendency_counts_secure(uuid, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.gsa_admin_list_notifications(uuid, text, integer) TO authenticated;
GRANT EXECUTE ON FUNCTION public.gsa_admin_set_notification_state(uuid, text, text, boolean, boolean) TO authenticated;
GRANT EXECUTE ON FUNCTION public.gsa_admin_mark_all_notifications(uuid, text, boolean) TO authenticated;
GRANT EXECUTE ON FUNCTION public.gsa_admin_dashboard_snapshot(uuid, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.gsa_admin_travel_list(uuid, text, text, integer, integer, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.gsa_admin_travel_link_lead(uuid, text, uuid, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.gsa_admin_travel_update_status(uuid, text, text, uuid, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.gsa_admin_travel_create_proposal(uuid, text, uuid, text, numeric, integer, integer, integer, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.gsa_admin_travel_create_package(uuid, text, jsonb) TO authenticated;

COMMIT;
