CREATE OR REPLACE FUNCTION public.aprovar_orcamento_cliente(p_orcamento_id uuid, p_cliente_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_orc orcamentos%rowtype;
  v_os_id uuid;
  v_oc_id uuid;
  v_oa_id uuid;
  v_fatura_id uuid;
  v_demanda_id uuid;
  v_tipo text;
  v_total_aprovado numeric;
  v_desconto_adicional numeric := 0;
BEGIN
  SELECT * INTO v_orc FROM orcamentos WHERE id = p_orcamento_id AND cliente_id = p_cliente_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Orcamento nao encontrado.'; END IF;

  IF v_orc.status = 'aprovado' THEN
    SELECT id INTO v_os_id FROM ordens_servico WHERE orcamento_id = p_orcamento_id LIMIT 1;
    SELECT id INTO v_oc_id FROM ordens_compra WHERE orcamento_id = p_orcamento_id LIMIT 1;
    SELECT id INTO v_oa_id FROM ordens_assinatura WHERE orcamento_id = p_orcamento_id LIMIT 1;
    SELECT id INTO v_fatura_id FROM faturas WHERE ordem_compra_id = v_oc_id OR ordem_assinatura_id = v_oa_id LIMIT 1;
    RETURN jsonb_build_object('success', true, 'already_approved', true, 'os_id', v_os_id, 'ordem_compra_id', v_oc_id, 'ordem_assinatura_id', v_oa_id, 'fatura_id', v_fatura_id);
  END IF;

  IF v_orc.status NOT IN ('aberto', 'em revisao', 'em revisão', 'negociacao', 'negociação') THEN
    RAISE EXCEPTION 'Este orcamento ja foi alterado e nao pode ser aprovado.';
  END IF;

  v_total_aprovado := round(coalesce(v_orc.total, 0), 2);
  IF v_orc.status IN ('negociacao', 'negociação') AND coalesce(v_orc.proposta_admin_porcentagem, 0) > 0 THEN
    v_total_aprovado := round(coalesce(v_orc.total, 0) * (1 - coalesce(v_orc.proposta_admin_porcentagem, 0) / 100), 2);
    v_desconto_adicional := round(coalesce(v_orc.total, 0) - v_total_aprovado, 2);
  END IF;

  UPDATE orcamentos
  SET status = 'aprovado',
      total = v_total_aprovado,
      desconto = coalesce(desconto, 0) + v_desconto_adicional
  WHERE id = p_orcamento_id;

  IF v_orc.promocao_id IS NOT NULL THEN
    UPDATE promocoes SET status = 'usada' WHERE id = v_orc.promocao_id;
    UPDATE cliente_promocoes SET status = 'usada' WHERE promocao_id = v_orc.promocao_id AND cliente_id = p_cliente_id;
  END IF;

  IF v_orc.categoria = 'servico' OR v_orc.servico_id IS NOT NULL THEN
    v_tipo := 'servico';
    SELECT id INTO v_os_id FROM ordens_servico WHERE orcamento_id = p_orcamento_id LIMIT 1;
    IF v_os_id IS NULL THEN
      INSERT INTO ordens_servico(codigo_os, orcamento_id, cliente_id, status, data_inicio)
      VALUES (public.gsa_generate_code('OS'), p_orcamento_id, p_cliente_id, 'andamento', current_date)
      RETURNING id INTO v_os_id;

      INSERT INTO prestador_demandas(titulo, descricao, os_id, status, codigo_demanda, arquivos_briefing)
      VALUES ('Servico: ' || coalesce(v_orc.titulo_solicitacao, 'Nao especificado'), 'Demanda gerada automaticamente para a OS', v_os_id, 'aberta', public.gsa_generate_code('DEM'), coalesce(v_orc.anexos, '[]'::jsonb))
      RETURNING id INTO v_demanda_id;
    END IF;

  ELSIF v_orc.categoria = 'produto' OR v_orc.produto_id IS NOT NULL THEN
    v_tipo := 'produto';
    IF v_orc.produto_id IS NULL THEN RAISE EXCEPTION 'Produto nao informado no orcamento.'; END IF;

    SELECT id INTO v_oc_id FROM ordens_compra WHERE orcamento_id = p_orcamento_id LIMIT 1;
    IF v_oc_id IS NULL THEN
      INSERT INTO ordens_compra(codigo_ordem, produto_id, cliente_id, status, quantidade, orcamento_id)
      VALUES (public.gsa_generate_code('OC'), v_orc.produto_id, p_cliente_id, 'em_analise', coalesce(v_orc.quantidade, 1), p_orcamento_id)
      RETURNING id INTO v_oc_id;
    END IF;

    SELECT id INTO v_fatura_id FROM faturas WHERE ordem_compra_id = v_oc_id LIMIT 1;
    IF v_fatura_id IS NULL THEN
      INSERT INTO faturas(codigo_fatura, ordem_compra_id, cliente_id, valor_total, valor_final_pendente, status, tipo, data_vencimento)
      VALUES (public.gsa_generate_code('FAT'), v_oc_id, p_cliente_id, v_total_aprovado, v_total_aprovado, 'pendente', 'produto', current_date + 7)
      RETURNING id INTO v_fatura_id;
    END IF;

  ELSIF v_orc.categoria = 'assinatura' OR v_orc.assinatura_id IS NOT NULL THEN
    v_tipo := 'assinatura';
    IF v_orc.assinatura_id IS NULL THEN RAISE EXCEPTION 'Assinatura nao informada no orcamento.'; END IF;

    SELECT id INTO v_oa_id FROM ordens_assinatura WHERE orcamento_id = p_orcamento_id LIMIT 1;
    IF v_oa_id IS NULL THEN
      INSERT INTO ordens_assinatura(codigo_ordem, assinatura_id, cliente_id, status, quantidade, prazo_meses, renovacao_automatica, orcamento_id)
      VALUES (public.gsa_generate_code('OA'), v_orc.assinatura_id, p_cliente_id, 'em_analise', coalesce(v_orc.quantidade, 1), v_orc.quantidade_meses, true, p_orcamento_id)
      RETURNING id INTO v_oa_id;
    END IF;

    SELECT id INTO v_fatura_id FROM faturas WHERE ordem_assinatura_id = v_oa_id LIMIT 1;
    IF v_fatura_id IS NULL THEN
      INSERT INTO faturas(codigo_fatura, ordem_assinatura_id, cliente_id, valor_total, valor_final_pendente, status, tipo, data_vencimento)
      VALUES (public.gsa_generate_code('FAT'), v_oa_id, p_cliente_id, v_total_aprovado, v_total_aprovado, 'pendente', 'assinatura', current_date + 7)
      RETURNING id INTO v_fatura_id;
    END IF;
  ELSE
    RAISE EXCEPTION 'Categoria do orcamento nao reconhecida.';
  END IF;

  RETURN jsonb_build_object(
    'success', true,
    'already_approved', false,
    'tipo', v_tipo,
    'os_id', v_os_id,
    'ordem_compra_id', v_oc_id,
    'ordem_assinatura_id', v_oa_id,
    'fatura_id', v_fatura_id,
    'demanda_id', v_demanda_id,
    'total_aprovado', v_total_aprovado
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.aprovar_orcamento_cliente(uuid, uuid) TO anon, authenticated;
