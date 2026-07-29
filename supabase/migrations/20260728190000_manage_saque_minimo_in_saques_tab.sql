-- Migration: Move saque minimo management to Saques tab & update admin snapshot / payout RPCs

CREATE OR REPLACE FUNCTION public.gsa_admin_update_global_saque_minimo(
  p_sessao_id uuid,
  p_session_token text,
  p_valor numeric
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  PERFORM public.gsa_admin_validate_context(p_sessao_id, p_session_token);
  PERFORM public.gsa_admin_assert_module('afiliados');

  IF coalesce(p_valor, 0) <= 0 THEN
    RAISE EXCEPTION 'O valor minimo para saque deve ser superior a zero.';
  END IF;

  UPDATE public.gsa_afiliado_programas
     SET saque_minimo = round(p_valor, 2),
         updated_at = now()
   WHERE id IS NOT NULL;

  INSERT INTO public.system_settings(key, value)
  VALUES ('afiliado_saque_minimo', round(p_valor, 2)::text)
  ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value;

  PERFORM public.gsa_admin_write_audit('afiliados','ATUALIZAR_SAQUE_MINIMO','system_settings',null,jsonb_build_object('saque_minimo', p_valor));

  RETURN jsonb_build_object('success', true, 'saque_minimo', round(p_valor, 2));
END;
$$;

CREATE OR REPLACE FUNCTION public.gsa_admin_affiliate_snapshot(
  p_sessao_id uuid,
  p_session_token text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_summary jsonb;
  v_programs jsonb;
  v_affiliates jsonb;
  v_payouts jsonb;
BEGIN
  PERFORM public.gsa_admin_validate_context(p_sessao_id, p_session_token);
  PERFORM public.gsa_admin_assert_module('afiliados');
  PERFORM public.gsa_affiliate_release_due_commissions();

  SELECT jsonb_build_object(
    'afiliados_ativos', (SELECT count(*) FROM public.gsa_afiliados WHERE status = 'ativo'),
    'cliques', (SELECT count(*) FROM public.gsa_afiliado_cliques),
    'vendas_atribuidas', (SELECT count(*) FROM public.gsa_afiliado_conversoes WHERE status = 'confirmada'),
    'comissoes_pendentes', coalesce((SELECT sum(valor) FROM public.gsa_afiliado_comissoes WHERE status = 'pendente'), 0),
    'comissoes_disponiveis', coalesce((SELECT sum(valor - pago_valor) FROM public.gsa_afiliado_comissoes WHERE status = 'disponivel'), 0),
    'saques_pendentes', (SELECT count(*) FROM public.gsa_afiliado_saques WHERE status IN ('solicitado','aprovado')),
    'saque_minimo', coalesce((SELECT value::numeric FROM public.system_settings WHERE key = 'afiliado_saque_minimo'), (SELECT min(saque_minimo) FROM public.gsa_afiliado_programas WHERE ativo), 50)
  ) INTO v_summary;

  SELECT coalesce(jsonb_agg(to_jsonb(p) ORDER BY p.nome), '[]'::jsonb) INTO v_programs
  FROM public.gsa_afiliado_programas p;

  SELECT coalesce(jsonb_agg(to_jsonb(x) ORDER BY x.created_at DESC), '[]'::jsonb) INTO v_affiliates
  FROM (
    SELECT a.id, a.cliente_id, a.nome_divulgacao, a.codigo_publico, a.status,
           a.pix_tipo,
           CASE WHEN a.pix_chave IS NULL THEN NULL ELSE repeat('*', greatest(length(a.pix_chave) - 4, 4)) || right(a.pix_chave, 4) END AS pix_chave_mascarada,
           a.pix_chave, a.created_at,
           (SELECT count(*) FROM public.gsa_afiliado_cliques c JOIN public.gsa_afiliado_links l ON l.id = c.link_id WHERE l.afiliado_id = a.id) AS cliques,
           (SELECT count(*) FROM public.gsa_afiliado_conversoes c WHERE c.afiliado_id = a.id AND c.status = 'confirmada') AS conversoes,
           (SELECT coalesce(sum(valor), 0) FROM public.gsa_afiliado_comissoes WHERE afiliado_id = a.id AND status <> 'revertida') AS comissao_total,
           (SELECT coalesce(sum(valor), 0) FROM public.gsa_afiliado_comissoes WHERE afiliado_id = a.id AND status = 'pendente') AS comissao_pendente,
           greatest(
             coalesce((SELECT sum(valor - pago_valor) FROM public.gsa_afiliado_comissoes WHERE afiliado_id = a.id AND status = 'disponivel'), 0)
             + coalesce((SELECT saldo_carteira FROM public.clientes WHERE id = a.cliente_id), 0)
             - coalesce((SELECT sum(valor) FROM public.gsa_afiliado_saques WHERE afiliado_id = a.id AND status IN ('solicitado','aprovado')), 0), 0
           ) AS saldo_disponivel,
           c.nome AS cliente_nome_completo,
           c.cpf AS cliente_cpf,
           c.cnpj AS cliente_cnpj,
           c.email AS cliente_email,
           c.telefone AS cliente_telefone,
           c.tipo_pessoa AS cliente_tipo_pessoa
    FROM public.gsa_afiliados a
    JOIN public.clientes c ON c.id = a.cliente_id
  ) x;

  SELECT coalesce(jsonb_agg(to_jsonb(x) ORDER BY x.solicitado_em DESC), '[]'::jsonb) INTO v_payouts
  FROM (
    SELECT s.id, s.afiliado_id,
           coalesce(nullif(trim(c.nome), ''), a.nome_divulgacao) AS afiliado_nome,
           c.nome AS cliente_nome_completo,
           a.nome_divulgacao,
           a.codigo_publico,
           s.valor, s.status, s.pix_tipo_snapshot AS pix_tipo, s.pix_chave_snapshot AS pix_chave,
           s.solicitado_em, s.aprovado_em, s.pago_em, s.notas
    FROM public.gsa_afiliado_saques s
    JOIN public.gsa_afiliados a ON a.id = s.afiliado_id
    LEFT JOIN public.clientes c ON c.id = a.cliente_id
  ) x;

  RETURN jsonb_build_object('success', true, 'summary', v_summary, 'programs', v_programs, 'affiliates', v_affiliates, 'payouts', v_payouts);
END;
$$;

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

  SELECT coalesce((SELECT value::numeric FROM public.system_settings WHERE key = 'afiliado_saque_minimo'), (SELECT min(saque_minimo) FROM public.gsa_afiliado_programas WHERE ativo), 50) INTO v_minimum;
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

REVOKE ALL ON FUNCTION public.gsa_admin_update_global_saque_minimo(uuid,text,numeric) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.gsa_admin_update_global_saque_minimo(uuid,text,numeric) TO authenticated, service_role;

REVOKE ALL ON FUNCTION public.gsa_admin_affiliate_snapshot(uuid,text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.gsa_admin_affiliate_snapshot(uuid,text) TO authenticated, service_role;

REVOKE ALL ON FUNCTION public.gsa_client_request_affiliate_payout(uuid,text,uuid,numeric) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.gsa_client_request_affiliate_payout(uuid,text,uuid,numeric) TO authenticated, service_role;
