BEGIN;

ALTER TABLE public.classificados_propostas
  ADD COLUMN IF NOT EXISTS aprovada_pela_gsa boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS moderada_em timestamptz;

UPDATE public.classificados_propostas
SET aprovada_pela_gsa = true,
    moderada_em = COALESCE(moderada_em, updated_at, now())
WHERE status IN ('aguardando_vendedor','aguardando_comprador','contraproposta','aceita')
  AND aprovada_pela_gsa = false;

CREATE OR REPLACE FUNCTION public.gsa_classified_proposal_moderation_guard()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'public', 'pg_temp'
AS $function$
BEGIN
  IF NOT OLD.aprovada_pela_gsa
     AND OLD.status IN ('em_analise_gsa','nova')
     AND NEW.status = 'aguardando_vendedor' THEN
    NEW.aprovada_pela_gsa := true;
    NEW.moderada_em := COALESCE(NEW.moderada_em, now());
  END IF;
  RETURN NEW;
END;
$function$;
DROP TRIGGER IF EXISTS trg_classified_proposal_moderation_guard ON public.classificados_propostas;
CREATE TRIGGER trg_classified_proposal_moderation_guard
BEFORE UPDATE ON public.classificados_propostas
FOR EACH ROW EXECUTE FUNCTION public.gsa_classified_proposal_moderation_guard();

DROP POLICY IF EXISTS classificados_propostas_participantes_select ON public.classificados_propostas;
CREATE POLICY classificados_propostas_participantes_select
ON public.classificados_propostas
FOR SELECT
USING (
  public.gsa_jwt_session_is_valid()
  AND (
    public.gsa_jwt_actor_id() = comprador_id
    OR (
      public.gsa_jwt_actor_id() = vendedor_id
      AND aprovada_pela_gsa = true
    )
  )
);

DROP POLICY IF EXISTS classificados_mensagens_participantes_select ON public.classificados_mensagens;
CREATE POLICY classificados_mensagens_participantes_select
ON public.classificados_mensagens
FOR SELECT
USING (
  public.gsa_jwt_session_is_valid()
  AND EXISTS (
    SELECT 1
    FROM public.classificados_propostas p
    WHERE p.id = classificados_mensagens.proposta_id
      AND (
        public.gsa_jwt_actor_id() = p.comprador_id
        OR (
          public.gsa_jwt_actor_id() = p.vendedor_id
          AND p.aprovada_pela_gsa = true
        )
      )
      AND (
        classificados_mensagens.remetente_id = public.gsa_jwt_actor_id()
        OR classificados_mensagens.status_moderacao = 'aprovada'
      )
  )
);

CREATE OR REPLACE FUNCTION public.rpc_enviar_mensagem_classificado(
  p_proposta_id uuid,
  p_remetente_id uuid,
  p_conteudo text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  v_actor uuid := public.gsa_jwt_actor_id();
  v_id uuid;
  v_prop public.classificados_propostas%ROWTYPE;
BEGIN
  IF NOT public.gsa_jwt_session_is_valid() OR v_actor IS NULL OR v_actor <> p_remetente_id THEN
    RAISE EXCEPTION 'Sessão inválida.' USING ERRCODE = '42501';
  END IF;

  SELECT * INTO v_prop
  FROM public.classificados_propostas
  WHERE id = p_proposta_id;

  IF NOT FOUND OR v_actor NOT IN (v_prop.comprador_id, v_prop.vendedor_id) THEN
    RAISE EXCEPTION 'Proposta não encontrada.' USING ERRCODE = '42501';
  END IF;
  IF NOT v_prop.aprovada_pela_gsa OR v_prop.status NOT IN ('aguardando_vendedor','aguardando_comprador','contraproposta') THEN
    RAISE EXCEPTION 'A negociação não está aberta para mensagens.' USING ERRCODE = '22023';
  END IF;
  IF length(trim(COALESCE(p_conteudo,''))) NOT BETWEEN 1 AND 2000 THEN
    RAISE EXCEPTION 'Mensagem inválida.' USING ERRCODE = '22023';
  END IF;
  INSERT INTO public.classificados_mensagens(proposta_id,remetente_id,conteudo,status,status_moderacao)
  VALUES (p_proposta_id,v_actor,trim(p_conteudo),'pendente','pendente')
  RETURNING id INTO v_id;

  INSERT INTO public.notificacoes(
    titulo,mensagem,modulo,tab,item_id,destinatario_tipo,
    prioridade,acao_origem,contexto
  )
  VALUES(
    'Mensagem pendente nos Classificados',
    'Uma nova mensagem de negociação aguarda moderação.',
    'classificados','mensagens',v_id::text,'admin',
    'alta','classificado_mensagem_pendente',
    jsonb_build_object('mensagem_id',v_id,'proposta_id',p_proposta_id)
  );

  RETURN jsonb_build_object('success',true,'id',v_id,'status','pendente');
END;
$function$;

COMMIT;
