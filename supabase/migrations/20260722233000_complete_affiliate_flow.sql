BEGIN;

-- Consolida o contrato operacional do GSA Afiliados sem expor tabelas financeiras
-- diretamente ao navegador. Esta migration deve ser aplicada depois da fundacao
-- 20260722040000_affiliate_program.sql.

DO $$
DECLARE
  v_table text;
BEGIN
  FOREACH v_table IN ARRAY ARRAY[
    'gsa_afiliado_programas',
    'gsa_afiliados',
    'gsa_afiliado_links',
    'gsa_afiliado_cliques',
    'gsa_afiliado_atribuicoes',
    'gsa_afiliado_conversoes',
    'gsa_afiliado_comissoes',
    'gsa_afiliado_saques',
    'gsa_afiliado_comissao_eventos'
  ] LOOP
    IF to_regclass(format('public.%I', v_table)) IS NULL THEN
      RAISE EXCEPTION 'Fundacao do GSA Afiliados ausente: tabela % nao encontrada.', v_table;
    END IF;
  END LOOP;
END;
$$;

ALTER TABLE public.gsa_afiliado_programas
  ADD COLUMN IF NOT EXISTS pontos_por_real numeric(12,4) NOT NULL DEFAULT 1;

ALTER TABLE public.clientes
  ADD COLUMN IF NOT EXISTS pontos numeric(14,2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS saldo_carteira numeric(14,2) NOT NULL DEFAULT 0;

CREATE TABLE IF NOT EXISTS public.gsa_afiliado_pontos_eventos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  cliente_id uuid NOT NULL REFERENCES public.clientes(id) ON DELETE RESTRICT,
  afiliado_id uuid REFERENCES public.gsa_afiliados(id) ON DELETE RESTRICT,
  conversao_id uuid REFERENCES public.gsa_afiliado_conversoes(id) ON DELETE RESTRICT,
  tipo text NOT NULL,
  pontos_assinados numeric(14,2) NOT NULL,
  valor_carteira numeric(14,2),
  request_id uuid,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT gsa_afiliado_pontos_eventos_tipo_check
    CHECK (tipo IN ('credito_conversao','estorno_conversao','resgate_carteira','ajuste')),
  CONSTRAINT gsa_afiliado_pontos_eventos_referencia_check
    CHECK (conversao_id IS NOT NULL OR request_id IS NOT NULL OR tipo = 'ajuste')
);

CREATE UNIQUE INDEX IF NOT EXISTS ux_gsa_afiliado_pontos_credito
  ON public.gsa_afiliado_pontos_eventos(conversao_id, tipo)
  WHERE conversao_id IS NOT NULL AND tipo IN ('credito_conversao','estorno_conversao');
CREATE UNIQUE INDEX IF NOT EXISTS ux_gsa_afiliado_pontos_request
  ON public.gsa_afiliado_pontos_eventos(request_id)
  WHERE request_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS ix_gsa_afiliado_pontos_cliente
  ON public.gsa_afiliado_pontos_eventos(cliente_id, created_at DESC);

ALTER TABLE public.gsa_afiliado_pontos_eventos ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.gsa_afiliado_pontos_eventos FROM anon, authenticated;

UPDATE public.gsa_afiliado_programas
SET caminho_padrao = CASE codigo
      WHEN 'loja' THEN '/marketplace/loja'
      WHEN 'viagens' THEN '/marketplace/menu/pacotes-viagem'
      WHEN 'classificados' THEN '/marketplace/menu/classificados'
      WHEN 'servicos' THEN '/servicos-e-assinaturas'
      WHEN 'saude' THEN '/marketplace/menu/saude'
      WHEN 'seguros' THEN '/marketplace/menu/seguros'
      ELSE caminho_padrao
    END,
    prefixos_permitidos = CASE codigo
      WHEN 'loja' THEN ARRAY['/marketplace/loja']::text[]
      WHEN 'viagens' THEN ARRAY['/marketplace/menu/pacotes-viagem']::text[]
      WHEN 'classificados' THEN ARRAY['/marketplace/menu/classificados']::text[]
      WHEN 'servicos' THEN ARRAY['/servicos-e-assinaturas','/criacao-de-site-e-sistemas']::text[]
      WHEN 'saude' THEN ARRAY['/marketplace/menu/saude']::text[]
      WHEN 'seguros' THEN ARRAY['/marketplace/menu/seguros']::text[]
      ELSE prefixos_permitidos
    END,
    updated_at = now()
WHERE codigo IN ('loja','viagens','classificados','servicos','saude','seguros');

CREATE OR REPLACE FUNCTION public.gsa_affiliate_normalize_pix_type(p_type text, p_key text)
RETURNS text
LANGUAGE plpgsql
IMMUTABLE
SET search_path = public, pg_temp
AS $$
DECLARE
  v_type text := lower(trim(coalesce(p_type, '')));
  v_digits text := regexp_replace(coalesce(p_key, ''), '\D', '', 'g');
