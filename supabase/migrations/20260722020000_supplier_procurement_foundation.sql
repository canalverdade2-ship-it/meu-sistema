-- Modulo de Fornecedores e abastecimento da GSA Produtos.
-- Estruturas independentes das ordens_compra, que representam vendas a clientes.

BEGIN;

CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS public.fornecedores (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  codigo text NOT NULL UNIQUE DEFAULT ('FOR-' || upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 10))),
  tipo_pessoa text NOT NULL CHECK (tipo_pessoa IN ('pf', 'pj')),
  documento text NOT NULL,
  razao_social text NOT NULL,
  nome_fantasia text,
  inscricao_estadual text,
  responsavel_nome text NOT NULL,
  email text NOT NULL,
  telefone text NOT NULL,
  cep text,
  endereco text,
  numero text,
  complemento text,
  bairro text,
  cidade text,
  estado text,
  dados_bancarios jsonb NOT NULL DEFAULT '{}'::jsonb,
  observacoes text,
  status text NOT NULL DEFAULT 'pendente' CHECK (status IN ('pendente', 'em_analise', 'ajuste_solicitado', 'ativo', 'suspenso', 'reprovado')),
  pin_hash text,
  pin_tentativas integer NOT NULL DEFAULT 0 CHECK (pin_tentativas >= 0),
  pin_bloqueado boolean NOT NULL DEFAULT false,
  aprovado_em timestamptz,
  aprovado_por uuid,
  motivo_status text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT fornecedores_documento_formato CHECK (documento ~ '^\d{11}$' OR documento ~ '^\d{14}$'),
  CONSTRAINT fornecedores_email_formato CHECK (position('@' in email) > 1),
  CONSTRAINT fornecedores_documento_unique UNIQUE (documento)
);

CREATE TABLE IF NOT EXISTS public.fornecedor_produtos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  fornecedor_id uuid NOT NULL REFERENCES public.fornecedores(id) ON DELETE CASCADE,
  produto_id uuid NOT NULL REFERENCES public.produtos(id) ON DELETE RESTRICT,
  codigo_fornecedor text,
  custo_unitario numeric(14,2) NOT NULL DEFAULT 0 CHECK (custo_unitario >= 0),
  quantidade_minima integer NOT NULL DEFAULT 1 CHECK (quantidade_minima > 0),
  prazo_entrega_dias integer NOT NULL DEFAULT 0 CHECK (prazo_entrega_dias >= 0),
  status text NOT NULL DEFAULT 'ativo' CHECK (status IN ('ativo', 'inativo')),
  aprovado_em timestamptz NOT NULL DEFAULT now(),
  aprovado_por uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (fornecedor_id, produto_id)
);

CREATE TABLE IF NOT EXISTS public.fornecedor_produto_solicitacoes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  fornecedor_id uuid NOT NULL REFERENCES public.fornecedores(id) ON DELETE CASCADE,
  produto_id uuid REFERENCES public.produtos(id) ON DELETE RESTRICT,
  tipo text NOT NULL CHECK (tipo IN ('existente', 'novo')),
  nome text,
  descricao text,
  categoria_id uuid REFERENCES public.loja_categorias(id) ON DELETE SET NULL,
  codigo_barras text,
  imagem_url text,
  custo_unitario numeric(14,2) NOT NULL CHECK (custo_unitario >= 0),
  quantidade_minima integer NOT NULL DEFAULT 1 CHECK (quantidade_minima > 0),
  prazo_entrega_dias integer NOT NULL DEFAULT 0 CHECK (prazo_entrega_dias >= 0),
  observacoes text,
  status text NOT NULL DEFAULT 'pendente' CHECK (status IN ('pendente', 'em_analise', 'ajuste_solicitado', 'aprovado', 'reprovado')),
  motivo_analise text,
  produto_aprovado_id uuid REFERENCES public.produtos(id) ON DELETE SET NULL,
  analisado_em timestamptz,
  analisado_por uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT fornecedor_produto_solicitacao_dados CHECK (
    (tipo = 'existente' AND produto_id IS NOT NULL)
    OR (tipo = 'novo' AND produto_id IS NULL AND length(trim(coalesce(nome, ''))) >= 3)
  )
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_fornecedor_produto_solicitacao_existente_aberta
  ON public.fornecedor_produto_solicitacoes(fornecedor_id, produto_id)
  WHERE tipo = 'existente' AND status IN ('pendente', 'em_analise', 'ajuste_solicitado');

