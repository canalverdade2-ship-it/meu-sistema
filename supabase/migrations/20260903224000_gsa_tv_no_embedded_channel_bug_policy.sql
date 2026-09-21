-- A identidade persistente do canal pertence exclusivamente ao playout.
-- Nenhuma mídia editorial, publicitária ou gerada por IA deve conter mosca,
-- logo de canto ou marca-d'água embutida no arquivo.
UPDATE public.gsa_tv_channels
SET config = COALESCE(config, '{}'::jsonb) || jsonb_build_object(
  'content_creation_policy', jsonb_build_object(
    'embedded_channel_bug', false,
    'embedded_corner_logo', false,
    'embedded_watermark', false,
    'channel_bug_managed_exclusively_by_playout', true,
    'program_identity_in_opening_and_scenery_allowed', true,
    'policy_note', 'Nenhuma criação de conteúdo pode conter mosca, logo permanente de canto ou marca-d agua. A única mosca é a fixa da GSA TV aplicada pelo playout.'
  )
), updated_at = now()
WHERE id = 'ch-main';

