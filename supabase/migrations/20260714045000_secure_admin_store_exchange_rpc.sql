CREATE OR REPLACE FUNCTION public.gsa_admin_atualizar_solicitacao_loja(
  p_sessao_id uuid,
  p_session_token text,
  p_solicitacao_id uuid,
  p_novo_status text,
  p_resposta_admin text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_actor record;
  v_sol loja_solicitacoes%rowtype;
  v_orc orcamentos%rowtype;
  v_cliente clientes%rowtype;
  v_status text := lower(trim(coalesce(p_novo_status, '')));
  v_status_to_save text;
  v_historico jsonb;
  v_diff numeric;
  v_codigo_fatura text;
  v_fatura_id uuid;
  v_tem_fatura_credito boolean := false;
  v_limite_disponivel_novo numeric;
  v_canceladas integer := 0;
BEGIN
  IF v_status NOT IN ('em_analise', 'aprovado', 'rejeitado', 'concluido') THEN
    RAISE EXCEPTION 'Status de solicitacao de loja invalido.';
  END IF;

  SELECT * INTO v_actor FROM public.gsa_admin_session_actor(p_sessao_id, p_session_token) LIMIT 1;

  SELECT * INTO v_sol
  FROM public.loja_solicitacoes
  WHERE id = p_solicitacao_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Solicitacao de loja nao encontrada.';
  END IF;

  v_status_to_save := v_status;
  v_diff := round(coalesce(v_sol.valor_diferenca, 0), 2);

  IF v_status = 'aprovado' AND v_diff = 0 THEN
    v_status_to_save := 'aguardando_instrucoes';
  END IF;

  IF v_sol.status = v_status_to_save THEN
    RETURN jsonb_build_object(
      'success', true,
      'already_processed', true,
      'solicitacao_id', p_solicitacao_id,
      'cliente_id', v_sol.cliente_id,
      'status', v_sol.status,
      'codigo_solicitacao', v_sol.codigo_solicitacao,
      'valor_diferenca', v_diff,
      'fatura_diferenca_id', NULL,
      'credito_estornado', false,
      'codigo_orcamento', NULL,
      'total_orcamento', 0,
      'faturas_credito_canceladas', 0
    );
  END IF;

  v_historico := coalesce(v_sol.historico_status::jsonb, '{}'::jsonb) || jsonb_build_object(v_status_to_save, now());

  UPDATE public.loja_solicitacoes
     SET status = v_status_to_save,
         historico_status = v_historico,
         resposta_admin = coalesce(nullif(trim(coalesce(p_resposta_admin, '')), ''), v_sol.resposta_admin),
         updated_at = now()
   WHERE id = p_solicitacao_id;

  IF v_status = 'aprovado' AND v_diff > 0 THEN
    v_codigo_fatura := 'FAT-TROCA-' || coalesce(v_sol.codigo_solicitacao, p_solicitacao_id::text);

    SELECT id INTO v_fatura_id
    FROM public.faturas
    WHERE codigo_fatura = v_codigo_fatura
    LIMIT 1;

    IF v_fatura_id IS NULL THEN
      INSERT INTO public.faturas(
        codigo_fatura,
        cliente_id,
        valor_total,
        valor_final_pendente,
        valor_base_original,
        status,
        tipo,
        gerada_automaticamente,
        is_amortizacao_credito,
        data_vencimento,
        itens_faturados
      )
      VALUES (
        v_codigo_fatura,
        v_sol.cliente_id,
        v_diff,
        v_diff,
        v_diff,
        'pendente',
        'produto',
        true,
        false,
        current_date + 2,
        jsonb_build_array(jsonb_build_object(
          'codigo', 'DIF-' || coalesce(v_sol.codigo_solicitacao, p_solicitacao_id::text),
          'descricao', 'Diferenca de valor na troca de produto (Ref. Solicitacao #' || coalesce(v_sol.codigo_solicitacao, p_solicitacao_id::text) || ')',
          'valor_unitario', v_diff,
          'quantidade', 1,
          'subtotal', v_diff,
          'tipo', 'produto'
        ))
      )
      RETURNING id INTO v_fatura_id;
    END IF;
  END IF;

  IF v_status = 'aprovado' AND v_sol.orcamento_origem_id IS NOT NULL THEN
    SELECT * INTO v_orc
    FROM public.orcamentos
    WHERE id = v_sol.orcamento_origem_id
    FOR UPDATE;

    IF FOUND THEN
      SELECT EXISTS (
        SELECT 1
        FROM public.faturas
        WHERE cliente_id = v_sol.cliente_id
          AND is_amortizacao_credito = true
          AND itens_faturados @> jsonb_build_array(jsonb_build_object('codigo', 'CRE-' || v_orc.codigo_orcamento))
      ) INTO v_tem_fatura_credito;

      IF v_tem_fatura_credito THEN
        SELECT * INTO v_cliente
        FROM public.clientes
        WHERE id = v_sol.cliente_id
        FOR UPDATE;

        IF NOT FOUND THEN
          RAISE EXCEPTION 'Cliente da solicitacao nao encontrado.';
        END IF;

        v_limite_disponivel_novo := coalesce(v_cliente.limite_credito_disponivel, 0) + coalesce(v_orc.total, 0);

        UPDATE public.clientes
           SET limite_credito_disponivel = v_limite_disponivel_novo,
               updated_at = now()
         WHERE id = v_sol.cliente_id;

        UPDATE public.faturas
           SET status = 'cancelado',
               motivo_cancelamento = 'Estornado devido a aprovacao da devolucao/troca #' || coalesce(v_sol.codigo_solicitacao, p_solicitacao_id::text),
               data_cancelamento = now()
         WHERE cliente_id = v_sol.cliente_id
           AND is_amortizacao_credito = true
           AND itens_faturados @> jsonb_build_array(jsonb_build_object('codigo', 'CRE-' || v_orc.codigo_orcamento))
           AND status <> 'pago';

        GET DIAGNOSTICS v_canceladas = ROW_COUNT;

        INSERT INTO public.loja_credito_movimentacoes(
          cliente_id,
          tipo,
          valor,
          limite_total_anterior,
          limite_total_novo,
          limite_disponivel_anterior,
          limite_disponivel_novo,
          descricao
        )
        VALUES (
          v_sol.cliente_id,
          'estorno_compra',
          coalesce(v_orc.total, 0),
          coalesce(v_cliente.limite_credito_total, 0),
          coalesce(v_cliente.limite_credito_total, 0),
          coalesce(v_cliente.limite_credito_disponivel, 0),
          v_limite_disponivel_novo,
          'Estorno por Devolucao/Troca Aprovada (Orcamento #' || coalesce(v_orc.codigo_orcamento, v_sol.orcamento_origem_id::text) || ') [POR: ' || v_actor.ator_nome || ']'
        );
      END IF;
    END IF;
  END IF;

  RETURN jsonb_build_object(
    'success', true,
    'solicitacao_id', p_solicitacao_id,
    'cliente_id', v_sol.cliente_id,
    'status', v_status_to_save,
    'codigo_solicitacao', v_sol.codigo_solicitacao,
    'valor_diferenca', v_diff,
    'fatura_diferenca_id', v_fatura_id,
    'credito_estornado', v_tem_fatura_credito,
    'codigo_orcamento', CASE WHEN v_orc.id IS NOT NULL THEN v_orc.codigo_orcamento ELSE NULL END,
    'total_orcamento', CASE WHEN v_orc.id IS NOT NULL THEN coalesce(v_orc.total, 0) ELSE 0 END,
    'faturas_credito_canceladas', v_canceladas
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.gsa_admin_atualizar_solicitacao_loja(uuid, text, uuid, text, text) TO anon, authenticated;
