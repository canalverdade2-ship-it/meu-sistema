BEGIN;

-- Fecha as lacunas comprovadas pelo inventário real de 22/07/2026.
-- As tabelas de afiliados e publicidade são acessadas exclusivamente por RPCs
-- SECURITY DEFINER ou pela service_role. A loja mantém acesso direto somente
-- aos registros do próprio cliente autenticado.

DO $$
DECLARE
  v_table text;
BEGIN
  FOREACH v_table IN ARRAY ARRAY[
    'gsa_ad_maintenance_state',
    'gsa_ad_rate_limit_buckets',
    'gsa_afiliado_programas',
    'gsa_afiliados',
    'gsa_afiliado_links',
    'gsa_afiliado_cliques',
    'gsa_afiliado_atribuicoes',
    'gsa_afiliado_conversoes',
    'gsa_afiliado_comissoes',
    'gsa_afiliado_saques',
    'gsa_afiliado_comissao_eventos',
    'produtos_fornecedores_config'
  ] LOOP
    IF to_regclass(format('public.%I', v_table)) IS NOT NULL THEN
      EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', v_table);
      EXECUTE format('REVOKE ALL ON TABLE public.%I FROM PUBLIC, anon, authenticated', v_table);
    END IF;
  END LOOP;
END;
$$;

-- O carrinho permanece disponível apenas para o cliente dono do registro.
ALTER TABLE public.loja_carrinhos ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.loja_carrinhos FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.loja_carrinhos TO authenticated;

DROP POLICY IF EXISTS gsa_client_cart_select ON public.loja_carrinhos;
CREATE POLICY gsa_client_cart_select ON public.loja_carrinhos
FOR SELECT TO authenticated
USING (
  (auth.jwt() -> 'app_metadata' ->> 'gsa_actor_type') = 'cliente'
  AND cliente_id::text = (auth.jwt() -> 'app_metadata' ->> 'gsa_actor_id')
);
DROP POLICY IF EXISTS gsa_client_cart_insert ON public.loja_carrinhos;
CREATE POLICY gsa_client_cart_insert ON public.loja_carrinhos
FOR INSERT TO authenticated
WITH CHECK (
  (auth.jwt() -> 'app_metadata' ->> 'gsa_actor_type') = 'cliente'
  AND cliente_id::text = (auth.jwt() -> 'app_metadata' ->> 'gsa_actor_id')
);
DROP POLICY IF EXISTS gsa_client_cart_update ON public.loja_carrinhos;
CREATE POLICY gsa_client_cart_update ON public.loja_carrinhos
FOR UPDATE TO authenticated
USING (
  (auth.jwt() -> 'app_metadata' ->> 'gsa_actor_type') = 'cliente'
  AND cliente_id::text = (auth.jwt() -> 'app_metadata' ->> 'gsa_actor_id')
)
WITH CHECK (
  (auth.jwt() -> 'app_metadata' ->> 'gsa_actor_type') = 'cliente'
  AND cliente_id::text = (auth.jwt() -> 'app_metadata' ->> 'gsa_actor_id')
);
DROP POLICY IF EXISTS gsa_client_cart_delete ON public.loja_carrinhos;
CREATE POLICY gsa_client_cart_delete ON public.loja_carrinhos
FOR DELETE TO authenticated
USING (
  (auth.jwt() -> 'app_metadata' ->> 'gsa_actor_type') = 'cliente'
  AND cliente_id::text = (auth.jwt() -> 'app_metadata' ->> 'gsa_actor_id')
);

-- A ativação de promoções também fica limitada ao próprio cliente.
ALTER TABLE public.promocoes_quantidade_ativadas ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.promocoes_quantidade_ativadas FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.promocoes_quantidade_ativadas TO authenticated;

