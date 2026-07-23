BEGIN;

-- Remove políticas antigas antes de instalar a regra canônica por ator.
DO $$
DECLARE
  v_policy record;
BEGIN
  FOR v_policy IN
    SELECT schemaname, tablename, policyname
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename IN ('loja_carrinhos', 'promocoes_quantidade_ativadas')
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON %I.%I', v_policy.policyname, v_policy.schemaname, v_policy.tablename);
  END LOOP;
END;
$$;

ALTER TABLE public.loja_carrinhos ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.loja_carrinhos FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.loja_carrinhos TO authenticated;

CREATE POLICY gsa_client_cart_select ON public.loja_carrinhos
FOR SELECT TO authenticated
USING (
  (auth.jwt() -> 'app_metadata' ->> 'gsa_actor_type') = 'cliente'
  AND cliente_id::text = (auth.jwt() -> 'app_metadata' ->> 'gsa_actor_id')
);
CREATE POLICY gsa_client_cart_insert ON public.loja_carrinhos
FOR INSERT TO authenticated
WITH CHECK (
  (auth.jwt() -> 'app_metadata' ->> 'gsa_actor_type') = 'cliente'
  AND cliente_id::text = (auth.jwt() -> 'app_metadata' ->> 'gsa_actor_id')
);
CREATE POLICY gsa_client_cart_update ON public.loja_carrinhos
FOR UPDATE TO authenticated
USING (
  (auth.jwt() -> 'app_metadata' ->> 'gsa_actor_type') = 'cliente'
  AND cliente_id::text = (auth.jwt() -> 'app_metadata' ->> 'gsa_actor_id')
)
WITH CHECK (
  (auth.jwt() -> 'app_metadata' ->> 'gsa_actor_type') = 'cliente'
  AND cliente_id::text = (auth.jwt() -> 'app_metadata' ->> 'gsa_actor_id')
);
CREATE POLICY gsa_client_cart_delete ON public.loja_carrinhos
FOR DELETE TO authenticated
USING (
  (auth.jwt() -> 'app_metadata' ->> 'gsa_actor_type') = 'cliente'
  AND cliente_id::text = (auth.jwt() -> 'app_metadata' ->> 'gsa_actor_id')
);

ALTER TABLE public.promocoes_quantidade_ativadas ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.promocoes_quantidade_ativadas FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.promocoes_quantidade_ativadas TO authenticated;

CREATE POLICY gsa_client_quantity_promotions_select ON public.promocoes_quantidade_ativadas
FOR SELECT TO authenticated
USING (
  (auth.jwt() -> 'app_metadata' ->> 'gsa_actor_type') = 'cliente'
  AND cliente_id::text = (auth.jwt() -> 'app_metadata' ->> 'gsa_actor_id')
);
CREATE POLICY gsa_client_quantity_promotions_insert ON public.promocoes_quantidade_ativadas
FOR INSERT TO authenticated
WITH CHECK (
  (auth.jwt() -> 'app_metadata' ->> 'gsa_actor_type') = 'cliente'
  AND cliente_id::text = (auth.jwt() -> 'app_metadata' ->> 'gsa_actor_id')
);
CREATE POLICY gsa_client_quantity_promotions_update ON public.promocoes_quantidade_ativadas
FOR UPDATE TO authenticated
USING (
  (auth.jwt() -> 'app_metadata' ->> 'gsa_actor_type') = 'cliente'
  AND cliente_id::text = (auth.jwt() -> 'app_metadata' ->> 'gsa_actor_id')
)
WITH CHECK (
  (auth.jwt() -> 'app_metadata' ->> 'gsa_actor_type') = 'cliente'
  AND cliente_id::text = (auth.jwt() -> 'app_metadata' ->> 'gsa_actor_id')
);
CREATE POLICY gsa_client_quantity_promotions_delete ON public.promocoes_quantidade_ativadas
FOR DELETE TO authenticated
USING (
  (auth.jwt() -> 'app_metadata' ->> 'gsa_actor_type') = 'cliente'
  AND cliente_id::text = (auth.jwt() -> 'app_metadata' ->> 'gsa_actor_id')
);

-- Repetir a adesão atualiza dados, mas nunca remove suspensão administrativa.
CREATE OR REPLACE FUNCTION public.gsa_client_join_affiliate(
  p_sessao_id uuid,
  p_session_token text,
  p_nome_divulgacao text,
  p_pix_tipo text,
  p_pix_chave text,
  p_termos_versao text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_cliente_id uuid;
  v_id uuid;
BEGIN
  SELECT actor.cliente_id INTO v_cliente_id
  FROM public.gsa_client_session_actor(p_sessao_id, p_session_token) actor
  LIMIT 1;
  IF v_cliente_id IS NULL THEN RAISE EXCEPTION 'Sessão de cliente inválida.' USING ERRCODE = '42501'; END IF;
  IF length(trim(coalesce(p_nome_divulgacao, ''))) < 2 THEN RAISE EXCEPTION 'Informe o nome de divulgação.' USING ERRCODE = '22023'; END IF;
  IF p_pix_tipo NOT IN ('cpf','cnpj','email','telefone','aleatoria') OR length(trim(coalesce(p_pix_chave, ''))) < 3 THEN
    RAISE EXCEPTION 'Chave PIX inválida.' USING ERRCODE = '22023';
  END IF;
  IF length(trim(coalesce(p_termos_versao, ''))) < 1 THEN RAISE EXCEPTION 'Aceite dos termos obrigatório.' USING ERRCODE = '22023'; END IF;

  INSERT INTO public.gsa_afiliados(
    cliente_id, codigo_publico, nome_divulgacao, status,
    pix_tipo, pix_chave, termos_versao, termos_aceitos_em
  ) VALUES (
    v_cliente_id, public.gsa_affiliate_new_code('A'), trim(p_nome_divulgacao), 'ativo',
    p_pix_tipo, trim(p_pix_chave), trim(p_termos_versao), now()
  )
  ON CONFLICT (cliente_id) DO UPDATE SET
    nome_divulgacao = excluded.nome_divulgacao,
    pix_tipo = excluded.pix_tipo,
    pix_chave = excluded.pix_chave,
    status = public.gsa_afiliados.status,
    updated_at = now()
  RETURNING id INTO v_id;

  RETURN public.gsa_client_affiliate_snapshot(p_sessao_id, p_session_token);
END;
$$;

REVOKE ALL ON FUNCTION public.gsa_client_join_affiliate(uuid,text,text,text,text,text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.gsa_client_join_affiliate(uuid,text,text,text,text,text) TO authenticated;

COMMIT;