BEGIN
  IF v_type IN ('cpf','cnpj','email','telefone','aleatoria') THEN RETURN v_type; END IF;
  IF v_type IN ('cpf_cnpj','documento') THEN
    IF length(v_digits) = 11 THEN RETURN 'cpf'; END IF;
    IF length(v_digits) = 14 THEN RETURN 'cnpj'; END IF;
  END IF;
  IF position('@' IN coalesce(p_key, '')) > 1 THEN RETURN 'email'; END IF;
  IF length(v_digits) IN (10,11,12,13) THEN RETURN 'telefone'; END IF;
  RETURN 'aleatoria';
END;
$$;

CREATE OR REPLACE FUNCTION public.gsa_public_register_affiliate(p_payload jsonb)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_payload jsonb := coalesce(p_payload, '{}'::jsonb);
  v_document text := regexp_replace(coalesce(v_payload->>'documento', ''), '\D', '', 'g');
  v_email text := lower(trim(coalesce(v_payload->>'email', '')));
  v_name text := trim(coalesce(v_payload->>'nome_divulgacao', v_payload->>'nome', ''));
  v_pix_key text := trim(coalesce(v_payload->>'pix_chave', ''));
  v_pix_type text := public.gsa_affiliate_normalize_pix_type(v_payload->>'pix_tipo', v_pix_key);
  v_client record;
  v_affiliate public.gsa_afiliados%rowtype;
BEGIN
  IF pg_column_size(v_payload) > 24576 THEN RAISE EXCEPTION 'Dados excedem o limite permitido.'; END IF;
  PERFORM public.gsa_assert_public_rate_limit('cadastro_afiliado_ip', 'cadastro', 8, interval '1 hour');
  IF v_document <> '' THEN
    PERFORM public.gsa_assert_public_rate_limit('cadastro_afiliado_documento', v_document, 4, interval '1 hour');
  END IF;

  IF length(v_name) NOT BETWEEN 3 AND 120 THEN RAISE EXCEPTION 'Informe o nome de divulgacao.'; END IF;
  IF v_document = '' AND (v_email = '' OR v_email !~* '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$') THEN
    RAISE EXCEPTION 'Informe CPF, CNPJ ou e-mail de uma conta GSA existente.';
  END IF;
  IF v_pix_key = '' OR length(v_pix_key) > 180 THEN RAISE EXCEPTION 'Informe uma chave PIX valida.'; END IF;
  IF coalesce((v_payload->>'termos_aceitos')::boolean, false) IS NOT TRUE THEN
    RAISE EXCEPTION 'E necessario aceitar os termos do programa.';
  END IF;

  SELECT c.id, c.nome, c.status, coalesce(c.cadastro_aprovado, true) AS cadastro_aprovado
    INTO v_client
  FROM public.clientes c
  WHERE (v_document <> '' AND regexp_replace(coalesce(c.cpf, c.cnpj, ''), '\D', '', 'g') = v_document)
     OR (v_email <> '' AND lower(coalesce(c.email, '')) = v_email)
  ORDER BY CASE WHEN v_document <> '' AND regexp_replace(coalesce(c.cpf, c.cnpj, ''), '\D', '', 'g') = v_document THEN 0 ELSE 1 END
  LIMIT 1;

  IF v_client.id IS NULL THEN
    RAISE EXCEPTION 'Conta GSA nao localizada. Crie ou regularize sua conta de cliente antes de ativar o perfil de afiliado.';
  END IF;
  IF coalesce(v_client.status, 'ativo') = 'inativo' OR NOT v_client.cadastro_aprovado THEN
    RAISE EXCEPTION 'A conta GSA informada ainda nao possui acesso ativo.';
  END IF;

  SELECT * INTO v_affiliate FROM public.gsa_afiliados WHERE cliente_id = v_client.id FOR UPDATE;
  IF FOUND THEN
    IF v_affiliate.status <> 'ativo' THEN
      RAISE EXCEPTION 'O perfil de afiliado esta %. Procure o atendimento GSA para regularizacao.', v_affiliate.status;
    END IF;
    UPDATE public.gsa_afiliados
       SET nome_divulgacao = v_name,
           pix_tipo = v_pix_type,
           pix_chave = v_pix_key,
           updated_at = now()
     WHERE id = v_affiliate.id
     RETURNING * INTO v_affiliate;
  ELSE
    INSERT INTO public.gsa_afiliados(
      cliente_id, codigo_publico, nome_divulgacao, status,
      pix_tipo, pix_chave, termos_versao, termos_aceitos_em
    ) VALUES (
      v_client.id, public.gsa_affiliate_new_code('A'), v_name, 'ativo',
      v_pix_type, v_pix_key, '2026-07-22', now()
    ) RETURNING * INTO v_affiliate;
  END IF;

  RETURN jsonb_build_object(
    'success', true,
    'client_id', v_client.id,
    'affiliate_id', v_affiliate.id,
    'status', v_affiliate.status,
    'codigo_publico', v_affiliate.codigo_publico
  );
