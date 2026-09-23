-- Fix schema drift: Ensure gsa_tv_live_sources exists and program blocks has live_source_id
CREATE TABLE IF NOT EXISTS public.gsa_tv_live_sources (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    channel_id text NOT NULL REFERENCES public.gsa_tv_channels(id) ON DELETE CASCADE,
    name text NOT NULL,
    protocol text NOT NULL CHECK (protocol IN ('rtmp','rtmps','srt','hls')),
    endpoint_ciphertext text NOT NULL,
    status text NOT NULL DEFAULT 'offline' CHECK (status IN ('offline','testing','standby','preview','on_air','failed')),
    fallback_media_item_id text REFERENCES public.gsa_tv_media_items(id) ON DELETE SET NULL,
    recording_enabled boolean NOT NULL DEFAULT true,
    last_tested_at timestamptz,
    metadata jsonb NOT NULL DEFAULT '{}',
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.gsa_tv_program_blocks
ADD COLUMN IF NOT EXISTS live_source_id uuid REFERENCES public.gsa_tv_live_sources(id) ON DELETE SET NULL;
