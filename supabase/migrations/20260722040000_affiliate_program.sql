BEGIN;

-- Programa de afiliados GSA.
--
-- Principios de seguranca e contabilizacao:
--   * um afiliado e sempre um cliente GSA autenticado;
--   * codigos de links sao opacos e nao carregam ids internos;
--   * o token bruto do clique e devolvido uma unica vez e somente seu SHA-256
--     e persistido;
--   * a atribuicao e last-click por cliente/programa e e congelada na venda;
--   * percentual, base e carencia sao fotografados na conversao/comissao;
--   * todo saldo e derivado de um ledger imutavel, incluindo estornos e saques;
--   * nenhuma tabela deste modulo e acessivel diretamente pelo navegador.

CREATE TABLE IF NOT EXISTS public.gsa_afiliado_programas (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  codigo text NOT NULL UNIQUE,
  nome text NOT NULL,
  descricao text,
  caminho_padrao text NOT NULL,
  prefixos_permitidos text[] NOT NULL DEFAULT ARRAY['/']::text[],
  base_tipo text NOT NULL DEFAULT 'venda_bruta',
  percentual numeric(8,4) NOT NULL,
  janela_atribuicao_dias integer NOT NULL DEFAULT 30,
  carencia_dias integer NOT NULL DEFAULT 30,
  saque_minimo numeric(14,2) NOT NULL DEFAULT 50,
  ativo boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT gsa_afiliado_programas_codigo_check
    CHECK (codigo ~ '^[a-z][a-z0-9_]{1,31}$'),
  CONSTRAINT gsa_afiliado_programas_caminho_check
    CHECK (caminho_padrao ~ '^/' AND caminho_padrao !~ '[?#]'),
  CONSTRAINT gsa_afiliado_programas_base_check
    CHECK (base_tipo IN ('venda_bruta','venda_liquida','receita_gsa','valor_pago')),
  CONSTRAINT gsa_afiliado_programas_percentual_check
    CHECK (percentual > 0 AND percentual <= 50),
  CONSTRAINT gsa_afiliado_programas_janela_check
    CHECK (janela_atribuicao_dias BETWEEN 1 AND 365),
  CONSTRAINT gsa_afiliado_programas_carencia_check
    CHECK (carencia_dias BETWEEN 0 AND 365),
  CONSTRAINT gsa_afiliado_programas_saque_check
    CHECK (saque_minimo >= 0)
);

CREATE TABLE IF NOT EXISTS public.gsa_afiliados (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  cliente_id uuid NOT NULL UNIQUE REFERENCES public.clientes(id) ON DELETE RESTRICT,
  codigo_publico text NOT NULL UNIQUE,
  nome_divulgacao text NOT NULL,
  status text NOT NULL DEFAULT 'ativo',
  status_motivo text,
  pix_tipo text,
  pix_chave text,
  termos_versao text NOT NULL,
  termos_aceitos_em timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT gsa_afiliados_codigo_check CHECK (codigo_publico ~ '^A[0-9A-F]{20,32}$'),
  CONSTRAINT gsa_afiliados_status_check CHECK (status IN ('ativo','suspenso','encerrado')),
  CONSTRAINT gsa_afiliados_pix_tipo_check CHECK (
    pix_tipo IS NULL OR pix_tipo IN ('cpf','cnpj','email','telefone','aleatoria')
  )
);

CREATE TABLE IF NOT EXISTS public.gsa_afiliado_links (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  afiliado_id uuid NOT NULL REFERENCES public.gsa_afiliados(id) ON DELETE RESTRICT,
  programa_id uuid NOT NULL REFERENCES public.gsa_afiliado_programas(id) ON DELETE RESTRICT,
  codigo text NOT NULL UNIQUE,
  destino text NOT NULL,
  titulo text,
  ativo boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT gsa_afiliado_links_codigo_check CHECK (codigo ~ '^L[0-9A-F]{20,32}$'),
  CONSTRAINT gsa_afiliado_links_destino_check CHECK (destino ~ '^/' AND destino !~ '[?#]'),
  UNIQUE (afiliado_id, programa_id, destino)
);

CREATE TABLE IF NOT EXISTS public.gsa_afiliado_cliques (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  link_id uuid NOT NULL REFERENCES public.gsa_afiliado_links(id) ON DELETE RESTRICT,
  token_hash text NOT NULL UNIQUE,
  visitante_hash text NOT NULL,
  landing_path text NOT NULL,
  referrer_host text,
  expires_at timestamptz NOT NULL,
  cliente_id uuid REFERENCES public.clientes(id) ON DELETE RESTRICT,
  vinculado_em timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT gsa_afiliado_cliques_token_hash_check CHECK (token_hash ~ '^[0-9a-f]{64}$'),
  CONSTRAINT gsa_afiliado_cliques_visitante_hash_check CHECK (visitante_hash ~ '^[0-9a-f]{64}$'),
  CONSTRAINT gsa_afiliado_cliques_landing_check CHECK (landing_path ~ '^/' AND landing_path !~ '[?#]')
);

