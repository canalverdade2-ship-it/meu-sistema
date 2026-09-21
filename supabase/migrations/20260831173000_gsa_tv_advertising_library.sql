-- Dedicated advertising library for GSA TV.
-- Keeps commercial assets separate while reusing the validated media pipeline.
ALTER TABLE public.gsa_tv_media_items
  ADD COLUMN IF NOT EXISTS media_kind text NOT NULL DEFAULT 'program',
  ADD COLUMN IF NOT EXISTS advertiser_name text,
  ADD COLUMN IF NOT EXISTS campaign_name text,
  ADD COLUMN IF NOT EXISTS source_type text NOT NULL DEFAULT 'uploaded',
  ADD COLUMN IF NOT EXISTS ai_generated boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS approval_state text NOT NULL DEFAULT 'pending',
  ADD COLUMN IF NOT EXISTS metadata jsonb NOT NULL DEFAULT '{}'::jsonb;

ALTER TABLE public.gsa_tv_media_items
  DROP CONSTRAINT IF EXISTS gsa_tv_media_kind_valid,
  ADD CONSTRAINT gsa_tv_media_kind_valid CHECK (media_kind IN ('program','advertising','identity','filler')),
  DROP CONSTRAINT IF EXISTS gsa_tv_media_source_type_valid,
  ADD CONSTRAINT gsa_tv_media_source_type_valid CHECK (source_type IN ('uploaded','ai','marketplace','services','remote')),
  DROP CONSTRAINT IF EXISTS gsa_tv_media_approval_state_valid,
  ADD CONSTRAINT gsa_tv_media_approval_state_valid CHECK (approval_state IN ('draft','pending','approved','rejected','expired'));

CREATE INDEX IF NOT EXISTS gsa_tv_media_advertising_idx
  ON public.gsa_tv_media_items(channel_id, media_kind, approval_state, created_at DESC);

COMMENT ON COLUMN public.gsa_tv_media_items.media_kind IS 'Separates programmes, advertising, channel identity and filler assets.';
COMMENT ON COLUMN public.gsa_tv_media_items.approval_state IS 'Human approval gate before an advertising asset can enter the schedule.';

NOTIFY pgrst, 'reload schema';

ALTER TABLE public.gsa_tv_channels
  ADD COLUMN IF NOT EXISTS desired_state text NOT NULL DEFAULT 'stopped',
  ADD COLUMN IF NOT EXISTS playout_state text NOT NULL DEFAULT 'off_air',
  ADD COLUMN IF NOT EXISTS signal_state text NOT NULL DEFAULT 'stopped',
  ADD COLUMN IF NOT EXISTS last_signal_at timestamptz;

ALTER TABLE public.gsa_tv_channels
  DROP CONSTRAINT IF EXISTS gsa_tv_channel_desired_state_valid,
  ADD CONSTRAINT gsa_tv_channel_desired_state_valid CHECK (desired_state IN ('stopped','running','paused')),
  DROP CONSTRAINT IF EXISTS gsa_tv_channel_signal_state_valid,
  ADD CONSTRAINT gsa_tv_channel_signal_state_valid CHECK (signal_state IN ('stopped','starting','sending','recovering','failed'));