END;
$$;

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

  SELECT coalesce(c.pontos, 0), coalesce(c.saldo_carteira, 0)
    INTO v_points, v_wallet
  FROM public.clientes c WHERE c.id = v_actor.cliente_id;

  SELECT coalesce(max(CASE WHEN key = 'afiliado_pontos_resgate_taxa' THEN value::numeric END), 0.01),
         coalesce(max(CASE WHEN key = 'afiliado_pontos_minimo_resgate' THEN value::integer END), 100),
         coalesce(max(CASE WHEN key = 'afiliado_pontos_ativo' THEN value::boolean END), true)
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
  v_actor record;
  v_id uuid;
  v_type text := public.gsa_affiliate_normalize_pix_type(p_pix_tipo, p_pix_chave);
BEGIN
  SELECT * INTO v_actor FROM public.gsa_client_session_actor(p_sessao_id, p_session_token) LIMIT 1;
  IF length(trim(coalesce(p_nome_divulgacao, ''))) NOT BETWEEN 3 AND 120 THEN RAISE EXCEPTION 'Nome de divulgacao invalido.'; END IF;
  IF length(trim(coalesce(p_pix_chave, ''))) NOT BETWEEN 3 AND 180 THEN RAISE EXCEPTION 'Chave PIX invalida.'; END IF;
  IF length(trim(coalesce(p_termos_versao, ''))) NOT BETWEEN 1 AND 40 THEN RAISE EXCEPTION 'Versao dos termos obrigatoria.'; END IF;

  INSERT INTO public.gsa_afiliados(cliente_id, codigo_publico, nome_divulgacao, status, pix_tipo, pix_chave, termos_versao, termos_aceitos_em)
  VALUES (v_actor.cliente_id, public.gsa_affiliate_new_code('A'), trim(p_nome_divulgacao), 'ativo', v_type, trim(p_pix_chave), trim(p_termos_versao), now())
  ON CONFLICT (cliente_id) DO UPDATE
    SET nome_divulgacao = EXCLUDED.nome_divulgacao,
        pix_tipo = EXCLUDED.pix_tipo,
        pix_chave = EXCLUDED.pix_chave,
        updated_at = now()
    WHERE public.gsa_afiliados.status = 'ativo'
  RETURNING id INTO v_id;

  IF v_id IS NULL THEN RAISE EXCEPTION 'Perfil suspenso ou encerrado. Procure o atendimento GSA.'; END IF;
  RETURN jsonb_build_object('success', true, 'affiliate_id', v_id);
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
DECLARE
  v_actor record;
  v_id uuid;
BEGIN
  SELECT * INTO v_actor FROM public.gsa_client_session_actor(p_sessao_id, p_session_token) LIMIT 1;
  IF length(trim(coalesce(p_nome_divulgacao, ''))) NOT BETWEEN 3 AND 120 THEN RAISE EXCEPTION 'Nome de divulgacao invalido.'; END IF;
  IF length(trim(coalesce(p_pix_chave, ''))) NOT BETWEEN 3 AND 180 THEN RAISE EXCEPTION 'Chave PIX invalida.'; END IF;

  UPDATE public.gsa_afiliados
     SET nome_divulgacao = trim(p_nome_divulgacao),
         pix_tipo = public.gsa_affiliate_normalize_pix_type(p_pix_tipo, p_pix_chave),
         pix_chave = trim(p_pix_chave),
         updated_at = now()
   WHERE cliente_id = v_actor.cliente_id AND status = 'ativo'
   RETURNING id INTO v_id;
  IF v_id IS NULL THEN RAISE EXCEPTION 'Perfil de afiliado ativo nao encontrado.'; END IF;
  RETURN jsonb_build_object('success', true, 'affiliate_id', v_id);
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
  v_actor record;
  v_affiliate_id uuid;
  v_program public.gsa_afiliado_programas%rowtype;
  v_link public.gsa_afiliado_links%rowtype;
  v_destination text := trim(coalesce(p_destino, ''));
