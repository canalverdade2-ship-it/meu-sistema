-- 20260716183000_individual_product_discounts.sql
-- Adiciona colunas para controle de descontos individuais nos produtos

-- 1. Alterar tabela public.produtos
ALTER TABLE public.produtos
    ADD COLUMN desconto_ativo boolean NOT NULL DEFAULT false,
    ADD COLUMN desconto_tipo text NULL,
    ADD COLUMN desconto_valor numeric(12,2) NULL,
    ADD COLUMN valor_promocional numeric(12,2) NULL,
    ADD COLUMN desconto_percentual numeric(7,2) NULL,
    ADD COLUMN desconto_atualizado_em timestamptz NULL,
    ADD COLUMN desconto_atualizado_por uuid NULL;

-- Constraints para produtos
ALTER TABLE public.produtos
    ADD CONSTRAINT check_desconto_tipo 
    CHECK (desconto_tipo IS NULL OR desconto_tipo IN ('porcentagem', 'valor'));

-- 2. Funções de cálculo de preços
CREATE OR REPLACE FUNCTION public.gsa_calculate_product_effective_price(
  p_valor numeric,
  p_desconto_ativo boolean,
  p_desconto_tipo text,
  p_desconto_valor numeric
)
RETURNS numeric
LANGUAGE plpgsql
IMMUTABLE
AS $$
BEGIN
  IF p_desconto_ativo IS NOT TRUE 
     OR p_desconto_tipo IS NULL 
     OR p_desconto_valor IS NULL 
     OR p_desconto_valor <= 0 
     OR p_valor IS NULL THEN
    RETURN round(p_valor, 2);
  END IF;

  IF p_desconto_tipo = 'porcentagem' THEN
    IF p_desconto_valor >= 100 THEN
      RETURN round(p_valor, 2);
    END IF;
    RETURN round(p_valor * (1.00 - (p_desconto_valor / 100.00)), 2);
  ELSIF p_desconto_tipo = 'valor' THEN
    IF p_desconto_valor >= p_valor THEN
      RETURN round(p_valor, 2);
    END IF;
    RETURN round(p_valor - p_desconto_valor, 2);
  ELSE
    RETURN round(p_valor, 2);
  END IF;
END;
$$;

CREATE OR REPLACE FUNCTION public.gsa_calculate_product_discount_percentage(
  p_valor numeric,
  p_effective_price numeric
)
RETURNS numeric
LANGUAGE plpgsql
IMMUTABLE
AS $$
BEGIN
  IF p_valor IS NULL OR p_valor <= 0 OR p_effective_price IS NULL OR p_effective_price >= p_valor THEN
    RETURN 0.00;
  END IF;
  RETURN round(((p_valor - p_effective_price) / p_valor) * 100.00, 2);
END;
$$;

-- 3. Trigger na tabela public.produtos
CREATE OR REPLACE FUNCTION public.gsa_trg_produtos_discount_calc()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  v_effective numeric;
BEGIN
  IF NEW.desconto_ativo IS TRUE THEN
    -- Validações básicas de consistência
    IF NEW.desconto_valor IS NULL OR NEW.desconto_valor <= 0 THEN
      RAISE EXCEPTION 'O valor do desconto deve ser maior que zero.';
    END IF;
    
    IF NEW.desconto_tipo = 'porcentagem' AND NEW.desconto_valor >= 100.00 THEN
      RAISE EXCEPTION 'Desconto de porcentagem deve ser menor que 100%%.';
    END IF;

    IF NEW.desconto_tipo = 'valor' AND NEW.desconto_valor >= NEW.valor THEN
      RAISE EXCEPTION 'Desconto fixo deve ser menor que o valor original do produto.';
    END IF;

    -- Calcular preco promocional e percentual efetivo
    v_effective := public.gsa_calculate_product_effective_price(NEW.valor, NEW.desconto_ativo, NEW.desconto_tipo, NEW.desconto_valor);
    NEW.valor_promocional := v_effective;
    NEW.desconto_percentual := public.gsa_calculate_product_discount_percentage(NEW.valor, v_effective);
  ELSE
    -- Se inativo, limpar as colunas de promoção calculadas e configurações
    NEW.valor_promocional := NULL;
    NEW.desconto_percentual := NULL;
    NEW.desconto_tipo := NULL;
    NEW.desconto_valor := NULL;
  END IF;
  
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_produtos_discount_calc
BEFORE INSERT OR UPDATE OF valor, desconto_ativo, desconto_tipo, desconto_valor ON public.produtos
FOR EACH ROW
EXECUTE FUNCTION public.gsa_trg_produtos_discount_calc();

