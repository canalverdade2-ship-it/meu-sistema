-- 20260716184000_product_discount_quantity_limit.sql
-- Adiciona suporte a limite global de unidades para descontos de produtos
-- Implementacao incremental sobre as migrations anteriores

-- ===========================================================
-- 1. Novos campos na tabela public.produtos
-- ===========================================================
ALTER TABLE public.produtos
    ADD COLUMN IF NOT EXISTS desconto_limite_quantidade_ativo boolean NOT NULL DEFAULT false,
    ADD COLUMN IF NOT EXISTS desconto_quantidade_limite integer NULL,
    ADD COLUMN IF NOT EXISTS desconto_quantidade_utilizada integer NOT NULL DEFAULT 0,
    ADD COLUMN IF NOT EXISTS desconto_campanha_id uuid NULL;

ALTER TABLE public.produtos DROP CONSTRAINT IF EXISTS check_desconto_quantidade_limite;
ALTER TABLE public.produtos ADD CONSTRAINT check_desconto_quantidade_limite
    CHECK (desconto_quantidade_limite IS NULL OR desconto_quantidade_limite > 0);
ALTER TABLE public.produtos DROP CONSTRAINT IF EXISTS check_desconto_quantidade_utilizada;
ALTER TABLE public.produtos ADD CONSTRAINT check_desconto_quantidade_utilizada
    CHECK (desconto_quantidade_utilizada >= 0);

