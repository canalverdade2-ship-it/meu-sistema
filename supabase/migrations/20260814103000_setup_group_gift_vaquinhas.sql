-- Migration: 20260814103000_setup_group_gift_vaquinhas.sql
-- Sistema Completo de Vaquinha de Presente em Grupo (GSA Store)

-- 1. Tabela de Vaquinhas de Presente
CREATE TABLE IF NOT EXISTS public.loja_vaquinhas (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  codigo TEXT UNIQUE NOT NULL,
  produto_id UUID REFERENCES public.produtos(id) ON DELETE SET NULL,
  produto_snapshot JSONB NOT NULL DEFAULT '{}'::jsonb,
  organizador_nome TEXT NOT NULL,
  organizador_telefone TEXT NOT NULL,
  organizador_email TEXT,
  organizador_id UUID,
  presenteado_nome TEXT NOT NULL,
  data_evento DATE,
  mensagem TEXT,
  meta_valor NUMERIC(12, 2) NOT NULL,
  valor_arrecadado NUMERIC(12, 2) NOT NULL DEFAULT 0.00,
  quantidade_contribuicoes INTEGER NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'aberta' CHECK (status IN ('aberta', 'concluida', 'cancelada', 'expirada')),
  endereco_entrega JSONB,
  pedido_gerado_id UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 2. Tabela de Contribuições da Vaquinha
CREATE TABLE IF NOT EXISTS public.loja_vaquinha_contribuicoes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  vaquinha_id UUID NOT NULL REFERENCES public.loja_vaquinhas(id) ON DELETE CASCADE,
  contribuinte_nome TEXT NOT NULL,
  contribuinte_telefone TEXT,
  contribuinte_email TEXT,
  valor NUMERIC(12, 2) NOT NULL CHECK (valor > 0),
  mensagem TEXT,
  pix_copia_cola TEXT,
  pix_qr_code_url TEXT,
  status TEXT NOT NULL DEFAULT 'pendente' CHECK (status IN ('pendente', 'pago', 'cancelado')),
  transacao_id TEXT,
  pago_em TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Índices
CREATE INDEX IF NOT EXISTS idx_loja_vaquinhas_codigo ON public.loja_vaquinhas(codigo);
CREATE INDEX IF NOT EXISTS idx_loja_vaquinhas_status ON public.loja_vaquinhas(status);
CREATE INDEX IF NOT EXISTS idx_loja_vaquinha_contribuicoes_vaquinha ON public.loja_vaquinha_contribuicoes(vaquinha_id);
CREATE INDEX IF NOT EXISTS idx_loja_vaquinha_contribuicoes_status ON public.loja_vaquinha_contribuicoes(status);

-- RLS
ALTER TABLE public.loja_vaquinhas ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.loja_vaquinha_contribuicoes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Public can view vaquinhas" ON public.loja_vaquinhas;
CREATE POLICY "Public can view vaquinhas" ON public.loja_vaquinhas FOR SELECT USING (true);

DROP POLICY IF EXISTS "Public can insert vaquinhas" ON public.loja_vaquinhas;
CREATE POLICY "Public can insert vaquinhas" ON public.loja_vaquinhas FOR INSERT WITH CHECK (true);

DROP POLICY IF EXISTS "Public can update vaquinhas" ON public.loja_vaquinhas;
CREATE POLICY "Public can update vaquinhas" ON public.loja_vaquinhas FOR UPDATE USING (true);

DROP POLICY IF EXISTS "Public can view contribuicoes" ON public.loja_vaquinha_contribuicoes;
CREATE POLICY "Public can view contribuicoes" ON public.loja_vaquinha_contribuicoes FOR SELECT USING (true);

DROP POLICY IF EXISTS "Public can insert contribuicoes" ON public.loja_vaquinha_contribuicoes;
CREATE POLICY "Public can insert contribuicoes" ON public.loja_vaquinha_contribuicoes FOR INSERT WITH CHECK (true);

DROP POLICY IF EXISTS "Public can update contribuicoes" ON public.loja_vaquinha_contribuicoes;
CREATE POLICY "Public can update contribuicoes" ON public.loja_vaquinha_contribuicoes FOR UPDATE USING (true);

-- 3. Stored Procedure: Criar Vaquinha
CREATE OR REPLACE FUNCTION public.gsa_criar_vaquinha(p_dados JSONB)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO public, pg_temp
AS $$
DECLARE
  v_codigo TEXT;
  v_vaquinha RECORD;
  v_meta NUMERIC;
BEGIN
  v_codigo := 'VAQ-' || UPPER(SUBSTRING(MD5(RANDOM()::TEXT || CLOCK_TIMESTAMP()::TEXT) FROM 1 FOR 6));
  
  v_meta := COALESCE((p_dados->>'meta_valor')::NUMERIC, 0.00);
  IF v_meta <= 0 THEN
    RAISE EXCEPTION 'O valor da meta da vaquinha deve ser maior que zero.';
  END IF;

  INSERT INTO public.loja_vaquinhas (
    codigo,
    produto_id,
    produto_snapshot,
    organizador_nome,
    organizador_telefone,
    organizador_email,
    organizador_id,
    presenteado_nome,
    data_evento,
    mensagem,
    meta_valor,
    endereco_entrega
  ) VALUES (
    v_codigo,
    (p_dados->>'produto_id')::UUID,
    COALESCE(p_dados->'produto_snapshot', '{}'::jsonb),
    COALESCE(p_dados->>'organizador_nome', 'Organizador'),
    COALESCE(p_dados->>'organizador_telefone', ''),
    p_dados->>'organizador_email',
    (p_dados->>'organizador_id')::UUID,
    COALESCE(p_dados->>'presenteado_nome', 'Amigo(a)'),
    (p_dados->>'data_evento')::DATE,
    p_dados->>'mensagem',
    v_meta,
    p_dados->'endereco_entrega'
  )
  RETURNING * INTO v_vaquinha;

  RETURN jsonb_build_object(
    'success', true,
    'vaquinha', row_to_json(v_vaquinha)
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.gsa_criar_vaquinha(JSONB) TO anon, authenticated, service_role;

-- 4. Stored Procedure: Obter Vaquinha com Contribuições
CREATE OR REPLACE FUNCTION public.gsa_obter_vaquinha(p_codigo_ou_id TEXT)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO public, pg_temp
AS $$
DECLARE
  v_vaquinha RECORD;
  v_contribuicoes JSONB;
  v_percentual NUMERIC;
  v_restante NUMERIC;
BEGIN
  IF p_codigo_ou_id ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' THEN
    SELECT * INTO v_vaquinha FROM public.loja_vaquinhas WHERE id = p_codigo_ou_id::UUID;
  ELSE
    SELECT * INTO v_vaquinha FROM public.loja_vaquinhas WHERE LOWER(codigo) = LOWER(p_codigo_ou_id);
  END IF;

  IF v_vaquinha.id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Vaquinha não encontrada.');
  END IF;

  SELECT COALESCE(jsonb_agg(
    jsonb_build_object(
      'id', c.id,
      'contribuinte_nome', c.contribuinte_nome,
      'valor', c.valor,
      'mensagem', c.mensagem,
      'pago_em', c.pago_em,
      'created_at', c.created_at
    ) ORDER BY c.created_at DESC
  ), '[]'::jsonb)
  INTO v_contribuicoes
  FROM public.loja_vaquinha_contribuicoes c
  WHERE c.vaquinha_id = v_vaquinha.id AND c.status = 'pago';

  v_percentual := LEAST(100.00, ROUND((v_vaquinha.valor_arrecadado / GREATEST(v_vaquinha.meta_valor, 0.01)) * 100, 1));
  v_restante := GREATEST(0.00, v_vaquinha.meta_valor - v_vaquinha.valor_arrecadado);

  RETURN jsonb_build_object(
    'success', true,
    'vaquinha', row_to_json(v_vaquinha),
    'contribuicoes', v_contribuicoes,
    'percentual', v_percentual,
    'valor_restante', v_restante,
    'meta_atingida', v_vaquinha.valor_arrecadado >= v_vaquinha.meta_valor
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.gsa_obter_vaquinha(TEXT) TO anon, authenticated, service_role;

-- 5. Stored Procedure: Confirmar Contribuição
CREATE OR REPLACE FUNCTION public.gsa_confirmar_contribuicao_vaquinha(
  p_contribuicao_id UUID,
  p_transacao_id TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO public, pg_temp
AS $$
DECLARE
  v_contrib RECORD;
  v_vaquinha RECORD;
  v_novo_arrecadado NUMERIC;
  v_nova_qtd INTEGER;
  v_novo_status TEXT;
BEGIN
  SELECT * INTO v_contrib FROM public.loja_vaquinha_contribuicoes WHERE id = p_contribuicao_id;
  IF v_contrib.id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Contribuição não encontrada.');
  END IF;

  IF v_contrib.status = 'pago' THEN
    RETURN jsonb_build_object('success', true, 'message', 'Contribuição já confirmada anteriormente.');
  END IF;

  UPDATE public.loja_vaquinha_contribuicoes
  SET status = 'pago',
      pago_em = now(),
      transacao_id = COALESCE(p_transacao_id, transacao_id, 'PIX-' || SUBSTRING(MD5(RANDOM()::TEXT) FROM 1 FOR 10))
  WHERE id = p_contribuicao_id;

  SELECT 
    COALESCE(SUM(valor), 0.00),
    COUNT(*)
  INTO v_novo_arrecadado, v_nova_qtd
  FROM public.loja_vaquinha_contribuicoes
  WHERE vaquinha_id = v_contrib.vaquinha_id AND status = 'pago';

  SELECT * INTO v_vaquinha FROM public.loja_vaquinhas WHERE id = v_contrib.vaquinha_id;
  v_novo_status := CASE WHEN v_novo_arrecadado >= v_vaquinha.meta_valor THEN 'concluida' ELSE 'aberta' END;

  UPDATE public.loja_vaquinhas
  SET valor_arrecadado = v_novo_arrecadado,
      quantidade_contribuicoes = v_nova_qtd,
      status = v_novo_status,
      updated_at = now()
  WHERE id = v_contrib.vaquinha_id;

  RETURN jsonb_build_object(
    'success', true,
    'valor_arrecadado', v_novo_arrecadado,
    'quantidade_contribuicoes', v_nova_qtd,
    'status', v_novo_status,
    'meta_atingida', v_novo_arrecadado >= v_vaquinha.meta_valor
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.gsa_confirmar_contribuicao_vaquinha(UUID, TEXT) TO anon, authenticated, service_role;
