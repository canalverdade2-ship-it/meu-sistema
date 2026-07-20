-- Store checkout authority belongs to PostgreSQL. The browser sends only intent;
-- catalog prices, discounts, stock, balances, interest and ledgers are calculated
-- and committed atomically here.

ALTER TABLE public.orcamentos
  ADD COLUMN IF NOT EXISTS checkout_request_id uuid,
  ADD COLUMN IF NOT EXISTS subtotal_itens numeric NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS desconto_promocional numeric NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS desconto_cupom numeric NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS desconto_pontos numeric NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS abatimento_carteira numeric NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS forma_pagamento_loja text,
  ADD COLUMN IF NOT EXISTS parcelas_credito integer,
  ADD COLUMN IF NOT EXISTS total_contrato numeric NOT NULL DEFAULT 0;

CREATE UNIQUE INDEX IF NOT EXISTS uq_orcamentos_checkout_request
  ON public.orcamentos(checkout_request_id)
  WHERE checkout_request_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_orcamentos_cliente_store_created
  ON public.orcamentos(cliente_id, data_criacao DESC)
  WHERE origem_gsa_store IS TRUE;

ALTER TABLE public.faturas
  ADD COLUMN IF NOT EXISTS orcamento_id uuid REFERENCES public.orcamentos(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS desconto_promocional_aplicado numeric NOT NULL DEFAULT 0;

CREATE INDEX IF NOT EXISTS idx_faturas_orcamento_id
  ON public.faturas(orcamento_id)
  WHERE orcamento_id IS NOT NULL;

ALTER TABLE public.ordens_servico
  ADD COLUMN IF NOT EXISTS servico_id uuid REFERENCES public.servicos(id) ON DELETE SET NULL;

ALTER TABLE public.ordens_servico
  DROP CONSTRAINT IF EXISTS ordens_servico_status_check;

ALTER TABLE public.ordens_servico
  ADD CONSTRAINT ordens_servico_status_check
  CHECK (status = ANY (ARRAY[
    'em_analise'::text, 'aprovado'::text, 'pago'::text,
    'andamento'::text, 'concluido'::text, 'cancelado'::text
  ]));

CREATE TABLE IF NOT EXISTS public.loja_pedido_itens (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  orcamento_id uuid NOT NULL REFERENCES public.orcamentos(id) ON DELETE CASCADE,
  cliente_id uuid NOT NULL REFERENCES public.clientes(id) ON DELETE CASCADE,
  tipo text NOT NULL CHECK (tipo IN ('produto', 'servico', 'assinatura')),
  item_id uuid NOT NULL,
  produto_id uuid REFERENCES public.produtos(id) ON DELETE RESTRICT,
  servico_id uuid REFERENCES public.servicos(id) ON DELETE RESTRICT,
  assinatura_id uuid REFERENCES public.assinaturas(id) ON DELETE RESTRICT,
  codigo text NOT NULL,
  nome text NOT NULL,
  valor_unitario numeric NOT NULL CHECK (valor_unitario >= 0),
  quantidade integer NOT NULL CHECK (quantidade > 0),
  prazo_meses integer,
  subtotal numeric NOT NULL CHECK (subtotal >= 0),
  is_brinde boolean NOT NULL DEFAULT false,
  promocao_id uuid REFERENCES public.promocoes_quantidade(id) ON DELETE SET NULL,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT loja_pedido_item_reference_check CHECK (
    (tipo = 'produto' AND produto_id = item_id AND servico_id IS NULL AND assinatura_id IS NULL)
    OR (tipo = 'servico' AND servico_id = item_id AND produto_id IS NULL AND assinatura_id IS NULL)
    OR (tipo = 'assinatura' AND assinatura_id = item_id AND produto_id IS NULL AND servico_id IS NULL)
  )
);

CREATE INDEX IF NOT EXISTS idx_loja_pedido_itens_orcamento
  ON public.loja_pedido_itens(orcamento_id, created_at, id);

CREATE INDEX IF NOT EXISTS idx_loja_pedido_itens_cliente
  ON public.loja_pedido_itens(cliente_id, created_at DESC);

ALTER TABLE public.loja_pedido_itens ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS loja_pedido_itens_cliente_select ON public.loja_pedido_itens;
CREATE POLICY loja_pedido_itens_cliente_select
  ON public.loja_pedido_itens
  FOR SELECT
  TO authenticated
  USING (
    public.gsa_jwt_session_is_valid()
    AND public.gsa_jwt_actor_type() = 'cliente'
    AND cliente_id = public.gsa_jwt_actor_id()
  );

DROP POLICY IF EXISTS loja_pedido_itens_staff_select ON public.loja_pedido_itens;
CREATE POLICY loja_pedido_itens_staff_select
  ON public.loja_pedido_itens
  FOR SELECT
  TO authenticated
  USING (public.gsa_jwt_is_admin());

REVOKE ALL ON TABLE public.loja_pedido_itens FROM public, anon;
GRANT SELECT ON TABLE public.loja_pedido_itens TO authenticated;

CREATE OR REPLACE FUNCTION public.gsa_client_checkout_store(
  p_sessao_id uuid,
  p_session_token text,
  p_payload jsonb
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_actor record;
  v_cliente public.clientes%rowtype;
  v_request_id uuid;
  v_existing public.orcamentos%rowtype;
  v_cart jsonb;
  v_item jsonb;
  v_items jsonb := '[]'::jsonb;
  v_invoice_items jsonb;
  v_product public.produtos%rowtype;
  v_service public.servicos%rowtype;
  v_subscription public.assinaturas%rowtype;
  v_promo public.promocoes_quantidade%rowtype;
  v_coupon public.cupons_loja%rowtype;
  v_cheapest jsonb;
  v_promo_details jsonb := '[]'::jsonb;
  v_promo_discount_by_product jsonb := '{}'::jsonb;
  v_subtotal numeric := 0;
  v_subtotal_products numeric := 0;
  v_subtotal_services numeric := 0;
  v_subtotal_subscriptions numeric := 0;
  v_contract_total numeric := 0;
  v_promo_discount numeric := 0;
  v_points_discount numeric := 0;
  v_coupon_discount numeric := 0;
  v_wallet_discount numeric := 0;
  v_shipping numeric := 0;
  v_interest numeric := 0;
  v_interest_rate numeric := 0;
  v_total_before_wallet numeric := 0;
  v_total numeric := 0;
  v_points integer := 0;
  v_wallet_requested numeric := 0;
  v_discount_coupon_id uuid;
  v_shipping_coupon_id uuid;
  v_payment_method text;
  v_installments integer := 1;
  v_address jsonb;
  v_has_products boolean := false;
  v_orcamento_id uuid;
  v_code text;
  v_status text;
  v_order_status text;
  v_total_quantity integer := 0;
  v_qtd_eligible integer;
  v_value_eligible numeric;
  v_min_qty integer;
  v_times integer;
  v_usage_count integer;
  v_remaining_usage integer;
  v_discount_each numeric;
  v_discount_value numeric;
  v_gift_qty integer;
  v_previous_discount numeric;
  v_level_id uuid;
  v_active_credit_request uuid;
  v_limit_before numeric;
  v_limit_after numeric;
  v_order_id uuid;
  v_first_purchase_order uuid;
  v_first_subscription_order uuid;
  v_first_service_order uuid;
  v_invoice_id uuid;
  v_invoice_value numeric;
  v_total_cents bigint;
  v_installment_cents bigint;
  v_remainder_cents integer;
  v_i integer;
  v_description text;
BEGIN
  IF p_payload IS NULL OR jsonb_typeof(p_payload) <> 'object' THEN
    RAISE EXCEPTION 'Dados do checkout inválidos.';
  END IF;

  SELECT * INTO v_actor
  FROM public.gsa_client_session_actor(p_sessao_id, p_session_token)
  LIMIT 1;

  SELECT * INTO v_cliente
  FROM public.clientes
  WHERE id = v_actor.cliente_id
  FOR UPDATE;

  IF coalesce(v_cliente.status, 'ativo') <> 'ativo' THEN
    RAISE EXCEPTION 'O cadastro do cliente não está ativo.';
  END IF;

  IF coalesce(p_payload ->> 'request_id', '') !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$' THEN
    RAISE EXCEPTION 'Identificador idempotente do checkout inválido.';
  END IF;
  v_request_id := (p_payload ->> 'request_id')::uuid;

  SELECT * INTO v_existing
  FROM public.orcamentos
  WHERE checkout_request_id = v_request_id;

  IF FOUND THEN
    IF v_existing.cliente_id <> v_actor.cliente_id THEN
      RAISE EXCEPTION 'Identificador de checkout já utilizado.';
    END IF;
    RETURN jsonb_build_object(
      'success', true,
      'already_exists', true,
      'orcamento_id', v_existing.id,
      'codigo_orcamento', v_existing.codigo_orcamento,
      'total', v_existing.total,
      'status', v_existing.status
    );
  END IF;

  v_cart := p_payload -> 'carrinho';
  IF jsonb_typeof(v_cart) <> 'array'
     OR jsonb_array_length(v_cart) < 1
     OR jsonb_array_length(v_cart) > 100 THEN
    RAISE EXCEPTION 'O carrinho deve conter entre 1 e 100 itens.';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM jsonb_array_elements(v_cart) AS e(item)
    WHERE jsonb_typeof(item) <> 'object'
       OR coalesce(item ->> 'tipo', '') NOT IN ('produto', 'servico', 'assinatura')
       OR coalesce(item ->> 'item_id', '') !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
       OR coalesce(item ->> 'quantidade', '') !~ '^[0-9]+$'
       OR (item ->> 'quantidade')::integer NOT BETWEEN 1 AND 100
       OR EXISTS (
         SELECT 1 FROM jsonb_object_keys(item) AS key_name
         WHERE key_name NOT IN ('tipo', 'item_id', 'quantidade', 'prazo_meses')
       )
  ) THEN
    RAISE EXCEPTION 'O carrinho contém item inválido ou campo não permitido.';
  END IF;

  IF (
    SELECT sum((item ->> 'quantidade')::integer)
    FROM jsonb_array_elements(v_cart) AS e(item)
  ) > 200 THEN
    RAISE EXCEPTION 'A quantidade total do carrinho excede o limite permitido.';
  END IF;

  FOR v_item IN
    SELECT jsonb_build_object(
      'tipo', item ->> 'tipo',
      'item_id', item ->> 'item_id',
      'quantidade', sum((item ->> 'quantidade')::integer),
      'prazo_meses', max(
        CASE
          WHEN coalesce(item ->> 'prazo_meses', '') ~ '^[0-9]+$'
          THEN (item ->> 'prazo_meses')::integer
          ELSE 1
        END
      )
    )
    FROM jsonb_array_elements(v_cart) AS e(item)
    GROUP BY item ->> 'tipo', item ->> 'item_id'
    ORDER BY item ->> 'tipo', item ->> 'item_id'
  LOOP
    IF v_item ->> 'tipo' = 'produto' THEN
      SELECT * INTO v_product
      FROM public.produtos
      WHERE id = (v_item ->> 'item_id')::uuid
      FOR UPDATE;

      IF NOT FOUND
         OR v_product.status <> 'ativo'
         OR coalesce(v_product.visivel_na_loja, false) IS NOT TRUE
         OR coalesce(v_product.ocultar_valor, false) IS TRUE
         OR v_product.valor IS NULL
         OR v_product.valor < 0
         OR lower(coalesce(v_product.tipo_cliente, 'pf')) NOT IN ('ambos', lower(coalesce(v_cliente.tipo_pessoa, 'pf'))) THEN
        RAISE EXCEPTION 'Produto indisponível para este cliente.';
      END IF;

      IF coalesce(v_product.controle_estoque, false)
         AND coalesce(v_product.estoque_disponivel, 0) < (v_item ->> 'quantidade')::integer THEN
        RAISE EXCEPTION 'Estoque insuficiente para %.', v_product.nome;
      END IF;

      v_subtotal_products := v_subtotal_products + round(v_product.valor * (v_item ->> 'quantidade')::integer, 2);
      v_has_products := true;
      v_items := v_items || jsonb_build_array(jsonb_build_object(
        'tipo', 'produto', 'item_id', v_product.id,
        'produto_id', v_product.id, 'servico_id', null, 'assinatura_id', null,
        'codigo', v_product.codigo_produto, 'nome', v_product.nome,
        'valor_unitario', round(v_product.valor, 2),
        'quantidade', (v_item ->> 'quantidade')::integer,
        'prazo_meses', null,
        'subtotal', round(v_product.valor * (v_item ->> 'quantidade')::integer, 2),
        'categoria_id', v_product.categoria_id,
        'is_brinde', false, 'promocao_id', null
      ));
    ELSIF v_item ->> 'tipo' = 'servico' THEN
      SELECT * INTO v_service
      FROM public.servicos
      WHERE id = (v_item ->> 'item_id')::uuid
      FOR UPDATE;

      IF NOT FOUND
         OR v_service.status <> 'ativo'
         OR coalesce(v_service.visivel_na_loja, false) IS NOT TRUE
         OR coalesce(v_service.ocultar_valor, false) IS TRUE
         OR v_service.valor IS NULL
         OR v_service.valor < 0
         OR lower(coalesce(v_service.tipo_cliente, 'pf')) NOT IN ('ambos', lower(coalesce(v_cliente.tipo_pessoa, 'pf'))) THEN
        RAISE EXCEPTION 'Serviço indisponível para este cliente.';
      END IF;

      v_subtotal_services := v_subtotal_services + round(v_service.valor * (v_item ->> 'quantidade')::integer, 2);
      v_items := v_items || jsonb_build_array(jsonb_build_object(
        'tipo', 'servico', 'item_id', v_service.id,
        'produto_id', null, 'servico_id', v_service.id, 'assinatura_id', null,
        'codigo', v_service.codigo_servico, 'nome', v_service.nome,
        'valor_unitario', round(v_service.valor, 2),
        'quantidade', (v_item ->> 'quantidade')::integer,
        'prazo_meses', null,
        'subtotal', round(v_service.valor * (v_item ->> 'quantidade')::integer, 2),
        'categoria_id', v_service.categoria_id,
        'is_brinde', false, 'promocao_id', null
      ));
    ELSE
      SELECT * INTO v_subscription
      FROM public.assinaturas
      WHERE id = (v_item ->> 'item_id')::uuid
      FOR UPDATE;

      IF NOT FOUND
         OR v_subscription.status <> 'ativo'
         OR coalesce(v_subscription.visivel_na_loja, false) IS NOT TRUE
         OR coalesce(v_subscription.ocultar_valor, false) IS TRUE
         OR v_subscription.valor IS NULL
         OR v_subscription.valor < 0
         OR lower(coalesce(v_subscription.tipo_cliente, 'pf')) NOT IN ('ambos', lower(coalesce(v_cliente.tipo_pessoa, 'pf'))) THEN
        RAISE EXCEPTION 'Assinatura indisponível para este cliente.';
      END IF;

      IF (v_item ->> 'prazo_meses')::integer NOT BETWEEN 1 AND 120 THEN
        RAISE EXCEPTION 'Prazo da assinatura inválido.';
      END IF;

      v_subtotal_subscriptions := v_subtotal_subscriptions + round(v_subscription.valor * (v_item ->> 'quantidade')::integer, 2);
      v_contract_total := v_contract_total + round(
        v_subscription.valor * (v_item ->> 'quantidade')::integer * (v_item ->> 'prazo_meses')::integer, 2
      );
      v_items := v_items || jsonb_build_array(jsonb_build_object(
        'tipo', 'assinatura', 'item_id', v_subscription.id,
        'produto_id', null, 'servico_id', null, 'assinatura_id', v_subscription.id,
        'codigo', coalesce(v_subscription.codigo_assinatura, 'ASSINATURA'), 'nome', v_subscription.nome,
        'valor_unitario', round(v_subscription.valor, 2),
        'quantidade', (v_item ->> 'quantidade')::integer,
        'prazo_meses', (v_item ->> 'prazo_meses')::integer,
        'subtotal', round(v_subscription.valor * (v_item ->> 'quantidade')::integer, 2),
        'categoria_id', v_subscription.categoria_id,
        'is_brinde', false, 'promocao_id', null
      ));
    END IF;
  END LOOP;

  v_subtotal := round(v_subtotal_products + v_subtotal_services + v_subtotal_subscriptions, 2);
  IF v_subtotal <= 0 THEN
    RAISE EXCEPTION 'O carrinho não possui valor faturável.';
  END IF;

  v_level_id := coalesce(v_cliente.nivel_manual_id, v_cliente.nivel_id);

  FOR v_promo IN
    SELECT pq.*
    FROM public.promocoes_quantidade pq
    JOIN public.promocoes_quantidade_ativadas pa
      ON pa.promocao_quantidade_id = pq.id
     AND pa.cliente_id = v_actor.cliente_id
    WHERE pq.status = 'ativa'
      AND pq.data_inicio <= now()
      AND (pq.data_fim IS NULL OR pq.data_fim >= now())
    ORDER BY coalesce(pq.prioridade, 10), pq.id
    FOR UPDATE OF pq
  LOOP
    IF v_promo.tipo_promocao = 'combo'
       OR v_promo.escopo_gatilho = 'combo' THEN
      CONTINUE;
    END IF;

    IF v_promo.nivel_minimo_id IS NOT NULL
       AND v_promo.nivel_minimo_id IS DISTINCT FROM v_level_id THEN
      CONTINUE;
    END IF;

    SELECT count(*)::integer INTO v_usage_count
    FROM public.promocoes_quantidade_uso
    WHERE promocao_id = v_promo.id
      AND cliente_id = v_actor.cliente_id;

    v_remaining_usage := coalesce(v_promo.uso_maximo_por_cliente, 2147483647) - v_usage_count;
    IF v_remaining_usage <= 0 THEN CONTINUE; END IF;

    v_min_qty := greatest(coalesce(v_promo.quantidade_minima, 1), 1);
    IF v_level_id IS NOT NULL AND jsonb_typeof(v_promo.niveis_vip) = 'array' THEN
      SELECT greatest(coalesce((rule ->> 'quantidade_minima')::integer, v_min_qty), 1)
      INTO v_min_qty
      FROM jsonb_array_elements(v_promo.niveis_vip) AS r(rule)
      WHERE rule ->> 'nivel_id' = v_level_id::text
      LIMIT 1;
      v_min_qty := greatest(coalesce(v_min_qty, v_promo.quantidade_minima, 1), 1);
    END IF;

    SELECT coalesce(sum((entry ->> 'quantidade')::integer), 0),
           coalesce(sum((entry ->> 'subtotal')::numeric), 0)
    INTO v_qtd_eligible, v_value_eligible
    FROM jsonb_array_elements(v_items) AS x(entry)
    WHERE entry ->> 'tipo' = 'produto'
      AND coalesce((entry ->> 'is_brinde')::boolean, false) IS FALSE
      AND (
        v_promo.escopo_gatilho = 'geral'
        OR v_promo.escopo_gatilho = 'valor_minimo'
        OR (v_promo.escopo_gatilho = 'produto' AND entry ->> 'item_id' = v_promo.produto_gatilho_id::text)
        OR (v_promo.escopo_gatilho = 'categoria' AND entry ->> 'categoria_id' = v_promo.categoria_gatilho_id::text)
      );

    IF v_promo.escopo_gatilho = 'valor_minimo' THEN
      IF v_value_eligible < greatest(coalesce(v_promo.valor_minimo_compra, 0), 0.01) THEN CONTINUE; END IF;
      v_times := 1;
    ELSE
      IF v_qtd_eligible < v_min_qty THEN CONTINUE; END IF;
      IF v_promo.tipo_promocao = 'desconto_proxima' THEN
        v_times := greatest(v_qtd_eligible - (v_min_qty - 1), 1);
      ELSE
        v_times := greatest(floor(v_qtd_eligible::numeric / v_min_qty)::integer, 1);
      END IF;
    END IF;

    IF v_promo.tipo_promocao = 'ganhe_outro_produto' THEN
      IF v_promo.produto_brinde_id IS NULL THEN CONTINUE; END IF;
      SELECT * INTO v_product FROM public.produtos WHERE id = v_promo.produto_brinde_id FOR UPDATE;
      IF NOT FOUND OR v_product.status <> 'ativo' OR coalesce(v_product.visivel_na_loja, false) IS NOT TRUE THEN
        CONTINUE;
      END IF;
      v_gift_qty := greatest(coalesce(v_promo.quantidade_brinde, 1), 1) * v_times;
      IF coalesce(v_product.controle_estoque, false)
         AND coalesce(v_product.estoque_disponivel, 0) < v_gift_qty THEN
        CONTINUE;
      END IF;
      v_items := v_items || jsonb_build_array(jsonb_build_object(
        'tipo', 'produto', 'item_id', v_product.id,
        'produto_id', v_product.id, 'servico_id', null, 'assinatura_id', null,
        'codigo', v_product.codigo_produto, 'nome', v_product.nome,
        'valor_unitario', round(v_product.valor, 2), 'quantidade', v_gift_qty,
        'prazo_meses', null, 'subtotal', 0,
        'categoria_id', v_product.categoria_id,
        'is_brinde', true, 'promocao_id', v_promo.id
      ));
      v_discount_value := round(v_product.valor * v_gift_qty, 2);
    ELSE
      SELECT entry INTO v_cheapest
      FROM jsonb_array_elements(v_items) AS x(entry)
      WHERE entry ->> 'tipo' = 'produto'
        AND coalesce((entry ->> 'is_brinde')::boolean, false) IS FALSE
        AND (
          v_promo.escopo_gatilho = 'geral'
          OR v_promo.escopo_gatilho = 'valor_minimo'
          OR (v_promo.escopo_gatilho = 'produto' AND entry ->> 'item_id' = v_promo.produto_gatilho_id::text)
          OR (v_promo.escopo_gatilho = 'categoria' AND entry ->> 'categoria_id' = v_promo.categoria_gatilho_id::text)
        )
      ORDER BY (entry ->> 'valor_unitario')::numeric, entry ->> 'item_id'
      LIMIT 1;

      IF v_cheapest IS NULL THEN CONTINUE; END IF;

      IF v_promo.tipo_promocao = 'unidade_gratis' THEN
        v_gift_qty := least(v_times, (v_cheapest ->> 'quantidade')::integer);
        v_product := NULL;
        SELECT * INTO v_product FROM public.produtos WHERE id = (v_cheapest ->> 'item_id')::uuid FOR UPDATE;
        IF coalesce(v_product.controle_estoque, false)
           AND coalesce(v_product.estoque_disponivel, 0) < ((v_cheapest ->> 'quantidade')::integer + v_gift_qty) THEN
          CONTINUE;
        END IF;
        v_items := v_items || jsonb_build_array(
          (v_cheapest - 'subtotal' - 'quantidade' - 'is_brinde' - 'promocao_id')
          || jsonb_build_object(
            'quantidade', v_gift_qty, 'subtotal', 0,
            'is_brinde', true, 'promocao_id', v_promo.id
          )
        );
        v_discount_value := round((v_cheapest ->> 'valor_unitario')::numeric * v_gift_qty, 2);
      ELSIF v_promo.tipo_promocao = 'desconto_proxima' THEN
        IF v_promo.desconto_tipo = 'porcentagem' THEN
          v_discount_each := round(
            (v_cheapest ->> 'valor_unitario')::numeric
            * least(greatest(coalesce(v_promo.desconto_valor, 0), 0), 100) / 100,
            2
          );
        ELSE
          v_discount_each := least(
            round(greatest(coalesce(v_promo.desconto_valor, 0), 0), 2),
            (v_cheapest ->> 'valor_unitario')::numeric
          );
        END IF;
        v_discount_value := least(
          round(v_discount_each * v_times, 2),
          (v_cheapest ->> 'subtotal')::numeric
        );
        v_previous_discount := coalesce(
          (v_promo_discount_by_product ->> (v_cheapest ->> 'item_id'))::numeric,
          0
        );
        v_promo_discount_by_product := jsonb_set(
          v_promo_discount_by_product,
          ARRAY[v_cheapest ->> 'item_id'],
          to_jsonb(round(v_previous_discount + v_discount_value, 2)),
          true
        );
      ELSE
        CONTINUE;
      END IF;
    END IF;

    v_promo_discount := v_promo_discount + v_discount_value;
    v_promo_details := v_promo_details || jsonb_build_array(jsonb_build_object(
      'promocao_id', v_promo.id,
      'nome', v_promo.nome,
      'tipo_promocao', v_promo.tipo_promocao,
      'vezes_aplicada', v_times,
      'economia_gerada', v_discount_value,
      'produto_id', CASE WHEN v_cheapest IS NULL THEN v_promo.produto_brinde_id ELSE (v_cheapest ->> 'item_id')::uuid END
    ));
    v_cheapest := NULL;
  END LOOP;

  v_promo_discount := least(round(v_promo_discount, 2), v_subtotal);

  v_points := greatest(coalesce((p_payload ->> 'pontos_usados')::integer, 0), 0);
  IF v_points > 0 THEN
    IF coalesce(v_cliente.pontos_bloqueados, false) THEN
      RAISE EXCEPTION 'A carteira de pontos está bloqueada.';
    END IF;
    IF v_points > coalesce(v_cliente.saldo_pontos, 0) THEN
      RAISE EXCEPTION 'Saldo de pontos insuficiente.';
    END IF;
    v_points := least(v_points, floor(greatest(v_subtotal - v_promo_discount, 0) * 100)::integer);
    v_points_discount := round(v_points * 0.01, 2);
  END IF;

  IF coalesce(p_payload ->> 'cupom_desconto_id', '') <> '' THEN
    IF p_payload ->> 'cupom_desconto_id' !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$' THEN
      RAISE EXCEPTION 'Cupom de desconto inválido.';
    END IF;
    v_discount_coupon_id := (p_payload ->> 'cupom_desconto_id')::uuid;
    SELECT * INTO v_coupon FROM public.cupons_loja WHERE id = v_discount_coupon_id FOR UPDATE;
    IF NOT FOUND OR v_coupon.categoria_cupom <> 'desconto' OR v_coupon.status <> 'ativo'
       OR v_coupon.total_usos >= v_coupon.limite_usos
       OR (v_coupon.data_validade IS NOT NULL AND v_coupon.data_validade < current_date)
       OR (v_coupon.cliente_id IS NOT NULL AND v_coupon.cliente_id <> v_actor.cliente_id)
       OR NOT EXISTS (
         SELECT 1 FROM public.cupons_ativados ca
         WHERE ca.cliente_id = v_actor.cliente_id AND ca.cupom_id = v_coupon.id
       )
       OR EXISTS (
         SELECT 1 FROM public.orcamentos o
         WHERE o.cliente_id = v_actor.cliente_id
           AND o.status <> 'cancelado'
           AND (o.cupom_desconto_id = v_coupon.id OR o.cupom_entrega_id = v_coupon.id)
       ) THEN
      RAISE EXCEPTION 'Cupom de desconto indisponível.';
    END IF;
    IF coalesce(v_coupon.valor_minimo_compra, 0) > v_subtotal THEN
      RAISE EXCEPTION 'O valor mínimo do cupom de desconto não foi atingido.';
    END IF;
    IF v_coupon.produto_id IS NOT NULL THEN
      SELECT coalesce(sum((entry ->> 'subtotal')::numeric), 0)
        - coalesce((v_promo_discount_by_product ->> v_coupon.produto_id::text)::numeric, 0)
      INTO v_discount_value
      FROM jsonb_array_elements(v_items) AS x(entry)
      WHERE entry ->> 'tipo' = 'produto'
        AND entry ->> 'item_id' = v_coupon.produto_id::text
        AND coalesce((entry ->> 'is_brinde')::boolean, false) IS FALSE;
      IF v_discount_value <= 0 THEN RAISE EXCEPTION 'O produto exigido pelo cupom não está no carrinho.'; END IF;
    ELSE
      v_discount_value := greatest(v_subtotal - v_promo_discount - v_points_discount, 0);
    END IF;
    IF v_coupon.tipo_desconto = 'porcentagem' THEN
      v_coupon_discount := round(v_discount_value * least(greatest(v_coupon.valor_desconto, 0), 100) / 100, 2);
    ELSE
      v_coupon_discount := round(greatest(coalesce(v_coupon.valor_desconto, 0), 0), 2);
    END IF;
    v_coupon_discount := least(
      v_coupon_discount,
      greatest(v_subtotal - v_promo_discount - v_points_discount, 0)
    );
  END IF;

  IF v_has_products THEN
    SELECT round(greatest(coalesce(value::numeric, 0), 0), 2)
    INTO v_shipping
    FROM public.system_settings
    WHERE key = 'loja_taxa_entrega_padrao';
    v_shipping := coalesce(v_shipping, 0);

    v_address := p_payload -> 'endereco_entrega';
    IF jsonb_typeof(v_address) <> 'object'
       OR regexp_replace(coalesce(v_address ->> 'cep', ''), '\D', '', 'g') !~ '^[0-9]{8}$'
       OR length(trim(coalesce(v_address ->> 'logradouro', ''))) NOT BETWEEN 2 AND 180
       OR length(trim(coalesce(v_address ->> 'numero', ''))) NOT BETWEEN 1 AND 20
       OR length(trim(coalesce(v_address ->> 'bairro', ''))) NOT BETWEEN 2 AND 100
       OR length(trim(coalesce(v_address ->> 'cidade', ''))) NOT BETWEEN 2 AND 100
       OR upper(trim(coalesce(v_address ->> 'uf', ''))) !~ '^[A-Z]{2}$' THEN
      RAISE EXCEPTION 'Endereço de entrega incompleto ou inválido.';
    END IF;
    v_address := jsonb_build_object(
      'cep', regexp_replace(v_address ->> 'cep', '\D', '', 'g'),
      'logradouro', left(trim(v_address ->> 'logradouro'), 180),
      'numero', left(trim(v_address ->> 'numero'), 20),
      'complemento', left(trim(coalesce(v_address ->> 'complemento', '')), 100),
      'bairro', left(trim(v_address ->> 'bairro'), 100),
      'cidade', left(trim(v_address ->> 'cidade'), 100),
      'uf', upper(trim(v_address ->> 'uf'))
    );

    IF coalesce(p_payload ->> 'cupom_entrega_id', '') <> '' THEN
      IF p_payload ->> 'cupom_entrega_id' !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$' THEN
        RAISE EXCEPTION 'Cupom de entrega inválido.';
      END IF;
      v_shipping_coupon_id := (p_payload ->> 'cupom_entrega_id')::uuid;
      SELECT * INTO v_coupon FROM public.cupons_loja WHERE id = v_shipping_coupon_id FOR UPDATE;
      IF NOT FOUND OR v_coupon.categoria_cupom <> 'entrega' OR v_coupon.status <> 'ativo'
         OR v_coupon.total_usos >= v_coupon.limite_usos
         OR (v_coupon.data_validade IS NOT NULL AND v_coupon.data_validade < current_date)
         OR (v_coupon.cliente_id IS NOT NULL AND v_coupon.cliente_id <> v_actor.cliente_id)
         OR NOT EXISTS (
           SELECT 1 FROM public.cupons_ativados ca
           WHERE ca.cliente_id = v_actor.cliente_id AND ca.cupom_id = v_coupon.id
         )
         OR EXISTS (
           SELECT 1 FROM public.orcamentos o
           WHERE o.cliente_id = v_actor.cliente_id
             AND o.status <> 'cancelado'
             AND (o.cupom_desconto_id = v_coupon.id OR o.cupom_entrega_id = v_coupon.id)
         ) THEN
        RAISE EXCEPTION 'Cupom de entrega indisponível.';
      END IF;
      IF coalesce(v_coupon.valor_minimo_compra, 0) > v_subtotal THEN
        RAISE EXCEPTION 'O valor mínimo do cupom de entrega não foi atingido.';
      END IF;
      IF v_coupon.tipo_entrega IN ('frete_gratis', 'frete_gratis_minimo') THEN
        v_shipping := 0;
      ELSIF v_coupon.tipo_entrega = 'taxa_fixa' THEN
        v_shipping := round(greatest(coalesce(v_coupon.taxa_fixa_entrega, 0), 0), 2);
      END IF;
    END IF;
  ELSE
    v_address := NULL;
    IF coalesce(p_payload ->> 'cupom_entrega_id', '') <> '' THEN
      RAISE EXCEPTION 'Cupom de entrega exige produto físico no carrinho.';
    END IF;
  END IF;

  v_total_before_wallet := round(greatest(
    v_subtotal - v_promo_discount - v_points_discount - v_coupon_discount + v_shipping,
    0
  ), 2);

  v_wallet_requested := round(greatest(coalesce((p_payload ->> 'saldo_carteira_usado')::numeric, 0), 0), 2);
  IF v_wallet_requested > 0 THEN
    IF coalesce(v_cliente.carteira_bloqueada, false) THEN
      RAISE EXCEPTION 'A carteira financeira está bloqueada.';
    END IF;
    IF v_wallet_requested > coalesce(v_cliente.saldo_carteira, 0) THEN
      RAISE EXCEPTION 'Saldo da carteira insuficiente.';
    END IF;
    v_wallet_discount := least(v_wallet_requested, v_total_before_wallet);
  END IF;

  v_payment_method := lower(coalesce(nullif(trim(p_payload ->> 'forma_pagamento'), ''), 'outros'));
  IF v_payment_method NOT IN ('outros', 'credito_loja') THEN
    RAISE EXCEPTION 'Forma de pagamento inválida.';
  END IF;
  v_installments := greatest(coalesce((p_payload ->> 'parcelas')::integer, 1), 1);
  IF v_installments > 120 THEN RAISE EXCEPTION 'Quantidade de parcelas inválida.'; END IF;

  v_total := round(greatest(v_total_before_wallet - v_wallet_discount, 0), 2);
  IF v_payment_method = 'credito_loja' THEN
    IF v_total <= 0 THEN RAISE EXCEPTION 'Não há saldo restante para financiar com o Crédito GSA.'; END IF;
    IF v_installments > 1 AND coalesce(v_cliente.opcao_pagamento_parcelado, false) IS NOT TRUE THEN
      RAISE EXCEPTION 'Pagamento parcelado não está liberado para este cliente.';
    END IF;
    IF v_installments > coalesce(v_cliente.max_parcelas, 1) THEN
      RAISE EXCEPTION 'A quantidade de parcelas excede o limite do cliente.';
    END IF;
    SELECT least(greatest(coalesce(value::numeric, 0), 0), 1000)
    INTO v_interest_rate FROM public.system_settings WHERE key = 'loja_credito_juros_avista';
    v_interest_rate := coalesce(v_interest_rate, 0);
    IF v_installments > 1 THEN
      SELECT v_interest_rate + least(greatest(coalesce(value::numeric, 0), 0), 1000) * v_installments
      INTO v_interest_rate FROM public.system_settings WHERE key = 'loja_credito_juros_parcelado';
      v_interest_rate := coalesce(v_interest_rate, 0);
    END IF;
    v_interest := round(v_total * v_interest_rate / 100, 2);
    v_total := round(v_total + v_interest, 2);
    IF coalesce(v_cliente.limite_credito_disponivel, 0) < v_total THEN
      RAISE EXCEPTION 'Limite do Crédito GSA insuficiente.';
    END IF;
    SELECT id INTO v_active_credit_request
    FROM public.loja_credito_solicitacoes
    WHERE cliente_id = v_actor.cliente_id AND status = 'liberado'
    ORDER BY created_at DESC LIMIT 1;
  ELSE
    v_installments := 1;
  END IF;

  -- Inventory is changed only after every price and eligibility validation succeeds.
  FOR v_item IN SELECT entry FROM jsonb_array_elements(v_items) AS x(entry)
  LOOP
    IF v_item ->> 'tipo' = 'produto' THEN
      SELECT * INTO v_product FROM public.produtos WHERE id = (v_item ->> 'item_id')::uuid FOR UPDATE;
      IF coalesce(v_product.controle_estoque, false) THEN
        IF coalesce(v_product.estoque_disponivel, 0) < (v_item ->> 'quantidade')::integer THEN
          RAISE EXCEPTION 'Estoque insuficiente para %.', v_product.nome;
        END IF;
        UPDATE public.produtos
        SET estoque_disponivel = estoque_disponivel - (v_item ->> 'quantidade')::integer
        WHERE id = v_product.id;
      END IF;
    END IF;
  END LOOP;

  v_code := public.gsa_generate_code('ODC');
  v_status := CASE
    WHEN v_total = 0 THEN 'pago'
    WHEN v_payment_method = 'credito_loja' THEN 'aprovado'
    ELSE 'aberto'
  END;
  v_order_status := CASE
    WHEN v_total = 0 THEN 'pago'
    WHEN v_payment_method = 'credito_loja' THEN 'aprovado'
    ELSE 'em_analise'
  END;

  SELECT coalesce(sum((entry ->> 'quantidade')::integer), 0)
  INTO v_total_quantity
  FROM jsonb_array_elements(v_items) AS x(entry)
  WHERE coalesce((entry ->> 'is_brinde')::boolean, false) IS FALSE;

  INSERT INTO public.orcamentos(
    cliente_id, codigo_orcamento, categoria, status, origem_gsa_store,
    titulo_solicitacao, descricao_solicitacao, descricao_adicional,
    produto_id, servico_id, assinatura_id,
    valor_produto, valor_servico, valor_assinatura,
    subtotal_itens, desconto_promocional, desconto_cupom, desconto_pontos,
    abatimento_carteira, desconto, taxa_entrega, acrescimo, total,
    total_contrato, quantidade, quantidade_meses,
    cupom_desconto_id, cupom_entrega_id, entrega_cupom_aplicado,
    endereco_entrega, forma_pagamento_loja, parcelas_credito,
    checkout_request_id, fase_negociacao
  )
  SELECT
    v_actor.cliente_id, v_code, 'loja', v_status, true,
    'Pedido GSA Store', 'Compra realizada na GSA Store',
    CASE WHEN v_payment_method = 'credito_loja'
      THEN format('Juros do Crédito GSA (+%s%% em %sx)', v_interest_rate, v_installments)
      ELSE NULL END,
    (SELECT (entry ->> 'item_id')::uuid FROM jsonb_array_elements(v_items) AS x(entry)
      WHERE entry ->> 'tipo' = 'produto' AND coalesce((entry ->> 'is_brinde')::boolean, false) IS FALSE LIMIT 1),
    (SELECT (entry ->> 'item_id')::uuid FROM jsonb_array_elements(v_items) AS x(entry)
      WHERE entry ->> 'tipo' = 'servico' LIMIT 1),
    (SELECT (entry ->> 'item_id')::uuid FROM jsonb_array_elements(v_items) AS x(entry)
      WHERE entry ->> 'tipo' = 'assinatura' LIMIT 1),
    v_subtotal_products, v_subtotal_services, v_subtotal_subscriptions,
    v_subtotal, v_promo_discount, v_coupon_discount, v_points_discount,
    v_wallet_discount,
    round(v_promo_discount + v_coupon_discount + v_points_discount + v_wallet_discount, 2),
    v_shipping, v_interest, v_total,
    round(v_contract_total + v_subtotal_products + v_subtotal_services, 2),
    v_total_quantity,
    (SELECT max((entry ->> 'prazo_meses')::integer) FROM jsonb_array_elements(v_items) AS x(entry)
      WHERE entry ->> 'tipo' = 'assinatura'),
    v_discount_coupon_id, v_shipping_coupon_id, v_shipping_coupon_id IS NOT NULL,
    v_address, v_payment_method, v_installments,
    v_request_id, 'cliente'
  RETURNING id INTO v_orcamento_id;

  INSERT INTO public.loja_pedido_itens(
    orcamento_id, cliente_id, tipo, item_id,
    produto_id, servico_id, assinatura_id,
    codigo, nome, valor_unitario, quantidade, prazo_meses, subtotal,
    is_brinde, promocao_id, metadata
  )
  SELECT
    v_orcamento_id, v_actor.cliente_id, entry ->> 'tipo', (entry ->> 'item_id')::uuid,
    nullif(entry ->> 'produto_id', '')::uuid,
    nullif(entry ->> 'servico_id', '')::uuid,
    nullif(entry ->> 'assinatura_id', '')::uuid,
    entry ->> 'codigo', entry ->> 'nome',
    (entry ->> 'valor_unitario')::numeric, (entry ->> 'quantidade')::integer,
    nullif(entry ->> 'prazo_meses', '')::integer,
    (entry ->> 'subtotal')::numeric,
    coalesce((entry ->> 'is_brinde')::boolean, false),
    nullif(entry ->> 'promocao_id', '')::uuid,
    jsonb_build_object('categoria_id', entry ->> 'categoria_id')
  FROM jsonb_array_elements(v_items) AS x(entry);

  FOR v_item IN SELECT entry FROM jsonb_array_elements(v_items) AS x(entry)
  LOOP
    IF v_item ->> 'tipo' = 'produto' THEN
      INSERT INTO public.ordens_compra(
        codigo_ordem, produto_id, cliente_id, status, quantidade, orcamento_id
      ) VALUES (
        public.gsa_generate_code('OC'), (v_item ->> 'item_id')::uuid,
        v_actor.cliente_id, v_order_status, (v_item ->> 'quantidade')::integer, v_orcamento_id
      ) RETURNING id INTO v_order_id;
      v_first_purchase_order := coalesce(v_first_purchase_order, v_order_id);
    ELSIF v_item ->> 'tipo' = 'assinatura' THEN
      INSERT INTO public.ordens_assinatura(
        codigo_ordem, assinatura_id, cliente_id, status,
        quantidade, prazo_meses, renovacao_automatica, orcamento_id
      ) VALUES (
        public.gsa_generate_code('OA'), (v_item ->> 'item_id')::uuid,
        v_actor.cliente_id, CASE WHEN v_order_status = 'pago' THEN 'aprovado' ELSE v_order_status END,
        (v_item ->> 'quantidade')::integer, (v_item ->> 'prazo_meses')::integer,
        true, v_orcamento_id
      ) RETURNING id INTO v_order_id;
      v_first_subscription_order := coalesce(v_first_subscription_order, v_order_id);
    ELSE
      INSERT INTO public.ordens_servico(
        codigo_os, orcamento_id, cliente_id, servico_id, status,
        data_inicio, tipo_entrega
      ) VALUES (
        public.gsa_generate_code('OS'), v_orcamento_id, v_actor.cliente_id,
        (v_item ->> 'item_id')::uuid, v_order_status, now(), 'online'
      ) RETURNING id INTO v_order_id;
      v_first_service_order := coalesce(v_first_service_order, v_order_id);
    END IF;
  END LOOP;

  IF v_points > 0 THEN
    UPDATE public.clientes
    SET saldo_pontos = coalesce(saldo_pontos, 0) - v_points
    WHERE id = v_actor.cliente_id;
    INSERT INTO public.pontos_movimentacoes(
      cliente_id, tipo, pontos, saldo_apos, descricao, valor_convertido
    ) VALUES (
      v_actor.cliente_id, 'resgate', -v_points,
      coalesce(v_cliente.saldo_pontos, 0) - v_points,
      'Uso de pontos no pedido #' || v_code, v_points_discount
    );
    INSERT INTO public.points_transactions(cliente_id, tipo, pontos, descricao)
    VALUES (v_actor.cliente_id, 'resgate', -v_points, 'Uso de pontos no pedido #' || v_code);
  END IF;

  IF v_wallet_discount > 0 THEN
    UPDATE public.clientes
    SET saldo_carteira = round(coalesce(saldo_carteira, 0) - v_wallet_discount, 2)
    WHERE id = v_actor.cliente_id;
    INSERT INTO public.carteira_lancamentos(cliente_id, valor, tipo, descricao)
    VALUES (v_actor.cliente_id, v_wallet_discount, 'debito', 'Uso de saldo no pedido #' || v_code);
    INSERT INTO public.extrato_financeiro(
      cliente_id, tipo, valor, descricao, referencia_id, modulo_referencia, saldo_resultante
    ) VALUES (
      v_actor.cliente_id, 'saida', v_wallet_discount, 'Uso de saldo no pedido #' || v_code,
      v_orcamento_id, 'gsa_store', round(coalesce(v_cliente.saldo_carteira, 0) - v_wallet_discount, 2)
    );
  END IF;

  IF v_discount_coupon_id IS NOT NULL THEN
    UPDATE public.cupons_loja
    SET total_usos = total_usos + 1,
        status = CASE WHEN total_usos + 1 >= limite_usos THEN 'usado' ELSE status END,
        updated_at = now()
    WHERE id = v_discount_coupon_id;
  END IF;
  IF v_shipping_coupon_id IS NOT NULL AND v_shipping_coupon_id IS DISTINCT FROM v_discount_coupon_id THEN
    UPDATE public.cupons_loja
    SET total_usos = total_usos + 1,
        status = CASE WHEN total_usos + 1 >= limite_usos THEN 'usado' ELSE status END,
        updated_at = now()
    WHERE id = v_shipping_coupon_id;
  END IF;

  INSERT INTO public.promocoes_quantidade_uso(
    promocao_id, cliente_id, orcamento_id, quantidade_usada,
    economia_gerada, detalhes
  )
  SELECT
    (detail ->> 'promocao_id')::uuid, v_actor.cliente_id, v_orcamento_id,
    greatest((detail ->> 'vezes_aplicada')::integer, 1),
    (detail ->> 'economia_gerada')::numeric, detail
  FROM jsonb_array_elements(v_promo_details) AS p(detail);

  IF v_payment_method = 'credito_loja' THEN
    v_limit_before := coalesce(v_cliente.limite_credito_disponivel, 0);
    v_limit_after := round(v_limit_before - v_total, 2);
    UPDATE public.clientes SET limite_credito_disponivel = v_limit_after WHERE id = v_actor.cliente_id;
    INSERT INTO public.loja_credito_movimentacoes(
      cliente_id, solicitacao_id, tipo, valor,
      limite_total_anterior, limite_total_novo,
      limite_disponivel_anterior, limite_disponivel_novo, descricao
    ) VALUES (
      v_actor.cliente_id, v_active_credit_request, 'compra', v_total,
      coalesce(v_cliente.limite_credito_total, 0), coalesce(v_cliente.limite_credito_total, 0),
      v_limit_before, v_limit_after, 'Compra GSA Store #' || v_code
    );

    v_total_cents := round(v_total * 100)::bigint;
    v_installment_cents := v_total_cents / v_installments;
    v_remainder_cents := (v_total_cents % v_installments)::integer;
    FOR v_i IN 1..v_installments LOOP
      v_invoice_value := (v_installment_cents + CASE WHEN v_i <= v_remainder_cents THEN 1 ELSE 0 END)::numeric / 100;
      SELECT coalesce(jsonb_agg(
        entry || jsonb_build_object(
          'subtotal_original', (entry ->> 'subtotal')::numeric,
          'parcela', v_i,
          'total_parcelas', v_installments
        )
        ORDER BY entry ->> 'tipo', entry ->> 'nome'
      ), '[]'::jsonb)
      INTO v_invoice_items
      FROM jsonb_array_elements(v_items) AS x(entry);

      INSERT INTO public.faturas(
        codigo_fatura, cliente_id, orcamento_id,
        ordem_compra_id, ordem_assinatura_id, os_id,
        valor_total, valor_final_pendente, status, tipo,
        data_emissao, data_vencimento, gerada_automaticamente,
        is_amortizacao_credito, forma_pagamento_escolhida,
        itens_faturados, valor_base_original,
        desconto_promocional_aplicado, desconto_voucher_aplicado,
        desconto_pontos_aplicado, abatimento_carteira_aplicado,
        acrescimo_manual, observacoes
      ) VALUES (
        'FAT-CRE-' || v_code || '-' || v_i || '/' || v_installments,
        v_actor.cliente_id, v_orcamento_id,
        v_first_purchase_order, v_first_subscription_order, v_first_service_order,
        v_invoice_value, v_invoice_value, 'pendente',
        CASE WHEN v_first_purchase_order IS NOT NULL THEN 'produto'
             WHEN v_first_subscription_order IS NOT NULL THEN 'assinatura'
             ELSE 'servico' END,
        current_date, current_date + (v_i * 30), true,
        true, 'credito_loja', v_invoice_items,
        round(v_subtotal / v_installments, 2),
        round(v_promo_discount / v_installments, 2),
        round(v_coupon_discount / v_installments, 2),
        round(v_points_discount / v_installments, 2),
        round(v_wallet_discount / v_installments, 2),
        round(v_interest / v_installments, 2),
        format('Parcela %s/%s do pedido %s', v_i, v_installments, v_code)
      ) RETURNING id INTO v_invoice_id;
    END LOOP;
  END IF;

  DELETE FROM public.loja_carrinhos WHERE cliente_id = v_actor.cliente_id;

  INSERT INTO public.orcamento_timeline(
    orcamento_id, cliente_id, ator_id, ator_tipo, tipo, acao,
    status, titulo, descricao, metadata
  ) VALUES (
    v_orcamento_id, v_actor.cliente_id, v_actor.cliente_id, 'cliente',
    'pedido', 'checkout', v_status, 'Pedido criado',
    'Pedido confirmado pelo cliente na GSA Store.',
    jsonb_build_object('codigo', v_code, 'total', v_total, 'request_id', v_request_id)
  );

  INSERT INTO public.notificacoes(
    cliente_id, titulo, mensagem, modulo, tab, item_id,
    destinatario_tipo, prioridade, acao_origem, contexto
  ) VALUES (
    v_actor.cliente_id, 'Pedido confirmado',
    format('Seu pedido %s foi criado no valor de R$ %s.', v_code, to_char(v_total, 'FM999G999G990D00')),
    'gsa_store', 'compras', v_orcamento_id::text,
    'cliente', 'normal', 'checkout_loja',
    jsonb_build_object('orcamento_id', v_orcamento_id, 'codigo', v_code)
  );

  INSERT INTO public.notificacoes(
    titulo, mensagem, modulo, tab, item_id,
    destinatario_tipo, prioridade, acao_origem, contexto
  ) VALUES (
    'Novo pedido GSA Store',
    format('%s realizou o pedido %s no valor de R$ %s.', v_actor.cliente_nome, v_code, to_char(v_total, 'FM999G999G990D00')),
    'vendas', 'pedidos', v_orcamento_id::text,
    'admin', CASE WHEN v_payment_method = 'credito_loja' THEN 'alta' ELSE 'normal' END,
    'checkout_loja', jsonb_build_object('orcamento_id', v_orcamento_id, 'codigo', v_code)
  );

  RETURN jsonb_build_object(
    'success', true,
    'already_exists', false,
    'orcamento_id', v_orcamento_id,
    'codigo_orcamento', v_code,
    'status', v_status,
    'subtotal', v_subtotal,
    'desconto_promocional', v_promo_discount,
    'desconto_pontos', v_points_discount,
    'desconto_cupom', v_coupon_discount,
    'abatimento_carteira', v_wallet_discount,
    'taxa_entrega', v_shipping,
    'acrescimo_credito', v_interest,
    'total', v_total,
    'parcelas', v_installments,
    'promocoes', v_promo_details
  );
END;
$$;

REVOKE ALL ON FUNCTION public.gsa_client_checkout_store(uuid, text, jsonb) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.gsa_client_checkout_store(uuid, text, jsonb) TO authenticated;

REVOKE ALL ON FUNCTION public.checkout_pedido(json) FROM public, anon, authenticated;

COMMENT ON FUNCTION public.gsa_client_checkout_store(uuid, text, jsonb) IS
  'Creates a complete GSA Store order atomically from a validated client session and server-authoritative catalog/financial rules.';
