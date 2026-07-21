BEGIN;

-- A migration histórica 20260720183000 não foi aplicada integralmente em
-- produção. As funções abaixo são recriadas apenas quando ausentes, para não
-- sobrescrever uma eventual versão mais nova já instalada.

DO $restore_travel_rpcs$
BEGIN
  IF to_regprocedure('public.gsa_admin_travel_list(uuid,text,text,integer,integer,text)') IS NULL THEN
    EXECUTE $function$
      CREATE FUNCTION public.gsa_admin_travel_list(
        p_sessao_id uuid DEFAULT NULL,
        p_session_token text DEFAULT NULL,
        p_kind text DEFAULT 'solicitacoes',
        p_page integer DEFAULT 1,
        p_page_size integer DEFAULT 20,
        p_search text DEFAULT NULL
      )
      RETURNS jsonb
      LANGUAGE plpgsql
      STABLE
      SECURITY DEFINER
      SET search_path = public, pg_temp
      AS $body$
      DECLARE
        v_page integer := GREATEST(COALESCE(p_page, 1), 1);
        v_size integer := LEAST(GREATEST(COALESCE(p_page_size, 20), 1), 100);
        v_offset integer;
        v_items jsonb := '[]'::jsonb;
        v_total bigint := 0;
        v_search text := NULLIF(trim(COALESCE(p_search, '')), '');
      BEGIN
        PERFORM public.gsa_admin_assert_module('viagens');
        v_offset := (v_page - 1) * v_size;

        IF p_kind = 'solicitacoes' THEN
          SELECT count(*) INTO v_total
            FROM public.viagens_orcamentos o
           WHERE v_search IS NULL OR concat_ws(' ', o.protocolo, o.nome, o.email, o.telefone, o.origem, o.destino) ILIKE '%' || v_search || '%';

          SELECT COALESCE(jsonb_agg(to_jsonb(rows)), '[]'::jsonb) INTO v_items
            FROM (
              SELECT o.*, jsonb_build_object('titulo', p.titulo, 'preco_venda', p.preco_venda) AS viagens_pacotes
                FROM public.viagens_orcamentos o
                LEFT JOIN public.viagens_pacotes p ON p.id = o.pacote_id
               WHERE v_search IS NULL OR concat_ws(' ', o.protocolo, o.nome, o.email, o.telefone, o.origem, o.destino) ILIKE '%' || v_search || '%'
               ORDER BY o.created_at DESC
               LIMIT v_size OFFSET v_offset
            ) rows;
        ELSIF p_kind = 'pacotes' THEN
          SELECT count(*) INTO v_total
            FROM public.viagens_pacotes p
           WHERE v_search IS NULL OR concat_ws(' ', p.titulo, p.origem, p.destino, p.categoria) ILIKE '%' || v_search || '%';

          SELECT COALESCE(jsonb_agg(to_jsonb(rows)), '[]'::jsonb) INTO v_items
            FROM (
              SELECT p.*,
                     COALESCE((
                       SELECT jsonb_agg(to_jsonb(i) ORDER BY i.ordem)
                         FROM public.viagens_pacote_imagens i
                        WHERE i.pacote_id = p.id
                     ), '[]'::jsonb) AS viagens_pacote_imagens
                FROM public.viagens_pacotes p
               WHERE v_search IS NULL OR concat_ws(' ', p.titulo, p.origem, p.destino, p.categoria) ILIKE '%' || v_search || '%'
               ORDER BY p.created_at DESC
               LIMIT v_size OFFSET v_offset
            ) rows;
        ELSIF p_kind = 'propostas' THEN
          SELECT count(*) INTO v_total FROM public.viagens_propostas;
          SELECT COALESCE(jsonb_agg(to_jsonb(rows)), '[]'::jsonb) INTO v_items
            FROM (
              SELECT p.*, c.nome AS cliente_nome
                FROM public.viagens_propostas p
                LEFT JOIN public.clientes c ON c.id = p.cliente_id
               ORDER BY p.created_at DESC
               LIMIT v_size OFFSET v_offset
            ) rows;
        ELSIF p_kind = 'transacoes' THEN
          SELECT count(*) INTO v_total FROM public.viagens_transacoes;
          SELECT COALESCE(jsonb_agg(to_jsonb(rows)), '[]'::jsonb) INTO v_items
            FROM (
              SELECT t.*, c.nome AS cliente_nome
                FROM public.viagens_transacoes t
                LEFT JOIN public.clientes c ON c.id = t.cliente_id
               ORDER BY t.created_at DESC
               LIMIT v_size OFFSET v_offset
            ) rows;
        ELSE
          RAISE EXCEPTION 'Tipo de listagem inválido.' USING ERRCODE = '22023';
        END IF;

        RETURN jsonb_build_object('items', v_items, 'total', v_total, 'page', v_page, 'page_size', v_size);
      END;
      $body$
    $function$;
  END IF;

  IF to_regprocedure('public.gsa_admin_travel_link_lead(uuid,text,uuid,uuid)') IS NULL THEN
    EXECUTE $function$
      CREATE FUNCTION public.gsa_admin_travel_link_lead(
        p_sessao_id uuid DEFAULT NULL,
        p_session_token text DEFAULT NULL,
        p_quote_id uuid DEFAULT NULL,
        p_client_id uuid DEFAULT NULL
      )
      RETURNS jsonb
      LANGUAGE plpgsql
      SECURITY DEFINER
      SET search_path = public, pg_temp
      AS $body$
      BEGIN
        PERFORM public.gsa_admin_assert_module('viagens');

        IF NOT EXISTS (SELECT 1 FROM public.clientes WHERE id = p_client_id) THEN
          RAISE EXCEPTION 'Cliente não encontrado.' USING ERRCODE = 'P0002';
        END IF;

        UPDATE public.viagens_orcamentos
           SET cliente_id = p_client_id, updated_at = now()
         WHERE id = p_quote_id
           AND cliente_id IS NULL;

        IF NOT FOUND THEN
          RAISE EXCEPTION 'Orçamento não encontrado ou já vinculado.' USING ERRCODE = 'P0002';
        END IF;

        PERFORM public.gsa_admin_write_audit('viagens', 'VINCULAR_LEAD_CLIENTE', 'viagens_orcamentos', p_quote_id, jsonb_build_object('cliente_id', p_client_id));
        RETURN jsonb_build_object('success', true);
      END;
      $body$
    $function$;
  END IF;

  IF to_regprocedure('public.gsa_admin_travel_update_status(uuid,text,text,uuid,text)') IS NULL THEN
    EXECUTE $function$
      CREATE FUNCTION public.gsa_admin_travel_update_status(
        p_sessao_id uuid DEFAULT NULL,
        p_session_token text DEFAULT NULL,
        p_entity text DEFAULT NULL,
        p_id uuid DEFAULT NULL,
        p_status text DEFAULT NULL
      )
      RETURNS jsonb
      LANGUAGE plpgsql
      SECURITY DEFINER
      SET search_path = public, pg_temp
      AS $body$
      BEGIN
        PERFORM public.gsa_admin_assert_module('viagens');

        IF p_entity = 'orcamento' THEN
          IF p_status NOT IN ('recebido', 'em_analise', 'buscando_opcoes', 'propostas_disponiveis', 'aguardando_cliente', 'encerrado', 'cancelado') THEN
            RAISE EXCEPTION 'Status de orçamento inválido.' USING ERRCODE = '22023';
          END IF;
          UPDATE public.viagens_orcamentos SET status = p_status, updated_at = now() WHERE id = p_id;
        ELSIF p_entity = 'pacote' THEN
          IF p_status NOT IN ('rascunho', 'publicado', 'disponibilidade_sob_consulta', 'pausado', 'esgotado') THEN
            RAISE EXCEPTION 'Status de pacote inválido.' USING ERRCODE = '22023';
          END IF;
          UPDATE public.viagens_pacotes SET status = p_status, updated_at = now() WHERE id = p_id;
        ELSE
          RAISE EXCEPTION 'Entidade inválida.' USING ERRCODE = '22023';
        END IF;

        IF NOT FOUND THEN
          RAISE EXCEPTION 'Registro não encontrado.' USING ERRCODE = 'P0002';
        END IF;

        PERFORM public.gsa_admin_write_audit('viagens', 'ALTERAR_STATUS', p_entity, p_id, jsonb_build_object('status', p_status));
        RETURN jsonb_build_object('success', true);
      END;
      $body$
    $function$;
  END IF;

  IF to_regprocedure('public.gsa_admin_travel_create_proposal(uuid,text,uuid,text,numeric,integer,integer,integer,text)') IS NULL THEN
    EXECUTE $function$
      CREATE FUNCTION public.gsa_admin_travel_create_proposal(
        p_sessao_id uuid DEFAULT NULL,
        p_session_token text DEFAULT NULL,
        p_quote_id uuid DEFAULT NULL,
        p_title text DEFAULT NULL,
        p_total numeric DEFAULT NULL,
        p_max_installments integer DEFAULT 1,
        p_acceptance_hours integer DEFAULT 48,
        p_payment_days integer DEFAULT 2,
        p_conditions text DEFAULT NULL
      )
      RETURNS jsonb
      LANGUAGE plpgsql
      SECURITY DEFINER
      SET search_path = public, pg_temp
      AS $body$
      DECLARE
        v_quote public.viagens_orcamentos%ROWTYPE;
        v_reservation_id uuid;
        v_proposal_id uuid;
        v_snapshot jsonb;
        v_acceptance_deadline timestamptz;
        v_payment_deadline timestamptz;
      BEGIN
        PERFORM public.gsa_admin_assert_module('viagens');

        IF p_total IS NULL OR p_total <= 0 OR trim(COALESCE(p_title, '')) = '' THEN
          RAISE EXCEPTION 'Título e valor total são obrigatórios.' USING ERRCODE = '22023';
        END IF;

        SELECT * INTO v_quote
          FROM public.viagens_orcamentos
         WHERE id = p_quote_id
         FOR UPDATE;

        IF NOT FOUND OR v_quote.cliente_id IS NULL THEN
          RAISE EXCEPTION 'Orçamento não encontrado ou sem cliente vinculado.' USING ERRCODE = 'P0002';
        END IF;

        IF EXISTS (
          SELECT 1
            FROM public.viagens_solicitacoes_reserva r
            JOIN public.viagens_propostas p ON p.reserva_id = r.id
           WHERE r.snapshot_pacote ->> 'protocolo_orcamento' = v_quote.protocolo
             AND p.status IN ('enviada', 'visualizada', 'aceita')
        ) THEN
          RAISE EXCEPTION 'Já existe uma proposta ativa para este orçamento.' USING ERRCODE = '23505';
        END IF;

        v_acceptance_deadline := now() + make_interval(hours => GREATEST(COALESCE(p_acceptance_hours, 48), 1));
        v_payment_deadline := v_acceptance_deadline + make_interval(days => GREATEST(COALESCE(p_payment_days, 2), 1));
        v_snapshot := jsonb_build_object(
          'titulo', trim(p_title),
          'origem', v_quote.origem,
          'destino', v_quote.destino,
          'data_ida', v_quote.data_ida,
          'data_volta', v_quote.data_volta,
          'adultos', v_quote.adultos,
          'criancas', v_quote.criancas,
          'bebes', v_quote.bebes,
          'preferencia_hospedagem', v_quote.preferencia_hospedagem,
          'observacoes', v_quote.observacoes,
          'pacote_id', v_quote.pacote_id,
          'protocolo_orcamento', v_quote.protocolo
        );

        INSERT INTO public.viagens_solicitacoes_reserva (
          pacote_id, cliente_id, protocolo, adultos, criancas, bebes,
          snapshot_pacote, status, observacoes_cliente
        ) VALUES (
          v_quote.pacote_id,
          v_quote.cliente_id,
          'RES-' || upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 8)),
          COALESCE(v_quote.adultos, 1),
          COALESCE(v_quote.criancas, 0),
          COALESCE(v_quote.bebes, 0),
          v_snapshot,
          'proposta_disponivel',
          v_quote.observacoes
        ) RETURNING id INTO v_reservation_id;

        INSERT INTO public.viagens_propostas (
          reserva_id, cliente_id, snapshot_completo, valor_total,
          parcelamento_permitido, condicoes, prazo_aceitacao, prazo_pagamento, status
        ) VALUES (
          v_reservation_id,
          v_quote.cliente_id,
          v_snapshot,
          p_total,
          GREATEST(COALESCE(p_max_installments, 1), 1),
          NULLIF(trim(COALESCE(p_conditions, '')), ''),
          v_acceptance_deadline,
          v_payment_deadline,
          'enviada'
        ) RETURNING id INTO v_proposal_id;

        UPDATE public.viagens_orcamentos
           SET status = 'propostas_disponiveis', updated_at = now()
         WHERE id = p_quote_id;

        PERFORM public.gsa_admin_write_audit(
          'viagens',
          'CRIAR_PROPOSTA',
          'viagens_propostas',
          v_proposal_id,
          jsonb_build_object('orcamento_id', p_quote_id, 'reserva_id', v_reservation_id, 'valor_total', p_total)
        );

        RETURN jsonb_build_object('success', true, 'proposal_id', v_proposal_id, 'reservation_id', v_reservation_id);
      END;
      $body$
    $function$;
  END IF;

  IF to_regprocedure('public.gsa_admin_travel_create_package(uuid,text,jsonb)') IS NULL THEN
    EXECUTE $function$
      CREATE FUNCTION public.gsa_admin_travel_create_package(
        p_sessao_id uuid DEFAULT NULL,
        p_session_token text DEFAULT NULL,
        p_payload jsonb DEFAULT '{}'::jsonb
      )
      RETURNS jsonb
      LANGUAGE plpgsql
      SECURITY DEFINER
      SET search_path = public, pg_temp
      AS $body$
      DECLARE
        v_id uuid;
        v_title text := trim(COALESCE(p_payload ->> 'titulo', ''));
        v_destination text := trim(COALESCE(p_payload ->> 'destino', ''));
        v_price numeric;
        v_slug text;
      BEGIN
        PERFORM public.gsa_admin_assert_module('viagens');

        BEGIN
          v_price := NULLIF(p_payload ->> 'preco_venda', '')::numeric;
        EXCEPTION WHEN invalid_text_representation THEN
          v_price := NULL;
        END;

        IF v_title = '' OR v_destination = '' OR v_price IS NULL OR v_price <= 0 THEN
          RAISE EXCEPTION 'Título, destino e preço válidos são obrigatórios.' USING ERRCODE = '22023';
        END IF;

        v_slug := trim(both '-' FROM regexp_replace(lower(v_title), '[^a-z0-9]+', '-', 'g'));
        IF v_slug = '' THEN v_slug := 'pacote'; END IF;
        v_slug := v_slug || '-' || substr(replace(gen_random_uuid()::text, '-', ''), 1, 6);

        INSERT INTO public.viagens_pacotes (
          titulo, slug, categoria, origem, destino, data_ida, data_volta,
          dias, noites, preco_venda, parcelamento_maximo, status
        ) VALUES (
          v_title,
          v_slug,
          COALESCE(NULLIF(p_payload ->> 'categoria', ''), 'nacional'),
          NULLIF(trim(COALESCE(p_payload ->> 'origem', '')), ''),
          v_destination,
          NULLIF(p_payload ->> 'data_ida', '')::date,
          NULLIF(p_payload ->> 'data_volta', '')::date,
          NULLIF(p_payload ->> 'dias', '')::integer,
          NULLIF(p_payload ->> 'noites', '')::integer,
          v_price,
          GREATEST(COALESCE(NULLIF(p_payload ->> 'parcelamento_maximo', '')::integer, 1), 1),
          'rascunho'
        ) RETURNING id INTO v_id;

        IF NULLIF(trim(COALESCE(p_payload ->> 'imagem_url', '')), '') IS NOT NULL THEN
          INSERT INTO public.viagens_pacote_imagens (pacote_id, url, is_capa, ordem)
          VALUES (v_id, trim(p_payload ->> 'imagem_url'), true, 0);
        END IF;

        PERFORM public.gsa_admin_write_audit('viagens', 'CRIAR_PACOTE', 'viagens_pacotes', v_id, p_payload);
        RETURN jsonb_build_object('success', true, 'id', v_id);
      END;
      $body$
    $function$;
  END IF;
END;
$restore_travel_rpcs$;

REVOKE ALL ON FUNCTION public.gsa_admin_travel_list(uuid, text, text, integer, integer, text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.gsa_admin_travel_link_lead(uuid, text, uuid, uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.gsa_admin_travel_update_status(uuid, text, text, uuid, text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.gsa_admin_travel_create_proposal(uuid, text, uuid, text, numeric, integer, integer, integer, text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.gsa_admin_travel_create_package(uuid, text, jsonb) FROM PUBLIC, anon;

GRANT EXECUTE ON FUNCTION public.gsa_admin_travel_list(uuid, text, text, integer, integer, text) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.gsa_admin_travel_link_lead(uuid, text, uuid, uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.gsa_admin_travel_update_status(uuid, text, text, uuid, text) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.gsa_admin_travel_create_proposal(uuid, text, uuid, text, numeric, integer, integer, integer, text) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.gsa_admin_travel_create_package(uuid, text, jsonb) TO authenticated, service_role;

NOTIFY pgrst, 'reload schema';

COMMIT;
