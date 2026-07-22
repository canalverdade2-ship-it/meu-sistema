-- Operacoes seguras do portal e da administracao de fornecedores.

BEGIN;

CREATE OR REPLACE FUNCTION public.gsa_supplier_dashboard_snapshot()
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_id uuid := public.gsa_assert_current_supplier();
BEGIN
  RETURN jsonb_build_object(
    'supplier', (SELECT to_jsonb(f) - 'pin_hash' - 'pin_tentativas' - 'pin_bloqueado' FROM public.fornecedores f WHERE f.id = v_id),
    'products', COALESCE((
      SELECT jsonb_agg(to_jsonb(x) ORDER BY x.produto_nome)
      FROM (
        SELECT fp.id, fp.produto_id, fp.codigo_fornecedor, fp.custo_unitario,
               fp.quantidade_minima, fp.prazo_entrega_dias, fp.status,
               p.nome AS produto_nome, p.codigo_produto, p.codigo_barras,
               p.estoque_disponivel, p.status AS produto_status
        FROM public.fornecedor_produtos fp
        JOIN public.produtos p ON p.id = fp.produto_id
        WHERE fp.fornecedor_id = v_id
      ) x
    ), '[]'::jsonb),
    'catalog', COALESCE((
      SELECT jsonb_agg(to_jsonb(x) ORDER BY x.nome)
      FROM (
        SELECT p.id, p.nome, p.codigo_produto, p.codigo_barras, p.estoque_disponivel
        FROM public.produtos p
        WHERE p.status = 'ativo'
          AND NOT EXISTS (SELECT 1 FROM public.fornecedor_produtos fp WHERE fp.fornecedor_id = v_id AND fp.produto_id = p.id)
          AND NOT EXISTS (
            SELECT 1 FROM public.fornecedor_produto_solicitacoes s
            WHERE s.fornecedor_id = v_id AND s.produto_id = p.id
              AND s.status IN ('pendente', 'em_analise', 'ajuste_solicitado')
          )
        ORDER BY p.nome LIMIT 500
      ) x
    ), '[]'::jsonb),
    'requests', COALESCE((
      SELECT jsonb_agg(to_jsonb(s) ORDER BY s.created_at DESC)
      FROM public.fornecedor_produto_solicitacoes s WHERE s.fornecedor_id = v_id
    ), '[]'::jsonb),
    'orders', COALESCE((
      SELECT jsonb_agg(to_jsonb(x) ORDER BY x.created_at DESC)
      FROM (
        SELECT o.*,
          (SELECT jsonb_agg(to_jsonb(i) ORDER BY i.produto_nome_snapshot)
           FROM public.pedido_compra_fornecedor_itens i WHERE i.pedido_id = o.id) AS items
        FROM public.pedidos_compra_fornecedor o WHERE o.fornecedor_id = v_id
      ) x
    ), '[]'::jsonb),
    'deliveries', COALESCE((
      SELECT jsonb_agg(to_jsonb(x) ORDER BY x.created_at DESC)
      FROM (
        SELECT e.*,
          (SELECT jsonb_agg(to_jsonb(i) ORDER BY i.created_at)
           FROM public.fornecedor_entrega_itens i WHERE i.entrega_id = e.id) AS items
        FROM public.fornecedor_entregas e WHERE e.fornecedor_id = v_id
      ) x
    ), '[]'::jsonb),
    'payables', COALESCE((
      SELECT jsonb_agg(to_jsonb(c) ORDER BY c.data_vencimento DESC)
      FROM public.contas_pagar c WHERE c.fornecedor_id = v_id
    ), '[]'::jsonb),
    'notifications', COALESCE((
      SELECT jsonb_agg(to_jsonb(n) ORDER BY n.created_at DESC)
      FROM (SELECT * FROM public.fornecedor_notificacoes WHERE fornecedor_id = v_id ORDER BY created_at DESC LIMIT 50) n
    ), '[]'::jsonb)
  );
END;
$$;

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
  v_cost numeric;
  v_minimum integer;
  v_lead integer;
BEGIN
  IF pg_column_size(v_payload) > 32768 THEN RAISE EXCEPTION 'Dados excedem o limite permitido.'; END IF;
  IF v_type NOT IN ('existente', 'novo') THEN RAISE EXCEPTION 'Tipo de solicitacao invalido.'; END IF;
  v_cost := coalesce(nullif(v_payload->>'custo_unitario', '')::numeric, 0);
  v_minimum := greatest(1, coalesce(nullif(v_payload->>'quantidade_minima', '')::integer, 1));
  v_lead := greatest(0, coalesce(nullif(v_payload->>'prazo_entrega_dias', '')::integer, 0));
  IF v_cost < 0 THEN RAISE EXCEPTION 'Custo unitario invalido.'; END IF;

  IF v_type = 'existente' THEN
    v_product_id := (v_payload->>'produto_id')::uuid;
    IF NOT EXISTS (SELECT 1 FROM public.produtos WHERE id = v_product_id AND status = 'ativo') THEN
      RAISE EXCEPTION 'Produto nao encontrado ou inativo.';
    END IF;
    IF EXISTS (SELECT 1 FROM public.fornecedor_produtos WHERE fornecedor_id = v_id AND produto_id = v_product_id) THEN
      RAISE EXCEPTION 'Este produto ja esta vinculado ao fornecedor.';
    END IF;
  ELSE
    IF length(trim(coalesce(v_payload->>'nome', ''))) < 3 THEN RAISE EXCEPTION 'Informe o nome do novo produto.'; END IF;
  END IF;

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

  INSERT INTO public.fornecedor_auditoria(fornecedor_id, ator_tipo, ator_id, acao, entidade, entidade_id, detalhes)
  VALUES (v_id, 'fornecedor', v_id, 'SOLICITAR_PRODUTO', 'fornecedor_produto_solicitacoes', v_request_id, jsonb_build_object('tipo', v_type));
  RETURN jsonb_build_object('success', true, 'request_id', v_request_id);
