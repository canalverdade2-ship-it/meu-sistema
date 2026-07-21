-- Estrutura-base real do módulo Classificados, necessária antes das RPCs operacionais.

BEGIN;

CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS public.classificados_anuncios (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  cliente_id uuid,
  categoria text,
  titulo text,
  descricao text,
  preco numeric(14,2),
  cidade text,
  estado text,
  bairro text,
  detalhes jsonb NOT NULL DEFAULT '{}'::jsonb,
  comissao_percentual numeric(5,2),
  status text NOT NULL DEFAULT 'aguardando_revisao',
  slug text,
  motivo_rejeicao text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.classificados_midias (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  anuncio_id uuid NOT NULL REFERENCES public.classificados_anuncios(id) ON DELETE CASCADE,
  url text NOT NULL,
  tipo text NOT NULL DEFAULT 'image',
  ordem integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.classificados_propostas (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  anuncio_id uuid REFERENCES public.classificados_anuncios(id) ON DELETE CASCADE,
  comprador_id uuid,
  vendedor_id uuid,
  valor_proposta numeric(14,2),
  status text NOT NULL DEFAULT 'em_analise_gsa',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.classificados_mensagens (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  proposta_id uuid REFERENCES public.classificados_propostas(id) ON DELETE CASCADE,
  remetente_id uuid,
  conteudo text,
  status_moderacao text NOT NULL DEFAULT 'pendente',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.classificados_transacoes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  anuncio_id uuid REFERENCES public.classificados_anuncios(id),
  comprador_id uuid,
  vendedor_id uuid,
  valor_final numeric(14,2),
  status text NOT NULL DEFAULT 'criada',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.classificados_comissoes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  transacao_id uuid REFERENCES public.classificados_transacoes(id) ON DELETE CASCADE,
  vendedor_id uuid,
  valor_comissao numeric(14,2),
  status text NOT NULL DEFAULT 'pendente',
  data_vencimento date,
  fatura_id uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_classificados_anuncios_cliente ON public.classificados_anuncios(cliente_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_classificados_anuncios_status ON public.classificados_anuncios(status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_classificados_midias_anuncio ON public.classificados_midias(anuncio_id, ordem ASC);

COMMIT;
