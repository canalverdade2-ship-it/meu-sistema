-- Fix product catalog trigger execution order and defensive calculation of promo price.
-- Problem: trg_gsa_validate_product_catalog_row was running BEFORE trg_produtos_discount_calc,
-- causing NEW.valor_promocional to be NULL when validating discount_ativo=true, throwing 400 Bad Request / 22023 "Preço promocional inválido."

CREATE OR REPLACE FUNCTION public.gsa_validate_product_catalog_row()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO public, pg_temp
AS $$
BEGIN
  IF NEW.status NOT IN ('ativo', 'inativo') THEN
    RAISE EXCEPTION 'Status de produto inválido.' USING ERRCODE = '22023';
  END IF;
  IF NEW.tipo_cliente NOT IN ('pf', 'pj', 'ambos') THEN
    RAISE EXCEPTION 'Tipo de cliente do produto inválido.' USING ERRCODE = '22023';
  END IF;
  IF COALESCE(NEW.valor, 0) <= 0
     OR COALESCE(NEW.valor_custo, 0) < 0
     OR COALESCE(NEW.porcentagem_lucro, 0) < 0
     OR COALESCE(NEW.estoque_disponivel, 0) < 0 THEN
    RAISE EXCEPTION 'Valores ou estoque do produto são inválidos.' USING ERRCODE = '22023';
  END IF;
  IF NEW.identificador_preferencial IS NOT NULL
     AND NEW.identificador_preferencial NOT IN ('interno', 'codigo_barras') THEN
    RAISE EXCEPTION 'Identificador preferencial inválido.' USING ERRCODE = '22023';
  END IF;

  IF COALESCE(NEW.desconto_ativo, false) THEN
    IF NEW.valor_promocional IS NULL THEN
      NEW.valor_promocional := public.gsa_calculate_product_effective_price(
        NEW.valor, NEW.desconto_ativo, NEW.desconto_tipo, NEW.desconto_valor,
        NEW.desconto_prazo_tipo, NEW.desconto_fim_em
      );
      NEW.desconto_percentual := public.gsa_calculate_product_discount_percentage(NEW.valor, NEW.valor_promocional);
    END IF;

    IF NEW.valor_promocional IS NULL
       OR NEW.valor_promocional <= 0
       OR NEW.valor_promocional >= NEW.valor THEN
      RAISE EXCEPTION 'Preço promocional inválido.' USING ERRCODE = '22023';
    END IF;
  END IF;

  IF COALESCE(NEW.desconto_limite_quantidade_ativo, false)
     AND COALESCE(NEW.desconto_quantidade_limite, 0) <= 0 THEN
    RAISE EXCEPTION 'A quantidade promocional deve ser maior que zero.' USING ERRCODE = '22023';
  END IF;
  IF NEW.status = 'inativo' THEN
    NEW.visivel_na_loja := false;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_produtos_discount_calc ON public.produtos;
DROP TRIGGER IF EXISTS trg_a_produtos_discount_calc ON public.produtos;

CREATE TRIGGER trg_a_produtos_discount_calc
BEFORE INSERT OR UPDATE OF valor, desconto_ativo, desconto_tipo, desconto_valor,
    desconto_prazo_tipo, desconto_fim_em, desconto_limite_quantidade_ativo, desconto_quantidade_limite
ON public.produtos
FOR EACH ROW EXECUTE FUNCTION public.gsa_trg_produtos_discount_calc();
