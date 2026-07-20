BEGIN;

CREATE OR REPLACE FUNCTION pg_temp.make_cpf(p_seed integer)
RETURNS text
LANGUAGE plpgsql
AS $$
DECLARE
  v_base text := lpad((100000000 + (abs(p_seed) % 899999999))::text, 9, '0');
  v_sum integer := 0;
  v_d1 integer;
  v_d2 integer;
  i integer;
BEGIN
  FOR i IN 1..9 LOOP v_sum := v_sum + substr(v_base, i, 1)::integer * (11 - i); END LOOP;
  v_d1 := (v_sum * 10) % 11; IF v_d1 = 10 THEN v_d1 := 0; END IF;
  v_sum := 0;
  FOR i IN 1..10 LOOP
    v_sum := v_sum + substr(v_base || v_d1::text, i, 1)::integer * (12 - i);
  END LOOP;
  v_d2 := (v_sum * 10) % 11; IF v_d2 = 10 THEN v_d2 := 0; END IF;
  RETURN v_base || v_d1::text || v_d2::text;
END;
$$;

CREATE OR REPLACE FUNCTION pg_temp.make_cnpj(p_seed integer)
RETURNS text
LANGUAGE plpgsql
AS $$
DECLARE
  v_base text := '98' || lpad((100000 + (abs(p_seed) % 899999))::text, 6, '0') || '0001';
  v_w1 integer[] := ARRAY[5,4,3,2,9,8,7,6,5,4,3,2];
  v_w2 integer[] := ARRAY[6,5,4,3,2,9,8,7,6,5,4,3,2];
  v_sum integer := 0;
  v_d1 integer;
  v_d2 integer;
  i integer;
BEGIN
  FOR i IN 1..12 LOOP v_sum := v_sum + substr(v_base, i, 1)::integer * v_w1[i]; END LOOP;
  v_d1 := CASE WHEN v_sum % 11 < 2 THEN 0 ELSE 11 - (v_sum % 11) END;
  v_sum := 0;
  FOR i IN 1..13 LOOP
    v_sum := v_sum + substr(v_base || v_d1::text, i, 1)::integer * v_w2[i];
  END LOOP;
  v_d2 := CASE WHEN v_sum % 11 < 2 THEN 0 ELSE 11 - (v_sum % 11) END;
  RETURN v_base || v_d1::text || v_d2::text;
END;
$$;

DO $$
DECLARE
  v_suffix text := substr(replace(gen_random_uuid()::text, '-', ''), 1, 10);
  v_indicator_id uuid;
  v_indicacao_id uuid;
  v_ref_phone text := '1198' || lpad((floor(random() * 10000000))::integer::text, 7, '0');
  v_default_phone text := '1197' || lpad((floor(random() * 10000000))::integer::text, 7, '0');
  v_provider_phone text := '1196' || lpad((floor(random() * 10000000))::integer::text, 7, '0');
  v_cpf_indicator text := pg_temp.make_cpf(810001 + floor(random() * 100000)::integer);
  v_cpf_ref text := pg_temp.make_cpf(710001 + floor(random() * 100000)::integer);
  v_cpf_default text := pg_temp.make_cpf(610001 + floor(random() * 100000)::integer);
  v_cnpj text := pg_temp.make_cnpj(510001 + floor(random() * 100000)::integer);
  v_lookup jsonb;
  v_ref_result jsonb;
  v_default_result jsonb;
  v_provider_result jsonb;
  v_budget1 jsonb;
  v_budget2 jsonb;
  v_points integer;
  v_count integer;
