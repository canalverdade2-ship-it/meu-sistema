BEGIN;

ALTER TABLE public.classificados_propostas
  ADD COLUMN IF NOT EXISTS ultima_oferta_por uuid;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'public.classificados_propostas'::regclass
      AND conname = 'classificados_propostas_ultima_oferta_por_fkey'
  ) THEN
    ALTER TABLE public.classificados_propostas
      ADD CONSTRAINT classificados_propostas_ultima_oferta_por_fkey
      FOREIGN KEY (ultima_oferta_por) REFERENCES public.clientes(id) ON DELETE SET NULL;
  END IF;
END $$;

UPDATE public.classificados_propostas
SET ultima_oferta_por = comprador_id
WHERE ultima_oferta_por IS NULL;
CREATE OR REPLACE FUNCTION public.gsa_admin_resource_config(p_resource text)
RETURNS jsonb
LANGUAGE plpgsql
IMMUTABLE SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  v_resource text := lower(trim(COALESCE(p_resource, '')));
BEGIN
  RETURN CASE v_resource
    WHEN 'classificados_anuncios' THEN jsonb_build_object('table','classificados_anuncios','module','classificados','status_column','status')
    WHEN 'classificados_propostas' THEN jsonb_build_object('table','classificados_propostas','module','classificados','status_column','status')
    WHEN 'classificados_mensagens' THEN jsonb_build_object('table','classificados_mensagens','module','classificados','status_column','status_moderacao')
    WHEN 'classificados_transacoes' THEN jsonb_build_object('table','classificados_transacoes','module','classificados','status_column','status')
    WHEN 'saude_parceiros' THEN jsonb_build_object('table','saude_parceiros','module','saude','status_column','status')
    WHEN 'saude_produtos' THEN jsonb_build_object('table','saude_produtos','module','saude','status_column','status')
    WHEN 'saude_cotacoes' THEN jsonb_build_object('table','saude_cotacoes','module','saude','status_column','status')
    WHEN 'saude_propostas' THEN jsonb_build_object('table','saude_propostas','module','saude','status_column','status')
    WHEN 'saude_contratos' THEN jsonb_build_object('table','saude_contratos','module','saude','status_column','status')
    WHEN 'saude_assessorias' THEN jsonb_build_object('table','saude_assessorias','module','saude','status_column','status')
    WHEN 'saude_comissoes' THEN jsonb_build_object('table','saude_comissoes','module','saude','status_column','status')
    WHEN 'saude_documentos' THEN jsonb_build_object('table','saude_documentos','module','saude','status_column','status')
    WHEN 'saude_atendimentos' THEN jsonb_build_object('table','saude_atendimentos','module','saude','status_column','status')
    WHEN 'seguros_parceiros' THEN jsonb_build_object('table','seguros_parceiros','module','seguros','status_column','status')
    WHEN 'seguros_produtos' THEN jsonb_build_object('table','seguros_produtos','module','seguros','status_column','status')
    WHEN 'seguros_cotacoes' THEN jsonb_build_object('table','seguros_cotacoes','module','seguros','status_column','status')
    WHEN 'seguros_propostas' THEN jsonb_build_object('table','seguros_propostas','module','seguros','status_column','status')
    WHEN 'seguros_apolices' THEN jsonb_build_object('table','seguros_apolices','module','seguros','status_column','status')
    WHEN 'seguros_assessorias' THEN jsonb_build_object('table','seguros_assessorias','module','seguros','status_column','status')
    WHEN 'seguros_comissoes' THEN jsonb_build_object('table','seguros_comissoes','module','seguros','status_column','status')
    WHEN 'seguros_documentos' THEN jsonb_build_object('table','seguros_documentos','module','seguros','status_column','status')
    WHEN 'seguros_assistencias' THEN jsonb_build_object('table','seguros_assistencias','module','seguros','status_column','status')
    WHEN 'seguros_sinistros' THEN jsonb_build_object('table','seguros_sinistros','module','seguros','status_column','status')
    WHEN 'seguros_atendimentos' THEN jsonb_build_object('table','seguros_atendimentos','module','seguros','status_column','status')
    WHEN 'ordens_fiscais' THEN jsonb_build_object('table','ordens_fiscais','module','fiscal','status_column','status_emissao')
    WHEN 'empresa' THEN jsonb_build_object('table','empresa','module','configuracoes','status_column',NULL)
    WHEN 'formas_pagamento' THEN jsonb_build_object('table','formas_pagamento','module','configuracoes','status_column','ativo')
    ELSE NULL
  END;
