-- Fluxo completo de análise administrativa e correções por campo dos Classificados.
BEGIN;

CREATE TABLE IF NOT EXISTS public.classificados_ajustes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  anuncio_id uuid NOT NULL REFERENCES public.classificados_anuncios(id) ON DELETE CASCADE,
  campos jsonb NOT NULL DEFAULT '[]'::jsonb,
  observacao text NOT NULL,
  status text NOT NULL DEFAULT 'pendente',
  solicitado_por uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  resolvido_at timestamptz,
  CONSTRAINT classificados_ajustes_campos_array CHECK (jsonb_typeof(campos) = 'array'),
  CONSTRAINT classificados_ajustes_status_check CHECK (status IN ('pendente','resolvido','cancelado'))
);

CREATE INDEX IF NOT EXISTS idx_classificados_ajustes_anuncio_status
  ON public.classificados_ajustes(anuncio_id, status, created_at DESC);

ALTER TABLE public.classificados_ajustes ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.classificados_ajustes FROM PUBLIC, anon, authenticated;
GRANT SELECT ON public.classificados_ajustes TO authenticated;
GRANT ALL ON public.classificados_ajustes TO service_role;

DROP POLICY IF EXISTS classificados_ajustes_cliente_select ON public.classificados_ajustes;
CREATE POLICY classificados_ajustes_cliente_select
ON public.classificados_ajustes FOR SELECT TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.classificados_anuncios a
    WHERE a.id = anuncio_id AND a.cliente_id = public.gsa_jwt_actor_id()
  )
);

