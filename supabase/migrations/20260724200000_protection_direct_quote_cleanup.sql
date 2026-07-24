BEGIN;

-- Somente o GSA Seguros deixa de funcionar como catálogo interno.
-- GSA Saúde e GSA Viagens permanecem com seus catálogos atuais.

ALTER TABLE IF EXISTS public.seguros_cotacoes
  ADD COLUMN IF NOT EXISTS localidade text,
  ADD COLUMN IF NOT EXISTS inicio_desejado date,
  ADD COLUMN IF NOT EXISTS objeto_segurado text,
  ADD COLUMN IF NOT EXISTS valor_risco numeric(14,2),
  ADD COLUMN IF NOT EXISTS dados jsonb NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS consentimento_em timestamptz NOT NULL DEFAULT now(),
  ADD COLUMN IF NOT EXISTS idempotency_key uuid;

CREATE UNIQUE INDEX IF NOT EXISTS uq_seguros_cotacoes_idempotencia
  ON public.seguros_cotacoes(cliente_id, idempotency_key)
  WHERE idempotency_key IS NOT NULL;

DO $constraints$
DECLARE
  v_constraint record;
BEGIN
  FOR v_constraint IN
    SELECT conrelid::regclass AS table_name, conname
      FROM pg_constraint
     WHERE contype = 'c'
       AND conrelid = to_regclass('public.seguros_cotacoes')
       AND pg_get_constraintdef(oid) ILIKE '%categoria%'
  LOOP
    EXECUTE format('ALTER TABLE %s DROP CONSTRAINT %I', v_constraint.table_name, v_constraint.conname);
  END LOOP;

  IF to_regclass('public.seguros_cotacoes') IS NOT NULL THEN
    ALTER TABLE public.seguros_cotacoes
      ADD CONSTRAINT seguros_cotacoes_categoria_valida
      CHECK (categoria IN ('auto', 'residencial', 'vida', 'empresarial', 'viagem', 'outros')) NOT VALID;
  END IF;
END;
$constraints$;

DO $drop_legacy_quote_functions$
DECLARE
  v_function record;
BEGIN
  FOR v_function IN
    SELECT p.oid::regprocedure AS signature
      FROM pg_proc p
      JOIN pg_namespace n ON n.oid = p.pronamespace
     WHERE n.nspname = 'public'
       AND p.proname = 'gsa_client_seguros_criar_cotacao'
  LOOP
    EXECUTE format('DROP FUNCTION IF EXISTS %s CASCADE', v_function.signature);
  END LOOP;
END;
$drop_legacy_quote_functions$;

