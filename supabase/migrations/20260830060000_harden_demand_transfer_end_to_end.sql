BEGIN;

-- Atomic administrative creation: demand and first history entry are committed together.
CREATE OR REPLACE FUNCTION public.gsa_admin_create_provider_demand(
  p_sessao_id uuid,
  p_session_token text,
  p_payload jsonb,
  p_request_id uuid
) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE
  v_actor record;
  v_cached jsonb;
  v_row public.prestador_demandas%ROWTYPE;
  v_result jsonb;
  v_id uuid;
  v_code text;
  v_target text;
BEGIN
  SELECT * INTO v_actor
    FROM public.gsa_admin_session_assert_module(p_sessao_id,p_session_token,'demandas') LIMIT 1;
  v_cached:=public.gsa_admin_claim_mutation(
    p_request_id,v_actor.ator_tipo,v_actor.ator_id,'create_provider_demand',coalesce(p_payload->>'titulo','demand'));
  IF v_cached IS NOT NULL THEN RETURN v_cached; END IF;

  IF jsonb_typeof(coalesce(p_payload,'{}'::jsonb))<>'object' THEN
    RAISE EXCEPTION 'Dados da demanda inválidos.' USING ERRCODE='22023';
  END IF;
  IF EXISTS (SELECT 1 FROM jsonb_object_keys(p_payload) k WHERE k NOT IN (
    'titulo','descricao','detalhes','prioridade','prazo_limite','arquivos_briefing',
    'link_entrega','os_id','colaborador_id','prestador_id','valor_proposto_admin')) THEN
    RAISE EXCEPTION 'Campo de demanda não permitido.' USING ERRCODE='42501';
  END IF;

  v_row:=jsonb_populate_record(NULL::public.prestador_demandas,p_payload);
  IF length(trim(coalesce(v_row.titulo,'')))<3 OR length(v_row.titulo)>200 THEN
    RAISE EXCEPTION 'Título da demanda inválido.' USING ERRCODE='22023';
  END IF;
  IF length(trim(coalesce(v_row.descricao,'')))<3 OR length(v_row.descricao)>10000 THEN
    RAISE EXCEPTION 'Descrição da demanda inválida.' USING ERRCODE='22023';
  END IF;
  IF coalesce(v_row.prioridade,'normal') NOT IN ('urgente','alta','normal','baixa') THEN
    RAISE EXCEPTION 'Prioridade da demanda inválida.' USING ERRCODE='22023';
  END IF;
  IF v_row.prazo_limite IS NULL OR v_row.prazo_limite<=now() THEN
    RAISE EXCEPTION 'O prazo da demanda deve estar no futuro.' USING ERRCODE='22023';
  END IF;
  IF v_row.colaborador_id IS NOT NULL AND v_row.prestador_id IS NOT NULL THEN
    RAISE EXCEPTION 'A demanda não pode ter dois responsáveis.' USING ERRCODE='22023';
  END IF;
  IF v_row.valor_proposto_admin IS NOT NULL AND v_row.valor_proposto_admin<=0 THEN
    RAISE EXCEPTION 'Valor proposto deve ser maior que zero.' USING ERRCODE='22023';
  END IF;
  IF v_row.colaborador_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM public.colaboradores c WHERE c.id=v_row.colaborador_id AND c.status='ativo') THEN
    RAISE EXCEPTION 'Colaborador de destino não está ativo.' USING ERRCODE='22023';
  END IF;
  IF v_row.prestador_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM public.prestadores p WHERE p.id=v_row.prestador_id AND p.status='ativo') THEN
    RAISE EXCEPTION 'Prestador de destino não está ativo.' USING ERRCODE='22023';
  END IF;
  IF v_actor.ator_tipo='colaborador' AND v_row.colaborador_id IS DISTINCT FROM v_actor.ator_id THEN
    RAISE EXCEPTION 'Colaborador só pode criar demanda atribuída a si próprio.' USING ERRCODE='42501';
  END IF;
  IF v_row.os_id IS NOT NULL THEN
    IF NOT EXISTS (SELECT 1 FROM public.ordens_servico os WHERE os.id=v_row.os_id) THEN
      RAISE EXCEPTION 'Ordem de serviço não encontrada.' USING ERRCODE='P0002';
    END IF;
    IF EXISTS (SELECT 1 FROM public.prestador_demandas d WHERE d.os_id=v_row.os_id
      AND d.status NOT IN ('concluida','finalizada','cancelada','concluida_interna')) THEN
      RAISE EXCEPTION 'Já existe demanda ativa para esta ordem de serviço.' USING ERRCODE='23505';
    END IF;
  END IF;

  v_target:=CASE WHEN v_row.prestador_id IS NOT NULL THEN 'prestador'
                 WHEN v_row.colaborador_id IS NOT NULL THEN 'colaborador' ELSE 'pool' END;
  v_code:='DEM-'||upper(substr(replace(gen_random_uuid()::text,'-',''),1,8));

  INSERT INTO public.prestador_demandas(
    codigo_demanda,titulo,descricao,detalhes,prioridade,prazo_limite,status,status_aceite,
    arquivos_briefing,link_entrega,os_id,colaborador_id,prestador_id,valor_proposto_admin)
  VALUES(
    v_code,trim(v_row.titulo),trim(v_row.descricao),nullif(trim(v_row.detalhes),''),
    coalesce(v_row.prioridade,'normal'),v_row.prazo_limite,
    CASE WHEN v_target='pool' THEN 'aguardando_atribuicao'
         WHEN v_target='prestador' THEN 'em_negociacao' ELSE 'aberta' END,
    CASE WHEN v_target='colaborador' THEN 'pendente_aceite' ELSE 'aceito' END,
    coalesce(v_row.arquivos_briefing,'[]'::jsonb),nullif(trim(v_row.link_entrega),''),
    v_row.os_id,v_row.colaborador_id,v_row.prestador_id,v_row.valor_proposto_admin)
  RETURNING id INTO v_id;

  INSERT INTO public.prestador_demandas_historico(
    demanda_id,tipo_evento,motivo,colaborador_origem_id,colaborador_destino_id,prestador_destino_id,valor_proposto)
  VALUES(
    v_id,'criacao','Demanda criada. Prioridade: '||upper(coalesce(v_row.prioridade,'normal'))||
      '. Destino inicial: '||v_target||'.',
    CASE WHEN v_actor.ator_tipo='colaborador' THEN v_actor.ator_id END,
    v_row.colaborador_id,v_row.prestador_id,v_row.valor_proposto_admin);

  SELECT to_jsonb(d) INTO v_result FROM public.prestador_demandas d WHERE d.id=v_id;
  RETURN public.gsa_admin_complete_mutation(p_request_id,v_result);
