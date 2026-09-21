BEGIN;

CREATE TABLE IF NOT EXISTS public.gsa_careers_vacancies (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code text NOT NULL UNIQUE,
  title text NOT NULL,
  area text NOT NULL,
  employment_type text NOT NULL CHECK (employment_type IN ('clt','estagio')),
  work_mode text NOT NULL DEFAULT 'presencial' CHECK (work_mode IN ('presencial','hibrido','remoto')),
  location text NOT NULL,
  description text NOT NULL,
  requirements text[] NOT NULL DEFAULT '{}',
  salary_min numeric(12,2),
  salary_max numeric(12,2),
  status text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','published','closed')),
  published_at timestamptz,
  closes_at timestamptz,
  created_by uuid,
  updated_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT gsa_careers_vacancy_salary_range CHECK (
    (salary_min IS NULL OR salary_min >= 0) AND
    (salary_max IS NULL OR salary_max >= 0) AND
    (salary_min IS NULL OR salary_max IS NULL OR salary_max >= salary_min)
  )
);

CREATE INDEX IF NOT EXISTS gsa_careers_vacancies_public_idx
  ON public.gsa_careers_vacancies(status, published_at DESC, closes_at);

ALTER TABLE public.gsa_careers_applications
  ADD COLUMN IF NOT EXISTS vacancy_id uuid REFERENCES public.gsa_careers_vacancies(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS gsa_careers_applications_vacancy_idx
  ON public.gsa_careers_applications(vacancy_id);

CREATE TABLE IF NOT EXISTS public.gsa_careers_notification_outbox (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  application_id uuid NOT NULL REFERENCES public.gsa_careers_applications(id) ON DELETE CASCADE,
  status text NOT NULL,
  recipient_email text NOT NULL,
  recipient_phone text,
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  delivery_status text NOT NULL DEFAULT 'pending' CHECK (delivery_status IN ('pending','processing','sent','failed')),
  attempts integer NOT NULL DEFAULT 0,
  next_attempt_at timestamptz NOT NULL DEFAULT now(),
  provider_message_id text,
  delivery_channel text,
  last_error text,
  created_at timestamptz NOT NULL DEFAULT now(),
  processed_at timestamptz
);
ALTER TABLE public.gsa_careers_notification_outbox
  ADD COLUMN IF NOT EXISTS delivery_channel text;
CREATE INDEX IF NOT EXISTS gsa_careers_notification_pending_idx
  ON public.gsa_careers_notification_outbox(delivery_status,next_attempt_at,created_at);

ALTER TABLE public.gsa_careers_vacancies ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.gsa_careers_notification_outbox ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.gsa_careers_vacancies FROM PUBLIC,anon,authenticated;
REVOKE ALL ON public.gsa_careers_notification_outbox FROM PUBLIC,anon,authenticated;
GRANT ALL ON public.gsa_careers_vacancies TO service_role;
GRANT ALL ON public.gsa_careers_notification_outbox TO service_role;

CREATE OR REPLACE FUNCTION public.gsa_public_list_career_vacancies()
RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public,pg_temp AS $$
  SELECT coalesce(jsonb_agg(to_jsonb(v) ORDER BY v.published_at DESC,v.title),'[]'::jsonb)
  FROM (
    SELECT id,code,title,area,employment_type,work_mode,location,description,
           requirements,salary_min,salary_max,published_at,closes_at
      FROM public.gsa_careers_vacancies
     WHERE status='published' AND (closes_at IS NULL OR closes_at>now())
  ) v;
$$;

CREATE OR REPLACE FUNCTION public.gsa_admin_list_career_vacancies(
  p_sessao_id uuid,p_session_token text
) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE v_context jsonb; v_result jsonb;
BEGIN
  v_context:=public.gsa_careers_admin_context(p_sessao_id,p_session_token);
  SELECT coalesce(jsonb_agg(to_jsonb(v) ORDER BY v.created_at DESC),'[]'::jsonb)
    INTO v_result FROM public.gsa_careers_vacancies v;
  RETURN v_result;
END $$;

CREATE OR REPLACE FUNCTION public.gsa_admin_upsert_career_vacancy(
  p_sessao_id uuid,p_session_token text,p_vacancy_id uuid,p_payload jsonb
) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE
  v_context jsonb; v_actor uuid; v_id uuid:=coalesce(p_vacancy_id,gen_random_uuid());
  v_status text:=lower(trim(coalesce(p_payload->>'status','draft')));
  v_code text:=upper(trim(coalesce(p_payload->>'code','')));
BEGIN
  v_context:=public.gsa_careers_admin_context(p_sessao_id,p_session_token);
  BEGIN v_actor:=coalesce(v_context->>'actor_id',v_context->>'ator_id')::uuid;
  EXCEPTION WHEN OTHERS THEN v_actor:=NULL; END;
  IF v_status NOT IN ('draft','published','closed') THEN RAISE EXCEPTION 'Status da vaga inválido.'; END IF;
  IF v_code='' THEN v_code:='VAG-'||upper(substr(encode(gen_random_bytes(5),'hex'),1,8)); END IF;
  IF length(trim(coalesce(p_payload->>'title','')))<3 THEN RAISE EXCEPTION 'Informe o título da vaga.'; END IF;
  IF length(trim(coalesce(p_payload->>'description','')))<20 THEN RAISE EXCEPTION 'A descrição deve possuir ao menos 20 caracteres.'; END IF;
  IF trim(coalesce(p_payload->>'location',''))='' THEN RAISE EXCEPTION 'Informe a localização da vaga.'; END IF;

  INSERT INTO public.gsa_careers_vacancies(
    id,code,title,area,employment_type,work_mode,location,description,requirements,
    salary_min,salary_max,status,published_at,closes_at,created_by,updated_by
  ) VALUES (
    v_id,v_code,trim(p_payload->>'title'),trim(p_payload->>'area'),
    lower(trim(p_payload->>'employment_type')),lower(trim(coalesce(p_payload->>'work_mode','presencial'))),
    trim(p_payload->>'location'),trim(p_payload->>'description'),
    coalesce(ARRAY(SELECT jsonb_array_elements_text(coalesce(p_payload->'requirements','[]'::jsonb))),'{}'),
    nullif(p_payload->>'salary_min','')::numeric,nullif(p_payload->>'salary_max','')::numeric,
    v_status,CASE WHEN v_status='published' THEN now() ELSE NULL END,
    nullif(p_payload->>'closes_at','')::timestamptz,v_actor,v_actor
  ) ON CONFLICT(id) DO UPDATE SET
    code=excluded.code,title=excluded.title,area=excluded.area,employment_type=excluded.employment_type,
    work_mode=excluded.work_mode,location=excluded.location,description=excluded.description,
    requirements=excluded.requirements,salary_min=excluded.salary_min,salary_max=excluded.salary_max,
    status=excluded.status,
    published_at=CASE WHEN excluded.status='published' THEN coalesce(gsa_careers_vacancies.published_at,now()) ELSE gsa_careers_vacancies.published_at END,
    closes_at=excluded.closes_at,updated_by=v_actor,updated_at=now();
  RETURN jsonb_build_object('success',true,'vacancy',(SELECT to_jsonb(v) FROM public.gsa_careers_vacancies v WHERE id=v_id));
END $$;

CREATE OR REPLACE FUNCTION public.gsa_careers_enqueue_status_notification()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE v_vacancy_title text;
BEGIN
  IF NEW.status IS NOT DISTINCT FROM OLD.status THEN RETURN NEW; END IF;
  SELECT title INTO v_vacancy_title FROM public.gsa_careers_vacancies WHERE id=NEW.vacancy_id;
  INSERT INTO public.gsa_careers_notification_outbox(
    application_id,status,recipient_email,recipient_phone,payload
  ) VALUES (
    NEW.id,NEW.status,NEW.email,NEW.phone,
    jsonb_build_object(
      'candidate_name',NEW.candidate_name,'protocol',NEW.protocol,
      'public_message',NEW.public_message,'interview_at',NEW.interview_at,
      'interview_location',NEW.interview_location,'vacancy_title',v_vacancy_title,
      'desired_area',NEW.desired_area
    )
  );
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS gsa_careers_status_notification_trigger ON public.gsa_careers_applications;
CREATE TRIGGER gsa_careers_status_notification_trigger
AFTER UPDATE OF status ON public.gsa_careers_applications
FOR EACH ROW EXECUTE FUNCTION public.gsa_careers_enqueue_status_notification();

CREATE OR REPLACE FUNCTION public.gsa_admin_confirm_career_notification(
  p_sessao_id uuid,p_session_token text,p_application_id uuid,p_status text,
  p_success boolean,p_error text DEFAULT NULL
) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $function$
DECLARE v_context jsonb; v_id uuid;
BEGIN
  v_context:=public.gsa_careers_admin_context(p_sessao_id,p_session_token);
  SELECT id INTO v_id FROM public.gsa_careers_notification_outbox
   WHERE application_id=p_application_id AND status=p_status AND delivery_status IN ('pending','processing','failed')
   ORDER BY created_at DESC LIMIT 1 FOR UPDATE;
  IF v_id IS NULL THEN RETURN jsonb_build_object('success',true,'already_processed',true); END IF;
  UPDATE public.gsa_careers_notification_outbox SET
    delivery_status=CASE WHEN p_success THEN 'sent' ELSE 'failed' END,
    delivery_channel='whatsapp',attempts=attempts+1,
    processed_at=CASE WHEN p_success THEN now() ELSE NULL END,
    last_error=CASE WHEN p_success THEN NULL ELSE left(coalesce(p_error,'Falha no envio por WhatsApp'),1000) END,
    next_attempt_at=CASE WHEN p_success THEN next_attempt_at ELSE now()+interval '15 minutes' END
   WHERE id=v_id;
  RETURN jsonb_build_object('success',true,'notification_id',v_id);
END $function$;

-- A fronteira pública valida a vaga e substitui área/modalidade por dados oficiais.
CREATE OR REPLACE FUNCTION public.gsa_public_submit_career_application(p_payload jsonb)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE v_result jsonb; v_doc text; v_headers jsonb; v_identity text; v_vacancy public.gsa_careers_vacancies%ROWTYPE; v_payload jsonb:=p_payload;
BEGIN
  IF coalesce((p_payload->>'privacy_consent')::boolean,false) IS NOT TRUE
     OR nullif(trim(p_payload->>'privacy_policy_version'),'') IS NULL THEN
    RAISE EXCEPTION 'Consentimento de privacidade obrigatório.' USING ERRCODE='22023';
  END IF;
  IF nullif(p_payload->>'vacancy_id','') IS NOT NULL THEN
    SELECT * INTO v_vacancy FROM public.gsa_careers_vacancies
     WHERE id=(p_payload->>'vacancy_id')::uuid AND status='published' AND (closes_at IS NULL OR closes_at>now());
    IF NOT FOUND THEN RAISE EXCEPTION 'A vaga selecionada não está mais disponível.' USING ERRCODE='22023'; END IF;
    v_payload:=v_payload||jsonb_build_object('desired_area',v_vacancy.area,'employment_type',v_vacancy.employment_type);
  END IF;
  BEGIN v_headers:=coalesce(current_setting('request.headers',true),'{}')::jsonb;
  EXCEPTION WHEN OTHERS THEN v_headers:='{}'::jsonb; END;
  v_doc:=regexp_replace(coalesce(v_payload->>'document',''),'[^0-9]','','g');
  v_identity:=coalesce(v_headers->>'x-forwarded-for',v_headers->>'x-real-ip','unknown')||'|'||v_doc;
  PERFORM public.gsa_careers_rate_limit('careers_submit',v_identity,5,interval '1 hour');
  v_result:=public.gsa_public_submit_career_application_impl(v_payload);
  IF coalesce((v_result->>'already_exists')::boolean,false) THEN
    RETURN jsonb_build_object('success',false,'already_exists',true,'code','active_application_exists');
  END IF;
  UPDATE public.gsa_careers_applications SET
    vacancy_id=CASE WHEN v_vacancy.id IS NOT NULL THEN v_vacancy.id ELSE NULL END,
    privacy_consent_at=coalesce(privacy_consent_at,now()),
    privacy_policy_version=v_payload->>'privacy_policy_version',
    retention_until=coalesce(retention_until,now()+interval '24 months')
   WHERE id=(v_result->>'id')::uuid;
  RETURN v_result;
END $$;

REVOKE ALL ON FUNCTION public.gsa_public_list_career_vacancies() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.gsa_public_list_career_vacancies() TO anon,authenticated;
REVOKE ALL ON FUNCTION public.gsa_admin_list_career_vacancies(uuid,text) FROM PUBLIC,anon;
REVOKE ALL ON FUNCTION public.gsa_admin_upsert_career_vacancy(uuid,text,uuid,jsonb) FROM PUBLIC,anon;
REVOKE ALL ON FUNCTION public.gsa_admin_confirm_career_notification(uuid,text,uuid,text,boolean,text) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.gsa_admin_list_career_vacancies(uuid,text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.gsa_admin_upsert_career_vacancy(uuid,text,uuid,jsonb) TO authenticated;
GRANT EXECUTE ON FUNCTION public.gsa_admin_confirm_career_notification(uuid,text,uuid,text,boolean,text) TO authenticated;
REVOKE ALL ON FUNCTION public.gsa_careers_enqueue_status_notification() FROM PUBLIC,anon,authenticated;

COMMIT;
NOTIFY pgrst, 'reload schema';
