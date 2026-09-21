-- GSA TV — Migration 007: fila de jobs internos

BEGIN;

CREATE TABLE IF NOT EXISTS gsa_tv.jobs (
  id                  UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  job_type            TEXT        NOT NULL,
                                  -- 'media_download','media_validate','media_normalize',
                                  -- 'cache_warmup','cache_cleanup','playlist_compile',
                                  -- 'playlist_publish','rights_check','daily_report'
  channel_id          UUID        REFERENCES gsa_tv.channels(id) ON DELETE CASCADE,
  media_item_id       UUID        REFERENCES gsa_tv.media_items(id) ON DELETE CASCADE,
  payload             JSONB       NOT NULL DEFAULT '{}',
  state               TEXT        NOT NULL DEFAULT 'pending'
                                  CHECK (state IN ('pending','running','completed','failed','cancelled')),
  priority            INTEGER     NOT NULL DEFAULT 50,            -- menor = maior prioridade
  attempts            INTEGER     NOT NULL DEFAULT 0,
  max_attempts        INTEGER     NOT NULL DEFAULT 3,
  last_error          TEXT,
  result              JSONB,
  scheduled_for       TIMESTAMPTZ NOT NULL DEFAULT now(),
  started_at          TIMESTAMPTZ,
  completed_at        TIMESTAMPTZ,
  next_retry_at       TIMESTAMPTZ,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);

COMMENT ON TABLE gsa_tv.jobs IS 'Fila interna de jobs da GSA TV — idempotente, com retry automático';

CREATE INDEX IF NOT EXISTS jobs_pending_priority
  ON gsa_tv.jobs(priority ASC, scheduled_for ASC)
  WHERE state = 'pending';
CREATE INDEX IF NOT EXISTS jobs_media_item
  ON gsa_tv.jobs(media_item_id, job_type)
  WHERE media_item_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS jobs_state_type
  ON gsa_tv.jobs(state, job_type);

CREATE TRIGGER jobs_updated_at
  BEFORE UPDATE ON gsa_tv.jobs
  FOR EACH ROW EXECUTE FUNCTION gsa_tv.set_updated_at();

COMMIT;
