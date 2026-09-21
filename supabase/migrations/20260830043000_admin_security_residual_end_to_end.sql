BEGIN;

-- Fecha os dois resíduos administrativos ainda expostos por policies públicas.
ALTER TABLE public.gsa_travel_operation_requests ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.gsa_travel_operation_requests FROM PUBLIC, anon, authenticated;
GRANT ALL ON public.gsa_travel_operation_requests TO service_role;
DROP POLICY IF EXISTS "Allow All Access" ON public.gsa_travel_operation_requests;

ALTER TABLE public.fatura_contestacoes ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.fatura_contestacoes FROM PUBLIC, anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.fatura_contestacoes TO authenticated;
DROP POLICY IF EXISTS service_role_all ON public.fatura_contestacoes;
DROP POLICY IF EXISTS gsa_management_hardened ON public.fatura_contestacoes;
CREATE POLICY gsa_management_hardened ON public.fatura_contestacoes
  FOR ALL TO authenticated
  USING (public.gsa_jwt_actor_type() IN ('admin','colaborador'))
  WITH CHECK (public.gsa_jwt_actor_type() IN ('admin','colaborador'));
DROP POLICY IF EXISTS gsa_collaborator_module_fatura_contestacoes ON public.fatura_contestacoes;
CREATE POLICY gsa_collaborator_module_fatura_contestacoes ON public.fatura_contestacoes
  AS RESTRICTIVE FOR ALL TO authenticated
  USING (public.gsa_admin_restrict_collaborator_to_module('financeiro'))
  WITH CHECK (public.gsa_admin_restrict_collaborator_to_module('financeiro'));
DROP POLICY IF EXISTS gsa_client_own_fatura_contestacoes ON public.fatura_contestacoes;
CREATE POLICY gsa_client_own_fatura_contestacoes ON public.fatura_contestacoes
  FOR SELECT TO authenticated
  USING (public.gsa_jwt_actor_type()='cliente' AND cliente_id=public.gsa_jwt_actor_id());

-- Serviço: criação segura com código gerado no servidor.
CREATE OR REPLACE FUNCTION public.gsa_admin_service_mutation(
  p_sessao_id uuid, p_session_token text, p_action text, p_servico_id uuid,
  p_payload jsonb, p_request_id uuid
) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE
  v_actor record; v_cached jsonb; v_result jsonb;
  v_row public.servicos%ROWTYPE; v_action text:=lower(trim(p_action));
  v_code text; v_next integer;