CREATE OR REPLACE FUNCTION public.gsa_admin_get_classified_detail(p_anuncio_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_context jsonb;
  v_ad jsonb;
  v_client jsonb;
  v_media jsonb;
  v_adjustments jsonb;
BEGIN
  v_context := public.gsa_admin_context();
  IF COALESCE(v_context ->> 'actor_type', '') NOT IN ('admin','colaborador') THEN
    RAISE EXCEPTION 'Sessão administrativa obrigatória.' USING ERRCODE='42501';
  END IF;
  IF (v_context ->> 'actor_type') = 'colaborador'
     AND NOT COALESCE(public.gsa_admin_has_module('classificados'), false) THEN
    RAISE EXCEPTION 'Sem permissão para analisar Classificados.' USING ERRCODE='42501';
  END IF;

  SELECT to_jsonb(a) INTO v_ad
  FROM public.classificados_anuncios a
  WHERE a.id = p_anuncio_id;
  IF v_ad IS NULL THEN
    RAISE EXCEPTION 'Anúncio não encontrado.' USING ERRCODE='P0002';
  END IF;

  SELECT jsonb_build_object(
    'id', c.id,
    'nome', COALESCE(to_jsonb(c)->>'nome', to_jsonb(c)->>'nome_completo', to_jsonb(c)->>'razao_social'),
    'email', COALESCE(to_jsonb(c)->>'email', to_jsonb(c)->>'email_contato'),
    'telefone', COALESCE(to_jsonb(c)->>'telefone', to_jsonb(c)->>'celular'),
    'status', to_jsonb(c)->>'status'
  ) INTO v_client
  FROM public.clientes c
  WHERE c.id = (v_ad->>'cliente_id')::uuid;

  SELECT COALESCE(jsonb_agg(to_jsonb(m) ORDER BY m.ordem, m.created_at), '[]'::jsonb)
    INTO v_media
  FROM public.classificados_midias m
  WHERE m.anuncio_id = p_anuncio_id;

  SELECT COALESCE(jsonb_agg(to_jsonb(j) ORDER BY j.created_at DESC), '[]'::jsonb)
    INTO v_adjustments
  FROM public.classificados_ajustes j
  WHERE j.anuncio_id = p_anuncio_id;

  RETURN jsonb_build_object(
    'success', true,
    'anuncio', v_ad,
    'anunciante', COALESCE(v_client, '{}'::jsonb),
    'midias', v_media,
    'ajustes', v_adjustments
  );
END;
$$;

REVOKE ALL ON FUNCTION public.gsa_admin_get_classified_detail(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.gsa_admin_get_classified_detail(uuid) TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.gsa_admin_request_classified_adjustments(
  p_anuncio_id uuid,
  p_campos jsonb,
  p_observacao text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_context jsonb;
  v_actor_id uuid;
  v_item jsonb;
  v_field text;
  v_adjustment_id uuid;
BEGIN
  v_context := public.gsa_admin_context();
  IF COALESCE(v_context ->> 'actor_type', '') NOT IN ('admin','colaborador') THEN
    RAISE EXCEPTION 'Sessão administrativa obrigatória.' USING ERRCODE='42501';
  END IF;
  IF (v_context ->> 'actor_type') = 'colaborador'
     AND NOT COALESCE(public.gsa_admin_has_module('classificados'), false) THEN
    RAISE EXCEPTION 'Sem permissão para solicitar ajustes.' USING ERRCODE='42501';
  END IF;

  IF p_campos IS NULL OR jsonb_typeof(p_campos) <> 'array' OR jsonb_array_length(p_campos) = 0 THEN
    RAISE EXCEPTION 'Selecione pelo menos um campo para ajuste.' USING ERRCODE='22023';
  END IF;
  IF length(trim(COALESCE(p_observacao,''))) < 5 THEN
    RAISE EXCEPTION 'Informe uma orientação clara para o anunciante.' USING ERRCODE='22023';
  END IF;

  FOR v_item IN SELECT value FROM jsonb_array_elements(p_campos)
  LOOP
    v_field := trim(BOTH '"' FROM v_item::text);
    IF v_field = '' OR length(v_field) > 100 THEN
      RAISE EXCEPTION 'Campo de ajuste inválido.' USING ERRCODE='22023';
    END IF;
  END LOOP;

  IF NOT EXISTS (SELECT 1 FROM public.classificados_anuncios WHERE id=p_anuncio_id) THEN
    RAISE EXCEPTION 'Anúncio não encontrado.' USING ERRCODE='P0002';
  END IF;

  BEGIN
    v_actor_id := NULLIF(v_context->>'actor_id','')::uuid;
  EXCEPTION WHEN OTHERS THEN
    v_actor_id := NULL;
  END;

  UPDATE public.classificados_ajustes
  SET status='cancelado', resolvido_at=now()
  WHERE anuncio_id=p_anuncio_id AND status='pendente';

  INSERT INTO public.classificados_ajustes(anuncio_id, campos, observacao, status, solicitado_por)
  VALUES (p_anuncio_id, p_campos, trim(p_observacao), 'pendente', v_actor_id)
  RETURNING id INTO v_adjustment_id;

  UPDATE public.classificados_anuncios
  SET status='ajustes_solicitados', updated_at=now()
  WHERE id=p_anuncio_id;

  RETURN jsonb_build_object('success',true,'ajuste_id',v_adjustment_id,'status','ajustes_solicitados');
END;
$$;

REVOKE ALL ON FUNCTION public.gsa_admin_request_classified_adjustments(uuid,jsonb,text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.gsa_admin_request_classified_adjustments(uuid,jsonb,text) TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.rpc_reenviar_anuncio_classificado(
  p_anuncio_id uuid,
  p_titulo text,
  p_descricao text,
  p_preco numeric,
  p_cidade text,
  p_estado text,
  p_bairro text,
  p_detalhes jsonb,
  p_midias jsonb
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path=public,pg_temp
AS $$
DECLARE
  v_actor_id uuid := public.gsa_jwt_actor_id();
  v_media jsonb;
BEGIN
  IF v_actor_id IS NULL OR NOT COALESCE(public.gsa_jwt_session_is_valid(),false) THEN
    RAISE EXCEPTION 'Sessão inválida ou expirada.' USING ERRCODE='42501';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM public.classificados_anuncios
    WHERE id=p_anuncio_id AND cliente_id=v_actor_id
      AND status IN ('ajustes_solicitados','rejeitado','rascunho')
  ) THEN
    RAISE EXCEPTION 'Este anúncio não pode ser alterado nesta situação.' USING ERRCODE='42501';
  END IF;
  IF length(trim(COALESCE(p_titulo,''))) < 5 OR length(trim(COALESCE(p_descricao,''))) < 20 THEN
    RAISE EXCEPTION 'Título ou descrição inválidos.' USING ERRCODE='22023';
  END IF;
  IF p_preco IS NULL OR p_preco <= 0 THEN RAISE EXCEPTION 'Preço inválido.' USING ERRCODE='22023'; END IF;
  IF p_midias IS NULL OR jsonb_typeof(p_midias)<>'array' OR jsonb_array_length(p_midias)<1 OR jsonb_array_length(p_midias)>10 THEN
    RAISE EXCEPTION 'O anúncio deve possuir entre 1 e 10 imagens.' USING ERRCODE='22023';
  END IF;

  UPDATE public.classificados_anuncios
  SET titulo=trim(p_titulo), descricao=trim(p_descricao), preco=round(p_preco,2),
      cidade=trim(p_cidade), estado=upper(trim(p_estado)), bairro=NULLIF(trim(p_bairro),''),
      detalhes=COALESCE(p_detalhes,'{}'::jsonb), status='aguardando_revisao', updated_at=now()
  WHERE id=p_anuncio_id;

  DELETE FROM public.classificados_midias WHERE anuncio_id=p_anuncio_id;
  FOR v_media IN SELECT value FROM jsonb_array_elements(p_midias)
  LOOP
    IF COALESCE(v_media->>'url','') !~ '^https://' THEN RAISE EXCEPTION 'Mídia inválida.' USING ERRCODE='22023'; END IF;
    INSERT INTO public.classificados_midias(anuncio_id,url,tipo,ordem)
    VALUES(p_anuncio_id,v_media->>'url','image',COALESCE((v_media->>'ordem')::int,0));
  END LOOP;

  UPDATE public.classificados_ajustes SET status='resolvido', resolvido_at=now()
  WHERE anuncio_id=p_anuncio_id AND status='pendente';

  RETURN jsonb_build_object('success',true,'status','aguardando_revisao');
END;
$$;

REVOKE ALL ON FUNCTION public.rpc_reenviar_anuncio_classificado(uuid,text,text,numeric,text,text,text,jsonb,jsonb) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.rpc_reenviar_anuncio_classificado(uuid,text,text,numeric,text,text,text,jsonb,jsonb) TO authenticated, service_role;

NOTIFY pgrst, 'reload schema';
COMMIT;
