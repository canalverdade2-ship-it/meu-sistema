BEGIN;

CREATE TABLE IF NOT EXISTS public.gsa_admin_audit_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_type text NOT NULL,
  actor_id uuid NOT NULL,
  module text NOT NULL,
  action text NOT NULL,
  target_type text,
  target_id uuid,
  details jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.gsa_admin_notification_state (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_type text NOT NULL,
  actor_id uuid NOT NULL,
  source_table text NOT NULL,
  notification_id text NOT NULL,
  read_at timestamptz,
  dismissed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (actor_type, actor_id, source_table, notification_id)
);

ALTER TABLE public.gsa_admin_audit_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.gsa_admin_notification_state ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.gsa_admin_audit_events FROM anon, authenticated;
REVOKE ALL ON public.gsa_admin_notification_state FROM anon, authenticated;

DO $restore_functions$
BEGIN
  IF to_regprocedure('public.gsa_admin_write_audit(text,text,text,uuid,jsonb)') IS NULL THEN
    EXECUTE $function$
      CREATE FUNCTION public.gsa_admin_write_audit(
        p_module text,
        p_action text,
        p_target_type text DEFAULT NULL,
        p_target_id uuid DEFAULT NULL,
        p_details jsonb DEFAULT '{}'::jsonb
      ) RETURNS uuid
      LANGUAGE plpgsql
      SECURITY DEFINER
      SET search_path = public, pg_temp
      AS $body$
      DECLARE
        v_claims jsonb := COALESCE(auth.jwt(), '{}'::jsonb);
        v_id uuid;
      BEGIN
        INSERT INTO public.gsa_admin_audit_events(
          actor_type, actor_id, module, action, target_type, target_id, details
        ) VALUES (
          COALESCE(v_claims -> 'app_metadata' ->> 'gsa_actor_type', 'sistema'),
          COALESCE(NULLIF(v_claims -> 'app_metadata' ->> 'gsa_actor_id', '')::uuid, '00000000-0000-0000-0000-000000000000'::uuid),
          p_module, p_action, p_target_type, p_target_id, COALESCE(p_details, '{}'::jsonb)
        ) RETURNING id INTO v_id;
        RETURN v_id;
      END;
      $body$
    $function$;
  END IF;

  IF to_regprocedure('public.gsa_admin_set_notification_state(uuid,text,text,boolean,boolean)') IS NULL THEN
    EXECUTE $function$
      CREATE FUNCTION public.gsa_admin_set_notification_state(
        p_sessao_id uuid DEFAULT NULL,
        p_session_token text DEFAULT NULL,
        p_notification_id text DEFAULT NULL,
        p_read boolean DEFAULT true,
        p_dismiss boolean DEFAULT false
      ) RETURNS jsonb
      LANGUAGE plpgsql
      SECURITY DEFINER
      SET search_path = public, pg_temp
      AS $body$
      DECLARE
        v_claims jsonb := COALESCE(auth.jwt(), '{}'::jsonb);
        v_actor_type text := v_claims -> 'app_metadata' ->> 'gsa_actor_type';
        v_actor_id uuid := (v_claims -> 'app_metadata' ->> 'gsa_actor_id')::uuid;
        v_source text;
        v_original_id text;
      BEGIN
        IF p_notification_id LIKE 'admin_%' THEN
          v_source := 'admin_notificacoes';
          v_original_id := substring(p_notification_id FROM 7);
        ELSIF p_notification_id LIKE 'gen_%' THEN
          v_source := 'notificacoes';
          v_original_id := substring(p_notification_id FROM 5);
        ELSE
          RAISE EXCEPTION 'Identificador de notificação inválido.' USING ERRCODE = '22023';
        END IF;

        INSERT INTO public.gsa_admin_notification_state(
          actor_type, actor_id, source_table, notification_id,
          read_at, dismissed_at, updated_at
        ) VALUES (
          v_actor_type, v_actor_id, v_source, v_original_id,
          CASE WHEN p_read THEN now() ELSE NULL END,
          CASE WHEN p_dismiss THEN now() ELSE NULL END,
          now()
        )
        ON CONFLICT(actor_type, actor_id, source_table, notification_id)
        DO UPDATE SET
          read_at = CASE WHEN p_read THEN now() ELSE public.gsa_admin_notification_state.read_at END,
          dismissed_at = CASE WHEN p_dismiss THEN now() ELSE public.gsa_admin_notification_state.dismissed_at END,
          updated_at = now();

        RETURN jsonb_build_object('success', true);
      END;
      $body$
    $function$;
  END IF;
END;
$restore_functions$;

REVOKE ALL ON FUNCTION public.gsa_admin_write_audit(text, text, text, uuid, jsonb) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.gsa_admin_set_notification_state(uuid, text, text, boolean, boolean) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.gsa_admin_write_audit(text, text, text, uuid, jsonb) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.gsa_admin_set_notification_state(uuid, text, text, boolean, boolean) TO authenticated, service_role;

COMMIT;
