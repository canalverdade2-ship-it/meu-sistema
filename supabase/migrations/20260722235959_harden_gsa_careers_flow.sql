BEGIN;

ALTER TABLE public.gsa_careers_applications
  ADD COLUMN IF NOT EXISTS resume_storage_path text,
  ADD COLUMN IF NOT EXISTS resume_uploaded_at timestamptz,
  ADD COLUMN IF NOT EXISTS public_message text,
  ADD COLUMN IF NOT EXISTS interview_at timestamptz,
  ADD COLUMN IF NOT EXISTS interview_location text,
  ADD COLUMN IF NOT EXISTS status_changed_at timestamptz NOT NULL DEFAULT now(),
  ADD COLUMN IF NOT EXISTS closed_at timestamptz;

CREATE TABLE IF NOT EXISTS public.gsa_careers_application_history (
  id bigserial PRIMARY KEY,
  application_id uuid NOT NULL REFERENCES public.gsa_careers_applications(id) ON DELETE CASCADE,
  from_status text,
  to_status text NOT NULL,
  actor_type text NOT NULL,
  actor_id uuid,
  actor_name text,
  note text,
  interview_at timestamptz,
  interview_location text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS gsa_careers_history_application_idx
  ON public.gsa_careers_application_history(application_id, created_at DESC);

ALTER TABLE public.gsa_careers_application_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.gsa_careers_applications ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS gsa_careers_public_select ON public.gsa_careers_applications;
DROP POLICY IF EXISTS gsa_careers_admin_all ON public.gsa_careers_applications;

REVOKE ALL ON TABLE public.gsa_careers_applications FROM anon, authenticated;
REVOKE ALL ON TABLE public.gsa_careers_application_history FROM anon, authenticated;
REVOKE ALL ON SEQUENCE public.gsa_careers_application_history_id_seq FROM anon, authenticated;

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'gsa-careers-resumes',
  'gsa-careers-resumes',
  false,
  10485760,
  ARRAY[
    'application/pdf',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'image/jpeg',
    'image/png',
    'image/webp'
  ]::text[]
)
ON CONFLICT (id) DO UPDATE
SET public = false,
    file_size_limit = EXCLUDED.file_size_limit,
    allowed_mime_types = EXCLUDED.allowed_mime_types;

CREATE OR REPLACE FUNCTION public.gsa_careers_validate_cpf(p_document text)
RETURNS boolean
LANGUAGE plpgsql
IMMUTABLE
SET search_path = public, pg_temp
AS $$
DECLARE
  v_document text := regexp_replace(COALESCE(p_document, ''), '[^0-9]', '', 'g');
  v_sum integer;
  v_digit_one integer;
  v_digit_two integer;
  v_index integer;
BEGIN
  IF length(v_document) <> 11 OR v_document ~ '^([0-9])\1{10}$' THEN
    RETURN false;
  END IF;

  v_sum := 0;
  FOR v_index IN 1..9 LOOP
    v_sum := v_sum + (substr(v_document, v_index, 1)::integer * (11 - v_index));
  END LOOP;
  v_digit_one := 11 - (v_sum % 11);
  IF v_digit_one >= 10 THEN v_digit_one := 0; END IF;

  v_sum := 0;
  FOR v_index IN 1..10 LOOP
    v_sum := v_sum + (substr(v_document, v_index, 1)::integer * (12 - v_index));
  END LOOP;
  v_digit_two := 11 - (v_sum % 11);
  IF v_digit_two >= 10 THEN v_digit_two := 0; END IF;

  RETURN v_digit_one = substr(v_document, 10, 1)::integer
     AND v_digit_two = substr(v_document, 11, 1)::integer;
END;
$$;

