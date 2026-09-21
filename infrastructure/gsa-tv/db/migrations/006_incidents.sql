-- GSA TV — Migration 006: incidentes e eventos de contingência

BEGIN;

CREATE TABLE IF NOT EXISTS gsa_tv.incidents (
  id                  UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  channel_id          UUID        REFERENCES gsa_tv.channels(id) ON DELETE SET NULL,
  severity            TEXT        NOT NULL DEFAULT 'warning'
                                  CHECK (severity IN ('info','warning','error','critical')),
  component           TEXT        NOT NULL,
                                  -- 'ffplayout','ffmpeg','cache-manager','media-worker',
                                  -- 'playout-api','n8n','google-drive','youtube-rtmps',
                                  -- 'database','nginx','vps'
  incident_type       TEXT        NOT NULL,
                                  -- 'process_stopped','heartbeat_missing','cache_incomplete',
                                  -- 'missing_file','corrupted_file','drive_unavailable',
                                  -- 'rtmps_disconnected','disk_alert','cpu_alert','dropped_frames',
                                  -- 'rights_violation','auth_failure','reboot'
  title               TEXT        NOT NULL,
  description         TEXT,
  -- Estado
  state               TEXT        NOT NULL DEFAULT 'open'
                                  CHECK (state IN ('open','acknowledged','resolved','false_positive')),
  -- Resolução
  action_taken        TEXT,
  resolved_at         TIMESTAMPTZ,
  resolved_by         TEXT,
  auto_recovered      BOOLEAN     NOT NULL DEFAULT false,
  -- Contexto técnico
  context             JSONB       NOT NULL DEFAULT '{}',          -- métricas, logs, hashes relevantes
  -- Timestamps
  occurred_at         TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);

COMMENT ON TABLE gsa_tv.incidents IS 'Incidentes técnicos auditáveis — nunca deletar, somente resolver';

CREATE INDEX IF NOT EXISTS incidents_state_severity ON gsa_tv.incidents(state, severity);
CREATE INDEX IF NOT EXISTS incidents_channel_time   ON gsa_tv.incidents(channel_id, occurred_at DESC);
CREATE INDEX IF NOT EXISTS incidents_component      ON gsa_tv.incidents(component, occurred_at DESC);

CREATE TRIGGER incidents_updated_at
  BEFORE UPDATE ON gsa_tv.incidents
  FOR EACH ROW EXECUTE FUNCTION gsa_tv.set_updated_at();

COMMIT;
