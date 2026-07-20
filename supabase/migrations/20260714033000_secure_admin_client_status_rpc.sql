CREATE OR REPLACE FUNCTION public.gsa_admin_atualizar_status_cliente(
  p_sessao_id uuid,
  p_session_token text,
  p_cliente_id uuid,
  p_acao text,
  p_motivo text DEFAULT NULL,
  p_valor boolean DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_actor record;
  v_cliente clientes%rowtype;
  v_acao text := nullif(trim(coalesce(p_acao, '')), '');
  v_motivo text := nullif(trim(coalesce(p_motivo, '')), '');
  v_saque_liberado boolean;
  v_patch jsonb := '{}'::jsonb;
  v_has_bloqueado boolean;
  v_has_motivo_cadastro boolean;
  v_has_motivo_carteira boolean;
  v_has_motivo_pontos boolean;
BEGIN
  IF v_acao IS NULL THEN
    RAISE EXCEPTION 'Acao obrigatoria.';
  END IF;

  SELECT * INTO v_actor
  FROM public.gsa_admin_session_actor(p_sessao_id, p_session_token)
  LIMIT 1;

  SELECT * INTO v_cliente
  FROM public.clientes
  WHERE id = p_cliente_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Cliente nao encontrado.';
  END IF;

  SELECT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'clientes' AND column_name = 'bloqueado'
  ) INTO v_has_bloqueado;

  SELECT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'clientes' AND column_name = 'motivo_bloqueio_cadastro'
  ) INTO v_has_motivo_cadastro;

  SELECT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'clientes' AND column_name = 'motivo_bloqueio_carteira'
  ) INTO v_has_motivo_carteira;

  SELECT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'clientes' AND column_name = 'motivo_bloqueio_pontos'
  ) INTO v_has_motivo_pontos;

  IF v_acao = 'aprovar_cadastro' THEN
    UPDATE public.clientes
       SET status = 'ativo',
           carteira_bloqueada = false,
           pontos_bloqueados = false,
           cadastro_aprovado = true,
           updated_at = now()
     WHERE id = p_cliente_id;

    IF v_has_bloqueado THEN
      EXECUTE 'UPDATE public.clientes SET bloqueado = false WHERE id = $1' USING p_cliente_id;
    END IF;
    IF v_has_motivo_cadastro THEN
      EXECUTE 'UPDATE public.clientes SET motivo_bloqueio_cadastro = NULL WHERE id = $1' USING p_cliente_id;
    END IF;
    IF v_has_motivo_carteira THEN
      EXECUTE 'UPDATE public.clientes SET motivo_bloqueio_carteira = NULL WHERE id = $1' USING p_cliente_id;
    END IF;
    IF v_has_motivo_pontos THEN
      EXECUTE 'UPDATE public.clientes SET motivo_bloqueio_pontos = NULL WHERE id = $1' USING p_cliente_id;
    END IF;

    v_patch := jsonb_build_object(
      'status', 'ativo',
      'carteira_bloqueada', false,
      'pontos_bloqueados', false,
      'cadastro_aprovado', true
    );

  ELSIF v_acao = 'bloquear_cadastro' THEN
    IF v_motivo IS NULL THEN
      RAISE EXCEPTION 'Motivo do bloqueio e obrigatorio.';
    END IF;

    UPDATE public.clientes
       SET status = 'inativo',
           cadastro_aprovado = false,
           updated_at = now()
     WHERE id = p_cliente_id;

    IF v_has_bloqueado THEN
      EXECUTE 'UPDATE public.clientes SET bloqueado = true WHERE id = $1' USING p_cliente_id;
    END IF;
    IF v_has_motivo_cadastro THEN
      EXECUTE 'UPDATE public.clientes SET motivo_bloqueio_cadastro = $2 WHERE id = $1' USING p_cliente_id, v_motivo || ' [POR: ' || v_actor.ator_nome || ']';
    END IF;

    v_patch := jsonb_build_object('status', 'inativo', 'cadastro_aprovado', false);

  ELSIF v_acao = 'bloquear_carteira' THEN
    IF v_motivo IS NULL THEN
      RAISE EXCEPTION 'Motivo do bloqueio e obrigatorio.';
    END IF;

    UPDATE public.clientes
       SET carteira_bloqueada = true,
           updated_at = now()
     WHERE id = p_cliente_id;

    IF v_has_motivo_carteira THEN
      EXECUTE 'UPDATE public.clientes SET motivo_bloqueio_carteira = $2 WHERE id = $1' USING p_cliente_id, v_motivo || ' [POR: ' || v_actor.ator_nome || ']';
    END IF;

    v_patch := jsonb_build_object('carteira_bloqueada', true);

  ELSIF v_acao = 'desbloquear_carteira' THEN
    UPDATE public.clientes
       SET carteira_bloqueada = false,
           updated_at = now()
     WHERE id = p_cliente_id;

    IF v_has_motivo_carteira THEN
      EXECUTE 'UPDATE public.clientes SET motivo_bloqueio_carteira = NULL WHERE id = $1' USING p_cliente_id;
    END IF;

    v_patch := jsonb_build_object('carteira_bloqueada', false);

  ELSIF v_acao = 'bloquear_pontos' THEN
    IF v_motivo IS NULL THEN
      RAISE EXCEPTION 'Motivo do bloqueio e obrigatorio.';
    END IF;

    UPDATE public.clientes
       SET pontos_bloqueados = true,
           updated_at = now()
     WHERE id = p_cliente_id;

    IF v_has_motivo_pontos THEN
      EXECUTE 'UPDATE public.clientes SET motivo_bloqueio_pontos = $2 WHERE id = $1' USING p_cliente_id, v_motivo || ' [POR: ' || v_actor.ator_nome || ']';
    END IF;

    v_patch := jsonb_build_object('pontos_bloqueados', true);

  ELSIF v_acao = 'desbloquear_pontos' THEN
    UPDATE public.clientes
       SET pontos_bloqueados = false,
           updated_at = now()
     WHERE id = p_cliente_id;

    IF v_has_motivo_pontos THEN
      EXECUTE 'UPDATE public.clientes SET motivo_bloqueio_pontos = NULL WHERE id = $1' USING p_cliente_id;
    END IF;

    v_patch := jsonb_build_object('pontos_bloqueados', false);

  ELSIF v_acao = 'definir_saque_manual' THEN
    v_saque_liberado := coalesce(p_valor, NOT coalesce(v_cliente.saque_liberado_manual, false));

    UPDATE public.clientes
       SET saque_liberado_manual = v_saque_liberado,
           updated_at = now()
     WHERE id = p_cliente_id;

    v_patch := jsonb_build_object('saque_liberado_manual', v_saque_liberado);

  ELSE
    RAISE EXCEPTION 'Acao invalida: %', v_acao;
  END IF;

  RETURN jsonb_build_object(
    'success', true,
    'cliente_id', p_cliente_id,
    'acao', v_acao,
    'patch', v_patch,
    'ator_tipo', v_actor.ator_tipo,
    'ator_nome', v_actor.ator_nome
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.gsa_admin_atualizar_status_cliente(uuid, text, uuid, text, text, boolean) TO anon, authenticated;
