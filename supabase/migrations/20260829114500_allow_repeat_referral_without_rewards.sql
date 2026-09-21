BEGIN;

DO $$
DECLARE v_def text;
BEGIN
  SELECT pg_get_functiondef('public.gsa_public_register_client(text,jsonb)'::regprocedure) INTO v_def;

  -- A indicacao repetida continua sendo localizada, consumida e auditada.
  -- Somente a elegibilidade financeira e retirada.
  v_def := replace(v_def,
    'IF EXISTS (SELECT 1 FROM public.clientes_identidades_historicas h WHERE h.documento = v_doc OR h.telefone = v_phone) THEN v_is_default := true; END IF; v_codigo := public.gsa_generate_code(''CLI'');',
    'v_codigo := public.gsa_generate_code(''CLI'');');

  v_def := replace(v_def,
    'IF v_reward_type IN (''pontos'', ''ambos'') AND coalesce(v_reward_points, 0) > 0 THEN',
    'IF v_reward_type IN (''pontos'', ''ambos'') AND coalesce(v_reward_points, 0) > 0 AND NOT EXISTS (SELECT 1 FROM public.clientes c WHERE c.id = v_cliente_id AND c.inelegivel_nova_indicacao) THEN');
  EXECUTE v_def;
END;
$$;

COMMIT;
