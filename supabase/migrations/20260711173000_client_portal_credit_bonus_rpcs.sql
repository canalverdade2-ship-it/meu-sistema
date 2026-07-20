CREATE OR REPLACE FUNCTION public.suprimir_bonus_boas_vindas_cliente(p_cliente_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF p_cliente_id IS NULL THEN
    RAISE EXCEPTION 'Cliente obrigatorio.';
  END IF;

  UPDATE clientes
  SET bonus_boas_vindas_pendente = false
  WHERE id = p_cliente_id;

  RETURN jsonb_build_object('success', true);
END;
$$;

CREATE OR REPLACE FUNCTION public.liberar_credito_loja_assinado(p_cliente_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_sol loja_credito_solicitacoes%rowtype;
  v_cliente clientes%rowtype;
  v_limite_total_atual numeric;
  v_limite_disp_atual numeric;
  v_novo_limite_total numeric;
  v_novo_limite_disp numeric;
  v_variacao numeric;
  v_tipo text;
  v_count integer := 0;
BEGIN
  IF p_cliente_id IS NULL THEN
    RAISE EXCEPTION 'Cliente obrigatorio.';
  END IF;

  FOR v_sol IN
    SELECT *
    FROM loja_credito_solicitacoes
    WHERE cliente_id = p_cliente_id
      AND status = 'contrato_assinado'
      AND data_liberacao_credito <= current_date
    ORDER BY data_liberacao_credito, id
    FOR UPDATE
  LOOP
    SELECT * INTO v_cliente FROM clientes WHERE id = p_cliente_id FOR UPDATE;
    IF NOT FOUND THEN RAISE EXCEPTION 'Cliente nao encontrado.'; END IF;

    v_limite_total_atual := coalesce(v_cliente.limite_credito_total, 0);
    v_limite_disp_atual := coalesce(v_cliente.limite_credito_disponivel, 0);
    v_novo_limite_total := coalesce(v_sol.limite_aprovado, 0);
    v_variacao := v_novo_limite_total;
    v_tipo := 'concessao_inicial';

    IF v_sol.tipo_solicitacao = 'adesao' THEN
      v_novo_limite_disp := v_novo_limite_total;
    ELSE
      v_variacao := v_novo_limite_total - v_limite_total_atual;
      v_novo_limite_disp := v_limite_disp_atual + v_variacao;
      v_tipo := 'solicitacao_aumento_aprovada';
    END IF;

    UPDATE clientes
    SET limite_credito_total = v_novo_limite_total,
        limite_credito_disponivel = v_novo_limite_disp,
        opcao_pagamento_parcelado = v_sol.opcao_pagamento_parcelado
    WHERE id = p_cliente_id;

    INSERT INTO loja_credito_movimentacoes(
      cliente_id, solicitacao_id, tipo, valor,
      limite_total_anterior, limite_total_novo,
      limite_disponivel_anterior, limite_disponivel_novo,
      descricao
    )
    VALUES (
      p_cliente_id, v_sol.id, v_tipo, v_variacao,
      v_limite_total_atual, v_novo_limite_total,
      v_limite_disp_atual, v_novo_limite_disp,
      CASE
        WHEN v_sol.tipo_solicitacao = 'adesao' THEN 'Ativacao automatica de limite de credito pre-aprovado e assinado'
        ELSE 'Ajuste automatico de limite: alteracao para ' || v_novo_limite_total::text
      END
    );

    UPDATE loja_credito_solicitacoes
    SET status = 'liberado', updated_at = now()
    WHERE id = v_sol.id;

    INSERT INTO notificacoes(cliente_id, titulo, mensagem, link_modulo, tipo)
    VALUES (
      p_cliente_id,
      'Credito Ativo!',
      'Seu limite de credito de R$ ' || to_char(v_novo_limite_total, 'FM9999999990D00') || ' foi liberado e ja esta disponivel para uso na loja!',
      'credito_loja',
      'sistema'
    );

    v_count := v_count + 1;
  END LOOP;

  RETURN jsonb_build_object('success', true, 'liberados', v_count);
END;
$$;

GRANT EXECUTE ON FUNCTION public.suprimir_bonus_boas_vindas_cliente(uuid) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.liberar_credito_loja_assinado(uuid) TO anon, authenticated;