CREATE TABLE IF NOT EXISTS public.gsa_afiliado_atribuicoes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  cliente_id uuid NOT NULL REFERENCES public.clientes(id) ON DELETE RESTRICT,
  afiliado_id uuid NOT NULL REFERENCES public.gsa_afiliados(id) ON DELETE RESTRICT,
  programa_id uuid NOT NULL REFERENCES public.gsa_afiliado_programas(id) ON DELETE RESTRICT,
  link_id uuid NOT NULL REFERENCES public.gsa_afiliado_links(id) ON DELETE RESTRICT,
  clique_id uuid NOT NULL UNIQUE REFERENCES public.gsa_afiliado_cliques(id) ON DELETE RESTRICT,
  modelo text NOT NULL DEFAULT 'last_click',
  atribuida_em timestamptz NOT NULL,
  expires_at timestamptz NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT gsa_afiliado_atribuicoes_modelo_check CHECK (modelo = 'last_click'),
  UNIQUE (cliente_id, programa_id)
);

CREATE TABLE IF NOT EXISTS public.gsa_afiliado_conversoes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  atribuicao_id uuid NOT NULL REFERENCES public.gsa_afiliado_atribuicoes(id) ON DELETE RESTRICT,
  afiliado_id uuid NOT NULL REFERENCES public.gsa_afiliados(id) ON DELETE RESTRICT,
  programa_id uuid NOT NULL REFERENCES public.gsa_afiliado_programas(id) ON DELETE RESTRICT,
  comprador_id uuid NOT NULL REFERENCES public.clientes(id) ON DELETE RESTRICT,
  origem_tipo text NOT NULL,
  origem_id uuid NOT NULL,
  evento text NOT NULL DEFAULT 'venda',
  valor_bruto numeric(14,2) NOT NULL,
  base_elegivel numeric(14,2) NOT NULL,
  base_tipo_snapshot text NOT NULL,
  status text NOT NULL DEFAULT 'confirmada',
  ocorreu_em timestamptz NOT NULL DEFAULT now(),
  revertida_em timestamptz,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT gsa_afiliado_conversoes_valores_check CHECK (valor_bruto >= 0 AND base_elegivel >= 0),
  CONSTRAINT gsa_afiliado_conversoes_base_check CHECK (
    base_tipo_snapshot IN ('venda_bruta','venda_liquida','receita_gsa','valor_pago')
  ),
  CONSTRAINT gsa_afiliado_conversoes_status_check CHECK (status IN ('confirmada','revertida')),
  UNIQUE (programa_id, origem_tipo, origem_id, evento)
);

CREATE TABLE IF NOT EXISTS public.gsa_afiliado_comissoes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  conversao_id uuid NOT NULL UNIQUE REFERENCES public.gsa_afiliado_conversoes(id) ON DELETE RESTRICT,
  afiliado_id uuid NOT NULL REFERENCES public.gsa_afiliados(id) ON DELETE RESTRICT,
  programa_id uuid NOT NULL REFERENCES public.gsa_afiliado_programas(id) ON DELETE RESTRICT,
  percentual_snapshot numeric(8,4) NOT NULL,
  base_elegivel_snapshot numeric(14,2) NOT NULL,
  valor numeric(14,2) NOT NULL,
  status text NOT NULL DEFAULT 'pendente',
  disponivel_em timestamptz NOT NULL,
  pago_valor numeric(14,2) NOT NULL DEFAULT 0,
  paga_em timestamptz,
  revertida_em timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT gsa_afiliado_comissoes_percentual_check
    CHECK (percentual_snapshot > 0 AND percentual_snapshot <= 50),
  CONSTRAINT gsa_afiliado_comissoes_valores_check
    CHECK (base_elegivel_snapshot >= 0 AND valor >= 0 AND pago_valor >= 0 AND pago_valor <= valor),
  CONSTRAINT gsa_afiliado_comissoes_status_check
    CHECK (status IN ('pendente','disponivel','paga','revertida'))
);

CREATE TABLE IF NOT EXISTS public.gsa_afiliado_saques (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  afiliado_id uuid NOT NULL REFERENCES public.gsa_afiliados(id) ON DELETE RESTRICT,
  request_id uuid NOT NULL UNIQUE,
  valor numeric(14,2) NOT NULL,
  status text NOT NULL DEFAULT 'solicitado',
  pix_tipo_snapshot text NOT NULL,
  pix_chave_snapshot text NOT NULL,
  solicitado_em timestamptz NOT NULL DEFAULT now(),
  aprovado_em timestamptz,
  pago_em timestamptz,
  rejeitado_em timestamptz,
  cancelado_em timestamptz,
  notas text,
  decidido_por uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT gsa_afiliado_saques_valor_check CHECK (valor > 0),
  CONSTRAINT gsa_afiliado_saques_pix_tipo_check
    CHECK (pix_tipo_snapshot IN ('cpf','cnpj','email','telefone','aleatoria')),
  CONSTRAINT gsa_afiliado_saques_status_check
    CHECK (status IN ('solicitado','aprovado','pago','rejeitado','cancelado'))
);

CREATE TABLE IF NOT EXISTS public.gsa_afiliado_comissao_eventos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  afiliado_id uuid NOT NULL REFERENCES public.gsa_afiliados(id) ON DELETE RESTRICT,
  comissao_id uuid REFERENCES public.gsa_afiliado_comissoes(id) ON DELETE RESTRICT,
  saque_id uuid REFERENCES public.gsa_afiliado_saques(id) ON DELETE RESTRICT,
  tipo text NOT NULL,
  valor_assinado numeric(14,2) NOT NULL,
  efetivo_em timestamptz NOT NULL DEFAULT now(),
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT gsa_afiliado_comissao_eventos_tipo_check
    CHECK (tipo IN ('comissao','estorno','saque','ajuste')),
  CONSTRAINT gsa_afiliado_comissao_eventos_referencia_check
    CHECK (comissao_id IS NOT NULL OR saque_id IS NOT NULL OR tipo = 'ajuste')
);