END;
$$;

-- Atomic administrative state change: row mutation and business history share one transaction.
CREATE OR REPLACE FUNCTION public.gsa_admin_transition_provider_demand(
  p_sessao_id uuid,
  p_session_token text,
  p_demanda_id uuid,
  p_expected_status text,
  p_patch jsonb,
  p_event_type text,
  p_event_reason text,
  p_colaborador_destino_id uuid,
  p_prestador_origem_id uuid,
  p_prestador_destino_id uuid,
  p_valor_proposto numeric,
  p_request_id uuid
) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE
  v_actor record;
  v_current public.prestador_demandas%ROWTYPE;
  v_cached jsonb;
  v_updated jsonb;
  v_history jsonb;
  v_new_status text:=nullif(p_patch->>'status','');
BEGIN
  SELECT * INTO v_actor
    FROM public.gsa_admin_session_assert_module(p_sessao_id,p_session_token,'demandas') LIMIT 1;
  v_cached:=public.gsa_admin_claim_mutation(
    p_request_id,v_actor.ator_tipo,v_actor.ator_id,'transition_provider_demand',p_demanda_id::text);
  IF v_cached IS NOT NULL THEN RETURN v_cached; END IF;

  SELECT * INTO v_current FROM public.prestador_demandas WHERE id=p_demanda_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Demanda não encontrada.' USING ERRCODE='P0002'; END IF;
  IF p_expected_status IS NOT NULL AND v_current.status<>p_expected_status THEN
    RAISE EXCEPTION 'Demanda alterada por outra sessão.' USING ERRCODE='40001';
  END IF;
  IF v_current.status IN ('concluida','finalizada','cancelada') THEN
    RAISE EXCEPTION 'Demanda finalizada não permite alterações.' USING ERRCODE='22023';
  END IF;
  IF v_actor.ator_tipo='colaborador' AND v_current.colaborador_id IS DISTINCT FROM v_actor.ator_id THEN
    RAISE EXCEPTION 'Demanda não atribuída a este colaborador.' USING ERRCODE='42501';
  END IF;
  IF p_event_type NOT IN ('transferencia','aceite','entrega','ajuste','recusa','negociacao','finalizacao')
     OR length(trim(coalesce(p_event_reason,'')))<2 OR length(p_event_reason)>10000 THEN
    RAISE EXCEPTION 'Histórico da transição inválido.' USING ERRCODE='22023';
  END IF;
  IF v_new_status IS NOT NULL AND v_new_status NOT IN (
    'aberta','aguardando_atribuicao','em_negociacao','contraproposta_prestador',
    'contraproposta_admin_final','ativa','em_analise','em_ajuste','concluida_interna') THEN
    RAISE EXCEPTION 'Transição de status inválida.' USING ERRCODE='22023';
  END IF;
  IF (p_patch?'valor_proposto_admin' AND (p_patch->>'valor_proposto_admin')::numeric<=0)
     OR (p_patch?'valor_proposto_prestador' AND nullif(p_patch->>'valor_proposto_prestador','') IS NOT NULL
         AND (p_patch->>'valor_proposto_prestador')::numeric<=0)
     OR (p_patch?'valor_final' AND nullif(p_patch->>'valor_final','') IS NOT NULL
         AND (p_patch->>'valor_final')::numeric<0) THEN
    RAISE EXCEPTION 'Valor da demanda inválido.' USING ERRCODE='22023';
  END IF;
  IF p_patch?'prazo_entrega' AND nullif(p_patch->>'prazo_entrega','') IS NOT NULL
     AND (p_patch->>'prazo_entrega')::timestamptz<=now() THEN
    RAISE EXCEPTION 'Prazo de entrega deve estar no futuro.' USING ERRCODE='22023';
  END IF;
  IF p_patch?'colaborador_id' AND nullif(p_patch->>'colaborador_id','') IS NOT NULL
     AND NOT EXISTS (SELECT 1 FROM public.colaboradores c
       WHERE c.id=(p_patch->>'colaborador_id')::uuid AND c.status='ativo') THEN
    RAISE EXCEPTION 'Colaborador de destino não está ativo.' USING ERRCODE='22023';
  END IF;
  IF p_patch?'prestador_id' AND nullif(p_patch->>'prestador_id','') IS NOT NULL
     AND NOT EXISTS (SELECT 1 FROM public.prestadores p
       WHERE p.id=(p_patch->>'prestador_id')::uuid AND p.status='ativo') THEN
    RAISE EXCEPTION 'Prestador de destino não está ativo.' USING ERRCODE='22023';
  END IF;

  v_updated:=public.gsa_admin_update_provider_demand(
    p_sessao_id,p_session_token,p_demanda_id,p_expected_status,p_patch,
    md5(p_request_id::text||':update')::uuid);
  v_history:=public.gsa_admin_add_demand_history(
    p_sessao_id,p_session_token,p_demanda_id,p_event_type,trim(p_event_reason),
    p_colaborador_destino_id,p_prestador_origem_id,p_prestador_destino_id,p_valor_proposto,
    md5(p_request_id::text||':history')::uuid);

  RETURN public.gsa_admin_complete_mutation(
    p_request_id,jsonb_build_object('demand',v_updated,'history',v_history));
