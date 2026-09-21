BEGIN;

ALTER TABLE public.gsa_tv_ai_provider_secrets
  DROP CONSTRAINT IF EXISTS gsa_tv_ai_provider_secrets_provider_check;
ALTER TABLE public.gsa_tv_ai_provider_secrets
  ADD CONSTRAINT gsa_tv_ai_provider_secrets_provider_check
  CHECK (provider IN ('openai','gemini'));

ALTER TABLE public.gsa_tv_ai_usage
  DROP CONSTRAINT IF EXISTS gsa_tv_ai_usage_provider_check;

NOTIFY pgrst,'reload schema';
COMMIT;
