BEGIN;

-- A migration de compatibilidade 20260720235425 podia criar somente versões
-- mínimas destas tabelas quando a migration base de Seguros estava ausente.
-- Esta preparação completa o esquema sem apagar dados existentes, permitindo
-- que a migration histórica 20260718121000 seja aplicada de forma segura.

CREATE TABLE IF NOT EXISTS public.seguros_parceiros (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nome text NOT NULL,
  documento text,
  registro_susep text,
  site text,
  contato text,
  comissao_tipo text NOT NULL DEFAULT 'porcentagem' CHECK (comissao_tipo IN ('porcentagem','valor')),
  comissao_valor numeric(12,2) NOT NULL DEFAULT 0,
  observacoes text,
  status text NOT NULL DEFAULT 'ativo' CHECK (status IN ('ativo','inativo')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.seguros_produtos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  parceiro_id uuid NOT NULL REFERENCES public.seguros_parceiros(id),
  nome text NOT NULL,
  slug text NOT NULL UNIQUE,
  categoria text NOT NULL CHECK (categoria IN ('auto','residencial','vida','empresarial','viagem','outros')),
  resumo text,
  imagem_url text,
  preco_referencia numeric(12,2),
  detalhes jsonb NOT NULL DEFAULT '{}'::jsonb,
  coberturas jsonb NOT NULL DEFAULT '[]'::jsonb,
  exclusoes jsonb NOT NULL DEFAULT '[]'::jsonb,
  elegibilidade jsonb NOT NULL DEFAULT '{}'::jsonb,
  destaque boolean NOT NULL DEFAULT false,
  status text NOT NULL DEFAULT 'rascunho' CHECK (status IN ('rascunho','publicado','pausado','arquivado')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.seguros_cotacoes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  cliente_id uuid,
  protocolo text,
  categoria text,
  status text NOT NULL DEFAULT 'recebida',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.seguros_cotacoes
  ADD COLUMN IF NOT EXISTS produto_id uuid,
  ADD COLUMN IF NOT EXISTS localidade text,
  ADD COLUMN IF NOT EXISTS inicio_desejado date,
  ADD COLUMN IF NOT EXISTS objeto_segurado text,
  ADD COLUMN IF NOT EXISTS valor_risco numeric(14,2),
  ADD COLUMN IF NOT EXISTS dados jsonb NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS consentimento_em timestamptz NOT NULL DEFAULT now(),
  ADD COLUMN IF NOT EXISTS idempotency_key uuid;

CREATE TABLE IF NOT EXISTS public.seguros_propostas (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  cotacao_id uuid,
  cliente_id uuid,
  parceiro_id uuid,
  produto_id uuid,
  protocolo text,
  titulo text,
  premio_seguradora numeric,
  franquia numeric,
  taxa_assessoria_gsa numeric NOT NULL DEFAULT 0,
  validade_ate timestamptz,
  status text NOT NULL DEFAULT 'rascunho',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.seguros_propostas
  ADD COLUMN IF NOT EXISTS cotacao_id uuid,
  ADD COLUMN IF NOT EXISTS cliente_id uuid,
  ADD COLUMN IF NOT EXISTS parceiro_id uuid,
  ADD COLUMN IF NOT EXISTS produto_id uuid,
  ADD COLUMN IF NOT EXISTS protocolo text,
  ADD COLUMN IF NOT EXISTS titulo text,
  ADD COLUMN IF NOT EXISTS premio_seguradora numeric(12,2),
  ADD COLUMN IF NOT EXISTS franquia numeric(12,2),
  ADD COLUMN IF NOT EXISTS taxa_assessoria_gsa numeric(12,2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS validade_ate timestamptz,
  ADD COLUMN IF NOT EXISTS coberturas jsonb NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS condicoes jsonb NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'rascunho',
  ADD COLUMN IF NOT EXISTS created_at timestamptz NOT NULL DEFAULT now(),
  ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now();

UPDATE public.seguros_cotacoes
   SET protocolo = 'SEG-LEGACY-' || upper(substr(replace(id::text, '-', ''), 1, 12))
 WHERE protocolo IS NULL OR btrim(protocolo) = '';

UPDATE public.seguros_propostas
   SET protocolo = 'SEG-PROP-LEGACY-' || upper(substr(replace(id::text, '-', ''), 1, 10))
 WHERE protocolo IS NULL OR btrim(protocolo) = '';

CREATE UNIQUE INDEX IF NOT EXISTS uq_seguros_cotacoes_protocolo
  ON public.seguros_cotacoes(protocolo);
CREATE UNIQUE INDEX IF NOT EXISTS uq_seguros_cotacoes_idempotencia
  ON public.seguros_cotacoes(cliente_id, idempotency_key)
  WHERE idempotency_key IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS uq_seguros_propostas_protocolo
  ON public.seguros_propostas(protocolo);
CREATE INDEX IF NOT EXISTS idx_seguros_produtos_publicacao
  ON public.seguros_produtos(status, categoria, destaque);

DO $constraints$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'seguros_cotacoes_cliente_id_fkey') THEN
    ALTER TABLE public.seguros_cotacoes
      ADD CONSTRAINT seguros_cotacoes_cliente_id_fkey
      FOREIGN KEY (cliente_id) REFERENCES public.clientes(id) ON DELETE CASCADE NOT VALID;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'seguros_cotacoes_produto_id_fkey') THEN
    ALTER TABLE public.seguros_cotacoes
      ADD CONSTRAINT seguros_cotacoes_produto_id_fkey
      FOREIGN KEY (produto_id) REFERENCES public.seguros_produtos(id) ON DELETE SET NULL NOT VALID;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'seguros_propostas_cotacao_id_fkey') THEN
    ALTER TABLE public.seguros_propostas
      ADD CONSTRAINT seguros_propostas_cotacao_id_fkey
      FOREIGN KEY (cotacao_id) REFERENCES public.seguros_cotacoes(id) ON DELETE CASCADE NOT VALID;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'seguros_propostas_cliente_id_fkey') THEN
    ALTER TABLE public.seguros_propostas
      ADD CONSTRAINT seguros_propostas_cliente_id_fkey
      FOREIGN KEY (cliente_id) REFERENCES public.clientes(id) ON DELETE CASCADE NOT VALID;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'seguros_propostas_parceiro_id_fkey') THEN
    ALTER TABLE public.seguros_propostas
      ADD CONSTRAINT seguros_propostas_parceiro_id_fkey
      FOREIGN KEY (parceiro_id) REFERENCES public.seguros_parceiros(id) NOT VALID;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'seguros_propostas_produto_id_fkey') THEN
    ALTER TABLE public.seguros_propostas
      ADD CONSTRAINT seguros_propostas_produto_id_fkey
      FOREIGN KEY (produto_id) REFERENCES public.seguros_produtos(id) NOT VALID;
  END IF;
END;
$constraints$;

COMMIT;
