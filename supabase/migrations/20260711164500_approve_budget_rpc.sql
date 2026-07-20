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
BEGIN
  SELECT * INTO v_orc FROM orcamentos WHERE id = p_orcamento_id AND cliente_id = p_cliente_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Orçamento não encontrado.'; END IF;

  IF v_orc.status = 'aprovado' THEN
    SELECT id INTO v_os_id FROM ordens_servico WHERE orcamento_id = p_orcamento_id LIMIT 1;
    SELECT id INTO v_oc_id FROM ordens_compra WHERE orcamento_id = p_orcamento_id LIMIT 1;
    SELECT id INTO v_oa_id FROM ordens_assinatura WHERE orcamento_id = p_orcamento_id LIMIT 1;
    SELECT id INTO v_fatura_id FROM faturas WHERE ordem_compra_id = v_oc_id OR ordem_assinatura_id = v_oa_id LIMIT 1;
    RETURN jsonb_build_object('success', true, 'already_approved', true, 'os_id', v_os_id, 'ordem_compra_id', v_oc_id, 'ordem_assinatura_id', v_oa_id, 'fatura_id', v_fatura_id);
  END IF;

  IF v_orc.status NOT IN ('aberto', 'em revisão') THEN
    RAISE EXCEPTION 'Este orçamento já foi alterado e não pode ser aprovado.';
  END IF;

  UPDATE orcamentos SET status = 'aprovado' WHERE id = p_orcamento_id;

  IF v_orc.categoria = 'servico' OR v_orc.servico_id IS NOT NULL THEN
    v_tipo := 'servico';
    SELECT id INTO v_os_id FROM ordens_servico WHERE orcamento_id = p_orcamento_id LIMIT 1;
    IF v_os_id IS NULL THEN
      INSERT INTO ordens_servico(codigo_os, orcamento_id, cliente_id, status, data_inicio)
      VALUES (public.gsa_generate_code('OS'), p_orcamento_id, p_cliente_id, 'andamento', now())
      RETURNING id INTO v_os_id;

      INSERT INTO prestador_demandas(titulo, descricao, os_id, status, codigo_demanda, arquivos_briefing)
      VALUES ('Serviço: ' || coalesce(v_orc.titulo_solicitacao, 'Não especificado'), 'Demanda gerada automaticamente para a OS', v_os_id, 'aberta', public.gsa_generate_code('DEM'), coalesce(v_orc.anexos, '[]'::jsonb))
      RETURNING id INTO v_demanda_id;
    END IF;

  ELSIF v_orc.categoria = 'produto' OR v_orc.produto_id IS NOT NULL THEN
    v_tipo := 'produto';
    IF v_orc.produto_id IS NULL THEN RAISE EXCEPTION 'Produto não informado no orçamento.'; END IF;

    SELECT id INTO v_oc_id FROM ordens_compra WHERE orcamento_id = p_orcamento_id LIMIT 1;
    IF v_oc_id IS NULL THEN
      INSERT INTO ordens_compra(codigo_ordem, produto_id, cliente_id, status, quantidade, orcamento_id)
      VALUES (public.gsa_generate_code('OC'), v_orc.produto_id, p_cliente_id, 'em_analise', coalesce(v_orc.quantidade, 1), p_orcamento_id)
      RETURNING id INTO v_oc_id;
    END IF;

    SELECT id INTO v_fatura_id FROM faturas WHERE ordem_compra_id = v_oc_id LIMIT 1;
    IF v_fatura_id IS NULL THEN
      INSERT INTO faturas(codigo_fatura, ordem_compra_id, cliente_id, valor_total, valor_final_pendente, status, tipo, data_vencimento)
      VALUES (public.gsa_generate_code('FAT'), v_oc_id, p_cliente_id, v_orc.total, v_orc.total, 'pendente', 'produto', current_date + 7)
      RETURNING id INTO v_fatura_id;
    END IF;

  ELSIF v_orc.categoria = 'assinatura' OR v_orc.assinatura_id IS NOT NULL THEN
    v_tipo := 'assinatura';
    IF v_orc.assinatura_id IS NULL THEN RAISE EXCEPTION 'Assinatura não informada no orçamento.'; END IF;

    SELECT id INTO v_oa_id FROM ordens_assinatura WHERE orcamento_id = p_orcamento_id LIMIT 1;
    IF v_oa_id IS NULL THEN
      INSERT INTO ordens_assinatura(codigo_ordem, assinatura_id, cliente_id, status, quantidade, prazo_meses, renovacao_automatica, orcamento_id)
      VALUES (public.gsa_generate_code('OA'), v_orc.assinatura_id, p_cliente_id, 'em_analise', coalesce(v_orc.quantidade, 1), v_orc.quantidade_meses, true, p_orcamento_id)
      RETURNING id INTO v_oa_id;
    END IF;

    SELECT id INTO v_fatura_id FROM faturas WHERE ordem_assinatura_id = v_oa_id LIMIT 1;
    IF v_fatura_id IS NULL THEN
      INSERT INTO faturas(codigo_fatura, ordem_assinatura_id, cliente_id, valor_total, valor_final_pendente, status, tipo, data_vencimento)
      VALUES (public.gsa_generate_code('FAT'), v_oa_id, p_cliente_id, v_orc.total, v_orc.total, 'pendente', 'assinatura', current_date + 7)
      RETURNING id INTO v_fatura_id;
    END IF;
  ELSE
    RAISE EXCEPTION 'Categoria do orçamento não reconhecida.';
  END IF;

  RETURN jsonb_build_object(
    'success', true,
    'already_approved', false,
    'tipo', v_tipo,
    'os_id', v_os_id,
    'ordem_compra_id', v_oc_id,
    'ordem_assinatura_id', v_oa_id,
    'fatura_id', v_fatura_id,
    'demanda_id', v_demanda_id
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.aprovar_orcamento_cliente(uuid, uuid) TO anon, authenticated;
