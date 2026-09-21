BEGIN;
SET LOCAL lock_timeout = '10s';
SET LOCAL statement_timeout = '120s';
SELECT pg_advisory_xact_lock(hashtext('gsa-tv-definitive-grid-20260909'));
LOCK TABLE public.gsa_tv_weekly_grid_slots IN SHARE ROW EXCLUSIVE MODE;

CREATE TEMP TABLE approved_clock(start_at time PRIMARY KEY,end_at time,name text,mode text,variant text) ON COMMIT DROP;
INSERT INTO approved_clock VALUES
('06:00','06:30','GSA Em Fé','library','abertura-oficial-e-em-fe'),
('06:30','07:15','GSA Agro','mixed',NULL),
('07:15','07:30','GSA Tempo','api',NULL),
('07:30','08:00','GSA Manhã News','mixed','manha'),
('08:00','09:00','GSA Bem Viver','mixed',NULL),
('09:00','09:30','GSA Tech','mixed',NULL),
('09:30','10:00','GSA Histórias da Bíblia','library',NULL),
('10:00','10:30','GSA Cidadania','mixed',NULL),
('10:30','11:00','GSA Business','mixed',NULL),
('11:00','12:00','GSA Sabor','ai_original',NULL),
('12:00','12:30','GSA Meio Dia News','mixed','meio-dia'),
('12:30','13:00','GSA Mercado','api',NULL),
('13:00','13:30','GSA Desenhos','library',NULL),
('13:30','14:30','GSA Planeta Terra','mixed',NULL),
('14:30','15:30','GSA Destinos','mixed',NULL),
('15:30','16:30','GSA Mundo','mixed',NULL),
('16:30','17:00','GSA Hora da Palavra','ai_original',NULL),
('17:00','17:30','GSA Motor','mixed',NULL),
('17:30','18:00','GSA Tá na Rede','mixed',NULL),
('18:00','19:00','GSA Esportes','mixed',NULL),
('19:00','19:30','GSA News Noite','mixed','noite'),
('19:30','20:00','GSA Cinema','mixed',NULL),
('20:00','22:00','GSA Sessão Pipoca','library','filme-integral-reserva-120min'),
('22:00','23:00','GSA Mistérios','mixed',NULL),
('23:00','23:30','GSA Music','library',NULL),
('23:30','23:50','GSA Em Fé','library','reflexao-final-20min'),
('23:50','23:59','Continuidade GSA TV','library','encerramento-oficial');

DO $$ BEGIN
 IF EXISTS (SELECT 1 FROM approved_clock c WHERE (SELECT count(*) FROM public.gsa_tv_programs p WHERE p.channel_id='ch-main' AND p.name=c.name)<>1) THEN
  RAISE EXCEPTION 'Nome de programa ausente ou ambíguo; nenhuma mudança aplicada';
 END IF;
 IF (SELECT sum(extract(epoch FROM end_at-start_at)) FROM approved_clock)<>64740 THEN RAISE EXCEPTION 'Duração diária inválida'; END IF;
 IF EXISTS(SELECT 1 FROM (SELECT start_at,lag(end_at) OVER(ORDER BY start_at) prev FROM approved_clock)t WHERE prev IS NOT NULL AND start_at<>prev) THEN RAISE EXCEPTION 'Lacuna ou sobreposição'; END IF;
END $$;

-- Preserva registros legados; somente as faixas autorizadas ficam habilitadas.
UPDATE public.gsa_tv_weekly_grid_slots SET enabled=false,updated_at=now()
 WHERE channel_id='ch-main' AND enabled;
INSERT INTO public.gsa_tv_weekly_grid_slots(channel_id,weekday,start_time,end_time,program_id,segment_variant,content_mode,enabled,metadata)
SELECT 'ch-main',d,c.start_at,c.end_at,p.id,c.variant,c.mode,true,
 jsonb_build_object('grid_revision','definitiva-20260909-0600-2359','timezone','America/Sao_Paulo',
  'includes_bumpers_and_breaks',true,'content_approval_required',true,'target_video','1080p30',
  'block_type',CASE WHEN c.start_at='23:50' THEN 'closing' ELSE 'content' END,
  'opening_duration_s',CASE WHEN c.start_at='06:00' THEN 40 ELSE 0 END,
  'cannot_interrupt',c.name='GSA Sessão Pipoca')
FROM approved_clock c CROSS JOIN generate_series(0,6)d
JOIN public.gsa_tv_programs p ON p.channel_id='ch-main' AND p.name=c.name
ON CONFLICT(channel_id,weekday,start_time) DO UPDATE SET
 end_time=excluded.end_time,program_id=excluded.program_id,segment_variant=excluded.segment_variant,
 content_mode=excluded.content_mode,enabled=true,metadata=excluded.metadata,updated_at=now();

UPDATE public.gsa_tv_programs p SET default_duration_s=c.duration,updated_at=now()
FROM (SELECT name,max(extract(epoch FROM end_at-start_at))::integer duration FROM approved_clock WHERE name<>'Continuidade GSA TV' GROUP BY name)c
WHERE p.channel_id='ch-main' AND p.name=c.name;

