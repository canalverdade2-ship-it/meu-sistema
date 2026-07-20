-- Migration for Product URL Import Authorization
CREATE OR REPLACE FUNCTION public.gsa_admin_authorize_product_url_import(
  p_sessao_id uuid,
  p_session_token text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_actor record;
BEGIN
  -- Validate session
  SELECT * INTO v_actor
  FROM public.gsa_admin_session_actor(p_sessao_id, p_session_token)
  LIMIT 1;

  IF v_actor.ator_tipo = 'colaborador' THEN
    IF NOT EXISTS (
      SELECT 1
      FROM public.colaborador_modulos cm
      WHERE cm.colaborador_id = v_actor.ator_id
        AND cm.modulo_id IN ('produtos', 'catálogo', 'catalogo')
    ) THEN
      RAISE EXCEPTION 'Acesso negado: colaborador sem permissão para gerenciar produtos.';
    END IF;
  END IF;

  RETURN jsonb_build_object(
    'ator_tipo', v_actor.ator_tipo,
    'ator_id', v_actor.ator_id,
    'ator_nome', v_actor.ator_nome
  );
END;
$$;

REVOKE EXECUTE ON FUNCTION public.gsa_admin_authorize_product_url_import(uuid, text) FROM public, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.gsa_admin_authorize_product_url_import(uuid, text) TO service_role;
