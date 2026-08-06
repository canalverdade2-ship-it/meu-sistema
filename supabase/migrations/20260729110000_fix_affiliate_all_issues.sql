-- Migration: Fix affiliate constraints, payout idempotency, points events snapshot, and admin RPCs
BEGIN;

-- 1. Atualizar constraints da tabela gsa_afiliado_pontos_eventos
ALTER TABLE public.gsa_afiliado_pontos_eventos
  DROP CONSTRAINT IF EXISTS gsa_afiliado_pontos_eventos_tipo_check;

ALTER TABLE public.gsa_afiliado_pontos_eventos
  ADD CONSTRAINT gsa_afiliado_pontos_eventos_tipo_check
  CHECK (tipo IN ('credito_conversao', 'estorno_conversao', 'resgate_carteira', 'bonus_boas_vindas', 'ajuste'));

ALTER TABLE public.gsa_afiliado_pontos_eventos
  DROP CONSTRAINT IF EXISTS gsa_afiliado_pontos_eventos_referencia_check;

ALTER TABLE public.gsa_afiliado_pontos_eventos
  ADD CONSTRAINT gsa_afiliado_pontos_eventos_referencia_check
  CHECK (conversao_id IS NOT NULL OR request_id IS NOT NULL OR tipo IN ('ajuste', 'bonus_boas_vindas'));