DROP POLICY IF EXISTS gsa_client_quantity_promotions_select ON public.promocoes_quantidade_ativadas;
CREATE POLICY gsa_client_quantity_promotions_select ON public.promocoes_quantidade_ativadas
FOR SELECT TO authenticated
USING (
  (auth.jwt() -> 'app_metadata' ->> 'gsa_actor_type') = 'cliente'
  AND cliente_id::text = (auth.jwt() -> 'app_metadata' ->> 'gsa_actor_id')
);
DROP POLICY IF EXISTS gsa_client_quantity_promotions_insert ON public.promocoes_quantidade_ativadas;
CREATE POLICY gsa_client_quantity_promotions_insert ON public.promocoes_quantidade_ativadas
FOR INSERT TO authenticated
WITH CHECK (
  (auth.jwt() -> 'app_metadata' ->> 'gsa_actor_type') = 'cliente'
  AND cliente_id::text = (auth.jwt() -> 'app_metadata' ->> 'gsa_actor_id')
);
DROP POLICY IF EXISTS gsa_client_quantity_promotions_update ON public.promocoes_quantidade_ativadas;
CREATE POLICY gsa_client_quantity_promotions_update ON public.promocoes_quantidade_ativadas
FOR UPDATE TO authenticated
USING (
  (auth.jwt() -> 'app_metadata' ->> 'gsa_actor_type') = 'cliente'
  AND cliente_id::text = (auth.jwt() -> 'app_metadata' ->> 'gsa_actor_id')
)
WITH CHECK (
  (auth.jwt() -> 'app_metadata' ->> 'gsa_actor_type') = 'cliente'
  AND cliente_id::text = (auth.jwt() -> 'app_metadata' ->> 'gsa_actor_id')
);
DROP POLICY IF EXISTS gsa_client_quantity_promotions_delete ON public.promocoes_quantidade_ativadas;
CREATE POLICY gsa_client_quantity_promotions_delete ON public.promocoes_quantidade_ativadas
FOR DELETE TO authenticated
USING (
  (auth.jwt() -> 'app_metadata' ->> 'gsa_actor_type') = 'cliente'
  AND cliente_id::text = (auth.jwt() -> 'app_metadata' ->> 'gsa_actor_id')
);

CREATE OR REPLACE FUNCTION public.gsa_client_affiliate_snapshot(
  p_sessao_id uuid,
  p_session_token text
)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_cliente_id uuid;
  v_affiliate public.gsa_afiliados%rowtype;
  v_available numeric := 0;
