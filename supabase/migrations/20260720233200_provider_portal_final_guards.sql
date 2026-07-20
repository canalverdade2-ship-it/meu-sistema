-- Reforços finais identificados na revisão pós-build do Painel do Prestador.

BEGIN;

CREATE OR REPLACE FUNCTION public.gsa_provider_context(p_require_active boolean DEFAULT false)
RETURNS jsonb
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_claims jsonb := COALESCE(auth.jwt(), '{}'::jsonb);
  v_actor_type text := COALESCE(v_claims -> 'app_metadata' ->> 'gsa_actor_type', '');
  v_actor_id_text text := COALESCE(v_claims -> 'app_metadata' ->> 'gsa_actor_id', '');
  v_session_id text := COALESCE(v_claims -> 'app_metadata' ->> 'gsa_session_id', '');
  v_provider public.prestadores%ROWTYPE;
  v_provider_id uuid;
BEGIN
  IF auth.uid() IS NULL OR v_actor_type <> 'prestador' OR v_actor_id_text = '' OR v_session_id = '' THEN
    RAISE EXCEPTION 'Sessão segura do prestador inválida ou expirada.' USING ERRCODE = '42501';
  END IF;

  BEGIN
    v_provider_id := v_actor_id_text::uuid;
  EXCEPTION WHEN invalid_text_representation THEN
    RAISE EXCEPTION 'Identidade do prestador inválida.' USING ERRCODE = '42501';
  END;

  IF to_regclass('public.sistema_sessoes') IS NULL OR NOT EXISTS (
    SELECT 1
    FROM public.sistema_sessoes s
    WHERE COALESCE(
      to_jsonb(s) ->> 'id',
      to_jsonb(s) ->> 'sessao_id',
      to_jsonb(s) ->> 'gsa_session_id',
      ''
    ) = v_session_id
      AND COALESCE(to_jsonb(s) ->> 'ator_tipo', '') = 'prestador'
      AND COALESCE(to_jsonb(s) ->> 'ator_id', '') = v_provider_id::text
      AND COALESCE(to_jsonb(s) ->> 'status', '') NOT IN ('encerrado', 'revogado', 'expirado', 'inativo')
  ) THEN
    RAISE EXCEPTION 'A sessão GSA do prestador foi encerrada ou não é mais válida.' USING ERRCODE = '42501';
  END IF;

  SELECT * INTO v_provider
  FROM public.prestadores
  WHERE id = v_provider_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Cadastro do prestador não encontrado.' USING ERRCODE = '42501';
  END IF;

  IF COALESCE(v_provider.status, '') IN ('bloqueado', 'inativo', 'desligado') THEN
    RAISE EXCEPTION 'Acesso do prestador revogado.' USING ERRCODE = '42501';
  END IF;

  IF p_require_active AND COALESCE(v_provider.status, '') <> 'ativo' THEN
    RAISE EXCEPTION 'Esta operação exige cadastro ativo.' USING ERRCODE = '42501';
  END IF;

  PERFORM set_config('app.gsa_provider_rpc', 'on', true);

  RETURN jsonb_build_object(
    'provider_id', v_provider.id,
    'provider_name', v_provider.nome_razao,
    'status', v_provider.status,
    'session_id', v_session_id
  );
END;
$$;

ALTER FUNCTION public.gsa_provider_dashboard_snapshot() VOLATILE;
ALTER FUNCTION public.gsa_provider_pendency_snapshot() VOLATILE;

DROP TRIGGER IF EXISTS trg_guard_provider_direct_prestadores ON public.prestadores;
CREATE TRIGGER trg_guard_provider_direct_prestadores
BEFORE INSERT OR UPDATE OR DELETE ON public.prestadores
FOR EACH ROW EXECUTE FUNCTION public.gsa_guard_provider_direct_write();

CREATE OR REPLACE FUNCTION public.gsa_revoke_provider_sessions_on_access_change()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_provider_id uuid;
  v_revoke boolean := false;
BEGIN
  IF TG_OP = 'DELETE' THEN
    v_provider_id := OLD.id;
    v_revoke := true;
  ELSE
    v_provider_id := NEW.id;
    v_revoke := COALESCE(NEW.status, '') IN ('bloqueado', 'inativo', 'desligado');
  END IF;

  IF v_revoke AND to_regclass('public.sistema_sessoes') IS NOT NULL THEN
    UPDATE public.sistema_sessoes
    SET status = 'encerrado'
    WHERE ator_tipo = 'prestador'
      AND ator_id = v_provider_id
      AND status <> 'encerrado';
  END IF;

  RETURN CASE WHEN TG_OP = 'DELETE' THEN OLD ELSE NEW END;
END;
$$;

DROP TRIGGER IF EXISTS trg_gsa_revoke_provider_sessions_update ON public.prestadores;
CREATE TRIGGER trg_gsa_revoke_provider_sessions_update
AFTER UPDATE ON public.prestadores
FOR EACH ROW
WHEN (OLD.status IS DISTINCT FROM NEW.status)
EXECUTE FUNCTION public.gsa_revoke_provider_sessions_on_access_change();

DROP TRIGGER IF EXISTS trg_gsa_revoke_provider_sessions_delete ON public.prestadores;
CREATE TRIGGER trg_gsa_revoke_provider_sessions_delete
AFTER DELETE ON public.prestadores
FOR EACH ROW
EXECUTE FUNCTION public.gsa_revoke_provider_sessions_on_access_change();

REVOKE ALL ON FUNCTION public.gsa_revoke_provider_sessions_on_access_change() FROM PUBLIC, anon, authenticated;

COMMIT;
