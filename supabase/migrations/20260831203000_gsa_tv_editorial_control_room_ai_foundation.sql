BEGIN;

CREATE TABLE IF NOT EXISTS public.gsa_tv_programs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), channel_id text NOT NULL REFERENCES public.gsa_tv_channels(id) ON DELETE CASCADE,
  name text NOT NULL, description text, category text, default_duration_s integer NOT NULL DEFAULT 1800 CHECK (default_duration_s>0),
  status text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','review','approved','published','archived')),
  clock_template jsonb NOT NULL DEFAULT '[]', notes text, created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS public.gsa_tv_series (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), channel_id text NOT NULL REFERENCES public.gsa_tv_channels(id) ON DELETE CASCADE,
  program_id uuid REFERENCES public.gsa_tv_programs(id) ON DELETE SET NULL, title text NOT NULL, description text,
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('draft','active','completed','archived')), created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS public.gsa_tv_episodes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), series_id uuid NOT NULL REFERENCES public.gsa_tv_series(id) ON DELETE CASCADE,
  media_item_id text REFERENCES public.gsa_tv_media_items(id) ON DELETE SET NULL, season_number integer NOT NULL DEFAULT 1 CHECK (season_number>0),
  episode_number integer NOT NULL CHECK (episode_number>0), title text NOT NULL, synopsis text, first_run_at timestamptz, last_run_at timestamptz,
  run_count integer NOT NULL DEFAULT 0 CHECK (run_count>=0), created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(series_id,season_number,episode_number)
);
CREATE TABLE IF NOT EXISTS public.gsa_tv_schedule_versions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), channel_id text NOT NULL REFERENCES public.gsa_tv_channels(id) ON DELETE CASCADE,
  broadcast_date date NOT NULL, version integer NOT NULL DEFAULT 1 CHECK (version>0),
  state text NOT NULL DEFAULT 'draft' CHECK (state IN ('draft','review','approved','published','running','completed','cancelled')),
  title text, notes text, approved_by uuid, approved_at timestamptz, published_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(), UNIQUE(channel_id,broadcast_date,version)
);
CREATE TABLE IF NOT EXISTS public.gsa_tv_program_blocks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), schedule_version_id uuid REFERENCES public.gsa_tv_schedule_versions(id) ON DELETE CASCADE,
  program_id uuid REFERENCES public.gsa_tv_programs(id) ON DELETE SET NULL, parent_slot_id text REFERENCES public.gsa_tv_schedule_slots(id) ON DELETE CASCADE,
  block_type text NOT NULL CHECK (block_type IN ('opening','content','commercial_break','call','bumper','closing','reserve','live')),
  position integer NOT NULL DEFAULT 0, planned_start_offset_s integer NOT NULL DEFAULT 0 CHECK (planned_start_offset_s>=0),
  planned_duration_s integer NOT NULL CHECK (planned_duration_s>0), cannot_interrupt boolean NOT NULL DEFAULT false,
  safe_cut_points jsonb NOT NULL DEFAULT '[]', notes text, created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS public.gsa_tv_rights_records (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), channel_id text NOT NULL REFERENCES public.gsa_tv_channels(id) ON DELETE CASCADE,
  media_item_id text REFERENCES public.gsa_tv_media_items(id) ON DELETE CASCADE, status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','approved','rejected','expired','unknown')),
  license_type text, territory text DEFAULT 'worldwide', platforms text[] NOT NULL DEFAULT ARRAY['youtube'], valid_from timestamptz, valid_until timestamptz,
  justification text, evidence jsonb NOT NULL DEFAULT '[]', approved_by uuid, approved_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS public.gsa_tv_comments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), channel_id text NOT NULL REFERENCES public.gsa_tv_channels(id) ON DELETE CASCADE,
  resource_type text NOT NULL, resource_id text NOT NULL, parent_id uuid REFERENCES public.gsa_tv_comments(id) ON DELETE CASCADE,
  comment_type text NOT NULL DEFAULT 'comment' CHECK (comment_type IN ('comment','fixed_note','review_request','incident_note')),
  priority text NOT NULL DEFAULT 'normal' CHECK (priority IN ('normal','important','urgent')), body text NOT NULL,
  author_id uuid, author_name text NOT NULL, assigned_to uuid, resolved boolean NOT NULL DEFAULT false, resolved_at timestamptz,
  attachments jsonb NOT NULL DEFAULT '[]', created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS public.gsa_tv_ad_campaigns (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), channel_id text NOT NULL REFERENCES public.gsa_tv_channels(id) ON DELETE CASCADE,
  advertiser_name text NOT NULL, name text NOT NULL, starts_at timestamptz NOT NULL, ends_at timestamptz NOT NULL CHECK (ends_at>starts_at),
  contracted_runs integer CHECK (contracted_runs>0), completed_runs integer NOT NULL DEFAULT 0 CHECK (completed_runs>=0),
  allowed_hours jsonb NOT NULL DEFAULT '[]', max_frequency_per_hour integer, priority integer NOT NULL DEFAULT 50 CHECK (priority BETWEEN 0 AND 100),
  competitor_group text, status text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','review','active','paused','completed','expired','cancelled')),
  metadata jsonb NOT NULL DEFAULT '{}', created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS public.gsa_tv_ad_assets (
  campaign_id uuid NOT NULL REFERENCES public.gsa_tv_ad_campaigns(id) ON DELETE CASCADE,
  media_item_id text NOT NULL REFERENCES public.gsa_tv_media_items(id) ON DELETE CASCADE,
  weight integer NOT NULL DEFAULT 1 CHECK (weight>0), PRIMARY KEY(campaign_id,media_item_id)
);
CREATE TABLE IF NOT EXISTS public.gsa_tv_live_sources (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), channel_id text NOT NULL REFERENCES public.gsa_tv_channels(id) ON DELETE CASCADE,
  name text NOT NULL, protocol text NOT NULL CHECK (protocol IN ('rtmp','rtmps','srt','hls')), endpoint_ciphertext text NOT NULL,
  status text NOT NULL DEFAULT 'offline' CHECK (status IN ('offline','testing','standby','preview','on_air','failed')),
  fallback_media_item_id text REFERENCES public.gsa_tv_media_items(id) ON DELETE SET NULL, recording_enabled boolean NOT NULL DEFAULT true,
  last_tested_at timestamptz, metadata jsonb NOT NULL DEFAULT '{}', created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS public.gsa_tv_identity_assets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), channel_id text NOT NULL REFERENCES public.gsa_tv_channels(id) ON DELETE CASCADE,
  asset_type text NOT NULL CHECK (asset_type IN ('bug','opening','closing','bumper','emergency','holding','fallback','background')),
  media_item_id text REFERENCES public.gsa_tv_media_items(id) ON DELETE SET NULL, enabled boolean NOT NULL DEFAULT true,
  settings jsonb NOT NULL DEFAULT '{}', is_primary boolean NOT NULL DEFAULT false, created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS public.gsa_tv_graphic_templates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), channel_id text NOT NULL REFERENCES public.gsa_tv_channels(id) ON DELETE CASCADE,
  name text NOT NULL, graphic_type text NOT NULL CHECK (graphic_type IN ('lower_third','ticker','headline','breaking','clock','score','qr','live_bug')),
  template jsonb NOT NULL DEFAULT '{}', enabled boolean NOT NULL DEFAULT true, created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS public.gsa_tv_on_air_graphics (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), channel_id text NOT NULL REFERENCES public.gsa_tv_channels(id) ON DELETE CASCADE,
  template_id uuid REFERENCES public.gsa_tv_graphic_templates(id) ON DELETE SET NULL, payload jsonb NOT NULL DEFAULT '{}',
  state text NOT NULL DEFAULT 'preview' CHECK (state IN ('draft','preview','on_air','cleared','expired')), starts_at timestamptz, ends_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS public.gsa_tv_as_run (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), channel_id text NOT NULL REFERENCES public.gsa_tv_channels(id) ON DELETE CASCADE,
  schedule_slot_id text REFERENCES public.gsa_tv_schedule_slots(id) ON DELETE SET NULL, media_item_id text REFERENCES public.gsa_tv_media_items(id) ON DELETE SET NULL,
  started_at timestamptz NOT NULL, ended_at timestamptz, outcome text NOT NULL DEFAULT 'started' CHECK (outcome IN ('started','completed','skipped','interrupted','fallback','failed')),
  actual_duration_s integer, details jsonb NOT NULL DEFAULT '{}', created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS public.gsa_tv_ai_presenters (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), channel_id text NOT NULL REFERENCES public.gsa_tv_channels(id) ON DELETE CASCADE,
  name text NOT NULL, role text NOT NULL, provider text, provider_avatar_id_ciphertext text, voice_id_ciphertext text,
  identity_version integer NOT NULL DEFAULT 1, status text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','testing','approved','inactive','archived')),
  visual_profile jsonb NOT NULL DEFAULT '{}', voice_profile jsonb NOT NULL DEFAULT '{}', editorial_profile jsonb NOT NULL DEFAULT '{}',
  reference_assets jsonb NOT NULL DEFAULT '[]', consent_record_id uuid REFERENCES public.gsa_tv_rights_records(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS public.gsa_tv_ai_projects (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), channel_id text NOT NULL REFERENCES public.gsa_tv_channels(id) ON DELETE CASCADE,
  name text NOT NULL, project_type text NOT NULL, brief text NOT NULL, interpreted_brief jsonb NOT NULL DEFAULT '{}',
  autonomy_mode text NOT NULL DEFAULT 'assisted' CHECK (autonomy_mode IN ('assisted','supervised_auto','authorized_routine')),
  state text NOT NULL DEFAULT 'draft' CHECK (state IN ('draft','planning','generating','review','approved','published','failed','cancelled','archived')),
  estimated_cost numeric(12,4), actual_cost numeric(12,4), created_by uuid, approved_by uuid, approved_at timestamptz,
  metadata jsonb NOT NULL DEFAULT '{}', created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS public.gsa_tv_ai_jobs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), project_id uuid NOT NULL REFERENCES public.gsa_tv_ai_projects(id) ON DELETE CASCADE,
  job_type text NOT NULL, provider text, model text, state text NOT NULL DEFAULT 'pending' CHECK (state IN ('pending','running','review','completed','failed','cancelled')),
  priority text NOT NULL DEFAULT 'normal' CHECK (priority IN ('emergency','today','tomorrow','advertising','future','experiment')),
  input jsonb NOT NULL DEFAULT '{}', output jsonb NOT NULL DEFAULT '{}', progress integer NOT NULL DEFAULT 0 CHECK (progress BETWEEN 0 AND 100),
  estimated_cost numeric(12,4), actual_cost numeric(12,4), error_message text, started_at timestamptz, finished_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS public.gsa_tv_ai_assets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), project_id uuid NOT NULL REFERENCES public.gsa_tv_ai_projects(id) ON DELETE CASCADE,
  job_id uuid REFERENCES public.gsa_tv_ai_jobs(id) ON DELETE SET NULL, asset_type text NOT NULL, file_path text, prompt text,
  provider_metadata jsonb NOT NULL DEFAULT '{}', version integer NOT NULL DEFAULT 1, approval_state text NOT NULL DEFAULT 'draft' CHECK (approval_state IN ('draft','review','approved','rejected','published')),
  published_media_item_id text REFERENCES public.gsa_tv_media_items(id) ON DELETE SET NULL, created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now()
);

