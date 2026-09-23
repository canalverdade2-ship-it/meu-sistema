BEGIN;
SET LOCAL lock_timeout='5s';
SET LOCAL statement_timeout='30s';

DO $$
DECLARE
  v_program_music uuid;
  v_program_cinema uuid;
  v_program_pipoca uuid;
  v_program_misterios uuid;
BEGIN
  SELECT id INTO v_program_music FROM public.gsa_tv_programs WHERE channel_id='ch-main' AND name='GSA Music';
  SELECT id INTO v_program_cinema FROM public.gsa_tv_programs WHERE channel_id='ch-main' AND name='GSA Cinema';
  SELECT id INTO v_program_pipoca FROM public.gsa_tv_programs WHERE channel_id='ch-main' AND name='GSA Sessão Pipoca';
  SELECT id INTO v_program_misterios FROM public.gsa_tv_programs WHERE channel_id='ch-main' AND name='GSA Mistérios';

  -- Desabilitar GSA Music às 23:00
  UPDATE public.gsa_tv_weekly_grid_slots
     SET enabled = false, updated_at = now()
   WHERE channel_id = 'ch-main' 
     AND program_id = v_program_music
     AND start_time = '23:00'::time;

  -- Ajustar tempos
  UPDATE public.gsa_tv_weekly_grid_slots
     SET end_time = '20:30'::time, updated_at = now()
   WHERE channel_id = 'ch-main' AND program_id = v_program_cinema AND start_time = '19:30'::time;

  UPDATE public.gsa_tv_weekly_grid_slots
     SET start_time = '20:30'::time, end_time = '22:30'::time, updated_at = now()
   WHERE channel_id = 'ch-main' AND program_id = v_program_pipoca AND start_time = '20:00'::time;

  UPDATE public.gsa_tv_weekly_grid_slots
     SET start_time = '22:30'::time, end_time = '23:30'::time, updated_at = now()
   WHERE channel_id = 'ch-main' AND program_id = v_program_misterios AND start_time = '22:00'::time;

END $$;

COMMIT;
