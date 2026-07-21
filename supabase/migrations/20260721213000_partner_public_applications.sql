BEGIN;

ALTER TABLE public.parceiros
  ADD COLUMN IF NOT EXISTS tax_document text,
  ADD COLUMN IF NOT EXISTS application_source text NOT NULL DEFAULT 'admin',
  ADD COLUMN IF NOT EXISTS application_protocol text,
  ADD COLUMN IF NOT EXISTS submitted_at timestamptz,
  ADD COLUMN IF NOT EXISTS privacy_consent_at timestamptz;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
      FROM pg_constraint
     WHERE conrelid = 'public.parceiros'::regclass
       AND conname = 'parceiros_application_source_check'
  ) THEN
    ALTER TABLE public.parceiros
      ADD CONSTRAINT parceiros_application_source_check
      CHECK (application_source IN ('admin', 'public_form'));
  END IF;
END;
$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
      FROM pg_constraint
     WHERE conrelid = 'public.parceiros'::regclass
       AND conname = 'parceiros_tax_document_format_check'
  ) THEN
    ALTER TABLE public.parceiros
      ADD CONSTRAINT parceiros_tax_document_format_check
      CHECK (tax_document IS NULL OR tax_document ~ '^[0-9]{11}$|^[0-9]{14}$');
  END IF;
END;
$$;

CREATE UNIQUE INDEX IF NOT EXISTS parceiros_application_protocol_uidx
  ON public.parceiros (application_protocol)
  WHERE application_protocol IS NOT NULL;

CREATE INDEX IF NOT EXISTS parceiros_public_applications_idx
  ON public.parceiros (status, submitted_at DESC)
  WHERE application_source = 'public_form';

INSERT INTO storage.buckets (
  id,
  name,
  public,
  file_size_limit,
  allowed_mime_types
) VALUES (
  'parceiros-midias',
  'parceiros-midias',
  true,
  5242880,
  ARRAY['image/jpeg', 'image/png', 'image/webp']::text[]
)
ON CONFLICT (id) DO UPDATE
SET public = EXCLUDED.public,
    file_size_limit = EXCLUDED.file_size_limit,
    allowed_mime_types = EXCLUDED.allowed_mime_types;

COMMENT ON COLUMN public.parceiros.tax_document IS
  'CPF ou CNPJ informado na solicitação, disponível apenas no painel administrativo.';
COMMENT ON COLUMN public.parceiros.application_source IS
  'Origem do cadastro: criação administrativa ou formulário público.';
COMMENT ON COLUMN public.parceiros.application_protocol IS
  'Protocolo apresentado ao solicitante após o envio do formulário público.';
COMMENT ON COLUMN public.parceiros.submitted_at IS
  'Data e hora em que a solicitação pública foi recebida.';
COMMENT ON COLUMN public.parceiros.privacy_consent_at IS
  'Data e hora do consentimento para tratamento dos dados da solicitação.';

COMMIT;
