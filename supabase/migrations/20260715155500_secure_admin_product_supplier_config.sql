-- Create administrative table for product supplier configuration
CREATE TABLE public.produto_fornecedor_config (
    produto_id uuid PRIMARY KEY REFERENCES public.produtos(id) ON DELETE CASCADE,
    fornecimento_externo_ativo boolean NOT NULL DEFAULT false,
    tipo_fornecedor text NULL CHECK (tipo_fornecedor IN ('online', 'loja_fisica') OR tipo_fornecedor IS NULL),
    nome_fornecedor text NULL,
    url_produto text NULL,
    cidade text NULL,
    estado text NULL,
    endereco text NULL,
    telefone text NULL,
    observacoes text NULL,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),
    atualizado_por_tipo text NULL,
    atualizado_por_id uuid NULL,
    atualizado_por_nome text NULL
);

-- Basic constraints
ALTER TABLE public.produto_fornecedor_config
    ADD CONSTRAINT check_online_supplier 
    CHECK (
        (fornecimento_externo_ativo = true AND tipo_fornecedor = 'online') 
        IS FALSE OR 
        (nome_fornecedor IS NOT NULL AND url_produto IS NOT NULL)
    );

ALTER TABLE public.produto_fornecedor_config
    ADD CONSTRAINT check_physical_supplier 
    CHECK (
        (fornecimento_externo_ativo = true AND tipo_fornecedor = 'loja_fisica') 
        IS FALSE OR 
        (nome_fornecedor IS NOT NULL AND cidade IS NOT NULL AND telefone IS NOT NULL)
    );

ALTER TABLE public.produto_fornecedor_config
    ADD CONSTRAINT check_active_type 
    CHECK (
        (fornecimento_externo_ativo = true) IS FALSE OR (tipo_fornecedor IS NOT NULL)
    );

-- Length constraints
ALTER TABLE public.produto_fornecedor_config
    ADD CONSTRAINT check_url_length CHECK (char_length(url_produto) <= 2048);

ALTER TABLE public.produto_fornecedor_config
    ADD CONSTRAINT check_obs_length CHECK (char_length(observacoes) <= 2000);

-- Enable RLS and strict security
ALTER TABLE public.produto_fornecedor_config ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.produto_fornecedor_config FROM public, anon, authenticated;
-- No public policies!

-- Trigger for updated_at
CREATE TRIGGER set_produto_fornecedor_config_updated_at
BEFORE UPDATE ON public.produto_fornecedor_config
FOR EACH ROW
EXECUTE FUNCTION public.set_updated_at();

