BEGIN;

-- Garante que as três configurações obrigatórias sempre existam.
INSERT INTO public.gsa_calculator_pro_products (
  tool_id,
  nome,
  ativo,
  preco_centavos,
  duracao_acesso_minutos,
  liberar_cliente_com_fatura_paga
) VALUES
  ('termination', 'Rescisão trabalhista Pro', true, 990, 1440, true),
  ('retirement', 'Aposentadoria INSS Pro', true, 990, 1440, true),
  ('vacation', 'Cálculo de férias Pro', true, 990, 1440, true)
ON CONFLICT (tool_id) DO NOTHING;

CREATE OR REPLACE FUNCTION public.gsa_admin_ensure_calculator_pro_products(
  p_sessao_id uuid,
  p_session_token text
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_products jsonb;
BEGIN
  PERFORM public.gsa_admin_validate_context(p_sessao_id, p_session_token);

  INSERT INTO public.gsa_calculator_pro_products (
    tool_id,
    nome,
    ativo,
    preco_centavos,
    duracao_acesso_minutos,
    liberar_cliente_com_fatura_paga
  ) VALUES
    ('termination', 'Rescisão trabalhista Pro', true, 990, 1440, true),
    ('retirement', 'Aposentadoria INSS Pro', true, 990, 1440, true),
    ('vacation', 'Cálculo de férias Pro', true, 990, 1440, true)
  ON CONFLICT (tool_id) DO NOTHING;

  SELECT COALESCE(jsonb_agg(to_jsonb(product) ORDER BY product.tool_id), '[]'::jsonb)
    INTO v_products
    FROM public.gsa_calculator_pro_products product
   WHERE product.tool_id IN ('termination', 'retirement', 'vacation');

  RETURN jsonb_build_object(
    'success', jsonb_array_length(v_products) = 3,
    'products', v_products,
    'count', jsonb_array_length(v_products)
  );
END;
$$;

REVOKE ALL ON FUNCTION public.gsa_admin_ensure_calculator_pro_products(uuid,text)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.gsa_admin_ensure_calculator_pro_products(uuid,text)
  TO authenticated;

-- Salvar também passa a criar a linha quando ela estiver ausente.
CREATE OR REPLACE FUNCTION public.gsa_admin_save_calculator_pro_product(
  p_sessao_id uuid,
  p_session_token text,
  p_tool_id text,
  p_payload jsonb
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_result jsonb;
  v_inicio timestamptz;
  v_fim timestamptz;
  v_nome text;
BEGIN
  PERFORM public.gsa_admin_validate_context(p_sessao_id, p_session_token);

  IF p_tool_id NOT IN ('termination','retirement','vacation') THEN
    RAISE EXCEPTION 'Calculadora inválida' USING ERRCODE = '22023';
  END IF;

  v_inicio := nullif(p_payload->>'gratuito_inicio','')::timestamptz;
  v_fim := nullif(p_payload->>'gratuito_fim','')::timestamptz;

  IF v_inicio IS NOT NULL AND v_fim IS NOT NULL AND v_fim <= v_inicio THEN
    RAISE EXCEPTION 'O término da promoção precisa ser posterior ao início' USING ERRCODE = '22023';
  END IF;

  v_nome := CASE p_tool_id
    WHEN 'termination' THEN 'Rescisão trabalhista Pro'
    WHEN 'retirement' THEN 'Aposentadoria INSS Pro'
    ELSE 'Cálculo de férias Pro'
  END;

  INSERT INTO public.gsa_calculator_pro_products (
    tool_id,
    nome,
    ativo,
    preco_centavos,
    duracao_acesso_minutos,
    liberar_cliente_com_fatura_paga,
    gratuito_inicio,
    gratuito_fim
  ) VALUES (
    p_tool_id,
    v_nome,
    COALESCE((p_payload->>'ativo')::boolean, true),
    GREATEST(0, COALESCE((p_payload->>'preco_centavos')::integer, 990)),
    LEAST(525600, GREATEST(15, COALESCE((p_payload->>'duracao_acesso_minutos')::integer, 1440))),
    true,
    v_inicio,
    v_fim
  )
  ON CONFLICT (tool_id) DO UPDATE
    SET ativo = EXCLUDED.ativo,
        preco_centavos = EXCLUDED.preco_centavos,
        duracao_acesso_minutos = EXCLUDED.duracao_acesso_minutos,
        liberar_cliente_com_fatura_paga = true,
        gratuito_inicio = EXCLUDED.gratuito_inicio,
        gratuito_fim = EXCLUDED.gratuito_fim
  RETURNING to_jsonb(gsa_calculator_pro_products.*) INTO v_result;

  RETURN v_result;
END;
$$;

REVOKE ALL ON FUNCTION public.gsa_admin_save_calculator_pro_product(uuid,text,text,jsonb)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.gsa_admin_save_calculator_pro_product(uuid,text,text,jsonb)
  TO authenticated;

COMMIT;