END;
$$;

-- Cancellation must respect both module scope and terminal states.
CREATE OR REPLACE FUNCTION public.gsa_admin_cancelar_demanda(
  p_sessao_id uuid,p_session_token text,p_demanda_id uuid,p_motivo text
) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE v_actor record; v_demanda record; v_motivo text:=trim(coalesce(p_motivo,''));
BEGIN
  SELECT * INTO v_actor
    FROM public.gsa_admin_session_assert_module(p_sessao_id,p_session_token,'demandas') LIMIT 1;
  IF length(v_motivo)<3 OR length(v_motivo)>2000 THEN
    RAISE EXCEPTION 'Motivo do cancelamento inválido.' USING ERRCODE='22023';
  END IF;
  SELECT d.*,os.orcamento_id INTO v_demanda
    FROM public.prestador_demandas d LEFT JOIN public.ordens_servico os ON os.id=d.os_id
   WHERE d.id=p_demanda_id FOR UPDATE OF d;
  IF v_demanda.id IS NULL THEN RAISE EXCEPTION 'Demanda não encontrada.' USING ERRCODE='P0002'; END IF;
  IF v_demanda.status='cancelada' THEN RETURN jsonb_build_object('success',true,'already_processed',true); END IF;
  IF v_demanda.status IN ('concluida','concluida_interna','finalizada') THEN
    RAISE EXCEPTION 'Demanda concluída não pode ser cancelada.' USING ERRCODE='22023';
  END IF;
  IF v_actor.ator_tipo='colaborador' AND v_demanda.colaborador_id IS DISTINCT FROM v_actor.ator_id THEN
    RAISE EXCEPTION 'Demanda não atribuída a este colaborador.' USING ERRCODE='42501';
  END IF;
  UPDATE public.prestador_demandas SET status='cancelada',updated_at=now() WHERE id=p_demanda_id;
  IF v_demanda.os_id IS NOT NULL THEN
    UPDATE public.ordens_servico SET status='cancelado',motivo_cancelamento=v_motivo
     WHERE id=v_demanda.os_id AND status NOT IN ('concluido','finalizado','cancelado');
    INSERT INTO public.os_notas(os_id,nota)
    SELECT v_demanda.os_id,'Cancelamento administrativo. Motivo: '||v_motivo
    WHERE NOT EXISTS (SELECT 1 FROM public.os_notas WHERE os_id=v_demanda.os_id
      AND nota='Cancelamento administrativo. Motivo: '||v_motivo);
  END IF;
  IF v_demanda.orcamento_id IS NOT NULL THEN
    UPDATE public.orcamentos SET status='cancelado',motivo_cancelamento=v_motivo
     WHERE id=v_demanda.orcamento_id AND status NOT IN ('concluido','finalizado','cancelado');
  END IF;
  INSERT INTO public.prestador_demandas_historico(demanda_id,tipo_evento,motivo,colaborador_origem_id)
  VALUES(p_demanda_id,'cancelamento','Cancelada por '||v_actor.ator_nome||'. Motivo: '||v_motivo,
    CASE WHEN v_actor.ator_tipo='colaborador' THEN v_actor.ator_id END);
  INSERT INTO public.sistema_logs(acao,detalhes,ator_tipo,ator_id,ator_nome)
  VALUES('CANCELAR_DEMANDA_PRESTADOR',jsonb_build_object('demanda_id',p_demanda_id,'motivo',v_motivo)::text,
    v_actor.ator_tipo,v_actor.ator_id,v_actor.ator_nome);
  RETURN jsonb_build_object('success',true,'demanda_id',p_demanda_id);