CREATE OR REPLACE FUNCTION public.gsa_careers_admin_context(
  p_sessao_id uuid,
  p_session_token text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth, pg_temp
AS $$
DECLARE
  v_context jsonb;
  v_actor_type text;
  v_modules jsonb;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Sessao Supabase ausente' USING ERRCODE = '42501';
  END IF;

  IF COALESCE(auth.jwt()->'app_metadata'->>'gsa_session_id', '') <> p_sessao_id::text THEN
    RAISE EXCEPTION 'Sessao administrativa divergente' USING ERRCODE = '42501';
  END IF;

  EXECUTE 'SELECT to_jsonb(public.gsa_admin_get_context_secure($1, $2))'
    INTO v_context
    USING p_sessao_id, p_session_token;

  v_actor_type := COALESCE(v_context->>'actor_type', v_context->>'ator_tipo');
  IF v_actor_type NOT IN ('admin', 'colaborador') THEN
    RAISE EXCEPTION 'Ator administrativo invalido' USING ERRCODE = '42501';
  END IF;

  IF v_actor_type = 'colaborador' THEN
    v_modules := CASE
      WHEN jsonb_typeof(v_context->'modules') = 'array' THEN v_context->'modules'
      ELSE '[]'::jsonb
    END;

    IF NOT EXISTS (
      SELECT 1
      FROM jsonb_array_elements_text(v_modules) AS granted(module_name)
      WHERE replace(lower(granted.module_name), '_', '-') IN ('trabalhe-conosco', 'careers')
    ) THEN
      RAISE EXCEPTION 'Modulo Trabalhe Conosco nao autorizado' USING ERRCODE = '42501';
    END IF;
  END IF;

  RETURN v_context;
END;
$$;

CREATE OR REPLACE FUNCTION public.gsa_careers_resume_path_is_expected(p_path text)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.gsa_careers_applications application
    WHERE application.resume_storage_path = p_path
      AND application.resume_uploaded_at IS NULL
      AND application.created_at >= now() - interval '2 hours'
  );
$$;

CREATE OR REPLACE FUNCTION public.gsa_careers_is_admin_actor()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, auth, pg_temp
AS $$
  SELECT auth.uid() IS NOT NULL
    AND COALESCE(auth.jwt()->'app_metadata'->>'gsa_session_id', '') <> ''
    AND COALESCE(auth.jwt()->'app_metadata'->>'gsa_actor_type', '') IN ('admin', 'colaborador');
$$;

DROP POLICY IF EXISTS gsa_careers_resume_public_insert ON storage.objects;
DROP POLICY IF EXISTS gsa_careers_resume_admin_select ON storage.objects;

CREATE POLICY gsa_careers_resume_public_insert
ON storage.objects
FOR INSERT
TO anon, authenticated
WITH CHECK (
  bucket_id = 'gsa-careers-resumes'
  AND public.gsa_careers_resume_path_is_expected(name)
);

CREATE POLICY gsa_careers_resume_admin_select
ON storage.objects
FOR SELECT
TO authenticated
USING (
  bucket_id = 'gsa-careers-resumes'
  AND public.gsa_careers_is_admin_actor()
);

CREATE OR REPLACE FUNCTION public.gsa_public_submit_career_application(p_payload jsonb)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_application_id uuid := gen_random_uuid();
  v_protocol text;
  v_existing public.gsa_careers_applications%ROWTYPE;
  v_document text;
  v_name text;
  v_email text;
  v_phone text;
  v_area text;
  v_type text;
  v_salary numeric(12,2);
  v_linkedin text;
  v_notes text;
  v_resume_name text;
  v_resume_mime text;
  v_resume_size bigint;
  v_resume_path text;
  v_safe_name text;