BEGIN
  SELECT * INTO v_actor FROM public.gsa_client_session_actor(p_sessao_id, p_session_token) LIMIT 1;
  SELECT id INTO v_affiliate_id FROM public.gsa_afiliados WHERE cliente_id = v_actor.cliente_id AND status = 'ativo';
  IF v_affiliate_id IS NULL THEN RAISE EXCEPTION 'Ative seu perfil de afiliado antes de criar links.'; END IF;

  SELECT * INTO v_program FROM public.gsa_afiliado_programas WHERE codigo = lower(trim(p_programa_codigo)) AND ativo;
  IF v_program.id IS NULL THEN RAISE EXCEPTION 'Programa indisponivel.'; END IF;
  IF v_destination = '' THEN v_destination := v_program.caminho_padrao; END IF;
  IF NOT public.gsa_affiliate_destination_allowed(v_program.id, v_destination) THEN
    RAISE EXCEPTION 'O destino informado nao pertence ao programa selecionado.';
  END IF;

  INSERT INTO public.gsa_afiliado_links(afiliado_id, programa_id, codigo, destino, titulo, ativo)
  VALUES (v_affiliate_id, v_program.id, public.gsa_affiliate_new_code('L'), v_destination, nullif(left(trim(coalesce(p_titulo, '')), 120), ''), true)
  ON CONFLICT (afiliado_id, programa_id, destino) DO UPDATE
    SET titulo = coalesce(EXCLUDED.titulo, public.gsa_afiliado_links.titulo),
        ativo = true,
        updated_at = now()
  RETURNING * INTO v_link;

  RETURN jsonb_build_object('success', true, 'link', to_jsonb(v_link));
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

  SELECT coalesce(min(saque_minimo), 50) INTO v_minimum FROM public.gsa_afiliado_programas WHERE ativo;
  IF coalesce(p_valor, 0) < v_minimum THEN RAISE EXCEPTION 'O valor minimo para saque e R$ %.', v_minimum; END IF;
  IF v_affiliate.pix_chave IS NULL OR v_affiliate.pix_tipo IS NULL THEN RAISE EXCEPTION 'Cadastre uma chave PIX antes de solicitar saque.'; END IF;

  SELECT greatest(
    coalesce((SELECT sum(valor - pago_valor) FROM public.gsa_afiliado_comissoes WHERE afiliado_id = v_affiliate.id AND status = 'disponivel'), 0)
    - coalesce((SELECT sum(valor) FROM public.gsa_afiliado_saques WHERE afiliado_id = v_affiliate.id AND status IN ('solicitado','aprovado')), 0), 0
  ) INTO v_available;
  IF p_valor > v_available THEN RAISE EXCEPTION 'Saldo de comissoes disponivel insuficiente.'; END IF;

  INSERT INTO public.gsa_afiliado_saques(afiliado_id, request_id, valor, status, pix_tipo_snapshot, pix_chave_snapshot)
  VALUES (v_affiliate.id, p_request_id, round(p_valor, 2), 'solicitado', v_affiliate.pix_tipo, v_affiliate.pix_chave)
  ON CONFLICT (request_id) DO UPDATE SET request_id = EXCLUDED.request_id
  RETURNING * INTO v_payout;

  RETURN jsonb_build_object('success', true, 'payout_id', v_payout.id, 'status', v_payout.status);
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
  v_actor record;
  v_id uuid;
BEGIN
  SELECT * INTO v_actor FROM public.gsa_client_session_actor(p_sessao_id, p_session_token) LIMIT 1;
  UPDATE public.gsa_afiliado_saques s
     SET status = 'cancelado', cancelado_em = now(), updated_at = now()
   WHERE s.id = p_saque_id
     AND s.status = 'solicitado'
     AND EXISTS (SELECT 1 FROM public.gsa_afiliados a WHERE a.id = s.afiliado_id AND a.cliente_id = v_actor.cliente_id)
   RETURNING s.id INTO v_id;
  IF v_id IS NULL THEN RAISE EXCEPTION 'Saque nao encontrado ou nao pode mais ser cancelado.'; END IF;
  RETURN jsonb_build_object('success', true, 'payout_id', v_id, 'status', 'cancelado');