BEGIN
  SELECT actor.cliente_id INTO v_cliente_id
  FROM public.gsa_client_session_actor(p_sessao_id, p_session_token) actor
  LIMIT 1;
  IF v_cliente_id IS NULL THEN
    RAISE EXCEPTION 'Sessão de cliente inválida.' USING ERRCODE = '42501';
  END IF;

  SELECT * INTO v_affiliate
  FROM public.gsa_afiliados
  WHERE cliente_id = v_cliente_id;

  IF v_affiliate.id IS NOT NULL THEN
    SELECT COALESCE(sum(e.valor_assinado), 0)
      INTO v_available
      FROM public.gsa_afiliado_comissao_eventos e
     WHERE e.afiliado_id = v_affiliate.id
       AND e.efetivo_em <= now();
  END IF;

  RETURN jsonb_build_object(
    'affiliate', CASE WHEN v_affiliate.id IS NULL THEN NULL ELSE
      jsonb_build_object(
        'id', v_affiliate.id,
        'codigo_publico', v_affiliate.codigo_publico,
        'nome_divulgacao', v_affiliate.nome_divulgacao,
        'status', v_affiliate.status,
        'pix_tipo', v_affiliate.pix_tipo,
        'pix_chave', v_affiliate.pix_chave,
        'termos_versao', v_affiliate.termos_versao,
        'termos_aceitos_em', v_affiliate.termos_aceitos_em,
        'created_at', v_affiliate.created_at
      ) END,
    'programs', COALESCE((
      SELECT jsonb_agg(to_jsonb(p) ORDER BY p.nome)
      FROM public.gsa_afiliado_programas p
      WHERE p.ativo
    ), '[]'::jsonb),
    'links', CASE WHEN v_affiliate.id IS NULL THEN '[]'::jsonb ELSE COALESCE((
      SELECT jsonb_agg(jsonb_build_object(
        'id', l.id,
        'programa_id', l.programa_id,
        'programa_codigo', p.codigo,
        'programa_nome', p.nome,
        'codigo', l.codigo,
        'destino', l.destino,
        'titulo', l.titulo,
        'ativo', l.ativo,
        'created_at', l.created_at,
        'cliques', (SELECT count(*) FROM public.gsa_afiliado_cliques c WHERE c.link_id = l.id),
        'conversoes', (SELECT count(*) FROM public.gsa_afiliado_conversoes c WHERE c.afiliado_id = v_affiliate.id AND c.programa_id = l.programa_id AND c.status = 'confirmada'),
        'comissao_total', (SELECT COALESCE(sum(m.valor), 0) FROM public.gsa_afiliado_comissoes m WHERE m.afiliado_id = v_affiliate.id AND m.programa_id = l.programa_id AND m.status <> 'revertida')
      ) ORDER BY l.created_at DESC)
      FROM public.gsa_afiliado_links l
      JOIN public.gsa_afiliado_programas p ON p.id = l.programa_id
      WHERE l.afiliado_id = v_affiliate.id
    ), '[]'::jsonb) END,
    'summary', jsonb_build_object(
      'total_cliques', CASE WHEN v_affiliate.id IS NULL THEN 0 ELSE (SELECT count(*) FROM public.gsa_afiliado_cliques c JOIN public.gsa_afiliado_links l ON l.id = c.link_id WHERE l.afiliado_id = v_affiliate.id) END,
      'total_conversoes', CASE WHEN v_affiliate.id IS NULL THEN 0 ELSE (SELECT count(*) FROM public.gsa_afiliado_conversoes c WHERE c.afiliado_id = v_affiliate.id AND c.status = 'confirmada') END,
      'total_pendente', CASE WHEN v_affiliate.id IS NULL THEN 0 ELSE (SELECT COALESCE(sum(m.valor), 0) FROM public.gsa_afiliado_comissoes m WHERE m.afiliado_id = v_affiliate.id AND m.status = 'pendente') END,
      'total_disponivel', greatest(v_available, 0),
      'total_pago', CASE WHEN v_affiliate.id IS NULL THEN 0 ELSE (SELECT COALESCE(sum(s.valor), 0) FROM public.gsa_afiliado_saques s WHERE s.afiliado_id = v_affiliate.id AND s.status = 'pago') END,
      'total_solicitado', CASE WHEN v_affiliate.id IS NULL THEN 0 ELSE (SELECT COALESCE(sum(s.valor), 0) FROM public.gsa_afiliado_saques s WHERE s.afiliado_id = v_affiliate.id AND s.status IN ('solicitado','aprovado')) END,
      'saque_minimo', CASE WHEN v_affiliate.id IS NULL THEN 0 ELSE COALESCE((SELECT min(p.saque_minimo) FROM public.gsa_afiliado_programas p WHERE p.ativo), 0) END
    ),
    'commissions', CASE WHEN v_affiliate.id IS NULL THEN '[]'::jsonb ELSE COALESCE((
      SELECT jsonb_agg(jsonb_build_object(
        'id', m.id,
        'programa_codigo', p.codigo,
        'programa_nome', p.nome,
        'origem_tipo', c.origem_tipo,
        'origem_id', c.origem_id,
        'base_elegivel', m.base_elegivel_snapshot,
        'percentual', m.percentual_snapshot,
        'valor', m.valor,
        'status', m.status,
        'disponivel_em', m.disponivel_em,
        'created_at', m.created_at
      ) ORDER BY m.created_at DESC)
      FROM public.gsa_afiliado_comissoes m
      JOIN public.gsa_afiliado_programas p ON p.id = m.programa_id
      JOIN public.gsa_afiliado_conversoes c ON c.id = m.conversao_id
      WHERE m.afiliado_id = v_affiliate.id
    ), '[]'::jsonb) END,
    'payouts', CASE WHEN v_affiliate.id IS NULL THEN '[]'::jsonb ELSE COALESCE((
      SELECT jsonb_agg(jsonb_build_object(
        'id', s.id,
        'valor', s.valor,
        'status', s.status,
        'pix_tipo', s.pix_tipo_snapshot,
        'pix_chave_mascarada', CASE WHEN length(s.pix_chave_snapshot) <= 6 THEN '***' ELSE left(s.pix_chave_snapshot, 3) || '***' || right(s.pix_chave_snapshot, 3) END,
        'solicitado_em', s.solicitado_em,
        'pago_em', s.pago_em,
        'motivo', s.notas
      ) ORDER BY s.solicitado_em DESC)
      FROM public.gsa_afiliado_saques s
      WHERE s.afiliado_id = v_affiliate.id
    ), '[]'::jsonb) END
  );
END;
$$;

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
SET search_path = public, pg_temp
AS $$
DECLARE
  v_cliente_id uuid;
  v_id uuid;