CREATE UNIQUE INDEX IF NOT EXISTS ux_gsa_afiliado_evento_comissao_credito
  ON public.gsa_afiliado_comissao_eventos(comissao_id, tipo)
  WHERE comissao_id IS NOT NULL AND tipo IN ('comissao','estorno');
CREATE UNIQUE INDEX IF NOT EXISTS ux_gsa_afiliado_evento_saque
  ON public.gsa_afiliado_comissao_eventos(saque_id, tipo)
  WHERE saque_id IS NOT NULL AND tipo = 'saque';
CREATE INDEX IF NOT EXISTS ix_gsa_afiliado_links_lookup
  ON public.gsa_afiliado_links(codigo) WHERE ativo;
CREATE INDEX IF NOT EXISTS ix_gsa_afiliado_cliques_expira
  ON public.gsa_afiliado_cliques(expires_at);
CREATE INDEX IF NOT EXISTS ix_gsa_afiliado_atribuicoes_cliente
  ON public.gsa_afiliado_atribuicoes(cliente_id, programa_id, expires_at DESC);
CREATE INDEX IF NOT EXISTS ix_gsa_afiliado_comissoes_saldo
  ON public.gsa_afiliado_comissoes(afiliado_id, status, disponivel_em);
CREATE INDEX IF NOT EXISTS ix_gsa_afiliado_eventos_saldo
  ON public.gsa_afiliado_comissao_eventos(afiliado_id, efetivo_em);
CREATE INDEX IF NOT EXISTS ix_gsa_afiliado_saques_fila
  ON public.gsa_afiliado_saques(status, solicitado_em);

INSERT INTO public.gsa_afiliado_programas
  (codigo,nome,descricao,caminho_padrao,prefixos_permitidos,base_tipo,percentual,janela_atribuicao_dias,carencia_dias,saque_minimo,ativo)
VALUES
  ('loja','GSA Loja','Produtos, servicos e assinaturas vendidos na GSA Loja.','/loja',ARRAY['/loja','/cliente/loja'],'venda_liquida',5,30,30,50,true),
  ('viagens','GSA Viagens','Pacotes e reservas confirmados no GSA Viagens.','/viagens',ARRAY['/viagens','/cliente/viagens'],'valor_pago',3,30,30,50,true),
  ('classificados','GSA Classificados','Negocios concluidos no GSA Classificados.','/classificados',ARRAY['/classificados','/cliente/classificados'],'venda_bruta',2,30,30,50,true),
  ('servicos','Servicos GSA','Servicos GSA faturados fora do checkout da loja.','/servicos',ARRAY['/servicos','/cliente/servicos'],'valor_pago',5,30,30,50,true),
  ('saude','GSA Saude','Contratos ativados com parceiros do GSA Saude.','/saude',ARRAY['/saude','/cliente/saude'],'venda_bruta',3,30,30,50,true),
  ('seguros','GSA Seguros','Apolices ativadas com parceiros do GSA Seguros.','/seguros',ARRAY['/seguros','/cliente/seguros'],'venda_bruta',3,30,30,50,true)
ON CONFLICT (codigo) DO NOTHING;

-- A coluna congela a atribuicao vigente no momento em que cada entidade nasce.
ALTER TABLE public.orcamentos ADD COLUMN IF NOT EXISTS affiliate_attribution_id uuid REFERENCES public.gsa_afiliado_atribuicoes(id) ON DELETE RESTRICT;
ALTER TABLE public.faturas ADD COLUMN IF NOT EXISTS affiliate_attribution_id uuid REFERENCES public.gsa_afiliado_atribuicoes(id) ON DELETE RESTRICT;
ALTER TABLE public.viagens_orcamentos ADD COLUMN IF NOT EXISTS affiliate_attribution_id uuid REFERENCES public.gsa_afiliado_atribuicoes(id) ON DELETE RESTRICT;
ALTER TABLE public.viagens_solicitacoes_reserva ADD COLUMN IF NOT EXISTS affiliate_attribution_id uuid REFERENCES public.gsa_afiliado_atribuicoes(id) ON DELETE RESTRICT;
ALTER TABLE public.viagens_propostas ADD COLUMN IF NOT EXISTS affiliate_attribution_id uuid REFERENCES public.gsa_afiliado_atribuicoes(id) ON DELETE RESTRICT;
ALTER TABLE public.viagens_transacoes ADD COLUMN IF NOT EXISTS affiliate_attribution_id uuid REFERENCES public.gsa_afiliado_atribuicoes(id) ON DELETE RESTRICT;
ALTER TABLE public.classificados_propostas ADD COLUMN IF NOT EXISTS affiliate_attribution_id uuid REFERENCES public.gsa_afiliado_atribuicoes(id) ON DELETE RESTRICT;
ALTER TABLE public.classificados_transacoes ADD COLUMN IF NOT EXISTS affiliate_attribution_id uuid REFERENCES public.gsa_afiliado_atribuicoes(id) ON DELETE RESTRICT;
ALTER TABLE public.saude_cotacoes ADD COLUMN IF NOT EXISTS affiliate_attribution_id uuid REFERENCES public.gsa_afiliado_atribuicoes(id) ON DELETE RESTRICT;
ALTER TABLE public.saude_propostas ADD COLUMN IF NOT EXISTS affiliate_attribution_id uuid REFERENCES public.gsa_afiliado_atribuicoes(id) ON DELETE RESTRICT;
ALTER TABLE public.saude_contratos ADD COLUMN IF NOT EXISTS affiliate_attribution_id uuid REFERENCES public.gsa_afiliado_atribuicoes(id) ON DELETE RESTRICT;
ALTER TABLE public.seguros_cotacoes ADD COLUMN IF NOT EXISTS affiliate_attribution_id uuid REFERENCES public.gsa_afiliado_atribuicoes(id) ON DELETE RESTRICT;
ALTER TABLE public.seguros_propostas ADD COLUMN IF NOT EXISTS affiliate_attribution_id uuid REFERENCES public.gsa_afiliado_atribuicoes(id) ON DELETE RESTRICT;
ALTER TABLE public.seguros_apolices ADD COLUMN IF NOT EXISTS affiliate_attribution_id uuid REFERENCES public.gsa_afiliado_atribuicoes(id) ON DELETE RESTRICT;

