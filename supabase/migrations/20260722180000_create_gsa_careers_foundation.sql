BEGIN;

CREATE TABLE IF NOT EXISTS public.gsa_careers_applications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  protocol text UNIQUE NOT NULL,
  candidate_name text NOT NULL,
  document text NOT NULL,
  email text NOT NULL,
  phone text NOT NULL,
  desired_area text NOT NULL,
  employment_type text NOT NULL CHECK (employment_type IN ('clt', 'estagio')),
  salary_expectation numeric(12,2),
  resume_url text,
  linkedin_url text,
  notes text,
  status text NOT NULL DEFAULT 'received' CHECK (status IN ('received', 'under_review', 'interview_scheduled', 'approved', 'talent_pool', 'rejected')),
  internal_notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS gsa_careers_applications_protocol_idx ON public.gsa_careers_applications(protocol);
CREATE INDEX IF NOT EXISTS gsa_careers_applications_doc_idx ON public.gsa_careers_applications(document);
CREATE INDEX IF NOT EXISTS gsa_careers_applications_email_idx ON public.gsa_careers_applications(email);
CREATE INDEX IF NOT EXISTS gsa_careers_applications_status_idx ON public.gsa_careers_applications(status);

ALTER TABLE public.gsa_careers_applications ENABLE ROW LEVEL SECURITY;

CREATE POLICY gsa_careers_admin_all ON public.gsa_careers_applications
  FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);

CREATE OR REPLACE FUNCTION public.gsa_public_submit_career_application(p_payload jsonb)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_protocol text;
  v_app_id uuid;
  v_doc text;
  v_name text;
  v_email text;
  v_phone text;
  v_area text;
  v_type text;
  v_salary numeric(12,2);
  v_resume text;
  v_linkedin text;
  v_notes text;
BEGIN
  IF p_payload IS NULL OR jsonb_typeof(p_payload) <> 'object' THEN
    RAISE EXCEPTION 'Payload invalido' USING ERRCODE = '22023';
  END IF;

  v_name := trim(COALESCE(p_payload->>'candidate_name', ''));
  v_doc := regexp_replace(COALESCE(p_payload->>'document', ''), '[^0-9]', '', 'g');
  v_email := lower(trim(COALESCE(p_payload->>'email', '')));
  v_phone := regexp_replace(COALESCE(p_payload->>'phone', ''), '[^0-9]', '', 'g');
  v_area := trim(COALESCE(p_payload->>'desired_area', 'Geral'));
  v_type := lower(trim(COALESCE(p_payload->>'employment_type', 'clt')));
  v_resume := nullif(trim(COALESCE(p_payload->>'resume_url', '')), '');
  v_linkedin := nullif(trim(COALESCE(p_payload->>'linkedin_url', '')), '');
  v_notes := nullif(trim(COALESCE(p_payload->>'notes', '')), '');

  IF p_payload->>'salary_expectation' IS NOT NULL AND p_payload->>'salary_expectation' <> '' THEN
    BEGIN
      v_salary := (p_payload->>'salary_expectation')::numeric;
    EXCEPTION WHEN OTHERS THEN
      v_salary := NULL;
    END;
  END IF;

  IF length(v_name) < 2 OR length(v_doc) < 11 OR v_email !~* '^[^@\s]+@[^@\s]+\.[^@\s]+$' OR length(v_phone) < 10 THEN
    RAISE EXCEPTION 'Dados obrigatorios invalidos' USING ERRCODE = '22023';
  END IF;

  IF v_type NOT IN ('clt', 'estagio') THEN
    v_type := 'clt';
  END IF;

  v_protocol := 'RH-' || to_char(current_date, 'YYYYMMDD') || '-' || upper(substr(encode(gen_random_bytes(4), 'hex'), 1, 8));

  INSERT INTO public.gsa_careers_applications (
    protocol, candidate_name, document, email, phone, desired_area,
    employment_type, salary_expectation, resume_url, linkedin_url, notes
  ) VALUES (
    v_protocol, v_name, v_doc, v_email, v_phone, v_area,
    v_type, v_salary, v_resume, v_linkedin, v_notes
  ) RETURNING id INTO v_app_id;

  RETURN jsonb_build_object(
    'success', true,
    'protocol', v_protocol,
    'id', v_app_id
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.gsa_public_submit_career_application(jsonb) TO anon, authenticated;

COMMIT;
