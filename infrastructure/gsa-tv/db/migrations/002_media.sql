-- GSA TV — Migration 002: itens de mídia e catálogo

BEGIN;

CREATE TABLE IF NOT EXISTS gsa_tv.media_items (
  id                  UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  channel_id          UUID        NOT NULL REFERENCES gsa_tv.channels(id) ON DELETE RESTRICT,
  drive_file_id       TEXT        UNIQUE,                         -- ID no Google Drive (null para itens locais)
  drive_path          TEXT,                                       -- caminho relativo na pasta GSA TV do Drive
  cache_path          TEXT,                                       -- caminho absoluto no cache local
  original_filename   TEXT        NOT NULL,
  title               TEXT,
  duration_s          NUMERIC(12,3),
  -- Metadados técnicos (preenchidos pelo preset-validate.sh via Media Worker)
  video_codec         TEXT,
  video_width         INTEGER,
  video_height        INTEGER,
  video_fps           NUMERIC(6,3),
  video_bitrate_kbps  INTEGER,
  audio_codec         TEXT,
  audio_sample_rate   INTEGER,
  audio_channels      INTEGER,
  audio_bitrate_kbps  INTEGER,
  -- Integridade
  drive_sha256        TEXT,                                       -- checksum declarado pelo Drive
  cache_sha256        TEXT,                                       -- checksum verificado no cache
  size_bytes          BIGINT,
  -- Controle de estado
  state               TEXT        NOT NULL DEFAULT 'pending'
                                  CHECK (state IN (
                                    'pending',        -- aguardando download
                                    'downloading',    -- rclone em andamento
                                    'validating',     -- ffprobe em execução
                                    'normalizing',    -- ffmpeg em execução
                                    'ready',          -- no cache, checksum ok, pode ir ao ar
                                    'on_air',         -- sendo reproduzido agora
                                    'expired',        -- fora da grade, pode ser removido do cache
                                    'error',          -- falha não recuperável
                                    'quarantine'      -- arquivo problemático, aguarda análise
                                  )),
  error_message       TEXT,
  -- Direitos (preenchido pelo Rights Watch do n8n)
  rights_ok           BOOLEAN     NOT NULL DEFAULT false,
  rights_checked_at   TIMESTAMPTZ,
  rights_expires_at   TIMESTAMPTZ,
  rights_notes        TEXT,
  -- Timestamps
  created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  cached_at           TIMESTAMPTZ,
  last_aired_at       TIMESTAMPTZ
);

COMMENT ON TABLE gsa_tv.media_items IS 'Catálogo de mídia da GSA TV — todo item precisa estar em estado ready antes de ir ao ar';

CREATE INDEX IF NOT EXISTS media_items_channel_state  ON gsa_tv.media_items(channel_id, state);
CREATE INDEX IF NOT EXISTS media_items_drive_file_id  ON gsa_tv.media_items(drive_file_id) WHERE drive_file_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS media_items_cache_path     ON gsa_tv.media_items(cache_path) WHERE cache_path IS NOT NULL;
CREATE INDEX IF NOT EXISTS media_items_state          ON gsa_tv.media_items(state);

CREATE TRIGGER media_items_updated_at
  BEFORE UPDATE ON gsa_tv.media_items
  FOR EACH ROW EXECUTE FUNCTION gsa_tv.set_updated_at();

COMMIT;
