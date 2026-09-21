BEGIN;

ALTER TABLE public.gsa_careers_applications
  ADD COLUMN IF NOT EXISTS privacy_consent_at timestamptz,
  ADD COLUMN IF NOT EXISTS privacy_policy_version text,
  ADD COLUMN IF NOT EXISTS retention_until timestamptz;

UPDATE public.gsa_careers_applications
   SET retention_until=coalesce(retention_until,created_at + interval '24 months')
 WHERE retention_until IS NULL;

INSERT INTO storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
VALUES(
  'gsa-careers-resumes','gsa-careers-resumes',false,10485760,
  ARRAY[
    'application/pdf','application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'image/jpeg','image/png','image/webp'
  ]
)
ON CONFLICT(id) DO UPDATE SET
  public=false,
  file_size_limit=excluded.file_size_limit,
  allowed_mime_types=excluded.allowed_mime_types;

REVOKE ALL ON public.gsa_careers_applications FROM PUBLIC,anon,authenticated;
REVOKE ALL ON public.gsa_careers_application_history FROM PUBLIC,anon,authenticated;

DROP FUNCTION IF EXISTS public.gsa_admin_update_career_application(
  uuid,text,uuid,text,text,timestamptz,text,text,text
);

DO $$
DECLARE f record;
BEGIN
  FOR f IN SELECT p.oid,p.proname,pg_get_function_identity_arguments(p.oid) args
    FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
   WHERE n.nspname='public' AND p.proname IN (
     'gsa_admin_list_career_applications','gsa_admin_get_career_application',
     'gsa_admin_get_career_resume_reference','gsa_admin_update_career_application',
     'gsa_careers_admin_context'
   )
  LOOP
    EXECUTE format('REVOKE ALL ON FUNCTION public.%I(%s) FROM PUBLIC,anon,authenticated',f.proname,f.args);
    IF f.proname<>'gsa_careers_admin_context' THEN
      EXECUTE format('GRANT EXECUTE ON FUNCTION public.%I(%s) TO authenticated',f.proname,f.args);
    END IF;
  END LOOP;
END $$;

-- Preserva a implementação validada e adiciona rate limit/consentimento na fronteira pública.
DO $$ BEGIN
  IF to_regprocedure('public.gsa_public_submit_career_application_impl(jsonb)') IS NULL THEN
    ALTER FUNCTION public.gsa_public_submit_career_application(jsonb)
      RENAME TO gsa_public_submit_career_application_impl;
  END IF;
  IF to_regprocedure('public.gsa_public_get_career_application_impl(text,text)') IS NULL THEN
    ALTER FUNCTION public.gsa_public_get_career_application(text,text)
      RENAME TO gsa_public_get_career_application_impl;
  END IF;
END $$;

CREATE OR REPLACE FUNCTION public.gsa_careers_rate_limit(
  p_scope text,p_identity text,p_limit integer,p_window interval
) RETURNS void LANGUAGE plpgsql SECURITY DEFINER
SET search_path=public,extensions,pg_temp AS $$
DECLARE v_key text; v_count integer;
BEGIN
  v_key:=encode(extensions.digest(coalesce(p_identity,'unknown'),'sha256'),'hex');
  DELETE FROM public.gsa_public_rate_limits WHERE criado_em<now()-interval '2 days';
  SELECT count(*) INTO v_count FROM public.gsa_public_rate_limits
   WHERE escopo=p_scope AND chave_hash=v_key AND criado_em>=now()-p_window;
  IF v_count>=p_limit THEN
    RAISE EXCEPTION 'Muitas tentativas. Aguarde antes de tentar novamente.' USING ERRCODE='P0001';
  END IF;
  INSERT INTO public.gsa_public_rate_limits(escopo,chave_hash,criado_em)
  VALUES(p_scope,v_key,now());
END $$;

CREATE OR REPLACE FUNCTION public.gsa_public_submit_career_application(p_payload jsonb)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE v_result jsonb; v_doc text; v_headers jsonb; v_identity text;
BEGIN
  IF coalesce((p_payload->>'privacy_consent')::boolean,false) IS NOT TRUE
     OR nullif(trim(p_payload->>'privacy_policy_version'),'') IS NULL THEN
    RAISE EXCEPTION 'Consentimento de privacidade obrigatório.' USING ERRCODE='22023';
  END IF;
  BEGIN v_headers:=coalesce(current_setting('request.headers',true),'{}')::jsonb;
  EXCEPTION WHEN OTHERS THEN v_headers:='{}'::jsonb; END;
  v_doc:=regexp_replace(coalesce(p_payload->>'document',''),'[^0-9]','','g');
  v_identity:=coalesce(v_headers->>'x-forwarded-for',v_headers->>'x-real-ip','unknown')||'|'||v_doc;
  PERFORM public.gsa_careers_rate_limit('careers_submit',v_identity,5,interval '1 hour');
  v_result:=public.gsa_public_submit_career_application_impl(p_payload);
  IF coalesce((v_result->>'already_exists')::boolean,false) THEN
    RETURN jsonb_build_object('success',false,'already_exists',true,'code','active_application_exists');
  END IF;
  UPDATE public.gsa_careers_applications
     SET privacy_consent_at=coalesce(privacy_consent_at,now()),
         privacy_policy_version=p_payload->>'privacy_policy_version',
         retention_until=coalesce(retention_until,now()+interval '24 months')
   WHERE id=(v_result->>'id')::uuid;
  RETURN v_result;
END $$;

CREATE OR REPLACE FUNCTION public.gsa_public_get_career_application(p_protocol text,p_document text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE v_headers jsonb; v_identity text;
BEGIN
  BEGIN v_headers:=coalesce(current_setting('request.headers',true),'{}')::jsonb;
  EXCEPTION WHEN OTHERS THEN v_headers:='{}'::jsonb; END;
  v_identity:=coalesce(v_headers->>'x-forwarded-for',v_headers->>'x-real-ip','unknown')||'|'||
    regexp_replace(coalesce(p_document,''),'[^0-9]','','g');
  PERFORM public.gsa_careers_rate_limit('careers_lookup',v_identity,20,interval '15 minutes');
  RETURN public.gsa_public_get_career_application_impl(p_protocol,p_document);
END $$;

REVOKE ALL ON FUNCTION public.gsa_careers_rate_limit(text,text,integer,interval) FROM PUBLIC,anon,authenticated;
REVOKE ALL ON FUNCTION public.gsa_public_submit_career_application_impl(jsonb) FROM PUBLIC,anon,authenticated;
REVOKE ALL ON FUNCTION public.gsa_public_get_career_application_impl(text,text) FROM PUBLIC,anon,authenticated;
REVOKE ALL ON FUNCTION public.gsa_public_submit_career_application(jsonb) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.gsa_public_get_career_application(text,text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.gsa_public_submit_career_application(jsonb) TO anon,authenticated;
GRANT EXECUTE ON FUNCTION public.gsa_public_get_career_application(text,text) TO anon,authenticated;

COMMIT;
