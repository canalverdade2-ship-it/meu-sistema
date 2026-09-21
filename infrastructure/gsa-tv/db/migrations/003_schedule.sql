-- GSA TV — Migration 003: slots de grade técnica

BEGIN;

CREATE TABLE IF NOT EXISTS gsa_tv.schedule_slots (
  id                  UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  channel_id          UUID        NOT NULL REFERENCES gsa_tv.channels(id) ON DELETE RESTRICT,
  media_item_id       UUID        REFERENCES gsa_tv.media_items(id) ON DELETE SET NULL,
  scheduled_start     TIMESTAMPTZ NOT NULL,
  scheduled_end       TIMESTAMPTZ NOT NULL,
  slot_type           TEXT        NOT NULL DEFAULT 'content'
                                  CHECK (slot_type IN ('content','commercial','filler','vinheta','slate','fallback')),
  title_override      TEXT,                                       -- sobrescreve o título do media_item
  weight              INTEGER     NOT NULL DEFAULT 0,             -- prioridade dentro de filler pool
  state               TEXT        NOT NULL DEFAULT 'scheduled'
                                  CHECK (state IN ('scheduled','confirmed','played','skipped','error')),
  notes               TEXT,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT schedule_slots_no_overlap EXCLUDE USING gist (
    channel_id WITH =,
    tstzrange(scheduled_start, scheduled_end, '[)') WITH &&
  )
);

COMMENT ON TABLE gsa_tv.schedule_slots IS 'Grade técnica da GSA TV — sem sobreposição por canal garantida por constraint de exclusão';

CREATE INDEX IF NOT EXISTS schedule_slots_channel_range
  ON gsa_tv.schedule_slots(channel_id, scheduled_start, scheduled_end);
CREATE INDEX IF NOT EXISTS schedule_slots_state
  ON gsa_tv.schedule_slots(state);
CREATE INDEX IF NOT EXISTS schedule_slots_upcoming
  ON gsa_tv.schedule_slots(channel_id, scheduled_start)
  WHERE state IN ('scheduled','confirmed');

CREATE TRIGGER schedule_slots_updated_at
  BEFORE UPDATE ON gsa_tv.schedule_slots
  FOR EACH ROW EXECUTE FUNCTION gsa_tv.set_updated_at();

-- Extensão necessária para EXCLUDE USING GIST com tstzrange
CREATE EXTENSION IF NOT EXISTS btree_gist;

COMMIT;
