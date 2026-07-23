BEGIN;

CREATE OR REPLACE FUNCTION public.gsa_public_validate_advertising_protocol(p_protocol text)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_request jsonb;
BEGIN
  IF p_protocol IS NULL OR length(trim(p_protocol)) NOT BETWEEN 8 AND 50 THEN
    RETURN jsonb_build_object('success', false);
  END IF;

  SELECT jsonb_build_object(
    'id', r.id,
    'protocol', r.protocol,
    'company_name', r.company_name,
    'document', r.document,
    'contact_name', r.contact_name,
    'contact_email', r.contact_email,
    'contact_phone', r.contact_phone,
    'status', r.status
  )
  INTO v_request
  FROM public.gsa_ad_requests r
  WHERE upper(r.protocol) = upper(trim(p_protocol))
    AND r.status NOT IN ('rejected', 'cancelled')
  LIMIT 1;

  IF v_request IS NULL THEN
    RETURN jsonb_build_object('success', false);
  END IF;
  RETURN jsonb_build_object('success', true, 'request', v_request);
END;
$$;

CREATE OR REPLACE FUNCTION public.gsa_ads_claim_protocol_for_user(p_protocol text, p_auth_user_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth, pg_temp
AS $$
DECLARE
  v_request public.gsa_ad_requests;
  v_user_email text;
  v_advertiser public.gsa_advertisers;
BEGIN
  IF p_auth_user_id IS NULL THEN
    RAISE EXCEPTION 'Usuario invalido' USING ERRCODE = '22023';
  END IF;

  SELECT lower(email) INTO v_user_email FROM auth.users WHERE id = p_auth_user_id;
  IF v_user_email IS NULL THEN
    RAISE EXCEPTION 'Usuario nao encontrado' USING ERRCODE = 'P0002';
  END IF;

  SELECT * INTO v_request
  FROM public.gsa_ad_requests
  WHERE upper(protocol) = upper(trim(p_protocol))
    AND status NOT IN ('rejected', 'cancelled')
  FOR UPDATE;

  IF v_request.id IS NULL THEN
    RAISE EXCEPTION 'Protocolo nao encontrado' USING ERRCODE = 'P0002';
  END IF;
  IF lower(v_request.contact_email) <> v_user_email THEN
    RAISE EXCEPTION 'Email nao corresponde ao protocolo' USING ERRCODE = '42501';
  END IF;

  IF v_request.advertiser_id IS NOT NULL THEN
    SELECT * INTO v_advertiser FROM public.gsa_advertisers WHERE id = v_request.advertiser_id FOR UPDATE;
  ELSE
    SELECT * INTO v_advertiser
    FROM public.gsa_advertisers
    WHERE regexp_replace(document, '[^0-9]', '', 'g') = regexp_replace(v_request.document, '[^0-9]', '', 'g')
    LIMIT 1
    FOR UPDATE;
  END IF;

  IF v_advertiser.id IS NULL THEN
    INSERT INTO public.gsa_advertisers(
      auth_user_id, legal_name, trade_name, document, company_size, segment, website,
      responsible_name, responsible_email, responsible_phone, status, invited_at, last_access_at
    ) VALUES (
      p_auth_user_id, v_request.company_name, v_request.company_name, v_request.document,
      v_request.company_size, v_request.segment, v_request.website, v_request.contact_name,
      lower(v_request.contact_email), v_request.contact_phone, 'active', now(), now()
    ) RETURNING * INTO v_advertiser;
  ELSE
    IF v_advertiser.auth_user_id IS NOT NULL AND v_advertiser.auth_user_id <> p_auth_user_id THEN
      RAISE EXCEPTION 'Protocolo ja vinculado a outra conta' USING ERRCODE = '42501';
    END IF;

    UPDATE public.gsa_advertisers
       SET auth_user_id = p_auth_user_id,
           legal_name = v_request.company_name,
           trade_name = COALESCE(NULLIF(trade_name, ''), v_request.company_name),
           company_size = v_request.company_size,
           segment = v_request.segment,
           website = COALESCE(v_request.website, website),
           responsible_name = v_request.contact_name,
           responsible_email = lower(v_request.contact_email),
           responsible_phone = v_request.contact_phone,
           status = 'active',
           invited_at = COALESCE(invited_at, now()),
           last_access_at = now()
     WHERE id = v_advertiser.id
     RETURNING * INTO v_advertiser;
  END IF;

  UPDATE public.gsa_ad_requests SET advertiser_id = v_advertiser.id WHERE id = v_request.id;

  INSERT INTO public.gsa_ad_audit_logs(actor_type, actor_id, action, entity_type, entity_id, details)
  VALUES ('advertiser', v_advertiser.id, 'CLAIM_PROTOCOL', 'ad_request', v_request.id,
          jsonb_build_object('auth_user_id', p_auth_user_id));

  RETURN jsonb_build_object('success', true, 'advertiser_id', v_advertiser.id, 'request_id', v_request.id);
END;
$$;

CREATE OR REPLACE FUNCTION public.gsa_advertiser_update_profile(p_payload jsonb)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_advertiser_id uuid := public.gsa_current_advertiser_id();
  v_advertiser public.gsa_advertisers;
  v_company text;
  v_contact text;
  v_email text;
  v_phone text;
  v_document text;
  v_auth_email text := lower(COALESCE(auth.jwt()->>'email', ''));
BEGIN
  IF v_advertiser_id IS NULL THEN
    RAISE EXCEPTION 'Conta de anunciante indisponivel' USING ERRCODE = '42501';
  END IF;
  IF p_payload IS NULL OR jsonb_typeof(p_payload) <> 'object' OR pg_column_size(p_payload) > 8192 THEN
    RAISE EXCEPTION 'Perfil invalido' USING ERRCODE = '22023';
  END IF;

  SELECT * INTO v_advertiser FROM public.gsa_advertisers WHERE id = v_advertiser_id FOR UPDATE;
  v_company := trim(COALESCE(p_payload->>'company_name', ''));
  v_contact := trim(COALESCE(p_payload->>'contact_name', ''));
  v_email := lower(trim(COALESCE(p_payload->>'contact_email', '')));
  v_phone := regexp_replace(COALESCE(p_payload->>'contact_phone', ''), '[^0-9]', '', 'g');
  v_document := regexp_replace(COALESCE(p_payload->>'document', ''), '[^0-9]', '', 'g');

  IF length(v_company) NOT BETWEEN 2 AND 180
     OR length(v_contact) NOT BETWEEN 2 AND 160
     OR length(v_phone) NOT BETWEEN 10 AND 15
     OR v_email <> v_auth_email
     OR v_document <> regexp_replace(v_advertiser.document, '[^0-9]', '', 'g') THEN
    RAISE EXCEPTION 'Dados do perfil invalidos ou imutaveis' USING ERRCODE = '22023';
  END IF;

  UPDATE public.gsa_advertisers
     SET legal_name = v_company,
         trade_name = CASE WHEN trade_name IS NULL OR trade_name = legal_name THEN v_company ELSE trade_name END,
         responsible_name = v_contact,
         responsible_email = v_email,
         responsible_phone = v_phone,
         last_access_at = now()
   WHERE id = v_advertiser_id;

  INSERT INTO public.gsa_ad_audit_logs(actor_type, actor_id, action, entity_type, entity_id, details)
  VALUES ('advertiser', v_advertiser_id, 'UPDATE_PROFILE', 'advertiser', v_advertiser_id,
          jsonb_build_object('email', v_email));

  RETURN jsonb_build_object('success', true, 'advertiser_id', v_advertiser_id);
END;
$$;

REVOKE ALL ON FUNCTION public.gsa_public_validate_advertising_protocol(text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.gsa_public_validate_advertising_protocol(text) TO service_role;
REVOKE ALL ON FUNCTION public.gsa_ads_claim_protocol_for_user(text,uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.gsa_ads_claim_protocol_for_user(text,uuid) TO service_role;
REVOKE ALL ON FUNCTION public.gsa_advertiser_update_profile(jsonb) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.gsa_advertiser_update_profile(jsonb) TO authenticated, service_role;

REVOKE ALL ON FUNCTION public.gsa_advertiser_portal_snapshot() FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.gsa_advertiser_counter_proposal(uuid,numeric,text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.gsa_advertiser_reject_proposal(uuid,text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.gsa_advertiser_accept_proposal(uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.gsa_advertiser_save_creative(uuid,uuid,text,text,text,text,text,text,integer,integer,numeric) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.gsa_advertiser_submit_creative(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.gsa_advertiser_portal_snapshot() TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.gsa_advertiser_counter_proposal(uuid,numeric,text) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.gsa_advertiser_reject_proposal(uuid,text) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.gsa_advertiser_accept_proposal(uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.gsa_advertiser_save_creative(uuid,uuid,text,text,text,text,text,text,integer,integer,numeric) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.gsa_advertiser_submit_creative(uuid) TO authenticated, service_role;

COMMIT;