END;
$$;

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
BEGIN
  SELECT * INTO v_actor FROM public.gsa_client_session_actor(p_sessao_id, p_session_token) LIMIT 1;
  IF p_request_id IS NULL THEN RAISE EXCEPTION 'Identificador da operacao obrigatorio.'; END IF;

  SELECT coalesce(max(CASE WHEN key = 'afiliado_pontos_resgate_taxa' THEN value::numeric END), 0.01),
         coalesce(max(CASE WHEN key = 'afiliado_pontos_minimo_resgate' THEN value::numeric END), 100),
         coalesce(max(CASE WHEN key = 'afiliado_pontos_ativo' THEN value::boolean END), true)
    INTO v_rate, v_minimum, v_active
  FROM public.system_settings
  WHERE key IN ('afiliado_pontos_resgate_taxa','afiliado_pontos_minimo_resgate','afiliado_pontos_ativo');

  IF NOT v_active THEN RAISE EXCEPTION 'O resgate de pontos esta temporariamente indisponivel.'; END IF;
  IF coalesce(p_pontos, 0) < v_minimum THEN RAISE EXCEPTION 'O minimo para resgate e % pontos.', v_minimum; END IF;

  SELECT pontos INTO v_points FROM public.clientes WHERE id = v_actor.cliente_id FOR UPDATE;
  IF coalesce(v_points, 0) < p_pontos THEN RAISE EXCEPTION 'Saldo de pontos insuficiente.'; END IF;
  v_credit := round(p_pontos * v_rate, 2);
  IF v_credit <= 0 THEN RAISE EXCEPTION 'Conversao de pontos invalida.'; END IF;

  INSERT INTO public.gsa_afiliado_pontos_eventos(cliente_id, tipo, pontos_assinados, valor_carteira, request_id)
  VALUES (v_actor.cliente_id, 'resgate_carteira', -round(p_pontos, 2), v_credit, p_request_id)
  ON CONFLICT (request_id) DO NOTHING;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', true, 'idempotent', true);
  END IF;

  UPDATE public.clientes
     SET pontos = pontos - round(p_pontos, 2),
         saldo_carteira = saldo_carteira + v_credit
   WHERE id = v_actor.cliente_id;

  RETURN jsonb_build_object('success', true, 'pontos', p_pontos, 'valor_creditado', v_credit);
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
    'saques_pendentes', (SELECT count(*) FROM public.gsa_afiliado_saques WHERE status IN ('solicitado','aprovado'))
  ) INTO v_summary;

  SELECT coalesce(jsonb_agg(to_jsonb(p) ORDER BY p.nome), '[]'::jsonb) INTO v_programs
  FROM public.gsa_afiliado_programas p;

  SELECT coalesce(jsonb_agg(to_jsonb(x) ORDER BY x.created_at DESC), '[]'::jsonb) INTO v_affiliates
  FROM (
    SELECT a.id, a.cliente_id, a.nome_divulgacao, a.codigo_publico, a.status,
           a.pix_tipo,
           CASE WHEN a.pix_chave IS NULL THEN NULL ELSE repeat('*', greatest(length(a.pix_chave) - 4, 4)) || right(a.pix_chave, 4) END AS pix_chave_mascarada,
           a.created_at,
           (SELECT count(*) FROM public.gsa_afiliado_cliques c JOIN public.gsa_afiliado_links l ON l.id = c.link_id WHERE l.afiliado_id = a.id) AS cliques,
           (SELECT count(*) FROM public.gsa_afiliado_conversoes c WHERE c.afiliado_id = a.id AND c.status = 'confirmada') AS conversoes,
           coalesce((SELECT sum(m.valor) FROM public.gsa_afiliado_comissoes m WHERE m.afiliado_id = a.id AND m.status <> 'revertida'), 0) AS comissao_total,
           greatest(
             coalesce((SELECT sum(m.valor - m.pago_valor) FROM public.gsa_afiliado_comissoes m WHERE m.afiliado_id = a.id AND m.status = 'disponivel'), 0)
             - coalesce((SELECT sum(s.valor) FROM public.gsa_afiliado_saques s WHERE s.afiliado_id = a.id AND s.status IN ('solicitado','aprovado')), 0), 0
           ) AS saldo_disponivel
    FROM public.gsa_afiliados a
  ) x;

  SELECT coalesce(jsonb_agg(to_jsonb(x) ORDER BY x.solicitado_em DESC), '[]'::jsonb) INTO v_payouts
  FROM (
    SELECT s.id, s.afiliado_id, a.nome_divulgacao AS afiliado_nome, a.codigo_publico,
           s.valor, s.status, s.pix_tipo_snapshot AS pix_tipo,
           s.pix_chave_snapshot AS pix_chave, s.solicitado_em, s.aprovado_em, s.pago_em, s.notas
    FROM public.gsa_afiliado_saques s
    JOIN public.gsa_afiliados a ON a.id = s.afiliado_id
    ORDER BY s.solicitado_em DESC
    LIMIT 500
  ) x;

  RETURN jsonb_build_object('success', true, 'summary', v_summary, 'programs', v_programs, 'affiliates', v_affiliates, 'payouts', v_payouts);
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
DECLARE
  v_program public.gsa_afiliado_programas%rowtype;