-- ===========================================================
-- 2. Tabela de auditoria de movimentos de cota promocional
-- ===========================================================
CREATE TABLE IF NOT EXISTS public.produto_desconto_cota_movimentos (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    produto_id uuid NOT NULL REFERENCES public.produtos(id) ON DELETE CASCADE,
    desconto_campanha_id uuid NOT NULL,
    orcamento_id uuid NULL REFERENCES public.orcamentos(id) ON DELETE SET NULL,
    loja_pedido_item_id uuid NULL,
    checkout_request_id uuid NULL,
    tipo_movimento text NOT NULL,
    quantidade integer NOT NULL,
    created_at timestamptz NOT NULL DEFAULT now(),
    metadata jsonb NULL,
    CONSTRAINT check_tipo_movimento CHECK (tipo_movimento IN ('consumo', 'liberacao', 'ajuste', 'reset_nova_campanha')),
    CONSTRAINT check_quantidade_positiva CHECK (quantidade > 0)
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_cota_mov_idempotencia
    ON public.produto_desconto_cota_movimentos (checkout_request_id, produto_id)
    WHERE tipo_movimento = 'consumo' AND checkout_request_id IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS idx_cota_mov_liberacao_idempotencia
    ON public.produto_desconto_cota_movimentos (orcamento_id, produto_id)
    WHERE tipo_movimento = 'liberacao' AND orcamento_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_cota_mov_produto_id
    ON public.produto_desconto_cota_movimentos (produto_id, desconto_campanha_id);

CREATE INDEX IF NOT EXISTS idx_cota_mov_orcamento_id
    ON public.produto_desconto_cota_movimentos (orcamento_id)
    WHERE orcamento_id IS NOT NULL;

ALTER TABLE public.produto_desconto_cota_movimentos ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Movimentos somente admin/service" ON public.produto_desconto_cota_movimentos;
CREATE POLICY "Movimentos somente admin/service"
    ON public.produto_desconto_cota_movimentos FOR ALL USING (false) WITH CHECK (false);

-- ===========================================================
-- 3. Novos campos de snapshot em public.loja_pedido_itens
-- ===========================================================
ALTER TABLE public.loja_pedido_itens
    ADD COLUMN IF NOT EXISTS desconto_campanha_id uuid NULL,
    ADD COLUMN IF NOT EXISTS desconto_quantidade_limite integer NULL,
    ADD COLUMN IF NOT EXISTS quantidade_com_desconto integer NOT NULL DEFAULT 0,
    ADD COLUMN IF NOT EXISTS quantidade_sem_desconto integer NOT NULL DEFAULT 0,
    ADD COLUMN IF NOT EXISTS valor_normal_unitario numeric NULL,
    ADD COLUMN IF NOT EXISTS subtotal_com_desconto numeric NOT NULL DEFAULT 0,
    ADD COLUMN IF NOT EXISTS subtotal_sem_desconto numeric NOT NULL DEFAULT 0;

-- ===========================================================
-- 4. Atualizar trigger gsa_trg_produtos_discount_calc
-- ===========================================================
CREATE OR REPLACE FUNCTION public.gsa_trg_produtos_discount_calc()
RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE
  v_effective numeric;
BEGIN
  IF NEW.desconto_ativo IS TRUE THEN
    IF NEW.desconto_valor IS NULL OR NEW.desconto_valor <= 0 THEN
      RAISE EXCEPTION 'O valor do desconto deve ser maior que zero.';
    END IF;
    IF NEW.desconto_tipo = 'porcentagem' AND NEW.desconto_valor >= 100.00 THEN
      RAISE EXCEPTION 'Desconto de porcentagem deve ser menor que 100%%.';
    END IF;
    IF NEW.desconto_tipo = 'valor' AND NEW.desconto_valor >= NEW.valor THEN
      RAISE EXCEPTION 'Desconto fixo deve ser menor que o valor original do produto.';
    END IF;
    IF NEW.desconto_prazo_tipo = 'determinado' THEN
      IF NEW.desconto_fim_em IS NULL THEN
        RAISE EXCEPTION 'A data final da promocao deve ser informada.';
      END IF;
      IF NEW.desconto_fim_em < now() AND (TG_OP = 'INSERT' OR OLD.desconto_fim_em IS DISTINCT FROM NEW.desconto_fim_em) THEN
        RAISE EXCEPTION 'A data final da promocao nao pode estar no passado.';
      END IF;
    ELSE
      NEW.desconto_fim_em := NULL;
    END IF;
    IF NEW.desconto_limite_quantidade_ativo IS TRUE THEN
      IF NEW.desconto_quantidade_limite IS NULL OR NEW.desconto_quantidade_limite <= 0 THEN
        RAISE EXCEPTION 'A quantidade limite deve ser maior que zero quando o limite esta ativo.';
      END IF;
      IF NEW.desconto_quantidade_utilizada > NEW.desconto_quantidade_limite THEN
        RAISE EXCEPTION 'O limite nao pode ser menor que as unidades ja utilizadas.';
      END IF;
      IF NEW.desconto_campanha_id IS NULL THEN
        NEW.desconto_campanha_id := gen_random_uuid();
      END IF;
    ELSE
      NEW.desconto_quantidade_limite := NULL;
    END IF;
    v_effective := public.gsa_calculate_product_effective_price(
      NEW.valor, NEW.desconto_ativo, NEW.desconto_tipo, NEW.desconto_valor,
      NEW.desconto_prazo_tipo, NEW.desconto_fim_em
    );
    NEW.valor_promocional := v_effective;
    NEW.desconto_percentual := public.gsa_calculate_product_discount_percentage(NEW.valor, v_effective);
  ELSE
    NEW.valor_promocional := NULL;
    NEW.desconto_percentual := NULL;
    NEW.desconto_tipo := NULL;
    NEW.desconto_valor := NULL;
    NEW.desconto_prazo_tipo := 'indeterminado';
    NEW.desconto_fim_em := NULL;
    NEW.desconto_limite_quantidade_ativo := false;
    NEW.desconto_quantidade_limite := NULL;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_produtos_discount_calc ON public.produtos;
CREATE TRIGGER trg_produtos_discount_calc
BEFORE INSERT OR UPDATE OF valor, desconto_ativo, desconto_tipo, desconto_valor,
    desconto_prazo_tipo, desconto_fim_em, desconto_limite_quantidade_ativo, desconto_quantidade_limite
ON public.produtos
FOR EACH ROW EXECUTE FUNCTION public.gsa_trg_produtos_discount_calc();

-- ===========================================================
-- 5. Atualizar RPC gsa_admin_set_product_discount
-- ===========================================================
CREATE OR REPLACE FUNCTION public.gsa_admin_set_product_discount(
  p_sessao_id uuid, p_session_token text, p_produto_id uuid,
  p_ativo boolean, p_tipo text, p_valor numeric,
  p_prazo_tipo text DEFAULT 'indeterminado', p_fim_em timestamptz DEFAULT NULL,
  p_limite_quantidade_ativo boolean DEFAULT false,
  p_quantidade_limite integer DEFAULT NULL,
  p_iniciar_nova_campanha boolean DEFAULT false
)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_actor record;
  v_product public.produtos%rowtype;
  v_nova_campanha_id uuid;
  v_result jsonb;
BEGIN
  SELECT * INTO v_actor FROM public.gsa_admin_session_actor(p_sessao_id, p_session_token) LIMIT 1;
  IF v_actor.ator_tipo = 'colaborador' THEN
    IF NOT EXISTS (SELECT 1 FROM public.colaborador_modulos cm WHERE cm.colaborador_id = v_actor.ator_id AND cm.modulo_id IN ('produtos', 'catalogo')) THEN
      RAISE EXCEPTION 'Colaborador sem permissao para gerenciar produtos.';
    END IF;
  END IF;
  SELECT * INTO v_product FROM public.produtos WHERE id = p_produto_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Produto nao encontrado.'; END IF;
  IF p_ativo AND p_limite_quantidade_ativo THEN
    IF p_quantidade_limite IS NULL OR p_quantidade_limite <= 0 THEN
      RAISE EXCEPTION 'A quantidade limite deve ser maior que zero.';
    END IF;
    IF p_quantidade_limite < coalesce(v_product.desconto_quantidade_utilizada, 0) THEN
      RAISE EXCEPTION 'O limite nao pode ser menor que as % unidades ja utilizadas.', coalesce(v_product.desconto_quantidade_utilizada, 0);
    END IF;
  END IF;
  IF p_ativo AND p_iniciar_nova_campanha THEN
    v_nova_campanha_id := gen_random_uuid();
    IF v_product.desconto_campanha_id IS NOT NULL THEN
      INSERT INTO public.produto_desconto_cota_movimentos(produto_id, desconto_campanha_id, tipo_movimento, quantidade, metadata)
      VALUES (p_produto_id, v_product.desconto_campanha_id, 'reset_nova_campanha', coalesce(v_product.desconto_quantidade_utilizada, 0),
        jsonb_build_object('campanha_anterior', v_product.desconto_campanha_id, 'nova_campanha', v_nova_campanha_id, 'utilizada_anterior', v_product.desconto_quantidade_utilizada, 'ator_id', v_actor.ator_id));
    END IF;
  ELSIF p_ativo AND v_product.desconto_campanha_id IS NULL THEN
    v_nova_campanha_id := gen_random_uuid();
  ELSE
    v_nova_campanha_id := v_product.desconto_campanha_id;
  END IF;
  UPDATE public.produtos SET
    desconto_ativo = p_ativo,
    desconto_tipo = CASE WHEN p_ativo THEN p_tipo ELSE NULL END,
    desconto_valor = CASE WHEN p_ativo THEN p_valor ELSE NULL END,
    desconto_prazo_tipo = CASE WHEN p_ativo THEN p_prazo_tipo ELSE 'indeterminado' END,
    desconto_fim_em = CASE WHEN p_ativo THEN p_fim_em ELSE NULL END,
    desconto_limite_quantidade_ativo = CASE WHEN p_ativo THEN p_limite_quantidade_ativo ELSE false END,
    desconto_quantidade_limite = CASE WHEN p_ativo AND p_limite_quantidade_ativo THEN p_quantidade_limite ELSE NULL END,
    desconto_quantidade_utilizada = CASE WHEN p_ativo AND p_iniciar_nova_campanha THEN 0 ELSE desconto_quantidade_utilizada END,
    desconto_campanha_id = CASE WHEN p_ativo THEN v_nova_campanha_id ELSE desconto_campanha_id END,
    desconto_atualizado_em = now(), desconto_atualizado_por = v_actor.ator_id
  WHERE id = p_produto_id RETURNING * INTO v_product;
  v_result := jsonb_build_object(
    'success', true, 'produto_id', v_product.id, 'valor_original', v_product.valor,
    'desconto_tipo', v_product.desconto_tipo, 'desconto_valor', v_product.desconto_valor,
    'desconto_prazo_tipo', v_product.desconto_prazo_tipo, 'desconto_fim_em', v_product.desconto_fim_em,
    'valor_promocional', v_product.valor_promocional, 'desconto_percentual', v_product.desconto_percentual,
    'desconto_ativo', v_product.desconto_ativo,
    'desconto_limite_quantidade_ativo', v_product.desconto_limite_quantidade_ativo,
    'desconto_quantidade_limite', v_product.desconto_quantidade_limite,
    'desconto_quantidade_utilizada', v_product.desconto_quantidade_utilizada,
    'desconto_campanha_id', v_product.desconto_campanha_id
  );
  RETURN v_result;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.gsa_admin_set_product_discount(uuid, text, uuid, boolean, text, numeric, text, timestamptz, boolean, integer, boolean) FROM public, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.gsa_admin_set_product_discount(uuid, text, uuid, boolean, text, numeric, text, timestamptz, boolean, integer, boolean) TO authenticated, service_role;

-- ===========================================================
-- 6. RPC para liberar cota em cancelamento
-- ===========================================================
CREATE OR REPLACE FUNCTION public.gsa_admin_release_discount_quota(
  p_sessao_id uuid, p_session_token text, p_orcamento_id uuid
)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_actor record;
  v_item record;
  v_liberados integer := 0;
BEGIN
  SELECT * INTO v_actor FROM public.gsa_admin_session_actor(p_sessao_id, p_session_token) LIMIT 1;
  FOR v_item IN
    SELECT lpi.produto_id, lpi.desconto_campanha_id, lpi.quantidade_com_desconto
    FROM public.loja_pedido_itens lpi
    WHERE lpi.orcamento_id = p_orcamento_id AND lpi.quantidade_com_desconto > 0 AND lpi.desconto_campanha_id IS NOT NULL
  LOOP
    IF EXISTS (SELECT 1 FROM public.produto_desconto_cota_movimentos WHERE orcamento_id = p_orcamento_id AND produto_id = v_item.produto_id AND tipo_movimento = 'liberacao') THEN
      CONTINUE;
    END IF;
    UPDATE public.produtos SET desconto_quantidade_utilizada = GREATEST(0, desconto_quantidade_utilizada - v_item.quantidade_com_desconto)
    WHERE id = v_item.produto_id AND desconto_campanha_id = v_item.desconto_campanha_id;
    INSERT INTO public.produto_desconto_cota_movimentos(produto_id, desconto_campanha_id, orcamento_id, tipo_movimento, quantidade, metadata)
    VALUES (v_item.produto_id, v_item.desconto_campanha_id, p_orcamento_id, 'liberacao', v_item.quantidade_com_desconto,
      jsonb_build_object('ator_id', v_actor.ator_id, 'ator_tipo', v_actor.ator_tipo, 'motivo', 'cancelamento_orcamento'));
    v_liberados := v_liberados + v_item.quantidade_com_desconto;
  END LOOP;
  RETURN jsonb_build_object('success', true, 'orcamento_id', p_orcamento_id, 'unidades_liberadas', v_liberados);
END;
$$;

REVOKE EXECUTE ON FUNCTION public.gsa_admin_release_discount_quota(uuid, text, uuid) FROM public, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.gsa_admin_release_discount_quota(uuid, text, uuid) TO authenticated, service_role;