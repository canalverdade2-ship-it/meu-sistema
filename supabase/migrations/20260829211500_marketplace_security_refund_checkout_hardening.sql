BEGIN;

-- 1) Reembolso: estados e metadados coerentes com o fluxo real.
ALTER TABLE public.loja_reembolsos
  ADD COLUMN IF NOT EXISTS metodo_reembolso text,
  ADD COLUMN IF NOT EXISTS referencia_estorno text,
  ADD COLUMN IF NOT EXISTS confirmado_por uuid,
  ADD COLUMN IF NOT EXISTS confirmado_em timestamptz;

ALTER TABLE public.loja_reembolsos
  DROP CONSTRAINT IF EXISTS loja_reembolsos_status_check;
ALTER TABLE public.loja_reembolsos
  ADD CONSTRAINT loja_reembolsos_status_check
  CHECK (status = ANY (ARRAY[
    'pendente'::text,
    'aguardando_estorno'::text,
    'pago'::text,
    'cancelado'::text
  ]));

-- Helper interno: valida sessão e módulo do colaborador.
CREATE OR REPLACE FUNCTION public.gsa_admin_marketplace_actor(
  p_sessao_id uuid,
  p_session_token text,
  p_module text DEFAULT 'financeiro'
)
RETURNS TABLE(ator_tipo text, ator_id uuid, ator_nome text)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$DECLARE
  v_actor record;
  v_aliases text[];
BEGIN
  SELECT * INTO v_actor
  FROM public.gsa_admin_session_actor(p_sessao_id, p_session_token)
  LIMIT 1;

  IF v_actor.ator_tipo = 'colaborador' THEN
    v_aliases := CASE p_module
      WHEN 'financeiro' THEN ARRAY['financeiro','cobranca','fiscal','emprestimos','credito_loja']
      WHEN 'operacoes' THEN ARRAY['operacoes','vendas','demandas','loja']
      WHEN 'catalogo' THEN ARRAY['catalogo','cadastro','loja']
      WHEN 'fidelidade' THEN ARRAY['fidelidade','cadastro','area_vip','promocoes']
      ELSE ARRAY[p_module]
    END;

    IF NOT EXISTS (
      SELECT 1
      FROM public.colaborador_modulos cm
      WHERE cm.colaborador_id = v_actor.ator_id
        AND cm.modulo_id = ANY(v_aliases)
    ) THEN
      RAISE EXCEPTION 'Sem permissão para o módulo %.', p_module USING ERRCODE='42501';
    END IF;
  END IF;

  ator_tipo := v_actor.ator_tipo;
  ator_id := v_actor.ator_id;
  ator_nome := v_actor.ator_nome;
  RETURN NEXT;