END;
$$;

-- Comments derive author identity from the administrative session.
CREATE OR REPLACE FUNCTION public.gsa_admin_add_demand_comment(
  p_sessao_id uuid,p_session_token text,p_demanda_id uuid,p_mensagem text,
  p_arquivos_urls jsonb,p_request_id uuid
) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE v_actor record; v_cached jsonb; v_id uuid; v_result jsonb; v_demand record;
BEGIN
  SELECT * INTO v_actor FROM public.gsa_admin_session_assert_module(p_sessao_id,p_session_token,'demandas') LIMIT 1;
  v_cached:=public.gsa_admin_claim_mutation(p_request_id,v_actor.ator_tipo,v_actor.ator_id,
    'add_demand_comment',p_demanda_id::text);
  IF v_cached IS NOT NULL THEN RETURN v_cached; END IF;
  SELECT id,colaborador_id INTO v_demand FROM public.prestador_demandas WHERE id=p_demanda_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Demanda não encontrada.' USING ERRCODE='P0002'; END IF;
  IF v_actor.ator_tipo='colaborador' AND v_demand.colaborador_id IS DISTINCT FROM v_actor.ator_id THEN
    RAISE EXCEPTION 'Demanda não atribuída a este colaborador.' USING ERRCODE='42501';
  END IF;
  IF length(trim(coalesce(p_mensagem,'')))<1 OR length(p_mensagem)>5000 THEN
    RAISE EXCEPTION 'Comentário inválido.' USING ERRCODE='22023';
  END IF;
  IF jsonb_typeof(coalesce(p_arquivos_urls,'[]'::jsonb))<>'array' OR jsonb_array_length(coalesce(p_arquivos_urls,'[]'::jsonb))>5 THEN
    RAISE EXCEPTION 'Anexos do comentário inválidos.' USING ERRCODE='22023';
  END IF;
  INSERT INTO public.demanda_comentarios(demanda_id,autor_id,autor_nome,autor_tipo,mensagem,arquivos_urls)
  VALUES(p_demanda_id,v_actor.ator_id,v_actor.ator_nome,v_actor.ator_tipo,trim(p_mensagem),coalesce(p_arquivos_urls,'[]'::jsonb))
  RETURNING id INTO v_id;
  v_result:=jsonb_build_object('success',true,'id',v_id);
  RETURN public.gsa_admin_complete_mutation(p_request_id,v_result);
