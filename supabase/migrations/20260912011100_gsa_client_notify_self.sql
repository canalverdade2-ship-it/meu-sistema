BEGIN;
CREATE OR REPLACE FUNCTION public.gsa_client_notify_self(
  p_sessao_id uuid,
  p_session_token text,
  p_titulo text,
  p_mensagem text,
  p_modulo text,
  p_acao_origem text,
  p_tab text DEFAULT NULL,
  p_item_id text DEFAULT NULL,
  p_prioridade text DEFAULT 'normal',
  p_contexto jsonb DEFAULT '{}'::jsonb,
  p_tipo text DEFAULT 'sistema'
) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE v_cliente uuid; v_id uuid; v_count integer;
BEGIN
  SELECT ator_id INTO v_cliente
  FROM public.gsa_validate_session(p_sessao_id,p_session_token)
  WHERE is_valid AND ator_tipo='cliente' LIMIT 1;
  IF v_cliente IS NULL THEN RAISE EXCEPTION 'Sessão de cliente inválida ou expirada.' USING ERRCODE='42501'; END IF;
  IF length(trim(coalesce(p_titulo,''))) < 2 OR length(trim(coalesce(p_mensagem,''))) < 2 THEN
    RAISE EXCEPTION 'Título e mensagem são obrigatórios.' USING ERRCODE='22023';
  END IF;
  SELECT count(*) INTO v_count FROM public.notificacoes
   WHERE cliente_id=v_cliente AND destinatario_tipo='cliente' AND data_criacao >= now()-interval '1 minute';
  IF v_count >= 20 THEN RAISE EXCEPTION 'Limite de notificações excedido. Aguarde antes de tentar novamente.' USING ERRCODE='42901'; END IF;
  INSERT INTO public.notificacoes(cliente_id,titulo,mensagem,modulo,tab,item_id,destinatario_tipo,prioridade,acao_origem,contexto,tipo,lida,data_criacao)
  VALUES(v_cliente,left(trim(p_titulo),160),left(trim(p_mensagem),2000),left(trim(coalesce(p_modulo,'sistema')),80),nullif(trim(coalesce(p_tab,'')),''),nullif(trim(coalesce(p_item_id,'')),''),'cliente',CASE WHEN p_prioridade IN ('baixa','normal','alta','urgente') THEN p_prioridade ELSE 'normal' END,left(trim(coalesce(p_acao_origem,'sistema')),120),coalesce(p_contexto,'{}'::jsonb)||jsonb_build_object('actor_id',v_cliente,'actor_type','cliente'),coalesce(nullif(trim(p_tipo),''),'sistema'),false,now())
  RETURNING id INTO v_id;
  RETURN jsonb_build_object('success',true,'id',v_id);
END; $$;
REVOKE ALL ON FUNCTION public.gsa_client_notify_self(uuid,text,text,text,text,text,text,text,text,jsonb,text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.gsa_client_notify_self(uuid,text,text,text,text,text,text,text,text,jsonb,text) TO anon,authenticated;
COMMIT;
