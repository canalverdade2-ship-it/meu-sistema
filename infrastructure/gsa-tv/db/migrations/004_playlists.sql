-- GSA TV — Migration 004: playlists compiladas (publicação atômica)

BEGIN;

CREATE TABLE IF NOT EXISTS gsa_tv.playlists (
  id                  UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  channel_id          UUID        NOT NULL REFERENCES gsa_tv.channels(id) ON DELETE RESTRICT,
  version             INTEGER     NOT NULL DEFAULT 1,
  covers_from         TIMESTAMPTZ NOT NULL,
  covers_until        TIMESTAMPTZ NOT NULL,
  state               TEXT        NOT NULL DEFAULT 'draft'
                                  CHECK (state IN ('draft','compiling','ready','published','archived','error')),
  -- Arquivo JSON gerado pelo Playlist Compiler (conteúdo do ffplayout playlist.json)
  playlist_json       JSONB       NOT NULL DEFAULT '{}',
  ffplayout_file_path TEXT,                                       -- caminho no host após publicação atômica
  -- Contagens para verificação rápida
  slot_count          INTEGER     NOT NULL DEFAULT 0,
  missing_files_count INTEGER     NOT NULL DEFAULT 0,
  -- Rollback: aponta para a versão anterior publicada
  previous_playlist_id UUID       REFERENCES gsa_tv.playlists(id) ON DELETE SET NULL,
  rollback_available  BOOLEAN     NOT NULL DEFAULT false,
  -- Auditoria de publicação
  compiled_by         TEXT,                                       -- 'system' ou user_id do operador
  published_at        TIMESTAMPTZ,
  archived_at         TIMESTAMPTZ,
  error_message       TEXT,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);

COMMENT ON TABLE gsa_tv.playlists IS 'Playlists compiladas e publicadas atomicamente — sempre há um rollback disponível';

CREATE INDEX IF NOT EXISTS playlists_channel_state    ON gsa_tv.playlists(channel_id, state);
CREATE INDEX IF NOT EXISTS playlists_published        ON gsa_tv.playlists(channel_id, published_at DESC NULLS LAST)
  WHERE state = 'published';

CREATE TRIGGER playlists_updated_at
  BEFORE UPDATE ON gsa_tv.playlists
  FOR EACH ROW EXECUTE FUNCTION gsa_tv.set_updated_at();

COMMIT;
