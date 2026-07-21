BEGIN;

-- Retorno explicito do trigger para evitar ambiguidade entre NEW e OLD.
CREATE OR REPLACE FUNCTION public.gsa_sync_travel_invoice_financials()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_old_transacao_id uuid;
  v_new_transacao_id uuid;
  v_numero integer;
  v_total_parcelas integer;
BEGIN
  IF TG_OP <> 'INSERT' THEN
    v_old_transacao_id := public.gsa_travel_safe_uuid(OLD.metadata ->> 'transacao_id');
  END IF;

  IF TG_OP <> 'DELETE' THEN
    v_new_transacao_id := public.gsa_travel_safe_uuid(NEW.metadata ->> 'transacao_id');
  END IF;

  IF TG_OP = 'DELETE' THEN
    DELETE FROM public.viagens_transacao_parcelas WHERE fatura_id = OLD.id;
  ELSIF NEW.tipo = 'compra_viagem' AND v_new_transacao_id IS NOT NULL THEN
    v_numero := CASE
      WHEN COALESCE(NEW.metadata ->> 'parcela_numero', '') ~ '^\d+$'
        THEN LEAST(GREATEST((NEW.metadata ->> 'parcela_numero')::integer, 1), 24)
      ELSE 1
    END;
    v_total_parcelas := CASE
      WHEN COALESCE(NEW.metadata ->> 'parcelas_total', '') ~ '^\d+$'
        THEN LEAST(GREATEST((NEW.metadata ->> 'parcelas_total')::integer, 1), 24)
      ELSE 1
    END;

    INSERT INTO public.viagens_transacao_parcelas (
      transacao_id, fatura_id, numero, total_parcelas, valor,
      data_vencimento, status, updated_at
    ) VALUES (
      v_new_transacao_id,
      NEW.id,
      v_numero,
      v_total_parcelas,
      GREATEST(COALESCE(NEW.valor_total, 0), 0),
      NEW.data_vencimento::date,
      COALESCE(NEW.status, 'pendente'),
      now()
    )
    ON CONFLICT (fatura_id) DO UPDATE
      SET transacao_id = EXCLUDED.transacao_id,
          numero = EXCLUDED.numero,
          total_parcelas = EXCLUDED.total_parcelas,
          valor = EXCLUDED.valor,
          data_vencimento = EXCLUDED.data_vencimento,
          status = EXCLUDED.status,
          updated_at = now();
  END IF;

  IF v_old_transacao_id IS NOT NULL THEN
    PERFORM public.gsa_refresh_travel_financial_summary(v_old_transacao_id);
  END IF;

  IF v_new_transacao_id IS NOT NULL
     AND v_new_transacao_id IS DISTINCT FROM v_old_transacao_id THEN
    PERFORM public.gsa_refresh_travel_financial_summary(v_new_transacao_id);
  ELSIF v_new_transacao_id IS NOT NULL AND TG_OP = 'INSERT' THEN
    PERFORM public.gsa_refresh_travel_financial_summary(v_new_transacao_id);
  END IF;

  IF TG_OP = 'DELETE' THEN
    RETURN OLD;
  END IF;
  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.gsa_sync_travel_invoice_financials()
  FROM public, anon, authenticated;

