BEGIN;

-- Auditoria imutável das operações executadas pelo prestador.
CREATE TABLE IF NOT EXISTS public.gsa_provider_audit_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  provider_id uuid NOT NULL REFERENCES public.prestadores(id) ON DELETE CASCADE,
  action text NOT NULL,
  target_type text,
  target_id uuid,
  details jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.gsa_provider_audit_events ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.gsa_provider_audit_events FROM anon, authenticated;

-- Contexto autenticado que permite perfil, documentos e suporte, mas revoga cadastros encerrados.
CREATE OR REPLACE FUNCTION public.gsa_assert_current_provider_any_status()
RETURNS uuid
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_provider_id uuid;
  v_status text;
  v_session_id text := COALESCE(auth.jwt() -> 'app_metadata' ->> 'gsa_session_id', '');
BEGIN
  IF public.gsa_current_actor_type() <> 'prestador' OR v_session_id = '' THEN
    RAISE EXCEPTION 'Sessão segura do prestador inválida ou expirada.' USING ERRCODE = '42501';
  END IF;

  v_provider_id := public.gsa_current_actor_id();
  IF v_provider_id IS NULL THEN
    RAISE EXCEPTION 'Identidade do prestador inválida.' USING ERRCODE = '42501';
  END IF;

  SELECT p.status INTO v_status
  FROM public.prestadores p
  WHERE p.id = v_provider_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Cadastro do prestador não encontrado.' USING ERRCODE = '42501';
  END IF;

  IF COALESCE(v_status, '') IN ('bloqueado', 'inativo', 'desligado') THEN
    RAISE EXCEPTION 'Acesso do prestador revogado.' USING ERRCODE = '42501';
  END IF;

  RETURN v_provider_id;
END;
$$;

-- Toda RPC operacional já existente passa automaticamente a exigir cadastro ativo.
CREATE OR REPLACE FUNCTION public.gsa_assert_current_provider()
RETURNS uuid
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_provider_id uuid := public.gsa_assert_current_provider_any_status();
  v_status text;
