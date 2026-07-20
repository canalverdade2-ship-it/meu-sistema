BEGIN;

CREATE TABLE IF NOT EXISTS public.saude_cotacoes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  cliente_id uuid,
  protocolo text,
  categoria text,
  status text NOT NULL DEFAULT 'recebida',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.saude_propostas (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  cotacao_id uuid,
  cliente_id uuid,
  parceiro_id uuid,
  produto_id uuid,
  protocolo text,
  titulo text,
  mensalidade_operadora numeric,
  taxa_assessoria_gsa numeric NOT NULL DEFAULT 0,
  validade_ate timestamptz,
  status text NOT NULL DEFAULT 'rascunho',
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

COMMIT;
