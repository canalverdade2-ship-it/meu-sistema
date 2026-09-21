-- Hardening final do fluxo de fornecedores: ACL/RLS, Storage,
-- conciliacao financeira e revisao de dados bancarios.

BEGIN;

ALTER TABLE public.fornecedores
  ADD COLUMN IF NOT EXISTS dados_bancarios_pendentes jsonb,
  ADD COLUMN IF NOT EXISTS dados_bancarios_pendentes_em timestamptz,
  ADD COLUMN IF NOT EXISTS dados_bancarios_revisado_em timestamptz,
  ADD COLUMN IF NOT EXISTS dados_bancarios_revisado_por uuid,
  ADD COLUMN IF NOT EXISTS dados_bancarios_revisao_status text,
  ADD COLUMN IF NOT EXISTS dados_bancarios_revisao_motivo text;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'public.fornecedores'::regclass
      AND conname = 'fornecedores_dados_bancarios_revisao_status_check'
  ) THEN
    ALTER TABLE public.fornecedores
      ADD CONSTRAINT fornecedores_dados_bancarios_revisao_status_check
      CHECK (dados_bancarios_revisao_status IS NULL
        OR dados_bancarios_revisao_status IN ('aprovado', 'reprovado'));
  END IF;
END;
$$;

-- Remove a policy permissiva criada pela migration generica e restaura
-- o modelo de acesso por RPC SECURITY DEFINER.
DO $$
DECLARE
  v_table text;
BEGIN
  FOREACH v_table IN ARRAY ARRAY[
    'fornecedores', 'fornecedor_produtos', 'fornecedor_produto_solicitacoes',
    'pedidos_compra_fornecedor', 'pedido_compra_fornecedor_itens',
    'fornecedor_entregas', 'fornecedor_entrega_itens', 'contas_pagar',
    'fornecedor_auditoria', 'fornecedor_notificacoes'
  ] LOOP
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', v_table);
    EXECUTE format('DROP POLICY IF EXISTS "Allow All Access" ON public.%I', v_table);
    EXECUTE format('REVOKE ALL ON TABLE public.%I FROM PUBLIC, anon, authenticated', v_table);
  END LOOP;
END;
$$;

-- Restaura o bucket privado que o portal utiliza para NFs e comprovantes.
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'documentos_fornecedor', 'documentos_fornecedor', false, 10485760,
  ARRAY['application/pdf', 'application/xml', 'text/xml', 'image/png', 'image/jpeg']
)
ON CONFLICT (id) DO UPDATE
SET public = false,
    file_size_limit = EXCLUDED.file_size_limit,
    allowed_mime_types = EXCLUDED.allowed_mime_types;

-- Recria as policies do Storage com escopo por ator/sessao.
DROP POLICY IF EXISTS supplier_documents_select ON storage.objects;
CREATE POLICY supplier_documents_select ON storage.objects
FOR SELECT TO authenticated
USING (
  bucket_id = 'documentos_fornecedor'
  AND public.gsa_supplier_document_allowed(name, false)
);

DROP POLICY IF EXISTS supplier_documents_insert ON storage.objects;
CREATE POLICY supplier_documents_insert ON storage.objects
FOR INSERT TO authenticated
WITH CHECK (
  bucket_id = 'documentos_fornecedor'
  AND public.gsa_supplier_document_allowed(name, true)
);

DROP POLICY IF EXISTS supplier_documents_update ON storage.objects;
CREATE POLICY supplier_documents_update ON storage.objects
FOR UPDATE TO authenticated
USING (
  bucket_id = 'documentos_fornecedor'
  AND public.gsa_supplier_document_allowed(name, true)
)
WITH CHECK (
  bucket_id = 'documentos_fornecedor'
  AND public.gsa_supplier_document_allowed(name, true)
);

DROP POLICY IF EXISTS supplier_documents_delete ON storage.objects;
CREATE POLICY supplier_documents_delete ON storage.objects
FOR DELETE TO authenticated
USING (
  bucket_id = 'documentos_fornecedor'
  AND public.gsa_supplier_document_allowed(name, true)
);

