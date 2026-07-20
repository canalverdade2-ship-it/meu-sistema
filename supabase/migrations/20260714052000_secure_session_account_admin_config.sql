-- Replace legacy RPCs that accepted raw administrative credentials with
-- session-bound operations and remove credential-bearing debug data.

TRUNCATE TABLE public.debug_admin_rpc;
ALTER TABLE public.debug_admin_rpc ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.debug_admin_rpc FROM public, anon, authenticated;

CREATE OR REPLACE FUNCTION public.gsa_admin_can_configure(
  p_sessao_id uuid,
  p_session_token text
)
RETURNS TABLE(ator_tipo text, ator_id uuid, ator_nome text)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_actor record;
BEGIN
  SELECT * INTO v_actor
  FROM public.gsa_admin_session_actor(p_sessao_id, p_session_token)
  LIMIT 1;

  IF v_actor.ator_tipo = 'colaborador'
     AND NOT EXISTS (
       SELECT 1
       FROM public.colaborador_modulos cm
       WHERE cm.colaborador_id = v_actor.ator_id
         AND cm.modulo_id IN ('configuracoes', 'configuração', 'configuracoes_sistema')
     ) THEN
    RAISE EXCEPTION 'Colaborador sem permissao para configuracoes.';
  END IF;

  ator_tipo := v_actor.ator_tipo;
  ator_id := v_actor.ator_id;
  ator_nome := v_actor.ator_nome;
  RETURN NEXT;
END;
$$;