CREATE TABLE IF NOT EXISTS public.pedidos_compra_fornecedor (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  codigo text NOT NULL UNIQUE DEFAULT ('PCF-' || upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 10))),
  fornecedor_id uuid NOT NULL REFERENCES public.fornecedores(id) ON DELETE RESTRICT,
  status text NOT NULL DEFAULT 'enviado' CHECK (status IN ('rascunho', 'enviado', 'visualizado', 'em_preparacao', 'parcial', 'entregue', 'em_analise', 'concluido', 'cancelado')),
  previsao_entrega date,
  condicao_pagamento text,
  vencimento_previsto date,
  observacoes text,
  valor_total_previsto numeric(14,2) NOT NULL DEFAULT 0 CHECK (valor_total_previsto >= 0),
  criado_por_tipo text NOT NULL CHECK (criado_por_tipo IN ('admin', 'colaborador')),
  criado_por_id uuid,
  criado_por_nome text,
  enviado_em timestamptz,
  visualizado_em timestamptz,
  concluido_em timestamptz,
  cancelado_em timestamptz,
  motivo_cancelamento text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.pedido_compra_fornecedor_itens (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  pedido_id uuid NOT NULL REFERENCES public.pedidos_compra_fornecedor(id) ON DELETE CASCADE,
  fornecedor_produto_id uuid NOT NULL REFERENCES public.fornecedor_produtos(id) ON DELETE RESTRICT,
  produto_id uuid NOT NULL REFERENCES public.produtos(id) ON DELETE RESTRICT,
  produto_nome_snapshot text NOT NULL,
  codigo_produto_snapshot text,
  quantidade_pedida integer NOT NULL CHECK (quantidade_pedida > 0),
  quantidade_aprovada integer NOT NULL DEFAULT 0 CHECK (quantidade_aprovada >= 0),
  custo_unitario numeric(14,2) NOT NULL CHECK (custo_unitario >= 0),
  valor_total numeric(14,2) GENERATED ALWAYS AS (quantidade_pedida * custo_unitario) STORED,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (pedido_id, produto_id),
  CONSTRAINT pedido_item_quantidade_aprovada_limite CHECK (quantidade_aprovada <= quantidade_pedida)
);

CREATE TABLE IF NOT EXISTS public.fornecedor_entregas (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  codigo text NOT NULL UNIQUE DEFAULT ('ENT-' || upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 10))),
  pedido_id uuid NOT NULL REFERENCES public.pedidos_compra_fornecedor(id) ON DELETE RESTRICT,
  fornecedor_id uuid NOT NULL REFERENCES public.fornecedores(id) ON DELETE RESTRICT,
  status text NOT NULL DEFAULT 'em_analise' CHECK (status IN ('em_analise', 'ajuste_solicitado', 'aprovado', 'reprovado', 'cancelado')),
  numero_nota text NOT NULL,
  serie_nota text,
  chave_nfe text,
  data_emissao date NOT NULL,
  valor_total_nota numeric(14,2) NOT NULL CHECK (valor_total_nota >= 0),
  vencimento date,
  arquivo_xml text,
  arquivo_pdf text,
  observacoes text,
  motivo_analise text,
  analisado_em timestamptz,
  analisado_por_tipo text,
  analisado_por_id uuid,
  analisado_por_nome text,
  request_id uuid NOT NULL UNIQUE,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT fornecedor_entrega_documento CHECK (arquivo_xml IS NOT NULL OR arquivo_pdf IS NOT NULL),
  CONSTRAINT fornecedor_entrega_chave_nfe CHECK (chave_nfe IS NULL OR chave_nfe ~ '^\d{44}$')
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_fornecedor_entrega_chave_nfe
  ON public.fornecedor_entregas(chave_nfe) WHERE chave_nfe IS NOT NULL;

CREATE TABLE IF NOT EXISTS public.fornecedor_entrega_itens (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  entrega_id uuid NOT NULL REFERENCES public.fornecedor_entregas(id) ON DELETE CASCADE,
  pedido_item_id uuid NOT NULL REFERENCES public.pedido_compra_fornecedor_itens(id) ON DELETE RESTRICT,
  produto_id uuid NOT NULL REFERENCES public.produtos(id) ON DELETE RESTRICT,
  quantidade_entregue integer NOT NULL CHECK (quantidade_entregue > 0),
  custo_unitario_nota numeric(14,2) NOT NULL CHECK (custo_unitario_nota >= 0),
  lote text,
  validade date,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (entrega_id, pedido_item_id)
);

