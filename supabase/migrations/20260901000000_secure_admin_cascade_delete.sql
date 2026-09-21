-- ====================================================================================
-- MIGRAÇÃO DEFINITIVA: TODAS AS CONSTRAINTS EM CASCADE + RPC DE INVENTÁRIO PRÉ-EXCLUSÃO
-- ====================================================================================

DO $$
DECLARE
  r RECORD;
BEGIN
  -- 1. Converter todas as constraints que apontam para clientes para CASCADE ou SET NULL
  FOR r IN (
    SELECT tc.table_schema, tc.table_name, tc.constraint_name, kcu.column_name
    FROM information_schema.table_constraints tc
    JOIN information_schema.key_column_usage kcu 
      ON tc.constraint_name = kcu.constraint_name AND tc.table_schema = kcu.table_schema
    JOIN information_schema.constraint_column_usage ccu 
      ON ccu.constraint_name = tc.constraint_name AND ccu.table_schema = tc.table_schema
    JOIN information_schema.referential_constraints rc 
      ON rc.constraint_name = tc.constraint_name
    WHERE tc.constraint_type = 'FOREIGN KEY'
      AND ccu.table_name = 'clientes'
      AND rc.delete_rule IN ('NO ACTION', 'RESTRICT')
  ) LOOP
    EXECUTE format('ALTER TABLE %I.%I DROP CONSTRAINT IF EXISTS %I', r.table_schema, r.table_name, r.constraint_name);
    EXECUTE format('ALTER TABLE %I.%I ADD CONSTRAINT %I FOREIGN KEY (%I) REFERENCES public.clientes(id) ON DELETE CASCADE', 
      r.table_schema, r.table_name, r.constraint_name, r.column_name);
  END LOOP;

  -- 2. Converter todas as constraints que apontam para gsa_afiliados para CASCADE
  FOR r IN (
    SELECT tc.table_schema, tc.table_name, tc.constraint_name, kcu.column_name
    FROM information_schema.table_constraints tc
    JOIN information_schema.key_column_usage kcu 
      ON tc.constraint_name = kcu.constraint_name AND tc.table_schema = kcu.table_schema
    JOIN information_schema.constraint_column_usage ccu 
      ON ccu.constraint_name = tc.constraint_name AND ccu.table_schema = tc.table_schema
    JOIN information_schema.referential_constraints rc 
      ON rc.constraint_name = tc.constraint_name
    WHERE tc.constraint_type = 'FOREIGN KEY'
      AND ccu.table_name = 'gsa_afiliados'
      AND rc.delete_rule IN ('NO ACTION', 'RESTRICT')
  ) LOOP
    EXECUTE format('ALTER TABLE %I.%I DROP CONSTRAINT IF EXISTS %I', r.table_schema, r.table_name, r.constraint_name);
    EXECUTE format('ALTER TABLE %I.%I ADD CONSTRAINT %I FOREIGN KEY (%I) REFERENCES public.gsa_afiliados(id) ON DELETE CASCADE', 
      r.table_schema, r.table_name, r.constraint_name, r.column_name);
  END LOOP;

  -- 3. Converter constraints em ordens_servico, orcamentos, faturas
  FOR r IN (
    SELECT tc.table_schema, tc.table_name, tc.constraint_name, kcu.column_name, ccu.table_name as ref_table
    FROM information_schema.table_constraints tc
    JOIN information_schema.key_column_usage kcu 
      ON tc.constraint_name = kcu.constraint_name AND tc.table_schema = kcu.table_schema
    JOIN information_schema.constraint_column_usage ccu 
      ON ccu.constraint_name = tc.constraint_name AND ccu.table_schema = tc.table_schema
    JOIN information_schema.referential_constraints rc 
      ON rc.constraint_name = tc.constraint_name
    WHERE tc.constraint_type = 'FOREIGN KEY'
      AND ccu.table_name IN ('orcamentos', 'ordens_servico', 'faturas')
      AND rc.delete_rule IN ('NO ACTION', 'RESTRICT')
  ) LOOP
    EXECUTE format('ALTER TABLE %I.%I DROP CONSTRAINT IF EXISTS %I', r.table_schema, r.table_name, r.constraint_name);
    EXECUTE format('ALTER TABLE %I.%I ADD CONSTRAINT %I FOREIGN KEY (%I) REFERENCES public.%I(id) ON DELETE CASCADE', 
      r.table_schema, r.table_name, r.constraint_name, r.column_name, r.ref_table);
  END LOOP;
END;
$$;