BEGIN
  SELECT * INTO v_actor
  FROM public.gsa_admin_session_assert_module(p_sessao_id,p_session_token,'catalogo') LIMIT 1;
  v_cached:=public.gsa_admin_claim_mutation(
    p_request_id,v_actor.ator_tipo,v_actor.ator_id,'service_'||v_action,
    coalesce(p_servico_id::text,p_payload->>'nome','service'));
  IF v_cached IS NOT NULL THEN RETURN v_cached; END IF;
  IF v_action='delete' THEN
    DELETE FROM public.servicos s WHERE s.id=p_servico_id
      RETURNING jsonb_build_object('id',s.id,'deleted',true) INTO v_result;
    IF v_result IS NULL THEN RAISE EXCEPTION 'Serviço não encontrado.' USING ERRCODE='P0002'; END IF;
    RETURN public.gsa_admin_complete_mutation(p_request_id,v_result);
  END IF;
  IF v_action<>'save' THEN RAISE EXCEPTION 'Ação de serviço não permitida.'; END IF;
  IF EXISTS (SELECT 1 FROM jsonb_object_keys(coalesce(p_payload,'{}'::jsonb)) k WHERE k NOT IN (
    'nome','descricao','valor','status','ocultar_valor','tipo_cliente','categoria','visivel_na_loja',
    'imagem_url','imagem_url_2','imagem_url_3','imagem_url_4','imagem_url_5','categoria_id','ordem_exibicao',
    'orcamento_disponivel','subtitulo_catalogo','visivel_catalogo_publico','disponivel_orcamento','ordem_catalogo')) THEN
    RAISE EXCEPTION 'Campo de serviço não permitido.' USING ERRCODE='42501';
  END IF;
  v_row:=jsonb_populate_record(NULL::public.servicos,coalesce(p_payload,'{}'::jsonb));
  IF p_payload?'valor' AND (v_row.valor IS NULL OR v_row.valor<0) THEN
    RAISE EXCEPTION 'Valor do serviço inválido.';
  END IF;
  IF p_servico_id IS NULL THEN
    IF trim(coalesce(v_row.nome,''))='' OR v_row.valor IS NULL OR v_row.valor<0 THEN
      RAISE EXCEPTION 'Nome e valor válido são obrigatórios.';
    END IF;
    PERFORM pg_advisory_xact_lock(hashtextextended('gsa:servicos:codigo',0));
    SELECT coalesce(max(CASE WHEN codigo_servico ~ '^SV[0-9]+$'
      THEN substring(codigo_servico from '^SV([0-9]+)$')::integer END),100)+1
      INTO v_next FROM public.servicos;
    v_code:='SV'||lpad(v_next::text,3,'0');
    INSERT INTO public.servicos(
      codigo_servico,nome,descricao,valor,status,ocultar_valor,tipo_cliente,categoria,visivel_na_loja,
      imagem_url,imagem_url_2,imagem_url_3,imagem_url_4,imagem_url_5,categoria_id,ordem_exibicao,
      orcamento_disponivel,subtitulo_catalogo,visivel_catalogo_publico,disponivel_orcamento,ordem_catalogo)
    VALUES(
      v_code,v_row.nome,v_row.descricao,v_row.valor,coalesce(v_row.status,'ativo'),
      coalesce(v_row.ocultar_valor,false),coalesce(v_row.tipo_cliente,'pf'),v_row.categoria,
      coalesce(v_row.visivel_na_loja,false),v_row.imagem_url,v_row.imagem_url_2,v_row.imagem_url_3,
      v_row.imagem_url_4,v_row.imagem_url_5,v_row.categoria_id,coalesce(v_row.ordem_exibicao,0),
      coalesce(v_row.orcamento_disponivel,true),v_row.subtitulo_catalogo,
      coalesce(v_row.visivel_catalogo_publico,true),coalesce(v_row.disponivel_orcamento,true),
      coalesce(v_row.ordem_catalogo,0))
    RETURNING to_jsonb(servicos) INTO v_result;
  ELSE
    UPDATE public.servicos s SET
      nome=CASE WHEN p_payload?'nome' THEN v_row.nome ELSE s.nome END,
      descricao=CASE WHEN p_payload?'descricao' THEN v_row.descricao ELSE s.descricao END,
      valor=CASE WHEN p_payload?'valor' THEN v_row.valor ELSE s.valor END,
      status=CASE WHEN p_payload?'status' THEN v_row.status ELSE s.status END,
      ocultar_valor=CASE WHEN p_payload?'ocultar_valor' THEN v_row.ocultar_valor ELSE s.ocultar_valor END,
      tipo_cliente=CASE WHEN p_payload?'tipo_cliente' THEN v_row.tipo_cliente ELSE s.tipo_cliente END,
      categoria=CASE WHEN p_payload?'categoria' THEN v_row.categoria ELSE s.categoria END,
      visivel_na_loja=CASE WHEN p_payload?'visivel_na_loja' THEN v_row.visivel_na_loja ELSE s.visivel_na_loja END,
      imagem_url=CASE WHEN p_payload?'imagem_url' THEN v_row.imagem_url ELSE s.imagem_url END,
      imagem_url_2=CASE WHEN p_payload?'imagem_url_2' THEN v_row.imagem_url_2 ELSE s.imagem_url_2 END,
      imagem_url_3=CASE WHEN p_payload?'imagem_url_3' THEN v_row.imagem_url_3 ELSE s.imagem_url_3 END,
      imagem_url_4=CASE WHEN p_payload?'imagem_url_4' THEN v_row.imagem_url_4 ELSE s.imagem_url_4 END,
      imagem_url_5=CASE WHEN p_payload?'imagem_url_5' THEN v_row.imagem_url_5 ELSE s.imagem_url_5 END,
      categoria_id=CASE WHEN p_payload?'categoria_id' THEN v_row.categoria_id ELSE s.categoria_id END,
      ordem_exibicao=CASE WHEN p_payload?'ordem_exibicao' THEN v_row.ordem_exibicao ELSE s.ordem_exibicao END,
      orcamento_disponivel=CASE WHEN p_payload?'orcamento_disponivel' THEN v_row.orcamento_disponivel ELSE s.orcamento_disponivel END,
      subtitulo_catalogo=CASE WHEN p_payload?'subtitulo_catalogo' THEN v_row.subtitulo_catalogo ELSE s.subtitulo_catalogo END,
      visivel_catalogo_publico=CASE WHEN p_payload?'visivel_catalogo_publico' THEN v_row.visivel_catalogo_publico ELSE s.visivel_catalogo_publico END,
      disponivel_orcamento=CASE WHEN p_payload?'disponivel_orcamento' THEN v_row.disponivel_orcamento ELSE s.disponivel_orcamento END,
      ordem_catalogo=CASE WHEN p_payload?'ordem_catalogo' THEN v_row.ordem_catalogo ELSE s.ordem_catalogo END
    WHERE s.id=p_servico_id RETURNING to_jsonb(s) INTO v_result;
    IF v_result IS NULL THEN RAISE EXCEPTION 'Serviço não encontrado.' USING ERRCODE='P0002'; END IF;
  END IF;
  RETURN public.gsa_admin_complete_mutation(p_request_id,v_result);
