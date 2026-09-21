BEGIN;

CREATE EXTENSION IF NOT EXISTS btree_gist;

CREATE UNIQUE INDEX IF NOT EXISTS gsa_tv_jobs_one_active_per_type
  ON public.gsa_tv_jobs(channel_id, job_type)
  WHERE status IN ('pending', 'running');

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'gsa_tv_schedule_no_overlap'
      AND conrelid = 'public.gsa_tv_schedule_slots'::regclass
  ) THEN
    ALTER TABLE public.gsa_tv_schedule_slots
      ADD CONSTRAINT gsa_tv_schedule_no_overlap
      EXCLUDE USING gist (
        channel_id WITH =,
        tstzrange(scheduled_start, scheduled_end, '[)') WITH &&
      ) WHERE (state <> 'cancelled');
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS gsa_tv_channels_runtime_state_idx
  ON public.gsa_tv_channels(desired_state, signal_state, updated_at DESC);

COMMIT;