CREATE OR REPLACE FUNCTION public.gsa_admin_travel_cancellation_list(
  p_sessao_id uuid DEFAULT NULL,
  p_session_token text DEFAULT NULL,
  p_page integer DEFAULT 1,
  p_page_size integer DEFAULT 20,
  p_search text DEFAULT NULL,
  p_status text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_page integer := GREATEST(COALESCE(p_page, 1), 1);
  v_size integer := LEAST(GREATEST(COALESCE(p_page_size, 20), 1), 100);
  v_offset integer;
  v_search text := NULLIF(trim(COALESCE(p_search, '')), '');
  v_status text := NULLIF(trim(COALESCE(p_status, '')), '');
  v_total bigint := 0;
  v_items jsonb := '[]'::jsonb;
BEGIN
  PERFORM public.gsa_admin_assert_module('viagens');
  IF NOT public.gsa_admin_has_module('financeiro') THEN
    RAISE EXCEPTION 'A fila de reembolsos exige permissao do modulo Financeiro.'
      USING ERRCODE = '42501';
  END IF;

  IF v_status IS NOT NULL
     AND v_status NOT IN (
       'solicitado', 'em_analise', 'reembolso_aprovado',
       'reembolso_negado', 'concluido'
     ) THEN
    RAISE EXCEPTION 'Status de cancelamento invalido.' USING ERRCODE = '22023';
  END IF;

  v_offset := (v_page - 1) * v_size;

  SELECT count(*)
  INTO v_total
  FROM public.viagens_cancelamentos cancelamento
  JOIN public.viagens_transacoes transacao ON transacao.id = cancelamento.transacao_id
  LEFT JOIN public.clientes cliente ON cliente.id = cancelamento.cliente_id
  LEFT JOIN public.viagens_propostas proposta ON proposta.id = transacao.proposta_id
  WHERE (v_status IS NULL OR cancelamento.status = v_status)
    AND (
      v_search IS NULL
      OR concat_ws(
        ' ', cliente.nome, cliente.email, cliente.telefone,
        cancelamento.motivo, cancelamento.resposta_gsa,
        proposta.snapshot_completo ->> 'titulo',
        proposta.snapshot_completo ->> 'destino'
      ) ILIKE '%' || v_search || '%'
    );

  SELECT COALESCE(jsonb_agg(to_jsonb(rows)), '[]'::jsonb)
  INTO v_items
  FROM (
    SELECT
      cancelamento.id,
      cancelamento.transacao_id,
      cancelamento.cliente_id,
      cancelamento.motivo,
      cancelamento.status,
      cancelamento.valor_solicitado,
      cancelamento.valor_pago_no_pedido,
      cancelamento.taxas_aplicaveis,
      cancelamento.valor_reembolsado,
      cancelamento.faturas_suspensas,
      cancelamento.resposta_gsa,
      cancelamento.created_at,
      cancelamento.decidido_em,
      cancelamento.concluido_em,
      cliente.nome AS cliente_nome,
      cliente.email AS cliente_email,
      transacao.status AS transacao_status,
      transacao.pagamento_status,
      transacao.valor_total_contrato,
      transacao.valor_faturado,
      transacao.valor_efetivamente_pago,
      transacao.valor_em_aberto,
      transacao.valor_elegivel_reembolso,
      proposta.snapshot_completo
    FROM public.viagens_cancelamentos cancelamento
    JOIN public.viagens_transacoes transacao ON transacao.id = cancelamento.transacao_id
    LEFT JOIN public.clientes cliente ON cliente.id = cancelamento.cliente_id
    LEFT JOIN public.viagens_propostas proposta ON proposta.id = transacao.proposta_id
    WHERE (v_status IS NULL OR cancelamento.status = v_status)
      AND (
        v_search IS NULL
        OR concat_ws(
          ' ', cliente.nome, cliente.email, cliente.telefone,
          cancelamento.motivo, cancelamento.resposta_gsa,
          proposta.snapshot_completo ->> 'titulo',
          proposta.snapshot_completo ->> 'destino'
        ) ILIKE '%' || v_search || '%'
      )
    ORDER BY
      CASE cancelamento.status
        WHEN 'solicitado' THEN 1
        WHEN 'em_analise' THEN 2
        WHEN 'reembolso_aprovado' THEN 3
        ELSE 4
      END,
      cancelamento.created_at ASC
    LIMIT v_size OFFSET v_offset
  ) rows;

  RETURN jsonb_build_object(
    'items', v_items,
    'total', v_total,
    'page', v_page,
    'page_size', v_size
  );
END;
$$;

REVOKE ALL ON FUNCTION public.gsa_admin_travel_cancellation_list(
  uuid, text, integer, integer, text, text
) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.gsa_admin_travel_cancellation_list(
  uuid, text, integer, integer, text, text
) TO authenticated;

COMMIT;
