-- Reenvio de produtos apos ajuste e notificacoes persistentes.

BEGIN;

CREATE OR REPLACE FUNCTION public.gsa_supplier_request_product(p_payload jsonb)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_id uuid := public.gsa_assert_current_supplier();
  v_payload jsonb := coalesce(p_payload, '{}'::jsonb);
  v_type text := lower(trim(coalesce(v_payload->>'tipo', '')));
  v_product_id uuid;
  v_request_id uuid;
  v_existing_request public.fornecedor_produto_solicitacoes%rowtype;
  v_cost numeric;
  v_minimum integer;
  v_lead integer;
  v_resubmitted boolean := false;
BEGIN
  IF pg_column_size(v_payload) > 32768 THEN RAISE EXCEPTION 'Dados excedem o limite permitido.'; END IF;
  IF v_type NOT IN ('existente', 'novo') THEN RAISE EXCEPTION 'Tipo de solicitacao invalido.'; END IF;
  v_cost := coalesce(nullif(v_payload->>'custo_unitario', '')::numeric, 0);
  v_minimum := greatest(1, coalesce(nullif(v_payload->>'quantidade_minima', '')::integer, 1));
  v_lead := greatest(0, coalesce(nullif(v_payload->>'prazo_entrega_dias', '')::integer, 0));
  IF v_cost < 0 THEN RAISE EXCEPTION 'Custo unitario invalido.'; END IF;

  IF nullif(v_payload->>'request_id', '') IS NOT NULL THEN
    SELECT * INTO v_existing_request
    FROM public.fornecedor_produto_solicitacoes
    WHERE id = (v_payload->>'request_id')::uuid AND fornecedor_id = v_id
    FOR UPDATE;
    IF NOT FOUND THEN RAISE EXCEPTION 'Solicitacao de produto nao encontrada.'; END IF;
    IF v_existing_request.status <> 'ajuste_solicitado' THEN RAISE EXCEPTION 'Somente solicitacoes com ajuste solicitado podem ser reenviadas.'; END IF;
    IF v_existing_request.tipo <> v_type THEN RAISE EXCEPTION 'O tipo da solicitacao nao pode ser alterado.'; END IF;
    v_request_id := v_existing_request.id;
    v_product_id := v_existing_request.produto_id;
    v_resubmitted := true;
  ELSIF v_type = 'existente' THEN
    v_product_id := nullif(v_payload->>'produto_id', '')::uuid;
  END IF;

  IF v_type = 'existente' THEN
    IF v_product_id IS NULL OR NOT EXISTS (SELECT 1 FROM public.produtos WHERE id = v_product_id AND status = 'ativo') THEN
      RAISE EXCEPTION 'Produto nao encontrado ou inativo.';
    END IF;
    IF EXISTS (SELECT 1 FROM public.fornecedor_produtos WHERE fornecedor_id = v_id AND produto_id = v_product_id) THEN
      RAISE EXCEPTION 'Este produto ja esta vinculado ao fornecedor.';
    END IF;
  ELSE
    IF length(trim(coalesce(v_payload->>'nome', ''))) < 3 THEN RAISE EXCEPTION 'Informe o nome do novo produto.'; END IF;
  END IF;

  IF v_resubmitted THEN
    UPDATE public.fornecedor_produto_solicitacoes
    SET nome = CASE WHEN v_type = 'novo' THEN nullif(trim(v_payload->>'nome'), '') ELSE nome END,
        descricao = CASE WHEN v_type = 'novo' THEN nullif(trim(v_payload->>'descricao'), '') ELSE descricao END,
        categoria_id = CASE WHEN v_type = 'novo' THEN nullif(v_payload->>'categoria_id', '')::uuid ELSE categoria_id END,
        codigo_barras = CASE WHEN v_type = 'novo' THEN nullif(regexp_replace(coalesce(v_payload->>'codigo_barras', ''), '\D', '', 'g'), '') ELSE codigo_barras END,
        imagem_url = CASE WHEN v_type = 'novo' THEN nullif(trim(v_payload->>'imagem_url'), '') ELSE imagem_url END,
        custo_unitario = v_cost,
        quantidade_minima = v_minimum,
        prazo_entrega_dias = v_lead,
        observacoes = nullif(trim(v_payload->>'observacoes'), ''),
        status = 'pendente',
        motivo_analise = NULL,
        analisado_em = NULL,
        analisado_por = NULL,
        updated_at = now()
    WHERE id = v_request_id;
  ELSE
    INSERT INTO public.fornecedor_produto_solicitacoes(
      fornecedor_id, produto_id, tipo, nome, descricao, categoria_id, codigo_barras,
      imagem_url, custo_unitario, quantidade_minima, prazo_entrega_dias, observacoes
    ) VALUES (
      v_id, v_product_id, v_type, nullif(trim(v_payload->>'nome'), ''),
      nullif(trim(v_payload->>'descricao'), ''), nullif(v_payload->>'categoria_id', '')::uuid,
      nullif(regexp_replace(coalesce(v_payload->>'codigo_barras', ''), '\D', '', 'g'), ''),
      nullif(trim(v_payload->>'imagem_url'), ''), v_cost, v_minimum, v_lead,
      nullif(trim(v_payload->>'observacoes'), '')
    ) RETURNING id INTO v_request_id;
  END IF;

  INSERT INTO public.fornecedor_auditoria(fornecedor_id, ator_tipo, ator_id, acao, entidade, entidade_id, detalhes)
  VALUES (
    v_id, 'fornecedor', v_id,
    CASE WHEN v_resubmitted THEN 'REENVIAR_SOLICITACAO_PRODUTO' ELSE 'SOLICITAR_PRODUTO' END,
    'fornecedor_produto_solicitacoes', v_request_id,
    jsonb_build_object('tipo', v_type, 'reenviado', v_resubmitted)
  );

  INSERT INTO public.notificacoes(titulo, mensagem, modulo, tab, item_id, tipo, destinatario_tipo, prioridade, acao_origem, contexto)
  VALUES (
    CASE WHEN v_resubmitted THEN 'Fornecedor reenviou produto para analise' ELSE 'Nova solicitacao de produto de fornecedor' END,
    CASE WHEN v_resubmitted THEN 'Uma solicitacao corrigida aguarda nova analise.' ELSE 'Um fornecedor enviou uma solicitacao de produto.' END,
    'fornecedores', 'produtos', v_request_id::text, 'sistema', 'admin', 'alta',
    CASE WHEN v_resubmitted THEN 'produto_fornecedor_reenviado' ELSE 'produto_fornecedor_solicitado' END,
    jsonb_build_object('fornecedor_id', v_id, 'request_id', v_request_id)
  );

  RETURN jsonb_build_object('success', true, 'request_id', v_request_id, 'resubmitted', v_resubmitted);
END;
$$;

CREATE OR REPLACE FUNCTION public.gsa_supplier_mark_notification_read(p_notification_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_id uuid := public.gsa_assert_current_supplier();
BEGIN
  UPDATE public.fornecedor_notificacoes
  SET lida = true
  WHERE id = p_notification_id AND fornecedor_id = v_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Notificacao nao encontrada.'; END IF;
  RETURN jsonb_build_object('success', true);
END;
$$;

REVOKE ALL ON FUNCTION public.gsa_supplier_mark_notification_read(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.gsa_supplier_mark_notification_read(uuid) TO authenticated;

COMMIT;
