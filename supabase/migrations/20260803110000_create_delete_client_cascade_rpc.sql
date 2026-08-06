-- Migration: Create resilient delete_client_cascade RPC for safe client deletion
BEGIN;

CREATE OR REPLACE FUNCTION public.delete_client_cascade(p_cliente_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_affiliate_ids uuid[];
  v_os_ids uuid[];
  v_orcamento_ids uuid[];
  v_ticket_ids uuid[];
  v_emprestimo_ids uuid[];
BEGIN
  IF p_cliente_id IS NULL THEN
    RAISE EXCEPTION 'ID do cliente não fornecido.';
  END IF;

  -- Obter IDs de afiliados
  IF to_regclass('public.gsa_afiliados') IS NOT NULL THEN
    SELECT array_agg(id) INTO v_affiliate_ids FROM public.gsa_afiliados WHERE cliente_id = p_cliente_id;
  END IF;

  -- Obter IDs de orçamentos
  IF to_regclass('public.orcamentos') IS NOT NULL THEN
    SELECT array_agg(id) INTO v_orcamento_ids FROM public.orcamentos WHERE cliente_id = p_cliente_id;
  END IF;

  -- Obter IDs de ordens de serviço
  IF to_regclass('public.ordens_servico') IS NOT NULL THEN
    SELECT array_agg(id) INTO v_os_ids FROM public.ordens_servico WHERE cliente_id = p_cliente_id;
  END IF;

  -- Obter IDs de tickets
  IF to_regclass('public.tickets') IS NOT NULL THEN
    SELECT array_agg(id) INTO v_ticket_ids FROM public.tickets WHERE cliente_id = p_cliente_id;
  END IF;

  -- Obter IDs de empréstimos
  IF to_regclass('public.emprestimos') IS NOT NULL THEN
    SELECT array_agg(id) INTO v_emprestimo_ids FROM public.emprestimos WHERE cliente_id = p_cliente_id;
  END IF;

  -- 1. Tabelas de Afiliados
  IF to_regclass('public.gsa_afiliado_pontos_eventos') IS NOT NULL THEN
    DELETE FROM public.gsa_afiliado_pontos_eventos WHERE cliente_id = p_cliente_id OR (v_affiliate_ids IS NOT NULL AND afiliado_id = ANY(v_affiliate_ids));
  END IF;
  IF to_regclass('public.gsa_afiliado_comissao_eventos') IS NOT NULL AND v_affiliate_ids IS NOT NULL THEN
    DELETE FROM public.gsa_afiliado_comissao_eventos WHERE afiliado_id = ANY(v_affiliate_ids);
  END IF;
  IF to_regclass('public.gsa_afiliado_saques') IS NOT NULL AND v_affiliate_ids IS NOT NULL THEN
    DELETE FROM public.gsa_afiliado_saques WHERE afiliado_id = ANY(v_affiliate_ids);
  END IF;
  IF to_regclass('public.gsa_afiliado_comissoes') IS NOT NULL AND v_affiliate_ids IS NOT NULL THEN
    DELETE FROM public.gsa_afiliado_comissoes WHERE afiliado_id = ANY(v_affiliate_ids);
  END IF;
  IF to_regclass('public.gsa_afiliado_conversoes') IS NOT NULL THEN
    DELETE FROM public.gsa_afiliado_conversoes WHERE comprador_id = p_cliente_id OR (v_affiliate_ids IS NOT NULL AND afiliado_id = ANY(v_affiliate_ids));
  END IF;
  IF to_regclass('public.gsa_afiliado_atribuicoes') IS NOT NULL THEN
    DELETE FROM public.gsa_afiliado_atribuicoes WHERE cliente_id = p_cliente_id OR (v_affiliate_ids IS NOT NULL AND afiliado_id = ANY(v_affiliate_ids));
  END IF;
  IF to_regclass('public.gsa_afiliado_cliques') IS NOT NULL AND v_affiliate_ids IS NOT NULL THEN
    DELETE FROM public.gsa_afiliado_cliques WHERE link_id IN (SELECT id FROM public.gsa_afiliado_links WHERE afiliado_id = ANY(v_affiliate_ids));
  END IF;
  IF to_regclass('public.gsa_afiliado_links') IS NOT NULL AND v_affiliate_ids IS NOT NULL THEN
    DELETE FROM public.gsa_afiliado_links WHERE afiliado_id = ANY(v_affiliate_ids);
  END IF;
  IF to_regclass('public.gsa_afiliados') IS NOT NULL THEN
    DELETE FROM public.gsa_afiliados WHERE cliente_id = p_cliente_id;
  END IF;

  -- 2. Suporte & Notificações
  IF to_regclass('public.ticket_mensagens') IS NOT NULL AND v_ticket_ids IS NOT NULL THEN
    DELETE FROM public.ticket_mensagens WHERE ticket_id = ANY(v_ticket_ids);
  END IF;
  IF to_regclass('public.tickets') IS NOT NULL THEN
    DELETE FROM public.tickets WHERE cliente_id = p_cliente_id;
  END IF;
  IF to_regclass('public.notificacoes') IS NOT NULL THEN
    DELETE FROM public.notificacoes WHERE cliente_id = p_cliente_id;
  END IF;

  -- 3. Demandas & OS
  IF to_regclass('public.prestador_demandas') IS NOT NULL AND v_os_ids IS NOT NULL THEN
    DELETE FROM public.prestador_demandas WHERE os_id = ANY(v_os_ids);
  END IF;
  IF to_regclass('public.ordens_servico') IS NOT NULL THEN
    DELETE FROM public.ordens_servico WHERE cliente_id = p_cliente_id;
  END IF;

  -- 4. Orçamentos & Vendas
  IF to_regclass('public.orcamento_itens') IS NOT NULL AND v_orcamento_ids IS NOT NULL THEN
    DELETE FROM public.orcamento_itens WHERE orcamento_id = ANY(v_orcamento_ids);
  END IF;
  IF to_regclass('public.orcamento_historico') IS NOT NULL AND v_orcamento_ids IS NOT NULL THEN
    DELETE FROM public.orcamento_historico WHERE orcamento_id = ANY(v_orcamento_ids);
  END IF;
  IF to_regclass('public.orcamentos') IS NOT NULL THEN
    DELETE FROM public.orcamentos WHERE cliente_id = p_cliente_id;
  END IF;

  -- 5. Financeiro: Faturas, Saques, Transferências, Crédito
  IF to_regclass('public.faturas') IS NOT NULL THEN
    DELETE FROM public.faturas WHERE cliente_id = p_cliente_id;
  END IF;
  IF to_regclass('public.saques') IS NOT NULL THEN
    DELETE FROM public.saques WHERE cliente_id = p_cliente_id;
  END IF;

  IF to_regclass('public.transferencia_mensagens') IS NOT NULL THEN
    DELETE FROM public.transferencia_mensagens WHERE transferencia_id IN (
      SELECT id FROM public.transferencias WHERE cliente_origem_id = p_cliente_id OR cliente_destino_id = p_cliente_id
    );
  END IF;
  IF to_regclass('public.transferencias') IS NOT NULL THEN
    DELETE FROM public.transferencias WHERE cliente_origem_id = p_cliente_id OR cliente_destino_id = p_cliente_id;
  END IF;

  IF to_regclass('public.emprestimo_parcelas') IS NOT NULL AND v_emprestimo_ids IS NOT NULL THEN
    DELETE FROM public.emprestimo_parcelas WHERE emprestimo_id = ANY(v_emprestimo_ids);
  END IF;
  IF to_regclass('public.emprestimos') IS NOT NULL THEN
    DELETE FROM public.emprestimos WHERE cliente_id = p_cliente_id;
  END IF;

  IF to_regclass('public.loja_credito_solicitacoes') IS NOT NULL THEN
    DELETE FROM public.loja_credito_solicitacoes WHERE cliente_id = p_cliente_id;
  END IF;
  IF to_regclass('public.ordens_fiscais') IS NOT NULL THEN
    DELETE FROM public.ordens_fiscais WHERE cliente_id = p_cliente_id;
  END IF;

  -- 6. Outras tabelas do ecossistema
  IF to_regclass('public.classificados_anuncios') IS NOT NULL THEN
    DELETE FROM public.classificados_anuncios WHERE cliente_id = p_cliente_id;
  END IF;
  IF to_regclass('public.saude_contratos') IS NOT NULL THEN
    DELETE FROM public.saude_contratos WHERE cliente_id = p_cliente_id;
  END IF;
  IF to_regclass('public.seguros_apolices') IS NOT NULL THEN
    DELETE FROM public.seguros_apolices WHERE cliente_id = p_cliente_id;
  END IF;
  IF to_regclass('public.viagens_reservas') IS NOT NULL THEN
    DELETE FROM public.viagens_reservas WHERE cliente_id = p_cliente_id;
  END IF;
  IF to_regclass('public.vouchers') IS NOT NULL THEN
    DELETE FROM public.vouchers WHERE cliente_id = p_cliente_id;
  END IF;
  IF to_regclass('public.promocoes_resgates') IS NOT NULL THEN
    DELETE FROM public.promocoes_resgates WHERE cliente_id = p_cliente_id;
  END IF;
  IF to_regclass('public.cliente_documentos') IS NOT NULL THEN
    DELETE FROM public.cliente_documentos WHERE cliente_id = p_cliente_id;
  END IF;
  IF to_regclass('public.cliente_senhas') IS NOT NULL THEN
    DELETE FROM public.cliente_senhas WHERE cliente_id = p_cliente_id;
  END IF;
  IF to_regclass('public.cliente_acessos') IS NOT NULL THEN
    DELETE FROM public.cliente_acessos WHERE cliente_id = p_cliente_id;
  END IF;
  IF to_regclass('public.cliente_indicacoes') IS NOT NULL THEN
    DELETE FROM public.cliente_indicacoes WHERE cliente_id = p_cliente_id OR indicador_id = p_cliente_id;
  END IF;
  IF to_regclass('public.sistema_sessoes') IS NOT NULL THEN
    DELETE FROM public.sistema_sessoes WHERE ator_id = p_cliente_id;
  END IF;

  -- 7. Exclusão Final na Tabela de Clientes
  DELETE FROM public.clientes WHERE id = p_cliente_id;

  RETURN jsonb_build_object('success', true, 'cliente_id', p_cliente_id);
END;
$$;

REVOKE ALL ON FUNCTION public.delete_client_cascade(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.delete_client_cascade(uuid) TO authenticated, service_role;

COMMIT;
