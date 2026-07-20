-- Compatibility bridge between the current Marketplace client session and the
-- established GSA Saude schema. New installations already receive this RPC
-- from 20260718120000; the conditional protects that newer schema.

DO $migration$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'saude_cotacoes'
      AND column_name = 'tipo_pessoa'
  ) AND NOT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'saude_cotacoes'
      AND column_name = 'idempotency_key'
  ) THEN
    EXECUTE $sql$
      CREATE OR REPLACE FUNCTION public.gsa_client_saude_criar_cotacao(
        p_sessao_id uuid,
        p_session_token text,
        p_payload jsonb,
        p_idempotency_key uuid
      )
      RETURNS jsonb
      LANGUAGE plpgsql
      SECURITY DEFINER
      SET search_path = public, pg_temp
      AS $function$
      DECLARE
        v_cliente uuid;
        v_id uuid;
        v_protocolo text;
        v_categoria text;
        v_tipo_pessoa text;
        v_titulares integer;
        v_dependentes integer;
        v_quantidade_vidas integer;
        v_localidade text;
        v_cidade text;
        v_estado text;
        v_observacoes text;
        v_idades text[];
        v_idade text;
        v_indice integer := 0;
        v_payload jsonb := coalesce(p_payload, '{}'::jsonb);
      BEGIN
        SELECT sessao.ator_id
          INTO v_cliente
        FROM public.gsa_validate_session(p_sessao_id, p_session_token) AS sessao
        WHERE sessao.is_valid
          AND sessao.ator_tipo = 'cliente'
        LIMIT 1;

        IF v_cliente IS NULL THEN
          RETURN jsonb_build_object('success', false, 'error', 'Sessao de cliente invalida ou expirada.');
        END IF;

        v_categoria := replace(lower(btrim(coalesce(v_payload->>'categoria', ''))), '-', '_');
        IF v_categoria NOT IN ('individual_familiar', 'empresarial', 'odontologico') THEN
          RETURN jsonb_build_object('success', false, 'error', 'Selecione um tipo de plano valido.');
        END IF;

        IF coalesce(v_payload->>'consentimento', '') <> 'sim' THEN
          RETURN jsonb_build_object('success', false, 'error', 'Confirme a autorizacao para enviar a cotacao.');
        END IF;

        v_titulares := CASE
          WHEN coalesce(v_payload->>'titulares', '') ~ '^[0-9]+$'
            THEN greatest((v_payload->>'titulares')::integer, 0)
          ELSE 1
        END;
        v_dependentes := CASE
          WHEN coalesce(v_payload->>'dependentes', '') ~ '^[0-9]+$'
            THEN greatest((v_payload->>'dependentes')::integer, 0)
          ELSE 0
        END;
        v_quantidade_vidas := greatest(v_titulares + v_dependentes, 1);
        v_tipo_pessoa := CASE WHEN v_categoria = 'empresarial' THEN 'juridica' ELSE 'fisica' END;

        v_localidade := nullif(btrim(v_payload->>'localidade'), '');
        IF v_localidade ~* '[,/][[:space:]]*[a-z]{2}[[:space:]]*$' THEN
          v_estado := upper(substring(v_localidade FROM '([a-zA-Z]{2})[[:space:]]*$'));
          v_cidade := nullif(btrim(regexp_replace(
            v_localidade,
            '[[:space:]]*[,/][[:space:]]*[a-zA-Z]{2}[[:space:]]*$',
            '',
            'i'
          )), '');
        ELSE
          v_cidade := v_localidade;
        END IF;

        v_observacoes := nullif(concat_ws(E'\n',
          nullif(btrim(v_payload->>'observacoes'), ''),
          CASE
            WHEN nullif(v_payload->>'inicio_desejado', '') IS NOT NULL
              THEN 'Inicio desejado: ' || (v_payload->>'inicio_desejado')
          END
        ), '');

        -- Serializes retries for the same customer/category and preserves the
        -- five-minute idempotency behavior of the established health module.
        PERFORM pg_advisory_xact_lock(hashtextextended(v_cliente::text || ':' || v_categoria, 0));
        SELECT cotacao.id, cotacao.protocolo
          INTO v_id, v_protocolo
        FROM public.saude_cotacoes AS cotacao
        WHERE cotacao.cliente_id = v_cliente
          AND cotacao.categoria = v_categoria
          AND cotacao.status = 'enviada'
          AND cotacao.created_at > now() - interval '5 minutes'
        ORDER BY cotacao.created_at DESC
        LIMIT 1;

        IF v_id IS NOT NULL THEN
          RETURN jsonb_build_object(
            'success', true,
            'id', v_id,
            'protocolo', v_protocolo,
            'idempotent', true
          );
        END IF;

        v_protocolo := 'SAU-' || to_char(now(), 'YYYYMM') || '-' ||
          upper(substring(replace(gen_random_uuid()::text, '-', ''), 1, 6));

        INSERT INTO public.saude_cotacoes (
          cliente_id,
          protocolo,
          categoria,
          tipo_pessoa,
          estado,
          cidade,
          quantidade_vidas,
          observacoes,
          aceite_privacidade,
          aceite_privacidade_em,
          status,
          historico_status
        ) VALUES (
          v_cliente,
          v_protocolo,
          v_categoria,
          v_tipo_pessoa,
          v_estado,
          v_cidade,
          v_quantidade_vidas,
          v_observacoes,
          true,
          now(),
          'enviada',
          jsonb_build_array(jsonb_build_object(
            'status', 'enviada',
            'em', now()::text,
            'por', 'cliente'
          ))
        )
        RETURNING id INTO v_id;

        v_idades := regexp_split_to_array(coalesce(v_payload->>'idades', ''), '[[:space:]]*[,;][[:space:]]*');
        FOREACH v_idade IN ARRAY v_idades LOOP
          v_idade := btrim(v_idade);
          IF v_idade ~ '^[0-9]{1,3}$' AND v_idade::integer BETWEEN 0 AND 120 THEN
            v_indice := v_indice + 1;
            INSERT INTO public.saude_cotacao_beneficiarios (
              cotacao_id,
              tipo,
              faixa_etaria
            ) VALUES (
              v_id,
              CASE WHEN v_indice <= v_titulares THEN 'titular' ELSE 'dependente' END,
              v_idade
            );
          END IF;
        END LOOP;

        INSERT INTO public.saude_auditoria (
          ator_tipo,
          ator_id,
          acao,
          tabela,
          registro_id,
          detalhes
        ) VALUES (
          'cliente',
          v_cliente,
          'SUBMETER_COTACAO',
          'saude_cotacoes',
          v_id,
          jsonb_build_object(
            'protocolo', v_protocolo,
            'idempotency_key', p_idempotency_key
          )
        );

        RETURN jsonb_build_object('success', true, 'id', v_id, 'protocolo', v_protocolo);
      EXCEPTION WHEN OTHERS THEN
        RETURN jsonb_build_object(
          'success', false,
          'error', 'Nao foi possivel registrar a cotacao. Tente novamente.'
        );
      END;
      $function$
    $sql$;
  END IF;

  IF to_regprocedure('public.gsa_client_saude_criar_cotacao(uuid,text,jsonb,uuid)') IS NOT NULL THEN
    EXECUTE 'REVOKE ALL ON FUNCTION public.gsa_client_saude_criar_cotacao(uuid,text,jsonb,uuid) FROM PUBLIC';
    EXECUTE 'GRANT EXECUTE ON FUNCTION public.gsa_client_saude_criar_cotacao(uuid,text,jsonb,uuid) TO anon, authenticated';
  END IF;
END
$migration$;

NOTIFY pgrst, 'reload schema';
