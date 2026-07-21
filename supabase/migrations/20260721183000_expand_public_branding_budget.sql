-- Amplia o orçamento público para a jornada Marca, Presença Digital e Vendas.
-- Reutiliza as proteções existentes da rotina v2 e corrige a classificação final do orçamento.

CREATE OR REPLACE FUNCTION public.gsa_public_create_brand_budget_v1(p_payload jsonb)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_payload jsonb := coalesce(p_payload, '{}'::jsonb);
  v_type text := lower(trim(coalesce(v_payload->>'tipo', '')));
  v_label text;
  v_name text := trim(coalesce(v_payload->>'nome', ''));
  v_email text := lower(trim(coalesce(v_payload->>'email', '')));
  v_phone text := regexp_replace(coalesce(v_payload->>'telefone', ''), '\D', '', 'g');
  v_request text := trim(coalesce(v_payload->>'solicitacao', ''));
  v_forward jsonb;
  v_result jsonb;
  v_budget_id uuid;
  v_contact jsonb;
BEGIN
  v_label := CASE v_type
    WHEN 'nome_marca' THEN 'Criacao de nome e posicionamento'
    WHEN 'logo' THEN 'Criacao de logo e logomarca'
    WHEN 'identidade_visual' THEN 'Identidade visual e branding'
    WHEN 'redes_sociais' THEN 'Estruturacao de redes sociais'
    WHEN 'social_media' THEN 'Social media, posts e publicacoes'
    WHEN 'marketing_digital' THEN 'Estrategia digital e campanhas'
    WHEN 'jornada_completa' THEN 'Empresa do zero ao digital'
    ELSE NULL
  END;

  IF v_label IS NULL THEN
    RAISE EXCEPTION 'Tipo de projeto de marca invalido.' USING ERRCODE = '22023';
  END IF;

  v_forward := jsonb_set(v_payload, '{tipo}', to_jsonb('site'::text), true);
  v_forward := jsonb_set(
    v_forward,
    '{solicitacao}',
    to_jsonb(left('[Servico solicitado: ' || v_label || '] ' || v_request, 2000)),
    true
  );
  v_forward := jsonb_set(
    v_forward,
    '{metadata}',
    coalesce(v_payload->'metadata', '{}'::jsonb) || jsonb_build_object(
      'source', 'public_brand_journey',
      'requested_type', v_type,
      'requested_type_label', v_label
    ),
    true
  );

  SELECT public.gsa_public_create_enterprise_budget_v2(v_forward)
    INTO v_result;

  IF NOT coalesce((v_result->>'success')::boolean, false) THEN
    RAISE EXCEPTION 'Nao foi possivel registrar a solicitacao de marca.' USING ERRCODE = 'P0001';
  END IF;

  v_budget_id := nullif(v_result->>'budget_id', '')::uuid;
  IF v_budget_id IS NULL THEN
    RETURN v_result;
  END IF;

  SELECT coalesce(contato_publico, '{}'::jsonb)
    INTO v_contact
    FROM public.orcamentos
   WHERE id = v_budget_id
   FOR UPDATE;

  UPDATE public.orcamentos
     SET titulo_solicitacao = v_label || ' - ' || v_name,
         descricao_solicitacao = v_request,
         observacoes_servico =
           'Solicitacao publica de ' || lower(v_label) || E'\n\n' ||
           'Nome: ' || v_name || E'\nE-mail: ' || v_email || E'\nTelefone: ' || v_phone ||
           E'\nTipo solicitado: ' || v_label || E'\n\nDescricao da solicitacao:\n' || v_request,
         contato_publico = coalesce(v_contact, '{}'::jsonb) || jsonb_build_object(
           'nome', v_name,
           'email', v_email,
           'telefone', v_phone,
           'tipo', v_type,
           'tipo_label', v_label,
           'origem', 'public_brand_journey'
         )
   WHERE id = v_budget_id;

  UPDATE public.notificacoes
     SET mensagem = v_name || ' solicitou orcamento para ' || v_label || '.',
         contexto = coalesce(contexto, '{}'::jsonb) || jsonb_build_object(
           'origem', 'pagina_empresa_zero_ao_digital',
           'tipo', v_type,
           'tipo_label', v_label
         )
   WHERE item_id = v_budget_id::text
     AND acao_origem = 'orcamento_criado';

  RETURN v_result || jsonb_build_object(
    'requested_type', v_type,
    'requested_type_label', v_label
  );
END;
$$;

REVOKE ALL ON FUNCTION public.gsa_public_create_brand_budget_v1(jsonb) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.gsa_public_create_brand_budget_v1(jsonb) TO service_role;

COMMENT ON FUNCTION public.gsa_public_create_brand_budget_v1(jsonb)
IS 'Registra solicitacoes da jornada Empresa do Zero ao Digital usando as protecoes do gateway e da rotina publica v2.';