END;
$$;

CREATE OR REPLACE FUNCTION public.gsa_supplier_mark_order_seen(p_order_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_id uuid := public.gsa_assert_current_supplier();
BEGIN
  UPDATE public.pedidos_compra_fornecedor
  SET status = CASE WHEN status = 'enviado' THEN 'visualizado' ELSE status END,
      visualizado_em = coalesce(visualizado_em, now())
  WHERE id = p_order_id AND fornecedor_id = v_id AND status <> 'cancelado';
  IF NOT FOUND THEN RAISE EXCEPTION 'Pedido nao encontrado.'; END IF;
  RETURN jsonb_build_object('success', true);
END;
$$;

CREATE OR REPLACE FUNCTION public.gsa_supplier_submit_delivery(
  p_request_id uuid,
  p_order_id uuid,
  p_payload jsonb
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_id uuid := public.gsa_assert_current_supplier();
  v_payload jsonb := coalesce(p_payload, '{}'::jsonb);
  v_order public.pedidos_compra_fornecedor%rowtype;
  v_delivery_id uuid;
  v_item jsonb;
  v_order_item public.pedido_compra_fornecedor_itens%rowtype;
  v_quantity integer;
  v_pending integer;
  v_xml text := nullif(trim(v_payload->>'arquivo_xml'), '');
  v_pdf text := nullif(trim(v_payload->>'arquivo_pdf'), '');
  v_key text := nullif(regexp_replace(coalesce(v_payload->>'chave_nfe', ''), '\D', '', 'g'), '');
BEGIN
  IF p_request_id IS NULL THEN RAISE EXCEPTION 'Identificador da operacao obrigatorio.'; END IF;
  SELECT id INTO v_delivery_id FROM public.fornecedor_entregas WHERE request_id = p_request_id;
  IF v_delivery_id IS NOT NULL THEN RETURN jsonb_build_object('success', true, 'already_processed', true, 'delivery_id', v_delivery_id); END IF;

  SELECT * INTO v_order FROM public.pedidos_compra_fornecedor
  WHERE id = p_order_id AND fornecedor_id = v_id FOR UPDATE;
  IF NOT FOUND OR v_order.status IN ('rascunho', 'cancelado', 'concluido') THEN RAISE EXCEPTION 'Pedido indisponivel para entrega.'; END IF;
  IF jsonb_typeof(v_payload->'items') <> 'array' OR jsonb_array_length(v_payload->'items') = 0 THEN RAISE EXCEPTION 'Informe os itens entregues.'; END IF;
  IF v_xml IS NULL AND v_pdf IS NULL THEN RAISE EXCEPTION 'Envie o XML ou PDF da nota fiscal.'; END IF;
  IF v_xml IS NOT NULL AND v_xml NOT LIKE 'storage://documentos_fornecedor/%' THEN RAISE EXCEPTION 'Referencia XML invalida.'; END IF;
  IF v_pdf IS NOT NULL AND v_pdf NOT LIKE 'storage://documentos_fornecedor/%' THEN RAISE EXCEPTION 'Referencia PDF invalida.'; END IF;
  IF v_xml IS NOT NULL AND v_xml NOT LIKE 'storage://documentos_fornecedor/' || v_id::text || '/%' THEN RAISE EXCEPTION 'O XML nao pertence ao fornecedor autenticado.'; END IF;
  IF v_pdf IS NOT NULL AND v_pdf NOT LIKE 'storage://documentos_fornecedor/' || v_id::text || '/%' THEN RAISE EXCEPTION 'O PDF nao pertence ao fornecedor autenticado.'; END IF;
  IF v_key IS NOT NULL AND length(v_key) <> 44 THEN RAISE EXCEPTION 'A chave da NF-e deve possuir 44 digitos.'; END IF;
  IF length(trim(coalesce(v_payload->>'numero_nota', ''))) = 0 THEN RAISE EXCEPTION 'Informe o numero da nota fiscal.'; END IF;

  INSERT INTO public.fornecedor_entregas(
    pedido_id, fornecedor_id, numero_nota, serie_nota, chave_nfe, data_emissao,
    valor_total_nota, vencimento, arquivo_xml, arquivo_pdf, observacoes, request_id
  ) VALUES (
    p_order_id, v_id, trim(v_payload->>'numero_nota'), nullif(trim(v_payload->>'serie_nota'), ''),
    v_key, (v_payload->>'data_emissao')::date, (v_payload->>'valor_total_nota')::numeric,
    coalesce(nullif(v_payload->>'vencimento', '')::date, v_order.vencimento_previsto, current_date + 7),
    v_xml, v_pdf, nullif(trim(v_payload->>'observacoes'), ''), p_request_id
  ) RETURNING id INTO v_delivery_id;

  FOR v_item IN SELECT value FROM jsonb_array_elements(v_payload->'items') LOOP
    SELECT * INTO v_order_item FROM public.pedido_compra_fornecedor_itens
    WHERE id = (v_item->>'pedido_item_id')::uuid AND pedido_id = p_order_id FOR UPDATE;
    IF NOT FOUND THEN RAISE EXCEPTION 'Item nao pertence ao pedido.'; END IF;
    v_quantity := coalesce((v_item->>'quantidade_entregue')::integer, 0);
    SELECT v_order_item.quantidade_pedida - v_order_item.quantidade_aprovada - coalesce(sum(ei.quantidade_entregue), 0)
      INTO v_pending
    FROM public.fornecedor_entrega_itens ei
    JOIN public.fornecedor_entregas e ON e.id = ei.entrega_id
    WHERE ei.pedido_item_id = v_order_item.id AND e.status = 'em_analise';
    IF v_quantity <= 0 OR v_quantity > v_pending THEN RAISE EXCEPTION 'Quantidade entregue excede o saldo pendente de %.', v_order_item.produto_nome_snapshot; END IF;

    INSERT INTO public.fornecedor_entrega_itens(
      entrega_id, pedido_item_id, produto_id, quantidade_entregue,
      custo_unitario_nota, lote, validade
    ) VALUES (
      v_delivery_id, v_order_item.id, v_order_item.produto_id, v_quantity,
      coalesce(nullif(v_item->>'custo_unitario_nota', '')::numeric, v_order_item.custo_unitario),
      nullif(trim(v_item->>'lote'), ''), nullif(v_item->>'validade', '')::date
    );
  END LOOP;

  -- Uma nova entrega substitui a versao para a qual o administrador pediu
  -- ajuste, preservando-a somente como trilha de auditoria.
  UPDATE public.fornecedor_entregas
  SET status = 'cancelado'
  WHERE pedido_id = p_order_id
    AND fornecedor_id = v_id
    AND status = 'ajuste_solicitado'
    AND id <> v_delivery_id;

  UPDATE public.pedidos_compra_fornecedor SET status = 'em_analise' WHERE id = p_order_id;
  INSERT INTO public.fornecedor_auditoria(fornecedor_id, ator_tipo, ator_id, acao, entidade, entidade_id, detalhes)
  VALUES (v_id, 'fornecedor', v_id, 'ENVIAR_ENTREGA_NF', 'fornecedor_entregas', v_delivery_id, jsonb_build_object('pedido_id', p_order_id));
  RETURN jsonb_build_object('success', true, 'already_processed', false, 'delivery_id', v_delivery_id);
END;
$$;

CREATE OR REPLACE FUNCTION public.gsa_supplier_mark_notifications_read()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE v_id uuid := public.gsa_assert_current_supplier();
BEGIN
  UPDATE public.fornecedor_notificacoes SET lida = true WHERE fornecedor_id = v_id AND NOT lida;
  RETURN jsonb_build_object('success', true);
END;
$$;

REVOKE ALL ON FUNCTION public.gsa_supplier_dashboard_snapshot() FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.gsa_supplier_request_product(jsonb) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.gsa_supplier_mark_order_seen(uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.gsa_supplier_submit_delivery(uuid, uuid, jsonb) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.gsa_supplier_mark_notifications_read() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.gsa_supplier_dashboard_snapshot() TO authenticated;
GRANT EXECUTE ON FUNCTION public.gsa_supplier_request_product(jsonb) TO authenticated;
GRANT EXECUTE ON FUNCTION public.gsa_supplier_mark_order_seen(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.gsa_supplier_submit_delivery(uuid, uuid, jsonb) TO authenticated;
GRANT EXECUTE ON FUNCTION public.gsa_supplier_mark_notifications_read() TO authenticated;

-- Snapshot administrativo do modulo.
CREATE OR REPLACE FUNCTION public.gsa_admin_supplier_snapshot(p_sessao_id uuid, p_session_token text)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE v_actor jsonb := public.gsa_admin_validate_context(p_sessao_id, p_session_token);
BEGIN
  IF NOT public.gsa_admin_has_module('fornecedores') THEN RAISE EXCEPTION 'Sem permissao para Fornecedores.' USING ERRCODE = '42501'; END IF;
  RETURN jsonb_build_object(
    'suppliers', COALESCE((SELECT jsonb_agg((to_jsonb(f) - 'pin_hash') ORDER BY f.created_at DESC) FROM public.fornecedores f), '[]'::jsonb),
    'requests', COALESCE((
      SELECT jsonb_agg(to_jsonb(x) ORDER BY x.created_at DESC) FROM (
        SELECT s.*, coalesce(f.nome_fantasia, f.razao_social) AS fornecedor_nome,
               p.nome AS produto_existente_nome
        FROM public.fornecedor_produto_solicitacoes s
        JOIN public.fornecedores f ON f.id = s.fornecedor_id
        LEFT JOIN public.produtos p ON p.id = s.produto_id
      ) x
    ), '[]'::jsonb),
    'supplier_products', COALESCE((
      SELECT jsonb_agg(to_jsonb(x) ORDER BY x.fornecedor_nome, x.produto_nome) FROM (
        SELECT fp.*, coalesce(f.nome_fantasia, f.razao_social) AS fornecedor_nome,
               p.nome AS produto_nome, p.codigo_produto, p.estoque_disponivel
        FROM public.fornecedor_produtos fp JOIN public.fornecedores f ON f.id = fp.fornecedor_id
        JOIN public.produtos p ON p.id = fp.produto_id
      ) x
    ), '[]'::jsonb),
    'orders', COALESCE((
      SELECT jsonb_agg(to_jsonb(x) ORDER BY x.created_at DESC) FROM (
        SELECT o.*, coalesce(f.nome_fantasia, f.razao_social) AS fornecedor_nome,
          (SELECT jsonb_agg(to_jsonb(i) ORDER BY i.produto_nome_snapshot) FROM public.pedido_compra_fornecedor_itens i WHERE i.pedido_id = o.id) AS items
        FROM public.pedidos_compra_fornecedor o JOIN public.fornecedores f ON f.id = o.fornecedor_id
      ) x
    ), '[]'::jsonb),
    'deliveries', COALESCE((
      SELECT jsonb_agg(to_jsonb(x) ORDER BY x.created_at DESC) FROM (
        SELECT e.*, o.codigo AS pedido_codigo, coalesce(f.nome_fantasia, f.razao_social) AS fornecedor_nome,
          (SELECT jsonb_agg(to_jsonb(i) ORDER BY i.created_at) FROM public.fornecedor_entrega_itens i WHERE i.entrega_id = e.id) AS items
        FROM public.fornecedor_entregas e JOIN public.pedidos_compra_fornecedor o ON o.id = e.pedido_id
        JOIN public.fornecedores f ON f.id = e.fornecedor_id
      ) x
    ), '[]'::jsonb),
    'payables', COALESCE((
      SELECT jsonb_agg(to_jsonb(x) ORDER BY x.data_vencimento) FROM (
        SELECT c.*, coalesce(f.nome_fantasia, f.razao_social) AS fornecedor_nome
        FROM public.contas_pagar c JOIN public.fornecedores f ON f.id = c.fornecedor_id
      ) x
    ), '[]'::jsonb),
    'products', COALESCE((
      SELECT jsonb_agg(jsonb_build_object('id', p.id, 'nome', p.nome, 'codigo_produto', p.codigo_produto, 'estoque_disponivel', p.estoque_disponivel) ORDER BY p.nome)
      FROM public.produtos p WHERE p.status = 'ativo'
    ), '[]'::jsonb)
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.gsa_admin_supplier_set_status(
  p_sessao_id uuid, p_session_token text, p_supplier_id uuid,
  p_status text, p_reason text DEFAULT NULL, p_pin text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions, pg_temp
AS $$
DECLARE v_actor jsonb := public.gsa_admin_validate_context(p_sessao_id, p_session_token);
DECLARE v_status text := lower(trim(coalesce(p_status, '')));
BEGIN
  IF NOT public.gsa_admin_has_module('fornecedores') THEN RAISE EXCEPTION 'Sem permissao para Fornecedores.' USING ERRCODE = '42501'; END IF;
  IF v_status NOT IN ('em_analise', 'ajuste_solicitado', 'ativo', 'suspenso', 'reprovado') THEN RAISE EXCEPTION 'Status invalido.'; END IF;
  IF v_status = 'ativo' AND p_pin IS NOT NULL AND p_pin !~ '^\d{4}$' THEN RAISE EXCEPTION 'O PIN deve possuir quatro digitos.'; END IF;

  UPDATE public.fornecedores SET
    status = v_status,
    motivo_status = nullif(trim(coalesce(p_reason, '')), ''),
    aprovado_em = CASE WHEN v_status = 'ativo' THEN coalesce(aprovado_em, now()) ELSE aprovado_em END,
    aprovado_por = CASE WHEN v_status = 'ativo' THEN (v_actor->>'actor_id')::uuid ELSE aprovado_por END,
    pin_hash = CASE WHEN v_status = 'ativo' AND p_pin IS NOT NULL THEN extensions.crypt(p_pin, extensions.gen_salt('bf', 12)) ELSE pin_hash END,
    pin_tentativas = CASE WHEN v_status = 'ativo' THEN 0 ELSE pin_tentativas END,
    pin_bloqueado = CASE WHEN v_status = 'ativo' THEN false ELSE pin_bloqueado END
  WHERE id = p_supplier_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Fornecedor nao encontrado.'; END IF;

  UPDATE public.sistema_sessoes SET status = 'encerrado', encerrado_em = coalesce(encerrado_em, now())
  WHERE ator_tipo = 'fornecedor' AND ator_id = p_supplier_id AND status = 'ativo' AND v_status <> 'ativo';
  INSERT INTO public.fornecedor_notificacoes(fornecedor_id, titulo, mensagem, modulo)
  VALUES (p_supplier_id, 'Cadastro ' || replace(v_status, '_', ' '), coalesce(nullif(trim(p_reason), ''), 'O status do seu cadastro foi atualizado.'), 'cadastro');
  INSERT INTO public.fornecedor_auditoria(fornecedor_id, ator_tipo, ator_id, ator_nome, acao, entidade, entidade_id, detalhes)
  VALUES (p_supplier_id, v_actor->>'actor_type', (v_actor->>'actor_id')::uuid, v_actor->>'actor_name', 'ALTERAR_STATUS', 'fornecedores', p_supplier_id, jsonb_build_object('status', v_status, 'motivo', p_reason));
  RETURN jsonb_build_object('success', true, 'supplier_id', p_supplier_id, 'status', v_status);
END;
$$;

CREATE OR REPLACE FUNCTION public.gsa_admin_review_supplier_product(
  p_sessao_id uuid, p_session_token text, p_request_id uuid,
  p_action text, p_reason text DEFAULT NULL, p_product_payload jsonb DEFAULT '{}'::jsonb
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_actor jsonb := public.gsa_admin_validate_context(p_sessao_id, p_session_token);
  v_request public.fornecedor_produto_solicitacoes%rowtype;
  v_product_id uuid;
  v_supplier_product_id uuid;
  v_action text := lower(trim(coalesce(p_action, '')));
  v_sale_value numeric;
BEGIN
  IF NOT public.gsa_admin_has_module('fornecedores') THEN RAISE EXCEPTION 'Sem permissao para Fornecedores.' USING ERRCODE = '42501'; END IF;
  SELECT * INTO v_request FROM public.fornecedor_produto_solicitacoes WHERE id = p_request_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Solicitacao nao encontrada.'; END IF;
  IF v_request.status IN ('aprovado', 'reprovado') THEN RETURN jsonb_build_object('success', true, 'already_processed', true, 'status', v_request.status, 'product_id', v_request.produto_aprovado_id); END IF;

  IF v_action = 'rejeitar' OR v_action = 'ajuste' THEN
    IF length(trim(coalesce(p_reason, ''))) < 3 THEN RAISE EXCEPTION 'Informe o motivo.'; END IF;
    UPDATE public.fornecedor_produto_solicitacoes
    SET status = CASE WHEN v_action = 'ajuste' THEN 'ajuste_solicitado' ELSE 'reprovado' END,
        motivo_analise = trim(p_reason), analisado_em = now(), analisado_por = (v_actor->>'actor_id')::uuid
    WHERE id = p_request_id;
    INSERT INTO public.fornecedor_notificacoes(fornecedor_id, titulo, mensagem, modulo, item_id)
    VALUES (v_request.fornecedor_id, 'Analise de produto', trim(p_reason), 'produtos', p_request_id);
    RETURN jsonb_build_object('success', true, 'status', CASE WHEN v_action = 'ajuste' THEN 'ajuste_solicitado' ELSE 'reprovado' END);
  END IF;
  IF v_action <> 'aprovar' THEN RAISE EXCEPTION 'Acao invalida.'; END IF;

  IF v_request.tipo = 'existente' THEN
    v_product_id := v_request.produto_id;
  ELSE
    v_sale_value := coalesce(nullif(p_product_payload->>'valor_venda', '')::numeric, v_request.custo_unitario);
    IF v_sale_value < 0 THEN RAISE EXCEPTION 'Valor de venda invalido.'; END IF;
    INSERT INTO public.produtos(
      codigo_produto, nome, descricao, valor, status, tipo_cliente, categoria_id,
      codigo_barras, imagem_url, controle_estoque, estoque_disponivel, valor_custo, visivel_na_loja
    ) VALUES (
      public.gsa_generate_code('PROD'), trim(coalesce(p_product_payload->>'nome', v_request.nome)),
      coalesce(nullif(trim(p_product_payload->>'descricao'), ''), v_request.descricao),
      v_sale_value, 'ativo', coalesce(nullif(p_product_payload->>'tipo_cliente', ''), 'ambos'),
      coalesce(nullif(p_product_payload->>'categoria_id', '')::uuid, v_request.categoria_id),
      coalesce(nullif(regexp_replace(coalesce(p_product_payload->>'codigo_barras', ''), '\D', '', 'g'), ''), v_request.codigo_barras),
      coalesce(nullif(trim(p_product_payload->>'imagem_url'), ''), v_request.imagem_url),
      true, 0, v_request.custo_unitario, coalesce((p_product_payload->>'visivel_na_loja')::boolean, false)
    ) RETURNING id INTO v_product_id;
  END IF;

  INSERT INTO public.fornecedor_produtos(
    fornecedor_id, produto_id, custo_unitario, quantidade_minima, prazo_entrega_dias,
    aprovado_por
  ) VALUES (
    v_request.fornecedor_id, v_product_id, v_request.custo_unitario,
    v_request.quantidade_minima, v_request.prazo_entrega_dias, (v_actor->>'actor_id')::uuid
  ) ON CONFLICT (fornecedor_id, produto_id) DO UPDATE SET
    custo_unitario = excluded.custo_unitario, quantidade_minima = excluded.quantidade_minima,
    prazo_entrega_dias = excluded.prazo_entrega_dias, status = 'ativo', updated_at = now()
  RETURNING id INTO v_supplier_product_id;

  UPDATE public.fornecedor_produto_solicitacoes
  SET status = 'aprovado', motivo_analise = nullif(trim(p_reason), ''),
      produto_aprovado_id = v_product_id, analisado_em = now(), analisado_por = (v_actor->>'actor_id')::uuid
  WHERE id = p_request_id;
  INSERT INTO public.fornecedor_notificacoes(fornecedor_id, titulo, mensagem, modulo, item_id)
  VALUES (v_request.fornecedor_id, 'Produto aprovado', 'O produto foi aprovado e ja pode receber pedidos de compra.', 'produtos', v_product_id);
  RETURN jsonb_build_object('success', true, 'status', 'aprovado', 'product_id', v_product_id, 'supplier_product_id', v_supplier_product_id);
END;
$$;

CREATE OR REPLACE FUNCTION public.gsa_admin_create_supplier_order(
  p_sessao_id uuid, p_session_token text, p_request_id uuid,
  p_supplier_id uuid, p_payload jsonb
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_actor jsonb := public.gsa_admin_validate_context(p_sessao_id, p_session_token);
  v_order_id uuid;
  v_existing uuid;
  v_item jsonb;
  v_link record;
  v_quantity integer;
  v_cost numeric;
  v_total numeric := 0;
BEGIN
  IF NOT public.gsa_admin_has_module('fornecedores') THEN RAISE EXCEPTION 'Sem permissao para Fornecedores.' USING ERRCODE = '42501'; END IF;
  SELECT id INTO v_existing FROM public.pedidos_compra_fornecedor WHERE id = p_request_id;
  IF v_existing IS NOT NULL THEN RETURN jsonb_build_object('success', true, 'already_processed', true, 'order_id', v_existing); END IF;
  IF NOT EXISTS (SELECT 1 FROM public.fornecedores WHERE id = p_supplier_id AND status = 'ativo') THEN RAISE EXCEPTION 'Fornecedor nao esta ativo.'; END IF;
  IF jsonb_typeof(p_payload->'items') <> 'array' OR jsonb_array_length(p_payload->'items') = 0 THEN RAISE EXCEPTION 'Informe os itens do pedido.'; END IF;

  INSERT INTO public.pedidos_compra_fornecedor(
    id, fornecedor_id, status, previsao_entrega, condicao_pagamento, vencimento_previsto,
    observacoes, criado_por_tipo, criado_por_id, criado_por_nome, enviado_em
  ) VALUES (
    p_request_id, p_supplier_id, 'enviado', nullif(p_payload->>'previsao_entrega', '')::date,
    nullif(trim(p_payload->>'condicao_pagamento'), ''), nullif(p_payload->>'vencimento_previsto', '')::date,
    nullif(trim(p_payload->>'observacoes'), ''), v_actor->>'actor_type',
    (v_actor->>'actor_id')::uuid, v_actor->>'actor_name', now()
  ) RETURNING id INTO v_order_id;

  FOR v_item IN SELECT value FROM jsonb_array_elements(p_payload->'items') LOOP
    SELECT fp.id, fp.produto_id, fp.custo_unitario, p.nome, p.codigo_produto
    INTO v_link
    FROM public.fornecedor_produtos fp JOIN public.produtos p ON p.id = fp.produto_id
    WHERE fp.id = (v_item->>'fornecedor_produto_id')::uuid
      AND fp.fornecedor_id = p_supplier_id AND fp.status = 'ativo';
    IF NOT FOUND THEN RAISE EXCEPTION 'Produto nao aprovado para este fornecedor.'; END IF;
    v_quantity := coalesce((v_item->>'quantidade')::integer, 0);
    v_cost := coalesce(nullif(v_item->>'custo_unitario', '')::numeric, v_link.custo_unitario);
    IF v_quantity <= 0 OR v_cost < 0 THEN RAISE EXCEPTION 'Quantidade ou custo invalido.'; END IF;
    INSERT INTO public.pedido_compra_fornecedor_itens(
      pedido_id, fornecedor_produto_id, produto_id, produto_nome_snapshot,
      codigo_produto_snapshot, quantidade_pedida, custo_unitario
    ) VALUES (v_order_id, v_link.id, v_link.produto_id, v_link.nome, v_link.codigo_produto, v_quantity, v_cost);
    v_total := v_total + (v_quantity * v_cost);
  END LOOP;

  UPDATE public.pedidos_compra_fornecedor SET valor_total_previsto = v_total WHERE id = v_order_id;
  INSERT INTO public.fornecedor_notificacoes(fornecedor_id, titulo, mensagem, modulo, item_id)
  VALUES (p_supplier_id, 'Novo pedido de compra', 'A GSA enviou um novo pedido no valor previsto de R$ ' || to_char(v_total, 'FM999G999G990D00'), 'pedidos', v_order_id);
  INSERT INTO public.fornecedor_auditoria(fornecedor_id, ator_tipo, ator_id, ator_nome, acao, entidade, entidade_id, detalhes)
  VALUES (p_supplier_id, v_actor->>'actor_type', (v_actor->>'actor_id')::uuid, v_actor->>'actor_name', 'CRIAR_PEDIDO_COMPRA', 'pedidos_compra_fornecedor', v_order_id, jsonb_build_object('valor_total', v_total));
  RETURN jsonb_build_object('success', true, 'already_processed', false, 'order_id', v_order_id, 'total', v_total);
END;
$$;

CREATE OR REPLACE FUNCTION public.gsa_admin_review_supplier_delivery(
  p_sessao_id uuid, p_session_token text, p_delivery_id uuid,
  p_action text, p_reason text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_actor jsonb := public.gsa_admin_validate_context(p_sessao_id, p_session_token);
  v_delivery public.fornecedor_entregas%rowtype;
  v_order public.pedidos_compra_fornecedor%rowtype;
  v_item record;
  v_product public.produtos%rowtype;
  v_payable_id uuid;
  v_action text := lower(trim(coalesce(p_action, '')));
  v_completed boolean;
BEGIN
  IF NOT public.gsa_admin_has_module('fornecedores') THEN RAISE EXCEPTION 'Sem permissao para Fornecedores.' USING ERRCODE = '42501'; END IF;
  SELECT * INTO v_delivery FROM public.fornecedor_entregas WHERE id = p_delivery_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Entrega nao encontrada.'; END IF;
  IF v_delivery.status = 'aprovado' THEN
    SELECT id INTO v_payable_id FROM public.contas_pagar WHERE entrega_id = p_delivery_id;
    RETURN jsonb_build_object('success', true, 'already_processed', true, 'payable_id', v_payable_id);
  END IF;
  IF v_delivery.status IN ('reprovado', 'cancelado') THEN RAISE EXCEPTION 'Esta entrega ja foi encerrada.'; END IF;

  IF v_action IN ('rejeitar', 'ajuste') THEN
    IF length(trim(coalesce(p_reason, ''))) < 3 THEN RAISE EXCEPTION 'Informe o motivo.'; END IF;
    UPDATE public.fornecedor_entregas
    SET status = CASE WHEN v_action = 'ajuste' THEN 'ajuste_solicitado' ELSE 'reprovado' END,
        motivo_analise = trim(p_reason), analisado_em = now(),
        analisado_por_tipo = v_actor->>'actor_type', analisado_por_id = (v_actor->>'actor_id')::uuid,
        analisado_por_nome = v_actor->>'actor_name'
    WHERE id = p_delivery_id;
    UPDATE public.pedidos_compra_fornecedor SET status = 'parcial' WHERE id = v_delivery.pedido_id;
    INSERT INTO public.fornecedor_notificacoes(fornecedor_id, titulo, mensagem, modulo, item_id)
    VALUES (v_delivery.fornecedor_id, 'Nota fiscal requer atencao', trim(p_reason), 'entregas', p_delivery_id);
    RETURN jsonb_build_object('success', true, 'status', CASE WHEN v_action = 'ajuste' THEN 'ajuste_solicitado' ELSE 'reprovado' END);
  END IF;
  IF v_action <> 'aprovar' THEN RAISE EXCEPTION 'Acao invalida.'; END IF;

  SELECT * INTO v_order FROM public.pedidos_compra_fornecedor WHERE id = v_delivery.pedido_id FOR UPDATE;
  IF NOT FOUND OR v_order.fornecedor_id <> v_delivery.fornecedor_id THEN RAISE EXCEPTION 'Pedido da entrega invalido.'; END IF;

  FOR v_item IN
    SELECT ei.*, pi.quantidade_pedida, pi.quantidade_aprovada, pi.produto_nome_snapshot
    FROM public.fornecedor_entrega_itens ei
    JOIN public.pedido_compra_fornecedor_itens pi ON pi.id = ei.pedido_item_id
    WHERE ei.entrega_id = p_delivery_id
    ORDER BY ei.id FOR UPDATE OF pi
  LOOP
    IF v_item.quantidade_aprovada + v_item.quantidade_entregue > v_item.quantidade_pedida THEN
      RAISE EXCEPTION 'A entrega excede o saldo do produto %.', v_item.produto_nome_snapshot;
    END IF;
    SELECT * INTO v_product FROM public.produtos WHERE id = v_item.produto_id FOR UPDATE;
    IF NOT FOUND THEN RAISE EXCEPTION 'Produto da entrega nao encontrado.'; END IF;

    UPDATE public.produtos SET
      controle_estoque = true,
      estoque_disponivel = coalesce(estoque_disponivel, 0) + v_item.quantidade_entregue,
      valor_custo = v_item.custo_unitario_nota
    WHERE id = v_item.produto_id;

    INSERT INTO public.loja_estoque_historico(
      produto_id, quantidade_anterior, ajuste, quantidade_atual, motivo, colaborador_nome,
      fornecedor_id, pedido_fornecedor_id, entrega_fornecedor_id, tipo_movimento
    ) VALUES (
      v_item.produto_id, coalesce(v_product.estoque_disponivel, 0), v_item.quantidade_entregue,
      coalesce(v_product.estoque_disponivel, 0) + v_item.quantidade_entregue,
      'Entrada aprovada da NF ' || v_delivery.numero_nota || ' - Pedido ' || v_order.codigo,
      v_actor->>'actor_name', v_delivery.fornecedor_id, v_order.id, v_delivery.id, 'entrada_fornecedor'
    );

    UPDATE public.pedido_compra_fornecedor_itens
    SET quantidade_aprovada = quantidade_aprovada + v_item.quantidade_entregue
    WHERE id = v_item.pedido_item_id;
  END LOOP;

  INSERT INTO public.contas_pagar(
    fornecedor_id, pedido_id, entrega_id, numero_documento, descricao,
    valor_original, valor_pendente, data_emissao, data_vencimento
  ) VALUES (
    v_delivery.fornecedor_id, v_order.id, v_delivery.id, v_delivery.numero_nota,
    'Nota fiscal ' || v_delivery.numero_nota || ' - Pedido ' || v_order.codigo,
    v_delivery.valor_total_nota, v_delivery.valor_total_nota, v_delivery.data_emissao,
    coalesce(v_delivery.vencimento, v_order.vencimento_previsto, current_date + 7)
  ) RETURNING id INTO v_payable_id;

  UPDATE public.fornecedor_entregas SET
    status = 'aprovado', motivo_analise = nullif(trim(p_reason), ''), analisado_em = now(),
    analisado_por_tipo = v_actor->>'actor_type', analisado_por_id = (v_actor->>'actor_id')::uuid,
    analisado_por_nome = v_actor->>'actor_name'
  WHERE id = p_delivery_id;

  SELECT bool_and(quantidade_aprovada >= quantidade_pedida) INTO v_completed
  FROM public.pedido_compra_fornecedor_itens WHERE pedido_id = v_order.id;
  UPDATE public.pedidos_compra_fornecedor
  SET status = CASE WHEN v_completed THEN 'concluido' ELSE 'parcial' END,
      concluido_em = CASE WHEN v_completed THEN now() ELSE NULL END
  WHERE id = v_order.id;

  INSERT INTO public.fornecedor_notificacoes(fornecedor_id, titulo, mensagem, modulo, item_id)
  VALUES (v_delivery.fornecedor_id, 'Entrega e nota fiscal aprovadas', 'O estoque foi liberado e a conta a pagar foi criada.', 'entregas', p_delivery_id);
  INSERT INTO public.fornecedor_auditoria(fornecedor_id, ator_tipo, ator_id, ator_nome, acao, entidade, entidade_id, detalhes)
  VALUES (v_delivery.fornecedor_id, v_actor->>'actor_type', (v_actor->>'actor_id')::uuid, v_actor->>'actor_name', 'APROVAR_ENTREGA_NF', 'fornecedor_entregas', p_delivery_id, jsonb_build_object('pedido_id', v_order.id, 'conta_pagar_id', v_payable_id));

  RETURN jsonb_build_object('success', true, 'already_processed', false, 'payable_id', v_payable_id, 'order_completed', v_completed);
END;
$$;

CREATE OR REPLACE FUNCTION public.gsa_admin_update_supplier_payable(
  p_sessao_id uuid, p_session_token text, p_payable_id uuid,
  p_action text, p_payload jsonb DEFAULT '{}'::jsonb
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE v_actor jsonb := public.gsa_admin_validate_context(p_sessao_id, p_session_token);
DECLARE v_payable public.contas_pagar%rowtype;
BEGIN
  IF NOT (public.gsa_admin_has_module('fornecedores') OR public.gsa_admin_has_module('financeiro')) THEN RAISE EXCEPTION 'Sem permissao financeira.' USING ERRCODE = '42501'; END IF;
  SELECT * INTO v_payable FROM public.contas_pagar WHERE id = p_payable_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Conta a pagar nao encontrada.'; END IF;
  IF lower(p_action) = 'pagar' THEN
    IF v_payable.status = 'pago' THEN RETURN jsonb_build_object('success', true, 'already_processed', true); END IF;
    IF v_payable.status = 'cancelado' THEN RAISE EXCEPTION 'Conta cancelada.'; END IF;
    UPDATE public.contas_pagar SET status = 'pago', valor_pendente = 0, data_pagamento = now(),
      forma_pagamento = nullif(trim(p_payload->>'forma_pagamento'), ''),
      comprovante = nullif(trim(p_payload->>'comprovante'), ''), observacoes = nullif(trim(p_payload->>'observacoes'), '')
    WHERE id = p_payable_id;
  ELSIF lower(p_action) = 'cancelar' THEN
    IF length(trim(coalesce(p_payload->>'motivo', ''))) < 3 THEN RAISE EXCEPTION 'Informe o motivo.'; END IF;
    IF v_payable.status = 'pago' THEN RAISE EXCEPTION 'Conta paga nao pode ser cancelada.'; END IF;
    UPDATE public.contas_pagar SET status = 'cancelado', observacoes = trim(p_payload->>'motivo') WHERE id = p_payable_id;
  ELSE
    RAISE EXCEPTION 'Acao invalida.';
  END IF;
  RETURN jsonb_build_object('success', true, 'already_processed', false);
END;
$$;

DO $$
DECLARE v_signature text;
BEGIN
  FOREACH v_signature IN ARRAY ARRAY[
    'public.gsa_admin_supplier_snapshot(uuid,text)',
    'public.gsa_admin_supplier_set_status(uuid,text,uuid,text,text,text)',
    'public.gsa_admin_review_supplier_product(uuid,text,uuid,text,text,jsonb)',
    'public.gsa_admin_create_supplier_order(uuid,text,uuid,uuid,jsonb)',
    'public.gsa_admin_review_supplier_delivery(uuid,text,uuid,text,text)',
    'public.gsa_admin_update_supplier_payable(uuid,text,uuid,text,jsonb)'
  ] LOOP
    EXECUTE 'REVOKE ALL ON FUNCTION ' || v_signature || ' FROM PUBLIC, anon';
    EXECUTE 'GRANT EXECUTE ON FUNCTION ' || v_signature || ' TO authenticated, service_role';
  END LOOP;
END;
$$;

COMMIT;