-- 4. Função RPC para Obter o Inventário Completo de Dependências do Cliente
CREATE OR REPLACE FUNCTION public.gsa_admin_get_client_deletion_inventory(
  p_sessao_id uuid,
  p_session_token text,
  p_client_ids uuid[]
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_actor record;
  v_res jsonb;
  v_orc_count integer := 0;
  v_os_count integer := 0;
  v_fat_count integer := 0;
  v_fat_valor_total numeric(14,2) := 0;
  v_saldo_carteira_total numeric(14,2) := 0;
  v_pontos_total bigint := 0;
  v_afiliados_count integer := 0;
  v_vouchers_count integer := 0;
  v_tickets_count integer := 0;
  v_pedidos_count integer := 0;
  v_docs_count integer := 0;
  v_clientes_list jsonb := '[]'::jsonb;
BEGIN
  -- Validar sessão do admin
  SELECT * INTO v_actor
  FROM public.gsa_admin_session_actor(p_sessao_id, p_session_token)
  LIMIT 1;

  IF v_actor.ator_tipo NOT IN ('admin', 'colaborador') THEN
    RETURN jsonb_build_object('success', false, 'error', 'Sessão administrativa inválida ou não autorizada.');
  END IF;

  IF p_client_ids IS NULL OR array_length(p_client_ids, 1) IS NULL THEN
    RETURN jsonb_build_object('success', true, 'total_clientes', 0);
  END IF;

  -- Contagens agregadas
  SELECT coalesce(count(*), 0) INTO v_orc_count FROM public.orcamentos WHERE cliente_id = ANY(p_client_ids);
  SELECT coalesce(count(*), 0) INTO v_os_count FROM public.ordens_servico WHERE cliente_id = ANY(p_client_ids);
  SELECT coalesce(count(*), 0), coalesce(sum(valor_total), 0) INTO v_fat_count, v_fat_valor_total FROM public.faturas WHERE cliente_id = ANY(p_client_ids);
  SELECT coalesce(sum(saldo_carteira), 0), coalesce(sum(pontos_fidelidade), 0) INTO v_saldo_carteira_total, v_pontos_total FROM public.clientes WHERE id = ANY(p_client_ids);
  SELECT coalesce(count(*), 0) INTO v_afiliados_count FROM public.gsa_afiliados WHERE cliente_id = ANY(p_client_ids);
  SELECT coalesce(count(*), 0) INTO v_vouchers_count FROM public.vouchers WHERE cliente_id = ANY(p_client_ids);
  SELECT coalesce(count(*), 0) INTO v_tickets_count FROM public.tickets WHERE cliente_id = ANY(p_client_ids);
  SELECT coalesce(count(*), 0) INTO v_pedidos_count FROM public.loja_pedidos WHERE cliente_id = ANY(p_client_ids);
  SELECT coalesce(count(*), 0) INTO v_docs_count FROM public.cliente_documentos WHERE cliente_id = ANY(p_client_ids);

  -- Lista de clientes com resumo
  SELECT coalesce(jsonb_agg(jsonb_build_object(
    'id', c.id,
    'nome', coalesce(c.nome_razao, c.nome, 'Cliente sem nome'),
    'documento', coalesce(c.cpf_cnpj, c.cpf, c.cnpj, 'S/D'),
    'email', c.email,
    'telefone', c.telefone,
    'saldo_carteira', coalesce(c.saldo_carteira, 0),
    'pontos_fidelidade', coalesce(c.pontos_fidelidade, 0),
    'orcamentos_count', (SELECT count(*) FROM public.orcamentos WHERE cliente_id = c.id),
    'os_count', (SELECT count(*) FROM public.ordens_servico WHERE cliente_id = c.id),
    'faturas_count', (SELECT count(*) FROM public.faturas WHERE cliente_id = c.id),
    'is_afiliado', EXISTS(SELECT 1 FROM public.gsa_afiliados WHERE cliente_id = c.id)
  )), '[]'::jsonb) INTO v_clientes_list
  FROM public.clientes c
  WHERE c.id = ANY(p_client_ids);

  RETURN jsonb_build_object(
    'success', true,
    'total_clientes', array_length(p_client_ids, 1),
    'orcamentos_count', v_orc_count,
    'os_count', v_os_count,
    'faturas_count', v_fat_count,
    'faturas_valor_total', v_fat_valor_total,
    'saldo_carteira_total', v_saldo_carteira_total,
    'pontos_total', v_pontos_total,
    'afiliados_count', v_afiliados_count,
    'vouchers_count', v_vouchers_count,
    'tickets_count', v_tickets_count,
    'pedidos_count', v_pedidos_count,
    'docs_count', v_docs_count,
    'clientes', v_clientes_list
  );
END;
$$;

-- 5. Atualizar RPC de exclusão definitiva em cascata
CREATE OR REPLACE FUNCTION public.gsa_admin_delete_entity_cascade(
  p_sessao_id uuid,
  p_session_token text,
  p_entity_type text,
  p_entity_id uuid,
  p_reason text DEFAULT 'Exclusão administrativa em cascata'
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_actor record;
  v_type text := lower(trim(coalesce(p_entity_type, '')));
  v_af_ids uuid[];
BEGIN
  -- Validar sessão do admin
  SELECT * INTO v_actor
  FROM public.gsa_admin_session_actor(p_sessao_id, p_session_token)
  LIMIT 1;

  IF v_actor.ator_tipo NOT IN ('admin', 'colaborador') THEN
    RETURN jsonb_build_object('success', false, 'error', 'Sessão administrativa inválida ou não autorizada.');
  END IF;

  IF v_type = 'cliente' THEN
    -- Desvincular qualquer atribuição de afiliado antes da exclusão
    UPDATE public.orcamentos SET affiliate_attribution_id = NULL WHERE affiliate_attribution_id IN (SELECT id FROM public.gsa_afiliado_atribuicoes WHERE cliente_id = p_entity_id);
    UPDATE public.faturas SET affiliate_attribution_id = NULL WHERE affiliate_attribution_id IN (SELECT id FROM public.gsa_afiliado_atribuicoes WHERE cliente_id = p_entity_id);

    -- Excluir transferências de afiliados explicitamente
    SELECT coalesce(array_agg(id), ARRAY[]::uuid[]) INTO v_af_ids FROM public.gsa_afiliados WHERE cliente_id = p_entity_id;
    IF array_length(v_af_ids, 1) > 0 THEN
      DELETE FROM public.gsa_afiliado_transferencias WHERE remetente_afiliado_id = ANY(v_af_ids) OR destinatario_afiliado_id = ANY(v_af_ids) OR estornada_por_afiliado_id = ANY(v_af_ids);
      DELETE FROM public.gsa_afiliados WHERE id = ANY(v_af_ids);
    END IF;

    -- Deletar o cliente com cascata automática no PostgreSQL
    DELETE FROM public.clientes WHERE id = p_entity_id;

  ELSIF v_type = 'orcamento' THEN
    DELETE FROM public.orcamentos WHERE id = p_entity_id;

  ELSIF v_type = 'ordem_servico' THEN
    DELETE FROM public.ordens_servico WHERE id = p_entity_id;

  ELSIF v_type = 'fatura' THEN
    DELETE FROM public.faturas WHERE id = p_entity_id;

  ELSE
    EXECUTE format('DELETE FROM public.%I WHERE id = $1', v_type) USING p_entity_id;
  END IF;

  INSERT INTO public.sistema_logs(acao, detalhes, ator_tipo, ator_id, ator_nome)
  VALUES (
    'EXCLUSAO_CASCATA_' || upper(v_type),
    jsonb_build_object('entity_type', v_type, 'entity_id', p_entity_id, 'motivo', p_reason)::text,
    v_actor.ator_tipo,
    v_actor.ator_id,
    v_actor.ator_nome
  );

  RETURN jsonb_build_object(
    'success', true,
    'entity_type', v_type,
    'entity_id', p_entity_id,
    'deleted_count', 1,
    'message', 'Entidade e dependências excluídas com sucesso em cascata.'
  );
END;
$$;

-- 6. Atualizar RPC de exclusão em lote
CREATE OR REPLACE FUNCTION public.gsa_admin_delete_batch(
  p_sessao_id uuid,
  p_session_token text,
  p_entity_type text,
  p_entity_ids uuid[],
  p_reason text DEFAULT 'Exclusão em lote administrativa'
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_actor record;
  v_id uuid;
  v_deleted integer := 0;
  v_errors jsonb := '[]'::jsonb;
  v_res jsonb;
BEGIN
  SELECT * INTO v_actor
  FROM public.gsa_admin_session_actor(p_sessao_id, p_session_token)
  LIMIT 1;

  IF v_actor.ator_tipo NOT IN ('admin', 'colaborador') THEN
    RETURN jsonb_build_object('success', false, 'error', 'Sessão administrativa inválida ou não autorizada.');
  END IF;

  FOREACH v_id IN ARRAY coalesce(p_entity_ids, ARRAY[]::uuid[]) LOOP
    BEGIN
      v_res := public.gsa_admin_delete_entity_cascade(p_sessao_id, p_session_token, p_entity_type, v_id, p_reason);
      IF (v_res->>'success')::boolean = true THEN
        v_deleted := v_deleted + 1;
      ELSE
        v_errors := v_errors || jsonb_build_object('id', v_id, 'error', v_res->>'error');
      END IF;
    EXCEPTION WHEN OTHERS THEN
      v_errors := v_errors || jsonb_build_object('id', v_id, 'error', SQLERRM);
    END;
  END LOOP;

  RETURN jsonb_build_object(
    'success', v_deleted > 0 OR jsonb_array_length(v_errors) = 0,
    'total', coalesce(array_length(p_entity_ids, 1), 0),
    'deleted', v_deleted,
    'errors', v_errors
  );
END;
$$;

-- 7. Privilégios
GRANT EXECUTE ON FUNCTION public.gsa_admin_get_client_deletion_inventory(uuid, text, uuid[]) TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.gsa_admin_delete_entity_cascade(uuid, text, text, uuid, text) TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.gsa_admin_delete_batch(uuid, text, text, uuid[], text) TO anon, authenticated, service_role;

-- 8. Recarregar PostgREST
NOTIFY pgrst, 'reload config';
NOTIFY pgrst, 'reload schema';
