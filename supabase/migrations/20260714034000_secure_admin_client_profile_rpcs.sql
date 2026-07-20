CREATE OR REPLACE FUNCTION public.gsa_admin_alterar_status_cliente(
  p_sessao_id uuid,
  p_session_token text,
  p_cliente_id uuid,
  p_status text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_actor record;
  v_status text := nullif(trim(coalesce(p_status, '')), '');
BEGIN
  IF v_status NOT IN ('ativo', 'inativo') THEN
    RAISE EXCEPTION 'Status invalido.';
  END IF;

  SELECT * INTO v_actor
  FROM public.gsa_admin_session_actor(p_sessao_id, p_session_token)
  LIMIT 1;

  IF NOT EXISTS (SELECT 1 FROM public.clientes WHERE id = p_cliente_id FOR UPDATE) THEN
    RAISE EXCEPTION 'Cliente nao encontrado.';
  END IF;

  UPDATE public.clientes
     SET status = v_status,
         cadastro_aprovado = CASE WHEN v_status = 'ativo' THEN true ELSE cadastro_aprovado END,
         updated_at = now()
   WHERE id = p_cliente_id;

  RETURN jsonb_build_object(
    'success', true,
    'cliente_id', p_cliente_id,
    'status', v_status,
    'patch', jsonb_build_object(
      'status', v_status,
      'cadastro_aprovado', CASE WHEN v_status = 'ativo' THEN true ELSE NULL END
    ),
    'ator_nome', v_actor.ator_nome
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.gsa_admin_desbloquear_pin_cliente(
  p_sessao_id uuid,
  p_session_token text,
  p_cliente_id uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_actor record;
BEGIN
  SELECT * INTO v_actor
  FROM public.gsa_admin_session_actor(p_sessao_id, p_session_token)
  LIMIT 1;

  IF NOT EXISTS (SELECT 1 FROM public.clientes WHERE id = p_cliente_id FOR UPDATE) THEN
    RAISE EXCEPTION 'Cliente nao encontrado.';
  END IF;

  UPDATE public.clientes
     SET pin_bloqueado = false,
         pin_tentativas = 0,
         updated_at = now()
   WHERE id = p_cliente_id;

  RETURN jsonb_build_object(
    'success', true,
    'cliente_id', p_cliente_id,
    'patch', jsonb_build_object('pin_bloqueado', false, 'pin_tentativas', 0),
    'ator_nome', v_actor.ator_nome
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.gsa_admin_atualizar_dados_cliente(
  p_sessao_id uuid,
  p_session_token text,
  p_cliente_id uuid,
  p_patch jsonb
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_actor record;
  v_patch jsonb := coalesce(p_patch, '{}'::jsonb);
  v_allowed text[] := ARRAY[
    'nome', 'email', 'telefone', 'cpf', 'cnpj', 'tipo_pessoa',
    'data_nascimento', 'cep', 'endereco', 'numero', 'bairro',
    'cidade', 'estado', 'observacoes'
  ];
  v_key text;
  v_clean jsonb := '{}'::jsonb;
BEGIN
  SELECT * INTO v_actor
  FROM public.gsa_admin_session_actor(p_sessao_id, p_session_token)
  LIMIT 1;

  IF NOT EXISTS (SELECT 1 FROM public.clientes WHERE id = p_cliente_id FOR UPDATE) THEN
    RAISE EXCEPTION 'Cliente nao encontrado.';
  END IF;

  FOR v_key IN SELECT jsonb_object_keys(v_patch)
  LOOP
    IF NOT (v_key = ANY(v_allowed)) THEN
      RAISE EXCEPTION 'Campo nao permitido para edicao de cliente: %', v_key;
    END IF;
    v_clean := jsonb_set(v_clean, ARRAY[v_key], v_patch -> v_key, true);
  END LOOP;

  UPDATE public.clientes
     SET nome = coalesce(v_clean->>'nome', nome),
         email = CASE WHEN v_clean ? 'email' THEN nullif(v_clean->>'email', '') ELSE email END,
         telefone = CASE WHEN v_clean ? 'telefone' THEN nullif(v_clean->>'telefone', '') ELSE telefone END,
         cpf = CASE WHEN v_clean ? 'cpf' THEN nullif(v_clean->>'cpf', '') ELSE cpf END,
         cnpj = CASE WHEN v_clean ? 'cnpj' THEN nullif(v_clean->>'cnpj', '') ELSE cnpj END,
         tipo_pessoa = CASE WHEN v_clean ? 'tipo_pessoa' THEN nullif(v_clean->>'tipo_pessoa', '') ELSE tipo_pessoa END,
         data_nascimento = CASE WHEN v_clean ? 'data_nascimento' AND nullif(v_clean->>'data_nascimento', '') IS NOT NULL THEN (v_clean->>'data_nascimento')::date WHEN v_clean ? 'data_nascimento' THEN NULL ELSE data_nascimento END,
         cep = CASE WHEN v_clean ? 'cep' THEN nullif(v_clean->>'cep', '') ELSE cep END,
         endereco = CASE WHEN v_clean ? 'endereco' THEN nullif(v_clean->>'endereco', '') ELSE endereco END,
         numero = CASE WHEN v_clean ? 'numero' THEN nullif(v_clean->>'numero', '') ELSE numero END,
         bairro = CASE WHEN v_clean ? 'bairro' THEN nullif(v_clean->>'bairro', '') ELSE bairro END,
         cidade = CASE WHEN v_clean ? 'cidade' THEN nullif(v_clean->>'cidade', '') ELSE cidade END,
         estado = CASE WHEN v_clean ? 'estado' THEN nullif(v_clean->>'estado', '') ELSE estado END,
         observacoes = CASE WHEN v_clean ? 'observacoes' THEN nullif(v_clean->>'observacoes', '') ELSE observacoes END,
         updated_at = now()
   WHERE id = p_cliente_id;

  RETURN jsonb_build_object(
    'success', true,
    'cliente_id', p_cliente_id,
    'patch', v_clean,
    'ator_nome', v_actor.ator_nome
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.gsa_admin_alterar_status_cliente(uuid, text, uuid, text) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.gsa_admin_desbloquear_pin_cliente(uuid, text, uuid) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.gsa_admin_atualizar_dados_cliente(uuid, text, uuid, jsonb) TO anon, authenticated;
