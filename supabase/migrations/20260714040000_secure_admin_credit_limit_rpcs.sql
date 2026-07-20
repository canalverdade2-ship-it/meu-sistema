CREATE OR REPLACE FUNCTION public.gsa_admin_aprovar_aumento_credito(
  p_sessao_id uuid,
  p_session_token text,
  p_solicitacao_id uuid,
  p_limite_aprovado numeric
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_actor record;
  v_sol loja_credito_solicitacoes%rowtype;
  v_cli clientes%rowtype;
  v_limite numeric := round(coalesce(p_limite_aprovado, 0), 2);
  v_diff numeric;
  v_novo_disponivel numeric;
BEGIN
  IF v_limite <= 0 THEN
    RAISE EXCEPTION 'Limite aprovado deve ser maior que zero.';
  END IF;

  SELECT * INTO v_actor FROM public.gsa_admin_session_actor(p_sessao_id, p_session_token) LIMIT 1;

  SELECT * INTO v_sol
  FROM public.loja_credito_solicitacoes
  WHERE id = p_solicitacao_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Solicitacao de credito nao encontrada.';
  END IF;

  SELECT * INTO v_cli
  FROM public.clientes
  WHERE id = v_sol.cliente_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Cliente da solicitacao nao encontrado.';
  END IF;

  IF v_sol.status = 'liberado' AND coalesce(v_sol.limite_aprovado, 0) = v_limite THEN
    RETURN jsonb_build_object('success', true, 'already_processed', true, 'cliente_id', v_cli.id, 'solicitacao_id', v_sol.id);
  END IF;

  v_diff := v_limite - coalesce(v_cli.limite_credito_total, 0);
  v_novo_disponivel := greatest(0, coalesce(v_cli.limite_credito_disponivel, 0) + v_diff);

  UPDATE public.clientes
     SET limite_credito_total = v_limite,
         limite_credito_disponivel = v_novo_disponivel,
         updated_at = now()
   WHERE id = v_cli.id;

  UPDATE public.loja_credito_solicitacoes
     SET limite_aprovado = v_limite,
         status = 'liberado',
         data_liberacao_credito = current_date,
         updated_at = now()
   WHERE id = v_sol.id;

  INSERT INTO public.loja_credito_movimentacoes(
    cliente_id, solicitacao_id, tipo, valor,
    limite_total_anterior, limite_total_novo,
    limite_disponivel_anterior, limite_disponivel_novo,
    descricao
  )
  VALUES (
    v_cli.id,
    v_sol.id,
    'solicitacao_aumento_aprovada',
    abs(v_diff),
    coalesce(v_cli.limite_credito_total, 0),
    v_limite,
    coalesce(v_cli.limite_credito_disponivel, 0),
    v_novo_disponivel,
    'Aumento de limite solicitado aprovado pelo ADM. Novo limite: R$ ' || to_char(v_limite, 'FM999999999990D00') || ' [POR: ' || v_actor.ator_nome || ']'
  );

  RETURN jsonb_build_object(
    'success', true,
    'already_processed', false,
    'cliente_id', v_cli.id,
    'solicitacao_id', v_sol.id,
    'limite_total_anterior', coalesce(v_cli.limite_credito_total, 0),
    'limite_total_novo', v_limite,
    'limite_disponivel_novo', v_novo_disponivel
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.gsa_admin_liberar_credito_contrato(
  p_sessao_id uuid,
  p_session_token text,
  p_solicitacao_id uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_actor record;
  v_sol loja_credito_solicitacoes%rowtype;
  v_cli clientes%rowtype;
  v_limite numeric;
  v_diff numeric;
  v_novo_disponivel numeric;
BEGIN
  SELECT * INTO v_actor FROM public.gsa_admin_session_actor(p_sessao_id, p_session_token) LIMIT 1;

  SELECT * INTO v_sol
  FROM public.loja_credito_solicitacoes
  WHERE id = p_solicitacao_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Solicitacao de credito nao encontrada.';
  END IF;

  v_limite := round(coalesce(v_sol.limite_aprovado, 0), 2);
  IF v_limite <= 0 THEN
    RAISE EXCEPTION 'Solicitacao sem limite aprovado.';
  END IF;

  SELECT * INTO v_cli
  FROM public.clientes
  WHERE id = v_sol.cliente_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Cliente da solicitacao nao encontrado.';
  END IF;

  IF v_sol.status = 'liberado' THEN
    RETURN jsonb_build_object('success', true, 'already_processed', true, 'cliente_id', v_cli.id, 'solicitacao_id', v_sol.id);
  END IF;

  v_diff := v_limite - coalesce(v_cli.limite_credito_total, 0);
  v_novo_disponivel := CASE
    WHEN coalesce(v_cli.limite_credito_total, 0) = 0 THEN v_limite
    ELSE greatest(0, coalesce(v_cli.limite_credito_disponivel, 0) + v_diff)
  END;

  UPDATE public.clientes
     SET limite_credito_total = v_limite,
         limite_credito_disponivel = v_novo_disponivel,
         opcao_pagamento_parcelado = v_sol.opcao_pagamento_parcelado,
         max_parcelas = coalesce(v_sol.max_parcelas, 12),
         updated_at = now()
   WHERE id = v_cli.id;

  UPDATE public.loja_credito_solicitacoes
     SET status = 'liberado',
         data_liberacao_credito = current_date,
         updated_at = now()
   WHERE id = v_sol.id;

  INSERT INTO public.loja_credito_movimentacoes(
    cliente_id, solicitacao_id, tipo, valor,
    limite_total_anterior, limite_total_novo,
    limite_disponivel_anterior, limite_disponivel_novo,
    descricao
  )
  VALUES (
    v_cli.id,
    v_sol.id,
    'concessao_inicial',
    v_limite,
    coalesce(v_cli.limite_credito_total, 0),
    v_limite,
    coalesce(v_cli.limite_credito_disponivel, 0),
    v_novo_disponivel,
    'Liberacao inicial de credito aprovado via solicitacao. Contrato assinado. [POR: ' || v_actor.ator_nome || ']'
  );

  RETURN jsonb_build_object(
    'success', true,
    'already_processed', false,
    'cliente_id', v_cli.id,
    'solicitacao_id', v_sol.id,
    'limite_total_novo', v_limite,
    'limite_disponivel_novo', v_novo_disponivel
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.gsa_admin_ajustar_limite_credito_cliente(
  p_sessao_id uuid,
  p_session_token text,
  p_cliente_id uuid,
  p_novo_limite_total numeric,
  p_descricao text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_actor record;
  v_cli clientes%rowtype;
  v_novo_total numeric := round(coalesce(p_novo_limite_total, 0), 2);
  v_descricao text := nullif(trim(coalesce(p_descricao, '')), '');
  v_diff numeric;
  v_novo_disponivel numeric;
BEGIN
  IF v_novo_total < 0 THEN
    RAISE EXCEPTION 'Limite total nao pode ser negativo.';
  END IF;

  IF v_descricao IS NULL THEN
    RAISE EXCEPTION 'Descricao do ajuste e obrigatoria.';
  END IF;

  SELECT * INTO v_actor FROM public.gsa_admin_session_actor(p_sessao_id, p_session_token) LIMIT 1;

  SELECT * INTO v_cli
  FROM public.clientes
  WHERE id = p_cliente_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Cliente nao encontrado.';
  END IF;

  v_diff := v_novo_total - coalesce(v_cli.limite_credito_total, 0);
  v_novo_disponivel := greatest(0, coalesce(v_cli.limite_credito_disponivel, 0) + v_diff);

  UPDATE public.clientes
     SET limite_credito_total = v_novo_total,
         limite_credito_disponivel = v_novo_disponivel,
         updated_at = now()
   WHERE id = p_cliente_id;

  INSERT INTO public.loja_credito_movimentacoes(
    cliente_id, tipo, valor,
    limite_total_anterior, limite_total_novo,
    limite_disponivel_anterior, limite_disponivel_novo,
    descricao
  )
  VALUES (
    p_cliente_id,
    CASE WHEN v_diff >= 0 THEN 'ajuste_adm_aumento' ELSE 'ajuste_adm_reducao' END,
    abs(v_diff),
    coalesce(v_cli.limite_credito_total, 0),
    v_novo_total,
    coalesce(v_cli.limite_credito_disponivel, 0),
    v_novo_disponivel,
    'Ajuste manual de limite pelo ADM. Motivo: ' || v_descricao || ' [POR: ' || v_actor.ator_nome || ']'
  );

  RETURN jsonb_build_object(
    'success', true,
    'cliente_id', p_cliente_id,
    'limite_total_anterior', coalesce(v_cli.limite_credito_total, 0),
    'limite_total_novo', v_novo_total,
    'limite_disponivel_novo', v_novo_disponivel
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.gsa_admin_definir_parcelamento_credito(
  p_sessao_id uuid,
  p_session_token text,
  p_cliente_id uuid,
  p_opcao_pagamento_parcelado boolean
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_actor record;
BEGIN
  SELECT * INTO v_actor FROM public.gsa_admin_session_actor(p_sessao_id, p_session_token) LIMIT 1;

  IF NOT EXISTS (SELECT 1 FROM public.clientes WHERE id = p_cliente_id FOR UPDATE) THEN
    RAISE EXCEPTION 'Cliente nao encontrado.';
  END IF;

  UPDATE public.clientes
     SET opcao_pagamento_parcelado = coalesce(p_opcao_pagamento_parcelado, false),
         updated_at = now()
   WHERE id = p_cliente_id;

  RETURN jsonb_build_object(
    'success', true,
    'cliente_id', p_cliente_id,
    'opcao_pagamento_parcelado', coalesce(p_opcao_pagamento_parcelado, false),
    'ator_nome', v_actor.ator_nome
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.gsa_admin_aprovar_aumento_credito(uuid, text, uuid, numeric) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.gsa_admin_liberar_credito_contrato(uuid, text, uuid) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.gsa_admin_ajustar_limite_credito_cliente(uuid, text, uuid, numeric, text) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.gsa_admin_definir_parcelamento_credito(uuid, text, uuid, boolean) TO anon, authenticated;