-- 4. Adicionar colunas de histórico de desconto em public.loja_pedido_itens
ALTER TABLE public.loja_pedido_itens
    ADD COLUMN valor_original numeric NULL,
    ADD COLUMN desconto_produto_unitario numeric NOT NULL DEFAULT 0,
    ADD COLUMN desconto_produto_percentual numeric NOT NULL DEFAULT 0,
    ADD COLUMN desconto_produto_tipo text NULL,
    ADD COLUMN desconto_produto_configurado numeric NULL;

-- Backfill histórico
UPDATE public.loja_pedido_itens
SET valor_original = valor_unitario
WHERE valor_original IS NULL;

-- 5. Adicionar colunas de controle em public.orcamentos
ALTER TABLE public.orcamentos
    ADD COLUMN subtotal_preco_tabela numeric NULL,
    ADD COLUMN desconto_produtos numeric NULL;

-- 6. RPC de segurança administrativa
CREATE OR REPLACE FUNCTION public.gsa_admin_set_product_discount(
  p_sessao_id uuid,
  p_session_token text,
  p_produto_id uuid,
  p_ativo boolean,
  p_tipo text,
  p_valor numeric
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_actor record;
  v_product public.produtos%rowtype;
  v_result jsonb;
BEGIN
  -- Validar sessao
  SELECT * INTO v_actor
  FROM public.gsa_admin_session_actor(p_sessao_id, p_session_token)
  LIMIT 1;

  IF v_actor.ator_tipo = 'colaborador' THEN
    IF NOT EXISTS (
      SELECT 1
      FROM public.colaborador_modulos cm
      WHERE cm.colaborador_id = v_actor.ator_id
        AND cm.modulo_id IN ('produtos', 'catálogo')
    ) THEN
      RAISE EXCEPTION 'Colaborador sem permissao para gerenciar produtos.';
    END IF;
  END IF;

  -- Bloquear linha do produto para atualizar
  SELECT * INTO v_product
  FROM public.produtos
  WHERE id = p_produto_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Produto não encontrado.';
  END IF;

  -- Atualizar produto
  UPDATE public.produtos
  SET desconto_ativo = p_ativo,
      desconto_tipo = CASE WHEN p_ativo THEN p_tipo ELSE NULL END,
      desconto_valor = CASE WHEN p_ativo THEN p_valor ELSE NULL END,
      desconto_atualizado_em = now(),
      desconto_atualizado_por = v_actor.ator_id
  WHERE id = p_produto_id
  RETURNING * INTO v_product;

  v_result := jsonb_build_object(
    'success', true,
    'produto_id', v_product.id,
    'valor_original', v_product.valor,
    'desconto_tipo', v_product.desconto_tipo,
    'desconto_valor', v_product.desconto_valor,
    'valor_promocional', v_product.valor_promocional,
    'desconto_percentual', v_product.desconto_percentual,
    'desconto_ativo', v_product.desconto_ativo
  );

  RETURN v_result;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.gsa_admin_set_product_discount(uuid, text, uuid, boolean, text, numeric) FROM public, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.gsa_admin_set_product_discount(uuid, text, uuid, boolean, text, numeric) TO authenticated, service_role;