CREATE OR REPLACE FUNCTION public.gsa_affiliate_new_code(p_prefix text)
RETURNS text
LANGUAGE sql
VOLATILE
SET search_path = public, pg_temp
AS $$
  SELECT upper(left(coalesce(p_prefix, ''), 1) || substr(replace(gen_random_uuid()::text, '-', ''), 1, 24));
$$;

CREATE OR REPLACE FUNCTION public.gsa_affiliate_hash(p_value text)
RETURNS text
LANGUAGE sql
IMMUTABLE
STRICT
SET search_path = public, extensions, pg_temp
AS $$
  SELECT encode(extensions.digest(p_value, 'sha256'), 'hex');
$$;

CREATE OR REPLACE FUNCTION public.gsa_affiliate_touch_updated_at()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public, pg_temp
AS $$
BEGIN
  NEW.updated_at := now();
  RETURN NEW;
END;
$$;

DO $$
DECLARE v_table text;
BEGIN
  FOREACH v_table IN ARRAY ARRAY[
    'gsa_afiliado_programas','gsa_afiliados','gsa_afiliado_links',
    'gsa_afiliado_atribuicoes','gsa_afiliado_conversoes',
    'gsa_afiliado_comissoes','gsa_afiliado_saques'
  ] LOOP
    EXECUTE format('DROP TRIGGER IF EXISTS trg_affiliate_touch ON public.%I', v_table);
    EXECUTE format(
      'CREATE TRIGGER trg_affiliate_touch BEFORE UPDATE ON public.%I FOR EACH ROW EXECUTE FUNCTION public.gsa_affiliate_touch_updated_at()',
      v_table
    );
  END LOOP;
END;
$$;

CREATE OR REPLACE FUNCTION public.gsa_affiliate_destination_allowed(
  p_programa_id uuid,
  p_destino text
)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT
    length(coalesce(p_destino, '')) BETWEEN 1 AND 300
    AND p_destino ~ '^/'
    AND p_destino !~ '[?#\\[:space:]]'
    AND p_destino !~ '^//'
    AND EXISTS (
      SELECT 1
      FROM public.gsa_afiliado_programas p,
           unnest(p.prefixos_permitidos) prefixo
      WHERE p.id = p_programa_id
        AND p_destino LIKE prefixo || '%'
    );
$$;

CREATE OR REPLACE FUNCTION public.gsa_affiliate_current_attribution(
  p_cliente_id uuid,
  p_programa_codigo text
)
RETURNS uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT a.id
  FROM public.gsa_afiliado_atribuicoes a
  JOIN public.gsa_afiliado_programas p ON p.id = a.programa_id
  JOIN public.gsa_afiliados f ON f.id = a.afiliado_id
  JOIN public.gsa_afiliado_links l ON l.id = a.link_id
  WHERE a.cliente_id = p_cliente_id
    AND p.codigo = p_programa_codigo
    AND a.expires_at > now()
    AND p.ativo
    AND f.status = 'ativo'
    AND l.ativo
    AND f.cliente_id IS DISTINCT FROM p_cliente_id
  ORDER BY a.atribuida_em DESC
  LIMIT 1;
$$;

CREATE OR REPLACE FUNCTION public.gsa_public_affiliate_programs()
RETURNS jsonb
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT jsonb_build_object(
    'success', true,
    'programs', coalesce(jsonb_agg(jsonb_build_object(
      'id', p.id,
      'codigo', p.codigo,
      'nome', p.nome,
      'descricao', p.descricao,
      'caminho_padrao', p.caminho_padrao,
      'percentual', p.percentual,
      'janela_atribuicao_dias', p.janela_atribuicao_dias,
      'carencia_dias', p.carencia_dias,
      'saque_minimo', p.saque_minimo
    ) ORDER BY p.nome), '[]'::jsonb)
  )
  FROM public.gsa_afiliado_programas p
  WHERE p.ativo;
$$;