BEGIN
  IF NOT public.gsa_is_valid_cpf(v_cpf_indicator)
     OR NOT public.gsa_is_valid_cpf(v_cpf_ref)
     OR NOT public.gsa_is_valid_cpf(v_cpf_default)
     OR NOT public.gsa_is_valid_cnpj(v_cnpj) THEN
    RAISE EXCEPTION 'Gerador de documentos de teste invalido.';
  END IF;

  INSERT INTO public.system_settings(key, value) VALUES
    ('codigo_cadastro_padrao_ativo', 'true'),
    ('codigo_cadastro_padrao', 'GSA-VALIDACAO'),
    ('indicado_recompensa_tipo', 'pontos'),
    ('indicado_valor_pontos', '50')
  ON CONFLICT (key) DO UPDATE SET value = excluded.value;

  INSERT INTO public.clientes(codigo_cliente, nome, cpf, tipo_pessoa, telefone, status)
  VALUES ('CLI-TEST-' || v_suffix, 'Indicador Validacao', v_cpf_indicator, 'pf',
          '1195' || lpad((floor(random() * 10000000))::integer::text, 7, '0'), 'ativo')
  RETURNING id INTO v_indicator_id;

  INSERT INTO public.indicacoes(indicador_id, indicado_nome, whatsapp_indicado, data_indicacao, status)
  VALUES (v_indicator_id, 'Cliente Indicado Validacao', v_ref_phone, current_date, 'aberta')
  RETURNING id INTO v_indicacao_id;

  v_lookup := public.gsa_public_lookup_referral(v_ref_phone);
  IF NOT coalesce((v_lookup->>'valid')::boolean, false)
     OR v_lookup->>'kind' <> 'referral'
     OR (v_lookup->>'indicacao_id')::uuid <> v_indicacao_id THEN
    RAISE EXCEPTION 'Consulta segura de indicacao falhou: %', v_lookup;
  END IF;

  v_ref_result := public.gsa_public_register_client(v_ref_phone, jsonb_build_object(
    'tipo_pessoa', 'pf', 'cpf', v_cpf_ref,
    'nome', 'Cliente Indicado Validacao', 'email', 'indicado.' || v_suffix || '@example.com',
    'telefone', v_ref_phone, 'cep', '12948110', 'numero', '100',
    'endereco', 'Rua de Validacao', 'bairro', 'Centro', 'cidade', 'Atibaia', 'estado', 'SP'
  ));
  IF v_ref_result->>'status' <> 'ativo' THEN RAISE EXCEPTION 'Cadastro indicado nao foi ativado: %', v_ref_result; END IF;
  IF NOT EXISTS (
    SELECT 1 FROM public.clientes
     WHERE id = (v_ref_result->>'cliente_id')::uuid
       AND indicacao_origem_id = v_indicacao_id
       AND cadastro_aprovado = true
  ) THEN RAISE EXCEPTION 'Vinculo do cadastro indicado nao foi persistido.'; END IF;
  IF NOT EXISTS (
    SELECT 1 FROM public.indicacoes WHERE id = v_indicacao_id AND data_cadastro_indicado IS NOT NULL
  ) THEN RAISE EXCEPTION 'Indicacao nao foi marcada como cadastrada.'; END IF;
  SELECT saldo_pontos INTO v_points FROM public.clientes WHERE id = (v_ref_result->>'cliente_id')::uuid;
  IF v_points <> 50 THEN RAISE EXCEPTION 'Pontos de indicacao incorretos: %', v_points; END IF;

  v_lookup := public.gsa_public_lookup_referral('GSA-VALIDACAO');
  IF NOT coalesce((v_lookup->>'valid')::boolean, false) OR v_lookup->>'kind' <> 'default' THEN
    RAISE EXCEPTION 'Consulta do codigo padrao falhou: %', v_lookup;
  END IF;

  v_default_result := public.gsa_public_register_client('GSA-VALIDACAO', jsonb_build_object(
    'tipo_pessoa', 'pf', 'cpf', v_cpf_default,
    'nome', 'Cliente Padrao Validacao', 'email', 'padrao.' || v_suffix || '@example.com',
    'telefone', v_default_phone, 'cep', '12948110', 'numero', '101',
    'endereco', 'Rua de Validacao', 'bairro', 'Centro', 'cidade', 'Atibaia', 'estado', 'SP'
  ));
  IF v_default_result->>'status' <> 'pendente' THEN RAISE EXCEPTION 'Cadastro padrao nao ficou pendente: %', v_default_result; END IF;
  IF NOT EXISTS (
    SELECT 1 FROM public.clientes
     WHERE id = (v_default_result->>'cliente_id')::uuid
       AND status = 'inativo' AND cadastro_aprovado = false
       AND carteira_bloqueada = true AND pontos_bloqueados = true
  ) THEN RAISE EXCEPTION 'Travas do cadastro padrao nao foram aplicadas.'; END IF;

  v_provider_result := public.gsa_public_register_provider(jsonb_build_object(
    'tipo_cadastro', 'cnpj', 'documento', v_cnpj,
    'nome_razao', 'Prestador Validacao Ltda', 'nome_responsavel', 'Responsavel Validacao',
    'email', 'prestador.' || v_suffix || '@example.com', 'telefone', v_provider_phone,
    'cep', '12948110', 'numero', '102', 'area_servico', 'Tecnologia'
  ));
  IF v_provider_result->>'status' <> 'pendente' THEN RAISE EXCEPTION 'Pre-cadastro de prestador falhou: %', v_provider_result; END IF;

  v_budget1 := public.gsa_public_create_enterprise_budget(jsonb_build_object(
    'nome', 'Empresa Validacao', 'email', 'orcamento.' || v_suffix || '@example.com',
    'telefone', '1194' || lpad((floor(random() * 10000000))::integer::text, 7, '0'),
    'tipo', 'Sistemas de gestão',
    'solicitacao', 'Precisamos de um sistema completo para validar processos internos.'
  ));
  v_budget2 := public.gsa_public_create_enterprise_budget(jsonb_build_object(
    'nome', 'Empresa Validacao', 'email', 'orcamento.' || v_suffix || '@example.com',
    'telefone', (SELECT contato_publico->>'telefone' FROM public.orcamentos WHERE id = (v_budget1->>'orcamento_id')::uuid),
    'tipo', 'Sistemas de gestão',
    'solicitacao', 'Precisamos de um sistema completo para validar processos internos.'
  ));
  IF coalesce((v_budget1->>'already_exists')::boolean, true) THEN RAISE EXCEPTION 'Primeiro orcamento foi tratado como duplicado.'; END IF;
  IF NOT coalesce((v_budget2->>'already_exists')::boolean, false)
     OR v_budget2->>'orcamento_id' <> v_budget1->>'orcamento_id' THEN
    RAISE EXCEPTION 'Idempotencia do orcamento publico falhou: %, %', v_budget1, v_budget2;
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM public.orcamentos
     WHERE id = (v_budget1->>'orcamento_id')::uuid
       AND cliente_id IS NULL AND status = 'aberto' AND contato_publico IS NOT NULL
  ) THEN RAISE EXCEPTION 'Orcamento publico nao foi persistido corretamente.'; END IF;

  SELECT count(*) INTO v_count
    FROM public.notificacoes
   WHERE acao_origem IN ('cadastro_cliente', 'cadastro_prestador', 'orcamento_criado')
     AND (
       contexto->>'cliente_id' IN (v_ref_result->>'cliente_id', v_default_result->>'cliente_id')
       OR contexto->>'prestador_id' = v_provider_result->>'prestador_id'
       OR contexto->>'orcamento_id' = v_budget1->>'orcamento_id'
     );
  IF v_count < 4 THEN RAISE EXCEPTION 'Notificacoes transacionais insuficientes: %', v_count; END IF;
END;
$$;

ROLLBACK;