END;
$$;

-- Demanda: cobre todos os campos que o painel efetivamente altera.
CREATE OR REPLACE FUNCTION public.gsa_admin_update_provider_demand(
  p_sessao_id uuid, p_session_token text, p_demanda_id uuid,
  p_expected_status text, p_patch jsonb, p_request_id uuid
) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE
  v_actor record; v_cached jsonb; v_result jsonb;
  v_row public.prestador_demandas%ROWTYPE; v_patch jsonb:=coalesce(p_patch,'{}'::jsonb);
BEGIN
  SELECT * INTO v_actor
  FROM public.gsa_admin_session_assert_module(p_sessao_id,p_session_token,'demandas') LIMIT 1;
  v_cached:=public.gsa_admin_claim_mutation(
    p_request_id,v_actor.ator_tipo,v_actor.ator_id,'update_provider_demand',p_demanda_id::text);
  IF v_cached IS NOT NULL THEN RETURN v_cached; END IF;
  IF EXISTS (SELECT 1 FROM jsonb_object_keys(v_patch) k WHERE k NOT IN (
    'status','prestador_id','colaborador_id','valor_proposto_admin','valor_proposto_prestador','valor_final',
    'data_inicio','data_conclusao','prazo_entrega','prazo_limite','prioridade','motivo_negociacao',
    'is_contraproposta_final','status_ajuste','ajuste_solicitado','prazo_ajuste','notas_internas',
    'status_aceite','motivo_recusa','link_resultado','arquivos_resultado','arquivos_transferencia',
    'link_entrega','data_entrega_prestador','observacao_entrega')) THEN
    RAISE EXCEPTION 'Campo de demanda não permitido.' USING ERRCODE='42501';
  END IF;
  v_row:=jsonb_populate_record(NULL::public.prestador_demandas,v_patch);
  UPDATE public.prestador_demandas d SET
    status=CASE WHEN v_patch?'status' THEN v_row.status ELSE d.status END,
    prestador_id=CASE WHEN v_patch?'prestador_id' THEN v_row.prestador_id ELSE d.prestador_id END,
    colaborador_id=CASE WHEN v_patch?'colaborador_id' THEN v_row.colaborador_id ELSE d.colaborador_id END,
    valor_proposto_admin=CASE WHEN v_patch?'valor_proposto_admin' THEN v_row.valor_proposto_admin ELSE d.valor_proposto_admin END,
    valor_proposto_prestador=CASE WHEN v_patch?'valor_proposto_prestador' THEN v_row.valor_proposto_prestador ELSE d.valor_proposto_prestador END,
    valor_final=CASE WHEN v_patch?'valor_final' THEN v_row.valor_final ELSE d.valor_final END,
    data_inicio=CASE WHEN v_patch?'data_inicio' THEN v_row.data_inicio ELSE d.data_inicio END,
    data_conclusao=CASE WHEN v_patch?'data_conclusao' THEN v_row.data_conclusao ELSE d.data_conclusao END,
    prazo_entrega=CASE WHEN v_patch?'prazo_entrega' THEN v_row.prazo_entrega ELSE d.prazo_entrega END,
    prazo_limite=CASE WHEN v_patch?'prazo_limite' THEN v_row.prazo_limite ELSE d.prazo_limite END,
    prioridade=CASE WHEN v_patch?'prioridade' THEN v_row.prioridade ELSE d.prioridade END,
    motivo_negociacao=CASE WHEN v_patch?'motivo_negociacao' THEN v_row.motivo_negociacao ELSE d.motivo_negociacao END,
    is_contraproposta_final=CASE WHEN v_patch?'is_contraproposta_final' THEN v_row.is_contraproposta_final ELSE d.is_contraproposta_final END,
    status_ajuste=CASE WHEN v_patch?'status_ajuste' THEN v_row.status_ajuste ELSE d.status_ajuste END,
    ajuste_solicitado=CASE WHEN v_patch?'ajuste_solicitado' THEN v_row.ajuste_solicitado ELSE d.ajuste_solicitado END,
    prazo_ajuste=CASE WHEN v_patch?'prazo_ajuste' THEN v_row.prazo_ajuste ELSE d.prazo_ajuste END,
    notas_internas=CASE WHEN v_patch?'notas_internas' THEN v_row.notas_internas ELSE d.notas_internas END,
    status_aceite=CASE WHEN v_patch?'status_aceite' THEN v_row.status_aceite ELSE d.status_aceite END,
    motivo_recusa=CASE WHEN v_patch?'motivo_recusa' THEN v_row.motivo_recusa ELSE d.motivo_recusa END,
    link_resultado=CASE WHEN v_patch?'link_resultado' THEN v_row.link_resultado ELSE d.link_resultado END,
    arquivos_resultado=CASE WHEN v_patch?'arquivos_resultado' THEN v_row.arquivos_resultado ELSE d.arquivos_resultado END,
    arquivos_transferencia=CASE WHEN v_patch?'arquivos_transferencia' THEN v_row.arquivos_transferencia ELSE d.arquivos_transferencia END,
    link_entrega=CASE WHEN v_patch?'link_entrega' THEN v_row.link_entrega ELSE d.link_entrega END,
    data_entrega_prestador=CASE WHEN v_patch?'data_entrega_prestador' THEN v_row.data_entrega_prestador ELSE d.data_entrega_prestador END,
    observacao_entrega=CASE WHEN v_patch?'observacao_entrega' THEN v_row.observacao_entrega ELSE d.observacao_entrega END,
    updated_at=now()
  WHERE d.id=p_demanda_id AND (p_expected_status IS NULL OR d.status=p_expected_status)
  RETURNING to_jsonb(d) INTO v_result;
  IF v_result IS NULL THEN
    RAISE EXCEPTION 'Demanda alterada por outra sessão ou não encontrada.' USING ERRCODE='40001';
  END IF;
  RETURN public.gsa_admin_complete_mutation(p_request_id,v_result);