BEGIN
  SELECT actor.cliente_id INTO v_cliente_id
  FROM public.gsa_client_session_actor(p_sessao_id, p_session_token) actor
  LIMIT 1;
  IF v_cliente_id IS NULL THEN RAISE EXCEPTION 'Sessão de cliente inválida.' USING ERRCODE = '42501'; END IF;
  IF length(trim(coalesce(p_nome_divulgacao, ''))) < 2 THEN RAISE EXCEPTION 'Informe o nome de divulgação.' USING ERRCODE = '22023'; END IF;
  IF p_pix_tipo NOT IN ('cpf','cnpj','email','telefone','aleatoria') OR length(trim(coalesce(p_pix_chave, ''))) < 3 THEN
    RAISE EXCEPTION 'Chave PIX inválida.' USING ERRCODE = '22023';
  END IF;
  IF length(trim(coalesce(p_termos_versao, ''))) < 1 THEN RAISE EXCEPTION 'Aceite dos termos obrigatório.' USING ERRCODE = '22023'; END IF;

  INSERT INTO public.gsa_afiliados(
    cliente_id, codigo_publico, nome_divulgacao, status,
    pix_tipo, pix_chave, termos_versao, termos_aceitos_em
  ) VALUES (
    v_cliente_id, public.gsa_affiliate_new_code('A'), trim(p_nome_divulgacao), 'ativo',
    p_pix_tipo, trim(p_pix_chave), trim(p_termos_versao), now()
  )
  ON CONFLICT (cliente_id) DO UPDATE SET
    nome_divulgacao = excluded.nome_divulgacao,
    pix_tipo = excluded.pix_tipo,
    pix_chave = excluded.pix_chave,
    status = CASE WHEN public.gsa_afiliados.status = 'encerrado' THEN public.gsa_afiliados.status ELSE 'ativo' END,
    updated_at = now()
  RETURNING id INTO v_id;

  RETURN public.gsa_client_affiliate_snapshot(p_sessao_id, p_session_token);
END;
$$;