BEGIN
  PERFORM public.gsa_admin_validate_context(p_sessao_id, p_session_token);
  PERFORM public.gsa_admin_assert_module('afiliados');

  UPDATE public.gsa_afiliado_programas p
     SET descricao = coalesce(nullif(trim(p_patch->>'descricao'), ''), p.descricao),
         caminho_padrao = coalesce(nullif(trim(p_patch->>'caminho_padrao'), ''), p.caminho_padrao),
         base_tipo = coalesce(nullif(trim(p_patch->>'base_tipo'), ''), p.base_tipo),
         percentual = coalesce((p_patch->>'percentual')::numeric, p.percentual),
         janela_atribuicao_dias = coalesce((p_patch->>'janela_atribuicao_dias')::integer, p.janela_atribuicao_dias),
         carencia_dias = coalesce((p_patch->>'carencia_dias')::integer, p.carencia_dias),
         saque_minimo = coalesce((p_patch->>'saque_minimo')::numeric, p.saque_minimo),
         pontos_por_real = coalesce((p_patch->>'pontos_por_real')::numeric, p.pontos_por_real),
         ativo = coalesce((p_patch->>'ativo')::boolean, p.ativo),
         updated_at = now()
   WHERE p.id = p_program_id
     AND coalesce((p_patch->>'percentual')::numeric, p.percentual) > 0
     AND coalesce((p_patch->>'percentual')::numeric, p.percentual) <= 50
     AND coalesce((p_patch->>'janela_atribuicao_dias')::integer, p.janela_atribuicao_dias) BETWEEN 1 AND 365
     AND coalesce((p_patch->>'carencia_dias')::integer, p.carencia_dias) BETWEEN 0 AND 365
     AND coalesce((p_patch->>'saque_minimo')::numeric, p.saque_minimo) >= 0
     AND coalesce((p_patch->>'pontos_por_real')::numeric, p.pontos_por_real) >= 0
   RETURNING * INTO v_program;
  IF v_program.id IS NULL THEN RAISE EXCEPTION 'Programa nao encontrado ou regras invalidas.'; END IF;

  PERFORM public.gsa_admin_write_audit('afiliados','ATUALIZAR_PROGRAMA_AFILIADO','gsa_afiliado_programas',v_program.id,to_jsonb(v_program));
  RETURN jsonb_build_object('success', true, 'program', to_jsonb(v_program));
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
DECLARE
  v_status text := lower(trim(coalesce(p_status, '')));
BEGIN
  PERFORM public.gsa_admin_validate_context(p_sessao_id, p_session_token);
  PERFORM public.gsa_admin_assert_module('afiliados');
  IF v_status NOT IN ('ativo','suspenso','encerrado') THEN RAISE EXCEPTION 'Status invalido.'; END IF;

  UPDATE public.gsa_afiliados
     SET status = v_status, status_motivo = nullif(left(trim(coalesce(p_reason, '')), 500), ''), updated_at = now()
   WHERE id = p_affiliate_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Afiliado nao encontrado.'; END IF;

  PERFORM public.gsa_admin_write_audit('afiliados','ALTERAR_STATUS_AFILIADO','gsa_afiliados',p_affiliate_id,jsonb_build_object('status',v_status,'motivo',p_reason));
  RETURN jsonb_build_object('success', true, 'affiliate_id', p_affiliate_id, 'status', v_status);
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
    IF v_remaining > 0 THEN RAISE EXCEPTION 'Saldo liberado insuficiente para concluir o pagamento.'; END IF;

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

