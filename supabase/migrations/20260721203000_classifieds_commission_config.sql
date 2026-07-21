-- Configuração real de comissões do módulo Classificados.
-- Percentual inicial uniforme de 5%, editável apenas por operação administrativa segura.

BEGIN;

CREATE TABLE IF NOT EXISTS public.classificados_comissoes_config (
  categoria text PRIMARY KEY,
  percentual numeric(5,2) NOT NULL,
  ativo boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT classificados_comissoes_config_categoria_check
    CHECK (categoria IN ('imoveis', 'veiculos', 'geral')),
  CONSTRAINT classificados_comissoes_config_percentual_check
    CHECK (percentual > 0 AND percentual <= 100)
);

INSERT INTO public.classificados_comissoes_config (categoria, percentual, ativo)
VALUES
  ('imoveis', 5.00, true),
  ('veiculos', 5.00, true),
  ('geral', 5.00, true)
ON CONFLICT (categoria) DO NOTHING;

CREATE OR REPLACE FUNCTION public.gsa_touch_classified_commission_config()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public, pg_temp
AS $$
BEGIN
  NEW.updated_at := now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_gsa_touch_classified_commission_config
  ON public.classificados_comissoes_config;
CREATE TRIGGER trg_gsa_touch_classified_commission_config
BEFORE UPDATE ON public.classificados_comissoes_config
FOR EACH ROW
EXECUTE FUNCTION public.gsa_touch_classified_commission_config();

ALTER TABLE public.classificados_comissoes_config ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS classificados_comissoes_config_leitura_autenticada
  ON public.classificados_comissoes_config;
CREATE POLICY classificados_comissoes_config_leitura_autenticada
ON public.classificados_comissoes_config
FOR SELECT
TO authenticated
USING (ativo = true);

REVOKE ALL ON TABLE public.classificados_comissoes_config FROM PUBLIC, anon, authenticated;
GRANT SELECT ON TABLE public.classificados_comissoes_config TO authenticated;
GRANT ALL ON TABLE public.classificados_comissoes_config TO service_role;

CREATE OR REPLACE FUNCTION public.gsa_admin_update_classified_commission(
  p_categoria text,
  p_percentual numeric,
  p_ativo boolean DEFAULT true
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_context jsonb;
  v_actor_type text;
  v_categoria text := lower(trim(COALESCE(p_categoria, '')));
BEGIN
  IF v_categoria NOT IN ('imoveis', 'veiculos', 'geral') THEN
    RAISE EXCEPTION 'Categoria de Classificados inválida.' USING ERRCODE = '22023';
  END IF;

  IF p_percentual IS NULL OR p_percentual <= 0 OR p_percentual > 100 THEN
    RAISE EXCEPTION 'O percentual deve ser maior que zero e menor ou igual a 100.' USING ERRCODE = '22023';
  END IF;

  v_context := public.gsa_admin_context();
  v_actor_type := COALESCE(v_context ->> 'actor_type', '');

  IF v_actor_type = 'colaborador'
     AND NOT COALESCE(public.gsa_admin_has_module('classificados'), false) THEN
    RAISE EXCEPTION 'Sem permissão para alterar comissões dos Classificados.' USING ERRCODE = '42501';
  END IF;

  IF v_actor_type NOT IN ('admin', 'colaborador') THEN
    RAISE EXCEPTION 'Sessão administrativa obrigatória.' USING ERRCODE = '42501';
  END IF;

  INSERT INTO public.classificados_comissoes_config (
    categoria, percentual, ativo, created_at, updated_at
  ) VALUES (
    v_categoria, round(p_percentual, 2), COALESCE(p_ativo, true), now(), now()
  )
  ON CONFLICT (categoria) DO UPDATE
  SET percentual = EXCLUDED.percentual,
      ativo = EXCLUDED.ativo,
      updated_at = now();

  RETURN jsonb_build_object(
    'success', true,
    'categoria', v_categoria,
    'percentual', round(p_percentual, 2),
    'ativo', COALESCE(p_ativo, true)
  );
END;
$$;

REVOKE ALL ON FUNCTION public.gsa_admin_update_classified_commission(text, numeric, boolean)
  FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.gsa_admin_update_classified_commission(text, numeric, boolean)
  TO authenticated, service_role;

-- Solicita ao PostgREST que atualize o cache do schema imediatamente.
NOTIFY pgrst, 'reload schema';

COMMIT;
