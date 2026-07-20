CREATE OR REPLACE FUNCTION public.gsa_admin_criar_cliente(
  p_sessao_id uuid,
  p_session_token text,
  p_payload jsonb
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_actor record;
  v_payload jsonb := coalesce(p_payload, '{}'::jsonb);
  v_tipo_pessoa text := coalesce(nullif(v_payload->>'tipo_pessoa', ''), 'pf');
  v_nome text := nullif(trim(coalesce(v_payload->>'nome', '')), '');
  v_cpf text := regexp_replace(coalesce(v_payload->>'cpf', ''), '\D', '', 'g');
  v_cnpj text := regexp_replace(coalesce(v_payload->>'cnpj', ''), '\D', '', 'g');
  v_telefone text := regexp_replace(coalesce(v_payload->>'telefone', ''), '\D', '', 'g');
  v_doc text;
  v_indicacao_id uuid;
  v_cliente_id uuid;
  v_data_cadastro timestamptz := coalesce(nullif(v_payload->>'data_cadastro', '')::timestamptz, now());
  v_codigo text := 'CLI-' || right(extract(epoch from clock_timestamp())::bigint::text, 4) || lpad(floor(random() * 9000 + 1000)::int::text, 4, '0');
BEGIN
  SELECT * INTO v_actor
  FROM public.gsa_admin_session_actor(p_sessao_id, p_session_token)
  LIMIT 1;

  IF v_nome IS NULL THEN
    RAISE EXCEPTION 'Nome do cliente e obrigatorio.';
  END IF;

  IF v_tipo_pessoa NOT IN ('pf', 'pj') THEN
    RAISE EXCEPTION 'Tipo de pessoa invalido.';
  END IF;

  IF v_tipo_pessoa = 'pf' THEN
    v_doc := v_cpf;
    IF length(v_doc) <> 11 THEN
      RAISE EXCEPTION 'O CPF deve conter exatamente 11 numeros.';
    END IF;

    IF EXISTS (SELECT 1 FROM public.clientes WHERE cpf = v_doc) THEN
      RAISE EXCEPTION 'Ja existe um cadastro com este CPF no sistema.';
    END IF;
  ELSE
    v_doc := v_cnpj;
    IF length(v_doc) <> 14 THEN
      RAISE EXCEPTION 'O CNPJ deve conter exatamente 14 numeros.';
    END IF;

    IF EXISTS (SELECT 1 FROM public.clientes WHERE cnpj = v_doc) THEN
      RAISE EXCEPTION 'Ja existe um cadastro com este CNPJ no sistema.';
    END IF;
  END IF;

  IF v_telefone <> '' THEN
    SELECT id INTO v_indicacao_id
    FROM public.indicacoes
    WHERE whatsapp_indicado = v_telefone
      AND status = 'aberta'
    ORDER BY data_criacao ASC NULLS LAST
    LIMIT 1;
  END IF;

  INSERT INTO public.clientes(
    codigo_cliente,
    nome,
    email,
    cpf,
    cnpj,
    tipo_pessoa,
    telefone,
    data_nascimento,
    cep,
    endereco,
    numero,
    bairro,
    cidade,
    estado,
    observacoes,
    data_cadastro,
    status,
    indicacao_origem_id,
    bonus_boas_vindas_pendente,
    saldo_carteira,
    saldo_pontos,
    pin_tentativas,
    pin_bloqueado,
    limite_credito_total,
    limite_credito_disponivel,
    opcao_pagamento_parcelado
  )
  VALUES (
    v_codigo,
    v_nome,
    nullif(v_payload->>'email', ''),
    CASE WHEN v_tipo_pessoa = 'pf' THEN v_doc ELSE NULL END,
    CASE WHEN v_tipo_pessoa = 'pj' THEN v_doc ELSE NULL END,
    v_tipo_pessoa,
    nullif(v_telefone, ''),
    CASE WHEN nullif(v_payload->>'data_nascimento', '') IS NOT NULL THEN (v_payload->>'data_nascimento')::date ELSE NULL END,
    nullif(v_payload->>'cep', ''),
    nullif(coalesce(v_payload->>'endereco', v_payload->>'logradouro'), ''),
    nullif(v_payload->>'numero', ''),
    nullif(v_payload->>'bairro', ''),
    nullif(v_payload->>'cidade', ''),
    nullif(coalesce(v_payload->>'estado', v_payload->>'uf'), ''),
    nullif(v_payload->>'observacoes', ''),
    v_data_cadastro,
    'ativo',
    v_indicacao_id,
    v_indicacao_id IS NULL,
    0,
    0,
    0,
    false,
    0,
    0,
    false
  )
  RETURNING id INTO v_cliente_id;

  IF v_indicacao_id IS NOT NULL THEN
    UPDATE public.indicacoes
       SET data_cadastro_indicado = now()
     WHERE id = v_indicacao_id;
  END IF;

  RETURN jsonb_build_object(
    'success', true,
    'cliente_id', v_cliente_id,
    'codigo_cliente', v_codigo,
    'indicacao_id', v_indicacao_id,
    'ator_nome', v_actor.ator_nome
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.gsa_admin_criar_cliente(uuid, text, jsonb) TO anon, authenticated;
