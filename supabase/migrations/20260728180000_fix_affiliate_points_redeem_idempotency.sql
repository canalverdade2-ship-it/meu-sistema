-- Migration: Include wallet balance in affiliate available payout balance & fix redeem points trigger override

-- 1. gsa_client_affiliate_snapshot
CREATE OR REPLACE FUNCTION public.gsa_client_affiliate_snapshot(
  p_sessao_id uuid,
  p_session_token text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_actor record;
  v_affiliate public.gsa_afiliados%rowtype;
  v_programs jsonb := '[]'::jsonb;
  v_links jsonb := '[]'::jsonb;
  v_commissions jsonb := '[]'::jsonb;
  v_payouts jsonb := '[]'::jsonb;
  v_summary jsonb;
  v_points numeric := 0;
  v_wallet numeric := 0;
  v_points_rate numeric := 0.01;
  v_points_minimum integer := 100;
  v_points_active boolean := true;
  v_cliente_nome text := '';
  v_cliente_cpf text := '';
BEGIN
  SELECT * INTO v_actor FROM public.gsa_client_session_actor(p_sessao_id, p_session_token) LIMIT 1;
  PERFORM public.gsa_affiliate_release_due_commissions();

  SELECT * INTO v_affiliate FROM public.gsa_afiliados WHERE cliente_id = v_actor.cliente_id;

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

  SELECT coalesce(c.pontos, 0), coalesce(c.saldo_carteira, 0), coalesce(c.nome, ''), coalesce(c.cpf, c.cnpj, '')
    INTO v_points, v_wallet, v_cliente_nome, v_cliente_cpf
  FROM public.clientes c WHERE c.id = v_actor.cliente_id;

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
      SELECT m.id, p.codigo AS programa_codigo, p.nome AS programa_nome,
             c.origem_tipo, c.origem_id, c.base_elegivel,
             m.percentual_snapshot AS percentual, m.valor, m.status,
             m.disponivel_em, m.created_at
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
             s.solicitado_em, s.pago_em, s.notas AS motivo
      FROM public.gsa_afiliado_saques s
      WHERE s.afiliado_id = v_affiliate.id
      ORDER BY s.solicitado_em DESC
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
      'termos_aceitos_em', v_affiliate.termos_aceitos_em,
      'created_at', v_affiliate.created_at
    ) END,
    'programs', v_programs,
    'links', v_links,
    'summary', v_summary,
    'commissions', v_commissions,
    'payouts', v_payouts
  );
END;
$$;