CREATE OR REPLACE FUNCTION public.gsa_admin_upsert_settings(
  p_sessao_id uuid,
  p_session_token text,
  p_settings jsonb
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  v_actor record;
  v_setting record;
BEGIN
  SELECT * INTO v_actor
  FROM public.gsa_admin_can_configure(p_sessao_id, p_session_token)
  LIMIT 1;

  IF jsonb_typeof(p_settings) <> 'array' OR jsonb_array_length(p_settings) = 0 THEN
    RAISE EXCEPTION 'Lista de configuracoes invalida.';
  END IF;
  IF jsonb_array_length(p_settings) > 100 THEN
    RAISE EXCEPTION 'Limite de configuracoes por operacao excedido.';
  END IF;

  FOR v_setting IN
    SELECT trim(x.key) AS key, x.value
    FROM jsonb_to_recordset(p_settings) AS x(key text, value text)
  LOOP
    IF nullif(v_setting.key, '') IS NULL OR length(v_setting.key) > 120 THEN
      RAISE EXCEPTION 'Chave de configuracao invalida.';
    END IF;
    IF length(coalesce(v_setting.value, '')) > 20000 THEN
      RAISE EXCEPTION 'Valor de configuracao excede o limite permitido.';
    END IF;

    IF v_setting.key IN ('master_api_key', 'smtp_password') THEN
      IF v_actor.ator_tipo <> 'admin' THEN
        RAISE EXCEPTION 'Apenas o administrador master pode alterar segredos.';
      END IF;
    END IF;

    IF v_setting.key = 'admin_access_code' THEN
      IF v_actor.ator_tipo <> 'admin' THEN
        RAISE EXCEPTION 'Apenas o administrador master pode alterar o codigo de acesso.';
      END IF;
      IF length(coalesce(v_setting.value, '')) < 8 THEN
        RAISE EXCEPTION 'O novo codigo administrativo deve ter pelo menos 8 caracteres.';
      END IF;

      INSERT INTO public.system_settings(key, value, value_hash, must_change_code, updated_at)
      VALUES (
        v_setting.key,
        v_setting.value,
        extensions.crypt(v_setting.value, extensions.gen_salt('bf', 12)),
        false,
        now()
      )
      ON CONFLICT (key) DO UPDATE
        SET value = excluded.value,
            value_hash = excluded.value_hash,
            must_change_code = false,
            updated_at = now();
    ELSE
      INSERT INTO public.system_settings(key, value, must_change_code, updated_at)
      VALUES (v_setting.key, coalesce(v_setting.value, ''), false, now())
      ON CONFLICT (key) DO UPDATE
        SET value = excluded.value,
            updated_at = now();
    END IF;
  END LOOP;

  INSERT INTO public.sistema_logs(acao, detalhes, ator_tipo, ator_id, ator_nome)
  VALUES (
    'ATUALIZAR_CONFIGURACOES',
    jsonb_build_object(
      'chaves', (SELECT jsonb_agg(value ->> 'key') FROM jsonb_array_elements(p_settings)),
      'quantidade', jsonb_array_length(p_settings)
    )::text,
    v_actor.ator_tipo,
    v_actor.ator_id,
    v_actor.ator_nome
  );

  RETURN true;
END;
$$;

CREATE OR REPLACE FUNCTION public.gsa_verify_own_pin(
  p_sessao_id uuid,
  p_session_token text,
  p_pin text
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  v_session record;
  v_pin_hash text;
BEGIN
  SELECT * INTO v_session
  FROM public.gsa_validate_session(p_sessao_id, p_session_token)
  LIMIT 1;

  IF NOT coalesce(v_session.is_valid, false)
     OR v_session.ator_tipo NOT IN ('cliente', 'prestador') THEN
    RAISE EXCEPTION 'Sessao invalida ou expirada.';
  END IF;

  IF v_session.ator_tipo = 'cliente' THEN
    SELECT pin_hash INTO v_pin_hash FROM public.clientes WHERE id = v_session.ator_id;
  ELSE
    SELECT pin_hash INTO v_pin_hash FROM public.prestadores WHERE id = v_session.ator_id;
  END IF;

  RETURN v_pin_hash IS NOT NULL
     AND p_pin ~ '^\d{4}$'
     AND extensions.crypt(p_pin, v_pin_hash) = v_pin_hash;
END;
$$;

CREATE OR REPLACE FUNCTION public.gsa_change_own_pin(
  p_sessao_id uuid,
  p_session_token text,
  p_current_pin text,
  p_new_pin text
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  v_session record;
BEGIN
  SELECT * INTO v_session
  FROM public.gsa_validate_session(p_sessao_id, p_session_token)
  LIMIT 1;

  IF NOT coalesce(v_session.is_valid, false)
     OR v_session.ator_tipo NOT IN ('cliente', 'prestador') THEN
    RAISE EXCEPTION 'Sessao invalida ou expirada.';
  END IF;
  IF NOT public.gsa_verify_own_pin(p_sessao_id, p_session_token, p_current_pin) THEN
    RAISE EXCEPTION 'Senha atual incorreta.';
  END IF;
  IF p_new_pin !~ '^\d{4}$' THEN
    RAISE EXCEPTION 'A nova senha deve ter exatamente 4 digitos.';
  END IF;
  IF p_new_pin = p_current_pin THEN
    RAISE EXCEPTION 'A nova senha deve ser diferente da senha atual.';
  END IF;

  IF v_session.ator_tipo = 'cliente' THEN
    UPDATE public.clientes
       SET pin_hash = extensions.crypt(p_new_pin, extensions.gen_salt('bf', 12)),
           pin_tentativas = 0,
           pin_bloqueado = false,
           updated_at = now()
     WHERE id = v_session.ator_id;
  ELSE
    UPDATE public.prestadores
       SET pin_hash = extensions.crypt(p_new_pin, extensions.gen_salt('bf', 12)),
           pin_tentativas = 0,
           pin_bloqueado = false,
           updated_at = now()
     WHERE id = v_session.ator_id;
  END IF;

  INSERT INTO public.sistema_logs(acao, detalhes, ator_tipo, ator_id, ator_nome)
  VALUES (
    'ALTERAR_PIN',
    'Senha de acesso alterada pelo proprio usuario.',
    v_session.ator_tipo,
    v_session.ator_id,
    v_session.ator_nome
  );

  RETURN true;
END;
$$;

CREATE OR REPLACE FUNCTION public.gsa_admin_reset_actor_pin(
  p_sessao_id uuid,
  p_session_token text,
  p_actor_id uuid,
  p_actor_type text
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_actor record;
  v_updated integer;
BEGIN
  SELECT * INTO v_actor
  FROM public.gsa_admin_session_actor(p_sessao_id, p_session_token)
  LIMIT 1;

  IF p_actor_type = 'cliente' THEN
    UPDATE public.clientes
       SET pin_hash = null, pin_tentativas = 0, pin_bloqueado = false, updated_at = now()
     WHERE id = p_actor_id;
  ELSIF p_actor_type = 'prestador' THEN
    UPDATE public.prestadores
       SET pin_hash = null, pin_tentativas = 0, pin_bloqueado = false, updated_at = now()
     WHERE id = p_actor_id;
  ELSE
    RAISE EXCEPTION 'Tipo de usuario invalido.';
  END IF;

  GET DIAGNOSTICS v_updated = ROW_COUNT;
  IF v_updated = 0 THEN
    RAISE EXCEPTION 'Usuario nao encontrado.';
  END IF;

  UPDATE public.sistema_sessoes
     SET status = 'encerrado', encerrado_em = coalesce(encerrado_em, now())
   WHERE ator_id = p_actor_id
     AND ator_tipo = p_actor_type
     AND status = 'ativo';

  INSERT INTO public.sistema_logs(acao, detalhes, ator_tipo, ator_id, ator_nome)
  VALUES (
    'RESETAR_PIN',
    jsonb_build_object('usuario_id', p_actor_id, 'usuario_tipo', p_actor_type)::text,
    v_actor.ator_tipo,
    v_actor.ator_id,
    v_actor.ator_nome
  );

  RETURN true;
END;
$$;

CREATE OR REPLACE FUNCTION public.gsa_admin_delete_record_secure(
  p_sessao_id uuid,
  p_session_token text,
  p_table text,
  p_id uuid
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_actor record;
  v_deleted integer;
  v_table text := lower(trim(coalesce(p_table, '')));
BEGIN
  SELECT * INTO v_actor
  FROM public.gsa_admin_session_actor(p_sessao_id, p_session_token)
  LIMIT 1;

  IF v_actor.ator_tipo <> 'admin' THEN
    RAISE EXCEPTION 'A exclusao permanente exige administrador master.';
  END IF;
  IF v_table NOT IN ('funcoes', 'colaboradores') THEN
    RAISE EXCEPTION 'Tabela nao permitida para exclusao administrativa.';
  END IF;

  EXECUTE format('DELETE FROM public.%I WHERE id = $1', v_table) USING p_id;
  GET DIAGNOSTICS v_deleted = ROW_COUNT;
  IF v_deleted = 0 THEN
    RAISE EXCEPTION 'Registro nao encontrado.';
  END IF;

  IF v_table = 'colaboradores' THEN
    UPDATE public.sistema_sessoes
       SET status = 'encerrado', encerrado_em = coalesce(encerrado_em, now())
     WHERE ator_id = p_id AND status = 'ativo';
  END IF;

  INSERT INTO public.sistema_logs(acao, detalhes, ator_tipo, ator_id, ator_nome)
  VALUES (
    'EXCLUIR_REGISTRO_ADMIN',
    jsonb_build_object('tabela', v_table, 'registro_id', p_id)::text,
    v_actor.ator_tipo,
    v_actor.ator_id,
    v_actor.ator_nome
  );

  RETURN true;
END;
$$;

CREATE OR REPLACE FUNCTION public.gsa_admin_cancelar_demanda(
  p_sessao_id uuid,
  p_session_token text,
  p_demanda_id uuid,
  p_motivo text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_actor record;
  v_demanda record;
  v_motivo text := trim(coalesce(p_motivo, ''));
BEGIN
  SELECT * INTO v_actor
  FROM public.gsa_admin_session_actor(p_sessao_id, p_session_token)
  LIMIT 1;

  IF v_motivo = '' THEN
    RAISE EXCEPTION 'Motivo do cancelamento obrigatorio.';
  END IF;

  SELECT d.*, os.orcamento_id
    INTO v_demanda
  FROM public.prestador_demandas d
  LEFT JOIN public.ordens_servico os ON os.id = d.os_id
  WHERE d.id = p_demanda_id
  FOR UPDATE OF d;

  IF v_demanda.id IS NULL THEN
    RAISE EXCEPTION 'Demanda nao encontrada.';
  END IF;
  IF v_demanda.status = 'cancelada' THEN
    RETURN jsonb_build_object('success', true, 'already_processed', true);
  END IF;

  UPDATE public.prestador_demandas
     SET status = 'cancelada', updated_at = now()
   WHERE id = p_demanda_id;

  IF v_demanda.os_id IS NOT NULL THEN
    UPDATE public.ordens_servico
       SET status = 'cancelado', motivo_cancelamento = v_motivo
     WHERE id = v_demanda.os_id
       AND status <> 'cancelado';

    INSERT INTO public.os_notas(os_id, nota)
    SELECT v_demanda.os_id, 'Cancelamento administrativo. Motivo: ' || v_motivo
    WHERE NOT EXISTS (
      SELECT 1 FROM public.os_notas
       WHERE os_id = v_demanda.os_id
         AND nota = 'Cancelamento administrativo. Motivo: ' || v_motivo
    );
  END IF;

  IF v_demanda.orcamento_id IS NOT NULL THEN
    UPDATE public.orcamentos
       SET status = 'cancelado', motivo_cancelamento = v_motivo
     WHERE id = v_demanda.orcamento_id
       AND status <> 'cancelado';
  END IF;

  INSERT INTO public.prestador_demandas_historico(
    demanda_id, tipo_evento, motivo, colaborador_origem_id
  ) VALUES (
    p_demanda_id,
    'cancelamento',
    'Cancelada por ' || v_actor.ator_nome || '. Motivo: ' || v_motivo,
    CASE WHEN v_actor.ator_tipo = 'colaborador' THEN v_actor.ator_id ELSE null END
  );

  INSERT INTO public.sistema_logs(acao, detalhes, ator_tipo, ator_id, ator_nome)
  VALUES (
    'CANCELAR_DEMANDA_PRESTADOR',
    jsonb_build_object('demanda_id', p_demanda_id, 'motivo', v_motivo)::text,
    v_actor.ator_tipo,
    v_actor.ator_id,
    v_actor.ator_nome
  );

  RETURN jsonb_build_object('success', true, 'demanda_id', p_demanda_id);
END;
$$;

REVOKE EXECUTE ON FUNCTION public.admin_upsert_settings(text, jsonb) FROM public, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.admin_delete_record(text, text, uuid) FROM public, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.reset_pin(uuid, text) FROM public, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.admin_cancelar_demanda_segura(text, uuid, text, text, text) FROM public, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.admin_cancelar_demanda_segura(text, uuid, uuid, text, text) FROM public, anon, authenticated;
REVOKE ALL ON FUNCTION public.gsa_admin_can_configure(uuid, text) FROM public, anon, authenticated;

GRANT EXECUTE ON FUNCTION public.gsa_admin_upsert_settings(uuid, text, jsonb) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.gsa_verify_own_pin(uuid, text, text) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.gsa_change_own_pin(uuid, text, text, text) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.gsa_admin_reset_actor_pin(uuid, text, uuid, text) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.gsa_admin_delete_record_secure(uuid, text, text, uuid) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.gsa_admin_cancelar_demanda(uuid, text, uuid, text) TO anon, authenticated;