END;
$$;

-- Histórico de demanda com ator derivado da sessão.
CREATE OR REPLACE FUNCTION public.gsa_admin_add_demand_history(
  p_sessao_id uuid, p_session_token text, p_demanda_id uuid, p_tipo_evento text,
  p_motivo text, p_colaborador_destino_id uuid, p_prestador_origem_id uuid,
  p_prestador_destino_id uuid, p_valor_proposto numeric, p_request_id uuid
) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE v_actor record; v_cached jsonb; v_result jsonb; v_id uuid;
BEGIN
  SELECT * INTO v_actor
  FROM public.gsa_admin_session_assert_module(p_sessao_id,p_session_token,'demandas') LIMIT 1;
  v_cached:=public.gsa_admin_claim_mutation(
    p_request_id,v_actor.ator_tipo,v_actor.ator_id,'add_demand_history',p_demanda_id::text);
  IF v_cached IS NOT NULL THEN RETURN v_cached; END IF;
  IF p_tipo_evento NOT IN ('criacao','transferencia','aceite','entrega','ajuste','recusa','negociacao','finalizacao','cancelamento') THEN
    RAISE EXCEPTION 'Tipo de evento da demanda inválido.';
  END IF;
  IF length(trim(coalesce(p_motivo,'')))<2 THEN RAISE EXCEPTION 'Descrição do histórico é obrigatória.'; END IF;
  IF NOT EXISTS (SELECT 1 FROM public.prestador_demandas WHERE id=p_demanda_id) THEN
    RAISE EXCEPTION 'Demanda não encontrada.' USING ERRCODE='P0002';
  END IF;
  INSERT INTO public.prestador_demandas_historico(
    demanda_id,tipo_evento,motivo,colaborador_origem_id,colaborador_destino_id,
    prestador_origem_id,prestador_destino_id,valor_proposto)
  VALUES(
    p_demanda_id,p_tipo_evento,trim(p_motivo),
    CASE WHEN v_actor.ator_tipo='colaborador' THEN v_actor.ator_id ELSE NULL END,
    p_colaborador_destino_id,p_prestador_origem_id,p_prestador_destino_id,p_valor_proposto)
  RETURNING id INTO v_id;
  v_result:=jsonb_build_object('success',true,'id',v_id);
  RETURN public.gsa_admin_complete_mutation(p_request_id,v_result);
