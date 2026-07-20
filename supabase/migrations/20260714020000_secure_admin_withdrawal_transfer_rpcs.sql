CREATE OR REPLACE FUNCTION public.gsa_admin_session_actor(
  p_sessao_id uuid,
  p_session_token text
)
RETURNS TABLE(
  ator_tipo text,
  ator_id uuid,
  ator_nome text
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_session record;
BEGIN
  SELECT *
    INTO v_session
  FROM public.gsa_validate_session(p_sessao_id, p_session_token)
  LIMIT 1;

  IF NOT coalesce(v_session.is_valid, false)
     OR v_session.ator_tipo NOT IN ('admin', 'colaborador') THEN
    RAISE EXCEPTION 'Sessao administrativa invalida ou expirada.';
  END IF;

  ator_tipo := v_session.ator_tipo;
  ator_id := v_session.ator_id;
  ator_nome := coalesce(v_session.ator_nome, 'Administrador');
  RETURN NEXT;
END;
$$;

CREATE OR REPLACE FUNCTION public.gsa_admin_processar_saque(
  p_sessao_id uuid,
  p_session_token text,
  p_saque_id uuid,
  p_acao text,
  p_motivo text DEFAULT NULL,
  p_data_pagamento date DEFAULT CURRENT_DATE
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_actor record;
  v_saque saques%rowtype;
  v_cliente clientes%rowtype;
  v_novo_saldo numeric;
  v_acao text := lower(coalesce(p_acao, ''));
BEGIN
  SELECT * INTO v_actor
  FROM public.gsa_admin_session_actor(p_sessao_id, p_session_token)
  LIMIT 1;

  SELECT * INTO v_saque
  FROM public.saques
  WHERE id = p_saque_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Saque nao encontrado.';
  END IF;

  IF v_acao = 'aprovar' THEN
    IF v_saque.status = 'pago' THEN
      RETURN jsonb_build_object('success', true, 'status', 'pago', 'already_processed', true);
    END IF;
    IF v_saque.status <> 'pendente' THEN
      RAISE EXCEPTION 'Este saque ja foi processado. Status atual: %', v_saque.status;
    END IF;

    UPDATE public.saques
       SET status = 'pago',
           data_pagamento = coalesce(p_data_pagamento, current_date),
           observacoes = trim(both ' ' from concat_ws(' ', nullif(observacoes, ''), 'Saque aprovado por ', v_actor.ator_nome))
     WHERE id = p_saque_id;

    RETURN jsonb_build_object('success', true, 'status', 'pago', 'saque_id', p_saque_id);
  ELSIF v_acao = 'rejeitar' THEN
    IF nullif(trim(coalesce(p_motivo, '')), '') IS NULL THEN
      RAISE EXCEPTION 'Motivo da rejeicao e obrigatorio.';
    END IF;
    IF v_saque.status = 'cancelado' THEN
      RETURN jsonb_build_object('success', true, 'status', 'cancelado', 'already_processed', true);
    END IF;
    IF v_saque.status <> 'pendente' THEN
      RAISE EXCEPTION 'Este saque ja foi processado. Status atual: %', v_saque.status;
    END IF;

    SELECT * INTO v_cliente
    FROM public.clientes
    WHERE id = v_saque.cliente_id
    FOR UPDATE;

    IF NOT FOUND THEN
      RAISE EXCEPTION 'Cliente do saque nao encontrado.';
    END IF;

    v_novo_saldo := round(coalesce(v_cliente.saldo_carteira, 0) + coalesce(v_saque.valor, 0), 2);

    UPDATE public.saques
       SET status = 'cancelado',
           motivo_cancelamento = trim(p_motivo) || ' [POR: ' || v_actor.ator_nome || ']'
     WHERE id = p_saque_id;

    UPDATE public.clientes
       SET saldo_carteira = v_novo_saldo
     WHERE id = v_saque.cliente_id;

    INSERT INTO public.extrato_financeiro(
      cliente_id, tipo, valor, descricao, referencia_id, modulo_referencia, saldo_resultante
    )
    VALUES (
      v_saque.cliente_id,
      'entrada',
      coalesce(v_saque.valor, 0),
      'Estorno de saque rejeitado - Motivo: ' || trim(p_motivo),
      p_saque_id,
      'saques',
      v_novo_saldo
    );

    RETURN jsonb_build_object(
      'success', true,
      'status', 'cancelado',
      'saque_id', p_saque_id,
      'saldo_carteira', v_novo_saldo,
      'valor_estornado', coalesce(v_saque.valor, 0)
    );
  END IF;

  RAISE EXCEPTION 'Acao invalida para saque.';
END;
$$;

CREATE OR REPLACE FUNCTION public.gsa_admin_processar_transferencia(
  p_sessao_id uuid,
  p_session_token text,
  p_transferencia_id uuid,
  p_acao text,
  p_motivo text DEFAULT NULL,
  p_data_pagamento date DEFAULT CURRENT_DATE
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_actor record;
  v_transf transferencias%rowtype;
  v_origem clientes%rowtype;
  v_destino clientes%rowtype;
  v_is_pontos boolean;
  v_valor_bruto numeric;
  v_valor_liquido numeric;
  v_saldo_origem numeric;
  v_saldo_destino numeric;
  v_acao text := lower(coalesce(p_acao, ''));
BEGIN
  SELECT * INTO v_actor
  FROM public.gsa_admin_session_actor(p_sessao_id, p_session_token)
  LIMIT 1;

  SELECT * INTO v_transf
  FROM public.transferencias
  WHERE id = p_transferencia_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Transferencia nao encontrada.';
  END IF;

  v_is_pontos := coalesce(v_transf.tipo, 'saldo') = 'pontos';
  v_valor_bruto := coalesce(v_transf.valor, 0);
  v_valor_liquido := coalesce(v_transf.valor_liquido, v_transf.valor, 0);

  IF v_acao = 'aprovar' THEN
    IF v_transf.status IN ('aprovado', 'concluido') THEN
      RETURN jsonb_build_object('success', true, 'status', v_transf.status, 'already_processed', true);
    END IF;
    IF v_transf.status <> 'em_analise' THEN
      RAISE EXCEPTION 'Esta transferencia ja foi processada. Status atual: %', v_transf.status;
    END IF;

    SELECT * INTO v_destino
    FROM public.clientes
    WHERE id = v_transf.cliente_destino_id
    FOR UPDATE;

    IF NOT FOUND THEN
      RAISE EXCEPTION 'Cliente de destino nao encontrado.';
    END IF;

    IF v_is_pontos THEN
      v_saldo_destino := coalesce(v_destino.saldo_pontos, 0) + v_valor_liquido;

      UPDATE public.clientes
         SET saldo_pontos = v_saldo_destino::integer
       WHERE id = v_transf.cliente_destino_id;

      INSERT INTO public.pontos_movimentacoes(cliente_id, tipo, pontos, saldo_apos, descricao)
      VALUES (
        v_transf.cliente_destino_id,
        'transferencia_recebida',
        v_valor_liquido::integer,
        v_saldo_destino::integer,
        'Transferencia de pontos recebida'
      );

      INSERT INTO public.points_transactions(cliente_id, tipo, pontos, descricao)
      VALUES (
        v_transf.cliente_destino_id,
        'transferencia_recebida',
        v_valor_liquido::integer,
        'Transferencia de pontos recebida'
      );
    ELSE
      v_saldo_destino := round(coalesce(v_destino.saldo_carteira, 0) + v_valor_liquido, 2);

      UPDATE public.clientes
         SET saldo_carteira = v_saldo_destino
       WHERE id = v_transf.cliente_destino_id;

      INSERT INTO public.extrato_financeiro(
        cliente_id, tipo, valor, descricao, saldo_resultante, referencia_id, modulo_referencia
      )
      VALUES (
        v_transf.cliente_destino_id,
        'entrada',
        v_valor_liquido,
        'Transferencia recebida',
        v_saldo_destino,
        p_transferencia_id,
        'transferencia'
      );
    END IF;

    UPDATE public.transferencias
       SET status = 'aprovado',
           data_analise = now(),
           data_pagamento = coalesce(p_data_pagamento, current_date),
           observacoes_admin = trim(both ' ' from concat_ws(' ', nullif(observacoes_admin, ''), 'Transferencia aprovada por ', v_actor.ator_nome))
     WHERE id = p_transferencia_id;

    RETURN jsonb_build_object('success', true, 'status', 'aprovado', 'transferencia_id', p_transferencia_id);
  ELSIF v_acao = 'rejeitar' THEN
    IF nullif(trim(coalesce(p_motivo, '')), '') IS NULL THEN
      RAISE EXCEPTION 'Motivo da rejeicao e obrigatorio.';
    END IF;
    IF v_transf.status = 'cancelado' THEN
      RETURN jsonb_build_object('success', true, 'status', 'cancelado', 'already_processed', true);
    END IF;
    IF v_transf.status <> 'em_analise' THEN
      RAISE EXCEPTION 'Esta transferencia ja foi processada. Status atual: %', v_transf.status;
    END IF;

    SELECT * INTO v_origem
    FROM public.clientes
    WHERE id = v_transf.cliente_origem_id
    FOR UPDATE;

    IF NOT FOUND THEN
      RAISE EXCEPTION 'Cliente de origem nao encontrado.';
    END IF;

    IF v_is_pontos THEN
      v_saldo_origem := coalesce(v_origem.saldo_pontos, 0) + v_valor_bruto;

      UPDATE public.clientes
         SET saldo_pontos = v_saldo_origem::integer
       WHERE id = v_transf.cliente_origem_id;

      INSERT INTO public.pontos_movimentacoes(cliente_id, tipo, pontos, saldo_apos, descricao)
      VALUES (
        v_transf.cliente_origem_id,
        'estorno',
        v_valor_bruto::integer,
        v_saldo_origem::integer,
        'Estorno de transferencia recusada - Motivo: ' || trim(p_motivo)
      );

      INSERT INTO public.points_transactions(cliente_id, tipo, pontos, descricao)
      VALUES (
        v_transf.cliente_origem_id,
        'estorno',
        v_valor_bruto::integer,
        'Estorno de transferencia recusada - Motivo: ' || trim(p_motivo)
      );
    ELSE
      v_saldo_origem := round(coalesce(v_origem.saldo_carteira, 0) + v_valor_bruto, 2);

      UPDATE public.clientes
         SET saldo_carteira = v_saldo_origem
       WHERE id = v_transf.cliente_origem_id;

      INSERT INTO public.extrato_financeiro(
        cliente_id, tipo, valor, descricao, saldo_resultante, referencia_id, modulo_referencia
      )
      VALUES (
        v_transf.cliente_origem_id,
        'entrada',
        v_valor_bruto,
        'Estorno de transferencia recusada - Motivo: ' || trim(p_motivo),
        v_saldo_origem,
        p_transferencia_id,
        'transferencia'
      );
    END IF;

    UPDATE public.transferencias
       SET status = 'cancelado',
           motivo_cancelamento = trim(p_motivo) || ' [POR: ' || v_actor.ator_nome || ']',
           observacoes_admin = trim(p_motivo),
           data_analise = now()
     WHERE id = p_transferencia_id;

    RETURN jsonb_build_object('success', true, 'status', 'cancelado', 'transferencia_id', p_transferencia_id);
  ELSIF v_acao = 'estornar' THEN
    IF nullif(trim(coalesce(p_motivo, '')), '') IS NULL THEN
      RAISE EXCEPTION 'Motivo do estorno e obrigatorio.';
    END IF;
    IF v_transf.status = 'estornado' THEN
      RETURN jsonb_build_object('success', true, 'status', 'estornado', 'already_processed', true);
    END IF;
    IF v_transf.status NOT IN ('aprovado', 'concluido') THEN
      RAISE EXCEPTION 'Esta transferencia nao pode ser estornada. Status atual: %', v_transf.status;
    END IF;

    SELECT * INTO v_origem
    FROM public.clientes
    WHERE id = v_transf.cliente_origem_id
    FOR UPDATE;

    SELECT * INTO v_destino
    FROM public.clientes
    WHERE id = v_transf.cliente_destino_id
    FOR UPDATE;

    IF NOT FOUND THEN
      RAISE EXCEPTION 'Cliente de origem ou destino nao encontrado.';
    END IF;

    IF v_is_pontos THEN
      IF coalesce(v_destino.saldo_pontos, 0) < v_valor_liquido THEN
        RAISE EXCEPTION 'Destinatario sem pontos suficientes para estorno.';
      END IF;

      v_saldo_origem := coalesce(v_origem.saldo_pontos, 0) + v_valor_bruto;
      v_saldo_destino := coalesce(v_destino.saldo_pontos, 0) - v_valor_liquido;

      UPDATE public.clientes SET saldo_pontos = v_saldo_origem::integer WHERE id = v_transf.cliente_origem_id;
      UPDATE public.clientes SET saldo_pontos = v_saldo_destino::integer WHERE id = v_transf.cliente_destino_id;

      INSERT INTO public.pontos_movimentacoes(cliente_id, tipo, pontos, saldo_apos, descricao)
      VALUES
        (v_transf.cliente_origem_id, 'estorno', v_valor_bruto::integer, v_saldo_origem::integer, 'Estorno de transferencia concluida'),
        (v_transf.cliente_destino_id, 'estorno', -v_valor_liquido::integer, v_saldo_destino::integer, 'Estorno de transferencia recebida');

      INSERT INTO public.points_transactions(cliente_id, tipo, pontos, descricao)
      VALUES
        (v_transf.cliente_origem_id, 'estorno', v_valor_bruto::integer, 'Estorno de transferencia concluida'),
        (v_transf.cliente_destino_id, 'estorno', -v_valor_liquido::integer, 'Estorno de transferencia recebida');
    ELSE
      IF coalesce(v_destino.saldo_carteira, 0) < v_valor_liquido THEN
        RAISE EXCEPTION 'Destinatario sem saldo suficiente para estorno.';
      END IF;

      v_saldo_origem := round(coalesce(v_origem.saldo_carteira, 0) + v_valor_bruto, 2);
      v_saldo_destino := round(coalesce(v_destino.saldo_carteira, 0) - v_valor_liquido, 2);

      UPDATE public.clientes SET saldo_carteira = v_saldo_origem WHERE id = v_transf.cliente_origem_id;
      UPDATE public.clientes SET saldo_carteira = v_saldo_destino WHERE id = v_transf.cliente_destino_id;

      INSERT INTO public.extrato_financeiro(
        cliente_id, tipo, valor, descricao, saldo_resultante, referencia_id, modulo_referencia
      )
      VALUES
        (v_transf.cliente_origem_id, 'entrada', v_valor_bruto, 'Estorno de transferencia concluida', v_saldo_origem, p_transferencia_id, 'transferencia'),
        (v_transf.cliente_destino_id, 'saida', v_valor_liquido, 'Estorno de transferencia recebida', v_saldo_destino, p_transferencia_id, 'transferencia');
    END IF;

    UPDATE public.transferencias
       SET status = 'estornado',
           motivo_cancelamento = 'ESTORNO ADMINISTRATIVO: ' || trim(p_motivo) || ' [POR: ' || v_actor.ator_nome || ']',
           observacoes_admin = 'Estornado - Motivo: ' || trim(p_motivo),
           data_analise = now()
     WHERE id = p_transferencia_id;

    RETURN jsonb_build_object('success', true, 'status', 'estornado', 'transferencia_id', p_transferencia_id);
  END IF;

  RAISE EXCEPTION 'Acao invalida para transferencia.';
END;
$$;

GRANT EXECUTE ON FUNCTION public.gsa_admin_session_actor(uuid, text) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.gsa_admin_processar_saque(uuid, text, uuid, text, text, date) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.gsa_admin_processar_transferencia(uuid, text, uuid, text, text, date) TO anon, authenticated;

DROP POLICY IF EXISTS "Acesso total" ON public.saques;
DROP POLICY IF EXISTS "Acesso total" ON public.transferencias;

DROP POLICY IF EXISTS saques_select_public_temp ON public.saques;
CREATE POLICY saques_select_public_temp
ON public.saques
FOR SELECT
USING (true);

DROP POLICY IF EXISTS transferencias_select_public_temp ON public.transferencias;
CREATE POLICY transferencias_select_public_temp
ON public.transferencias
FOR SELECT
USING (true);