-- RPC: Get config
CREATE OR REPLACE FUNCTION public.gsa_admin_get_product_supplier_config(
  p_sessao_id uuid,
  p_session_token text,
  p_produto_id uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_actor record;
  v_result jsonb;
BEGIN
  -- Validar sessao
  SELECT * INTO v_actor
  FROM public.gsa_admin_session_actor(p_sessao_id, p_session_token)
  LIMIT 1;

  IF v_actor.ator_tipo = 'colaborador' THEN
    IF NOT EXISTS (
      SELECT 1
      FROM public.colaborador_modulos cm
      WHERE cm.colaborador_id = v_actor.ator_id
        AND cm.modulo_id IN ('produtos', 'catálogo')
    ) THEN
      RAISE EXCEPTION 'Colaborador sem permissao para acessar produtos.';
    END IF;
  END IF;

  SELECT row_to_json(c)::jsonb INTO v_result
  FROM public.produto_fornecedor_config c
  WHERE c.produto_id = p_produto_id;

  RETURN v_result;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.gsa_admin_get_product_supplier_config(uuid, text, uuid) FROM public, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.gsa_admin_get_product_supplier_config(uuid, text, uuid) TO authenticated, service_role;

-- RPC: Upsert config
CREATE OR REPLACE FUNCTION public.gsa_admin_upsert_product_supplier_config(
  p_sessao_id uuid,
  p_session_token text,
  p_produto_id uuid,
  p_dados jsonb
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_actor record;
  v_fornecimento_externo_ativo boolean;
  v_tipo_fornecedor text;
  v_nome_fornecedor text;
  v_url_produto text;
  v_cidade text;
  v_estado text;
  v_endereco text;
  v_telefone text;
  v_observacoes text;
  v_result record;
BEGIN
  -- Validar sessao
  SELECT * INTO v_actor
  FROM public.gsa_admin_session_actor(p_sessao_id, p_session_token)
  LIMIT 1;

  IF v_actor.ator_tipo = 'colaborador' THEN
    IF NOT EXISTS (
      SELECT 1
      FROM public.colaborador_modulos cm
      WHERE cm.colaborador_id = v_actor.ator_id
        AND cm.modulo_id IN ('produtos', 'catálogo')
    ) THEN
      RAISE EXCEPTION 'Colaborador sem permissao para gerenciar produtos.';
    END IF;
  END IF;

  -- Extrair e normalizar dados
  v_fornecimento_externo_ativo := COALESCE((p_dados->>'fornecimento_externo_ativo')::boolean, false);
  v_tipo_fornecedor := NULLIF(trim(p_dados->>'tipo_fornecedor'), '');
  v_nome_fornecedor := NULLIF(trim(p_dados->>'nome_fornecedor'), '');
  v_url_produto := NULLIF(trim(p_dados->>'url_produto'), '');
  v_cidade := NULLIF(trim(p_dados->>'cidade'), '');
  v_estado := NULLIF(trim(p_dados->>'estado'), '');
  v_endereco := NULLIF(trim(p_dados->>'endereco'), '');
  v_telefone := NULLIF(trim(p_dados->>'telefone'), '');
  v_observacoes := NULLIF(trim(p_dados->>'observacoes'), '');

  -- Inserir ou atualizar
  INSERT INTO public.produto_fornecedor_config (
    produto_id,
    fornecimento_externo_ativo,
    tipo_fornecedor,
    nome_fornecedor,
    url_produto,
    cidade,
    estado,
    endereco,
    telefone,
    observacoes,
    atualizado_por_tipo,
    atualizado_por_id,
    atualizado_por_nome
  ) VALUES (
    p_produto_id,
    v_fornecimento_externo_ativo,
    v_tipo_fornecedor,
    v_nome_fornecedor,
    v_url_produto,
    v_cidade,
    v_estado,
    v_endereco,
    v_telefone,
    v_observacoes,
    v_actor.ator_tipo,
    v_actor.ator_id,
    v_actor.ator_nome
  )
  ON CONFLICT (produto_id) DO UPDATE SET
    fornecimento_externo_ativo = EXCLUDED.fornecimento_externo_ativo,
    tipo_fornecedor = EXCLUDED.tipo_fornecedor,
    nome_fornecedor = EXCLUDED.nome_fornecedor,
    url_produto = EXCLUDED.url_produto,
    cidade = EXCLUDED.cidade,
    estado = EXCLUDED.estado,
    endereco = EXCLUDED.endereco,
    telefone = EXCLUDED.telefone,
    observacoes = EXCLUDED.observacoes,
    atualizado_por_tipo = EXCLUDED.atualizado_por_tipo,
    atualizado_por_id = EXCLUDED.atualizado_por_id,
    atualizado_por_nome = EXCLUDED.atualizado_por_nome,
    updated_at = now();

  SELECT * INTO v_result
  FROM public.produto_fornecedor_config
  WHERE produto_id = p_produto_id;

  RETURN row_to_json(v_result)::jsonb;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.gsa_admin_upsert_product_supplier_config(uuid, text, uuid, jsonb) FROM public, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.gsa_admin_upsert_product_supplier_config(uuid, text, uuid, jsonb) TO authenticated, service_role;