CREATE OR REPLACE FUNCTION public.gsa_client_update_affiliate_profile(
  p_sessao_id uuid,
  p_session_token text,
  p_nome_divulgacao text,
  p_pix_tipo text,
  p_pix_chave text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE v_cliente_id uuid;
BEGIN
  SELECT actor.cliente_id INTO v_cliente_id
  FROM public.gsa_client_session_actor(p_sessao_id, p_session_token) actor LIMIT 1;
  IF v_cliente_id IS NULL THEN RAISE EXCEPTION 'Sessão de cliente inválida.' USING ERRCODE = '42501'; END IF;
  IF length(trim(coalesce(p_nome_divulgacao, ''))) < 2 THEN RAISE EXCEPTION 'Informe o nome de divulgação.' USING ERRCODE = '22023'; END IF;
  IF p_pix_tipo NOT IN ('cpf','cnpj','email','telefone','aleatoria') OR length(trim(coalesce(p_pix_chave, ''))) < 3 THEN RAISE EXCEPTION 'Chave PIX inválida.' USING ERRCODE = '22023'; END IF;
  UPDATE public.gsa_afiliados SET
    nome_divulgacao = trim(p_nome_divulgacao), pix_tipo = p_pix_tipo,
    pix_chave = trim(p_pix_chave), updated_at = now()
  WHERE cliente_id = v_cliente_id AND status <> 'encerrado';
  IF NOT FOUND THEN RAISE EXCEPTION 'Perfil de afiliado não encontrado.' USING ERRCODE = 'P0002'; END IF;
  RETURN public.gsa_client_affiliate_snapshot(p_sessao_id, p_session_token);
END;
$$;

CREATE OR REPLACE FUNCTION public.gsa_client_create_affiliate_link(
  p_sessao_id uuid,
  p_session_token text,
  p_programa_codigo text,
  p_destino text,
  p_titulo text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_cliente_id uuid;
  v_affiliate public.gsa_afiliados%rowtype;
  v_program public.gsa_afiliado_programas%rowtype;
BEGIN
  SELECT actor.cliente_id INTO v_cliente_id FROM public.gsa_client_session_actor(p_sessao_id, p_session_token) actor LIMIT 1;
  SELECT * INTO v_affiliate FROM public.gsa_afiliados WHERE cliente_id = v_cliente_id AND status = 'ativo';
  IF v_affiliate.id IS NULL THEN RAISE EXCEPTION 'Perfil de afiliado ativo obrigatório.' USING ERRCODE = '42501'; END IF;
  SELECT * INTO v_program FROM public.gsa_afiliado_programas WHERE codigo = lower(trim(p_programa_codigo)) AND ativo;
  IF v_program.id IS NULL THEN RAISE EXCEPTION 'Programa indisponível.' USING ERRCODE = '22023'; END IF;
  IF NOT public.gsa_affiliate_destination_allowed(v_program.id, trim(p_destino)) THEN RAISE EXCEPTION 'Destino não permitido.' USING ERRCODE = '22023'; END IF;

  INSERT INTO public.gsa_afiliado_links(afiliado_id, programa_id, codigo, destino, titulo, ativo)
  VALUES (v_affiliate.id, v_program.id, public.gsa_affiliate_new_code('L'), trim(p_destino), nullif(trim(coalesce(p_titulo, '')), ''), true)
  ON CONFLICT (afiliado_id, programa_id, destino) DO UPDATE SET
    titulo = excluded.titulo, ativo = true, updated_at = now();

  RETURN public.gsa_client_affiliate_snapshot(p_sessao_id, p_session_token);
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
  v_cliente_id uuid;
  v_affiliate public.gsa_afiliados%rowtype;
  v_available numeric;
  v_minimum numeric;
  v_payout_id uuid;
BEGIN
  SELECT actor.cliente_id INTO v_cliente_id FROM public.gsa_client_session_actor(p_sessao_id, p_session_token) actor LIMIT 1;
  SELECT * INTO v_affiliate FROM public.gsa_afiliados WHERE cliente_id = v_cliente_id AND status = 'ativo' FOR UPDATE;
  IF v_affiliate.id IS NULL THEN RAISE EXCEPTION 'Perfil de afiliado ativo obrigatório.' USING ERRCODE = '42501'; END IF;
  IF p_request_id IS NULL OR coalesce(p_valor, 0) <= 0 THEN RAISE EXCEPTION 'Solicitação de saque inválida.' USING ERRCODE = '22023'; END IF;

  SELECT id INTO v_payout_id FROM public.gsa_afiliado_saques WHERE request_id = p_request_id;
  IF v_payout_id IS NOT NULL THEN RETURN public.gsa_client_affiliate_snapshot(p_sessao_id, p_session_token); END IF;

  SELECT COALESCE(sum(valor_assinado), 0) INTO v_available
  FROM public.gsa_afiliado_comissao_eventos
  WHERE afiliado_id = v_affiliate.id AND efetivo_em <= now();
  SELECT COALESCE(min(saque_minimo), 0) INTO v_minimum FROM public.gsa_afiliado_programas WHERE ativo;
  IF p_valor < v_minimum OR p_valor > v_available THEN RAISE EXCEPTION 'Valor indisponível para saque.' USING ERRCODE = '22023'; END IF;
  IF v_affiliate.pix_tipo IS NULL OR v_affiliate.pix_chave IS NULL THEN RAISE EXCEPTION 'Cadastre uma chave PIX antes do saque.' USING ERRCODE = '22023'; END IF;

  INSERT INTO public.gsa_afiliado_saques(
    afiliado_id, request_id, valor, status, pix_tipo_snapshot, pix_chave_snapshot
  ) VALUES (
    v_affiliate.id, p_request_id, round(p_valor, 2), 'solicitado', v_affiliate.pix_tipo, v_affiliate.pix_chave
  ) RETURNING id INTO v_payout_id;

  INSERT INTO public.gsa_afiliado_comissao_eventos(
    afiliado_id, saque_id, tipo, valor_assinado, efetivo_em, metadata
  ) VALUES (
    v_affiliate.id, v_payout_id, 'saque', -round(p_valor, 2), now(), jsonb_build_object('status', 'solicitado')
  );

  RETURN public.gsa_client_affiliate_snapshot(p_sessao_id, p_session_token);
END;
$$;

CREATE OR REPLACE FUNCTION public.gsa_client_cancel_affiliate_payout(
  p_sessao_id uuid,
  p_session_token text,
  p_saque_id uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_cliente_id uuid;
  v_affiliate_id uuid;
  v_payout public.gsa_afiliado_saques%rowtype;
BEGIN
  SELECT actor.cliente_id INTO v_cliente_id FROM public.gsa_client_session_actor(p_sessao_id, p_session_token) actor LIMIT 1;
  SELECT id INTO v_affiliate_id FROM public.gsa_afiliados WHERE cliente_id = v_cliente_id;
  SELECT * INTO v_payout FROM public.gsa_afiliado_saques WHERE id = p_saque_id AND afiliado_id = v_affiliate_id FOR UPDATE;
  IF v_payout.id IS NULL THEN RAISE EXCEPTION 'Saque não encontrado.' USING ERRCODE = 'P0002'; END IF;
  IF v_payout.status = 'cancelado' THEN RETURN public.gsa_client_affiliate_snapshot(p_sessao_id, p_session_token); END IF;
  IF v_payout.status <> 'solicitado' THEN RAISE EXCEPTION 'Este saque não pode mais ser cancelado.' USING ERRCODE = '22023'; END IF;

  UPDATE public.gsa_afiliado_saques SET status = 'cancelado', cancelado_em = now() WHERE id = v_payout.id;
  IF NOT EXISTS (
    SELECT 1 FROM public.gsa_afiliado_comissao_eventos
    WHERE saque_id = v_payout.id AND tipo = 'ajuste' AND metadata ->> 'reason' = 'payout_reversal'
  ) THEN
    INSERT INTO public.gsa_afiliado_comissao_eventos(afiliado_id, saque_id, tipo, valor_assinado, efetivo_em, metadata)
    VALUES (v_affiliate_id, v_payout.id, 'ajuste', v_payout.valor, now(), jsonb_build_object('reason', 'payout_reversal'));
  END IF;
  RETURN public.gsa_client_affiliate_snapshot(p_sessao_id, p_session_token);
END;
$$;

CREATE OR REPLACE FUNCTION public.gsa_admin_affiliate_snapshot(
  p_sessao_id uuid,
  p_session_token text
)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE v_actor jsonb := public.gsa_admin_validate_context(p_sessao_id, p_session_token);
BEGIN
  IF NOT (public.gsa_admin_has_module('financeiro') OR public.gsa_admin_has_module('afiliados')) THEN
    RAISE EXCEPTION 'Sem permissão para Afiliados.' USING ERRCODE = '42501';
  END IF;
  RETURN jsonb_build_object(
    'success', true,
    'summary', jsonb_build_object(
      'afiliados_ativos', (SELECT count(*) FROM public.gsa_afiliados WHERE status = 'ativo'),
      'cliques', (SELECT count(*) FROM public.gsa_afiliado_cliques),
      'vendas_atribuidas', (SELECT count(*) FROM public.gsa_afiliado_conversoes WHERE status = 'confirmada'),
      'comissoes_pendentes', (SELECT COALESCE(sum(valor),0) FROM public.gsa_afiliado_comissoes WHERE status = 'pendente'),
      'comissoes_disponiveis', (SELECT COALESCE(sum(valor - pago_valor),0) FROM public.gsa_afiliado_comissoes WHERE status = 'disponivel'),
      'saques_pendentes', (SELECT count(*) FROM public.gsa_afiliado_saques WHERE status IN ('solicitado','aprovado'))
    ),
    'programs', COALESCE((SELECT jsonb_agg(to_jsonb(p) ORDER BY p.nome) FROM public.gsa_afiliado_programas p), '[]'::jsonb),
    'affiliates', COALESCE((
      SELECT jsonb_agg(jsonb_build_object(
        'id', a.id, 'cliente_id', a.cliente_id, 'nome_divulgacao', a.nome_divulgacao,
        'codigo_publico', a.codigo_publico, 'status', a.status, 'pix_tipo', a.pix_tipo,
        'pix_chave_mascarada', CASE WHEN a.pix_chave IS NULL THEN NULL WHEN length(a.pix_chave) <= 6 THEN '***' ELSE left(a.pix_chave,3) || '***' || right(a.pix_chave,3) END,
        'created_at', a.created_at,
        'cliques', (SELECT count(*) FROM public.gsa_afiliado_cliques c JOIN public.gsa_afiliado_links l ON l.id = c.link_id WHERE l.afiliado_id = a.id),
        'conversoes', (SELECT count(*) FROM public.gsa_afiliado_conversoes c WHERE c.afiliado_id = a.id AND c.status = 'confirmada'),
        'comissao_total', (SELECT COALESCE(sum(m.valor),0) FROM public.gsa_afiliado_comissoes m WHERE m.afiliado_id = a.id AND m.status <> 'revertida'),
        'saldo_disponivel', (SELECT greatest(COALESCE(sum(e.valor_assinado),0),0) FROM public.gsa_afiliado_comissao_eventos e WHERE e.afiliado_id = a.id AND e.efetivo_em <= now())
      ) ORDER BY a.created_at DESC)
      FROM public.gsa_afiliados a
    ), '[]'::jsonb),
    'payouts', COALESCE((
      SELECT jsonb_agg(jsonb_build_object(
        'id', s.id, 'afiliado_id', s.afiliado_id, 'afiliado_nome', a.nome_divulgacao,
        'codigo_publico', a.codigo_publico, 'valor', s.valor, 'status', s.status,
        'pix_tipo', s.pix_tipo_snapshot, 'pix_chave', s.pix_chave_snapshot,
        'solicitado_em', s.solicitado_em, 'aprovado_em', s.aprovado_em, 'pago_em', s.pago_em
      ) ORDER BY s.solicitado_em DESC)
      FROM public.gsa_afiliado_saques s JOIN public.gsa_afiliados a ON a.id = s.afiliado_id
    ), '[]'::jsonb)
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.gsa_admin_update_affiliate_program(
  p_sessao_id uuid,
  p_session_token text,
  p_program_id uuid,
  p_patch jsonb
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE v_actor jsonb := public.gsa_admin_validate_context(p_sessao_id, p_session_token);
BEGIN
  IF NOT (public.gsa_admin_has_module('financeiro') OR public.gsa_admin_has_module('afiliados')) THEN RAISE EXCEPTION 'Sem permissão para Afiliados.' USING ERRCODE = '42501'; END IF;
  UPDATE public.gsa_afiliado_programas SET
    descricao = CASE WHEN p_patch ? 'descricao' THEN nullif(trim(p_patch->>'descricao'),'') ELSE descricao END,
    caminho_padrao = CASE WHEN p_patch ? 'caminho_padrao' THEN trim(p_patch->>'caminho_padrao') ELSE caminho_padrao END,
    base_tipo = CASE WHEN p_patch ? 'base_tipo' THEN p_patch->>'base_tipo' ELSE base_tipo END,
    percentual = CASE WHEN p_patch ? 'percentual' THEN (p_patch->>'percentual')::numeric ELSE percentual END,
    janela_atribuicao_dias = CASE WHEN p_patch ? 'janela_atribuicao_dias' THEN (p_patch->>'janela_atribuicao_dias')::integer ELSE janela_atribuicao_dias END,
    carencia_dias = CASE WHEN p_patch ? 'carencia_dias' THEN (p_patch->>'carencia_dias')::integer ELSE carencia_dias END,
    saque_minimo = CASE WHEN p_patch ? 'saque_minimo' THEN (p_patch->>'saque_minimo')::numeric ELSE saque_minimo END,
    ativo = CASE WHEN p_patch ? 'ativo' THEN (p_patch->>'ativo')::boolean ELSE ativo END,
    updated_at = now()
  WHERE id = p_program_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Programa não encontrado.' USING ERRCODE = 'P0002'; END IF;
  RETURN jsonb_build_object('success', true);
END;
$$;

CREATE OR REPLACE FUNCTION public.gsa_admin_set_affiliate_status(
  p_sessao_id uuid,
  p_session_token text,
  p_affiliate_id uuid,
  p_status text,
  p_reason text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE v_actor jsonb := public.gsa_admin_validate_context(p_sessao_id, p_session_token);
DECLARE v_status text := lower(trim(coalesce(p_status,'')));
BEGIN
  IF NOT (public.gsa_admin_has_module('financeiro') OR public.gsa_admin_has_module('afiliados')) THEN RAISE EXCEPTION 'Sem permissão para Afiliados.' USING ERRCODE = '42501'; END IF;
  IF v_status NOT IN ('ativo','suspenso','encerrado') THEN RAISE EXCEPTION 'Status inválido.' USING ERRCODE = '22023'; END IF;
  UPDATE public.gsa_afiliados SET status = v_status, status_motivo = nullif(trim(coalesce(p_reason,'')),''), updated_at = now() WHERE id = p_affiliate_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Afiliado não encontrado.' USING ERRCODE = 'P0002'; END IF;
  RETURN jsonb_build_object('success', true, 'status', v_status);
END;
$$;

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
  v_actor jsonb := public.gsa_admin_validate_context(p_sessao_id, p_session_token);
  v_action text := lower(trim(coalesce(p_action,'')));
  v_payout public.gsa_afiliado_saques%rowtype;
BEGIN
  IF NOT (public.gsa_admin_has_module('financeiro') OR public.gsa_admin_has_module('afiliados')) THEN RAISE EXCEPTION 'Sem permissão para Afiliados.' USING ERRCODE = '42501'; END IF;
  SELECT * INTO v_payout FROM public.gsa_afiliado_saques WHERE id = p_payout_id FOR UPDATE;
  IF v_payout.id IS NULL THEN RAISE EXCEPTION 'Saque não encontrado.' USING ERRCODE = 'P0002'; END IF;

  IF v_action = 'approve' THEN
    IF v_payout.status = 'solicitado' THEN
      UPDATE public.gsa_afiliado_saques SET status = 'aprovado', aprovado_em = now(), decidido_por = (v_actor->>'actor_id')::uuid, notas = nullif(trim(coalesce(p_notes,'')),'') WHERE id = p_payout_id;
    ELSIF v_payout.status <> 'aprovado' THEN RAISE EXCEPTION 'Saque não pode ser aprovado.' USING ERRCODE = '22023'; END IF;
  ELSIF v_action = 'reject' THEN
    IF v_payout.status NOT IN ('solicitado','aprovado') THEN RAISE EXCEPTION 'Saque não pode ser rejeitado.' USING ERRCODE = '22023'; END IF;
    UPDATE public.gsa_afiliado_saques SET status = 'rejeitado', rejeitado_em = now(), decidido_por = (v_actor->>'actor_id')::uuid, notas = nullif(trim(coalesce(p_notes,'')),'') WHERE id = p_payout_id;
    IF NOT EXISTS (SELECT 1 FROM public.gsa_afiliado_comissao_eventos WHERE saque_id = p_payout_id AND tipo = 'ajuste' AND metadata->>'reason' = 'payout_reversal') THEN
      INSERT INTO public.gsa_afiliado_comissao_eventos(afiliado_id, saque_id, tipo, valor_assinado, efetivo_em, metadata)
      VALUES (v_payout.afiliado_id, p_payout_id, 'ajuste', v_payout.valor, now(), jsonb_build_object('reason','payout_reversal'));
    END IF;
  ELSIF v_action = 'mark_paid' THEN
    IF v_payout.status = 'aprovado' THEN
      UPDATE public.gsa_afiliado_saques SET status = 'pago', pago_em = coalesce(p_paid_at, now()), decidido_por = (v_actor->>'actor_id')::uuid, notas = nullif(trim(coalesce(p_notes,'')),'') WHERE id = p_payout_id;
    ELSIF v_payout.status <> 'pago' THEN RAISE EXCEPTION 'Saque não pode ser marcado como pago.' USING ERRCODE = '22023'; END IF;
  ELSE
    RAISE EXCEPTION 'Ação inválida.' USING ERRCODE = '22023';
  END IF;
  RETURN jsonb_build_object('success', true);
END;
$$;

-- Privilégios explícitos: o navegador nunca acessa diretamente as tabelas.
REVOKE ALL ON FUNCTION public.gsa_client_affiliate_snapshot(uuid,text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.gsa_client_join_affiliate(uuid,text,text,text,text,text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.gsa_client_update_affiliate_profile(uuid,text,text,text,text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.gsa_client_create_affiliate_link(uuid,text,text,text,text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.gsa_client_request_affiliate_payout(uuid,text,uuid,numeric) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.gsa_client_cancel_affiliate_payout(uuid,text,uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.gsa_admin_affiliate_snapshot(uuid,text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.gsa_admin_update_affiliate_program(uuid,text,uuid,jsonb) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.gsa_admin_set_affiliate_status(uuid,text,uuid,text,text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.gsa_admin_decide_affiliate_payout(uuid,text,uuid,text,text,timestamptz) FROM PUBLIC, anon;

GRANT EXECUTE ON FUNCTION public.gsa_client_affiliate_snapshot(uuid,text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.gsa_client_join_affiliate(uuid,text,text,text,text,text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.gsa_client_update_affiliate_profile(uuid,text,text,text,text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.gsa_client_create_affiliate_link(uuid,text,text,text,text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.gsa_client_request_affiliate_payout(uuid,text,uuid,numeric) TO authenticated;
GRANT EXECUTE ON FUNCTION public.gsa_client_cancel_affiliate_payout(uuid,text,uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.gsa_admin_affiliate_snapshot(uuid,text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.gsa_admin_update_affiliate_program(uuid,text,uuid,jsonb) TO authenticated;
GRANT EXECUTE ON FUNCTION public.gsa_admin_set_affiliate_status(uuid,text,uuid,text,text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.gsa_admin_decide_affiliate_payout(uuid,text,uuid,text,text,timestamptz) TO authenticated;

-- A vitrine pública continua exclusivamente por RPC.
REVOKE ALL ON FUNCTION public.gsa_public_affiliate_programs() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.gsa_public_affiliate_programs() TO anon, authenticated;
REVOKE ALL ON FUNCTION public.gsa_public_track_affiliate_click(text,text,text,text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.gsa_public_track_affiliate_click(text,text,text,text) TO anon, authenticated;
REVOKE ALL ON FUNCTION public.gsa_client_bind_affiliate_click(uuid,text,text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.gsa_client_bind_affiliate_click(uuid,text,text) TO authenticated;

COMMIT;
