-- Migration: Fix gsa_client_join_affiliate and gsa_client_affiliate_snapshot session lookup
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
  IF length(trim(coalesce(p_nome_divulgacao, ''))) NOT BETWEEN 3 AND 120 THEN RAISE EXCEPTION 'Nome de divulgação inválido.'; END IF;
  IF length(trim(coalesce(p_pix_chave, ''))) NOT BETWEEN 3 AND 180 THEN RAISE EXCEPTION 'Chave PIX inválida.'; END IF;
  IF length(trim(coalesce(p_termos_versao, ''))) NOT BETWEEN 1 AND 40 THEN RAISE EXCEPTION 'Versão dos termos obrigatória.'; END IF;

  SELECT id INTO v_id FROM public.gsa_afiliados WHERE cliente_id = v_actor.cliente_id;

  IF v_id IS NULL THEN
    v_is_new := true;
    INSERT INTO public.gsa_afiliados(cliente_id, codigo_publico, nome_divulgacao, status, pix_tipo, pix_chave, termos_versao, termos_aceitos_em)
    VALUES (v_actor.cliente_id, public.gsa_affiliate_new_code('AFL'), trim(p_nome_divulgacao), 'ativo', v_type, trim(p_pix_chave), trim(p_termos_versao), now())
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
          updated_at = now()
      WHERE id = v_actor.cliente_id;

      INSERT INTO public.gsa_afiliado_pontos_eventos(cliente_id, afiliado_id, tipo, pontos_assinados, metadata)
      VALUES (v_actor.cliente_id, v_id, 'bonus_boas_vindas', v_welcome_val, jsonb_build_object('descricao', 'Bônus de Boas-vindas Afiliado GSA'));
    END IF;
  END IF;

  RETURN jsonb_build_object('success', true, 'affiliate_id', v_id);
END;
$function$;

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
  v_summary jsonb;
  v_points numeric := 0;
  v_wallet numeric := 0;
  v_points_rate numeric := 0.01;
  v_points_minimum integer := 100;
  v_points_active boolean := true;
  v_cliente_nome text := '';
  v_cliente_cpf text := '';
BEGIN
  -- 1. Se p_sessao_id e p_session_token foram enviados, tenta obter o cliente pela sessão atômica GSA
  IF p_sessao_id IS NOT NULL AND p_session_token IS NOT NULL THEN
    BEGIN
      SELECT cliente_id INTO v_cliente_id
        FROM public.gsa_client_session_actor(p_sessao_id, p_session_token)
       LIMIT 1;
    EXCEPTION WHEN OTHERS THEN
      v_cliente_id := NULL;
    END;
  END IF;

  -- 2. Se v_cliente_id ainda for nulo e p_sessao_id foi informado, busca na tabela oficial sistema_sessoes
  IF v_cliente_id IS NULL AND p_sessao_id IS NOT NULL THEN
    SELECT s.ator_id INTO v_cliente_id
      FROM public.sistema_sessoes s
     WHERE s.id = p_sessao_id AND s.status = 'ativo' AND s.ator_tipo = 'cliente'
     LIMIT 1;
  END IF;

  -- 3. Se ainda nulo, tenta auth.uid() (Supabase Auth)
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
             s.solicitado_em, s.pago_em,
             CASE WHEN s.notas LIKE 'Ação %' THEN NULL ELSE s.notas END AS motivo
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
      'termos_aceitos_em', v_affiliate.termos_aceitos_em
    ) END,
    'summary', v_summary,
    'programs', coalesce(v_programs, '[]'::jsonb),
    'links', coalesce(v_links, '[]'::jsonb),
    'commissions', coalesce(v_commissions, '[]'::jsonb),
    'payouts', coalesce(v_payouts, '[]'::jsonb)
  );
END;
$function$;