END;
$$;

-- Keep the denormalized counter consistent with actual comments.
CREATE OR REPLACE FUNCTION public.gsa_sync_demand_comment_count()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE v_demand_id uuid:=CASE WHEN TG_OP='DELETE' THEN OLD.demanda_id ELSE NEW.demanda_id END;
BEGIN
  UPDATE public.prestador_demandas d SET total_comentarios=(
    SELECT count(*) FROM public.demanda_comentarios c WHERE c.demanda_id=v_demand_id),updated_at=now()
  WHERE d.id=v_demand_id;
  RETURN CASE WHEN TG_OP='DELETE' THEN OLD ELSE NEW END;
END;
$$;
DROP TRIGGER IF EXISTS trg_sync_demand_comment_count ON public.demanda_comentarios;
CREATE TRIGGER trg_sync_demand_comment_count AFTER INSERT OR DELETE ON public.demanda_comentarios
FOR EACH ROW EXECUTE FUNCTION public.gsa_sync_demand_comment_count();

-- Remove legacy broad write paths. Reads remain scoped by current admin/provider policies.
DROP POLICY IF EXISTS "Allow authenticated users to manage history" ON public.prestador_demandas_historico;
DROP POLICY IF EXISTS "Permitir inserção para usuários autenticados" ON public.prestador_demandas_historico;
DROP POLICY IF EXISTS "Permitir leitura para usuários autenticados" ON public.prestador_demandas_historico;
REVOKE INSERT,UPDATE,DELETE ON public.prestador_demandas_historico FROM anon,authenticated;
GRANT SELECT ON public.prestador_demandas_historico TO authenticated;
REVOKE INSERT,UPDATE,DELETE ON public.demanda_comentarios FROM anon,authenticated;
GRANT SELECT ON public.demanda_comentarios TO authenticated;