CREATE OR REPLACE FUNCTION public.gsa_admin_update_affiliate_points_settings(
  p_sessao_id uuid,
  p_session_token text,
  p_rate numeric,
  p_minimum integer,
  p_active boolean
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  PERFORM public.gsa_admin_validate_context(p_sessao_id, p_session_token);
  PERFORM public.gsa_admin_assert_module('afiliados');
  IF coalesce(p_rate, 0) <= 0 OR p_rate > 100 THEN RAISE EXCEPTION 'Taxa de pontos invalida.'; END IF;
  IF coalesce(p_minimum, 0) < 1 OR p_minimum > 1000000 THEN RAISE EXCEPTION 'Minimo de pontos invalido.'; END IF;

  INSERT INTO public.system_settings(key, value) VALUES
    ('afiliado_pontos_resgate_taxa', p_rate::text),
    ('afiliado_pontos_minimo_resgate', p_minimum::text),
    ('afiliado_pontos_ativo', coalesce(p_active, true)::text)
  ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value;

  PERFORM public.gsa_admin_write_audit('afiliados','ATUALIZAR_PONTOS_AFILIADO','system_settings',NULL,jsonb_build_object('taxa',p_rate,'minimo',p_minimum,'ativo',p_active));
  RETURN jsonb_build_object('success', true);
END;
$$;

CREATE OR REPLACE FUNCTION public.gsa_affiliate_award_points()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_client_id uuid;
  v_rate numeric;
  v_points numeric(14,2);
BEGIN
  IF NEW.status <> 'confirmada' THEN RETURN NEW; END IF;
  SELECT a.cliente_id, p.pontos_por_real
    INTO v_client_id, v_rate
  FROM public.gsa_afiliados a
  JOIN public.gsa_afiliado_programas p ON p.id = NEW.programa_id
  WHERE a.id = NEW.afiliado_id;
  v_points := round(greatest(NEW.valor_bruto, 0) * coalesce(v_rate, 0), 2);
  IF v_client_id IS NULL OR v_points <= 0 THEN RETURN NEW; END IF;

  INSERT INTO public.gsa_afiliado_pontos_eventos(cliente_id, afiliado_id, conversao_id, tipo, pontos_assinados, metadata)
  VALUES (v_client_id, NEW.afiliado_id, NEW.id, 'credito_conversao', v_points, jsonb_build_object('programa_id', NEW.programa_id))
  ON CONFLICT DO NOTHING;
  IF FOUND THEN UPDATE public.clientes SET pontos = pontos + v_points WHERE id = v_client_id; END IF;
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.gsa_affiliate_reverse_points()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_credit record;
BEGIN
  IF OLD.status = 'confirmada' AND NEW.status = 'revertida' THEN
    SELECT * INTO v_credit FROM public.gsa_afiliado_pontos_eventos
    WHERE conversao_id = NEW.id AND tipo = 'credito_conversao';
    IF v_credit.id IS NOT NULL THEN
      INSERT INTO public.gsa_afiliado_pontos_eventos(cliente_id, afiliado_id, conversao_id, tipo, pontos_assinados, metadata)
      VALUES (v_credit.cliente_id, v_credit.afiliado_id, NEW.id, 'estorno_conversao', -v_credit.pontos_assinados, jsonb_build_object('motivo','conversao_revertida'))
      ON CONFLICT DO NOTHING;
      IF FOUND THEN
        UPDATE public.clientes SET pontos = greatest(pontos - v_credit.pontos_assinados, 0) WHERE id = v_credit.cliente_id;
      END IF;
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_affiliate_award_points ON public.gsa_afiliado_conversoes;
CREATE TRIGGER trg_affiliate_award_points
AFTER INSERT ON public.gsa_afiliado_conversoes
FOR EACH ROW EXECUTE FUNCTION public.gsa_affiliate_award_points();

DROP TRIGGER IF EXISTS trg_affiliate_reverse_points ON public.gsa_afiliado_conversoes;
CREATE TRIGGER trg_affiliate_reverse_points
AFTER UPDATE OF status ON public.gsa_afiliado_conversoes
FOR EACH ROW EXECUTE FUNCTION public.gsa_affiliate_reverse_points();

CREATE OR REPLACE FUNCTION public.gsa_affiliate_json_numeric(p_row jsonb, p_keys text[])
RETURNS numeric
LANGUAGE plpgsql
IMMUTABLE
SET search_path = public, pg_temp
AS $$
DECLARE
  v_key text;
  v_value text;
BEGIN
  FOREACH v_key IN ARRAY p_keys LOOP
    v_value := trim(coalesce(p_row->>v_key, ''));
    IF v_value ~ '^-?[0-9]+([.,][0-9]+)?$' THEN RETURN replace(v_value, ',', '.')::numeric; END IF;
  END LOOP;
  RETURN 0;
END;
$$;

CREATE OR REPLACE FUNCTION public.gsa_affiliate_conversion_from_business_event()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_row jsonb := to_jsonb(NEW);
  v_status text := lower(coalesce(v_row->>'status', v_row->>'situacao', ''));
  v_attr uuid;
  v_origin uuid;
  v_program text;
  v_value numeric;
BEGIN
  v_attr := nullif(v_row->>'affiliate_attribution_id', '')::uuid;
  v_origin := nullif(v_row->>'id', '')::uuid;
  IF v_attr IS NULL OR v_origin IS NULL THEN RETURN NEW; END IF;

  SELECT p.codigo INTO v_program
  FROM public.gsa_afiliado_atribuicoes a
  JOIN public.gsa_afiliado_programas p ON p.id = a.programa_id
  WHERE a.id = v_attr;
  IF v_program IS NULL THEN RETURN NEW; END IF;

  IF v_status IN ('pago','paga','confirmado','confirmada','concluido','concluida','ativo','ativa','emitida','aprovado','aprovada') THEN
    v_value := public.gsa_affiliate_json_numeric(v_row, ARRAY['valor_pago','valor_total','valor_final','valor','total','preco_final','premio_total']);
    IF v_value > 0 THEN
      PERFORM public.gsa_affiliate_record_conversion(v_attr, v_program, TG_TABLE_NAME, v_origin, 'venda', v_value, v_value, jsonb_build_object('status',v_status));
    END IF;
  ELSIF v_status IN ('cancelado','cancelada','reembolsado','reembolsada','estornado','estornada','rejeitado','rejeitada') THEN
    PERFORM public.gsa_affiliate_reverse_source(v_program, TG_TABLE_NAME, v_origin, v_status);
  END IF;
  RETURN NEW;
END;
$$;

DO $$
DECLARE
  v_table text;
  v_trigger text;
BEGIN
  FOREACH v_table IN ARRAY ARRAY['faturas','viagens_transacoes','classificados_transacoes','saude_contratos','seguros_apolices'] LOOP
    IF to_regclass('public.' || v_table) IS NOT NULL THEN
      v_trigger := 'trg_affiliate_business_' || v_table;
      EXECUTE format('DROP TRIGGER IF EXISTS %I ON public.%I', v_trigger, v_table);
      EXECUTE format('CREATE TRIGGER %I AFTER INSERT OR UPDATE ON public.%I FOR EACH ROW EXECUTE FUNCTION public.gsa_affiliate_conversion_from_business_event()', v_trigger, v_table);
    END IF;
  END LOOP;
END;
$$;

DO $$
DECLARE
  v_table text;
BEGIN
  FOREACH v_table IN ARRAY ARRAY[
    'gsa_afiliado_programas','gsa_afiliados','gsa_afiliado_links','gsa_afiliado_cliques',
    'gsa_afiliado_atribuicoes','gsa_afiliado_conversoes','gsa_afiliado_comissoes',
    'gsa_afiliado_saques','gsa_afiliado_comissao_eventos','gsa_afiliado_pontos_eventos'
  ] LOOP
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', v_table);
    EXECUTE format('REVOKE ALL ON TABLE public.%I FROM anon, authenticated', v_table);
  END LOOP;
END;
$$;

REVOKE ALL ON FUNCTION public.gsa_public_register_affiliate(jsonb) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.gsa_public_register_affiliate(jsonb) TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.gsa_public_affiliate_programs() TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.gsa_public_track_affiliate_click(text,text,text,text) TO anon, authenticated, service_role;

REVOKE ALL ON FUNCTION public.gsa_client_affiliate_snapshot(uuid,text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.gsa_client_join_affiliate(uuid,text,text,text,text,text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.gsa_client_update_affiliate_profile(uuid,text,text,text,text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.gsa_client_create_affiliate_link(uuid,text,text,text,text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.gsa_client_request_affiliate_payout(uuid,text,uuid,numeric) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.gsa_client_cancel_affiliate_payout(uuid,text,uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.gsa_client_redeem_affiliate_points(uuid,text,uuid,numeric) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.gsa_client_affiliate_snapshot(uuid,text) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.gsa_client_join_affiliate(uuid,text,text,text,text,text) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.gsa_client_update_affiliate_profile(uuid,text,text,text,text) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.gsa_client_create_affiliate_link(uuid,text,text,text,text) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.gsa_client_request_affiliate_payout(uuid,text,uuid,numeric) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.gsa_client_cancel_affiliate_payout(uuid,text,uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.gsa_client_redeem_affiliate_points(uuid,text,uuid,numeric) TO authenticated, service_role;

REVOKE ALL ON FUNCTION public.gsa_admin_affiliate_snapshot(uuid,text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.gsa_admin_update_affiliate_program(uuid,text,uuid,jsonb) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.gsa_admin_set_affiliate_status(uuid,text,uuid,text,text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.gsa_admin_decide_affiliate_payout(uuid,text,uuid,text,text,timestamptz) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.gsa_admin_update_affiliate_points_settings(uuid,text,numeric,integer,boolean) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.gsa_admin_affiliate_snapshot(uuid,text) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.gsa_admin_update_affiliate_program(uuid,text,uuid,jsonb) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.gsa_admin_set_affiliate_status(uuid,text,uuid,text,text) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.gsa_admin_decide_affiliate_payout(uuid,text,uuid,text,text,timestamptz) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.gsa_admin_update_affiliate_points_settings(uuid,text,numeric,integer,boolean) TO authenticated, service_role;

DO $$
DECLARE
  v_table text;
BEGIN
  IF EXISTS (SELECT 1 FROM pg_publication WHERE pubname = 'supabase_realtime') THEN
    FOREACH v_table IN ARRAY ARRAY['gsa_afiliados','gsa_afiliado_links','gsa_afiliado_comissoes','gsa_afiliado_saques'] LOOP
      IF NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = v_table) THEN
        EXECUTE format('ALTER PUBLICATION supabase_realtime ADD TABLE public.%I', v_table);
      END IF;
    END LOOP;
  END IF;
END;
$$;

DO $$
BEGIN
  IF to_regnamespace('cron') IS NOT NULL THEN
    BEGIN
      PERFORM cron.unschedule('gsa-affiliate-release-commissions');
    EXCEPTION WHEN OTHERS THEN NULL;
    END;
    PERFORM cron.schedule('gsa-affiliate-release-commissions', '15 * * * *', 'SELECT public.gsa_affiliate_release_due_commissions();');
  END IF;
END;
$$;

COMMIT;