CREATE TABLE IF NOT EXISTS public.contas_pagar (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  codigo text NOT NULL UNIQUE DEFAULT ('CP-' || upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 10))),
  fornecedor_id uuid NOT NULL REFERENCES public.fornecedores(id) ON DELETE RESTRICT,
  pedido_id uuid NOT NULL REFERENCES public.pedidos_compra_fornecedor(id) ON DELETE RESTRICT,
  entrega_id uuid NOT NULL UNIQUE REFERENCES public.fornecedor_entregas(id) ON DELETE RESTRICT,
  numero_documento text NOT NULL,
  descricao text NOT NULL,
  valor_original numeric(14,2) NOT NULL CHECK (valor_original >= 0),
  valor_pendente numeric(14,2) NOT NULL CHECK (valor_pendente >= 0),
  data_emissao date NOT NULL,
  data_vencimento date NOT NULL,
  status text NOT NULL DEFAULT 'pendente' CHECK (status IN ('pendente', 'agendado', 'pago', 'vencido', 'cancelado')),
  data_pagamento timestamptz,
  forma_pagamento text,
  comprovante text,
  observacoes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.fornecedor_auditoria (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  fornecedor_id uuid REFERENCES public.fornecedores(id) ON DELETE SET NULL,
  ator_tipo text NOT NULL,
  ator_id uuid,
  ator_nome text,
  acao text NOT NULL,
  entidade text NOT NULL,
  entidade_id uuid,
  detalhes jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.fornecedor_notificacoes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  fornecedor_id uuid NOT NULL REFERENCES public.fornecedores(id) ON DELETE CASCADE,
  titulo text NOT NULL,
  mensagem text NOT NULL,
  modulo text NOT NULL DEFAULT 'dashboard',
  item_id uuid,
  lida boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_fornecedor_produtos_fornecedor_status ON public.fornecedor_produtos(fornecedor_id, status);
CREATE INDEX IF NOT EXISTS idx_fornecedor_solicitacoes_status ON public.fornecedor_produto_solicitacoes(status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_pedidos_fornecedor_status ON public.pedidos_compra_fornecedor(fornecedor_id, status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_entregas_fornecedor_status ON public.fornecedor_entregas(fornecedor_id, status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_contas_pagar_status_vencimento ON public.contas_pagar(status, data_vencimento);
CREATE INDEX IF NOT EXISTS idx_fornecedor_notificacoes ON public.fornecedor_notificacoes(fornecedor_id, lida, created_at DESC);

DO $$
DECLARE
  v_table text;
BEGIN
  FOREACH v_table IN ARRAY ARRAY[
    'fornecedores', 'fornecedor_produtos', 'fornecedor_produto_solicitacoes',
    'pedidos_compra_fornecedor', 'pedido_compra_fornecedor_itens',
    'fornecedor_entregas', 'fornecedor_entrega_itens', 'contas_pagar',
    'fornecedor_auditoria', 'fornecedor_notificacoes'
  ] LOOP
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', v_table);
    EXECUTE format('REVOKE ALL ON TABLE public.%I FROM PUBLIC, anon, authenticated', v_table);
  END LOOP;
END;
$$;

-- Rastreabilidade da origem de cada entrada no historico existente.
ALTER TABLE public.loja_estoque_historico
  ADD COLUMN IF NOT EXISTS fornecedor_id uuid REFERENCES public.fornecedores(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS pedido_fornecedor_id uuid REFERENCES public.pedidos_compra_fornecedor(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS entrega_fornecedor_id uuid REFERENCES public.fornecedor_entregas(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS tipo_movimento text;

DO $$
BEGIN
  IF to_regclass('public.produto_fornecedor_config') IS NOT NULL THEN
    ALTER TABLE public.produto_fornecedor_config
      ADD COLUMN IF NOT EXISTS fornecedor_id uuid REFERENCES public.fornecedores(id) ON DELETE SET NULL;
  END IF;
END;
$$;

-- Bucket privado exclusivo para documentos enviados pelo fornecedor.
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'documentos_fornecedor', 'documentos_fornecedor', false, 10485760,
  ARRAY['application/pdf', 'application/xml', 'text/xml']
)
ON CONFLICT (id) DO UPDATE
SET public = false,
    file_size_limit = EXCLUDED.file_size_limit,
    allowed_mime_types = EXCLUDED.allowed_mime_types;

-- Triggers padronizados de updated_at.
DO $$
DECLARE
  v_table text;
  v_trigger text;
BEGIN
  FOREACH v_table IN ARRAY ARRAY[
    'fornecedores', 'fornecedor_produtos', 'fornecedor_produto_solicitacoes',
    'pedidos_compra_fornecedor', 'fornecedor_entregas', 'contas_pagar'
  ] LOOP
    v_trigger := 'set_' || v_table || '_updated_at';
    EXECUTE format('DROP TRIGGER IF EXISTS %I ON public.%I', v_trigger, v_table);
    EXECUTE format('CREATE TRIGGER %I BEFORE UPDATE ON public.%I FOR EACH ROW EXECUTE FUNCTION public.set_updated_at()', v_trigger, v_table);
  END LOOP;
END;
$$;

COMMIT;
