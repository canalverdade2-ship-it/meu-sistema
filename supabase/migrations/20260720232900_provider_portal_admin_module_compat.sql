-- Compatibilidade autônoma para bancos que ainda não receberam a função administrativa por módulos.

BEGIN;

CREATE OR REPLACE FUNCTION public.gsa_admin_has_module(p_module text)
RETURNS boolean
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_claims jsonb := COALESCE(auth.jwt(), '{}'::jsonb);
  v_actor_type text := COALESCE(v_claims -> 'app_metadata' ->> 'gsa_actor_type', '');
  v_actor_id_text text := COALESCE(v_claims -> 'app_metadata' ->> 'gsa_actor_id', '');
  v_actor_id uuid;
  v_collaborator jsonb;
  v_modules jsonb := '[]'::jsonb;
  v_aliases text[];
BEGIN
  IF v_actor_type = 'admin' THEN
    RETURN true;
  END IF;

  IF v_actor_type <> 'colaborador' OR v_actor_id_text = '' OR to_regclass('public.colaboradores') IS NULL THEN
    RETURN false;
  END IF;

  BEGIN
    v_actor_id := v_actor_id_text::uuid;
  EXCEPTION WHEN invalid_text_representation THEN
    RETURN false;
  END;

  EXECUTE 'SELECT to_jsonb(c) FROM public.colaboradores c WHERE c.id = $1 LIMIT 1'
    INTO v_collaborator
    USING v_actor_id;

  IF v_collaborator IS NULL
     OR COALESCE(v_collaborator ->> 'status', 'ativo') IN ('bloqueado', 'inativo', 'excluido', 'desligado') THEN
    RETURN false;
  END IF;

  v_modules := COALESCE(v_collaborator -> 'modulos', '[]'::jsonb);
  IF jsonb_typeof(v_modules) <> 'array' THEN
    v_modules := '[]'::jsonb;
  END IF;

  v_aliases := CASE lower(COALESCE(p_module, ''))
    WHEN 'cadastro' THEN ARRAY['cadastro', 'prestadores', 'clientes']
    WHEN 'operacoes' THEN ARRAY['operacoes', 'vendas', 'demandas']
    WHEN 'atendimento' THEN ARRAY['atendimento', 'tickets', 'suporte']
    WHEN 'financeiro' THEN ARRAY['financeiro', 'cobranca', 'fiscal']
    ELSE ARRAY[lower(COALESCE(p_module, ''))]
  END;

  RETURN EXISTS (
    SELECT 1
    FROM jsonb_array_elements_text(v_modules) AS granted(value)
    WHERE lower(granted.value) = ANY(v_aliases)
  );
END;
$$;

REVOKE ALL ON FUNCTION public.gsa_admin_has_module(text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.gsa_admin_has_module(text) TO authenticated;

COMMIT;
