BEGIN;

-- Alguns ambientes ainda não receberam o hardening administrativo que cria
-- gsa_admin_has_module(text). As políticas do prestador precisam funcionar
-- nesses ambientes sem substituir uma implementação administrativa já existente.
DO $outer$
BEGIN
  IF to_regprocedure('public.gsa_admin_has_module(text)') IS NULL THEN
    EXECUTE $function$
      CREATE FUNCTION public.gsa_admin_has_module(p_module text)
      RETURNS boolean
      LANGUAGE plpgsql
      STABLE
      SECURITY DEFINER
      SET search_path = public, pg_temp
      AS $body$
      DECLARE
        v_actor_type text := COALESCE(auth.jwt() -> 'app_metadata' ->> 'gsa_actor_type', '');
        v_actor_id_text text := COALESCE(auth.jwt() -> 'app_metadata' ->> 'gsa_actor_id', '');
        v_actor_id uuid;
        v_modules jsonb;
        v_aliases text[];
      BEGIN
        IF v_actor_type = 'admin' THEN
          RETURN true;
        END IF;
        IF v_actor_type <> 'colaborador' OR v_actor_id_text = '' THEN
          RETURN false;
        END IF;

        BEGIN
          v_actor_id := v_actor_id_text::uuid;
        EXCEPTION WHEN invalid_text_representation THEN
          RETURN false;
        END;

        SELECT COALESCE(to_jsonb(c) -> 'modulos', '[]'::jsonb)
          INTO v_modules
          FROM public.colaboradores c
         WHERE c.id = v_actor_id
           AND COALESCE(to_jsonb(c) ->> 'status', 'ativo') NOT IN ('bloqueado', 'inativo', 'excluido')
         LIMIT 1;

        IF v_modules IS NULL OR jsonb_typeof(v_modules) <> 'array' THEN
          RETURN false;
        END IF;

        v_aliases := CASE p_module
          WHEN 'cadastro' THEN ARRAY['cadastro', 'prestadores', 'clientes']
          WHEN 'atendimento' THEN ARRAY['atendimento', 'tickets', 'suporte']
          WHEN 'operacoes' THEN ARRAY['operacoes', 'vendas', 'demandas']
          ELSE ARRAY[p_module]
        END;

        RETURN EXISTS (
          SELECT 1
            FROM jsonb_array_elements_text(v_modules) AS granted(value)
           WHERE granted.value = ANY(v_aliases)
        );
      END;
      $body$;
    $function$;
  END IF;
END;
$outer$;

GRANT EXECUTE ON FUNCTION public.gsa_admin_has_module(text) TO authenticated;

COMMIT;