-- 2. Atualizar gsa_client_join_affiliate com cadastro atômico e bônus de boas-vindas seguro
CREATE OR REPLACE FUNCTION public.gsa_client_join_affiliate(
  p_sessao_id uuid,
  p_session_token text,
  p_nome_divulgacao text,
  p_pix_tipo text,
  p_pix_chave text,
  p_termos_versao text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  v_actor record;
  v_id uuid;
  v_type text := public.gsa_affiliate_normalize_pix_type(p_pix_tipo, p_pix_chave);
  v_is_new boolean := false;
  v_welcome_active boolean := true;
  v_welcome_val numeric := 100;
BEGIN
  SELECT * INTO v_actor FROM public.gsa_client_session_actor(p_sessao_id, p_session_token) LIMIT 1;
  IF v_actor.cliente_id IS NULL THEN RAISE EXCEPTION 'Sessão de cliente inválida ou expirada.'; END IF;

  IF length(trim(coalesce(p_nome_divulgacao, ''))) NOT BETWEEN 3 AND 120 THEN RAISE EXCEPTION 'Nome de divulgação inválido.'; END IF;
  IF length(trim(coalesce(p_pix_chave, ''))) NOT BETWEEN 3 AND 180 THEN RAISE EXCEPTION 'Chave PIX inválida.'; END IF;
  IF length(trim(coalesce(p_termos_versao, ''))) NOT BETWEEN 1 AND 40 THEN RAISE EXCEPTION 'Versão dos termos obrigatória.'; END IF;

  SELECT id INTO v_id FROM public.gsa_afiliados WHERE cliente_id = v_actor.cliente_id FOR UPDATE;

  IF v_id IS NULL THEN
    v_is_new := true;
    INSERT INTO public.gsa_afiliados(cliente_id, codigo_publico, nome_divulgacao, status, pix_tipo, pix_chave, termos_versao, termos_aceitos_em)
    VALUES (v_actor.cliente_id, public.gsa_affiliate_new_code('AFL'), trim(p_nome_divulgacao), 'ativo', v_type, trim(p_pix_chave), trim(p_termos_versao), now())
    ON CONFLICT (cliente_id) DO UPDATE
      SET nome_divulgacao = EXCLUDED.nome_divulgacao,
          pix_tipo = EXCLUDED.pix_tipo,
          pix_chave = EXCLUDED.pix_chave,
          status = 'ativo',
          termos_versao = EXCLUDED.termos_versao,
          termos_aceitos_em = now(),
          updated_at = now()
    RETURNING id INTO v_id;
  ELSE
    UPDATE public.gsa_afiliados
    SET nome_divulgacao = trim(p_nome_divulgacao),
        pix_tipo = v_type,
        pix_chave = trim(p_pix_chave),
        status = 'ativo',
        termos_versao = trim(p_termos_versao),
        termos_aceitos_em = now(),
        updated_at = now()
    WHERE id = v_id AND status <> 'encerrado';
  END IF;

  IF v_id IS NULL THEN RAISE EXCEPTION 'Perfil suspenso ou encerrado. Procure o atendimento GSA.'; END IF;

  IF v_is_new THEN
    SELECT coalesce(max(CASE WHEN key = 'afiliado_bonus_boas_vindas_ativo' THEN value END)::boolean, true),
           coalesce(max(CASE WHEN key = 'afiliado_bonus_boas_vindas_valor' THEN value::numeric END), 100)
      INTO v_welcome_active, v_welcome_val
    FROM public.system_settings
    WHERE key IN ('afiliado_bonus_boas_vindas_ativo', 'afiliado_bonus_boas_vindas_valor');

    IF v_welcome_active AND v_welcome_val > 0 THEN
      UPDATE public.clientes
      SET pontos = coalesce(pontos, 0) + v_welcome_val,
          saldo_pontos = coalesce(saldo_pontos, 0) + floor(v_welcome_val)::integer,
          pontos_totais = coalesce(pontos_totais, 0) + floor(v_welcome_val)::integer,
          updated_at = now()
      WHERE id = v_actor.cliente_id;

      INSERT INTO public.gsa_afiliado_pontos_eventos(cliente_id, afiliado_id, tipo, pontos_assinados, metadata)
      VALUES (v_actor.cliente_id, v_id, 'bonus_boas_vindas', v_welcome_val, jsonb_build_object('descricao', 'Bônus de Boas-vindas Afiliado GSA'))
      ON CONFLICT DO NOTHING;
    END IF;
  END IF;

  RETURN jsonb_build_object('success', true, 'affiliate_id', v_id);
END;
$function$;


-- 3. Restaurar travas FOR UPDATE e Idempotência Estrita em gsa_client_request_affiliate_payout
CREATE OR REPLACE FUNCTION public.gsa_client_request_affiliate_payout(
  p_sessao_id uuid,
  p_session_token text,
  p_request_id uuid,
  p_valor numeric
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  v_actor record;
  v_affiliate public.gsa_afiliados%rowtype;
  v_available numeric(14,2);
  v_minimum numeric(14,2);
  v_payout public.gsa_afiliado_saques%rowtype;
  v_value numeric(14,2) := round(coalesce(p_valor, 0), 2);
  v_wallet numeric(14,2) := 0;
BEGIN
  SELECT * INTO v_actor
  FROM public.gsa_client_session_actor(p_sessao_id, p_session_token)
  LIMIT 1;

  IF v_actor.cliente_id IS NULL THEN
    SELECT s.ator_id INTO v_actor.cliente_id
      FROM public.sistema_sessoes s
     WHERE s.id = p_sessao_id AND s.status = 'ativo' AND s.ator_tipo = 'cliente'
     LIMIT 1;
  END IF;

  IF v_actor.cliente_id IS NULL THEN
    v_actor.cliente_id := auth.uid();
  END IF;

  IF v_actor.cliente_id IS NULL THEN
    RAISE EXCEPTION 'Sessão de cliente inválida ou expirada.';
  END IF;

  SELECT * INTO v_affiliate
  FROM public.gsa_afiliados
  WHERE cliente_id = v_actor.cliente_id AND status = 'ativo'
  FOR UPDATE;

  IF v_affiliate.id IS NULL THEN
    RAISE EXCEPTION 'Perfil de afiliado ativo não encontrado.';
  END IF;
  IF p_request_id IS NULL THEN
    RAISE EXCEPTION 'Identificador da solicitação obrigatório.';
  END IF;
  IF v_value <= 0 OR v_value > 1000000 THEN
    RAISE EXCEPTION 'Valor de saque inválido.';
  END IF;

  -- Checagem estrita de idempotência
  SELECT * INTO v_payout
  FROM public.gsa_afiliado_saques
  WHERE request_id = p_request_id
  FOR UPDATE;

  IF FOUND THEN
    IF v_payout.afiliado_id <> v_affiliate.id OR v_payout.valor <> v_value THEN
      RAISE EXCEPTION 'Identificador de solicitação já utilizado em outra operação.';
    END IF;
    RETURN jsonb_build_object(
      'success', true,
      'idempotent', true,
      'payout_id', v_payout.id,
      'status', v_payout.status
    );
  END IF;

  SELECT coalesce(saldo_carteira, 0) INTO v_wallet
  FROM public.clientes WHERE id = v_actor.cliente_id;

  SELECT coalesce(min(saque_minimo), 50) INTO v_minimum
  FROM public.gsa_afiliado_programas WHERE ativo;

  IF v_value < v_minimum THEN
    RAISE EXCEPTION 'O valor mínimo para solicitação de saque é R$ %.', trim(to_char(v_minimum, 'FM999G999G990D00'));
  END IF;

  PERFORM public.gsa_affiliate_release_due_commissions();

  SELECT greatest(
    coalesce((SELECT sum(valor - pago_valor) FROM public.gsa_afiliado_comissoes WHERE afiliado_id = v_affiliate.id AND status = 'disponivel'), 0)
    + v_wallet
    - coalesce((SELECT sum(valor) FROM public.gsa_afiliado_saques WHERE afiliado_id = v_affiliate.id AND status IN ('solicitado','aprovado')), 0),
    0
  ) INTO v_available;

  IF v_value > v_available THEN
    RAISE EXCEPTION 'Saldo disponível insuficiente para a solicitação.';
  END IF;

  INSERT INTO public.gsa_afiliado_saques(
    request_id, afiliado_id, valor, status, pix_tipo_snapshot, pix_chave_snapshot, solicitado_em
  ) VALUES (
    p_request_id, v_affiliate.id, v_value, 'solicitado', v_affiliate.pix_tipo, v_affiliate.pix_chave, now()
  ) RETURNING * INTO v_payout;

  -- Notificação ao cliente
  IF v_actor.cliente_id IS NOT NULL THEN
    PERFORM set_config('gsa.system_override', 'on', true);
    INSERT INTO public.notificacoes(
      cliente_id, titulo, mensagem, modulo, tab, item_id, destinatario_tipo, prioridade, acao_origem, contexto
    ) VALUES (
      v_actor.cliente_id,
      'Solicitação de Saque PIX',
      format('Sua solicitação de saque no valor de R$ %s foi registrada e está em análise.', to_char(v_value, 'FM999G999G990D00')),
      'affiliates',
      'saques',
      v_payout.id::text,
      'cliente',
      'normal',
      'saque_solicitado',
      jsonb_build_object('saque_id', v_payout.id, 'valor', v_value, 'request_id', p_request_id)
    );
  END IF;

  RETURN jsonb_build_object(
    'success', true,
    'idempotent', false,
    'payout_id', v_payout.id,
    'status', v_payout.status
  );
END;
$function$;


-- 4. Atualizar gsa_client_affiliate_snapshot com extrato de pontos e sessão resiliente
CREATE OR REPLACE FUNCTION public.gsa_client_affiliate_snapshot(
  p_sessao_id uuid DEFAULT NULL::uuid,
  p_session_token text DEFAULT NULL::text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  v_cliente_id uuid;
  v_affiliate public.gsa_afiliados%rowtype;
  v_programs jsonb := '[]'::jsonb;
  v_links jsonb := '[]'::jsonb;
  v_commissions jsonb := '[]'::jsonb;
  v_payouts jsonb := '[]'::jsonb;
  v_points_events jsonb := '[]'::jsonb;
  v_summary jsonb;
  v_points numeric := 0;
  v_wallet numeric := 0;
  v_points_rate numeric := 0.01;
  v_points_minimum integer := 100;
  v_points_active boolean := true;
  v_cliente_nome text := '';
  v_cliente_cpf text := '';
BEGIN
  IF p_sessao_id IS NOT NULL AND p_session_token IS NOT NULL THEN
    BEGIN
      SELECT cliente_id INTO v_cliente_id
        FROM public.gsa_client_session_actor(p_sessao_id, p_session_token)
       LIMIT 1;
    EXCEPTION WHEN OTHERS THEN
      v_cliente_id := NULL;
    END;
  END IF;

  IF v_cliente_id IS NULL AND p_sessao_id IS NOT NULL THEN
    SELECT s.ator_id INTO v_cliente_id
      FROM public.sistema_sessoes s
     WHERE s.id = p_sessao_id AND s.status = 'ativo' AND s.ator_tipo = 'cliente'
     LIMIT 1;
  END IF;

  IF v_cliente_id IS NULL THEN
    v_cliente_id := auth.uid();
  END IF;

  PERFORM public.gsa_affiliate_release_due_commissions();

  IF v_cliente_id IS NOT NULL THEN
    SELECT * INTO v_affiliate FROM public.gsa_afiliados WHERE cliente_id = v_cliente_id LIMIT 1;

    SELECT coalesce(c.pontos, 0), coalesce(c.saldo_carteira, 0), coalesce(c.nome, ''), coalesce(c.cpf, c.cnpj, '')
      INTO v_points, v_wallet, v_cliente_nome, v_cliente_cpf
    FROM public.clientes c WHERE c.id = v_cliente_id;
  END IF;

  SELECT coalesce(jsonb_agg(jsonb_build_object(
    'id', p.id,
    'codigo', p.codigo,
    'nome', p.nome,
    'descricao', p.descricao,
    'percentual', p.percentual,
    'base_tipo', p.base_tipo,
    'caminho_padrao', p.caminho_padrao,
    'janela_atribuicao_dias', p.janela_atribuicao_dias,
    'carencia_dias', p.carencia_dias,
    'saque_minimo', p.saque_minimo,
    'pontos_por_real', p.pontos_por_real,
    'ativo', p.ativo
  ) ORDER BY p.nome), '[]'::jsonb)
  INTO v_programs
  FROM public.gsa_afiliado_programas p
  WHERE p.ativo;

  SELECT coalesce(max(CASE WHEN key = 'afiliado_pontos_resgate_taxa' THEN value::numeric END), 0.01),
         coalesce(max(CASE WHEN key = 'afiliado_pontos_minimo_resgate' THEN value::integer END), 100),
         coalesce(max(CASE WHEN key = 'afiliado_pontos_ativo' THEN value END)::boolean, true)
    INTO v_points_rate, v_points_minimum, v_points_active
  FROM public.system_settings
  WHERE key IN ('afiliado_pontos_resgate_taxa','afiliado_pontos_minimo_resgate','afiliado_pontos_ativo');

  IF v_affiliate.id IS NOT NULL THEN
    SELECT coalesce(jsonb_agg(to_jsonb(x) ORDER BY x.created_at DESC), '[]'::jsonb)
      INTO v_links
    FROM (
      SELECT l.id, l.programa_id, p.codigo AS programa_codigo, p.nome AS programa_nome,
             l.codigo, l.destino, coalesce(l.titulo, p.nome) AS titulo, l.ativo, l.created_at,
             (SELECT count(*) FROM public.gsa_afiliado_cliques c WHERE c.link_id = l.id) AS cliques,
             (SELECT count(*) FROM public.gsa_afiliado_conversoes c WHERE c.afiliado_id = l.afiliado_id AND c.programa_id = l.programa_id AND c.status = 'confirmada') AS conversoes,
             (SELECT coalesce(sum(m.valor), 0) FROM public.gsa_afiliado_comissoes m WHERE m.afiliado_id = l.afiliado_id AND m.programa_id = l.programa_id AND m.status <> 'revertida') AS comissao_total
      FROM public.gsa_afiliado_links l
      JOIN public.gsa_afiliado_programas p ON p.id = l.programa_id
      WHERE l.afiliado_id = v_affiliate.id
    ) x;

    SELECT coalesce(jsonb_agg(to_jsonb(x) ORDER BY x.created_at DESC), '[]'::jsonb)
      INTO v_commissions
    FROM (
      SELECT m.id, p.codigo AS programa_codigo, p.nome AS programa_nome, coalesce(p.carencia_dias, 30) AS carencia_dias,
             c.origem_tipo, c.origem_id, c.base_elegivel, c.valor_bruto,
             m.percentual_snapshot AS percentual, m.valor, m.status,
             (m.created_at + make_interval(days => coalesce(p.carencia_dias, 30))) AS disponivel_em, m.created_at,
             coalesce(
               CASE
                 WHEN c.origem_tipo = 'orcamentos' THEN (SELECT codigo_orcamento FROM public.orcamentos WHERE id = c.origem_id)
                 WHEN c.origem_tipo = 'faturas' THEN (SELECT codigo_fatura FROM public.faturas WHERE id = c.origem_id)
                 WHEN c.origem_tipo = 'viagens_transacoes' THEN (SELECT codigo_reserva_fornecedor FROM public.viagens_transacoes WHERE id = c.origem_id)
                 WHEN c.origem_tipo = 'saude_contratos' THEN (SELECT numero_contrato FROM public.saude_contratos WHERE id = c.origem_id)
                 WHEN c.origem_tipo = 'seguros_apolices' THEN (SELECT numero FROM public.seguros_apolices WHERE id = c.origem_id)
               END,
               'REF-' || upper(right(replace(c.origem_id::text, '-', ''), 8))
             ) AS codigo_referencia
      FROM public.gsa_afiliado_comissoes m
      JOIN public.gsa_afiliado_conversoes c ON c.id = m.conversao_id
      JOIN public.gsa_afiliado_programas p ON p.id = m.programa_id
      WHERE m.afiliado_id = v_affiliate.id
      ORDER BY m.created_at DESC
      LIMIT 300
    ) x;

    SELECT coalesce(jsonb_agg(to_jsonb(x) ORDER BY x.solicitado_em DESC), '[]'::jsonb)
      INTO v_payouts
    FROM (
      SELECT s.id, s.valor, s.status, s.pix_tipo_snapshot AS pix_tipo,
             CASE WHEN length(s.pix_chave_snapshot) > 4 THEN repeat('*', greatest(length(s.pix_chave_snapshot) - 4, 4)) || right(s.pix_chave_snapshot, 4) ELSE '****' END AS pix_chave_mascarada,
             s.solicitado_em, s.pago_em,
             CASE WHEN s.notas LIKE 'Ação %' THEN NULL ELSE s.notas END AS motivo
      FROM public.gsa_afiliado_saques s
      WHERE s.afiliado_id = v_affiliate.id
      ORDER BY s.solicitado_em DESC
      LIMIT 200
    ) x;

    -- Extrato de eventos de pontos
    SELECT coalesce(jsonb_agg(to_jsonb(x) ORDER BY x.created_at DESC), '[]'::jsonb)
      INTO v_points_events
    FROM (
      SELECT e.id, e.tipo, e.pontos_assinados AS pontos, e.valor_carteira, e.metadata, e.created_at
      FROM public.gsa_afiliado_pontos_eventos e
      WHERE e.cliente_id = v_cliente_id
      ORDER BY e.created_at DESC
      LIMIT 200
    ) x;
  END IF;

  SELECT jsonb_build_object(
    'cliques', coalesce((SELECT count(*) FROM public.gsa_afiliado_cliques c JOIN public.gsa_afiliado_links l ON l.id = c.link_id WHERE l.afiliado_id = v_affiliate.id), 0),
    'conversoes', coalesce((SELECT count(*) FROM public.gsa_afiliado_conversoes c WHERE c.afiliado_id = v_affiliate.id AND c.status = 'confirmada'), 0),
    'total_pendente', coalesce((SELECT sum(valor) FROM public.gsa_afiliado_comissoes WHERE afiliado_id = v_affiliate.id AND status = 'pendente'), 0),
    'total_disponivel', greatest(
      coalesce((SELECT sum(valor - pago_valor) FROM public.gsa_afiliado_comissoes WHERE afiliado_id = v_affiliate.id AND status = 'disponivel'), 0)
      + v_wallet
      - coalesce((SELECT sum(valor) FROM public.gsa_afiliado_saques WHERE afiliado_id = v_affiliate.id AND status IN ('solicitado','aprovado')), 0), 0
    ),
    'total_pago', coalesce((SELECT sum(valor) FROM public.gsa_afiliado_saques WHERE afiliado_id = v_affiliate.id AND status = 'pago'), 0),
    'total_solicitado', coalesce((SELECT sum(valor) FROM public.gsa_afiliado_saques WHERE afiliado_id = v_affiliate.id AND status IN ('solicitado','aprovado')), 0),
    'saque_minimo', coalesce((SELECT min(p.saque_minimo) FROM public.gsa_afiliado_programas p WHERE p.ativo), 50),
    'pontos', v_points,
    'saldo_carteira', v_wallet,
    'pontos_taxa', v_points_rate,
    'pontos_minimo', v_points_minimum,
    'pontos_ativo', v_points_active
  ) INTO v_summary;

  RETURN jsonb_build_object(
    'success', true,
    'affiliate', CASE WHEN v_affiliate.id IS NULL THEN NULL ELSE jsonb_build_object(
      'id', v_affiliate.id,
      'codigo_publico', v_affiliate.codigo_publico,
      'nome_divulgacao', v_affiliate.nome_divulgacao,
      'nome_completo', v_cliente_nome,
      'cpf', v_cliente_cpf,
      'status', v_affiliate.status,
      'pix_tipo', v_affiliate.pix_tipo,
      'pix_chave', v_affiliate.pix_chave,
      'termos_versao', v_affiliate.termos_versao,
      'termos_aceitos_em', v_affiliate.termos_aceitos_em
    ) END,
    'summary', v_summary,
    'programs', coalesce(v_programs, '[]'::jsonb),
    'links', coalesce(v_links, '[]'::jsonb),
    'commissions', coalesce(v_commissions, '[]'::jsonb),
    'payouts', coalesce(v_payouts, '[]'::jsonb),
    'points_events', coalesce(v_points_events, '[]'::jsonb)
  );
END;
$function$;


-- 5. Criar / Atualizar RPCs Administrativas Faltantes

-- 5.1 gsa_admin_update_affiliate_points_settings
CREATE OR REPLACE FUNCTION public.gsa_admin_update_affiliate_points_settings(
  p_sessao_id uuid,
  p_session_token text,
  p_rate numeric,
  p_minimum integer,
  p_active boolean,
  p_welcome_active boolean DEFAULT true,
  p_welcome_value numeric DEFAULT 100
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $function$
BEGIN
  PERFORM public.gsa_admin_validate_context(p_sessao_id, p_session_token);
  PERFORM public.gsa_admin_assert_module('afiliados');
  IF coalesce(p_rate, 0) <= 0 OR p_rate > 100 THEN RAISE EXCEPTION 'Taxa de pontos inválida.'; END IF;
  IF coalesce(p_minimum, 0) < 1 OR p_minimum > 1000000 THEN RAISE EXCEPTION 'Mínimo de pontos inválido.'; END IF;

  INSERT INTO public.system_settings(key, value) VALUES
    ('afiliado_pontos_resgate_taxa', p_rate::text),
    ('afiliado_pontos_minimo_resgate', p_minimum::text),
    ('afiliado_pontos_ativo', coalesce(p_active, true)::text),
    ('afiliado_bonus_boas_vindas_ativo', coalesce(p_welcome_active, true)::text),
    ('afiliado_bonus_boas_vindas_valor', coalesce(p_welcome_value, 100)::text)
  ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value;

  PERFORM public.gsa_admin_write_audit('afiliados', 'ATUALIZAR_PONTOS_AFILIADO', 'system_settings', NULL, jsonb_build_object('taxa', p_rate, 'minimo', p_minimum, 'ativo', p_active, 'welcome_ativo', p_welcome_active, 'welcome_valor', p_welcome_value));
  RETURN jsonb_build_object('success', true);
END;
$function$;

-- 5.2 gsa_admin_release_affiliate_commissions
CREATE OR REPLACE FUNCTION public.gsa_admin_release_affiliate_commissions(
  p_sessao_id uuid,
  p_session_token text,
  p_afiliado_id uuid DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  v_count integer := 0;
BEGIN
  PERFORM public.gsa_admin_validate_context(p_sessao_id, p_session_token);
  PERFORM public.gsa_admin_assert_module('afiliados');

  IF p_afiliado_id IS NOT NULL THEN
    UPDATE public.gsa_afiliado_comissoes
       SET status = 'disponivel', disponivel_em = now()
     WHERE afiliado_id = p_afiliado_id AND status = 'pendente';
  ELSE
    UPDATE public.gsa_afiliado_comissoes
       SET status = 'disponivel', disponivel_em = now()
     WHERE status = 'pendente';
  END IF;

  GET DIAGNOSTICS v_count = ROW_COUNT;

  PERFORM public.gsa_admin_write_audit('afiliados', 'LIBERAR_CARENCIA_COMISSOES', 'gsa_afiliado_comissoes', p_afiliado_id, jsonb_build_object('afiliado_id', p_afiliado_id, 'liberados', v_count));
  RETURN jsonb_build_object('success', true, 'released_count', v_count);
END;
$function$;

-- 5.3 gsa_admin_update_affiliate_details
CREATE OR REPLACE FUNCTION public.gsa_admin_update_affiliate_details(
  p_sessao_id uuid,
  p_session_token text,
  p_affiliate_id uuid,
  p_nome_divulgacao text,
  p_codigo_publico text DEFAULT NULL,
  p_pix_tipo text DEFAULT NULL,
  p_pix_chave text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  v_type text := public.gsa_affiliate_normalize_pix_type(p_pix_tipo, p_pix_chave);
BEGIN
  PERFORM public.gsa_admin_validate_context(p_sessao_id, p_session_token);
  PERFORM public.gsa_admin_assert_module('afiliados');

  IF length(trim(coalesce(p_nome_divulgacao, ''))) NOT BETWEEN 3 AND 120 THEN
    RAISE EXCEPTION 'Nome de divulgação inválido.';
  END IF;

  UPDATE public.gsa_afiliados
     SET nome_divulgacao = trim(p_nome_divulgacao),
         codigo_publico = coalesce(nullif(trim(p_codigo_publico), ''), codigo_publico),
         pix_tipo = v_type,
         pix_chave = coalesce(nullif(trim(p_pix_chave), ''), pix_chave),
         updated_at = now()
   WHERE id = p_affiliate_id;

  PERFORM public.gsa_admin_write_audit('afiliados', 'ATUALIZAR_CADASTRO_AFILIADO', 'gsa_afiliados', p_affiliate_id, jsonb_build_object('nome_divulgacao', p_nome_divulgacao, 'pix_tipo', v_type));
  RETURN jsonb_build_object('success', true);
END;
$function$;

-- 5.4 gsa_admin_adjust_affiliate_balance
CREATE OR REPLACE FUNCTION public.gsa_admin_adjust_affiliate_balance(
  p_sessao_id uuid,
  p_session_token text,
  p_afiliado_id uuid,
  p_tipo text,
  p_valor numeric,
  p_motivo text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  v_cliente_id uuid;
  v_conv_id uuid;
  v_comm_id uuid;
  v_val numeric(14,2) := round(coalesce(p_valor, 0), 2);
BEGIN
  PERFORM public.gsa_admin_validate_context(p_sessao_id, p_session_token);
  PERFORM public.gsa_admin_assert_module('afiliados');

  IF v_val = 0 THEN RAISE EXCEPTION 'O valor do ajuste deve ser diferente de zero.'; END IF;
  IF length(trim(coalesce(p_motivo, ''))) < 3 THEN RAISE EXCEPTION 'Motivo do ajuste é obrigatório.'; END IF;

  SELECT cliente_id INTO v_cliente_id FROM public.gsa_afiliados WHERE id = p_afiliado_id;
  IF v_cliente_id IS NULL THEN RAISE EXCEPTION 'Afiliado não encontrado.'; END IF;

  IF p_tipo = 'pontos' THEN
    UPDATE public.clientes
       SET pontos = greatest(coalesce(pontos, 0) + v_val, 0),
           saldo_pontos = greatest(coalesce(saldo_pontos, 0) + floor(v_val)::integer, 0),
           updated_at = now()
     WHERE id = v_cliente_id;

    INSERT INTO public.gsa_afiliado_pontos_eventos(cliente_id, afiliado_id, tipo, pontos_assinados, metadata)
    VALUES (v_cliente_id, p_afiliado_id, 'ajuste', v_val, jsonb_build_object('descricao', left(trim(p_motivo), 500)));
  ELSE
    -- Ajuste em comissões / saldo
    INSERT INTO public.gsa_afiliado_conversoes(
      afiliado_id, programa_id, comprador_id, origem_tipo, origem_id, evento, valor_bruto, base_elegivel, metadata
    ) VALUES (
      p_afiliado_id, (SELECT id FROM public.gsa_afiliado_programas WHERE ativo LIMIT 1), v_cliente_id,
      'ajuste_manual', gen_random_uuid(), 'ajuste_admin', abs(v_val), abs(v_val), jsonb_build_object('motivo', p_motivo)
    ) RETURNING id INTO v_conv_id;

    INSERT INTO public.gsa_afiliado_comissoes(
      conversao_id, afiliado_id, programa_id, percentual_snapshot, base_elegivel_snapshot, valor, status, disponivel_em
    ) VALUES (
      v_conv_id, p_afiliado_id, (SELECT id FROM public.gsa_afiliado_programas WHERE ativo LIMIT 1),
      100, abs(v_val), v_val, 'disponivel', now()
    ) RETURNING id INTO v_comm_id;

    INSERT INTO public.gsa_afiliado_comissao_eventos(
      afiliado_id, comissao_id, tipo, valor_assinado, efetivo_em, metadata
    ) VALUES (
      p_afiliado_id, v_comm_id, 'ajuste', v_val, now(), jsonb_build_object('motivo', p_motivo)
    );
  END IF;

  PERFORM public.gsa_admin_write_audit('afiliados', 'AJUSTE_MANUAL_AFILIADO', 'gsa_afiliados', p_afiliado_id, jsonb_build_object('tipo', p_tipo, 'valor', v_val, 'motivo', p_motivo));
  RETURN jsonb_build_object('success', true);
END;
$function$;

-- 5.5 gsa_admin_update_global_saque_minimo
CREATE OR REPLACE FUNCTION public.gsa_admin_update_global_saque_minimo(
  p_sessao_id uuid,
  p_session_token text,
  p_valor numeric
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  v_val numeric(14,2) := round(coalesce(p_valor, 0), 2);
BEGIN
  PERFORM public.gsa_admin_validate_context(p_sessao_id, p_session_token);
  PERFORM public.gsa_admin_assert_module('afiliados');

  IF v_val <= 0 THEN RAISE EXCEPTION 'Valor de saque mínimo inválido.'; END IF;

  UPDATE public.gsa_afiliado_programas
     SET saque_minimo = v_val, updated_at = now()
   WHERE ativo;

  INSERT INTO public.system_settings(key, value)
  VALUES ('afiliado_saque_minimo_global', v_val::text)
  ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value;

  PERFORM public.gsa_admin_write_audit('afiliados', 'ATUALIZAR_SAQUE_MINIMO_GLOBAL', 'gsa_afiliado_programas', NULL, jsonb_build_object('saque_minimo', v_val));
  RETURN jsonb_build_object('success', true);
END;
$function$;

-- 5.6 Atualizar gsa_admin_affiliate_snapshot para incluir dados completissimos de clientes
CREATE OR REPLACE FUNCTION public.gsa_admin_affiliate_snapshot(
  p_sessao_id uuid,
  p_session_token text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  v_summary jsonb;
  v_programs jsonb := '[]'::jsonb;
  v_affiliates jsonb := '[]'::jsonb;
  v_payouts jsonb := '[]'::jsonb;
  v_welcome_active boolean := true;
  v_welcome_val numeric := 100;
  v_points_rate numeric := 0.01;
  v_points_minimum integer := 100;
  v_points_active boolean := true;
BEGIN
  PERFORM public.gsa_admin_validate_context(p_sessao_id, p_session_token);
  PERFORM public.gsa_admin_assert_module('afiliados');

  PERFORM public.gsa_affiliate_release_due_commissions();

  SELECT coalesce(max(CASE WHEN key = 'afiliado_pontos_resgate_taxa' THEN value::numeric END), 0.01),
         coalesce(max(CASE WHEN key = 'afiliado_pontos_minimo_resgate' THEN value::integer END), 100),
         coalesce(max(CASE WHEN key = 'afiliado_pontos_ativo' THEN value END)::boolean, true),
         coalesce(max(CASE WHEN key = 'afiliado_bonus_boas_vindas_ativo' THEN value END)::boolean, true),
         coalesce(max(CASE WHEN key = 'afiliado_bonus_boas_vindas_valor' THEN value::numeric END), 100)
    INTO v_points_rate, v_points_minimum, v_points_active, v_welcome_active, v_welcome_val
  FROM public.system_settings
  WHERE key IN ('afiliado_pontos_resgate_taxa','afiliado_pontos_minimo_resgate','afiliado_pontos_ativo','afiliado_bonus_boas_vindas_ativo','afiliado_bonus_boas_vindas_valor');

  SELECT jsonb_build_object(
    'afiliados_ativos', (SELECT count(*) FROM public.gsa_afiliados WHERE status = 'ativo'),
    'cliques', (SELECT count(*) FROM public.gsa_afiliado_cliques),
    'vendas_atribuidas', (SELECT count(*) FROM public.gsa_afiliado_conversoes WHERE status = 'confirmada'),
    'comissoes_pendentes', coalesce((SELECT sum(valor) FROM public.gsa_afiliado_comissoes WHERE status = 'pendente'), 0),
    'comissoes_disponiveis', coalesce((SELECT sum(valor - pago_valor) FROM public.gsa_afiliado_comissoes WHERE status = 'disponivel'), 0),
    'saques_pendentes', (SELECT count(*) FROM public.gsa_afiliado_saques WHERE status IN ('solicitado','aprovado')),
    'saque_minimo', coalesce((SELECT min(saque_minimo) FROM public.gsa_afiliado_programas WHERE ativo), 50),
    'pontos_taxa', v_points_rate,
    'pontos_minimo', v_points_minimum,
    'pontos_ativo', v_points_active,
    'welcome_ativo', v_welcome_active,
    'welcome_valor', v_welcome_val
  ) INTO v_summary;

  SELECT coalesce(jsonb_agg(to_jsonb(p) ORDER BY p.nome), '[]'::jsonb)
    INTO v_programs
  FROM public.gsa_afiliado_programas p;

  SELECT coalesce(jsonb_agg(to_jsonb(x) ORDER BY x.created_at DESC), '[]'::jsonb)
    INTO v_affiliates
  FROM (
    SELECT a.id, a.cliente_id, a.codigo_publico, a.nome_divulgacao, a.status,
           a.pix_tipo, a.pix_chave,
           CASE WHEN length(a.pix_chave) > 4 THEN repeat('*', greatest(length(a.pix_chave) - 4, 4)) || right(a.pix_chave, 4) ELSE '****' END AS pix_chave_mascarada,
           a.created_at,
           c.nome AS cliente_nome_completo,
           c.cpf AS cliente_cpf,
           c.cnpj AS cliente_cnpj,
           c.email AS cliente_email,
           c.telefone AS cliente_telefone,
           c.tipo_pessoa AS cliente_tipo_pessoa,
           (SELECT count(*) FROM public.gsa_afiliado_cliques k JOIN public.gsa_afiliado_links l ON l.id = k.link_id WHERE l.afiliado_id = a.id) AS cliques,
           (SELECT count(*) FROM public.gsa_afiliado_conversoes v WHERE v.afiliado_id = a.id AND v.status = 'confirmada') AS conversoes,
           (SELECT coalesce(sum(valor), 0) FROM public.gsa_afiliado_comissoes WHERE afiliado_id = a.id AND status <> 'revertida') AS comissao_total,
           (SELECT coalesce(sum(valor), 0) FROM public.gsa_afiliado_comissoes WHERE afiliado_id = a.id AND status = 'pendente') AS comissao_pendente,
           greatest(
             coalesce((SELECT sum(valor - pago_valor) FROM public.gsa_afiliado_comissoes WHERE afiliado_id = a.id AND status = 'disponivel'), 0)
             + coalesce(c.saldo_carteira, 0)
             - coalesce((SELECT sum(valor) FROM public.gsa_afiliado_saques WHERE afiliado_id = a.id AND status IN ('solicitado','aprovado')), 0), 0
           ) AS saldo_disponivel
    FROM public.gsa_afiliados a
    LEFT JOIN public.clientes c ON c.id = a.cliente_id
  ) x;

  SELECT coalesce(jsonb_agg(to_jsonb(x) ORDER BY x.solicitado_em DESC), '[]'::jsonb)
    INTO v_payouts
  FROM (
    SELECT s.id, s.afiliado_id, a.nome_divulgacao, a.codigo_publico,
           c.nome AS cliente_nome_completo,
           s.valor, s.status, s.pix_tipo_snapshot AS pix_tipo,
           CASE WHEN length(s.pix_chave_snapshot) > 4 THEN repeat('*', greatest(length(s.pix_chave_snapshot) - 4, 4)) || right(s.pix_chave_snapshot, 4) ELSE s.pix_chave_snapshot END AS pix_chave,
           s.solicitado_em, s.aprovado_em, s.pago_em, s.notas
    FROM public.gsa_afiliado_saques s
    JOIN public.gsa_afiliados a ON a.id = s.afiliado_id
    LEFT JOIN public.clientes c ON c.id = a.cliente_id
  ) x;

  RETURN jsonb_build_object(
    'success', true,
    'summary', v_summary,
    'programs', v_programs,
    'affiliates', v_affiliates,
    'payouts', v_payouts
  );
END;
$function$;


-- 6. Re-conceder permissões de execução (GRANTS)

REVOKE ALL ON FUNCTION public.gsa_client_join_affiliate(uuid,text,text,text,text,text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.gsa_client_join_affiliate(uuid,text,text,text,text,text) TO authenticated, service_role;

REVOKE ALL ON FUNCTION public.gsa_client_request_affiliate_payout(uuid,text,uuid,numeric) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.gsa_client_request_affiliate_payout(uuid,text,uuid,numeric) TO authenticated, service_role;

REVOKE ALL ON FUNCTION public.gsa_client_affiliate_snapshot(uuid,text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.gsa_client_affiliate_snapshot(uuid,text) TO authenticated, service_role;

REVOKE ALL ON FUNCTION public.gsa_admin_update_affiliate_points_settings(uuid,text,numeric,integer,boolean,boolean,numeric) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.gsa_admin_update_affiliate_points_settings(uuid,text,numeric,integer,boolean,boolean,numeric) TO authenticated, service_role;

REVOKE ALL ON FUNCTION public.gsa_admin_release_affiliate_commissions(uuid,text,uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.gsa_admin_release_affiliate_commissions(uuid,text,uuid) TO authenticated, service_role;

REVOKE ALL ON FUNCTION public.gsa_admin_update_affiliate_details(uuid,text,uuid,text,text,text,text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.gsa_admin_update_affiliate_details(uuid,text,uuid,text,text,text,text) TO authenticated, service_role;

REVOKE ALL ON FUNCTION public.gsa_admin_adjust_affiliate_balance(uuid,text,uuid,text,numeric,text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.gsa_admin_adjust_affiliate_balance(uuid,text,uuid,text,numeric,text) TO authenticated, service_role;

REVOKE ALL ON FUNCTION public.gsa_admin_update_global_saque_minimo(uuid,text,numeric) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.gsa_admin_update_global_saque_minimo(uuid,text,numeric) TO authenticated, service_role;

REVOKE ALL ON FUNCTION public.gsa_admin_affiliate_snapshot(uuid,text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.gsa_admin_affiliate_snapshot(uuid,text) TO authenticated, service_role;

COMMIT;
