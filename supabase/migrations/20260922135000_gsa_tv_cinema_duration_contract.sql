BEGIN;
SET LOCAL lock_timeout='5s';
SET LOCAL statement_timeout='30s';

DO $$
DECLARE
  v_program_id uuid;
  v_count integer;
BEGIN
  SELECT count(*), min(id)
    INTO v_count, v_program_id
    FROM public.gsa_tv_programs
   WHERE channel_id='ch-main'
     AND name='GSA Cinema';

  IF v_count <> 1 THEN
    RAISE EXCEPTION 'GSA TV: esperado exatamente um programa GSA Cinema; encontrados %', v_count;
  END IF;

  UPDATE public.gsa_tv_programs
     SET default_duration_s=3600,
         notes=concat_ws(E'\n',nullif(notes,''),
           'Contrato editorial: GSA Cinema possui duração de 60 minutos.'),
         updated_at=now()
   WHERE id=v_program_id;

  UPDATE public.gsa_tv_weekly_grid_slots
     SET metadata=coalesce(metadata,'{}'::jsonb) || jsonb_build_object(
           'required_slot_duration_s',3600,
           'duration_contract','gsa-cinema-60min'
         ),
         updated_at=now()
   WHERE channel_id='ch-main'
     AND program_id=v_program_id
     AND enabled;

  -- Marca também grades futuras já materializadas, sem alterar horário, mídia
  -- ou estado editorial. O readiness passa a bloquear até a grade ser corrigida.
  UPDATE public.gsa_tv_program_blocks b
     SET metadata=coalesce(b.metadata,'{}'::jsonb) || jsonb_build_object(
           'required_slot_duration_s',3600,
           'duration_contract','gsa-cinema-60min'
         ),
         updated_at=now()
    FROM public.gsa_tv_schedule_versions v
   WHERE b.schedule_version_id=v.id
     AND b.program_id=v_program_id
     AND v.channel_id='ch-main'
     AND v.broadcast_date >= (now() AT TIME ZONE 'America/Sao_Paulo')::date
     AND v.state IN ('draft','review','approved','published');
END $$;

CREATE OR REPLACE FUNCTION public.gsa_tv_guard_cinema_duration_compile()
RETURNS trigger
LANGUAGE plpgsql
SET search_path=public,pg_temp
AS $$
DECLARE
  v_date date;
  v_schedule_id uuid;
BEGIN
  IF NEW.channel_id <> 'ch-main' OR NEW.job_type <> 'compile_playlist' THEN
    RETURN NEW;
  END IF;

  BEGIN
    v_date := COALESCE(
      NULLIF(NEW.payload->>'date','')::date,
      (now() AT TIME ZONE 'America/Sao_Paulo')::date
    );
  EXCEPTION WHEN others THEN
    RETURN NEW; -- o gate principal reporta data inválida
  END;

  SELECT id
    INTO v_schedule_id
    FROM public.gsa_tv_schedule_versions
   WHERE channel_id=NEW.channel_id
     AND broadcast_date=v_date
     AND state='published'
   ORDER BY version DESC
   LIMIT 1;

  IF v_schedule_id IS NULL THEN
    RETURN NEW; -- o gate principal reporta grade ausente
  END IF;

  IF EXISTS (
    SELECT 1
      FROM public.gsa_tv_program_blocks b
      JOIN public.gsa_tv_programs p ON p.id=b.program_id
     WHERE b.schedule_version_id=v_schedule_id
       AND p.channel_id='ch-main'
       AND p.name='GSA Cinema'
       AND b.planned_duration_s < 3600
  ) THEN
    RAISE EXCEPTION
      'GSA TV: compilação bloqueada para %; GSA Cinema exige bloco contínuo de 60 minutos',
      v_date;
  END IF;

  RETURN NEW;
END;
$$;

COMMENT ON FUNCTION public.gsa_tv_guard_cinema_duration_compile() IS
  'Bloqueia compile_playlist quando GSA Cinema estiver materializado com menos de 3600 segundos.';

DROP TRIGGER IF EXISTS gsa_tv_cinema_duration_compile_gate ON public.gsa_tv_jobs;
CREATE TRIGGER gsa_tv_cinema_duration_compile_gate
BEFORE INSERT ON public.gsa_tv_jobs
FOR EACH ROW
EXECUTE FUNCTION public.gsa_tv_guard_cinema_duration_compile();

COMMIT;