END;
$$;
-- 2) O valor enviado ao provedor deve vir do pedido confirmado no banco.
CREATE OR REPLACE FUNCTION public.gsa_client_store_payment_quote(
  p_sessao_id uuid,
  p_session_token text,
  p_orcamento_id uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_actor record;
  v_order public.orcamentos%rowtype;
BEGIN
  SELECT * INTO v_actor
  FROM public.gsa_client_session_actor(p_sessao_id, p_session_token)
  LIMIT 1;

  SELECT * INTO v_order
  FROM public.orcamentos
  WHERE id = p_orcamento_id
    AND cliente_id = v_actor.cliente_id
  FOR SHARE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Pedido não encontrado para este cliente.' USING ERRCODE='P0002';
  END IF;
  IF v_order.status = 'cancelado' THEN
    RAISE EXCEPTION 'Pedido cancelado não pode gerar cobrança.' USING ERRCODE='22023';
  END IF;
  IF round(coalesce(v_order.total, 0), 2) < 0 THEN
    RAISE EXCEPTION 'Total do pedido inválido.' USING ERRCODE='22023';
  END IF;
  RETURN jsonb_build_object(
    'success', true,
    'orcamento_id', v_order.id,
    'codigo_orcamento', v_order.codigo_orcamento,
    'total', round(coalesce(v_order.total, 0), 2),
    'status', v_order.status
  );
END;
$$;

-- 3) Leituras de reembolso passam por sessão, sem tabela financeira pública.
CREATE OR REPLACE FUNCTION public.gsa_client_store_refunds(
  p_sessao_id uuid,
  p_session_token text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_actor record;
  v_result jsonb;
BEGIN
  SELECT * INTO v_actor
  FROM public.gsa_client_session_actor(p_sessao_id, p_session_token)
  LIMIT 1;

  SELECT coalesce(jsonb_agg(item ORDER BY criado_em DESC), '[]'::jsonb)
  INTO v_result
  FROM (
    SELECT r.id, r.codigo_reembolso, r.ordem_compra_id, r.ordem_assinatura_id,
           r.valor_reembolso, r.motivo_cancelamento, r.prazo_pagamento,
           r.status, r.data_pagamento, r.metodo_reembolso, r.referencia_estorno,
           r.comprovante_url, r.observacoes_pagamento, r.criado_em,
           coalesce(oc.codigo_ordem, oa.codigo_ordem) AS codigo_ordem,
           coalesce(p.nome, a.nome) AS item_nome,
           coalesce(o1.codigo_orcamento, o2.codigo_orcamento) AS codigo_orcamento
    FROM public.loja_reembolsos r    LEFT JOIN public.ordens_compra oc ON oc.id = r.ordem_compra_id
    LEFT JOIN public.produtos p ON p.id = oc.produto_id
    LEFT JOIN public.orcamentos o1 ON o1.id = oc.orcamento_id
    LEFT JOIN public.ordens_assinatura oa ON oa.id = r.ordem_assinatura_id
    LEFT JOIN public.assinaturas a ON a.id = oa.assinatura_id
    LEFT JOIN public.orcamentos o2 ON o2.id = oa.orcamento_id
    WHERE r.cliente_id = v_actor.cliente_id
  ) item;

  RETURN v_result;
END;
$$;

CREATE OR REPLACE FUNCTION public.gsa_admin_list_store_refunds(
  p_sessao_id uuid,
  p_session_token text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_actor record;
  v_result jsonb;
BEGIN
  SELECT * INTO v_actor
  FROM public.gsa_admin_marketplace_actor(p_sessao_id, p_session_token, 'financeiro')
  LIMIT 1;

  SELECT coalesce(jsonb_agg(item ORDER BY criado_em DESC), '[]'::jsonb)
  INTO v_result
  FROM (
    SELECT r.*, c.nome AS cliente_nome, c.email AS cliente_email,
           coalesce(oc.codigo_ordem, oa.codigo_ordem) AS codigo_ordem
    FROM public.loja_reembolsos r
    LEFT JOIN public.clientes c ON c.id = r.cliente_id
    LEFT JOIN public.ordens_compra oc ON oc.id = r.ordem_compra_id
    LEFT JOIN public.ordens_assinatura oa ON oa.id = r.ordem_assinatura_id
  ) item;
  RETURN v_result;
END;
$$;
CREATE OR REPLACE FUNCTION public.gsa_admin_process_store_refund(
  p_sessao_id uuid,
  p_session_token text,
  p_reembolso_id uuid,
  p_acao text,
  p_metodo text DEFAULT NULL,
  p_referencia text DEFAULT NULL,
  p_comprovante_url text DEFAULT NULL,
  p_observacoes text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_actor record;
  v_ref public.loja_reembolsos%rowtype;
  v_cliente public.clientes%rowtype;
  v_acao text := lower(trim(coalesce(p_acao, '')));
  v_metodo text := lower(trim(coalesce(p_metodo, '')));
  v_novo_saldo numeric;
BEGIN
  SELECT * INTO v_actor
  FROM public.gsa_admin_marketplace_actor(p_sessao_id, p_session_token, 'financeiro')
  LIMIT 1;

  SELECT * INTO v_ref
  FROM public.loja_reembolsos
  WHERE id = p_reembolso_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Reembolso não encontrado.' USING ERRCODE='P0002';
  END IF;

  IF v_ref.status = 'pago' THEN
    RETURN jsonb_build_object('success', true, 'already_processed', true,
      'status', 'pago', 'reembolso_id', v_ref.id);
  END IF;
  IF v_ref.status = 'cancelado' THEN
    RAISE EXCEPTION 'Reembolso cancelado não pode ser processado.' USING ERRCODE='22023';
  END IF;

  IF v_acao = 'credito_carteira' THEN
    IF v_ref.status NOT IN ('pendente', 'aguardando_estorno') THEN
      RAISE EXCEPTION 'Status inválido para crédito em carteira.' USING ERRCODE='22023';
    END IF;

    SELECT * INTO v_cliente
    FROM public.clientes
    WHERE id = v_ref.cliente_id
    FOR UPDATE;
    IF NOT FOUND THEN RAISE EXCEPTION 'Cliente não encontrado.'; END IF;

    v_novo_saldo := round(coalesce(v_cliente.saldo_carteira, 0) + v_ref.valor_reembolso, 2);
    UPDATE public.clientes SET saldo_carteira = v_novo_saldo WHERE id = v_cliente.id;

    INSERT INTO public.carteira_lancamentos(cliente_id, valor, tipo, descricao)
    VALUES (v_cliente.id, v_ref.valor_reembolso, 'credito',
      'Reembolso GSA Store ' || coalesce(v_ref.codigo_reembolso, v_ref.id::text));

    INSERT INTO public.extrato_financeiro(
      cliente_id, tipo, valor, saldo_resultante, descricao, referencia_id, modulo_referencia
    ) VALUES (
      v_cliente.id, 'entrada', v_ref.valor_reembolso, v_novo_saldo,
      'Reembolso GSA Store ' || coalesce(v_ref.codigo_reembolso, v_ref.id::text),
      v_ref.id, 'loja_reembolsos'
    );

    UPDATE public.loja_reembolsos
    SET status='pago', metodo_reembolso='credito_carteira', data_pagamento=now(),
        confirmado_por=v_actor.ator_id, confirmado_em=now(),
        observacoes_pagamento=nullif(trim(coalesce(p_observacoes,'')),'')
    WHERE id=v_ref.id;
    RETURN jsonb_build_object('success',true,'status','pago','metodo','credito_carteira',
      'reembolso_id',v_ref.id,'novo_saldo',v_novo_saldo);
  END IF;

  IF v_acao = 'aprovar_externo' THEN
    IF v_ref.status <> 'pendente' THEN
      RAISE EXCEPTION 'Somente reembolso pendente pode ser enviado para estorno externo.' USING ERRCODE='22023';
    END IF;
    IF v_metodo NOT IN ('pix_estorno','cartao_estorno') THEN
      RAISE EXCEPTION 'Método externo inválido.' USING ERRCODE='22023';
    END IF;

    UPDATE public.loja_reembolsos
    SET status='aguardando_estorno', metodo_reembolso=v_metodo,
        observacoes_pagamento=nullif(trim(coalesce(p_observacoes,'')),''),
        colaborador_id=CASE WHEN v_actor.ator_tipo='colaborador' THEN v_actor.ator_id ELSE colaborador_id END
    WHERE id=v_ref.id;

    RETURN jsonb_build_object('success',true,'status','aguardando_estorno',
      'metodo',v_metodo,'reembolso_id',v_ref.id);
  END IF;

  IF v_acao = 'confirmar_externo' THEN
    IF v_ref.status <> 'aguardando_estorno' THEN
      RAISE EXCEPTION 'O reembolso não está aguardando confirmação externa.' USING ERRCODE='22023';
    END IF;
    IF nullif(trim(coalesce(p_referencia,'')),'') IS NULL THEN
      RAISE EXCEPTION 'Referência do estorno externo é obrigatória.' USING ERRCODE='22023';
    END IF;

    UPDATE public.loja_reembolsos
    SET status='pago', data_pagamento=now(), referencia_estorno=trim(p_referencia),
        comprovante_url=nullif(trim(coalesce(p_comprovante_url,'')),''),
        confirmado_por=v_actor.ator_id, confirmado_em=now(),
        observacoes_pagamento=coalesce(nullif(trim(coalesce(p_observacoes,'')),''),observacoes_pagamento)
    WHERE id=v_ref.id;

    RETURN jsonb_build_object('success',true,'status','pago','reembolso_id',v_ref.id);
  END IF;
  IF v_acao = 'cancelar' THEN
    IF v_ref.status NOT IN ('pendente','aguardando_estorno') THEN
      RAISE EXCEPTION 'Reembolso já finalizado.' USING ERRCODE='22023';
    END IF;
    UPDATE public.loja_reembolsos
    SET status='cancelado', observacoes_pagamento=nullif(trim(coalesce(p_observacoes,'')),'')
    WHERE id=v_ref.id;
    RETURN jsonb_build_object('success',true,'status','cancelado','reembolso_id',v_ref.id);
  END IF;

  RAISE EXCEPTION 'Ação de reembolso inválida.' USING ERRCODE='22023';
END;
$$;

-- 4) Edições administrativas que antes dependiam de UPDATE direto.
CREATE OR REPLACE FUNCTION public.gsa_admin_patch_marketplace_product(
  p_sessao_id uuid,
  p_session_token text,
  p_produto_id uuid,
  p_patch jsonb
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_actor record;
  v_allowed text[] := ARRAY[
    'tipo_cliente','descricao','categoria_id','categoria','ocultar_valor',
    'visivel_na_loja','controle_estoque','status'
  ];
  v_extra jsonb;
BEGIN
  SELECT * INTO v_actor
  FROM public.gsa_admin_marketplace_actor(p_sessao_id,p_session_token,'catalogo') LIMIT 1;
  IF p_patch IS NULL OR jsonb_typeof(p_patch) <> 'object' THEN RAISE EXCEPTION 'Patch inválido.'; END IF;
  v_extra := p_patch - v_allowed;
  IF v_extra <> '{}'::jsonb THEN RAISE EXCEPTION 'Campos não permitidos: %', v_extra; END IF;
  UPDATE public.produtos SET
    tipo_cliente = CASE WHEN p_patch ? 'tipo_cliente' THEN p_patch->>'tipo_cliente' ELSE tipo_cliente END,
    descricao = CASE WHEN p_patch ? 'descricao' THEN p_patch->>'descricao' ELSE descricao END,
    categoria_id = CASE WHEN p_patch ? 'categoria_id' THEN nullif(p_patch->>'categoria_id','')::uuid ELSE categoria_id END,
    categoria = CASE WHEN p_patch ? 'categoria' THEN nullif(p_patch->>'categoria','') ELSE categoria END,
    ocultar_valor = CASE WHEN p_patch ? 'ocultar_valor' THEN (p_patch->>'ocultar_valor')::boolean ELSE ocultar_valor END,
    visivel_na_loja = CASE WHEN p_patch ? 'visivel_na_loja' THEN (p_patch->>'visivel_na_loja')::boolean ELSE visivel_na_loja END,
    controle_estoque = CASE WHEN p_patch ? 'controle_estoque' THEN (p_patch->>'controle_estoque')::boolean ELSE controle_estoque END,
    status = CASE WHEN p_patch ? 'status' THEN p_patch->>'status' ELSE status END
  WHERE id=p_produto_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Produto não encontrado.' USING ERRCODE='P0002'; END IF;
  RETURN jsonb_build_object('success',true,'produto_id',p_produto_id);
END;
$$;

CREATE OR REPLACE FUNCTION public.gsa_admin_patch_marketplace_budget(
  p_sessao_id uuid,
  p_session_token text,
  p_orcamento_id uuid,
  p_patch jsonb
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_actor record;
  v_allowed text[] := ARRAY['fase_negociacao','proposta_admin_porcentagem','documentos_solicitados','status'];
  v_extra jsonb;
BEGIN
  SELECT * INTO v_actor FROM public.gsa_admin_marketplace_actor(p_sessao_id,p_session_token,'operacoes') LIMIT 1;
  IF p_patch IS NULL OR jsonb_typeof(p_patch)<>'object' THEN RAISE EXCEPTION 'Patch inválido.'; END IF;
  v_extra := p_patch - v_allowed;
  IF v_extra <> '{}'::jsonb THEN RAISE EXCEPTION 'Campos não permitidos: %', v_extra; END IF;
  UPDATE public.orcamentos SET
    fase_negociacao = CASE WHEN p_patch ? 'fase_negociacao' THEN p_patch->>'fase_negociacao' ELSE fase_negociacao END,
    proposta_admin_porcentagem = CASE WHEN p_patch ? 'proposta_admin_porcentagem' THEN (p_patch->>'proposta_admin_porcentagem')::numeric ELSE proposta_admin_porcentagem END,
    documentos_solicitados = CASE WHEN p_patch ? 'documentos_solicitados' THEN ARRAY(SELECT jsonb_array_elements_text(p_patch->'documentos_solicitados')) ELSE documentos_solicitados END,
    status = CASE WHEN p_patch ? 'status' THEN p_patch->>'status' ELSE status END
  WHERE id=p_orcamento_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Orçamento não encontrado.' USING ERRCODE='P0002'; END IF;
  RETURN jsonb_build_object('success',true,'orcamento_id',p_orcamento_id);
END;
$$;

CREATE OR REPLACE FUNCTION public.gsa_admin_update_store_order_notes(
  p_sessao_id uuid,
  p_session_token text,
  p_ordem_compra_id uuid,
  p_observacoes text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE v_actor record;
BEGIN
  SELECT * INTO v_actor FROM public.gsa_admin_marketplace_actor(p_sessao_id,p_session_token,'operacoes') LIMIT 1;
  UPDATE public.ordens_compra
  SET observacoes_internas=left(coalesce(p_observacoes,''),10000)
  WHERE id=p_ordem_compra_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Ordem de compra não encontrada.' USING ERRCODE='P0002'; END IF;
  RETURN jsonb_build_object('success',true,'ordem_compra_id',p_ordem_compra_id);
END;
$$;

CREATE OR REPLACE FUNCTION public.gsa_admin_save_store_coupon(
  p_sessao_id uuid,
  p_session_token text,
  p_cupom_id uuid DEFAULT NULL,
  p_payload jsonb DEFAULT '{}'::jsonb
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$DECLARE
  v_actor record;
  v_id uuid;
  v_allowed text[] := ARRAY[
    'codigo_cupom','nome_cupom','categoria_cupom','tipo_desconto','valor_desconto',
    'tipo_entrega','valor_minimo_compra','taxa_fixa_entrega','cliente_id','produto_id',
    'limite_usos','total_usos','data_validade','status','limite_usos_por_cliente'
  ];
  v_extra jsonb;
BEGIN
  SELECT * INTO v_actor FROM public.gsa_admin_marketplace_actor(p_sessao_id,p_session_token,'fidelidade') LIMIT 1;
  IF p_payload IS NULL OR jsonb_typeof(p_payload)<>'object' THEN RAISE EXCEPTION 'Cupom inválido.'; END IF;
  v_extra := p_payload - v_allowed;
  IF v_extra <> '{}'::jsonb THEN RAISE EXCEPTION 'Campos de cupom não permitidos: %', v_extra; END IF;
  IF nullif(trim(coalesce(p_payload->>'codigo_cupom','')),'') IS NULL THEN RAISE EXCEPTION 'Código do cupom é obrigatório.'; END IF;

  IF p_cupom_id IS NULL THEN
    INSERT INTO public.cupons_loja(
      codigo_cupom,nome_cupom,categoria_cupom,tipo_desconto,valor_desconto,tipo_entrega,
      valor_minimo_compra,taxa_fixa_entrega,cliente_id,produto_id,limite_usos,total_usos,
      data_validade,status,limite_usos_por_cliente
    ) VALUES (
      upper(trim(p_payload->>'codigo_cupom')),coalesce(nullif(trim(p_payload->>'nome_cupom'),''),'Cupom'),
      coalesce(p_payload->>'categoria_cupom','desconto'),nullif(p_payload->>'tipo_desconto',''),
      nullif(p_payload->>'valor_desconto','')::numeric,nullif(p_payload->>'tipo_entrega',''),
      nullif(p_payload->>'valor_minimo_compra','')::numeric,nullif(p_payload->>'taxa_fixa_entrega','')::numeric,
      nullif(p_payload->>'cliente_id','')::uuid,nullif(p_payload->>'produto_id','')::uuid,
      coalesce(nullif(p_payload->>'limite_usos','')::integer,1),coalesce(nullif(p_payload->>'total_usos','')::integer,0),
      nullif(p_payload->>'data_validade','')::date,coalesce(p_payload->>'status','ativo'),
      coalesce(nullif(p_payload->>'limite_usos_por_cliente','')::integer,1)
    ) RETURNING id INTO v_id;
  ELSE
    v_id := p_cupom_id;    UPDATE public.cupons_loja SET
      codigo_cupom=CASE WHEN p_payload?'codigo_cupom' THEN upper(trim(p_payload->>'codigo_cupom')) ELSE codigo_cupom END,
      nome_cupom=CASE WHEN p_payload?'nome_cupom' THEN p_payload->>'nome_cupom' ELSE nome_cupom END,
      categoria_cupom=CASE WHEN p_payload?'categoria_cupom' THEN p_payload->>'categoria_cupom' ELSE categoria_cupom END,
      tipo_desconto=CASE WHEN p_payload?'tipo_desconto' THEN nullif(p_payload->>'tipo_desconto','') ELSE tipo_desconto END,
      valor_desconto=CASE WHEN p_payload?'valor_desconto' THEN nullif(p_payload->>'valor_desconto','')::numeric ELSE valor_desconto END,
      tipo_entrega=CASE WHEN p_payload?'tipo_entrega' THEN nullif(p_payload->>'tipo_entrega','') ELSE tipo_entrega END,
      valor_minimo_compra=CASE WHEN p_payload?'valor_minimo_compra' THEN nullif(p_payload->>'valor_minimo_compra','')::numeric ELSE valor_minimo_compra END,
      taxa_fixa_entrega=CASE WHEN p_payload?'taxa_fixa_entrega' THEN nullif(p_payload->>'taxa_fixa_entrega','')::numeric ELSE taxa_fixa_entrega END,
      limite_usos=CASE WHEN p_payload?'limite_usos' THEN (p_payload->>'limite_usos')::integer ELSE limite_usos END,
      data_validade=CASE WHEN p_payload?'data_validade' THEN nullif(p_payload->>'data_validade','')::date ELSE data_validade END,
      status=CASE WHEN p_payload?'status' THEN p_payload->>'status' ELSE status END,
      updated_at=now()
    WHERE id=p_cupom_id;
    IF NOT FOUND THEN RAISE EXCEPTION 'Cupom não encontrado.' USING ERRCODE='P0002'; END IF;
  END IF;
  RETURN jsonb_build_object('success',true,'cupom_id',v_id);
END;
$$;

CREATE OR REPLACE FUNCTION public.gsa_admin_delete_store_coupon(
  p_sessao_id uuid,
  p_session_token text,
  p_cupom_id uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE v_actor record;
BEGIN
  SELECT * INTO v_actor FROM public.gsa_admin_marketplace_actor(p_sessao_id,p_session_token,'fidelidade') LIMIT 1;
  DELETE FROM public.cupons_loja WHERE id=p_cupom_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Cupom não encontrado.' USING ERRCODE='P0002'; END IF;
  RETURN jsonb_build_object('success',true,'cupom_id',p_cupom_id);
END;
$$;
CREATE OR REPLACE FUNCTION public.gsa_client_activate_store_coupon(
  p_sessao_id uuid,
  p_session_token text,
  p_cupom_id uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_actor record;
  v_cupom public.cupons_loja%rowtype;
  v_id uuid;
BEGIN
  SELECT * INTO v_actor FROM public.gsa_client_session_actor(p_sessao_id,p_session_token) LIMIT 1;
  SELECT * INTO v_cupom FROM public.cupons_loja WHERE id=p_cupom_id FOR SHARE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Cupom não encontrado.' USING ERRCODE='P0002'; END IF;
  IF v_cupom.status <> 'ativo' THEN RAISE EXCEPTION 'Cupom indisponível.' USING ERRCODE='22023'; END IF;
  IF v_cupom.data_validade IS NOT NULL AND v_cupom.data_validade < current_date THEN
    RAISE EXCEPTION 'Cupom expirado.' USING ERRCODE='22023';
  END IF;
  IF v_cupom.cliente_id IS NOT NULL AND v_cupom.cliente_id <> v_actor.cliente_id THEN
    RAISE EXCEPTION 'Cupom não disponível para este cliente.' USING ERRCODE='42501';
  END IF;
  INSERT INTO public.cupons_ativados(cliente_id,cupom_id)
  VALUES(v_actor.cliente_id,p_cupom_id)
  ON CONFLICT(cliente_id,cupom_id) DO UPDATE SET ativado_em=excluded.ativado_em
  RETURNING id INTO v_id;

  RETURN jsonb_build_object('success',true,'ativacao_id',v_id,'cupom_id',p_cupom_id);
END;
$$;

-- Permissões das funções: o papel do browser apenas executa RPCs; a função valida a sessão.
REVOKE ALL ON FUNCTION public.gsa_client_store_payment_quote(uuid,text,uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.gsa_client_store_refunds(uuid,text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.gsa_admin_list_store_refunds(uuid,text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.gsa_admin_process_store_refund(uuid,text,uuid,text,text,text,text,text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.gsa_admin_patch_marketplace_product(uuid,text,uuid,jsonb) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.gsa_admin_patch_marketplace_budget(uuid,text,uuid,jsonb) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.gsa_admin_update_store_order_notes(uuid,text,uuid,text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.gsa_admin_save_store_coupon(uuid,text,uuid,jsonb) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.gsa_admin_delete_store_coupon(uuid,text,uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.gsa_client_activate_store_coupon(uuid,text,uuid) FROM PUBLIC;

GRANT EXECUTE ON FUNCTION public.gsa_client_store_payment_quote(uuid,text,uuid) TO anon,authenticated;
GRANT EXECUTE ON FUNCTION public.gsa_client_store_refunds(uuid,text) TO anon,authenticated;
GRANT EXECUTE ON FUNCTION public.gsa_admin_list_store_refunds(uuid,text) TO anon,authenticated;
GRANT EXECUTE ON FUNCTION public.gsa_admin_process_store_refund(uuid,text,uuid,text,text,text,text,text) TO anon,authenticated;
GRANT EXECUTE ON FUNCTION public.gsa_admin_patch_marketplace_product(uuid,text,uuid,jsonb) TO anon,authenticated;
GRANT EXECUTE ON FUNCTION public.gsa_admin_patch_marketplace_budget(uuid,text,uuid,jsonb) TO anon,authenticated;
GRANT EXECUTE ON FUNCTION public.gsa_admin_update_store_order_notes(uuid,text,uuid,text) TO anon,authenticated;
GRANT EXECUTE ON FUNCTION public.gsa_admin_save_store_coupon(uuid,text,uuid,jsonb) TO anon,authenticated;
GRANT EXECUTE ON FUNCTION public.gsa_admin_delete_store_coupon(uuid,text,uuid) TO anon,authenticated;
GRANT EXECUTE ON FUNCTION public.gsa_client_activate_store_coupon(uuid,text,uuid) TO anon,authenticated;

-- As policies ALL=true de escrita são removidas; leitura existente fica temporariamente
-- para as telas legadas que ainda serão migradas nesta mesma implantação.
DROP POLICY IF EXISTS "Acesso total para public" ON public.loja_reembolsos;
DROP POLICY IF EXISTS "Acesso total" ON public.carteira_lancamentos;
DROP POLICY IF EXISTS "Acesso total" ON public.produtos;
DROP POLICY IF EXISTS "Allow anon all on produtos" ON public.produtos;
DROP POLICY IF EXISTS "Acesso total" ON public.orcamentos;
DROP POLICY IF EXISTS "Acesso total" ON public.ordens_compra;
DROP POLICY IF EXISTS "Acesso total para cupons" ON public.cupons_loja;
DROP POLICY IF EXISTS "cliente_delete_cupons_ativados" ON public.cupons_ativados;
DROP POLICY IF EXISTS "cliente_insert_cupons_ativados" ON public.cupons_ativados;

-- Nenhum INSERT/UPDATE/DELETE direto é aceito via RLS público.
-- SELECT permanece nas tabelas de catálogo/pedido por compatibilidade das telas atuais.
CREATE POLICY marketplace_products_read ON public.produtos FOR SELECT TO public USING (true);
CREATE POLICY marketplace_orders_read ON public.orcamentos FOR SELECT TO public USING (true);
CREATE POLICY marketplace_purchase_orders_read ON public.ordens_compra FOR SELECT TO public USING (true);
CREATE POLICY marketplace_coupons_read ON public.cupons_loja FOR SELECT TO public USING (true);
CREATE POLICY marketplace_coupon_activations_read ON public.cupons_ativados FOR SELECT TO public USING (true);
REVOKE INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER
ON public.loja_reembolsos, public.carteira_lancamentos, public.produtos
FROM anon, authenticated;

REVOKE INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER
ON public.orcamentos, public.ordens_compra, public.cupons_loja, public.cupons_ativados
FROM anon, authenticated;

-- Reembolso e carteira não ficam publicamente legíveis.
REVOKE SELECT ON public.loja_reembolsos, public.carteira_lancamentos FROM anon, authenticated;

NOTIFY pgrst, 'reload schema';
COMMIT;