END;
$$;

CREATE OR REPLACE FUNCTION public.gsa_admin_add_os_note(
  p_sessao_id uuid, p_session_token text, p_os_id uuid, p_nota text, p_request_id uuid
) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE v_actor record; v_cached jsonb; v_result jsonb; v_id uuid;
BEGIN
  SELECT * INTO v_actor
  FROM public.gsa_admin_session_assert_module(p_sessao_id,p_session_token,'demandas') LIMIT 1;
  v_cached:=public.gsa_admin_claim_mutation(
    p_request_id,v_actor.ator_tipo,v_actor.ator_id,'add_os_note',p_os_id::text);
  IF v_cached IS NOT NULL THEN RETURN v_cached; END IF;
  IF length(trim(coalesce(p_nota,'')))<2 OR length(p_nota)>3000 THEN
    RAISE EXCEPTION 'Nota da OS inválida.';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.ordens_servico WHERE id=p_os_id) THEN
    RAISE EXCEPTION 'Ordem de serviço não encontrada.' USING ERRCODE='P0002';
  END IF;
  INSERT INTO public.os_notas(os_id,nota) VALUES(p_os_id,trim(p_nota)) RETURNING id INTO v_id;
  v_result:=jsonb_build_object('success',true,'id',v_id);
  RETURN public.gsa_admin_complete_mutation(p_request_id,v_result);
END;
$$;

CREATE OR REPLACE FUNCTION public.gsa_admin_send_os_support_message(
  p_sessao_id uuid, p_session_token text, p_os_id uuid, p_mensagem text, p_request_id uuid
) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE v_actor record; v_cached jsonb; v_result jsonb; v_id uuid;
BEGIN
  SELECT * INTO v_actor
  FROM public.gsa_admin_session_assert_module(p_sessao_id,p_session_token,'demandas') LIMIT 1;
  v_cached:=public.gsa_admin_claim_mutation(
    p_request_id,v_actor.ator_tipo,v_actor.ator_id,'send_os_support_message',p_os_id::text);
  IF v_cached IS NOT NULL THEN RETURN v_cached; END IF;
  IF length(trim(coalesce(p_mensagem,'')))<1 OR length(p_mensagem)>5000 THEN
    RAISE EXCEPTION 'Mensagem de suporte inválida.';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.ordens_servico WHERE id=p_os_id) THEN
    RAISE EXCEPTION 'Ordem de serviço não encontrada.' USING ERRCODE='P0002';
  END IF;
  INSERT INTO public.os_suporte_mensagens(
    os_id,remetente_tipo,remetente_id,remetente_nome,mensagem,lida)
  VALUES(p_os_id,'admin',v_actor.ator_id,v_actor.ator_nome,trim(p_mensagem),false)
  RETURNING id INTO v_id;
  v_result:=jsonb_build_object('success',true,'id',v_id);
  RETURN public.gsa_admin_complete_mutation(p_request_id,v_result);
END;
$$;

-- A contribuição pode ser criada publicamente; confirmação financeira nunca pode vir do navegador.
DROP POLICY IF EXISTS loja_vaquinhas_public_access ON public.loja_vaquinhas;
DROP POLICY IF EXISTS loja_vaquinha_contribuicoes_public_access ON public.loja_vaquinha_contribuicoes;
REVOKE ALL ON public.loja_vaquinhas FROM PUBLIC, anon, authenticated;
REVOKE ALL ON public.loja_vaquinha_contribuicoes FROM PUBLIC, anon, authenticated;
GRANT ALL ON public.loja_vaquinhas TO service_role;
GRANT ALL ON public.loja_vaquinha_contribuicoes TO service_role;