BEGIN
  SELECT p.status INTO v_status
  FROM public.prestadores p
  WHERE p.id = v_provider_id;

  IF COALESCE(v_status, '') <> 'ativo' THEN
    RAISE EXCEPTION 'Esta operação está disponível somente para prestadores ativos.' USING ERRCODE = '42501';
  END IF;

  RETURN v_provider_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.gsa_provider_write_audit(
  p_provider_id uuid,
  p_action text,
  p_target_type text DEFAULT NULL,
  p_target_id uuid DEFAULT NULL,
  p_details jsonb DEFAULT '{}'::jsonb
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_id uuid;
BEGIN
  INSERT INTO public.gsa_provider_audit_events(provider_id, action, target_type, target_id, details)
  VALUES (p_provider_id, p_action, p_target_type, p_target_id, COALESCE(p_details, '{}'::jsonb))
  RETURNING id INTO v_id;
  RETURN v_id;
END;
$$;

-- Notificações administrativas geradas dentro da mesma transação da operação.
CREATE OR REPLACE FUNCTION public.gsa_provider_notify_admin(
  p_title text,
  p_message text,
  p_module text,
  p_action text,
  p_item_id uuid DEFAULT NULL,
  p_priority text DEFAULT 'normal',
  p_context jsonb DEFAULT '{}'::jsonb
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  PERFORM set_config('gsa.provider_internal_write', 'on', true);
  INSERT INTO public.notificacoes(
    titulo, mensagem, modulo, item_id, destinatario_tipo,
    prioridade, acao_origem, contexto, tipo, lida, data_criacao
  ) VALUES (
    left(COALESCE(p_title, 'Notificação do prestador'), 180),
    left(COALESCE(p_message, ''), 2000),
    left(COALESCE(p_module, 'sistema'), 80),
    p_item_id,
    'admin',
    CASE WHEN p_priority IN ('baixa', 'normal', 'alta', 'urgente') THEN p_priority ELSE 'normal' END,
    left(COALESCE(p_action, 'manual'), 100),
    COALESCE(p_context, '{}'::jsonb),
    'sistema',
    false,
    now()
  );
  PERFORM set_config('gsa.provider_internal_write', 'off', true);
END;
$$;

-- Bloqueia gravações forjadas diretamente pelo navegador do prestador.
CREATE OR REPLACE FUNCTION public.gsa_guard_provider_direct_insert()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  IF public.gsa_current_actor_type() = 'prestador'
     AND COALESCE(current_setting('gsa.provider_internal_write', true), 'off') <> 'on' THEN
    RAISE EXCEPTION 'A operação deve ser executada pelo serviço seguro do prestador.' USING ERRCODE = '42501';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_guard_provider_ticket_insert ON public.tickets;
CREATE TRIGGER trg_guard_provider_ticket_insert
BEFORE INSERT ON public.tickets
FOR EACH ROW EXECUTE FUNCTION public.gsa_guard_provider_direct_insert();

DROP TRIGGER IF EXISTS trg_guard_provider_ticket_message_insert ON public.ticket_mensagens;
CREATE TRIGGER trg_guard_provider_ticket_message_insert
BEFORE INSERT ON public.ticket_mensagens
FOR EACH ROW EXECUTE FUNCTION public.gsa_guard_provider_direct_insert();

DROP TRIGGER IF EXISTS trg_guard_provider_demand_support_insert ON public.prestador_suporte_demandas;
CREATE TRIGGER trg_guard_provider_demand_support_insert
BEFORE INSERT ON public.prestador_suporte_demandas
FOR EACH ROW EXECUTE FUNCTION public.gsa_guard_provider_direct_insert();

DROP TRIGGER IF EXISTS trg_guard_provider_notification_insert ON public.notificacoes;
CREATE TRIGGER trg_guard_provider_notification_insert
BEFORE INSERT ON public.notificacoes
FOR EACH ROW EXECUTE FUNCTION public.gsa_guard_provider_direct_insert();

-- Perfil, documentos e notificações continuam disponíveis em análise, mas não para acesso revogado.
CREATE OR REPLACE FUNCTION public.gsa_provider_mark_notification_read(p_notificacao_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_provider_id uuid := public.gsa_assert_current_provider_any_status();
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM public.notificacoes n
    WHERE n.id = p_notificacao_id
      AND (n.prestador_id = v_provider_id OR n.destinatario_tipo IN ('broadcast_prestadores', 'broadcast_todos'))
  ) THEN
    RAISE EXCEPTION 'Notificação não encontrada para este prestador';
  END IF;

  INSERT INTO public.notificacao_leituras(notificacao_id, ator_tipo, ator_id)
  VALUES (p_notificacao_id, 'prestador', v_provider_id)
  ON CONFLICT (notificacao_id, ator_tipo, ator_id) DO UPDATE SET lida_em = now();
  RETURN jsonb_build_object('success', true);
END;
$$;

CREATE OR REPLACE FUNCTION public.gsa_provider_mark_all_notifications_read()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_provider_id uuid := public.gsa_assert_current_provider_any_status();
BEGIN
  INSERT INTO public.notificacao_leituras(notificacao_id, ator_tipo, ator_id)
  SELECT n.id, 'prestador', v_provider_id
  FROM public.notificacoes n
  WHERE n.prestador_id = v_provider_id OR n.destinatario_tipo IN ('broadcast_prestadores', 'broadcast_todos')
  ON CONFLICT (notificacao_id, ator_tipo, ator_id) DO UPDATE SET lida_em = now();
  RETURN jsonb_build_object('success', true);
END;
$$;

CREATE OR REPLACE FUNCTION public.gsa_provider_update_profile(
  p_telefone text,
  p_cep text,
  p_numero text,
  p_area_servico text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_provider_id uuid := public.gsa_assert_current_provider_any_status();
BEGIN
  IF length(COALESCE(p_numero, '')) > 30 OR length(COALESCE(p_area_servico, '')) > 180 THEN
    RAISE EXCEPTION 'Dados cadastrais acima do tamanho permitido';
  END IF;

  UPDATE public.prestadores
  SET telefone = NULLIF(regexp_replace(COALESCE(p_telefone, ''), '\D', '', 'g'), ''),
      cep = NULLIF(regexp_replace(COALESCE(p_cep, ''), '\D', '', 'g'), ''),
      numero = NULLIF(trim(COALESCE(p_numero, '')), ''),
      area_servico = NULLIF(trim(COALESCE(p_area_servico, '')), '')
  WHERE id = v_provider_id;

  PERFORM public.gsa_provider_write_audit(v_provider_id, 'PROFILE_UPDATED', 'prestador', v_provider_id);
  RETURN jsonb_build_object('success', true);
END;
$$;

CREATE OR REPLACE FUNCTION public.gsa_provider_submit_document(p_documento_id uuid, p_urls text[])
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_provider_id uuid := public.gsa_assert_current_provider_any_status();
  v_reference text;
BEGIN
  IF COALESCE(array_length(p_urls, 1), 0) = 0 OR array_length(p_urls, 1) > 5 THEN
    RAISE EXCEPTION 'Envie entre um e cinco arquivos';
  END IF;

  FOREACH v_reference IN ARRAY p_urls LOOP
    IF v_reference !~ ('^storage://documentos_prestador/' || v_provider_id::text || '/documentos/') THEN
      RAISE EXCEPTION 'Referência de documento inválida';
    END IF;
  END LOOP;

  UPDATE public.prestador_documentos
  SET urls = p_urls, status = 'em_analise', motivo_rejeicao = NULL, updated_at = now()
  WHERE id = p_documento_id AND prestador_id = v_provider_id AND status IN ('pendente', 'reprovado');

  IF NOT FOUND THEN RAISE EXCEPTION 'Documento não encontrado ou indisponível para envio'; END IF;
  RETURN jsonb_build_object('success', true);
END;
$$;

-- Operações seguras de suporte.
CREATE OR REPLACE FUNCTION public.gsa_provider_create_ticket(p_subject text, p_description text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_provider_id uuid := public.gsa_assert_current_provider_any_status();
  v_ticket_id uuid;
BEGIN
  IF length(trim(COALESCE(p_subject, ''))) < 3 OR length(trim(COALESCE(p_subject, ''))) > 180 THEN
    RAISE EXCEPTION 'Assunto inválido';
  END IF;
  IF length(trim(COALESCE(p_description, ''))) < 3 OR length(trim(COALESCE(p_description, ''))) > 4000 THEN
    RAISE EXCEPTION 'Descrição inválida';
  END IF;

  IF EXISTS (
    SELECT 1 FROM public.tickets
    WHERE prestador_id = v_provider_id
      AND assunto = trim(p_subject)
      AND status <> 'concluido'
  ) THEN
    RAISE EXCEPTION 'Já existe um atendimento aberto com este assunto';
  END IF;

  PERFORM set_config('gsa.provider_internal_write', 'on', true);
  INSERT INTO public.tickets(prestador_id, assunto, descricao, status)
  VALUES (v_provider_id, trim(p_subject), trim(p_description), 'aberto')
  RETURNING id INTO v_ticket_id;
  PERFORM set_config('gsa.provider_internal_write', 'off', true);

  PERFORM public.gsa_provider_write_audit(v_provider_id, 'TICKET_CREATED', 'ticket', v_ticket_id);
  PERFORM public.gsa_provider_notify_admin(
    'Novo ticket de prestador',
    'Novo atendimento aberto: ' || trim(p_subject) || '.',
    'suporte', 'ticket_aberto_prestador', v_ticket_id, 'normal',
    jsonb_build_object('prestador_id', v_provider_id)
  );

  RETURN jsonb_build_object('success', true, 'ticket_id', v_ticket_id);
END;
$$;

CREATE OR REPLACE FUNCTION public.gsa_provider_send_ticket_message(
  p_ticket_id uuid,
  p_message text DEFAULT NULL,
  p_attachment text DEFAULT NULL,
  p_attachment_type text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_provider_id uuid := public.gsa_assert_current_provider_any_status();
  v_provider_name text;
  v_status text;
  v_message_id uuid;
BEGIN
  IF COALESCE(trim(p_message), '') = '' AND COALESCE(trim(p_attachment), '') = '' THEN
    RAISE EXCEPTION 'Informe uma mensagem ou anexo';
  END IF;
  IF length(COALESCE(p_message, '')) > 4000 THEN RAISE EXCEPTION 'Mensagem acima do tamanho permitido'; END IF;

  SELECT t.status INTO v_status
  FROM public.tickets t
  WHERE t.id = p_ticket_id AND t.prestador_id = v_provider_id
  FOR UPDATE;
  IF NOT FOUND OR v_status = 'concluido' THEN RAISE EXCEPTION 'Atendimento não encontrado ou concluído'; END IF;

  IF COALESCE(p_attachment, '') <> ''
     AND p_attachment !~ ('^storage://documentos_prestador/' || v_provider_id::text || '/chat/' || p_ticket_id::text || '/') THEN
    RAISE EXCEPTION 'Referência de anexo inválida';
  END IF;

  SELECT nome_razao INTO v_provider_name FROM public.prestadores WHERE id = v_provider_id;
  PERFORM set_config('gsa.provider_internal_write', 'on', true);
  INSERT INTO public.ticket_mensagens(
    ticket_id, autor_id, autor_nome, mensagem, anexo_url, anexo_tipo, tipo
  ) VALUES (
    p_ticket_id, v_provider_id, COALESCE(v_provider_name, 'Prestador'),
    NULLIF(trim(COALESCE(p_message, '')), ''), NULLIF(trim(COALESCE(p_attachment, '')), ''),
    NULLIF(trim(COALESCE(p_attachment_type, '')), ''), 'prestador'
  ) RETURNING id INTO v_message_id;
  PERFORM set_config('gsa.provider_internal_write', 'off', true);

  PERFORM public.gsa_provider_write_audit(v_provider_id, 'TICKET_MESSAGE_SENT', 'ticket', p_ticket_id,
    jsonb_build_object('message_id', v_message_id, 'has_attachment', COALESCE(p_attachment, '') <> ''));
  PERFORM public.gsa_provider_notify_admin(
    'Nova mensagem de prestador',
    'Nova mensagem no ticket #' || left(p_ticket_id::text, 8) || '.',
    'suporte', 'ticket_mensagem_recebida', p_ticket_id, 'normal',
    jsonb_build_object('prestador_id', v_provider_id)
  );

  RETURN jsonb_build_object('success', true, 'message_id', v_message_id);
END;
$$;

CREATE OR REPLACE FUNCTION public.gsa_provider_request_profile_change(
  p_label text,
  p_current_value text,
  p_new_value text,
  p_reason text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_subject text;
BEGIN
  PERFORM public.gsa_assert_current_provider_any_status();
  IF length(trim(COALESCE(p_label, ''))) < 2 OR length(trim(COALESCE(p_new_value, ''))) < 1
     OR length(trim(COALESCE(p_reason, ''))) < 3 THEN
    RAISE EXCEPTION 'Preencha a alteração e o motivo';
  END IF;
  v_subject := 'Solicitação de alteração: ' || left(trim(p_label), 120);
  RETURN public.gsa_provider_create_ticket(
    v_subject,
    'Valor atual: ' || left(COALESCE(p_current_value, ''), 500) || E'\nNovo valor solicitado: ' ||
    left(trim(p_new_value), 500) || E'\nMotivo: ' || left(trim(p_reason), 1500)
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.gsa_provider_request_demand_support(p_demanda_id uuid, p_message text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_provider_id uuid := public.gsa_assert_current_provider();
  v_title text;
  v_id uuid;
BEGIN
  IF length(trim(COALESCE(p_message, ''))) < 3 OR length(trim(COALESCE(p_message, ''))) > 3000 THEN
    RAISE EXCEPTION 'Mensagem de suporte inválida';
  END IF;

  SELECT COALESCE(titulo, p_demanda_id::text) INTO v_title
  FROM public.prestador_demandas
  WHERE id = p_demanda_id AND prestador_id = v_provider_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Demanda não encontrada para este prestador'; END IF;

  IF EXISTS (
    SELECT 1 FROM public.prestador_suporte_demandas
    WHERE demanda_id = p_demanda_id AND prestador_id = v_provider_id AND status IN ('aberto', 'em andamento')
  ) THEN
    RAISE EXCEPTION 'Já existe uma solicitação de suporte aberta para esta demanda';
  END IF;

  PERFORM set_config('gsa.provider_internal_write', 'on', true);
  INSERT INTO public.prestador_suporte_demandas(demanda_id, prestador_id, mensagem, status)
  VALUES (p_demanda_id, v_provider_id, trim(p_message), 'aberto')
  RETURNING id INTO v_id;
  PERFORM set_config('gsa.provider_internal_write', 'off', true);

  PERFORM public.gsa_provider_write_audit(v_provider_id, 'DEMAND_SUPPORT_REQUESTED', 'demanda', p_demanda_id,
    jsonb_build_object('support_id', v_id));
  PERFORM public.gsa_provider_notify_admin(
    'Suporte solicitado em demanda',
    'O prestador solicitou suporte na demanda "' || left(v_title, 160) || '".',
    'demandas', 'ticket_aberto_prestador', p_demanda_id, 'alta',
    jsonb_build_object('prestador_id', v_provider_id, 'support_id', v_id)
  );
  RETURN jsonb_build_object('success', true, 'support_id', v_id);
END;
$$;

-- Snapshot seguro para o dashboard e contadores, sem carregar todas as linhas no navegador.
CREATE OR REPLACE FUNCTION public.gsa_provider_dashboard_snapshot()
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_provider_id uuid := public.gsa_assert_current_provider_any_status();
  v_balance numeric := 0;
  v_demands integer := 0;
  v_schedules integer := 0;
  v_documents integer := 0;
BEGIN
  SELECT COALESCE(SUM(CASE WHEN tipo = 'credito' THEN valor ELSE -valor END), 0)
  INTO v_balance FROM public.prestador_transacoes
  WHERE prestador_id = v_provider_id AND status = 'concluido';

  SELECT count(*) INTO v_demands FROM public.prestador_demandas
  WHERE prestador_id = v_provider_id AND status IN ('concluida', 'finalizada', 'concluida_interna');
  SELECT count(*) INTO v_schedules FROM public.prestador_agendamentos
  WHERE prestador_id = v_provider_id AND status = 'concluido';
  SELECT count(*) INTO v_documents FROM public.prestador_documentos
  WHERE prestador_id = v_provider_id AND status = 'aprovado';

  RETURN jsonb_build_object(
    'success', true, 'saldo', v_balance, 'demandas_concluidas', v_demands,
    'agendamentos_concluidos', v_schedules, 'documentos_aprovados', v_documents
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.gsa_provider_pendency_snapshot()
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_provider_id uuid := public.gsa_assert_current_provider_any_status();
  v_new integer; v_negotiation integer; v_active integer; v_agenda integer;
  v_withdrawals integer; v_vouchers integer; v_tickets integer; v_documents integer;
  v_prizes integer; v_promotions integer;
BEGIN
  SELECT
    count(*) FILTER (WHERE status IN ('aguardando_aceite', 'aberta')),
    count(*) FILTER (WHERE status IN ('em_negociacao', 'contraproposta_prestador', 'contraproposta_admin_final')),
    count(*) FILTER (WHERE status IN ('ativa', 'em_analise', 'em_ajuste'))
  INTO v_new, v_negotiation, v_active
  FROM public.prestador_demandas WHERE prestador_id = v_provider_id;

  SELECT count(*) INTO v_agenda FROM public.prestador_agendamentos WHERE prestador_id = v_provider_id AND status = 'agendado';
  SELECT count(*) INTO v_withdrawals FROM public.prestador_saques WHERE prestador_id = v_provider_id AND status = 'pendente';
  SELECT count(*) INTO v_vouchers FROM public.prestador_vouchers WHERE prestador_id = v_provider_id AND status IN ('ativo', 'disponivel');
  SELECT count(*) INTO v_tickets FROM public.tickets WHERE prestador_id = v_provider_id AND status <> 'concluido';
  SELECT count(*) INTO v_documents FROM public.prestador_documentos WHERE prestador_id = v_provider_id AND status IN ('pendente', 'reprovado');
  SELECT count(*) INTO v_prizes FROM public.prestador_premios WHERE prestador_id = v_provider_id AND status = 'disponivel';
  SELECT count(*) INTO v_promotions FROM public.prestador_promocoes
  WHERE status = 'ativa' AND (data_inicio IS NULL OR data_inicio <= current_date) AND (data_fim IS NULL OR data_fim >= current_date);

  RETURN jsonb_build_object(
    'demandas_novas', v_new, 'demandas_negociacao', v_negotiation, 'servicos_ativos', v_active,
    'agendamentos_pendentes', v_agenda, 'financeiro_saques_pendentes', v_withdrawals,
    'vouchers_ativos', v_vouchers, 'suporte_tickets_ativos', v_tickets,
    'suporte_mensagens_nao_lidas', 0, 'documentos_pendentes', v_documents,
    'premios_pendentes', v_prizes, 'promocoes_ativas', v_promotions
  );
END;
$$;

-- Agenda serializada por prestador para eliminar corrida entre abas e dispositivos.
CREATE OR REPLACE FUNCTION public.gsa_provider_create_schedule(
  p_demanda_id uuid,
  p_data_inicio timestamptz,
  p_data_fim timestamptz,
  p_observacoes text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_provider_id uuid := public.gsa_assert_current_provider();
  v_id uuid;
BEGIN
  IF p_data_inicio < now() THEN RAISE EXCEPTION 'Não é permitido agendar no passado'; END IF;
  IF p_data_fim <= p_data_inicio THEN RAISE EXCEPTION 'A data final deve ser posterior à inicial'; END IF;
  IF p_data_fim - p_data_inicio > interval '30 days' THEN RAISE EXCEPTION 'Duração do agendamento inválida'; END IF;
  IF length(COALESCE(p_observacoes, '')) > 1500 THEN RAISE EXCEPTION 'Observações acima do tamanho permitido'; END IF;

  PERFORM pg_advisory_xact_lock(hashtextextended(v_provider_id::text, 35900));
  IF NOT EXISTS (
    SELECT 1 FROM public.prestador_demandas
    WHERE id = p_demanda_id AND prestador_id = v_provider_id AND status IN ('ativa', 'em_ajuste')
  ) THEN RAISE EXCEPTION 'Demanda não disponível para agendamento'; END IF;

  IF EXISTS (
    SELECT 1 FROM public.prestador_agendamentos
    WHERE prestador_id = v_provider_id AND status = 'agendado'
      AND tstzrange(data_inicio, data_fim, '[)') && tstzrange(p_data_inicio, p_data_fim, '[)')
  ) THEN RAISE EXCEPTION 'Existe conflito com outro agendamento'; END IF;

  INSERT INTO public.prestador_agendamentos(prestador_id, demanda_id, data_inicio, data_fim, observacoes, status)
  VALUES (v_provider_id, p_demanda_id, p_data_inicio, p_data_fim, NULLIF(trim(COALESCE(p_observacoes, '')), ''), 'agendado')
  RETURNING id INTO v_id;
  RETURN jsonb_build_object('success', true, 'agendamento_id', v_id);
END;
$$;

CREATE OR REPLACE FUNCTION public.gsa_provider_complete_schedule(p_agendamento_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_provider_id uuid := public.gsa_assert_current_provider();
BEGIN
  UPDATE public.prestador_agendamentos
  SET status = 'concluido'
  WHERE id = p_agendamento_id AND prestador_id = v_provider_id
    AND status = 'agendado' AND data_inicio <= now();
  IF NOT FOUND THEN RAISE EXCEPTION 'Agendamento não encontrado, futuro ou já finalizado'; END IF;
  RETURN jsonb_build_object('success', true);
END;
$$;

CREATE OR REPLACE FUNCTION public.gsa_provider_activate_promotion(p_promocao_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_provider_id uuid := public.gsa_assert_current_provider();
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM public.prestador_promocoes
    WHERE id = p_promocao_id AND status = 'ativa'
      AND (data_inicio IS NULL OR data_inicio <= current_date)
      AND (data_fim IS NULL OR data_fim >= current_date)
  ) THEN RAISE EXCEPTION 'Promoção não está disponível neste período'; END IF;

  INSERT INTO public.prestador_promocoes_ativacoes(prestador_id, promocao_id, ativa)
  VALUES (v_provider_id, p_promocao_id, true)
  ON CONFLICT (prestador_id, promocao_id) DO UPDATE SET ativa = true;
  RETURN jsonb_build_object('success', true);
END;
$$;

-- Máquina de estados com data real de entrega e validação de URLs/arquivos.
CREATE OR REPLACE FUNCTION public.gsa_provider_transition_demand(
  p_demanda_id uuid,
  p_action text,
  p_payload jsonb DEFAULT '{}'::jsonb
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_provider_id uuid := public.gsa_assert_current_provider();
  v_demand public.prestador_demandas%ROWTYPE;
  v_value numeric;
  v_reason text;
  v_files text[];
  v_file text;
  v_link text;
  v_notes text;
  v_event text;
  v_history text;
BEGIN
  SELECT * INTO v_demand FROM public.prestador_demandas
  WHERE id = p_demanda_id AND prestador_id = v_provider_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Demanda não encontrada para este prestador'; END IF;

  CASE p_action
    WHEN 'accept' THEN
      IF v_demand.status NOT IN ('aguardando_aceite', 'aberta', 'contraproposta_admin_final') THEN
        RAISE EXCEPTION 'A demanda não está disponível para aceite';
      END IF;
      v_value := COALESCE(v_demand.valor_proposto_admin, v_demand.valor_final, 0);
      IF v_value <= 0 THEN RAISE EXCEPTION 'A demanda não possui valor válido para aceite'; END IF;
      UPDATE public.prestador_demandas SET status = 'ativa', data_inicio = now(), valor_final = v_value WHERE id = p_demanda_id;
      v_event := 'aceite'; v_history := 'Proposta aceita pelo prestador pelo valor de ' || v_value::text;

    WHEN 'reject' THEN
      IF v_demand.status NOT IN ('aguardando_aceite', 'aberta', 'em_negociacao', 'contraproposta_admin_final') THEN
        RAISE EXCEPTION 'A demanda não está disponível para recusa';
      END IF;
      v_reason := NULLIF(trim(p_payload ->> 'motivo'), '');
      IF v_reason IS NULL OR length(v_reason) > 1500 THEN RAISE EXCEPTION 'Informe um motivo válido para a recusa'; END IF;
      UPDATE public.prestador_demandas SET status = 'aguardando_atribuicao', prestador_id = NULL WHERE id = p_demanda_id;
      v_event := 'recusa'; v_history := 'Proposta recusada pelo prestador. Motivo: ' || v_reason;

    WHEN 'counteroffer' THEN
      IF v_demand.status NOT IN ('aguardando_aceite', 'aberta', 'em_negociacao', 'contraproposta_admin_final') THEN
        RAISE EXCEPTION 'A demanda não está disponível para negociação';
      END IF;
      BEGIN v_value := NULLIF(p_payload ->> 'valor', '')::numeric;
      EXCEPTION WHEN invalid_text_representation THEN RAISE EXCEPTION 'Valor da contraproposta inválido'; END;
      IF v_value IS NULL OR v_value <= 0 OR v_value > 100000000 THEN RAISE EXCEPTION 'Valor da contraproposta inválido'; END IF;
      v_reason := NULLIF(trim(p_payload ->> 'motivo'), '');
      IF length(COALESCE(v_reason, '')) > 1500 THEN RAISE EXCEPTION 'Motivo acima do tamanho permitido'; END IF;
      UPDATE public.prestador_demandas
      SET status = 'contraproposta_prestador', valor_proposto_prestador = v_value, motivo_negociacao = v_reason
      WHERE id = p_demanda_id;
      v_event := 'negociacao'; v_history := 'Contraproposta do prestador: ' || v_value::text || COALESCE('. ' || v_reason, '');

    WHEN 'deliver' THEN
      IF v_demand.status NOT IN ('ativa', 'em_ajuste') THEN RAISE EXCEPTION 'A demanda não está disponível para entrega'; END IF;
      v_link := NULLIF(trim(p_payload ->> 'link'), '');
      v_notes := NULLIF(trim(p_payload ->> 'observacao'), '');
      IF v_link IS NOT NULL AND (length(v_link) > 2048 OR v_link !~* '^https?://[^[:space:]]+$') THEN
        RAISE EXCEPTION 'Informe um link HTTP ou HTTPS válido';
      END IF;
      IF length(COALESCE(v_notes, '')) > 3000 THEN RAISE EXCEPTION 'Observação acima do tamanho permitido'; END IF;
      v_files := ARRAY(SELECT jsonb_array_elements_text(COALESCE(p_payload -> 'arquivos', '[]'::jsonb)));
      IF COALESCE(array_length(v_files, 1), 0) > 10 THEN RAISE EXCEPTION 'Quantidade de arquivos acima do permitido'; END IF;
      FOREACH v_file IN ARRAY v_files LOOP
        IF v_file !~ ('^storage://entregas_demandas/' || v_provider_id::text || '/' || p_demanda_id::text || '/entrega/') THEN
          RAISE EXCEPTION 'Referência de entrega inválida';
        END IF;
      END LOOP;
      IF COALESCE(array_length(v_files, 1), 0) = 0 AND v_link IS NULL AND v_notes IS NULL THEN
        RAISE EXCEPTION 'Informe ao menos um arquivo, link ou observação de entrega';
      END IF;
      UPDATE public.prestador_demandas
      SET status = 'em_analise', data_entrega_prestador = now(), observacao_entrega = v_notes,
          link_resultado = v_link, arquivos_resultado = v_files,
          status_ajuste = CASE WHEN status_ajuste = 'solicitado' THEN 'entregue' ELSE status_ajuste END
      WHERE id = p_demanda_id;
      v_event := 'entrega'; v_history := 'Entrega realizada pelo prestador e enviada para análise.';

    WHEN 'return' THEN
      IF v_demand.status NOT IN ('ativa', 'em_ajuste') THEN RAISE EXCEPTION 'A demanda não pode ser devolvida neste status'; END IF;
      v_reason := NULLIF(trim(p_payload ->> 'motivo'), '');
      IF v_reason IS NULL OR length(v_reason) > 1500 THEN RAISE EXCEPTION 'Informe um motivo válido para a devolução'; END IF;
      v_files := ARRAY(SELECT jsonb_array_elements_text(COALESCE(p_payload -> 'arquivos', '[]'::jsonb)));
      IF COALESCE(array_length(v_files, 1), 0) > 10 THEN RAISE EXCEPTION 'Quantidade de arquivos acima do permitido'; END IF;
      FOREACH v_file IN ARRAY v_files LOOP
        IF v_file !~ ('^storage://entregas_demandas/' || v_provider_id::text || '/' || p_demanda_id::text || '/devolucao/') THEN
          RAISE EXCEPTION 'Referência de devolução inválida';
        END IF;
      END LOOP;
      UPDATE public.prestador_demandas
      SET prestador_id = NULL, status = 'aguardando_atribuicao',
          detalhes = COALESCE(detalhes, descricao, '') || E'\n\n--- DEVOLUÇÃO DO PRESTADOR ---\nMotivo: ' || v_reason,
          arquivos_transferencia = v_files
      WHERE id = p_demanda_id;
      v_event := 'transferencia'; v_history := 'Demanda devolvida para a equipe interna. Motivo: ' || v_reason;

    ELSE RAISE EXCEPTION 'Ação de demanda inválida';
  END CASE;

  INSERT INTO public.prestador_demandas_historico(demanda_id, tipo_evento, motivo, prestador_origem_id, valor_proposto)
  VALUES (p_demanda_id, v_event, v_history, v_provider_id, CASE WHEN p_action = 'counteroffer' THEN v_value ELSE NULL END);
  RETURN jsonb_build_object('success', true, 'action', p_action);
END;
$$;

-- Eventos transacionais: auditoria, notificação e notas no mesmo COMMIT da operação.
CREATE OR REPLACE FUNCTION public.gsa_provider_operation_event()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_provider_id uuid := COALESCE(NEW.prestador_id, OLD.prestador_id);
  v_action text;
  v_title text;
  v_message text;
  v_module text;
  v_item_id uuid := COALESCE(NEW.id, OLD.id);
BEGIN
  IF public.gsa_current_actor_type() <> 'prestador' THEN RETURN COALESCE(NEW, OLD); END IF;

  IF TG_TABLE_NAME = 'prestador_saques' THEN
    IF TG_OP = 'INSERT' THEN
      v_action := 'WITHDRAWAL_REQUESTED'; v_title := 'Novo saque solicitado';
      v_message := 'Um prestador solicitou saque de R$ ' || NEW.valor::text || '.'; v_module := 'financeiro';
    ELSIF NEW.status IS DISTINCT FROM OLD.status AND NEW.status = 'cancelado' THEN
      v_action := 'WITHDRAWAL_CANCELLED'; v_title := 'Saque cancelado pelo prestador';
      v_message := 'O prestador cancelou uma solicitação de saque.'; v_module := 'financeiro';
    ELSE RETURN NEW; END IF;
  ELSIF TG_TABLE_NAME = 'prestador_vouchers' AND NEW.status IS DISTINCT FROM OLD.status AND NEW.status = 'pago' THEN
    v_action := 'VOUCHER_REDEEMED'; v_title := 'Voucher resgatado pelo prestador';
    v_message := 'Voucher ' || COALESCE(NEW.codigo, NEW.id::text) || ' resgatado e creditado.'; v_module := 'vouchers';
  ELSIF TG_TABLE_NAME = 'prestador_premios' AND NEW.status IS DISTINCT FROM OLD.status AND NEW.status = 'resgatado' THEN
    v_action := 'PRIZE_REDEEMED'; v_title := 'Prêmio resgatado pelo prestador';
    v_message := 'O prêmio "' || COALESCE(NEW.titulo, NEW.id::text) || '" foi resgatado.'; v_module := 'premios';
  ELSIF TG_TABLE_NAME = 'prestador_promocoes_ativacoes' AND (TG_OP = 'INSERT' OR NEW.ativa IS DISTINCT FROM OLD.ativa) AND NEW.ativa THEN
    v_action := 'PROMOTION_ACTIVATED'; v_title := 'Participação em promoção';
    v_message := 'Um prestador confirmou participação em uma promoção.'; v_module := 'promocoes'; v_item_id := NEW.promocao_id;
  ELSIF TG_TABLE_NAME = 'prestador_agendamentos' THEN
    IF TG_OP = 'INSERT' THEN
      v_action := 'SCHEDULE_CREATED'; v_title := 'Novo agendamento do prestador'; v_message := 'Um novo agendamento foi criado.';
    ELSIF TG_OP = 'UPDATE' AND NEW.status IS DISTINCT FROM OLD.status AND NEW.status = 'concluido' THEN
      v_action := 'SCHEDULE_COMPLETED'; v_title := 'Agendamento concluído'; v_message := 'Um agendamento foi concluído pelo prestador.';
    ELSIF TG_OP = 'DELETE' THEN
      v_action := 'SCHEDULE_DELETED'; v_title := 'Agendamento removido'; v_message := 'Um agendamento foi removido pelo prestador.'; v_item_id := OLD.id;
    ELSE RETURN COALESCE(NEW, OLD); END IF;
    v_module := 'servicos';
  ELSIF TG_TABLE_NAME = 'prestador_documentos' AND NEW.status IS DISTINCT FROM OLD.status AND NEW.status = 'em_analise' THEN
    v_action := 'DOCUMENT_SUBMITTED'; v_title := 'Documento de prestador enviado';
    v_message := 'O prestador enviou o documento "' || COALESCE(NEW.nome, NEW.id::text) || '" para análise.'; v_module := 'cadastro';
  ELSIF TG_TABLE_NAME = 'prestador_demandas' AND NEW.status IS DISTINCT FROM OLD.status THEN
    v_module := 'demandas';
    IF NEW.status = 'ativa' THEN
      v_action := 'DEMAND_ACCEPTED'; v_title := 'Demanda aceita pelo prestador'; v_message := 'Uma demanda foi aceita e iniciada.';
    ELSIF NEW.status = 'contraproposta_prestador' THEN
      v_action := 'DEMAND_COUNTEROFFERED'; v_title := 'Contraproposta do prestador'; v_message := 'O prestador enviou uma contraproposta.';
    ELSIF NEW.status = 'em_analise' THEN
      v_action := 'DEMAND_DELIVERED'; v_title := 'Demanda entregue pelo prestador'; v_message := 'A demanda foi entregue e aguarda análise.';
      IF NEW.os_id IS NOT NULL THEN INSERT INTO public.os_notas(os_id, nota) VALUES (NEW.os_id, 'Serviço entregue pelo prestador e enviado para análise.'); END IF;
    ELSIF NEW.status = 'aguardando_atribuicao' AND NEW.prestador_id IS NULL THEN
      v_action := CASE WHEN OLD.status IN ('aguardando_aceite', 'aberta', 'em_negociacao', 'contraproposta_admin_final') THEN 'DEMAND_REJECTED' ELSE 'DEMAND_RETURNED' END;
      v_title := CASE WHEN v_action = 'DEMAND_REJECTED' THEN 'Demanda recusada pelo prestador' ELSE 'Demanda devolvida pelo prestador' END;
      v_message := CASE WHEN v_action = 'DEMAND_REJECTED' THEN 'Uma demanda foi recusada pelo prestador.' ELSE 'Uma demanda foi devolvida para reatribuição.' END;
      IF v_action = 'DEMAND_RETURNED' AND NEW.os_id IS NOT NULL THEN INSERT INTO public.os_notas(os_id, nota) VALUES (NEW.os_id, 'Demanda devolvida pelo prestador para reatribuição.'); END IF;
    ELSE RETURN NEW; END IF;
  ELSE RETURN COALESCE(NEW, OLD); END IF;

  PERFORM public.gsa_provider_write_audit(v_provider_id, v_action, TG_TABLE_NAME, v_item_id,
    jsonb_build_object('operation', TG_OP));
  PERFORM public.gsa_provider_notify_admin(v_title, v_message, v_module, lower(v_action), v_item_id,
    CASE WHEN v_action IN ('DEMAND_DELIVERED', 'DEMAND_RETURNED') THEN 'alta' ELSE 'normal' END,
    jsonb_build_object('prestador_id', v_provider_id));
  RETURN COALESCE(NEW, OLD);
END;
$$;

DROP TRIGGER IF EXISTS trg_provider_saque_event ON public.prestador_saques;
CREATE TRIGGER trg_provider_saque_event AFTER INSERT OR UPDATE ON public.prestador_saques
FOR EACH ROW EXECUTE FUNCTION public.gsa_provider_operation_event();
DROP TRIGGER IF EXISTS trg_provider_voucher_event ON public.prestador_vouchers;
CREATE TRIGGER trg_provider_voucher_event AFTER UPDATE ON public.prestador_vouchers
FOR EACH ROW EXECUTE FUNCTION public.gsa_provider_operation_event();
DROP TRIGGER IF EXISTS trg_provider_prize_event ON public.prestador_premios;
CREATE TRIGGER trg_provider_prize_event AFTER UPDATE ON public.prestador_premios
FOR EACH ROW EXECUTE FUNCTION public.gsa_provider_operation_event();
DROP TRIGGER IF EXISTS trg_provider_promotion_event ON public.prestador_promocoes_ativacoes;
CREATE TRIGGER trg_provider_promotion_event AFTER INSERT OR UPDATE ON public.prestador_promocoes_ativacoes
FOR EACH ROW EXECUTE FUNCTION public.gsa_provider_operation_event();
DROP TRIGGER IF EXISTS trg_provider_schedule_event ON public.prestador_agendamentos;
CREATE TRIGGER trg_provider_schedule_event AFTER INSERT OR UPDATE OR DELETE ON public.prestador_agendamentos
FOR EACH ROW EXECUTE FUNCTION public.gsa_provider_operation_event();
DROP TRIGGER IF EXISTS trg_provider_document_event ON public.prestador_documentos;
CREATE TRIGGER trg_provider_document_event AFTER UPDATE ON public.prestador_documentos
FOR EACH ROW EXECUTE FUNCTION public.gsa_provider_operation_event();
DROP TRIGGER IF EXISTS trg_provider_demand_event ON public.prestador_demandas;
CREATE TRIGGER trg_provider_demand_event AFTER UPDATE ON public.prestador_demandas
FOR EACH ROW EXECUTE FUNCTION public.gsa_provider_operation_event();

-- Limites reais nos buckets privados.
UPDATE storage.buckets SET public = false, file_size_limit = 15728640,
  allowed_mime_types = ARRAY[
    'application/pdf','image/jpeg','image/png','image/webp','text/plain','application/zip',
    'application/msword','application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/vnd.ms-excel','application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
  ]
WHERE id = 'documentos_prestador';
UPDATE storage.buckets SET public = false, file_size_limit = 26214400,
  allowed_mime_types = ARRAY[
    'application/pdf','image/jpeg','image/png','image/webp','text/plain','application/zip',
    'application/msword','application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/vnd.ms-excel','application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
  ]
WHERE id = 'entregas_demandas';

-- Colaborador acessa apenas o Storage correspondente ao seu módulo autorizado.
DROP POLICY IF EXISTS provider_private_files_select ON storage.objects;
CREATE POLICY provider_private_files_select ON storage.objects FOR SELECT TO authenticated
USING (
  CASE public.gsa_current_actor_type()
    WHEN 'admin' THEN bucket_id IN ('documentos_prestador', 'entregas_demandas')
    WHEN 'colaborador' THEN
      (bucket_id = 'documentos_prestador' AND (storage.foldername(name))[2] = 'documentos' AND public.gsa_admin_has_module('cadastro'))
      OR (bucket_id = 'documentos_prestador' AND (storage.foldername(name))[2] = 'chat' AND public.gsa_admin_has_module('atendimento'))
      OR (bucket_id = 'entregas_demandas' AND public.gsa_admin_has_module('operacoes'))
    WHEN 'prestador' THEN bucket_id IN ('documentos_prestador', 'entregas_demandas')
      AND (storage.foldername(name))[1] = public.gsa_assert_current_provider_any_status()::text
    ELSE false
  END
);

DROP POLICY IF EXISTS provider_private_files_insert ON storage.objects;
CREATE POLICY provider_private_files_insert ON storage.objects FOR INSERT TO authenticated
WITH CHECK (
  CASE public.gsa_current_actor_type()
    WHEN 'admin' THEN bucket_id IN ('documentos_prestador', 'entregas_demandas')
    WHEN 'colaborador' THEN
      (bucket_id = 'documentos_prestador' AND (storage.foldername(name))[2] = 'documents' AND public.gsa_admin_has_module('cadastro'))
      OR (bucket_id = 'documentos_prestador' AND (storage.foldername(name))[2] = 'chat' AND public.gsa_admin_has_module('atendimento'))
      OR (bucket_id = 'entregas_demandas' AND public.gsa_admin_has_module('operacoes'))
    WHEN 'prestador' THEN bucket_id IN ('documentos_prestador', 'entregas_demandas')
      AND (storage.foldername(name))[1] = public.gsa_assert_current_provider_any_status()::text
    ELSE false
  END
);

DROP POLICY IF EXISTS provider_private_files_update ON storage.objects;
CREATE POLICY provider_private_files_update ON storage.objects FOR UPDATE TO authenticated
USING (
  CASE public.gsa_current_actor_type()
    WHEN 'admin' THEN bucket_id IN ('documentos_prestador', 'entregas_demandas')
    WHEN 'colaborador' THEN
      (bucket_id = 'documentos_prestador' AND (storage.foldername(name))[2] = 'documentos' AND public.gsa_admin_has_module('cadastro'))
      OR (bucket_id = 'documentos_prestador' AND (storage.foldername(name))[2] = 'chat' AND public.gsa_admin_has_module('atendimento'))
      OR (bucket_id = 'entregas_demandas' AND public.gsa_admin_has_module('operacoes'))
    WHEN 'prestador' THEN bucket_id IN ('documentos_prestador', 'entregas_demandas')
      AND (storage.foldername(name))[1] = public.gsa_assert_current_provider_any_status()::text
    ELSE false
  END
)
WITH CHECK (
  CASE public.gsa_current_actor_type()
    WHEN 'admin' THEN bucket_id IN ('documentos_prestador', 'entregas_demandas')
    WHEN 'colaborador' THEN
      (bucket_id = 'documentos_prestador' AND (storage.foldername(name))[2] = 'documentos' AND public.gsa_admin_has_module('cadastro'))
      OR (bucket_id = 'documentos_prestador' AND (storage.foldername(name))[2] = 'chat' AND public.gsa_admin_has_module('atendimento'))
      OR (bucket_id = 'entregas_demandas' AND public.gsa_admin_has_module('operacoes'))
    WHEN 'prestador' THEN bucket_id IN ('documentos_prestador', 'entregas_demandas')
      AND (storage.foldername(name))[1] = public.gsa_assert_current_provider_any_status()::text
    ELSE false
  END
);

DROP POLICY IF EXISTS provider_private_files_delete ON storage.objects;
CREATE POLICY provider_private_files_delete ON storage.objects FOR DELETE TO authenticated
USING (
  CASE public.gsa_current_actor_type()
    WHEN 'admin' THEN bucket_id IN ('documentos_prestador', 'entregas_demandas')
    WHEN 'colaborador' THEN
      (bucket_id = 'documentos_prestador' AND (storage.foldername(name))[2] = 'documentos' AND public.gsa_admin_has_module('cadastro'))
      OR (bucket_id = 'documentos_prestador' AND (storage.foldername(name))[2] = 'chat' AND public.gsa_admin_has_module('atendimento'))
      OR (bucket_id = 'entregas_demandas' AND public.gsa_admin_has_module('operacoes'))
    WHEN 'prestador' THEN bucket_id IN ('documentos_prestador', 'entregas_demandas')
      AND (storage.foldername(name))[1] = public.gsa_assert_current_provider_any_status()::text
    ELSE false
  END
);

REVOKE ALL ON FUNCTION public.gsa_provider_write_audit(uuid, text, text, uuid, jsonb) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.gsa_provider_notify_admin(text, text, text, text, uuid, text, jsonb) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.gsa_guard_provider_direct_insert() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.gsa_provider_operation_event() FROM PUBLIC, anon, authenticated;

GRANT EXECUTE ON FUNCTION public.gsa_assert_current_provider_any_status() TO authenticated;
GRANT EXECUTE ON FUNCTION public.gsa_assert_current_provider() TO authenticated;
GRANT EXECUTE ON FUNCTION public.gsa_provider_create_ticket(text, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.gsa_provider_send_ticket_message(uuid, text, text, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.gsa_provider_request_profile_change(text, text, text, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.gsa_provider_request_demand_support(uuid, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.gsa_provider_dashboard_snapshot() TO authenticated;
GRANT EXECUTE ON FUNCTION public.gsa_provider_pendency_snapshot() TO authenticated;

COMMIT;
