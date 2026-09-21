BEGIN;

CREATE TABLE IF NOT EXISTS public.gsa_tv_channel_secrets (
  channel_id text PRIMARY KEY REFERENCES public.gsa_tv_channels(id) ON DELETE CASCADE,
  provider text NOT NULL DEFAULT 'youtube' CHECK (provider = 'youtube'),
  rtmp_server text NOT NULL DEFAULT 'rtmp://a.rtmp.youtube.com/live2'
    CHECK (char_length(rtmp_server) BETWEEN 10 AND 500),
  stream_key_ciphertext text
    CHECK (stream_key_ciphertext IS NULL OR char_length(stream_key_ciphertext) BETWEEN 20 AND 4000),
  encryption_version smallint NOT NULL DEFAULT 1,
  updated_by uuid,
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.gsa_tv_channel_secrets ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.gsa_tv_channel_secrets FROM PUBLIC, anon, authenticated;
GRANT ALL ON TABLE public.gsa_tv_channel_secrets TO service_role;
DROP POLICY IF EXISTS gsa_tv_channel_secrets_service_role_access ON public.gsa_tv_channel_secrets;
CREATE POLICY gsa_tv_channel_secrets_service_role_access
  ON public.gsa_tv_channel_secrets FOR ALL TO service_role
  USING (true) WITH CHECK (true);

COMMENT ON TABLE public.gsa_tv_channel_secrets IS 'Write-only encrypted transmission credentials for GSA TV.';
NOTIFY pgrst, 'reload schema';
COMMIT;