BEGIN
  IF p_payload IS NULL OR jsonb_typeof(p_payload) <> 'object' THEN
    RAISE EXCEPTION 'Payload invalido' USING ERRCODE = '22023';
  END IF;

  v_name := trim(COALESCE(p_payload->>'candidate_name', ''));
  v_document := regexp_replace(COALESCE(p_payload->>'document', ''), '[^0-9]', '', 'g');
  v_email := lower(trim(COALESCE(p_payload->>'email', '')));
  v_phone := regexp_replace(COALESCE(p_payload->>'phone', ''), '[^0-9]', '', 'g');
  v_area := trim(COALESCE(p_payload->>'desired_area', ''));
  v_type := lower(trim(COALESCE(p_payload->>'employment_type', '')));
  v_linkedin := nullif(trim(COALESCE(p_payload->>'linkedin_url', '')), '');
  v_notes := nullif(trim(COALESCE(p_payload->>'notes', '')), '');
  v_resume_name := nullif(trim(COALESCE(p_payload->>'resume_file_name', '')), '');
  v_resume_mime := lower(nullif(trim(COALESCE(p_payload->>'resume_mime_type', '')), ''));
  v_resume_size := NULLIF(COALESCE(p_payload->>'resume_size', ''), '')::bigint;

  IF length(v_name) < 3 OR length(v_name) > 160 THEN
    RAISE EXCEPTION 'Nome completo invalido' USING ERRCODE = '22023';
  END IF;
  IF NOT public.gsa_careers_validate_cpf(v_document) THEN
    RAISE EXCEPTION 'CPF invalido' USING ERRCODE = '22023';
  END IF;
  IF v_email !~* '^[^@\s]+@[^@\s]+\.[^@\s]+$' OR length(v_email) > 200 THEN
    RAISE EXCEPTION 'Email invalido' USING ERRCODE = '22023';
  END IF;
  IF length(v_phone) NOT BETWEEN 10 AND 13 THEN
    RAISE EXCEPTION 'Telefone invalido' USING ERRCODE = '22023';
  END IF;
  IF v_area NOT IN (
    'Comercial & Vendas',
    'Tecnologia & Desenvolvimento',
    'Operações & Logística',
    'Suporte & Relacionamento',
    'Financeiro & Administração'
  ) THEN
    RAISE EXCEPTION 'Area de interesse invalida' USING ERRCODE = '22023';
  END IF;
  IF v_type NOT IN ('clt', 'estagio') THEN
    RAISE EXCEPTION 'Modalidade invalida' USING ERRCODE = '22023';
  END IF;
  IF v_linkedin IS NOT NULL AND v_linkedin !~* '^https?://' THEN
    RAISE EXCEPTION 'URL do LinkedIn invalida' USING ERRCODE = '22023';
  END IF;
  IF length(COALESCE(v_notes, '')) > 4000 THEN
    RAISE EXCEPTION 'Mensagem muito extensa' USING ERRCODE = '22023';
  END IF;

  IF NULLIF(COALESCE(p_payload->>'salary_expectation', ''), '') IS NOT NULL THEN
    BEGIN
      v_salary := (p_payload->>'salary_expectation')::numeric;
    EXCEPTION WHEN OTHERS THEN
      RAISE EXCEPTION 'Pretensao salarial invalida' USING ERRCODE = '22023';
    END;
    IF v_salary < 0 OR v_salary > 99999999.99 THEN
      RAISE EXCEPTION 'Pretensao salarial fora do limite' USING ERRCODE = '22023';
    END IF;
  END IF;

  IF v_resume_name IS NOT NULL THEN
    IF v_resume_size IS NULL OR v_resume_size <= 0 OR v_resume_size > 10485760 THEN
      RAISE EXCEPTION 'Curriculo deve possuir no maximo 10 MB' USING ERRCODE = '22023';
    END IF;
    IF v_resume_mime NOT IN (
      'application/pdf',
      'application/msword',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'image/jpeg',
      'image/png',
      'image/webp'
    ) THEN
      RAISE EXCEPTION 'Formato de curriculo nao permitido' USING ERRCODE = '22023';
    END IF;
  END IF;

  PERFORM pg_advisory_xact_lock(hashtextextended(v_document || '|' || lower(v_area), 0));

  SELECT *
  INTO v_existing
  FROM public.gsa_careers_applications
  WHERE document = v_document
    AND lower(desired_area) = lower(v_area)
    AND status IN ('received', 'under_review', 'interview_scheduled', 'approved', 'talent_pool')
    AND created_at >= now() - interval '180 days'
  ORDER BY created_at DESC
  LIMIT 1;

  IF FOUND THEN
    RETURN jsonb_build_object(
      'success', true,
      'already_exists', true,
      'protocol', v_existing.protocol,
      'id', v_existing.id,
      'resume_upload_path', CASE
        WHEN v_resume_name IS NOT NULL AND v_existing.resume_uploaded_at IS NULL
          THEN v_existing.resume_storage_path
        ELSE NULL
      END
    );
  END IF;

  IF v_resume_name IS NOT NULL THEN
    v_safe_name := regexp_replace(
      regexp_replace(lower(v_resume_name), '[^a-z0-9._-]+', '_', 'g'),
      '^[_\.]+|[_\.]+$', '', 'g'
    );
    IF v_safe_name = '' THEN v_safe_name := 'curriculo'; END IF;
    v_safe_name := right(v_safe_name, 120);
    v_resume_path := 'applications/' || v_application_id::text || '/' ||
      encode(gen_random_bytes(16), 'hex') || '-' || v_safe_name;
  END IF;

  v_protocol := 'RH-' || to_char(current_date, 'YYYYMMDD') || '-' ||
    upper(substr(encode(gen_random_bytes(6), 'hex'), 1, 10));

  INSERT INTO public.gsa_careers_applications (
    id,
    protocol,
    candidate_name,
    document,
    email,
    phone,
    desired_area,
    employment_type,
    salary_expectation,
    resume_url,
    resume_storage_path,
    linkedin_url,
    notes,
    status,
    public_message,
    status_changed_at
  ) VALUES (
    v_application_id,
    v_protocol,
    v_name,
    v_document,
    v_email,
    v_phone,
    v_area,
    v_type,
    v_salary,
    NULL,
    v_resume_path,
    v_linkedin,
    v_notes,
    'received',
    'Candidatura recebida. A equipe de Recursos Humanos fará a análise inicial do perfil.',
    now()
  );

  INSERT INTO public.gsa_careers_application_history (
    application_id, from_status, to_status, actor_type, actor_name, note
  ) VALUES (
    v_application_id, NULL, 'received', 'candidate', v_name, 'Candidatura enviada pelo portal público.'
  );

  RETURN jsonb_build_object(
    'success', true,
    'already_exists', false,
    'protocol', v_protocol,
    'id', v_application_id,
    'resume_upload_path', v_resume_path
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.gsa_public_confirm_career_resume(
  p_protocol text,
  p_document text,
  p_storage_path text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, storage, pg_temp
AS $$
DECLARE
  v_application_id uuid;
BEGIN
  SELECT application.id
  INTO v_application_id
  FROM public.gsa_careers_applications application
  WHERE upper(application.protocol) = upper(trim(p_protocol))
    AND application.document = regexp_replace(COALESCE(p_document, ''), '[^0-9]', '', 'g')
    AND application.resume_storage_path = p_storage_path
  LIMIT 1;

  IF v_application_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'code', 'application_not_found');
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM storage.objects object
    WHERE object.bucket_id = 'gsa-careers-resumes'
      AND object.name = p_storage_path
  ) THEN
    RETURN jsonb_build_object('success', false, 'code', 'resume_not_uploaded');
  END IF;

  UPDATE public.gsa_careers_applications
  SET resume_uploaded_at = COALESCE(resume_uploaded_at, now()),
      updated_at = now()
  WHERE id = v_application_id;

  RETURN jsonb_build_object('success', true);