-- As operacoes do fornecedor exigem sessao Supabase autenticada.
REVOKE EXECUTE ON FUNCTION public.gsa_supplier_session_access_state() FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.gsa_supplier_dashboard_snapshot() FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.gsa_supplier_update_profile(jsonb) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.gsa_supplier_request_product(jsonb) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.gsa_supplier_mark_order_seen(uuid) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.gsa_supplier_mark_notification_read(uuid) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.gsa_supplier_mark_notifications_read() FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.gsa_supplier_submit_delivery(uuid, uuid, jsonb) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.gsa_supplier_document_allowed(text, boolean) FROM PUBLIC, anon;

GRANT EXECUTE ON FUNCTION public.gsa_supplier_session_access_state() TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.gsa_supplier_dashboard_snapshot() TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.gsa_supplier_update_profile(jsonb) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.gsa_supplier_request_product(jsonb) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.gsa_supplier_mark_order_seen(uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.gsa_supplier_mark_notification_read(uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.gsa_supplier_mark_notifications_read() TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.gsa_supplier_submit_delivery(uuid, uuid, jsonb) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.gsa_supplier_document_allowed(text, boolean) TO authenticated, service_role;

-- Dados de contato entram imediatamente; dados bancarios passam por revisao.
CREATE OR REPLACE FUNCTION public.gsa_supplier_update_profile(p_payload jsonb)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_id uuid := public.gsa_assert_current_supplier();
  v_payload jsonb := coalesce(p_payload, '{}'::jsonb);
  v_email text := lower(trim(coalesce(v_payload->>'email', '')));
  v_phone text := regexp_replace(coalesce(v_payload->>'telefone', ''), '\D', '', 'g');
  v_zip text := regexp_replace(coalesce(v_payload->>'cep', ''), '\D', '', 'g');
  v_bank jsonb := coalesce(v_payload->'dados_bancarios', '{}'::jsonb);
  v_bank_clean jsonb;
  v_current_bank jsonb;
  v_pending_bank jsonb;
  v_bank_changed boolean := false;
BEGIN
  IF pg_column_size(v_payload) > 24576 THEN RAISE EXCEPTION 'Dados excedem o limite permitido.'; END IF;
  IF length(v_email) > 254 OR v_email !~* '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$' THEN
    RAISE EXCEPTION 'E-mail invalido.';
  END IF;
  IF length(v_phone) NOT IN (10, 11) THEN RAISE EXCEPTION 'Telefone invalido.'; END IF;
  IF v_zip <> '' AND length(v_zip) <> 8 THEN RAISE EXCEPTION 'CEP invalido.'; END IF;
  IF jsonb_typeof(v_bank) <> 'object' THEN RAISE EXCEPTION 'Dados bancarios invalidos.'; END IF;

  v_bank_clean := jsonb_strip_nulls(jsonb_build_object(
    'banco', nullif(left(trim(coalesce(v_bank->>'banco', '')), 120), ''),
    'agencia', nullif(left(trim(coalesce(v_bank->>'agencia', '')), 40), ''),
    'conta', nullif(left(trim(coalesce(v_bank->>'conta', '')), 60), ''),
    'tipo_conta', nullif(left(trim(coalesce(v_bank->>'tipo_conta', '')), 40), ''),
    'tipo_chave_pix', nullif(left(trim(coalesce(v_bank->>'tipo_chave_pix', '')), 40), ''),
    'chave_pix', nullif(left(trim(coalesce(v_bank->>'chave_pix', '')), 180), ''),
    'titular', nullif(left(trim(coalesce(v_bank->>'titular', '')), 180), ''),
    'documento_titular', nullif(left(regexp_replace(coalesce(v_bank->>'documento_titular', ''), '\D', '', 'g'), 14), '')
  ));

  SELECT coalesce(dados_bancarios, '{}'::jsonb), dados_bancarios_pendentes
  INTO v_current_bank, v_pending_bank
  FROM public.fornecedores
  WHERE id = v_id
  FOR UPDATE;

  IF NOT FOUND THEN RAISE EXCEPTION 'Fornecedor nao encontrado.'; END IF;
  v_bank_changed := v_bank_clean IS DISTINCT FROM v_current_bank;

  IF v_bank_changed AND v_pending_bank IS NOT NULL THEN
    RAISE EXCEPTION 'Ja existe uma alteracao bancaria aguardando analise.';
  END IF;

  UPDATE public.fornecedores
  SET email = v_email,
      telefone = v_phone,
      cep = nullif(v_zip, ''),
      endereco = nullif(left(trim(coalesce(v_payload->>'endereco', '')), 220), ''),
      numero = nullif(left(trim(coalesce(v_payload->>'numero', '')), 40), ''),
      complemento = nullif(left(trim(coalesce(v_payload->>'complemento', '')), 120), ''),
      bairro = nullif(left(trim(coalesce(v_payload->>'bairro', '')), 120), ''),
      cidade = nullif(left(trim(coalesce(v_payload->>'cidade', '')), 120), ''),
      estado = nullif(left(upper(trim(coalesce(v_payload->>'estado', ''))), 2), ''),
      dados_bancarios_pendentes = CASE WHEN v_bank_changed THEN v_bank_clean ELSE dados_bancarios_pendentes END,
      dados_bancarios_pendentes_em = CASE WHEN v_bank_changed THEN now() ELSE dados_bancarios_pendentes_em END,
      dados_bancarios_revisao_status = CASE WHEN v_bank_changed THEN NULL ELSE dados_bancarios_revisao_status END,
      dados_bancarios_revisao_motivo = CASE WHEN v_bank_changed THEN NULL ELSE dados_bancarios_revisao_motivo END,
      updated_at = now()
  WHERE id = v_id;

  IF v_bank_changed THEN
    PERFORM set_config('gsa.system_override', 'on', true);
    INSERT INTO public.notificacoes(
      titulo, mensagem, modulo, tab, item_id, tipo,
      destinatario_tipo, prioridade, acao_origem, contexto
    ) VALUES (
      'Fornecedor alterou dados bancarios',
      'Ha uma alteracao de dados de recebimento aguardando conferencia.',
      'fornecedores', 'cadastros', v_id::text, 'sistema',
      'admin', 'alta', 'fornecedor_dados_bancarios_pendentes',
      jsonb_build_object('fornecedor_id', v_id)
    );

    INSERT INTO public.fornecedor_notificacoes(
      fornecedor_id, titulo, mensagem, modulo
    ) VALUES (
      v_id,
      'Dados bancarios em analise',
      'A alteracao dos dados de recebimento foi enviada para conferencia. Os dados anteriores permanecem validos ate a aprovacao.',
      'perfil'
    );
  END IF;

  INSERT INTO public.fornecedor_auditoria(
    fornecedor_id, ator_tipo, ator_id, acao, entidade, entidade_id, detalhes
  ) VALUES (
    v_id, 'fornecedor', v_id, 'ATUALIZAR_PERFIL', 'fornecedores', v_id,
    jsonb_build_object(
      'alteracao_bancaria_solicitada', v_bank_changed,
      'campos_bancarios', CASE WHEN v_bank_changed THEN ARRAY(SELECT jsonb_object_keys(v_bank_clean)) ELSE ARRAY[]::text[] END
    )
  );

  RETURN jsonb_build_object(
    'success', true,
    'supplier_id', v_id,
    'bank_change_pending', v_bank_changed OR v_pending_bank IS NOT NULL
  );
END;
$$;

REVOKE EXECUTE ON FUNCTION public.gsa_supplier_update_profile(jsonb) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.gsa_supplier_update_profile(jsonb) TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.gsa_admin_review_supplier_bank_change(
  p_sessao_id uuid,
  p_session_token text,
  p_supplier_id uuid,
  p_approve boolean,
  p_reason text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_actor jsonb := public.gsa_admin_validate_context(p_sessao_id, p_session_token);
  v_supplier public.fornecedores%rowtype;
  v_pending jsonb;
  v_reason text := nullif(trim(coalesce(p_reason, '')), '');
BEGIN
  IF NOT public.gsa_admin_has_module('fornecedores') THEN
    RAISE EXCEPTION 'Sem permissao para Fornecedores.' USING ERRCODE = '42501';
  END IF;
  IF p_approve IS NULL THEN RAISE EXCEPTION 'Informe a decisao.'; END IF;

  SELECT * INTO v_supplier
  FROM public.fornecedores
  WHERE id = p_supplier_id
  FOR UPDATE;

  IF NOT FOUND THEN RAISE EXCEPTION 'Fornecedor nao encontrado.'; END IF;
  v_pending := v_supplier.dados_bancarios_pendentes;

  IF v_pending IS NULL THEN
    RETURN jsonb_build_object(
      'success', true,
      'already_processed', true,
      'status', v_supplier.dados_bancarios_revisao_status
    );
  END IF;

  IF NOT p_approve AND coalesce(length(v_reason), 0) < 3 THEN
    RAISE EXCEPTION 'Informe o motivo da recusa.';
  END IF;

  UPDATE public.fornecedores
  SET dados_bancarios = CASE WHEN p_approve THEN v_pending ELSE dados_bancarios END,
      dados_bancarios_pendentes = NULL,
      dados_bancarios_pendentes_em = NULL,
      dados_bancarios_revisado_em = now(),
      dados_bancarios_revisado_por = (v_actor->>'actor_id')::uuid,
      dados_bancarios_revisao_status = CASE WHEN p_approve THEN 'aprovado' ELSE 'reprovado' END,
      dados_bancarios_revisao_motivo = v_reason,
      updated_at = now()
  WHERE id = p_supplier_id;

  INSERT INTO public.fornecedor_notificacoes(
    fornecedor_id, titulo, mensagem, modulo
  ) VALUES (
    p_supplier_id,
    CASE WHEN p_approve THEN 'Dados bancarios aprovados' ELSE 'Alteracao bancaria recusada' END,
    CASE WHEN p_approve
      THEN 'Os novos dados de recebimento foram aprovados e ja estao ativos.'
      ELSE 'A alteracao dos dados de recebimento nao foi aprovada. ' || coalesce(v_reason, '')
    END,
    'perfil'
  );

  INSERT INTO public.fornecedor_auditoria(
    fornecedor_id, ator_tipo, ator_id, ator_nome,
    acao, entidade, entidade_id, detalhes
  ) VALUES (
    p_supplier_id,
    v_actor->>'actor_type',
    (v_actor->>'actor_id')::uuid,
    v_actor->>'actor_name',
    CASE WHEN p_approve THEN 'APROVAR_DADOS_BANCARIOS' ELSE 'REPROVAR_DADOS_BANCARIOS' END,
    'fornecedores', p_supplier_id,
    jsonb_build_object(
      'aprovado', p_approve,
      'motivo', v_reason,
      'campos', ARRAY(SELECT jsonb_object_keys(v_pending))
    )
  );

  RETURN jsonb_build_object(
    'success', true,
    'already_processed', false,
    'status', CASE WHEN p_approve THEN 'aprovado' ELSE 'reprovado' END
  );
END;
$$;

REVOKE ALL ON FUNCTION public.gsa_admin_review_supplier_bank_change(uuid, text, uuid, boolean, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.gsa_admin_review_supplier_bank_change(uuid, text, uuid, boolean, text)
TO anon, authenticated, service_role;

-- A entrega passa a ser conciliada integralmente com o pedido de compra.
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
  v_supplied_cost numeric;
  v_calculated_total numeric := 0;
  v_declared_total numeric;
  v_xml text := nullif(trim(v_payload->>'arquivo_xml'), '');
  v_pdf text := nullif(trim(v_payload->>'arquivo_pdf'), '');
  v_key text := nullif(regexp_replace(coalesce(v_payload->>'chave_nfe', ''), '\D', '', 'g'), '');
  v_note_number text := trim(coalesce(v_payload->>'numero_nota', ''));
  v_issue_date date;
BEGIN
  IF p_request_id IS NULL THEN RAISE EXCEPTION 'Identificador da operacao obrigatorio.'; END IF;

  SELECT id INTO v_delivery_id
  FROM public.fornecedor_entregas
  WHERE request_id = p_request_id;
  IF v_delivery_id IS NOT NULL THEN
    RETURN jsonb_build_object('success', true, 'already_processed', true, 'delivery_id', v_delivery_id);
  END IF;

  IF pg_column_size(v_payload) > 65536 THEN RAISE EXCEPTION 'Dados da entrega excedem o limite permitido.'; END IF;

  SELECT * INTO v_order
  FROM public.pedidos_compra_fornecedor
  WHERE id = p_order_id AND fornecedor_id = v_id
  FOR UPDATE;
  IF NOT FOUND OR v_order.status IN ('rascunho', 'cancelado', 'concluido') THEN
    RAISE EXCEPTION 'Pedido indisponivel para entrega.';
  END IF;
  IF jsonb_typeof(v_payload->'items') <> 'array' OR jsonb_array_length(v_payload->'items') = 0 THEN
    RAISE EXCEPTION 'Informe os itens entregues.';
  END IF;
  IF v_xml IS NULL AND v_pdf IS NULL THEN RAISE EXCEPTION 'Envie o XML ou PDF da nota fiscal.'; END IF;
  IF v_note_number = '' OR length(v_note_number) > 80 THEN RAISE EXCEPTION 'Informe um numero de nota fiscal valido.'; END IF;
  IF v_key IS NOT NULL AND length(v_key) <> 44 THEN RAISE EXCEPTION 'A chave da NF-e deve possuir 44 digitos.'; END IF;

  BEGIN
    v_issue_date := nullif(v_payload->>'data_emissao', '')::date;
    v_declared_total := nullif(v_payload->>'valor_total_nota', '')::numeric;
  EXCEPTION WHEN invalid_text_representation OR datetime_field_overflow OR numeric_value_out_of_range THEN
    RAISE EXCEPTION 'Data de emissao ou valor total da nota invalido.';
  END;
  IF v_issue_date IS NULL THEN RAISE EXCEPTION 'Informe a data de emissao.'; END IF;
  IF v_declared_total IS NULL OR v_declared_total < 0 THEN RAISE EXCEPTION 'Informe um valor total valido.'; END IF;

  IF v_xml IS NOT NULL AND v_xml <> (
    'storage://documentos_fornecedor/' || v_id::text || '/notas-fiscais/' || p_order_id::text || '/' || p_request_id::text || '.xml'
  ) THEN
    RAISE EXCEPTION 'Referencia XML invalida para esta operacao.';
  END IF;
  IF v_pdf IS NOT NULL AND v_pdf <> (
    'storage://documentos_fornecedor/' || v_id::text || '/notas-fiscais/' || p_order_id::text || '/' || p_request_id::text || '.pdf'
  ) THEN
    RAISE EXCEPTION 'Referencia PDF invalida para esta operacao.';
  END IF;

  -- Primeira passada: trava os itens, valida saldo/preco e calcula o total no servidor.
  FOR v_item IN SELECT value FROM jsonb_array_elements(v_payload->'items') LOOP
    SELECT * INTO v_order_item
    FROM public.pedido_compra_fornecedor_itens
    WHERE id = (v_item->>'pedido_item_id')::uuid AND pedido_id = p_order_id
    FOR UPDATE;
    IF NOT FOUND THEN RAISE EXCEPTION 'Item nao pertence ao pedido.'; END IF;

    v_quantity := coalesce((v_item->>'quantidade_entregue')::integer, 0);
    SELECT v_order_item.quantidade_pedida - v_order_item.quantidade_aprovada - coalesce(sum(ei.quantidade_entregue), 0)
    INTO v_pending
    FROM public.fornecedor_entrega_itens ei
    JOIN public.fornecedor_entregas e ON e.id = ei.entrega_id
    WHERE ei.pedido_item_id = v_order_item.id
      AND e.status = 'em_analise';

    IF v_quantity <= 0 OR v_quantity > v_pending THEN
      RAISE EXCEPTION 'Quantidade entregue excede o saldo pendente de %.', v_order_item.produto_nome_snapshot;
    END IF;

    BEGIN
      v_supplied_cost := coalesce(nullif(v_item->>'custo_unitario_nota', '')::numeric, v_order_item.custo_unitario);
    EXCEPTION WHEN invalid_text_representation OR numeric_value_out_of_range THEN
      RAISE EXCEPTION 'Custo unitario invalido para %.', v_order_item.produto_nome_snapshot;
    END;

    IF abs(v_supplied_cost - v_order_item.custo_unitario) > 0.01 THEN
      RAISE EXCEPTION 'O custo unitario de % deve corresponder ao pedido de compra.', v_order_item.produto_nome_snapshot;
    END IF;

    v_calculated_total := v_calculated_total + (v_quantity * v_order_item.custo_unitario);
  END LOOP;

  v_calculated_total := round(v_calculated_total, 2);
  IF abs(v_declared_total - v_calculated_total) > 0.01 THEN
    RAISE EXCEPTION 'Valor total da nota divergente do pedido. Total esperado: R$ %.', to_char(v_calculated_total, 'FM999G999G990D00');
  END IF;

  INSERT INTO public.fornecedor_entregas(
    pedido_id, fornecedor_id, numero_nota, serie_nota, chave_nfe, data_emissao,
    valor_total_nota, vencimento, arquivo_xml, arquivo_pdf, observacoes, request_id
  ) VALUES (
    p_order_id, v_id, v_note_number, nullif(trim(v_payload->>'serie_nota'), ''),
    v_key, v_issue_date, v_calculated_total,
    coalesce(nullif(v_payload->>'vencimento', '')::date, v_order.vencimento_previsto, current_date + 7),
    v_xml, v_pdf, nullif(trim(v_payload->>'observacoes'), ''), p_request_id
  ) RETURNING id INTO v_delivery_id;

  -- Segunda passada: persiste exatamente preco e quantidade conciliados.
  FOR v_item IN SELECT value FROM jsonb_array_elements(v_payload->'items') LOOP
    SELECT * INTO v_order_item
    FROM public.pedido_compra_fornecedor_itens
    WHERE id = (v_item->>'pedido_item_id')::uuid AND pedido_id = p_order_id;

    v_quantity := (v_item->>'quantidade_entregue')::integer;
    INSERT INTO public.fornecedor_entrega_itens(
      entrega_id, pedido_item_id, produto_id, quantidade_entregue,
      custo_unitario_nota, lote, validade
    ) VALUES (
      v_delivery_id, v_order_item.id, v_order_item.produto_id, v_quantity,
      v_order_item.custo_unitario,
      nullif(trim(v_item->>'lote'), ''), nullif(v_item->>'validade', '')::date
    );
  END LOOP;

  UPDATE public.fornecedor_entregas
  SET status = 'cancelado'
  WHERE pedido_id = p_order_id
    AND fornecedor_id = v_id
    AND status = 'ajuste_solicitado'
    AND id <> v_delivery_id;

  UPDATE public.pedidos_compra_fornecedor
  SET status = 'em_analise'
  WHERE id = p_order_id;

  INSERT INTO public.fornecedor_auditoria(
    fornecedor_id, ator_tipo, ator_id, acao, entidade, entidade_id, detalhes
  ) VALUES (
    v_id, 'fornecedor', v_id, 'ENVIAR_ENTREGA_NF',
    'fornecedor_entregas', v_delivery_id,
    jsonb_build_object(
      'pedido_id', p_order_id,
      'request_id', p_request_id,
      'valor_conciliado', v_calculated_total
    )
  );

  PERFORM set_config('gsa.system_override', 'on', true);
  INSERT INTO public.notificacoes(
    titulo, mensagem, modulo, tab, item_id, tipo,
    destinatario_tipo, prioridade, acao_origem, contexto
  ) VALUES (
    'Nova entrega de fornecedor aguardando analise',
    'A nota fiscal ' || v_note_number || ' foi enviada para conferencia.',
    'fornecedores', 'entregas', v_delivery_id::text, 'sistema',
    'admin', 'alta', 'entrega_fornecedor_enviada',
    jsonb_build_object(
      'fornecedor_id', v_id,
      'pedido_id', p_order_id,
      'entrega_id', v_delivery_id,
      'valor_conciliado', v_calculated_total
    )
  );

  RETURN jsonb_build_object(
    'success', true,
    'already_processed', false,
    'delivery_id', v_delivery_id,
    'total', v_calculated_total
  );
END;
$$;

REVOKE EXECUTE ON FUNCTION public.gsa_supplier_submit_delivery(uuid, uuid, jsonb) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.gsa_supplier_submit_delivery(uuid, uuid, jsonb)
TO authenticated, service_role;

-- A aprovacao administrativa revalida a conciliacao antes de mexer no estoque
-- ou criar qualquer obrigacao financeira.
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
  v_expected_total numeric := 0;
BEGIN
  IF NOT public.gsa_admin_has_module('fornecedores') THEN
    RAISE EXCEPTION 'Sem permissao para Fornecedores.' USING ERRCODE = '42501';
  END IF;

  SELECT * INTO v_delivery
  FROM public.fornecedor_entregas
  WHERE id = p_delivery_id
  FOR UPDATE;
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
        analisado_por_tipo = v_actor->>'actor_type',
        analisado_por_id = (v_actor->>'actor_id')::uuid,
        analisado_por_nome = v_actor->>'actor_name'
    WHERE id = p_delivery_id;
    UPDATE public.pedidos_compra_fornecedor SET status = 'parcial' WHERE id = v_delivery.pedido_id;
    INSERT INTO public.fornecedor_notificacoes(fornecedor_id, titulo, mensagem, modulo, item_id)
    VALUES (
      v_delivery.fornecedor_id, 'Nota fiscal requer atencao',
      trim(p_reason), 'entregas', p_delivery_id
    );
    RETURN jsonb_build_object(
      'success', true,
      'status', CASE WHEN v_action = 'ajuste' THEN 'ajuste_solicitado' ELSE 'reprovado' END
    );
  END IF;
  IF v_action <> 'aprovar' THEN RAISE EXCEPTION 'Acao invalida.'; END IF;

  SELECT * INTO v_order
  FROM public.pedidos_compra_fornecedor
  WHERE id = v_delivery.pedido_id
  FOR UPDATE;
  IF NOT FOUND OR v_order.fornecedor_id <> v_delivery.fornecedor_id THEN
    RAISE EXCEPTION 'Pedido da entrega invalido.';
  END IF;

  SELECT round(coalesce(sum(ei.quantidade_entregue * pi.custo_unitario), 0), 2)
  INTO v_expected_total
  FROM public.fornecedor_entrega_itens ei
  JOIN public.pedido_compra_fornecedor_itens pi ON pi.id = ei.pedido_item_id
  WHERE ei.entrega_id = p_delivery_id;

  IF abs(v_delivery.valor_total_nota - v_expected_total) > 0.01 THEN
    RAISE EXCEPTION 'Valor da NF divergente do pedido. Esperado R$ %, informado R$ %.',
      to_char(v_expected_total, 'FM999G999G990D00'),
      to_char(v_delivery.valor_total_nota, 'FM999G999G990D00');
  END IF;

  FOR v_item IN
    SELECT ei.*, pi.quantidade_pedida, pi.quantidade_aprovada,
           pi.produto_nome_snapshot, pi.custo_unitario AS custo_pedido
    FROM public.fornecedor_entrega_itens ei
    JOIN public.pedido_compra_fornecedor_itens pi ON pi.id = ei.pedido_item_id
    WHERE ei.entrega_id = p_delivery_id
    ORDER BY ei.id
    FOR UPDATE OF pi
  LOOP
    IF v_item.quantidade_aprovada + v_item.quantidade_entregue > v_item.quantidade_pedida THEN
      RAISE EXCEPTION 'A entrega excede o saldo do produto %.', v_item.produto_nome_snapshot;
    END IF;
    IF abs(v_item.custo_unitario_nota - v_item.custo_pedido) > 0.01 THEN
      RAISE EXCEPTION 'Custo da entrega divergente do pedido para %.', v_item.produto_nome_snapshot;
    END IF;

    SELECT * INTO v_product FROM public.produtos WHERE id = v_item.produto_id FOR UPDATE;
    IF NOT FOUND THEN RAISE EXCEPTION 'Produto da entrega nao encontrado.'; END IF;

    UPDATE public.produtos
    SET controle_estoque = true,
        estoque_disponivel = coalesce(estoque_disponivel, 0) + v_item.quantidade_entregue,
        valor_custo = v_item.custo_pedido
    WHERE id = v_item.produto_id;

    INSERT INTO public.loja_estoque_historico(
      produto_id, quantidade_anterior, ajuste, quantidade_atual, motivo,
      colaborador_nome, fornecedor_id, pedido_fornecedor_id,
      entrega_fornecedor_id, tipo_movimento
    ) VALUES (
      v_item.produto_id,
      coalesce(v_product.estoque_disponivel, 0),
      v_item.quantidade_entregue,
      coalesce(v_product.estoque_disponivel, 0) + v_item.quantidade_entregue,
      'Entrada aprovada da NF ' || v_delivery.numero_nota || ' - Pedido ' || v_order.codigo,
      v_actor->>'actor_name', v_delivery.fornecedor_id,
      v_order.id, v_delivery.id, 'entrada_fornecedor'
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
    v_expected_total, v_expected_total, v_delivery.data_emissao,
    coalesce(v_delivery.vencimento, v_order.vencimento_previsto, current_date + 7)
  ) RETURNING id INTO v_payable_id;

  UPDATE public.fornecedor_entregas
  SET status = 'aprovado',
      valor_total_nota = v_expected_total,
      motivo_analise = nullif(trim(p_reason), ''),
      analisado_em = now(),
      analisado_por_tipo = v_actor->>'actor_type',
      analisado_por_id = (v_actor->>'actor_id')::uuid,
      analisado_por_nome = v_actor->>'actor_name'
  WHERE id = p_delivery_id;

  SELECT bool_and(quantidade_aprovada >= quantidade_pedida)
  INTO v_completed
  FROM public.pedido_compra_fornecedor_itens
  WHERE pedido_id = v_order.id;

  UPDATE public.pedidos_compra_fornecedor
  SET status = CASE WHEN v_completed THEN 'concluido' ELSE 'parcial' END,
      concluido_em = CASE WHEN v_completed THEN now() ELSE NULL END
  WHERE id = v_order.id;

  INSERT INTO public.fornecedor_notificacoes(
    fornecedor_id, titulo, mensagem, modulo, item_id
  ) VALUES (
    v_delivery.fornecedor_id,
    'Entrega e nota fiscal aprovadas',
    'O estoque foi liberado e a conta a pagar foi criada pelo valor conciliado com o pedido.',
    'entregas', p_delivery_id
  );

  INSERT INTO public.fornecedor_auditoria(
    fornecedor_id, ator_tipo, ator_id, ator_nome,
    acao, entidade, entidade_id, detalhes
  ) VALUES (
    v_delivery.fornecedor_id,
    v_actor->>'actor_type',
    (v_actor->>'actor_id')::uuid,
    v_actor->>'actor_name',
    'APROVAR_ENTREGA_NF',
    'fornecedor_entregas', p_delivery_id,
    jsonb_build_object(
      'pedido_id', v_order.id,
      'conta_pagar_id', v_payable_id,
      'valor_conciliado', v_expected_total
    )
  );

  RETURN jsonb_build_object(
    'success', true, 'already_processed', false,
    'payable_id', v_payable_id, 'order_completed', v_completed,
    'total', v_expected_total
  );
END;
$$;

REVOKE ALL ON FUNCTION public.gsa_admin_review_supplier_delivery(uuid, text, uuid, text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.gsa_admin_review_supplier_delivery(uuid, text, uuid, text, text)
TO anon, authenticated, service_role;

-- Exibe inconsistencias historicas sem alterar pagamentos ja registrados.
CREATE OR REPLACE FUNCTION public.gsa_admin_supplier_financial_anomalies(
  p_sessao_id uuid,
  p_session_token text
)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_actor jsonb := public.gsa_admin_validate_context(p_sessao_id, p_session_token);
BEGIN
  IF NOT public.gsa_admin_has_module('fornecedores') THEN
    RAISE EXCEPTION 'Sem permissao para Fornecedores.' USING ERRCODE = '42501';
  END IF;

  RETURN coalesce((
    SELECT jsonb_agg(to_jsonb(x) ORDER BY x.created_at DESC)
    FROM (
      SELECT e.id AS entrega_id, e.fornecedor_id,
             coalesce(f.nome_fantasia, f.razao_social) AS fornecedor_nome,
             o.id AS pedido_id, o.codigo AS pedido_codigo,
             e.numero_nota, e.status AS entrega_status,
             o.valor_total_previsto,
             e.valor_total_nota,
             line_totals.valor_itens,
             c.id AS conta_pagar_id,
             c.status AS conta_status,
             c.valor_original AS conta_valor,
             abs(e.valor_total_nota - line_totals.valor_itens) AS diferenca_nf_itens,
             CASE WHEN c.id IS NULL THEN NULL ELSE abs(c.valor_original - line_totals.valor_itens) END AS diferenca_conta_itens,
             e.created_at
      FROM public.fornecedor_entregas e
      JOIN public.pedidos_compra_fornecedor o ON o.id = e.pedido_id
      JOIN public.fornecedores f ON f.id = e.fornecedor_id
      LEFT JOIN public.contas_pagar c ON c.entrega_id = e.id
      CROSS JOIN LATERAL (
        SELECT round(coalesce(sum(ei.quantidade_entregue * pi.custo_unitario), 0), 2) AS valor_itens
        FROM public.fornecedor_entrega_itens ei
        JOIN public.pedido_compra_fornecedor_itens pi ON pi.id = ei.pedido_item_id
        WHERE ei.entrega_id = e.id
      ) line_totals
      WHERE abs(e.valor_total_nota - line_totals.valor_itens) > 0.01
         OR (c.id IS NOT NULL AND abs(c.valor_original - line_totals.valor_itens) > 0.01)
    ) x
  ), '[]'::jsonb);
END;
$$;

REVOKE ALL ON FUNCTION public.gsa_admin_supplier_financial_anomalies(uuid, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.gsa_admin_supplier_financial_anomalies(uuid, text)
TO anon, authenticated, service_role;

NOTIFY pgrst, 'reload schema';
COMMIT;