END;
$function$;
CREATE OR REPLACE FUNCTION public.rpc_criar_proposta_classificado(
  p_anuncio_id uuid,
  p_comprador_id uuid,
  p_valor_proposta numeric,
  p_mensagem text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  v_actor uuid := public.gsa_jwt_actor_id();
  v_anuncio public.classificados_anuncios%ROWTYPE;
  v_id uuid;
BEGIN
  IF NOT public.gsa_jwt_session_is_valid() OR v_actor IS NULL OR v_actor <> p_comprador_id THEN
    RAISE EXCEPTION 'Sessão de cliente inválida.' USING ERRCODE = '42501';
  END IF;
  SELECT * INTO v_anuncio FROM public.classificados_anuncios WHERE id = p_anuncio_id AND status = 'publicado';
  IF NOT FOUND THEN RAISE EXCEPTION 'Anúncio indisponível.' USING ERRCODE = 'P0002'; END IF;
  IF v_anuncio.cliente_id = v_actor THEN RAISE EXCEPTION 'Você não pode propor em seu próprio anúncio.' USING ERRCODE = '22023'; END IF;
  IF p_valor_proposta IS NULL OR p_valor_proposta <= 0 THEN RAISE EXCEPTION 'Valor de proposta inválido.' USING ERRCODE = '22023'; END IF;
  INSERT INTO public.classificados_propostas(
    anuncio_id, comprador_id, vendedor_id, valor_proposta, status,
    mensagem_inicial, ultima_oferta_por
  )
  VALUES (
    v_anuncio.id, v_actor, v_anuncio.cliente_id, round(p_valor_proposta,2),
    'em_analise_gsa', NULLIF(trim(p_mensagem),''), v_actor
  )
  RETURNING id INTO v_id;

  RETURN jsonb_build_object('success', true, 'id', v_id, 'status', 'em_analise_gsa');
END;
$function$;

CREATE OR REPLACE FUNCTION public.rpc_moderar_mensagem_classificado(
  p_mensagem_id uuid,
  p_proposta_id uuid,
  p_acao text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE v_status text;
BEGIN
  v_status := CASE lower(trim(COALESCE(p_acao,'')))
    WHEN 'approve' THEN 'aprovada'
    WHEN 'aprovar' THEN 'aprovada'
    WHEN 'reject' THEN 'rejeitada'
    WHEN 'rejeitar' THEN 'rejeitada'
    ELSE NULL
  END;
  IF v_status IS NULL THEN
    RAISE EXCEPTION 'Ação de moderação inválida.' USING ERRCODE = '22023';
  END IF;

  UPDATE public.classificados_mensagens
  SET status = v_status,
      status_moderacao = v_status,
      moderada_em = now(),
      motivo_rejeicao = CASE WHEN v_status = 'rejeitada' THEN COALESCE(motivo_rejeicao, 'Rejeitada pela moderação GSA.') ELSE NULL END
  WHERE id = p_mensagem_id
    AND proposta_id = p_proposta_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Mensagem não encontrada.' USING ERRCODE = 'P0002';
  END IF;
  RETURN jsonb_build_object('success', true, 'status', v_status);
END;
$function$;

REVOKE ALL ON FUNCTION public.rpc_moderar_mensagem_classificado(uuid,uuid,text) FROM PUBLIC, anon, authenticated;
CREATE OR REPLACE FUNCTION public.gsa_admin_classified_action(
  p_sessao_id uuid DEFAULT NULL,
  p_session_token text DEFAULT NULL,
  p_entity text DEFAULT NULL,
  p_id uuid DEFAULT NULL,
  p_related_id uuid DEFAULT NULL,
  p_action text DEFAULT NULL,
  p_reason text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  v_action text := lower(trim(COALESCE(p_action, '')));
BEGIN
  PERFORM public.gsa_admin_validate_context(p_sessao_id, p_session_token);
  PERFORM public.gsa_admin_assert_module('classificados');

  IF p_entity = 'anuncio' THEN
    IF v_action = 'aprovar' THEN
      UPDATE public.classificados_anuncios SET status = 'publicado', motivo_rejeicao = NULL WHERE id = p_id;
    ELSIF v_action = 'rejeitar' THEN
      IF length(trim(COALESCE(p_reason, ''))) < 3 THEN
        RAISE EXCEPTION 'Informe o motivo da rejeição.' USING ERRCODE = '22023';
      END IF;
      UPDATE public.classificados_anuncios
      SET status = 'rejeitado', motivo_rejeicao = trim(p_reason)
      WHERE id = p_id;
    ELSE
      RAISE EXCEPTION 'Ação de anúncio inválida.' USING ERRCODE = '22023';
    END IF;

  ELSIF p_entity = 'proposta' THEN
    IF v_action = 'aprovar' THEN
      UPDATE public.classificados_propostas
      SET status = 'aguardando_vendedor'
      WHERE id = p_id AND status IN ('em_analise_gsa','nova');
    ELSIF v_action = 'rejeitar' THEN
      IF length(trim(COALESCE(p_reason, ''))) < 3 THEN
        RAISE EXCEPTION 'Informe o motivo da rejeição.' USING ERRCODE = '22023';
      END IF;
      UPDATE public.classificados_propostas
      SET status = 'rejeitada', motivo_rejeicao = trim(p_reason)
      WHERE id = p_id AND status IN ('em_analise_gsa','nova');
    ELSE
      RAISE EXCEPTION 'Ação de proposta inválida.' USING ERRCODE = '22023';
    END IF;

  ELSIF p_entity = 'mensagem' THEN
    IF v_action NOT IN ('aprovar', 'rejeitar') THEN
      RAISE EXCEPTION 'Ação de mensagem inválida.' USING ERRCODE = '22023';
    END IF;
    PERFORM public.rpc_moderar_mensagem_classificado(
      p_id,
      p_related_id,
      CASE WHEN v_action = 'aprovar' THEN 'approve' ELSE 'reject' END
    );
  ELSE
    RAISE EXCEPTION 'Entidade de classificado inválida.' USING ERRCODE = '22023';
  END IF;

  IF p_entity IN ('anuncio','proposta') AND NOT FOUND THEN
    RAISE EXCEPTION 'Registro não encontrado ou estado incompatível.' USING ERRCODE = 'P0002';
  END IF;

  IF p_entity = 'proposta' AND v_action = 'aprovar' THEN
    INSERT INTO public.notificacoes(cliente_id,titulo,mensagem,modulo,tab,item_id,destinatario_tipo,prioridade,acao_origem,contexto)
    SELECT vendedor_id,'Nova proposta nos Classificados','Uma proposta aprovada pela GSA aguarda sua resposta.','classificados','negociacoes',id::text,'cliente','alta','classificado_proposta_aprovada',jsonb_build_object('proposta_id',id,'anuncio_id',anuncio_id)
    FROM public.classificados_propostas WHERE id = p_id;
  ELSIF p_entity = 'proposta' AND v_action = 'rejeitar' THEN
    INSERT INTO public.notificacoes(cliente_id,titulo,mensagem,modulo,tab,item_id,destinatario_tipo,prioridade,acao_origem,contexto)
    SELECT comprador_id,'Proposta não aprovada','Sua proposta nos Classificados não foi aprovada pela moderação GSA.','classificados','negociacoes',id::text,'cliente','normal','classificado_proposta_rejeitada',jsonb_build_object('proposta_id',id,'motivo',p_reason)
    FROM public.classificados_propostas WHERE id = p_id;
  END IF;
  PERFORM public.gsa_admin_write_audit(
    'classificados',
    upper(v_action),
    p_entity,
    p_id,
    jsonb_build_object('related_id',p_related_id,'reason',p_reason)
  );
  RETURN jsonb_build_object('success',true);
END;
$function$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conrelid='public.classificados_transacoes'::regclass AND conname='classificados_transacoes_proposta_id_key') THEN
    ALTER TABLE public.classificados_transacoes ADD CONSTRAINT classificados_transacoes_proposta_id_key UNIQUE (proposta_id);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conrelid='public.classificados_comissoes'::regclass AND conname='classificados_comissoes_transacao_id_key') THEN
    ALTER TABLE public.classificados_comissoes ADD CONSTRAINT classificados_comissoes_transacao_id_key UNIQUE (transacao_id);
  END IF;
END $$;
CREATE OR REPLACE FUNCTION public.rpc_responder_proposta_classificado(
  p_proposta_id uuid,
  p_acao text,
  p_valor_contraproposta numeric DEFAULT NULL,
  p_motivo text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  v_actor uuid := public.gsa_jwt_actor_id();
  v_prop public.classificados_propostas%ROWTYPE;
  v_anuncio public.classificados_anuncios%ROWTYPE;
  v_final numeric(14,2);
  v_percent numeric(5,2);
  v_transacao uuid;
  v_comissao numeric(14,2);
  v_acao text := lower(trim(COALESCE(p_acao,'')));
  v_destino uuid;
  v_status text;
BEGIN
  IF NOT public.gsa_jwt_session_is_valid() OR v_actor IS NULL THEN
    RAISE EXCEPTION 'Sessão inválida.' USING ERRCODE='42501';
  END IF;

  SELECT * INTO v_prop
  FROM public.classificados_propostas
  WHERE id = p_proposta_id
  FOR UPDATE;

  IF NOT FOUND OR v_actor NOT IN (v_prop.comprador_id,v_prop.vendedor_id) THEN
    RAISE EXCEPTION 'Proposta não encontrada.' USING ERRCODE='42501';
  END IF;

  IF v_prop.status IN ('aceita','rejeitada','cancelada') THEN
    RAISE EXCEPTION 'A negociação já foi encerrada.' USING ERRCODE='22023';
  END IF;

  SELECT * INTO v_anuncio
  FROM public.classificados_anuncios
  WHERE id = v_prop.anuncio_id
  FOR UPDATE;

  v_destino := CASE WHEN v_actor = v_prop.comprador_id THEN v_prop.vendedor_id ELSE v_prop.comprador_id END;
  IF v_acao = 'aceitar' THEN
    IF v_prop.status NOT IN ('aguardando_vendedor','aguardando_comprador','contraproposta') THEN
      RAISE EXCEPTION 'A proposta ainda não está disponível para aceite.' USING ERRCODE='22023';
    END IF;
    IF COALESCE(v_prop.ultima_oferta_por,v_prop.comprador_id) = v_actor THEN
      RAISE EXCEPTION 'Você não pode aceitar a própria oferta.' USING ERRCODE='22023';
    END IF;

    v_final := round(COALESCE(v_prop.valor_contraproposta,v_prop.valor_proposta),2);
    v_percent := COALESCE(v_anuncio.comissao_percentual,0);
    v_comissao := round(v_final * v_percent / 100,2);

    UPDATE public.classificados_propostas
    SET status='aceita'
    WHERE id=v_prop.id;

    UPDATE public.classificados_anuncios
    SET status='reservado'
    WHERE id=v_anuncio.id;
    INSERT INTO public.classificados_transacoes(
      proposta_id,anuncio_id,comprador_id,vendedor_id,
      valor_final,valor_total,valor_comissao,status
    )
    VALUES(
      v_prop.id,v_anuncio.id,v_prop.comprador_id,v_prop.vendedor_id,
      v_final,v_final,v_comissao,'pendente_pagamento'
    )
    ON CONFLICT (proposta_id) DO UPDATE
      SET valor_final=EXCLUDED.valor_final,
          valor_total=EXCLUDED.valor_total,
          valor_comissao=EXCLUDED.valor_comissao,
          status='pendente_pagamento',
          updated_at=now()
    RETURNING id INTO v_transacao;

    INSERT INTO public.classificados_comissoes(
      transacao_id,vendedor_id,percentual,valor_comissao,status,data_vencimento
    )
    VALUES(v_transacao,v_prop.vendedor_id,v_percent,v_comissao,'nao_gerada',NULL)
    ON CONFLICT (transacao_id) DO UPDATE
      SET percentual=EXCLUDED.percentual,
          valor_comissao=EXCLUDED.valor_comissao,
          updated_at=now();
    INSERT INTO public.notificacoes(cliente_id,titulo,mensagem,modulo,tab,item_id,destinatario_tipo,prioridade,acao_origem,contexto)
    VALUES
      (v_prop.comprador_id,'Negociação aceita','A proposta dos Classificados foi aceita. O negócio aguarda a etapa de pagamento.','classificados','negociacoes',v_prop.id::text,'cliente','alta','classificado_proposta_aceita',jsonb_build_object('proposta_id',v_prop.id,'transacao_id',v_transacao)),
      (v_prop.vendedor_id,'Negociação aceita','A proposta dos Classificados foi aceita. Acompanhe o negócio e o pagamento.','classificados','minhas-vendas',v_prop.id::text,'cliente','alta','classificado_proposta_aceita',jsonb_build_object('proposta_id',v_prop.id,'transacao_id',v_transacao));

  ELSIF v_acao = 'rejeitar' THEN
    IF v_prop.status NOT IN ('aguardando_vendedor','aguardando_comprador','contraproposta') THEN
      RAISE EXCEPTION 'A proposta não está disponível para rejeição.' USING ERRCODE='22023';
    END IF;
    IF COALESCE(v_prop.ultima_oferta_por,v_prop.comprador_id) = v_actor THEN
      RAISE EXCEPTION 'Você não pode rejeitar a própria oferta.' USING ERRCODE='22023';
    END IF;

    UPDATE public.classificados_propostas
    SET status='rejeitada', motivo_rejeicao=NULLIF(trim(p_motivo),'')
    WHERE id=v_prop.id;

    INSERT INTO public.notificacoes(cliente_id,titulo,mensagem,modulo,tab,item_id,destinatario_tipo,prioridade,acao_origem,contexto)
    VALUES(v_destino,'Proposta recusada','A outra parte recusou a proposta nos Classificados.','classificados','negociacoes',v_prop.id::text,'cliente','normal','classificado_proposta_rejeitada',jsonb_build_object('proposta_id',v_prop.id,'motivo',p_motivo));
  ELSIF v_acao = 'contrapropor' THEN
    IF v_prop.status NOT IN ('aguardando_vendedor','aguardando_comprador','contraproposta') THEN
      RAISE EXCEPTION 'A proposta não está disponível para contraproposta.' USING ERRCODE='22023';
    END IF;
    IF COALESCE(v_prop.ultima_oferta_por,v_prop.comprador_id) = v_actor THEN
      RAISE EXCEPTION 'Aguarde a resposta da outra parte antes de alterar sua oferta.' USING ERRCODE='22023';
    END IF;
    IF p_valor_contraproposta IS NULL OR p_valor_contraproposta <= 0 THEN
      RAISE EXCEPTION 'Valor inválido.' USING ERRCODE='22023';
    END IF;

    v_status := CASE WHEN v_actor = v_prop.comprador_id THEN 'aguardando_vendedor' ELSE 'aguardando_comprador' END;
    UPDATE public.classificados_propostas
    SET valor_contraproposta=round(p_valor_contraproposta,2),
        ultima_oferta_por=v_actor,
        status=v_status
    WHERE id=v_prop.id;

    INSERT INTO public.notificacoes(cliente_id,titulo,mensagem,modulo,tab,item_id,destinatario_tipo,prioridade,acao_origem,contexto)
    VALUES(v_destino,'Nova contraproposta','A outra parte enviou uma nova contraproposta nos Classificados.','classificados','negociacoes',v_prop.id::text,'cliente','alta','classificado_contraproposta',jsonb_build_object('proposta_id',v_prop.id,'valor',round(p_valor_contraproposta,2)));
  ELSIF v_acao = 'cancelar' THEN
    IF v_actor <> v_prop.comprador_id THEN
      RAISE EXCEPTION 'Somente o comprador pode cancelar a proposta.' USING ERRCODE='42501';
    END IF;
    IF v_prop.status NOT IN ('em_analise_gsa','nova','aguardando_vendedor','aguardando_comprador','contraproposta') THEN
      RAISE EXCEPTION 'A proposta não pode mais ser cancelada.' USING ERRCODE='22023';
    END IF;

    UPDATE public.classificados_propostas
    SET status='cancelada'
    WHERE id=v_prop.id;

    INSERT INTO public.notificacoes(cliente_id,titulo,mensagem,modulo,tab,item_id,destinatario_tipo,prioridade,acao_origem,contexto)
    SELECT v_prop.vendedor_id,'Proposta cancelada','O comprador cancelou a proposta nos Classificados.','classificados','negociacoes',v_prop.id::text,'cliente','normal','classificado_proposta_cancelada',jsonb_build_object('proposta_id',v_prop.id)
    WHERE v_prop.status NOT IN ('em_analise_gsa','nova');
  ELSE
    RAISE EXCEPTION 'Ação inválida.' USING ERRCODE='22023';
  END IF;

  SELECT status INTO v_status FROM public.classificados_propostas WHERE id=v_prop.id;
  RETURN jsonb_build_object('success',true,'status',v_status,'transacao_id',v_transacao);
END;
$function$;

COMMIT;
