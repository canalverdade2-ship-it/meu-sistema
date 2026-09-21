-- GSA TV — Migration 008: trilha de auditoria imutável

BEGIN;

CREATE TABLE IF NOT EXISTS gsa_tv.audit_log (
  id                  BIGSERIAL   PRIMARY KEY,
  occurred_at         TIMESTAMPTZ NOT NULL DEFAULT now(),
  actor               TEXT        NOT NULL,                       -- 'system', user_id ou IP de origem
  actor_role          TEXT,                                       -- papel do usuário no momento da ação
  action              TEXT        NOT NULL,
                                  -- 'create','update','delete','publish','rollback',
                                  -- 'play_command','skip_command','fallback_command',
                                  -- 'login','logout','credential_access'
  resource_type       TEXT        NOT NULL,
  resource_id         TEXT,
  channel_id          UUID        REFERENCES gsa_tv.channels(id) ON DELETE SET NULL,
  payload_before      JSONB,
  payload_after       JSONB,
  ip_address          INET,
  user_agent          TEXT,
  request_id          TEXT,
  notes               TEXT
);

COMMENT ON TABLE gsa_tv.audit_log IS 'Trilha de auditoria imutável — sem UPDATE ou DELETE permitido nesta tabela';

-- Proibir UPDATE e DELETE na audit_log
CREATE OR REPLACE RULE audit_log_no_update AS
  ON UPDATE TO gsa_tv.audit_log DO INSTEAD NOTHING;
CREATE OR REPLACE RULE audit_log_no_delete AS
  ON DELETE TO gsa_tv.audit_log DO INSTEAD NOTHING;

CREATE INDEX IF NOT EXISTS audit_log_time        ON gsa_tv.audit_log(occurred_at DESC);
CREATE INDEX IF NOT EXISTS audit_log_actor       ON gsa_tv.audit_log(actor, occurred_at DESC);
CREATE INDEX IF NOT EXISTS audit_log_resource    ON gsa_tv.audit_log(resource_type, resource_id);
CREATE INDEX IF NOT EXISTS audit_log_channel     ON gsa_tv.audit_log(channel_id, occurred_at DESC)
  WHERE channel_id IS NOT NULL;

COMMIT;