-- 2. gsa_client_request_affiliate_payout
CREATE OR REPLACE FUNCTION public.gsa_client_request_affiliate_payout(
  p_sessao_id uuid,
  p_session_token text,
  p_request_id uuid,
  p_valor numeric
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_actor record;
  v_affiliate public.gsa_afiliados%rowtype;
  v_available numeric(14,2);
  v_minimum numeric(14,2);
  v_payout public.gsa_afiliado_saques%rowtype;
BEGIN
  SELECT * INTO v_actor FROM public.gsa_client_session_actor(p_sessao_id, p_session_token) LIMIT 1;
  SELECT * INTO v_affiliate FROM public.gsa_afiliados WHERE cliente_id = v_actor.cliente_id AND status = 'ativo' FOR UPDATE;
  IF v_affiliate.id IS NULL THEN RAISE EXCEPTION 'Perfil de afiliado ativo nao encontrado.'; END IF;
  IF p_request_id IS NULL THEN RAISE EXCEPTION 'Identificador da solicitacao obrigatorio.'; END IF;

  SELECT coalesce(min(saque_minimo), 50) INTO v_minimum FROM public.gsa_afiliado_programas WHERE ativo;
  IF coalesce(p_valor, 0) < v_minimum THEN RAISE EXCEPTION 'O valor minimo para saque e R$ %.', v_minimum; END IF;
  IF v_affiliate.pix_chave IS NULL OR v_affiliate.pix_tipo IS NULL THEN RAISE EXCEPTION 'Cadastre uma chave PIX antes de solicitar saque.'; END IF;

  SELECT greatest(
    coalesce((SELECT sum(valor - pago_valor) FROM public.gsa_afiliado_comissoes WHERE afiliado_id = v_affiliate.id AND status = 'disponivel'), 0)
    + coalesce((SELECT saldo_carteira FROM public.clientes WHERE id = v_actor.cliente_id), 0)
    - coalesce((SELECT sum(valor) FROM public.gsa_afiliado_saques WHERE afiliado_id = v_affiliate.id AND status IN ('solicitado','aprovado')), 0), 0
  ) INTO v_available;
  IF p_valor > v_available THEN RAISE EXCEPTION 'Saldo disponivel insuficiente.'; END IF;

  INSERT INTO public.gsa_afiliado_saques(afiliado_id, request_id, valor, status, pix_tipo_snapshot, pix_chave_snapshot)
  VALUES (v_affiliate.id, p_request_id, round(p_valor, 2), 'solicitado', v_affiliate.pix_tipo, v_affiliate.pix_chave)
  ON CONFLICT (request_id) DO UPDATE SET request_id = EXCLUDED.request_id
  RETURNING * INTO v_payout;

  RETURN jsonb_build_object('success', true, 'payout_id', v_payout.id, 'status', v_payout.status);
END;
$$;

-- 3. gsa_client_redeem_affiliate_points
CREATE OR REPLACE FUNCTION public.gsa_client_redeem_affiliate_points(
  p_sessao_id uuid,
  p_session_token text,
  p_request_id uuid,
  p_pontos numeric
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_actor record;
  v_points numeric(14,2);
  v_rate numeric := 0.01;
  v_minimum numeric := 100;
  v_active boolean := true;
  v_credit numeric(14,2);
  v_inserted_id uuid;
BEGIN
  SELECT * INTO v_actor FROM public.gsa_client_session_actor(p_sessao_id, p_session_token) LIMIT 1;
  IF p_request_id IS NULL THEN RAISE EXCEPTION 'Identificador da operacao obrigatorio.'; END IF;

  SELECT coalesce(max(CASE WHEN key = 'afiliado_pontos_resgate_taxa' THEN value::numeric END), 0.01),
         coalesce(max(CASE WHEN key = 'afiliado_pontos_minimo_resgate' THEN value::numeric END), 100),
         coalesce(max(CASE WHEN key = 'afiliado_pontos_ativo' THEN value END)::boolean, true)
    INTO v_rate, v_minimum, v_active
  FROM public.system_settings
  WHERE key IN ('afiliado_pontos_resgate_taxa','afiliado_pontos_minimo_resgate','afiliado_pontos_ativo');

  IF NOT v_active THEN RAISE EXCEPTION 'O resgate de pontos esta temporariamente indisponivel.'; END IF;
  IF coalesce(p_pontos, 0) < v_minimum THEN RAISE EXCEPTION 'O minimo para resgate e % pontos.', v_minimum; END IF;

  IF EXISTS (
    SELECT 1 FROM public.gsa_afiliado_pontos_eventos WHERE request_id = p_request_id
  ) THEN
    RETURN jsonb_build_object('success', true, 'idempotent', true);
  END IF;

  SELECT pontos INTO v_points FROM public.clientes WHERE id = v_actor.cliente_id FOR UPDATE;
  IF coalesce(v_points, 0) < p_pontos THEN RAISE EXCEPTION 'Saldo de pontos insuficiente.'; END IF;
  v_credit := round(p_pontos * v_rate, 2);
  IF v_credit <= 0 THEN RAISE EXCEPTION 'Conversao de pontos invalida.'; END IF;

  INSERT INTO public.gsa_afiliado_pontos_eventos(cliente_id, tipo, pontos_assinados, valor_carteira, request_id)
  VALUES (v_actor.cliente_id, 'resgate_carteira', -round(p_pontos, 2), v_credit, p_request_id)
  ON CONFLICT (request_id) WHERE request_id IS NOT NULL DO NOTHING
  RETURNING id INTO v_inserted_id;

  IF v_inserted_id IS NULL THEN
    RETURN jsonb_build_object('success', true, 'idempotent', true);
  END IF;

  -- Bypass trigger protection for financial balance update inside secure RPC
  PERFORM set_config('gsa.credit_release', 'on', true);

  UPDATE public.clientes
     SET pontos = pontos - round(p_pontos, 2),
         saldo_carteira = saldo_carteira + v_credit
   WHERE id = v_actor.cliente_id;

  RETURN jsonb_build_object('success', true, 'pontos', p_pontos, 'valor_creditado', v_credit);
END;
$$;

-- 4. gsa_admin_decide_affiliate_payout
CREATE OR REPLACE FUNCTION public.gsa_admin_decide_affiliate_payout(
  p_sessao_id uuid,
  p_session_token text,
  p_payout_id uuid,
  p_action text,
  p_notes text DEFAULT NULL,
  p_paid_at timestamptz DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_action text := lower(trim(coalesce(p_action, '')));
  v_payout public.gsa_afiliado_saques%rowtype;
  v_remaining numeric(14,2);
  v_item record;
  v_take numeric(14,2);
BEGIN
  PERFORM public.gsa_admin_validate_context(p_sessao_id, p_session_token);
  PERFORM public.gsa_admin_assert_module('afiliados');
  SELECT * INTO v_payout FROM public.gsa_afiliado_saques WHERE id = p_payout_id FOR UPDATE;
  IF v_payout.id IS NULL THEN RAISE EXCEPTION 'Saque nao encontrado.'; END IF;

  IF v_action = 'approve' THEN
    IF v_payout.status <> 'solicitado' THEN RAISE EXCEPTION 'Somente saques solicitados podem ser aprovados.'; END IF;
    UPDATE public.gsa_afiliado_saques SET status = 'aprovado', aprovado_em = now(), notas = nullif(left(trim(coalesce(p_notes, '')), 1000), ''), updated_at = now() WHERE id = v_payout.id;
  ELSIF v_action = 'reject' THEN
    IF v_payout.status NOT IN ('solicitado','aprovado') THEN RAISE EXCEPTION 'Este saque nao pode ser rejeitado.'; END IF;
    UPDATE public.gsa_afiliado_saques SET status = 'rejeitado', rejeitado_em = now(), notas = nullif(left(trim(coalesce(p_notes, '')), 1000), ''), updated_at = now() WHERE id = v_payout.id;
  ELSIF v_action = 'mark_paid' THEN
    IF v_payout.status <> 'aprovado' THEN RAISE EXCEPTION 'Aprove o saque antes de confirmar o pagamento.'; END IF;
    v_remaining := v_payout.valor;
    FOR v_item IN
      SELECT id, valor, pago_valor FROM public.gsa_afiliado_comissoes
      WHERE afiliado_id = v_payout.afiliado_id AND status = 'disponivel' AND pago_valor < valor
      ORDER BY disponivel_em, created_at FOR UPDATE
    LOOP
      EXIT WHEN v_remaining <= 0;
      v_take := least(v_remaining, v_item.valor - v_item.pago_valor);
      UPDATE public.gsa_afiliado_comissoes
         SET pago_valor = pago_valor + v_take,
             status = CASE WHEN pago_valor + v_take >= valor THEN 'paga' ELSE 'disponivel' END,
             paga_em = CASE WHEN pago_valor + v_take >= valor THEN coalesce(p_paid_at, now()) ELSE paga_em END,
             updated_at = now()
       WHERE id = v_item.id;
      v_remaining := v_remaining - v_take;
    END LOOP;
    IF v_remaining > 0 THEN
      PERFORM set_config('gsa.credit_release', 'on', true);
      UPDATE public.clientes
         SET saldo_carteira = greatest(saldo_carteira - v_remaining, 0)
       WHERE id = (SELECT cliente_id FROM public.gsa_afiliados WHERE id = v_payout.afiliado_id);
      v_remaining := 0;
    END IF;

    INSERT INTO public.gsa_afiliado_comissao_eventos(afiliado_id, saque_id, tipo, valor_assinado, efetivo_em, metadata)
    VALUES (v_payout.afiliado_id, v_payout.id, 'saque', -v_payout.valor, coalesce(p_paid_at, now()), jsonb_build_object('notas', p_notes))
    ON CONFLICT DO NOTHING;

    UPDATE public.gsa_afiliado_saques SET status = 'pago', pago_em = coalesce(p_paid_at, now()), notas = nullif(left(trim(coalesce(p_notes, '')), 1000), ''), updated_at = now() WHERE id = v_payout.id;
  ELSE
    RAISE EXCEPTION 'Acao administrativa invalida.';
  END IF;

  PERFORM public.gsa_admin_write_audit('afiliados','DECIDIR_SAQUE_AFILIADO','gsa_afiliado_saques',v_payout.id,jsonb_build_object('acao',v_action,'valor',v_payout.valor,'notas',p_notes));
  RETURN jsonb_build_object('success', true, 'payout_id', v_payout.id, 'action', v_action);
END;
$$;

REVOKE ALL ON FUNCTION public.gsa_client_affiliate_snapshot(uuid,text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.gsa_client_affiliate_snapshot(uuid,text) TO authenticated, service_role;

REVOKE ALL ON FUNCTION public.gsa_client_request_affiliate_payout(uuid,text,uuid,numeric) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.gsa_client_request_affiliate_payout(uuid,text,uuid,numeric) TO authenticated, service_role;

REVOKE ALL ON FUNCTION public.gsa_client_redeem_affiliate_points(uuid,text,uuid,numeric) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.gsa_client_redeem_affiliate_points(uuid,text,uuid,numeric) TO authenticated, service_role;

REVOKE ALL ON FUNCTION public.gsa_admin_decide_affiliate_payout(uuid,text,uuid,text,text,timestamptz) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.gsa_admin_decide_affiliate_payout(uuid,text,uuid,text,text,timestamptz) TO authenticated, service_role;
