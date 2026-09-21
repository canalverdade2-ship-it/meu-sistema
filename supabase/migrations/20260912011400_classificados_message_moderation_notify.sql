BEGIN;

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
DECLARE
  v_status text;
  v_msg public.classificados_mensagens%ROWTYPE;
  v_prop public.classificados_propostas%ROWTYPE;
  v_destino uuid;
BEGIN
  v_status := CASE lower(trim(COALESCE(p_acao,'')))
    WHEN 'approve' THEN 'aprovada'
    WHEN 'aprovar' THEN 'aprovada'
    WHEN 'reject' THEN 'rejeitada'
    WHEN 'rejeitar' THEN 'rejeitada'
    ELSE NULL
  END;
  IF v_status IS NULL THEN
    RAISE EXCEPTION 'Ação de moderação inválida.' USING ERRCODE='22023';
  END IF;

  SELECT * INTO v_msg
  FROM public.classificados_mensagens
  WHERE id=p_mensagem_id AND proposta_id=p_proposta_id
  FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Mensagem não encontrada.' USING ERRCODE='P0002';
  END IF;

  SELECT * INTO v_prop
  FROM public.classificados_propostas
  WHERE id=p_proposta_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Proposta não encontrada.' USING ERRCODE='P0002';
  END IF;

  UPDATE public.classificados_mensagens
  SET status=v_status,
      status_moderacao=v_status,
      moderada_em=now(),
      motivo_rejeicao=CASE WHEN v_status='rejeitada' THEN COALESCE(motivo_rejeicao,'Rejeitada pela moderação GSA.') ELSE NULL END
  WHERE id=p_mensagem_id;
  IF v_status='aprovada' THEN
    v_destino := CASE WHEN v_msg.remetente_id=v_prop.comprador_id THEN v_prop.vendedor_id ELSE v_prop.comprador_id END;
    INSERT INTO public.notificacoes(
      cliente_id,titulo,mensagem,modulo,tab,item_id,destinatario_tipo,
      prioridade,acao_origem,contexto
    ) VALUES (
      v_destino,'Nova mensagem nos Classificados',
      'Uma nova mensagem aprovada pela GSA está disponível na negociação.',
      'classificados','negociacoes',p_proposta_id::text,'cliente',
      'normal','classificado_mensagem_aprovada',
      jsonb_build_object('proposta_id',p_proposta_id,'mensagem_id',p_mensagem_id)
    );
  ELSE
    INSERT INTO public.notificacoes(
      cliente_id,titulo,mensagem,modulo,tab,item_id,destinatario_tipo,
      prioridade,acao_origem,contexto
    ) VALUES (
      v_msg.remetente_id,'Mensagem não aprovada',
      'Uma mensagem enviada na negociação dos Classificados não foi aprovada pela moderação.',
      'classificados','negociacoes',p_proposta_id::text,'cliente',
      'normal','classificado_mensagem_rejeitada',
      jsonb_build_object('proposta_id',p_proposta_id,'mensagem_id',p_mensagem_id)
    );
  END IF;
  RETURN jsonb_build_object('success',true,'status',v_status);
END;
$function$;

REVOKE ALL ON FUNCTION public.rpc_moderar_mensagem_classificado(uuid,uuid,text)
FROM PUBLIC, anon, authenticated;

COMMIT;