END;
$$;

CREATE OR REPLACE FUNCTION public.gsa_public_get_career_application(
  p_protocol text,
  p_document text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_application jsonb;
  v_protocol text := upper(trim(COALESCE(p_protocol, '')));
  v_document text := regexp_replace(COALESCE(p_document, ''), '[^0-9]', '', 'g');
BEGIN
  IF v_protocol !~ '^RH-[0-9]{8}-[A-Z0-9]{6,12}$' OR NOT public.gsa_careers_validate_cpf(v_document) THEN
    RETURN jsonb_build_object('success', false, 'code', 'invalid_query');
  END IF;

  SELECT to_jsonb(result)
  INTO v_application
  FROM (
    SELECT
      application.protocol,
      application.candidate_name,
      application.desired_area,
      application.employment_type,
      application.status,
      application.created_at,
      application.updated_at,
      application.status_changed_at,
      application.interview_at,
      application.interview_location,
      application.public_message
    FROM public.gsa_careers_applications application
    WHERE upper(application.protocol) = v_protocol
      AND application.document = v_document
    LIMIT 1
  ) result;

  IF v_application IS NULL THEN
    RETURN jsonb_build_object('success', false, 'code', 'not_found');
  END IF;

  RETURN jsonb_build_object('success', true, 'application', v_application);
END;
$$;

CREATE OR REPLACE FUNCTION public.gsa_admin_list_career_applications(
  p_sessao_id uuid,
  p_session_token text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_context jsonb;
  v_result jsonb;
BEGIN
  v_context := public.gsa_careers_admin_context(p_sessao_id, p_session_token);

  SELECT COALESCE(jsonb_agg(to_jsonb(result) ORDER BY result.created_at DESC), '[]'::jsonb)
  INTO v_result
  FROM (
    SELECT
      application.id,
      application.protocol,
      application.candidate_name,
      application.document,
      application.email,
      application.phone,
      application.desired_area,
      application.employment_type,
      application.salary_expectation,
      application.linkedin_url,
      application.notes,
      application.status,
      application.internal_notes,
      application.public_message,
      application.interview_at,
      application.interview_location,
      application.created_at,
      application.updated_at,
      application.status_changed_at,
      application.closed_at,
      application.resume_uploaded_at IS NOT NULL OR application.resume_url IS NOT NULL AS has_resume,
      application.resume_uploaded_at IS NOT NULL AS resume_in_storage
    FROM public.gsa_careers_applications application
  ) result;

  RETURN v_result;
END;
$$;

CREATE OR REPLACE FUNCTION public.gsa_admin_get_career_application(
  p_sessao_id uuid,
  p_session_token text,
  p_application_id uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_context jsonb;
  v_application jsonb;
  v_history jsonb;
BEGIN
  v_context := public.gsa_careers_admin_context(p_sessao_id, p_session_token);

  SELECT to_jsonb(result)
  INTO v_application
  FROM (
    SELECT
      application.id,
      application.protocol,
      application.candidate_name,
      application.document,
      application.email,
      application.phone,
      application.desired_area,
      application.employment_type,
      application.salary_expectation,
      application.linkedin_url,
      application.notes,
      application.status,
      application.internal_notes,
      application.public_message,
      application.interview_at,
      application.interview_location,
      application.created_at,
      application.updated_at,
      application.status_changed_at,
      application.closed_at,
      application.resume_uploaded_at IS NOT NULL OR application.resume_url IS NOT NULL AS has_resume,
      application.resume_uploaded_at IS NOT NULL AS resume_in_storage
    FROM public.gsa_careers_applications application
    WHERE application.id = p_application_id
  ) result;

  IF v_application IS NULL THEN
    RAISE EXCEPTION 'Candidatura nao encontrada' USING ERRCODE = 'P0002';
  END IF;

  SELECT COALESCE(jsonb_agg(to_jsonb(history) ORDER BY history.created_at DESC), '[]'::jsonb)
  INTO v_history
  FROM (
    SELECT
      item.id,
      item.from_status,
      item.to_status,
      item.actor_type,
      item.actor_id,
      item.actor_name,
      item.note,
      item.interview_at,
      item.interview_location,
      item.created_at
    FROM public.gsa_careers_application_history item
    WHERE item.application_id = p_application_id
  ) history;

  RETURN jsonb_build_object(
    'success', true,
    'application', v_application,
    'history', v_history
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.gsa_admin_get_career_resume_reference(
  p_sessao_id uuid,
  p_session_token text,
  p_application_id uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_context jsonb;
  v_storage_path text;
  v_legacy_reference text;
BEGIN
  v_context := public.gsa_careers_admin_context(p_sessao_id, p_session_token);

  SELECT
    CASE WHEN application.resume_uploaded_at IS NOT NULL THEN application.resume_storage_path ELSE NULL END,
    application.resume_url
  INTO v_storage_path, v_legacy_reference
  FROM public.gsa_careers_applications application
  WHERE application.id = p_application_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Candidatura nao encontrada' USING ERRCODE = 'P0002';
  END IF;

  RETURN jsonb_build_object(
    'success', true,
    'storage_path', v_storage_path,
    'legacy_reference', v_legacy_reference
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.gsa_admin_update_career_application(
  p_sessao_id uuid,
  p_session_token text,
  p_application_id uuid,
  p_status text,
  p_internal_notes text DEFAULT NULL,
  p_interview_at timestamptz DEFAULT NULL,
  p_interview_location text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_context jsonb;
  v_application public.gsa_careers_applications%ROWTYPE;
  v_new_status text := lower(trim(COALESCE(p_status, '')));
  v_actor_type text;
  v_actor_id uuid;
  v_actor_name text;
  v_public_message text;
BEGIN
  v_context := public.gsa_careers_admin_context(p_sessao_id, p_session_token);
  v_actor_type := COALESCE(v_context->>'actor_type', v_context->>'ator_tipo');
  v_actor_name := COALESCE(v_context->>'actor_name', v_context->>'ator_nome', 'Administrador');
  BEGIN
    v_actor_id := COALESCE(v_context->>'actor_id', v_context->>'ator_id')::uuid;
  EXCEPTION WHEN OTHERS THEN
    v_actor_id := NULL;
  END;

  IF v_new_status NOT IN ('received', 'under_review', 'interview_scheduled', 'approved', 'talent_pool', 'rejected') THEN
    RAISE EXCEPTION 'Status invalido' USING ERRCODE = '22023';
  END IF;

  SELECT * INTO v_application
  FROM public.gsa_careers_applications
  WHERE id = p_application_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Candidatura nao encontrada' USING ERRCODE = 'P0002';
  END IF;

  IF v_new_status <> v_application.status AND NOT (
    (v_application.status = 'received' AND v_new_status IN ('under_review', 'talent_pool', 'rejected')) OR
    (v_application.status = 'under_review' AND v_new_status IN ('interview_scheduled', 'approved', 'talent_pool', 'rejected')) OR
    (v_application.status = 'interview_scheduled' AND v_new_status IN ('under_review', 'approved', 'talent_pool', 'rejected')) OR
    (v_application.status = 'talent_pool' AND v_new_status IN ('under_review', 'interview_scheduled', 'rejected')) OR
    (v_application.status = 'rejected' AND v_new_status = 'under_review') OR
    (v_application.status = 'approved' AND v_new_status = 'under_review')
  ) THEN
    RAISE EXCEPTION 'Transicao de status nao permitida: % para %', v_application.status, v_new_status
      USING ERRCODE = '22023';
  END IF;

  IF v_new_status = 'interview_scheduled' THEN
    IF p_interview_at IS NULL OR trim(COALESCE(p_interview_location, '')) = '' THEN
      RAISE EXCEPTION 'Data e local/link da entrevista sao obrigatorios' USING ERRCODE = '22023';
    END IF;
  END IF;

  IF v_new_status = 'rejected' AND trim(COALESCE(p_internal_notes, '')) = '' THEN
    RAISE EXCEPTION 'O motivo interno do encerramento e obrigatorio' USING ERRCODE = '22023';
  END IF;

  v_public_message := CASE v_new_status
    WHEN 'received' THEN 'Candidatura recebida. A equipe de Recursos Humanos fará a análise inicial do perfil.'
    WHEN 'under_review' THEN 'Seu perfil está em análise pela equipe de Recursos Humanos.'
    WHEN 'interview_scheduled' THEN 'Você avançou para a etapa de entrevista. Consulte os dados de agendamento abaixo.'
    WHEN 'approved' THEN 'Você foi aprovado no processo seletivo. A equipe de Recursos Humanos entrará em contato para os próximos procedimentos.'
    WHEN 'talent_pool' THEN 'Seu perfil foi incluído em nosso Banco de Talentos para futuras oportunidades compatíveis.'
    WHEN 'rejected' THEN 'Este processo seletivo foi encerrado. Agradecemos seu interesse em fazer parte do Grupo GSA.'
  END;

  UPDATE public.gsa_careers_applications
  SET status = v_new_status,
      internal_notes = nullif(trim(COALESCE(p_internal_notes, '')), ''),
      public_message = v_public_message,
      interview_at = CASE WHEN v_new_status = 'interview_scheduled' THEN p_interview_at ELSE interview_at END,
      interview_location = CASE WHEN v_new_status = 'interview_scheduled' THEN trim(p_interview_location) ELSE interview_location END,
      status_changed_at = CASE WHEN v_new_status <> v_application.status THEN now() ELSE status_changed_at END,
      closed_at = CASE WHEN v_new_status IN ('approved', 'rejected') THEN now() ELSE NULL END,
      updated_at = now()
  WHERE id = p_application_id;

  IF v_new_status <> v_application.status THEN
    INSERT INTO public.gsa_careers_application_history (
      application_id,
      from_status,
      to_status,
      actor_type,
      actor_id,
      actor_name,
      note,
      interview_at,
      interview_location
    ) VALUES (
      p_application_id,
      v_application.status,
      v_new_status,
      v_actor_type,
      v_actor_id,
      v_actor_name,
      nullif(trim(COALESCE(p_internal_notes, '')), ''),
      CASE WHEN v_new_status = 'interview_scheduled' THEN p_interview_at ELSE NULL END,
      CASE WHEN v_new_status = 'interview_scheduled' THEN trim(p_interview_location) ELSE NULL END
    );
  END IF;

  RETURN public.gsa_admin_get_career_application(
    p_sessao_id,
    p_session_token,
    p_application_id
  );
END;
$$;

REVOKE ALL ON FUNCTION public.gsa_careers_validate_cpf(text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.gsa_careers_admin_context(uuid, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.gsa_careers_resume_path_is_expected(text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.gsa_careers_is_admin_actor() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.gsa_public_submit_career_application(jsonb) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.gsa_public_confirm_career_resume(text, text, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.gsa_public_get_career_application(text, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.gsa_admin_list_career_applications(uuid, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.gsa_admin_get_career_application(uuid, text, uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.gsa_admin_get_career_resume_reference(uuid, text, uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.gsa_admin_update_career_application(uuid, text, uuid, text, text, timestamptz, text) FROM PUBLIC;

GRANT EXECUTE ON FUNCTION public.gsa_careers_validate_cpf(text) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.gsa_careers_resume_path_is_expected(text) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.gsa_careers_is_admin_actor() TO authenticated;
GRANT EXECUTE ON FUNCTION public.gsa_public_submit_career_application(jsonb) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.gsa_public_confirm_career_resume(text, text, text) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.gsa_public_get_career_application(text, text) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.gsa_admin_list_career_applications(uuid, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.gsa_admin_get_career_application(uuid, text, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.gsa_admin_get_career_resume_reference(uuid, text, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.gsa_admin_update_career_application(uuid, text, uuid, text, text, timestamptz, text) TO authenticated;

COMMIT;