CREATE OR REPLACE FUNCTION public.gsa_public_track_affiliate_click(
  p_codigo text,
  p_visitante_token text,
  p_landing_path text,
  p_referrer_host text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions, pg_temp
AS $$
DECLARE
  v_link record;
  v_landing text := trim(coalesce(p_landing_path, ''));
  v_visitor text := trim(coalesce(p_visitante_token, ''));
  v_raw_token text;
  v_expires timestamptz;
BEGIN
  IF trim(coalesce(p_codigo, '')) !~ '^L[0-9A-Fa-f]{20,32}$'
     OR length(v_visitor) NOT BETWEEN 16 AND 200 THEN
    RETURN jsonb_build_object('success', false, 'error', 'Link de afiliado invalido.');
  END IF;

  PERFORM public.gsa_assert_public_rate_limit(
    'afiliado_clique_ip', lower(trim(p_codigo)), 120, interval '1 hour'
  );
  PERFORM public.gsa_assert_public_rate_limit(
    'afiliado_clique_visitante', v_visitor, 30, interval '1 hour'
  );

  SELECT
    l.id AS link_id, l.destino, l.programa_id,
    p.codigo AS programa_codigo, p.janela_atribuicao_dias
  INTO v_link
  FROM public.gsa_afiliado_links l
  JOIN public.gsa_afiliados a ON a.id = l.afiliado_id
  JOIN public.gsa_afiliado_programas p ON p.id = l.programa_id
  WHERE upper(l.codigo) = upper(trim(p_codigo))
    AND l.ativo
    AND a.status = 'ativo'
    AND p.ativo
  LIMIT 1;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Link de afiliado indisponivel.');
  END IF;

  IF NOT public.gsa_affiliate_destination_allowed(v_link.programa_id, v_link.destino) THEN
    RETURN jsonb_build_object('success', false, 'error', 'Destino do link indisponivel.');
  END IF;

  IF v_landing = '' OR NOT public.gsa_affiliate_destination_allowed(v_link.programa_id, v_landing) THEN
    v_landing := v_link.destino;
  END IF;

  v_raw_token := lower(replace(gen_random_uuid()::text, '-', '') || replace(gen_random_uuid()::text, '-', ''));
  v_expires := now() + make_interval(days => v_link.janela_atribuicao_dias);

  INSERT INTO public.gsa_afiliado_cliques(
    link_id, token_hash, visitante_hash, landing_path, referrer_host, expires_at
  ) VALUES (
    v_link.link_id,
    public.gsa_affiliate_hash(v_raw_token),
    public.gsa_affiliate_hash(v_visitor),
    v_landing,
    nullif(left(lower(trim(coalesce(p_referrer_host, ''))), 253), ''),
    v_expires
  );

  RETURN jsonb_build_object(
    'success', true,
    'click_token', v_raw_token,
    'programa_codigo', v_link.programa_codigo,
    'destino', v_link.destino,
    'expires_at', v_expires
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.gsa_client_bind_affiliate_click(
  p_sessao_id uuid,
  p_session_token text,
  p_click_token text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_actor record;
  v_click record;
  v_attribution_id uuid;
BEGIN
  SELECT * INTO v_actor
  FROM public.gsa_client_session_actor(p_sessao_id, p_session_token)
  LIMIT 1;

  IF trim(coalesce(p_click_token, '')) !~ '^[0-9a-f]{64}$' THEN
    RETURN jsonb_build_object('success', false, 'error', 'Token de clique invalido.');
  END IF;

  SELECT
    c.id AS clique_id, c.cliente_id AS clique_cliente_id, c.created_at,
    c.expires_at, l.id AS link_id, l.afiliado_id, l.programa_id,
    a.cliente_id AS afiliado_cliente_id, a.status AS afiliado_status,
    p.ativo AS programa_ativo, l.ativo AS link_ativo
  INTO v_click
  FROM public.gsa_afiliado_cliques c
  JOIN public.gsa_afiliado_links l ON l.id = c.link_id
  JOIN public.gsa_afiliados a ON a.id = l.afiliado_id
  JOIN public.gsa_afiliado_programas p ON p.id = l.programa_id
  WHERE c.token_hash = public.gsa_affiliate_hash(trim(p_click_token))
  FOR UPDATE OF c;

  IF NOT FOUND OR v_click.expires_at <= now()
     OR NOT v_click.link_ativo OR NOT v_click.programa_ativo
     OR v_click.afiliado_status <> 'ativo' THEN
    RETURN jsonb_build_object('success', false, 'error', 'Clique expirado ou indisponivel.');
  END IF;

  IF v_click.clique_cliente_id IS NOT NULL
     AND v_click.clique_cliente_id IS DISTINCT FROM v_actor.cliente_id THEN
    RETURN jsonb_build_object('success', false, 'error', 'Clique ja utilizado.');
  END IF;

  UPDATE public.gsa_afiliado_cliques
  SET cliente_id = v_actor.cliente_id,
      vinculado_em = coalesce(vinculado_em, now())
  WHERE id = v_click.clique_id;

  -- Autorreferencia e bloqueada e o clique e consumido para impedir replay.
  IF v_click.afiliado_cliente_id = v_actor.cliente_id THEN
    RETURN jsonb_build_object('success', false, 'reason', 'self_referral');
  END IF;

  INSERT INTO public.gsa_afiliado_atribuicoes(
    cliente_id, afiliado_id, programa_id, link_id, clique_id,
    atribuida_em, expires_at
  ) VALUES (
    v_actor.cliente_id, v_click.afiliado_id, v_click.programa_id,
    v_click.link_id, v_click.clique_id, v_click.created_at, v_click.expires_at
  )
  ON CONFLICT (cliente_id, programa_id) DO UPDATE
    SET afiliado_id = EXCLUDED.afiliado_id,
        link_id = EXCLUDED.link_id,
        clique_id = EXCLUDED.clique_id,
        atribuida_em = EXCLUDED.atribuida_em,
        expires_at = EXCLUDED.expires_at
  WHERE EXCLUDED.atribuida_em >= public.gsa_afiliado_atribuicoes.atribuida_em
  RETURNING id INTO v_attribution_id;

  IF v_attribution_id IS NULL THEN
    SELECT id INTO v_attribution_id
    FROM public.gsa_afiliado_atribuicoes
    WHERE cliente_id = v_actor.cliente_id AND programa_id = v_click.programa_id;
  END IF;

  RETURN jsonb_build_object('success', true, 'attribution_id', v_attribution_id);
END;
$$;

CREATE OR REPLACE FUNCTION public.gsa_affiliate_freeze_attribution()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_row jsonb := to_jsonb(NEW);
  v_cliente_id uuid;
  v_programa text := TG_ARGV[0];
  v_parent_id uuid;
  v_attribution_id uuid := NEW.affiliate_attribution_id;
BEGIN
  v_cliente_id := nullif(v_row ->> TG_ARGV[1], '')::uuid;
  IF v_cliente_id IS NULL OR v_attribution_id IS NOT NULL THEN
    RETURN NEW;
  END IF;

  -- Entidades filhas herdam primeiro a fotografia da entidade que lhes deu origem.
  IF TG_TABLE_NAME = 'viagens_propostas' THEN
    v_parent_id := nullif(v_row ->> 'reserva_id', '')::uuid;
    SELECT affiliate_attribution_id INTO v_attribution_id
    FROM public.viagens_solicitacoes_reserva WHERE id = v_parent_id;
  ELSIF TG_TABLE_NAME = 'viagens_transacoes' THEN
    v_parent_id := nullif(v_row ->> 'proposta_id', '')::uuid;
    SELECT affiliate_attribution_id INTO v_attribution_id
    FROM public.viagens_propostas WHERE id = v_parent_id;
  ELSIF TG_TABLE_NAME = 'classificados_transacoes' THEN
    v_parent_id := nullif(v_row ->> 'proposta_id', '')::uuid;
    SELECT affiliate_attribution_id INTO v_attribution_id
    FROM public.classificados_propostas WHERE id = v_parent_id;
  ELSIF TG_TABLE_NAME = 'saude_propostas' THEN
    v_parent_id := nullif(v_row ->> 'cotacao_id', '')::uuid;
    SELECT affiliate_attribution_id INTO v_attribution_id
    FROM public.saude_cotacoes WHERE id = v_parent_id;
  ELSIF TG_TABLE_NAME = 'saude_contratos' THEN
    v_parent_id := nullif(v_row ->> 'proposta_id', '')::uuid;
    SELECT affiliate_attribution_id INTO v_attribution_id
    FROM public.saude_propostas WHERE id = v_parent_id;
  ELSIF TG_TABLE_NAME = 'seguros_propostas' THEN
    v_parent_id := nullif(v_row ->> 'cotacao_id', '')::uuid;
    SELECT affiliate_attribution_id INTO v_attribution_id
    FROM public.seguros_cotacoes WHERE id = v_parent_id;
  ELSIF TG_TABLE_NAME = 'seguros_apolices' THEN
    v_parent_id := nullif(v_row ->> 'proposta_id', '')::uuid;
    SELECT affiliate_attribution_id INTO v_attribution_id
    FROM public.seguros_propostas WHERE id = v_parent_id;
  ELSIF TG_TABLE_NAME = 'faturas' THEN
    v_parent_id := nullif(v_row ->> 'orcamento_id', '')::uuid;
    IF v_parent_id IS NOT NULL THEN
      SELECT affiliate_attribution_id INTO v_attribution_id
      FROM public.orcamentos WHERE id = v_parent_id;
    END IF;
    IF v_attribution_id IS NULL AND coalesce(v_row ->> 'tipo', '') = 'compra_viagem'
       AND coalesce(v_row #>> '{metadata,transacao_id}', '') ~* '^[0-9a-f-]{36}$' THEN
      SELECT affiliate_attribution_id INTO v_attribution_id
      FROM public.viagens_transacoes
      WHERE id = (v_row #>> '{metadata,transacao_id}')::uuid;
    END IF;
  END IF;

  IF v_attribution_id IS NULL THEN
    v_attribution_id := public.gsa_affiliate_current_attribution(v_cliente_id, v_programa);
  END IF;

  NEW.affiliate_attribution_id := v_attribution_id;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_affiliate_freeze_store ON public.orcamentos;
CREATE TRIGGER trg_affiliate_freeze_store
BEFORE INSERT ON public.orcamentos FOR EACH ROW
EXECUTE FUNCTION public.gsa_affiliate_freeze_attribution('loja','cliente_id');

DROP TRIGGER IF EXISTS trg_affiliate_freeze_invoice ON public.faturas;
CREATE TRIGGER trg_affiliate_freeze_invoice
BEFORE INSERT ON public.faturas FOR EACH ROW
EXECUTE FUNCTION public.gsa_affiliate_freeze_attribution('servicos','cliente_id');

DROP TRIGGER IF EXISTS trg_affiliate_freeze_travel_quote ON public.viagens_orcamentos;
CREATE TRIGGER trg_affiliate_freeze_travel_quote
BEFORE INSERT ON public.viagens_orcamentos FOR EACH ROW
EXECUTE FUNCTION public.gsa_affiliate_freeze_attribution('viagens','cliente_id');

DROP TRIGGER IF EXISTS trg_affiliate_freeze_travel_reservation ON public.viagens_solicitacoes_reserva;
CREATE TRIGGER trg_affiliate_freeze_travel_reservation
BEFORE INSERT ON public.viagens_solicitacoes_reserva FOR EACH ROW
EXECUTE FUNCTION public.gsa_affiliate_freeze_attribution('viagens','cliente_id');

DROP TRIGGER IF EXISTS trg_affiliate_freeze_travel_proposal ON public.viagens_propostas;
CREATE TRIGGER trg_affiliate_freeze_travel_proposal
BEFORE INSERT ON public.viagens_propostas FOR EACH ROW
EXECUTE FUNCTION public.gsa_affiliate_freeze_attribution('viagens','cliente_id');

DROP TRIGGER IF EXISTS trg_affiliate_freeze_travel_transaction ON public.viagens_transacoes;
CREATE TRIGGER trg_affiliate_freeze_travel_transaction
BEFORE INSERT ON public.viagens_transacoes FOR EACH ROW
EXECUTE FUNCTION public.gsa_affiliate_freeze_attribution('viagens','cliente_id');

DROP TRIGGER IF EXISTS trg_affiliate_freeze_classified_proposal ON public.classificados_propostas;
CREATE TRIGGER trg_affiliate_freeze_classified_proposal
BEFORE INSERT ON public.classificados_propostas FOR EACH ROW
EXECUTE FUNCTION public.gsa_affiliate_freeze_attribution('classificados','comprador_id');

DROP TRIGGER IF EXISTS trg_affiliate_freeze_classified_transaction ON public.classificados_transacoes;
CREATE TRIGGER trg_affiliate_freeze_classified_transaction
BEFORE INSERT ON public.classificados_transacoes FOR EACH ROW
EXECUTE FUNCTION public.gsa_affiliate_freeze_attribution('classificados','comprador_id');

DROP TRIGGER IF EXISTS trg_affiliate_freeze_health_quote ON public.saude_cotacoes;
CREATE TRIGGER trg_affiliate_freeze_health_quote
BEFORE INSERT ON public.saude_cotacoes FOR EACH ROW
EXECUTE FUNCTION public.gsa_affiliate_freeze_attribution('saude','cliente_id');

DROP TRIGGER IF EXISTS trg_affiliate_freeze_health_proposal ON public.saude_propostas;
CREATE TRIGGER trg_affiliate_freeze_health_proposal
BEFORE INSERT ON public.saude_propostas FOR EACH ROW
EXECUTE FUNCTION public.gsa_affiliate_freeze_attribution('saude','cliente_id');

DROP TRIGGER IF EXISTS trg_affiliate_freeze_health_contract ON public.saude_contratos;
CREATE TRIGGER trg_affiliate_freeze_health_contract
BEFORE INSERT ON public.saude_contratos FOR EACH ROW
EXECUTE FUNCTION public.gsa_affiliate_freeze_attribution('saude','cliente_id');

DROP TRIGGER IF EXISTS trg_affiliate_freeze_insurance_quote ON public.seguros_cotacoes;
CREATE TRIGGER trg_affiliate_freeze_insurance_quote
BEFORE INSERT ON public.seguros_cotacoes FOR EACH ROW
EXECUTE FUNCTION public.gsa_affiliate_freeze_attribution('seguros','cliente_id');

DROP TRIGGER IF EXISTS trg_affiliate_freeze_insurance_proposal ON public.seguros_propostas;
CREATE TRIGGER trg_affiliate_freeze_insurance_proposal
BEFORE INSERT ON public.seguros_propostas FOR EACH ROW
EXECUTE FUNCTION public.gsa_affiliate_freeze_attribution('seguros','cliente_id');

DROP TRIGGER IF EXISTS trg_affiliate_freeze_insurance_policy ON public.seguros_apolices;
CREATE TRIGGER trg_affiliate_freeze_insurance_policy
BEFORE INSERT ON public.seguros_apolices FOR EACH ROW
EXECUTE FUNCTION public.gsa_affiliate_freeze_attribution('seguros','cliente_id');

CREATE OR REPLACE FUNCTION public.gsa_affiliate_record_conversion(
  p_atribuicao_id uuid,
  p_programa_codigo text,
  p_origem_tipo text,
  p_origem_id uuid,
  p_evento text,
  p_valor_bruto numeric,
  p_base_elegivel numeric,
  p_metadata jsonb DEFAULT '{}'::jsonb
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_attr record;
  v_conversion_id uuid;
  v_commission_id uuid;
  v_commission numeric(14,2);
  v_available_at timestamptz;
BEGIN
  IF p_atribuicao_id IS NULL OR p_origem_id IS NULL
     OR coalesce(p_base_elegivel, 0) <= 0 THEN
    RETURN NULL;
  END IF;

  SELECT
    a.id, a.cliente_id, a.afiliado_id, a.programa_id,
    f.cliente_id AS afiliado_cliente_id, f.status AS afiliado_status,
    p.codigo, p.percentual, p.base_tipo, p.carencia_dias
  INTO v_attr
  FROM public.gsa_afiliado_atribuicoes a
  JOIN public.gsa_afiliados f ON f.id = a.afiliado_id
  JOIN public.gsa_afiliado_programas p ON p.id = a.programa_id
  WHERE a.id = p_atribuicao_id
  FOR UPDATE OF f;

  IF NOT FOUND OR v_attr.codigo <> p_programa_codigo
     OR v_attr.afiliado_status <> 'ativo'
     OR v_attr.afiliado_cliente_id = v_attr.cliente_id THEN
    RETURN NULL;
  END IF;

  v_commission := round(greatest(p_base_elegivel, 0) * v_attr.percentual / 100, 2);
  IF v_commission <= 0 THEN RETURN NULL; END IF;
  v_available_at := now() + make_interval(days => v_attr.carencia_dias);

  INSERT INTO public.gsa_afiliado_conversoes(
    atribuicao_id, afiliado_id, programa_id, comprador_id,
    origem_tipo, origem_id, evento, valor_bruto, base_elegivel,
    base_tipo_snapshot, metadata
  ) VALUES (
    v_attr.id, v_attr.afiliado_id, v_attr.programa_id, v_attr.cliente_id,
    left(p_origem_tipo, 80), p_origem_id, left(coalesce(p_evento, 'venda'), 60),
    round(greatest(coalesce(p_valor_bruto, p_base_elegivel), 0), 2),
    round(greatest(p_base_elegivel, 0), 2), v_attr.base_tipo,
    coalesce(p_metadata, '{}'::jsonb)
  )
  ON CONFLICT (programa_id, origem_tipo, origem_id, evento) DO NOTHING
  RETURNING id INTO v_conversion_id;

  IF v_conversion_id IS NULL THEN
    SELECT id INTO v_conversion_id
    FROM public.gsa_afiliado_conversoes
    WHERE programa_id = v_attr.programa_id
      AND origem_tipo = left(p_origem_tipo, 80)
      AND origem_id = p_origem_id
      AND evento = left(coalesce(p_evento, 'venda'), 60);
    RETURN v_conversion_id;
  END IF;

  INSERT INTO public.gsa_afiliado_comissoes(
    conversao_id, afiliado_id, programa_id, percentual_snapshot,
    base_elegivel_snapshot, valor, status, disponivel_em
  ) VALUES (
    v_conversion_id, v_attr.afiliado_id, v_attr.programa_id,
    v_attr.percentual, round(p_base_elegivel, 2), v_commission,
    CASE WHEN v_available_at <= now() THEN 'disponivel' ELSE 'pendente' END,
    v_available_at
  ) RETURNING id INTO v_commission_id;

  INSERT INTO public.gsa_afiliado_comissao_eventos(
    afiliado_id, comissao_id, tipo, valor_assinado, efetivo_em,
    metadata
  ) VALUES (
    v_attr.afiliado_id, v_commission_id, 'comissao', v_commission,
    v_available_at, jsonb_build_object('conversao_id', v_conversion_id)
  );

  RETURN v_conversion_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.gsa_affiliate_reverse_source(
  p_programa_codigo text,
  p_origem_tipo text,
  p_origem_id uuid,
  p_motivo text DEFAULT 'cancelamento'
)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_item record;
  v_count integer := 0;
BEGIN
  FOR v_item IN
    SELECT c.id AS conversion_id, c.afiliado_id, m.id AS commission_id, m.valor
    FROM public.gsa_afiliado_conversoes c
    JOIN public.gsa_afiliado_programas p ON p.id = c.programa_id
    JOIN public.gsa_afiliado_comissoes m ON m.conversao_id = c.id
    WHERE p.codigo = p_programa_codigo
      AND c.origem_tipo = p_origem_tipo
      AND c.origem_id = p_origem_id
      AND c.status = 'confirmada'
    FOR UPDATE OF c, m
  LOOP
    UPDATE public.gsa_afiliado_conversoes
    SET status = 'revertida', revertida_em = now()
    WHERE id = v_item.conversion_id;

    UPDATE public.gsa_afiliado_comissoes
    SET status = 'revertida', revertida_em = now()
    WHERE id = v_item.commission_id;

    INSERT INTO public.gsa_afiliado_comissao_eventos(
      afiliado_id, comissao_id, tipo, valor_assinado, efetivo_em, metadata
    ) VALUES (
      v_item.afiliado_id, v_item.commission_id, 'estorno', -v_item.valor,
      now(), jsonb_build_object('motivo', left(coalesce(p_motivo, 'cancelamento'), 500))
    ) ON CONFLICT DO NOTHING;
    v_count := v_count + 1;
  END LOOP;
  RETURN v_count;
END;
$$;

CREATE OR REPLACE FUNCTION public.gsa_affiliate_release_due_commissions()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE v_count integer;
BEGIN
  UPDATE public.gsa_afiliado_comissoes
  SET status = 'disponivel'
  WHERE status = 'pendente' AND disponivel_em <= now();
  GET DIAGNOSTICS v_count = ROW_COUNT;
  RETURN v_count;
END;
$$;

