CREATE OR REPLACE FUNCTION public.gsa_admin_criar_fatura_manual(
  p_sessao_id uuid,
  p_session_token text,
  p_cliente_id uuid,
  p_valor_total numeric,
  p_data_vencimento date,
  p_data_emissao date,
  p_descricao text,
  p_os_id uuid DEFAULT NULL,
  p_ordem_compra_id uuid DEFAULT NULL,
  p_ordem_assinatura_id uuid DEFAULT NULL,
  p_categoria text DEFAULT 'servico'
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_actor record;
  v_valor numeric := round(coalesce(p_valor_total, 0), 2);
  v_descricao text := nullif(trim(coalesce(p_descricao, '')), '');
  v_tipo text;
  v_fatura_id uuid;
  v_codigo text;
BEGIN
  IF p_cliente_id IS NULL THEN RAISE EXCEPTION 'Cliente obrigatorio.'; END IF;
  IF v_valor <= 0 THEN RAISE EXCEPTION 'O valor da fatura deve ser maior que zero.'; END IF;
  IF p_data_vencimento IS NULL OR p_data_emissao IS NULL THEN RAISE EXCEPTION 'Datas de emissao e vencimento sao obrigatorias.'; END IF;
  IF p_os_id IS NULL AND p_ordem_compra_id IS NULL AND p_ordem_assinatura_id IS NULL AND v_descricao IS NULL THEN
    RAISE EXCEPTION 'Informe a descricao para faturas sem vinculo.';
  END IF;

  SELECT * INTO v_actor FROM public.gsa_admin_session_actor(p_sessao_id, p_session_token) LIMIT 1;

  IF NOT EXISTS (SELECT 1 FROM public.clientes WHERE id = p_cliente_id) THEN
    RAISE EXCEPTION 'Cliente nao encontrado.';
  END IF;

  v_tipo := CASE
    WHEN p_os_id IS NOT NULL THEN 'servico'
    WHEN p_ordem_compra_id IS NOT NULL THEN 'produto'
    WHEN p_ordem_assinatura_id IS NOT NULL THEN 'assinatura'
    ELSE coalesce(nullif(trim(p_categoria), ''), 'servico')
  END;

  v_codigo := public.gsa_generate_code('FAT');

  INSERT INTO public.faturas(
    codigo_fatura,
    cliente_id,
    os_id,
    ordem_compra_id,
    ordem_assinatura_id,
    valor_total,
    valor_final_pendente,
    data_vencimento,
    data_emissao,
    status,
    observacoes,
    tipo,
    valor_base_original,
    historico_ajustes,
    itens_faturados
  )
  VALUES (
    v_codigo,
    p_cliente_id,
    p_os_id,
    p_ordem_compra_id,
    p_ordem_assinatura_id,
    v_valor,
    v_valor,
    p_data_vencimento,
    p_data_emissao,
    'pendente',
    v_descricao,
    v_tipo,
    v_valor,
    '[]'::jsonb,
    jsonb_build_array(jsonb_build_object(
      'id', lower(replace(gen_random_uuid()::text, '-', '')),
      'descricao', coalesce(v_descricao, 'Fatura manual'),
      'valor_unitario', v_valor,
      'quantidade', 1,
      'subtotal', v_valor,
      'data_criacao', now()
    ))
  )
  RETURNING id INTO v_fatura_id;

  RETURN jsonb_build_object(
    'success', true,
    'fatura_id', v_fatura_id,
    'codigo_fatura', v_codigo,
    'cliente_id', p_cliente_id,
    'valor_total', v_valor,
    'ator_nome', v_actor.ator_nome
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.gsa_admin_aplicar_ajuste_fatura(
  p_sessao_id uuid,
  p_session_token text,
  p_fatura_id uuid,
  p_desconto numeric,
  p_acrescimo numeric,
  p_motivo text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_actor record;
  v_fat faturas%rowtype;
  v_desconto numeric := round(coalesce(p_desconto, 0), 2);
  v_acrescimo numeric := round(coalesce(p_acrescimo, 0), 2);
  v_motivo text := nullif(trim(coalesce(p_motivo, '')), '');
  v_base numeric;
  v_novo_total numeric;
  v_historico jsonb;
BEGIN
  IF v_motivo IS NULL THEN RAISE EXCEPTION 'Informe o motivo do ajuste.'; END IF;
  IF v_desconto < 0 OR v_acrescimo < 0 THEN RAISE EXCEPTION 'Os valores nao podem ser negativos.'; END IF;

  SELECT * INTO v_actor FROM public.gsa_admin_session_actor(p_sessao_id, p_session_token) LIMIT 1;

  SELECT * INTO v_fat
  FROM public.faturas
  WHERE id = p_fatura_id
  FOR UPDATE;

  IF NOT FOUND THEN RAISE EXCEPTION 'Fatura nao encontrada.'; END IF;

  v_base := CASE
    WHEN coalesce(v_fat.valor_base_original, 0) > 0 THEN v_fat.valor_base_original
    ELSE coalesce(v_fat.valor_total, 0) - coalesce(v_fat.acrescimo_manual, 0) + coalesce(v_fat.desconto_manual, 0)
  END;

  v_novo_total := greatest(0, v_base + v_acrescimo - v_desconto);

  v_historico := coalesce(v_fat.historico_ajustes, '[]'::jsonb) || jsonb_build_array(jsonb_build_object(
    'data', now(),
    'motivo', v_motivo,
    'desconto_anterior', coalesce(v_fat.desconto_manual, 0),
    'acrescimo_anterior', coalesce(v_fat.acrescimo_manual, 0),
    'desconto_novo', v_desconto,
    'acrescimo_novo', v_acrescimo,
    'valor_anterior', coalesce(v_fat.valor_total, 0),
    'valor_novo', v_novo_total,
    'ator_nome', v_actor.ator_nome
  ));

  UPDATE public.faturas
     SET valor_total = v_novo_total,
         valor_final_pendente = CASE
           WHEN coalesce(valor_pago, 0) > 0 THEN greatest(0, v_novo_total - coalesce(valor_pago, 0))
           ELSE v_novo_total
         END,
         desconto_manual = v_desconto,
         acrescimo_manual = v_acrescimo,
         valor_base_original = v_base,
         historico_ajustes = v_historico
   WHERE id = p_fatura_id;

  RETURN jsonb_build_object(
    'success', true,
    'fatura_id', p_fatura_id,
    'cliente_id', v_fat.cliente_id,
    'codigo_fatura', v_fat.codigo_fatura,
    'valor_base_original', v_base,
    'valor_total', v_novo_total,
    'desconto_manual', v_desconto,
    'acrescimo_manual', v_acrescimo,
    'historico_ajustes', v_historico
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.gsa_admin_criar_fatura_manual(uuid, text, uuid, numeric, date, date, text, uuid, uuid, uuid, text) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.gsa_admin_aplicar_ajuste_fatura(uuid, text, uuid, numeric, numeric, text) TO anon, authenticated;
