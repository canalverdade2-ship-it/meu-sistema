BEGIN;
CREATE TABLE IF NOT EXISTS public.gsa_tv_ai_provider_secrets(
  channel_id text NOT NULL REFERENCES public.gsa_tv_channels(id) ON DELETE CASCADE,
  provider text NOT NULL CHECK(provider IN('openai')),
  api_key_ciphertext text NOT NULL,
  default_model text NOT NULL DEFAULT 'gpt-5.4-mini',
  configured_by text,
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY(channel_id,provider)
);
ALTER TABLE public.gsa_tv_ai_provider_secrets ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.gsa_tv_ai_provider_secrets FROM PUBLIC,anon,authenticated;
GRANT ALL ON public.gsa_tv_ai_provider_secrets TO service_role;
DROP POLICY IF EXISTS gsa_tv_ai_provider_secrets_service_only ON public.gsa_tv_ai_provider_secrets;
CREATE POLICY gsa_tv_ai_provider_secrets_service_only ON public.gsa_tv_ai_provider_secrets FOR ALL TO service_role USING(true) WITH CHECK(true);
NOTIFY pgrst,'reload schema';
COMMIT;
