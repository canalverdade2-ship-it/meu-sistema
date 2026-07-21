-- Publicação real e segura de anúncios nos Classificados.

BEGIN;

CREATE EXTENSION IF NOT EXISTS pgcrypto;

ALTER TABLE public.classificados_anuncios
  ADD COLUMN IF NOT EXISTS cliente_id uuid,
  ADD COLUMN IF NOT EXISTS categoria text,
  ADD COLUMN IF NOT EXISTS titulo text,
  ADD COLUMN IF NOT EXISTS descricao text,
  ADD COLUMN IF NOT EXISTS preco numeric(14,2),
  ADD COLUMN IF NOT EXISTS cidade text,
  ADD COLUMN IF NOT EXISTS estado text,
  ADD COLUMN IF NOT EXISTS bairro text,
  ADD COLUMN IF NOT EXISTS detalhes jsonb NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS comissao_percentual numeric(5,2),
  ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'aguardando_revisao',
  ADD COLUMN IF NOT EXISTS slug text,
  ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now();

CREATE TABLE IF NOT EXISTS public.classificados_midias (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  anuncio_id uuid NOT NULL REFERENCES public.classificados_anuncios(id) ON DELETE CASCADE,
  url text NOT NULL,
  tipo text NOT NULL DEFAULT 'image',
  ordem integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.classificados_midias
  ADD COLUMN IF NOT EXISTS anuncio_id uuid,
  ADD COLUMN IF NOT EXISTS url text,
  ADD COLUMN IF NOT EXISTS tipo text DEFAULT 'image',
  ADD COLUMN IF NOT EXISTS ordem integer DEFAULT 0,
  ADD COLUMN IF NOT EXISTS created_at timestamptz DEFAULT now();

CREATE INDEX IF NOT EXISTS idx_classificados_anuncios_cliente
  ON public.classificados_anuncios(cliente_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_classificados_anuncios_status
  ON public.classificados_anuncios(status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_classificados_midias_anuncio
  ON public.classificados_midias(anuncio_id, ordem ASC);

CREATE OR REPLACE FUNCTION public.rpc_criar_anuncio_classificado(
  p_bairro text,
  p_categoria text,
  p_cidade text,
  p_cliente_id uuid,
  p_comissao_aceita numeric,
  p_descricao text,
  p_detalhes jsonb,
  p_estado text,
  p_midias jsonb,
  p_preco numeric,
  p_titulo text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_claims jsonb := COALESCE(auth.jwt(), '{}'::jsonb);
  v_actor_id uuid;
  v_actor_type text;
  v_categoria text := lower(trim(COALESCE(p_categoria, '')));
  v_titulo text := trim(COALESCE(p_titulo, ''));
  v_descricao text := trim(COALESCE(p_descricao, ''));
  v_cidade text := trim(COALESCE(p_cidade, ''));
  v_estado text := upper(trim(COALESCE(p_estado, '')));
  v_bairro text := trim(COALESCE(p_bairro, ''));
  v_comissao numeric(5,2);
  v_anuncio_id uuid;
  v_slug text;
  v_media jsonb;
  v_media_count integer;
  v_client jsonb;
  v_status text;
  v_blocked boolean;
  v_approved boolean;
BEGIN
  BEGIN
    v_actor_id := NULLIF(v_claims -> 'app_metadata' ->> 'gsa_actor_id', '')::uuid;
  EXCEPTION WHEN invalid_text_representation THEN
    RAISE EXCEPTION 'Identidade da sessão inválida.' USING ERRCODE = '42501';
  END;
  v_actor_type := lower(COALESCE(v_claims -> 'app_metadata' ->> 'gsa_actor_type', ''));

  IF v_actor_type <> 'cliente' OR v_actor_id IS NULL OR v_actor_id <> p_cliente_id THEN
    RAISE EXCEPTION 'Sessão de cliente inválida.' USING ERRCODE = '42501';
  END IF;

  IF NOT COALESCE(public.gsa_jwt_session_is_valid(), false) THEN
    RAISE EXCEPTION 'Sua sessão expirou. Faça login novamente.' USING ERRCODE = '42501';
  END IF;

  SELECT to_jsonb(c) INTO v_client
    FROM public.clientes c
   WHERE c.id = v_actor_id;

  IF v_client IS NULL THEN
    RAISE EXCEPTION 'Cadastro do cliente não encontrado.' USING ERRCODE = 'P0002';
  END IF;

  v_status := lower(COALESCE(v_client ->> 'status', 'ativo'));
  v_blocked := lower(COALESCE(v_client ->> 'bloqueado', 'false')) IN ('true','t','1','sim','yes');
  v_approved := lower(COALESCE(v_client ->> 'cadastro_aprovado', 'true')) NOT IN ('false','f','0','nao','não','no');

  IF v_status NOT IN ('ativo','ativa','active','aprovado','aprovada') OR v_blocked OR NOT v_approved THEN
    RAISE EXCEPTION 'Seu cadastro não está liberado para publicar anúncios.' USING ERRCODE = '42501';
  END IF;

  IF v_categoria NOT IN ('imoveis','veiculos','geral') THEN
    RAISE EXCEPTION 'Categoria inválida.' USING ERRCODE = '22023';
  END IF;
  IF length(v_titulo) < 5 OR length(v_titulo) > 120 THEN
    RAISE EXCEPTION 'O título deve possuir entre 5 e 120 caracteres.' USING ERRCODE = '22023';
  END IF;
  IF length(v_descricao) < 20 OR length(v_descricao) > 5000 THEN
    RAISE EXCEPTION 'A descrição deve possuir entre 20 e 5000 caracteres.' USING ERRCODE = '22023';
  END IF;
  IF p_preco IS NULL OR p_preco <= 0 OR p_preco > 999999999.99 THEN
    RAISE EXCEPTION 'Informe um preço válido.' USING ERRCODE = '22023';
  END IF;
  IF length(v_cidade) < 2 OR length(v_estado) <> 2 THEN
    RAISE EXCEPTION 'Informe cidade e estado válidos.' USING ERRCODE = '22023';
  END IF;
  IF p_midias IS NULL OR jsonb_typeof(p_midias) <> 'array' THEN
    RAISE EXCEPTION 'As mídias do anúncio são obrigatórias.' USING ERRCODE = '22023';
  END IF;

  v_media_count := jsonb_array_length(p_midias);
  IF v_media_count < 1 OR v_media_count > 10 THEN
    RAISE EXCEPTION 'O anúncio deve possuir entre 1 e 10 imagens.' USING ERRCODE = '22023';
  END IF;

  SELECT percentual INTO v_comissao
    FROM public.classificados_comissoes_config
   WHERE categoria = v_categoria AND ativo = true;

  IF v_comissao IS NULL THEN
    RAISE EXCEPTION 'A comissão desta categoria não está configurada.' USING ERRCODE = 'P0002';
  END IF;

  IF p_comissao_aceita IS NULL OR round(p_comissao_aceita, 2) <> round(v_comissao, 2) THEN
    RAISE EXCEPTION 'A comissão foi atualizada. Revise os termos antes de publicar.' USING ERRCODE = '22023';
  END IF;

  v_slug := regexp_replace(lower(unaccent(v_titulo)), '[^a-z0-9]+', '-', 'g');
  v_slug := trim(both '-' from v_slug) || '-' || substr(replace(gen_random_uuid()::text, '-', ''), 1, 10);

  INSERT INTO public.classificados_anuncios (
    cliente_id, categoria, titulo, descricao, preco,
    cidade, estado, bairro, detalhes, comissao_percentual,
    status, slug, created_at, updated_at
  ) VALUES (
    v_actor_id, v_categoria, v_titulo, v_descricao, round(p_preco, 2),
    v_cidade, v_estado, NULLIF(v_bairro, ''), COALESCE(p_detalhes, '{}'::jsonb), v_comissao,
    'aguardando_revisao', v_slug, now(), now()
  ) RETURNING id INTO v_anuncio_id;

  FOR v_media IN SELECT value FROM jsonb_array_elements(p_midias)
  LOOP
    IF jsonb_typeof(v_media) <> 'object'
       OR COALESCE(v_media ->> 'url', '') !~ '^https://'
       OR lower(COALESCE(v_media ->> 'tipo', 'image')) NOT IN ('image','imagem')
       OR COALESCE((v_media ->> 'ordem')::integer, -1) < 0
       OR COALESCE((v_media ->> 'ordem')::integer, -1) >= 10 THEN
      RAISE EXCEPTION 'Uma das mídias enviadas é inválida.' USING ERRCODE = '22023';
    END IF;

    IF position('/storage/v1/object/public/classificados-midias/' || v_actor_id::text || '/' IN (v_media ->> 'url')) = 0 THEN
      RAISE EXCEPTION 'Uma das imagens não pertence ao cliente autenticado.' USING ERRCODE = '42501';
    END IF;

    INSERT INTO public.classificados_midias (anuncio_id, url, tipo, ordem, created_at)
    VALUES (
      v_anuncio_id,
      v_media ->> 'url',
      'image',
      (v_media ->> 'ordem')::integer,
      now()
    );
  END LOOP;

  RETURN jsonb_build_object(
    'success', true,
    'id', v_anuncio_id,
    'slug', v_slug,
    'status', 'aguardando_revisao',
    'comissao_percentual', v_comissao
  );
END;
$$;

REVOKE ALL ON FUNCTION public.rpc_criar_anuncio_classificado(
  text,text,text,uuid,numeric,text,jsonb,text,jsonb,numeric,text
) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.rpc_criar_anuncio_classificado(
  text,text,text,uuid,numeric,text,jsonb,text,jsonb,numeric,text
) TO authenticated, service_role;

NOTIFY pgrst, 'reload schema';

COMMIT;
