-- 1. Add columns
ALTER TABLE public.produtos 
ADD COLUMN IF NOT EXISTS codigo_barras text null,
ADD COLUMN IF NOT EXISTS identificador_preferencial text not null default 'interno',
ADD COLUMN IF NOT EXISTS tipo_codigo_barras text null;

-- 2. Add constraints
ALTER TABLE public.produtos
ADD CONSTRAINT produtos_identificador_preferencial_check 
  CHECK (identificador_preferencial IN ('interno', 'codigo_barras')),
ADD CONSTRAINT produtos_codigo_barras_required_check 
  CHECK (identificador_preferencial = 'interno' OR codigo_barras IS NOT NULL),
ADD CONSTRAINT produtos_codigo_barras_not_empty_check
  CHECK (codigo_barras IS NULL OR codigo_barras <> ''),
ADD CONSTRAINT produtos_codigo_barras_not_zeros_check
  CHECK (codigo_barras IS NULL OR codigo_barras !~ '^0+$'),
ADD CONSTRAINT produtos_codigo_barras_numeric_check
  CHECK (
    tipo_codigo_barras IS NULL 
    OR tipo_codigo_barras = 'OUTRO' 
    OR codigo_barras ~ '^[0-9]+$'
  );

-- 3. Unique Index
CREATE UNIQUE INDEX IF NOT EXISTS produtos_codigo_barras_key 
ON public.produtos (codigo_barras) 
WHERE codigo_barras IS NOT NULL;

-- 4. Function for internal code generation
CREATE OR REPLACE FUNCTION public.gsa_generate_unique_product_code()
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  new_code text;
  is_unique boolean;
  attempts integer := 0;
  max_attempts integer := 100;
BEGIN
  LOOP
    attempts := attempts + 1;
    IF attempts > max_attempts THEN
      RAISE EXCEPTION 'Could not generate a unique product code after % attempts', max_attempts;
    END IF;

    -- Generate PRD-XXXXXXXX (8 digits)
    new_code := 'PRD-' || lpad(floor(random() * 100000000)::text, 8, '0');

    -- Check if it exists
    SELECT NOT EXISTS (
      SELECT 1 FROM public.produtos WHERE codigo_produto = new_code
    ) INTO is_unique;

    EXIT WHEN is_unique;
  END LOOP;
  
  RETURN new_code;
END;
$$;

-- 5. Trigger to set internal code before insert
CREATE OR REPLACE FUNCTION public.gsa_trigger_set_product_code()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.codigo_produto IS NULL OR trim(NEW.codigo_produto) = '' THEN
    NEW.codigo_produto := public.gsa_generate_unique_product_code();
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_gsa_set_product_code ON public.produtos;
CREATE TRIGGER trg_gsa_set_product_code
BEFORE INSERT ON public.produtos
FOR EACH ROW
EXECUTE FUNCTION public.gsa_trigger_set_product_code();

-- 6. RPC to validate barcode uniqueness
CREATE OR REPLACE FUNCTION public.gsa_admin_check_product_barcode(
  p_sessao_id uuid,
  p_session_token text,
  p_codigo_barras text,
  p_produto_id uuid DEFAULT NULL
)
RETURNS TABLE (
  is_duplicate boolean,
  produto_id uuid,
  codigo_produto text,
  nome text,
  status text
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_ator_id uuid;
  v_match RECORD;
BEGIN
  -- Authenticate admin session
  SELECT ator_id INTO v_ator_id
  FROM public.gsa_admin_session_actor(p_sessao_id, p_session_token);

  IF v_ator_id IS NULL THEN
    RAISE EXCEPTION 'Sessão inválida ou expirada.';
  END IF;

  -- Find duplicate ignoring the current product (p_produto_id)
  SELECT p.id, p.codigo_produto, p.nome, p.status 
  INTO v_match
  FROM public.produtos p
  WHERE p.codigo_barras = p_codigo_barras
    AND (p_produto_id IS NULL OR p.id != p_produto_id)
  LIMIT 1;

  IF FOUND THEN
    RETURN QUERY SELECT true, v_match.id, v_match.codigo_produto, v_match.nome, v_match.status;
  ELSE
    RETURN QUERY SELECT false, null::uuid, null::text, null::text, null::text;
  END IF;
END;
$$;
