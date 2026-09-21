-- GSA TV — Migration 005: log de execução de playout

BEGIN;

CREATE TABLE IF NOT EXISTS gsa_tv.execution_log (
  id                  UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  channel_id          UUID        NOT NULL REFERENCES gsa_tv.channels(id) ON DELETE RESTRICT,
  playlist_id         UUID        REFERENCES gsa_tv.playlists(id) ON DELETE SET NULL,
  media_item_id       UUID        REFERENCES gsa_tv.media_items(id) ON DELETE SET NULL,
  schedule_slot_id    UUID        REFERENCES gsa_tv.schedule_slots(id) ON DELETE SET NULL,
  -- Tempos reais (podem diferir do agendado)
  started_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  ended_at            TIMESTAMPTZ,
  duration_s          NUMERIC(12,3),
  -- Métricas técnicas do FFmpeg/ffplayout
  dropped_frames      INTEGER     NOT NULL DEFAULT 0,
  duplicate_frames    INTEGER     NOT NULL DEFAULT 0,
  avg_bitrate_kbps    INTEGER,
  avg_fps             NUMERIC(6,3),
  -- Resultado
  outcome             TEXT        NOT NULL DEFAULT 'in_progress'
                                  CHECK (outcome IN ('in_progress','completed','interrupted','skipped','fallback_triggered')),
  fallback_reason     TEXT,
  notes               TEXT,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);

COMMENT ON TABLE gsa_tv.execution_log IS 'Registro de tudo que foi ao ar — base para o relatório técnico diário';

CREATE INDEX IF NOT EXISTS execution_log_channel_time ON gsa_tv.execution_log(channel_id, started_at DESC);
CREATE INDEX IF NOT EXISTS execution_log_outcome      ON gsa_tv.execution_log(outcome) WHERE outcome != 'completed';

COMMIT;