CREATE OR REPLACE FUNCTION public.gsa_public_create_vaquinha_contribution(p_payload jsonb)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE v_vaquinha public.loja_vaquinhas%ROWTYPE; v_contrib public.loja_vaquinha_contribuicoes%ROWTYPE;
DECLARE v_id uuid; v_valor numeric; v_nome text;
BEGIN
  v_id:=nullif(p_payload->>'vaquinha_id','')::uuid;
  v_valor:=coalesce((p_payload->>'valor')::numeric,0);
  v_nome:=trim(coalesce(p_payload->>'contribuinte_nome',''));
  SELECT * INTO v_vaquinha FROM public.loja_vaquinhas WHERE id=v_id FOR SHARE;
  IF v_vaquinha.id IS NULL OR v_vaquinha.status<>'aberta' THEN
    RAISE EXCEPTION 'Vaquinha indisponível para contribuição.';
  END IF;
  IF length(v_nome)<2 OR length(v_nome)>120 THEN RAISE EXCEPTION 'Nome do contribuinte inválido.'; END IF;
  IF v_valor<1 OR v_valor>100000 THEN RAISE EXCEPTION 'Valor de contribuição inválido.'; END IF;
  INSERT INTO public.loja_vaquinha_contribuicoes(
    vaquinha_id,contribuinte_nome,contribuinte_telefone,contribuinte_email,valor,mensagem,
    pix_copia_cola,pix_qr_code_url,status)
  VALUES(
    v_id,v_nome,nullif(left(trim(coalesce(p_payload->>'contribuinte_telefone','')),40),''),
    nullif(left(lower(trim(coalesce(p_payload->>'contribuinte_email',''))),254),''),v_valor,
    nullif(left(trim(coalesce(p_payload->>'mensagem','')),1000),''),
    nullif(left(coalesce(p_payload->>'pix_copia_cola',''),1200),''),
    nullif(left(coalesce(p_payload->>'pix_qr_code_url',''),2500),''),'pendente')
  RETURNING * INTO v_contrib;
  RETURN jsonb_build_object('success',true,'contribution',to_jsonb(v_contrib));
END;
$$;

REVOKE ALL ON FUNCTION public.gsa_public_create_vaquinha_contribution(jsonb) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.gsa_public_create_vaquinha_contribution(jsonb) TO anon,authenticated,service_role;
REVOKE ALL ON FUNCTION public.gsa_confirmar_contribuicao_vaquinha(uuid,text) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.gsa_confirmar_contribuicao_vaquinha(uuid,text) TO service_role;

REVOKE ALL ON FUNCTION public.gsa_admin_service_mutation(uuid,text,text,uuid,jsonb,uuid) FROM PUBLIC,anon;
REVOKE ALL ON FUNCTION public.gsa_admin_update_provider_demand(uuid,text,uuid,text,jsonb,uuid) FROM PUBLIC,anon;
REVOKE ALL ON FUNCTION public.gsa_admin_add_demand_history(uuid,text,uuid,text,text,uuid,uuid,uuid,numeric,uuid) FROM PUBLIC,anon;
REVOKE ALL ON FUNCTION public.gsa_admin_add_os_note(uuid,text,uuid,text,uuid) FROM PUBLIC,anon;
REVOKE ALL ON FUNCTION public.gsa_admin_send_os_support_message(uuid,text,uuid,text,uuid) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.gsa_admin_service_mutation(uuid,text,text,uuid,jsonb,uuid) TO authenticated,service_role;
GRANT EXECUTE ON FUNCTION public.gsa_admin_update_provider_demand(uuid,text,uuid,text,jsonb,uuid) TO authenticated,service_role;
GRANT EXECUTE ON FUNCTION public.gsa_admin_add_demand_history(uuid,text,uuid,text,text,uuid,uuid,uuid,numeric,uuid) TO authenticated,service_role;
GRANT EXECUTE ON FUNCTION public.gsa_admin_add_os_note(uuid,text,uuid,text,uuid) TO authenticated,service_role;
GRANT EXECUTE ON FUNCTION public.gsa_admin_send_os_support_message(uuid,text,uuid,text,uuid) TO authenticated,service_role;

NOTIFY pgrst, 'reload schema';
COMMIT;