CREATE OR REPLACE FUNCTION public.gsa_client_seguros_criar_cotacao(
  p_sessao_id uuid DEFAULT NULL,
  p_session_token text DEFAULT NULL,
  p_payload jsonb DEFAULT '{}'::jsonb,
  p_idempotency_key uuid DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_cliente_id uuid;
  v_categoria text := lower(trim(COALESCE(p_payload ->> 'categoria', '')));
  v_localidade text := trim(COALESCE(p_payload ->> 'localidade', ''));
  v_inicio date := nullif(p_payload ->> 'inicio_desejado', '')::date;
  v_objeto text := trim(COALESCE(p_payload ->> 'objeto_segurado', ''));
  v_valor_raw text := regexp_replace(COALESCE(p_payload ->> 'valor_risco', ''), '[^0-9,.-]', '', 'g');
  v_valor numeric;
  v_id uuid;
  v_protocolo text;
BEGIN
  SELECT s.ator_id
    INTO v_cliente_id
    FROM public.sistema_sessoes s
   WHERE s.id = p_sessao_id
     AND s.session_token = p_session_token
     AND lower(COALESCE(s.ator_tipo, '')) = 'cliente'
     AND lower(COALESCE(s.status, '')) IN ('ativo', 'ativa', 'active')
     AND (s.expira_em IS NULL OR s.expira_em > now())
   LIMIT 1;

  IF v_cliente_id IS NULL THEN
    RAISE EXCEPTION 'Sessão de cliente inválida ou expirada.' USING ERRCODE = '42501';
  END IF;

  IF v_categoria NOT IN ('auto', 'residencial', 'vida', 'empresarial', 'viagem', 'outros') THEN
    RAISE EXCEPTION 'Modalidade de seguro inválida.' USING ERRCODE = '22023';
  END IF;

  IF length(v_localidade) < 3 OR v_inicio IS NULL OR length(v_objeto) < 2 OR v_valor_raw = '' THEN
    RAISE EXCEPTION 'Localidade, data de início, objeto segurado e valor aproximado são obrigatórios.' USING ERRCODE = '22023';
  END IF;

  BEGIN
    IF position(',' IN v_valor_raw) > 0 THEN
      v_valor := replace(replace(v_valor_raw, '.', ''), ',', '.')::numeric;
    ELSE
      v_valor := v_valor_raw::numeric;
    END IF;
  EXCEPTION WHEN invalid_text_representation THEN
    RAISE EXCEPTION 'Informe um valor aproximado válido para o bem ou capital.' USING ERRCODE = '22023';
  END;

  IF v_valor <= 0 THEN
    RAISE EXCEPTION 'Informe um valor aproximado maior que zero.' USING ERRCODE = '22023';
  END IF;

  IF lower(COALESCE(p_payload ->> 'consentimento', '')) <> 'sim' THEN
    RAISE EXCEPTION 'O consentimento é obrigatório.' USING ERRCODE = '22023';
  END IF;

  IF p_idempotency_key IS NOT NULL THEN
    SELECT id, protocolo
      INTO v_id, v_protocolo
      FROM public.seguros_cotacoes
     WHERE cliente_id = v_cliente_id
       AND idempotency_key = p_idempotency_key
     LIMIT 1;

    IF v_id IS NOT NULL THEN
      RETURN jsonb_build_object(
        'success', true,
        'id', v_id,
        'protocolo', v_protocolo,
        'idempotent', true
      );
    END IF;
  END IF;

  v_protocolo := 'SEG-' || to_char(clock_timestamp(), 'YYYYMMDD') || '-' || upper(substr(encode(gen_random_bytes(6), 'hex'), 1, 10));

  INSERT INTO public.seguros_cotacoes (
    cliente_id,
    protocolo,
    categoria,
    localidade,
    inicio_desejado,
    objeto_segurado,
    valor_risco,
    dados,
    consentimento_em,
    idempotency_key,
    status
  ) VALUES (
    v_cliente_id,
    v_protocolo,
    v_categoria,
    v_localidade,
    v_inicio,
    v_objeto,
    v_valor,
    p_payload - ARRAY['request_id', 'consentimento'],
    now(),
    p_idempotency_key,
    'recebida'
  )
  RETURNING id INTO v_id;

  RETURN jsonb_build_object('success', true, 'id', v_id, 'protocolo', v_protocolo);
END;
$$;

REVOKE ALL ON FUNCTION public.gsa_client_seguros_criar_cotacao(uuid, text, jsonb, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.gsa_client_seguros_criar_cotacao(uuid, text, jsonb, uuid) TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.gsa_admin_resource_config(p_resource text)
RETURNS jsonb
LANGUAGE plpgsql
IMMUTABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_resource text := lower(trim(COALESCE(p_resource, '')));
BEGIN
  RETURN CASE v_resource
    WHEN 'classificados_anuncios' THEN jsonb_build_object('table','classificados_anuncios','module','classificados','status_column','status')
    WHEN 'classificados_mensagens' THEN jsonb_build_object('table','classificados_mensagens','module','classificados','status_column','status_moderacao')
    WHEN 'classificados_transacoes' THEN jsonb_build_object('table','classificados_transacoes','module','classificados','status_column','status')
    WHEN 'saude_parceiros' THEN jsonb_build_object('table','saude_parceiros','module','saude','status_column','status')
    WHEN 'saude_produtos' THEN jsonb_build_object('table','saude_produtos','module','saude','status_column','status')
    WHEN 'saude_cotacoes' THEN jsonb_build_object('table','saude_cotacoes','module','saude','status_column','status')
    WHEN 'saude_propostas' THEN jsonb_build_object('table','saude_propostas','module','saude','status_column','status')
    WHEN 'saude_contratos' THEN jsonb_build_object('table','saude_contratos','module','saude','status_column','status')
    WHEN 'saude_assessorias' THEN jsonb_build_object('table','saude_assessorias','module','saude','status_column','status')
    WHEN 'saude_comissoes' THEN jsonb_build_object('table','saude_comissoes','module','saude','status_column','status')
    WHEN 'saude_documentos' THEN jsonb_build_object('table','saude_documentos','module','saude','status_column','status')
    WHEN 'saude_atendimentos' THEN jsonb_build_object('table','saude_atendimentos','module','saude','status_column','status')
    WHEN 'seguros_parceiros' THEN jsonb_build_object('table','seguros_parceiros','module','seguros','status_column','status')
    WHEN 'seguros_cotacoes' THEN jsonb_build_object('table','seguros_cotacoes','module','seguros','status_column','status')
    WHEN 'seguros_propostas' THEN jsonb_build_object('table','seguros_propostas','module','seguros','status_column','status')
    WHEN 'seguros_apolices' THEN jsonb_build_object('table','seguros_apolices','module','seguros','status_column','status')
    WHEN 'seguros_assessorias' THEN jsonb_build_object('table','seguros_assessorias','module','seguros','status_column','status')
    WHEN 'seguros_comissoes' THEN jsonb_build_object('table','seguros_comissoes','module','seguros','status_column','status')
    WHEN 'seguros_documentos' THEN jsonb_build_object('table','seguros_documentos','module','seguros','status_column','status')
    WHEN 'seguros_assistencias' THEN jsonb_build_object('table','seguros_assistencias','module','seguros','status_column','status')
    WHEN 'seguros_sinistros' THEN jsonb_build_object('table','seguros_sinistros','module','seguros','status_column','status')
    WHEN 'seguros_atendimentos' THEN jsonb_build_object('table','seguros_atendimentos','module','seguros','status_column','status')
    WHEN 'ordens_fiscais' THEN jsonb_build_object('table','ordens_fiscais','module','fiscal','status_column','status_emissao')
    WHEN 'empresa' THEN jsonb_build_object('table','empresa','module','configuracoes','status_column',NULL)
    WHEN 'formas_pagamento' THEN jsonb_build_object('table','formas_pagamento','module','configuracoes','status_column','ativo')
    ELSE NULL
  END;
END;
$$;

CREATE OR REPLACE FUNCTION public.gsa_admin_save_protection_entity(
  p_sessao_id uuid DEFAULT NULL,
  p_session_token text DEFAULT NULL,
  p_domain text DEFAULT NULL,
  p_kind text DEFAULT NULL,
  p_id uuid DEFAULT NULL,
  p_payload jsonb DEFAULT '{}'::jsonb
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_domain text := lower(trim(COALESCE(p_domain, '')));
  v_kind text := lower(trim(COALESCE(p_kind, '')));
  v_table text;
  v_id uuid := p_id;
  v_name text := trim(COALESCE(p_payload ->> 'nome', ''));
BEGIN
  PERFORM public.gsa_admin_validate_context(p_sessao_id, p_session_token);

  IF v_domain NOT IN ('saude', 'seguros') THEN
    RAISE EXCEPTION 'Domínio de proteção inválido.' USING ERRCODE = '22023';
  END IF;

  PERFORM public.gsa_admin_assert_module(v_domain);

  IF v_kind = 'parceiro' THEN
    v_table := v_domain || '_parceiros';

    IF length(v_name) < 2 THEN
      RAISE EXCEPTION 'Informe o nome do parceiro.' USING ERRCODE = '22023';
    END IF;

    IF v_id IS NULL THEN
      EXECUTE format(
        'INSERT INTO public.%I (nome, documento, site, contato, comissao_tipo, comissao_valor, observacoes, status) VALUES ($1,$2,$3,$4,$5,$6,$7,$8) RETURNING id',
        v_table
      ) INTO v_id USING
        v_name,
        nullif(trim(COALESCE(p_payload ->> 'documento', '')), ''),
        nullif(trim(COALESCE(p_payload ->> 'site', '')), ''),
        nullif(trim(COALESCE(p_payload ->> 'contato', '')), ''),
        COALESCE(nullif(trim(COALESCE(p_payload ->> 'comissao_tipo', '')), ''), 'porcentagem'),
        COALESCE((p_payload ->> 'comissao_valor')::numeric, 0),
        nullif(trim(COALESCE(p_payload ->> 'observacoes', '')), ''),
        COALESCE(nullif(trim(COALESCE(p_payload ->> 'status', '')), ''), 'ativo');
    ELSE
      EXECUTE format(
        'UPDATE public.%I SET nome=$1, documento=$2, site=$3, contato=$4, comissao_tipo=$5, comissao_valor=$6, observacoes=$7, status=$8, updated_at=now() WHERE id=$9',
        v_table
      ) USING
        v_name,
        nullif(trim(COALESCE(p_payload ->> 'documento', '')), ''),
        nullif(trim(COALESCE(p_payload ->> 'site', '')), ''),
        nullif(trim(COALESCE(p_payload ->> 'contato', '')), ''),
        COALESCE(nullif(trim(COALESCE(p_payload ->> 'comissao_tipo', '')), ''), 'porcentagem'),
        COALESCE((p_payload ->> 'comissao_valor')::numeric, 0),
        nullif(trim(COALESCE(p_payload ->> 'observacoes', '')), ''),
        COALESCE(nullif(trim(COALESCE(p_payload ->> 'status', '')), ''), 'ativo'),
        v_id;
    END IF;
  ELSIF v_kind = 'produto' AND v_domain = 'saude' THEN
    v_table := 'saude_produtos';

    IF length(v_name) < 2 THEN
      RAISE EXCEPTION 'Informe o nome do produto.' USING ERRCODE = '22023';
    END IF;

    IF v_id IS NULL THEN
      EXECUTE format(
        'INSERT INTO public.%I (nome, slug, parceiro_id, categoria, imagem_url, preco_referencia, resumo, destaque, status) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9) RETURNING id',
        v_table
      ) INTO v_id USING
        v_name,
        lower(COALESCE(nullif(trim(p_payload ->> 'slug'), ''), regexp_replace(unaccent(v_name), '[^a-zA-Z0-9]+', '-', 'g'))),
        nullif(p_payload ->> 'parceiro_id', '')::uuid,
        nullif(trim(COALESCE(p_payload ->> 'categoria', '')), ''),
        nullif(trim(COALESCE(p_payload ->> 'imagem_url', '')), ''),
        nullif(p_payload ->> 'preco_referencia', '')::numeric,
        nullif(trim(COALESCE(p_payload ->> 'resumo', '')), ''),
        COALESCE((p_payload ->> 'destaque')::boolean, false),
        COALESCE(nullif(trim(COALESCE(p_payload ->> 'status', '')), ''), 'rascunho');
    ELSE
      EXECUTE format(
        'UPDATE public.%I SET nome=$1, slug=$2, parceiro_id=$3, categoria=$4, imagem_url=$5, preco_referencia=$6, resumo=$7, destaque=$8, status=$9, updated_at=now() WHERE id=$10',
        v_table
      ) USING
        v_name,
        lower(COALESCE(nullif(trim(p_payload ->> 'slug'), ''), regexp_replace(unaccent(v_name), '[^a-zA-Z0-9]+', '-', 'g'))),
        nullif(p_payload ->> 'parceiro_id', '')::uuid,
        nullif(trim(COALESCE(p_payload ->> 'categoria', '')), ''),
        nullif(trim(COALESCE(p_payload ->> 'imagem_url', '')), ''),
        nullif(p_payload ->> 'preco_referencia', '')::numeric,
        nullif(trim(COALESCE(p_payload ->> 'resumo', '')), ''),
        COALESCE((p_payload ->> 'destaque')::boolean, false),
        COALESCE(nullif(trim(COALESCE(p_payload ->> 'status', '')), ''), 'rascunho'),
        v_id;
    END IF;
  ELSIF v_kind = 'produto' AND v_domain = 'seguros' THEN
    RAISE EXCEPTION 'O cadastro de produtos e ofertas de seguros foi descontinuado.' USING ERRCODE = '22023';
  ELSE
    RAISE EXCEPTION 'Tipo de entidade de proteção inválido.' USING ERRCODE = '22023';
  END IF;

  IF NOT FOUND AND p_id IS NOT NULL THEN
    RAISE EXCEPTION 'Registro não encontrado.' USING ERRCODE = 'P0002';
  END IF;

  PERFORM public.gsa_admin_write_audit(
    v_domain,
    CASE WHEN p_id IS NULL THEN 'CRIAR' ELSE 'EDITAR' END,
    v_table,
    v_id,
    jsonb_build_object('kind', v_kind)
  );

  RETURN jsonb_build_object('success', true, 'id', v_id);
END;
$$;

CREATE OR REPLACE FUNCTION public.gsa_admin_create_protection_proposal(
  p_sessao_id uuid DEFAULT NULL,
  p_session_token text DEFAULT NULL,
  p_domain text DEFAULT NULL,
  p_payload jsonb DEFAULT '{}'::jsonb
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_domain text := lower(trim(COALESCE(p_domain, '')));
  v_quote_table text;
  v_proposal_table text;
  v_quote jsonb;
  v_quote_id uuid := nullif(p_payload ->> 'cotacao_id', '')::uuid;
  v_partner_id uuid := nullif(p_payload ->> 'parceiro_id', '')::uuid;
  v_product_id uuid := nullif(p_payload ->> 'produto_id', '')::uuid;
  v_id uuid;
  v_protocol text;
  v_amount numeric := nullif(p_payload ->> 'valor', '')::numeric;
  v_validity integer := LEAST(GREATEST(COALESCE((p_payload ->> 'validade_dias')::integer, 5), 1), 90);
BEGIN
  PERFORM public.gsa_admin_validate_context(p_sessao_id, p_session_token);

  IF v_domain NOT IN ('saude', 'seguros') THEN
    RAISE EXCEPTION 'Domínio de proteção inválido.' USING ERRCODE = '22023';
  END IF;

  PERFORM public.gsa_admin_assert_module(v_domain);

  IF v_quote_id IS NULL OR v_partner_id IS NULL OR v_amount IS NULL OR v_amount <= 0 THEN
    RAISE EXCEPTION 'Cotação, parceiro e valor são obrigatórios.' USING ERRCODE = '22023';
  END IF;

  v_quote_table := v_domain || '_cotacoes';
  v_proposal_table := v_domain || '_propostas';

  EXECUTE format('SELECT to_jsonb(q) FROM public.%I q WHERE q.id=$1 FOR UPDATE', v_quote_table)
    INTO v_quote USING v_quote_id;

  IF v_quote IS NULL THEN
    RAISE EXCEPTION 'Cotação não encontrada.' USING ERRCODE = 'P0002';
  END IF;

  v_protocol := upper(
    CASE WHEN v_domain = 'saude' THEN 'SAU' ELSE 'SEG' END
    || '-PROP-'
    || substr(encode(gen_random_bytes(8), 'hex'), 1, 12)
  );

  IF v_domain = 'saude' THEN
    INSERT INTO public.saude_propostas (
      cotacao_id,
      cliente_id,
      parceiro_id,
      produto_id,
      protocolo,
      titulo,
      mensalidade_operadora,
      taxa_assessoria_gsa,
      validade_ate,
      status
    ) VALUES (
      v_quote_id,
      (v_quote ->> 'cliente_id')::uuid,
      v_partner_id,
      v_product_id,
      v_protocol,
      COALESCE(nullif(trim(p_payload ->> 'titulo'), ''), 'Proposta ' || v_protocol),
      v_amount,
      COALESCE(nullif(p_payload ->> 'taxa_assessoria_gsa', '')::numeric, 0),
      now() + make_interval(days => v_validity),
      'enviada'
    )
    RETURNING id INTO v_id;
  ELSE
    INSERT INTO public.seguros_propostas (
      cotacao_id,
      cliente_id,
      parceiro_id,
      protocolo,
      titulo,
      premio_seguradora,
      franquia,
      taxa_assessoria_gsa,
      validade_ate,
      status
    ) VALUES (
      v_quote_id,
      (v_quote ->> 'cliente_id')::uuid,
      v_partner_id,
      v_protocol,
      COALESCE(nullif(trim(p_payload ->> 'titulo'), ''), 'Proposta ' || v_protocol),
      v_amount,
      nullif(p_payload ->> 'franquia', '')::numeric,
      COALESCE(nullif(p_payload ->> 'taxa_assessoria_gsa', '')::numeric, 0),
      now() + make_interval(days => v_validity),
      'enviada'
    )
    RETURNING id INTO v_id;
  END IF;

  EXECUTE format(
    'UPDATE public.%I SET status=''propostas_disponiveis'', updated_at=now() WHERE id=$1',
    v_quote_table
  ) USING v_quote_id;

  PERFORM public.gsa_admin_write_audit(
    v_domain,
    'CRIAR_PROPOSTA',
    v_proposal_table,
    v_id,
    jsonb_build_object('quote_id', v_quote_id, 'amount', v_amount)
  );

  RETURN jsonb_build_object('success', true, 'id', v_id, 'protocol', v_protocol);
END;
$$;

ALTER TABLE IF EXISTS public.seguros_cotacoes DROP COLUMN IF EXISTS produto_id;
ALTER TABLE IF EXISTS public.seguros_cotacoes DROP COLUMN IF EXISTS oferta_id;
ALTER TABLE IF EXISTS public.seguros_propostas DROP COLUMN IF EXISTS produto_id;
ALTER TABLE IF EXISTS public.seguros_propostas DROP COLUMN IF EXISTS oferta_id;
ALTER TABLE IF EXISTS public.seguros_apolices DROP COLUMN IF EXISTS produto_id;
ALTER TABLE IF EXISTS public.seguros_apolices DROP COLUMN IF EXISTS oferta_id;

DROP VIEW IF EXISTS public.seguros_ofertas_publicas CASCADE;

DO $functions$
DECLARE
  v_function record;
BEGIN
  FOR v_function IN
    SELECT n.nspname, p.proname, pg_get_function_identity_arguments(p.oid) AS arguments
      FROM pg_proc p
      JOIN pg_namespace n ON n.oid = p.pronamespace
     WHERE n.nspname = 'public'
       AND p.proname = ANY(ARRAY[
         'gsa_public_listar_seguros',
         'gsa_public_listar_ofertas_seguros',
         'gsa_public_obter_oferta_seguro'
       ])
  LOOP
    EXECUTE format(
      'DROP FUNCTION IF EXISTS %I.%I(%s) CASCADE',
      v_function.nspname,
      v_function.proname,
      v_function.arguments
    );
  END LOOP;
END;
$functions$;

DO $catalog$
DECLARE
  v_relation text;
BEGIN
  FOREACH v_relation IN ARRAY ARRAY[
    'seguros_produto_coberturas',
    'seguros_coberturas',
    'seguros_ofertas',
    'seguros_produtos'
  ]
  LOOP
    IF to_regclass(format('public.%I', v_relation)) IS NOT NULL THEN
      EXECUTE format('DROP TABLE public.%I CASCADE', v_relation);
    END IF;
  END LOOP;
END;
$catalog$;

NOTIFY pgrst, 'reload schema';
COMMIT;