-- Compatibilidade com estruturas preliminares que possam existir na VPS.
ALTER TABLE public.gsa_tv_ai_projects
  ADD COLUMN IF NOT EXISTS channel_id text REFERENCES public.gsa_tv_channels(id) ON DELETE CASCADE,
  ADD COLUMN IF NOT EXISTS state text NOT NULL DEFAULT 'draft',
  ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now();
ALTER TABLE public.gsa_tv_ai_jobs
  ADD COLUMN IF NOT EXISTS priority text NOT NULL DEFAULT 'normal',
  ADD COLUMN IF NOT EXISTS state text NOT NULL DEFAULT 'pending',
  ADD COLUMN IF NOT EXISTS created_at timestamptz NOT NULL DEFAULT now();
ALTER TABLE public.gsa_tv_as_run
  ADD COLUMN IF NOT EXISTS channel_id text REFERENCES public.gsa_tv_channels(id) ON DELETE CASCADE,
  ADD COLUMN IF NOT EXISTS started_at timestamptz NOT NULL DEFAULT now();

CREATE INDEX IF NOT EXISTS gsa_tv_comments_resource_idx ON public.gsa_tv_comments(channel_id,resource_type,resource_id,created_at);
CREATE INDEX IF NOT EXISTS gsa_tv_schedule_versions_date_idx ON public.gsa_tv_schedule_versions(channel_id,broadcast_date,state);
CREATE INDEX IF NOT EXISTS gsa_tv_ai_projects_state_idx ON public.gsa_tv_ai_projects(channel_id,state,updated_at DESC);
CREATE INDEX IF NOT EXISTS gsa_tv_ai_jobs_queue_idx ON public.gsa_tv_ai_jobs(state,priority,created_at);
CREATE INDEX IF NOT EXISTS gsa_tv_as_run_started_idx ON public.gsa_tv_as_run(channel_id,started_at DESC);

DO $$ DECLARE t text; BEGIN
  FOREACH t IN ARRAY ARRAY['gsa_tv_programs','gsa_tv_series','gsa_tv_episodes','gsa_tv_schedule_versions','gsa_tv_program_blocks','gsa_tv_rights_records','gsa_tv_comments','gsa_tv_ad_campaigns','gsa_tv_ad_assets','gsa_tv_live_sources','gsa_tv_identity_assets','gsa_tv_graphic_templates','gsa_tv_on_air_graphics','gsa_tv_as_run','gsa_tv_ai_presenters','gsa_tv_ai_projects','gsa_tv_ai_jobs','gsa_tv_ai_assets'] LOOP
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY',t);
    EXECUTE format('REVOKE ALL ON TABLE public.%I FROM anon, authenticated',t);
    EXECUTE format('GRANT ALL ON TABLE public.%I TO service_role',t);
  END LOOP;
END $$;

NOTIFY pgrst, 'reload schema';
COMMIT;