-- Contrato editorial de horários. Não é um agendador de liga/desliga.
UPDATE public.gsa_tv_channels SET config=coalesce(config,'{}'::jsonb)||jsonb_build_object(
 'broadcast_schedule_policy',jsonb_build_object('revision','definitiva-20260909-0600-2359',
 'timezone','America/Sao_Paulo','weekdays',jsonb_build_array(0,1,2,3,4,5,6),
 'on_air_start','06:00:00','sign_off_start','23:50:00','stream_stop','23:59:00',
 'production_start','00:00:00','production_stop','05:59:00','preflight_start','05:59:00',
 'opening_duration_s',40,'target_video','1080p30','controller_validation','pending_end_to_end_test'))
WHERE id='ch-main';

-- Mantém abertura/encerramento e regras de corte ao materializar novos dias.
DO $$ DECLARE f text; BEGIN
 SELECT pg_get_functiondef('public.gsa_tv_materialize_fixed_schedule(date,text)'::regprocedure) INTO f;
 IF position('gsa_grid_metadata_v2' IN f)=0 THEN
  IF position('SELECT v_schedule_id,s.program_id,''content'',' IN f)=0 OR position('         false,''[]''::jsonb,' IN f)=0 THEN
    RAISE EXCEPTION 'Materializador mudou; revisar antes de aplicar';
  END IF;
  f:=replace(f,'SELECT v_schedule_id,s.program_id,''content'',','SELECT v_schedule_id,s.program_id,coalesce(s.metadata->>''block_type'',''content''),');
  f:=replace(f,'         false,''[]''::jsonb,','         coalesce((s.metadata->>''cannot_interrupt'')::boolean,false),''[]''::jsonb,');
  f:=replace(f,'         jsonb_build_object(','         coalesce(s.metadata,''{}''::jsonb) || jsonb_build_object( /* gsa_grid_metadata_v2 */');
  EXECUTE f;
 END IF;
END $$;

-- Substitui apenas versões editoriais da grade fixa; mantém histórico e não toca em versões running/completed.
CREATE TEMP TABLE replacement_dates ON COMMIT DROP AS
 SELECT DISTINCT broadcast_date FROM public.gsa_tv_schedule_versions v
 WHERE channel_id='ch-main' AND broadcast_date>=(now() AT TIME ZONE 'America/Sao_Paulo')::date
 AND state IN ('draft','review','approved','published')
 AND EXISTS(SELECT 1 FROM public.gsa_tv_program_blocks b WHERE b.schedule_version_id=v.id AND b.metadata->>'fixed_weekly_grid'='true')
 AND NOT EXISTS(SELECT 1 FROM public.gsa_tv_schedule_versions r WHERE r.channel_id=v.channel_id AND r.broadcast_date=v.broadcast_date AND r.state IN ('running','completed'));
UPDATE public.gsa_tv_schedule_versions v SET state='cancelled',updated_at=now(),
 notes=concat_ws(E'\n',notes,'Substituída pela grade definitiva 06h–23h59 em 09/09/2026; histórico preservado.')
WHERE channel_id='ch-main' AND broadcast_date IN(SELECT broadcast_date FROM replacement_dates)
 AND state IN('draft','review','approved','published')
 AND EXISTS(SELECT 1 FROM public.gsa_tv_program_blocks b WHERE b.schedule_version_id=v.id AND b.metadata->>'fixed_weekly_grid'='true')
 AND NOT EXISTS(SELECT 1 FROM public.gsa_tv_program_blocks b WHERE b.schedule_version_id=v.id AND b.metadata->>'grid_revision'='definitiva-20260909-0600-2359');
SELECT public.gsa_tv_materialize_fixed_schedule(broadcast_date,'ch-main') FROM replacement_dates ORDER BY broadcast_date;
SELECT public.gsa_tv_refresh_fixed_schedule_horizon((now() AT TIME ZONE 'America/Sao_Paulo')::date,31,'ch-main');

DO $$ BEGIN
 IF (SELECT count(*) FROM public.gsa_tv_weekly_grid_slots WHERE channel_id='ch-main' AND enabled)<>189 THEN RAISE EXCEPTION 'Esperadas 189 faixas semanais'; END IF;
 IF EXISTS(SELECT 1 FROM public.gsa_tv_weekly_grid_slots WHERE channel_id='ch-main' AND enabled AND (start_time<'06:00' OR end_time>'23:59' OR end_time<=start_time)) THEN RAISE EXCEPTION 'Faixa fora da janela de transmissão'; END IF;
 IF EXISTS(SELECT 1 FROM public.gsa_tv_weekly_grid_slots s JOIN public.gsa_tv_programs p ON p.id=s.program_id WHERE s.channel_id='ch-main' AND s.enabled AND p.name<>'GSA Em Fé' GROUP BY weekday,p.name HAVING count(*)>1) THEN RAISE EXCEPTION 'Programa repetido indevidamente'; END IF;
END $$;
COMMIT;