REVOKE ALL ON FUNCTION public.increment_comentarios(uuid) FROM PUBLIC,anon,authenticated;
REVOKE ALL ON FUNCTION public.gsa_admin_update_provider_demand(uuid,text,uuid,text,jsonb,uuid) FROM PUBLIC,anon,authenticated;
REVOKE ALL ON FUNCTION public.gsa_admin_add_demand_history(uuid,text,uuid,text,text,uuid,uuid,uuid,numeric,uuid) FROM PUBLIC,anon,authenticated;
REVOKE ALL ON FUNCTION public.gsa_provider_transition_demand(uuid,text,jsonb) FROM PUBLIC,anon;
REVOKE ALL ON FUNCTION public.gsa_admin_cancelar_demanda(uuid,text,uuid,text) FROM PUBLIC,anon;

-- The administrative transfer uses em_negociacao for the initial provider
-- proposal; that state must be eligible for provider acceptance.
DO $$
DECLARE v_definition text;
BEGIN
  v_definition:=pg_get_functiondef('public.gsa_provider_transition_demand(uuid,text,jsonb)'::regprocedure);
  IF v_definition NOT LIKE '%''aguardando_aceite'', ''aberta'', ''contraproposta_admin_final''%' THEN
    RAISE EXCEPTION 'Provider demand transition definition is not the expected version.';
  END IF;
  v_definition:=replace(
    v_definition,
    '''aguardando_aceite'', ''aberta'', ''contraproposta_admin_final''',
    '''aguardando_aceite'', ''aberta'', ''em_negociacao'', ''contraproposta_admin_final'''
  );
  EXECUTE v_definition;
END;
$$;

GRANT EXECUTE ON FUNCTION public.gsa_admin_create_provider_demand(uuid,text,jsonb,uuid) TO authenticated,service_role;
GRANT EXECUTE ON FUNCTION public.gsa_admin_transition_provider_demand(uuid,text,uuid,text,jsonb,text,text,uuid,uuid,uuid,numeric,uuid) TO authenticated,service_role;
GRANT EXECUTE ON FUNCTION public.gsa_admin_add_demand_comment(uuid,text,uuid,text,jsonb,uuid) TO authenticated,service_role;
GRANT EXECUTE ON FUNCTION public.gsa_provider_transition_demand(uuid,text,jsonb) TO authenticated,service_role;
GRANT EXECUTE ON FUNCTION public.gsa_admin_cancelar_demanda(uuid,text,uuid,text) TO authenticated,service_role;
GRANT EXECUTE ON FUNCTION public.gsa_admin_update_provider_demand(uuid,text,uuid,text,jsonb,uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.gsa_admin_add_demand_history(uuid,text,uuid,text,text,uuid,uuid,uuid,numeric,uuid) TO service_role;

-- Provider deletion must preserve the operational record.
ALTER TABLE public.prestador_demandas DROP CONSTRAINT IF EXISTS prestador_demandas_prestador_id_fkey;
ALTER TABLE public.prestador_demandas ADD CONSTRAINT prestador_demandas_prestador_id_fkey
  FOREIGN KEY(prestador_id) REFERENCES public.prestadores(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_prestador_demandas_status_created
  ON public.prestador_demandas(status,created_at DESC);
CREATE INDEX IF NOT EXISTS idx_prestador_demandas_provider_status_created
  ON public.prestador_demandas(prestador_id,status,created_at DESC);
CREATE UNIQUE INDEX IF NOT EXISTS uq_prestador_demandas_active_os
  ON public.prestador_demandas(os_id)
  WHERE os_id IS NOT NULL AND status NOT IN ('concluida','finalizada','cancelada','concluida_interna');

-- Backfill missing audit history without changing business status.
INSERT INTO public.prestador_demandas_historico(demanda_id,tipo_evento,motivo)
SELECT d.id,'cancelamento','Registro histórico reconstruído: demanda já constava como cancelada.'
FROM public.prestador_demandas d
WHERE d.status='cancelada' AND NOT EXISTS (
  SELECT 1 FROM public.prestador_demandas_historico h WHERE h.demanda_id=d.id);

NOTIFY pgrst,'reload schema';
COMMIT;
