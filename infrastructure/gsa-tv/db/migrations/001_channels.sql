-- GSA TV — Migration 001: canal de transmissão
-- Criação do schema isolado e tabela de canais.

BEGIN;

CREATE SCHEMA IF NOT EXISTS gsa_tv;

COMMENT ON SCHEMA gsa_tv IS 'Schema exclusivo da pilha GSA TV — não misturar com outros projetos';

CREATE TABLE IF NOT EXISTS gsa_tv.channels (
  id                  UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  slug                TEXT        NOT NULL UNIQUE CHECK (slug ~ '^[a-z0-9-]+$'),
  name                TEXT        NOT NULL,
  description         TEXT,
  state               TEXT        NOT NULL DEFAULT 'inactive'
                                  CHECK (state IN ('inactive','active','maintenance','error')),
  config              JSONB       NOT NULL DEFAULT '{}',
  -- config esperado: output_resolution, fps, video_bitrate_kbps, audio_bitrate_kbps,
  --                  keyframe_interval_s, timezone, hls_enabled, rtmps_enabled
  created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);

COMMENT ON TABLE gsa_tv.channels IS 'Canais de transmissão da GSA TV';

CREATE OR REPLACE FUNCTION gsa_tv.set_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

CREATE TRIGGER channels_updated_at
  BEFORE UPDATE ON gsa_tv.channels
  FOR EACH ROW EXECUTE FUNCTION gsa_tv.set_updated_at();

-- Canal padrão técnico (slug fixo, sem nome editorial ainda)
INSERT INTO gsa_tv.channels (slug, name, state, config)
VALUES (
  'gsa-tv-main',
  'GSA TV — Canal Principal',
  'inactive',
  '{
    "output_resolution": "1280x720",
    "fps": 30,
    "video_bitrate_kbps": 4000,
    "audio_bitrate_kbps": 128,
    "keyframe_interval_s": 2,
    "timezone": "America/Sao_Paulo",
    "hls_enabled": true,
    "rtmps_enabled": false
  }'
)
ON CONFLICT (slug) DO NOTHING;

COMMIT;
