BEGIN;

DO $$
DECLARE
  v_admin_session jsonb;
  v_client_session jsonb;
  v_client_id uuid;
  v_funcao_id uuid;
  v_ok boolean;
BEGIN
  IF has_function_privilege('anon', 'public.admin_upsert_settings(text,jsonb)', 'EXECUTE')
     OR has_function_privilege('anon', 'public.admin_delete_record(text,text,uuid)', 'EXECUTE')
     OR has_function_privilege('anon', 'public.reset_pin(uuid,text)', 'EXECUTE')
     OR has_function_privilege('anon', 'public.admin_cancelar_demanda_segura(text,uuid,uuid,text,text)', 'EXECUTE')
     OR has_function_privilege('anon', 'public.admin_cancelar_demanda_segura(text,uuid,text,text,text)', 'EXECUTE') THEN
    RAISE EXCEPTION 'Uma RPC administrativa legada continua exposta';
  END IF;

  IF EXISTS (SELECT 1 FROM public.debug_admin_rpc) THEN
    RAISE EXCEPTION 'Tabela de debug ainda contem credenciais antigas';
  END IF;
  IF has_table_privilege('anon', 'public.debug_admin_rpc', 'SELECT') THEN
    RAISE EXCEPTION 'Tabela de debug ainda pode ser lida por anon';
  END IF;

  v_admin_session := public.gsa_create_session_internal(
    'admin',
    '00000000-0000-0000-0000-000000000000'::uuid,
    'Auditoria',
    '{}'::jsonb
  );

  v_ok := public.gsa_admin_upsert_settings(
    (v_admin_session ->> 'sessao_id')::uuid,
    v_admin_session ->> 'session_token',
    '[{"key":"gsa_audit_transaction_test","value":"ok"}]'::jsonb
  );
  IF NOT v_ok OR NOT EXISTS (
    SELECT 1 FROM public.system_settings
     WHERE key = 'gsa_audit_transaction_test' AND value = 'ok'
  ) THEN
    RAISE EXCEPTION 'RPC segura de configuracoes falhou';
  END IF;

  INSERT INTO public.funcoes(nome, descricao)
  VALUES ('AUDIT_DELETE_TEST', 'Registro transacional de auditoria')
  RETURNING id INTO v_funcao_id;

  v_ok := public.gsa_admin_delete_record_secure(
    (v_admin_session ->> 'sessao_id')::uuid,
    v_admin_session ->> 'session_token',
    'funcoes',
    v_funcao_id
  );
  IF NOT v_ok OR EXISTS (SELECT 1 FROM public.funcoes WHERE id = v_funcao_id) THEN
    RAISE EXCEPTION 'Exclusao administrativa segura falhou';
  END IF;

  INSERT INTO public.clientes(nome, cpf, telefone, status, pin_hash)
  VALUES (
    'AUDITORIA PIN',
    '99999999998',
    '11999999998',
    'ativo',
    extensions.crypt('1234', extensions.gen_salt('bf', 12))
  )
  RETURNING id INTO v_client_id;

  v_client_session := public.gsa_create_session_internal(
    'cliente', v_client_id, 'AUDITORIA PIN', '{}'::jsonb
  );

  IF NOT public.gsa_verify_own_pin(
    (v_client_session ->> 'sessao_id')::uuid,
    v_client_session ->> 'session_token',
    '1234'
  ) THEN
    RAISE EXCEPTION 'Verificacao de PIN do proprio usuario falhou';
  END IF;

  IF NOT public.gsa_change_own_pin(
    (v_client_session ->> 'sessao_id')::uuid,
    v_client_session ->> 'session_token',
    '1234',
    '5678'
  ) THEN
    RAISE EXCEPTION 'Alteracao de PIN do proprio usuario falhou';
  END IF;

  IF NOT public.gsa_verify_own_pin(
    (v_client_session ->> 'sessao_id')::uuid,
    v_client_session ->> 'session_token',
    '5678'
  ) THEN
    RAISE EXCEPTION 'Novo PIN nao foi persistido';
  END IF;

  IF NOT public.gsa_admin_reset_actor_pin(
    (v_admin_session ->> 'sessao_id')::uuid,
    v_admin_session ->> 'session_token',
    v_client_id,
    'cliente'
  ) THEN
    RAISE EXCEPTION 'Reset administrativo de PIN falhou';
  END IF;
  IF EXISTS (SELECT 1 FROM public.clientes WHERE id = v_client_id AND pin_hash IS NOT NULL) THEN
    RAISE EXCEPTION 'Reset administrativo nao removeu o PIN';
  END IF;
END;
$$;

ROLLBACK;

