-- Correções definitivas da auditoria do Painel do Prestador.
-- Autorizações, operações de suporte, auditoria, notificações, agenda e Storage.

BEGIN;

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

CREATE OR REPLACE FUNCTION public.gsa_provider_context(p_require_active boolean DEFAULT false)
RETURNS jsonb
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_claims jsonb := COALESCE(auth.jwt(), '{}'::jsonb);
  v_actor_type text := COALESCE(v_claims -> 'app_metadata' ->> 'gsa_actor_type', '');
  v_actor_id_text text := COALESCE(v_claims -> 'app_metadata' ->> 'gsa_actor_id', '');
  v_session_id text := COALESCE(v_claims -> 'app_metadata' ->> 'gsa_session_id', '');
  v_provider public.prestadores%ROWTYPE;
  v_provider_id uuid;
BEGIN
  IF auth.uid() IS NULL OR v_actor_type <> 'prestador' OR v_actor_id_text = '' OR v_session_id = '' THEN
    RAISE EXCEPTION 'Sessão segura do prestador inválida ou expirada.' USING ERRCODE = '42501';
  END IF;

  BEGIN
    v_provider_id := v_actor_id_text::uuid;
  EXCEPTION WHEN invalid_text_representation THEN
    RAISE EXCEPTION 'Identidade do prestador inválida.' USING ERRCODE = '42501';
  END;

  SELECT * INTO v_provider
  FROM public.prestadores
  WHERE id = v_provider_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Cadastro do prestador não encontrado.' USING ERRCODE = '42501';
  END IF;

  IF COALESCE(v_provider.status, '') IN ('bloqueado', 'inativo', 'desligado') THEN
    RAISE EXCEPTION 'Acesso do prestador revogado.' USING ERRCODE = '42501';
  END IF;

  IF p_require_active AND COALESCE(v_provider.status, '') <> 'ativo' THEN
    RAISE EXCEPTION 'Esta operação exige cadastro ativo.' USING ERRCODE = '42501';
  END IF;

  -- A configuração é local à transação e permite distinguir RPCs de escritas REST diretas.
  PERFORM set_config('app.gsa_provider_rpc', 'on', true);

  RETURN jsonb_build_object(
    'provider_id', v_provider.id,
    'provider_name', v_provider.nome_razao,
    'status', v_provider.status,
    'session_id', v_session_id
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.gsa_assert_current_provider()
RETURNS uuid
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  RETURN (public.gsa_provider_context(false) ->> 'provider_id')::uuid;
END;
$$;

CREATE OR REPLACE FUNCTION public.gsa_assert_current_provider_active()
RETURNS uuid
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  RETURN (public.gsa_provider_context(true) ->> 'provider_id')::uuid;
END;
$$;

CREATE OR REPLACE FUNCTION public.gsa_provider_write_audit(
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
  v_context jsonb := public.gsa_provider_context(false);
  v_id uuid;
BEGIN
  INSERT INTO public.gsa_provider_audit_events(provider_id, action, target_type, target_id, details)
  VALUES (
    (v_context ->> 'provider_id')::uuid,
    left(COALESCE(p_action, 'unknown'), 120),
    NULLIF(left(COALESCE(p_target_type, ''), 80), ''),
    p_target_id,
    COALESCE(p_details, '{}'::jsonb)
  ) RETURNING id INTO v_id;
  RETURN v_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.gsa_provider_insert_admin_notification(
  p_title text,
  p_message text,
  p_module text,
  p_action text,
  p_item_id uuid DEFAULT NULL,
  p_priority text DEFAULT 'normal',
  p_context jsonb DEFAULT '{}'::jsonb
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_id uuid;
BEGIN
  INSERT INTO public.notificacoes(
    titulo, mensagem, modulo, item_id, destinatario_tipo,
    prioridade, acao_origem, contexto, tipo, lida, data_criacao
  ) VALUES (
    left(COALESCE(p_title, 'Ação do prestador'), 180),
    left(COALESCE(p_message, ''), 2000),
    left(COALESCE(p_module, 'sistema'), 80),
    p_item_id,
    'admin',
    CASE WHEN p_priority IN ('baixa', 'normal', 'alta', 'urgente') THEN p_priority ELSE 'normal' END,
    left(COALESCE(p_action, 'manual'), 120),
    COALESCE(p_context, '{}'::jsonb),
    'sistema', false, now()
  ) RETURNING id INTO v_id;
  RETURN v_id;
END;
$$;

-- Bloqueia qualquer escrita REST direta feita por prestador nas tabelas operacionais.
CREATE OR REPLACE FUNCTION public.gsa_guard_provider_direct_write()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_actor_type text := COALESCE(auth.jwt() -> 'app_metadata' ->> 'gsa_actor_type', '');
  v_provider_id_text text := COALESCE(auth.jwt() -> 'app_metadata' ->> 'gsa_actor_id', '');
  v_status text;
  v_active_tables text[] := ARRAY[
    'prestador_transacoes', 'prestador_saques', 'prestador_vouchers',
    'prestador_premios', 'prestador_promocoes_ativacoes',
    'prestador_agendamentos', 'prestador_demandas',
    'prestador_demandas_historico', 'os_notas'
  ];
BEGIN
  IF v_actor_type <> 'prestador' THEN
    RETURN CASE WHEN TG_OP = 'DELETE' THEN OLD ELSE NEW END;
  END IF;

  IF COALESCE(current_setting('app.gsa_provider_rpc', true), '') <> 'on' THEN
    RAISE EXCEPTION 'Escrita direta não permitida. Utilize a operação segura do portal.' USING ERRCODE = '42501';
  END IF;

  IF TG_TABLE_NAME = ANY(v_active_tables) THEN
    SELECT status INTO v_status
    FROM public.prestadores
    WHERE id = NULLIF(v_provider_id_text, '')::uuid;
    IF COALESCE(v_status, '') <> 'ativo' THEN
      RAISE EXCEPTION 'Esta operação exige cadastro ativo.' USING ERRCODE = '42501';
    END IF;
  END IF;

  RETURN CASE WHEN TG_OP = 'DELETE' THEN OLD ELSE NEW END;
EXCEPTION WHEN invalid_text_representation THEN
  RAISE EXCEPTION 'Identidade do prestador inválida.' USING ERRCODE = '42501';
END;
$$;

DO $$
DECLARE
  v_table text;
  v_trigger text;
BEGIN
  FOREACH v_table IN ARRAY ARRAY[
    'tickets', 'ticket_mensagens', 'notificacoes', 'prestador_suporte_demandas',
    'prestador_transacoes', 'prestador_saques', 'prestador_vouchers',
    'prestador_premios', 'prestador_promocoes_ativacoes',
    'prestador_agendamentos', 'prestador_documentos', 'prestador_demandas',
    'prestador_demandas_historico', 'os_notas'
  ] LOOP
    IF to_regclass('public.' || v_table) IS NOT NULL THEN
      v_trigger := 'trg_guard_provider_direct_' || v_table;
      EXECUTE format('DROP TRIGGER IF EXISTS %I ON public.%I', v_trigger, v_table);
      EXECUTE format(
        'CREATE TRIGGER %I BEFORE INSERT OR UPDATE OR DELETE ON public.%I FOR EACH ROW EXECUTE FUNCTION public.gsa_guard_provider_direct_write()',
        v_trigger, v_table
      );
    END IF;
  END LOOP;
END $$;

-- Serialização definitiva de agenda e impedimento de conclusão antecipada.
CREATE OR REPLACE FUNCTION public.gsa_guard_provider_schedule()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN RETURN OLD; END IF;

  IF NEW.status = 'agendado' THEN
    IF NEW.data_inicio < now() THEN RAISE EXCEPTION 'Não é permitido agendar no passado'; END IF;
    IF NEW.data_fim <= NEW.data_inicio THEN RAISE EXCEPTION 'A data final deve ser posterior à inicial'; END IF;

    PERFORM pg_advisory_xact_lock(hashtextextended(NEW.prestador_id::text, 9217));
    IF EXISTS (
      SELECT 1
      FROM public.prestador_agendamentos a
      WHERE a.prestador_id = NEW.prestador_id
        AND a.status = 'agendado'
        AND a.id IS DISTINCT FROM NEW.id
        AND tstzrange(a.data_inicio, a.data_fim, '[)') && tstzrange(NEW.data_inicio, NEW.data_fim, '[)')
    ) THEN
      RAISE EXCEPTION 'Existe conflito com outro agendamento';
    END IF;
  END IF;

  IF TG_OP = 'UPDATE' AND OLD.status = 'agendado' AND NEW.status = 'concluido' AND OLD.data_fim > now() THEN
    RAISE EXCEPTION 'O agendamento só pode ser concluído após o horário final';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_guard_provider_schedule ON public.prestador_agendamentos;
CREATE TRIGGER trg_guard_provider_schedule
BEFORE INSERT OR UPDATE OR DELETE ON public.prestador_agendamentos
FOR EACH ROW EXECUTE FUNCTION public.gsa_guard_provider_schedule();

-- Valida entregas, referências privadas e período de promoções no próprio banco.
CREATE OR REPLACE FUNCTION public.gsa_validate_provider_operational_row()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_provider_id text := COALESCE(auth.jwt() -> 'app_metadata' ->> 'gsa_actor_id', '');
  v_reference text;
  v_promotion public.prestador_promocoes%ROWTYPE;
BEGIN
  IF COALESCE(auth.jwt() -> 'app_metadata' ->> 'gsa_actor_type', '') <> 'prestador' THEN
    RETURN NEW;
  END IF;

  IF TG_TABLE_NAME = 'prestador_demandas' AND TG_OP = 'UPDATE' THEN
    IF NEW.status = 'em_analise' AND OLD.status IN ('ativa', 'em_ajuste') THEN
      NEW.data_entrega_prestador := now();
      IF NEW.link_resultado IS NOT NULL AND (
        length(NEW.link_resultado) > 2048 OR NEW.link_resultado !~* '^https?://'
      ) THEN
        RAISE EXCEPTION 'O link da entrega deve utilizar HTTP ou HTTPS';
      END IF;
      IF length(COALESCE(NEW.observacao_entrega, '')) > 4000 THEN
        RAISE EXCEPTION 'A observação da entrega ultrapassa o limite permitido';
      END IF;
      FOREACH v_reference IN ARRAY COALESCE(NEW.arquivos_resultado, ARRAY[]::text[]) LOOP
        IF v_reference !~ ('^storage://entregas_demandas/' || v_provider_id || '/') THEN
          RAISE EXCEPTION 'Referência de arquivo da entrega inválida';
        END IF;
      END LOOP;
    END IF;
  ELSIF TG_TABLE_NAME = 'prestador_documentos' AND TG_OP = 'UPDATE' AND NEW.status = 'em_analise' THEN
    FOREACH v_reference IN ARRAY COALESCE(NEW.urls, ARRAY[]::text[]) LOOP
      IF v_reference !~ ('^storage://documentos_prestador/' || v_provider_id || '/') THEN
        RAISE EXCEPTION 'Referência de documento inválida';
      END IF;
    END LOOP;
  ELSIF TG_TABLE_NAME = 'prestador_promocoes_ativacoes' AND COALESCE(NEW.ativa, false) THEN
    SELECT * INTO v_promotion FROM public.prestador_promocoes WHERE id = NEW.promocao_id;
    IF NOT FOUND OR v_promotion.status <> 'ativa'
       OR (v_promotion.data_inicio IS NOT NULL AND v_promotion.data_inicio > current_date)
       OR (v_promotion.data_fim IS NOT NULL AND v_promotion.data_fim < current_date) THEN
      RAISE EXCEPTION 'A promoção não está disponível neste período';
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_validate_provider_demand ON public.prestador_demandas;
CREATE TRIGGER trg_validate_provider_demand
BEFORE UPDATE ON public.prestador_demandas
FOR EACH ROW EXECUTE FUNCTION public.gsa_validate_provider_operational_row();

DROP TRIGGER IF EXISTS trg_validate_provider_document ON public.prestador_documentos;
CREATE TRIGGER trg_validate_provider_document
BEFORE UPDATE ON public.prestador_documentos
FOR EACH ROW EXECUTE FUNCTION public.gsa_validate_provider_operational_row();

DROP TRIGGER IF EXISTS trg_validate_provider_promotion ON public.prestador_promocoes_ativacoes;
CREATE TRIGGER trg_validate_provider_promotion
BEFORE INSERT OR UPDATE ON public.prestador_promocoes_ativacoes
FOR EACH ROW EXECUTE FUNCTION public.gsa_validate_provider_operational_row();

-- Eventos administrativos e auditoria passam a fazer parte da mesma transação da ação principal.
CREATE OR REPLACE FUNCTION public.gsa_emit_provider_operational_event()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_context jsonb;
  v_provider_id uuid;
  v_provider_name text;
  v_target_id uuid;
  v_title text;
  v_message text;
  v_module text := 'sistema';
  v_action text := 'manual';
  v_priority text := 'normal';
  v_os_id uuid;
BEGIN
  IF COALESCE(auth.jwt() -> 'app_metadata' ->> 'gsa_actor_type', '') <> 'prestador'
     OR COALESCE(current_setting('app.gsa_provider_rpc', true), '') <> 'on' THEN
    RETURN CASE WHEN TG_OP = 'DELETE' THEN OLD ELSE NEW END;
  END IF;

  v_context := public.gsa_provider_context(false);
  v_provider_id := (v_context ->> 'provider_id')::uuid;
  v_provider_name := v_context ->> 'provider_name';
  v_target_id := CASE WHEN TG_OP = 'DELETE' THEN OLD.id ELSE NEW.id END;

  IF TG_TABLE_NAME = 'prestador_saques' AND TG_OP = 'INSERT' THEN
    v_title := 'Novo saque solicitado';
    v_message := v_provider_name || ' solicitou um saque.';
    v_module := 'financeiro'; v_action := 'prestador_saque_solicitado'; v_priority := 'alta';
  ELSIF TG_TABLE_NAME = 'prestador_saques' AND TG_OP = 'UPDATE' AND OLD.status IS DISTINCT FROM NEW.status AND NEW.status = 'cancelado' THEN
    v_title := 'Saque cancelado pelo prestador';
    v_message := v_provider_name || ' cancelou uma solicitação de saque.';
    v_module := 'financeiro'; v_action := 'manual';
  ELSIF TG_TABLE_NAME = 'prestador_vouchers' AND TG_OP = 'UPDATE' AND OLD.status IS DISTINCT FROM NEW.status AND NEW.status = 'pago' THEN
    v_title := 'Voucher resgatado pelo prestador';
    v_message := v_provider_name || ' resgatou o voucher ' || COALESCE(NEW.codigo, NEW.id::text) || '.';
    v_module := 'vouchers'; v_action := 'voucher_resgate_solicitado';
  ELSIF TG_TABLE_NAME = 'prestador_premios' AND TG_OP = 'UPDATE' AND OLD.status IS DISTINCT FROM NEW.status AND NEW.status = 'resgatado' THEN
    v_title := 'Prêmio resgatado pelo prestador';
    v_message := v_provider_name || ' resgatou o prêmio ' || COALESCE(NEW.titulo, NEW.id::text) || '.';
    v_module := 'premios'; v_action := 'premio_resgate_solicitado';
  ELSIF TG_TABLE_NAME = 'prestador_promocoes_ativacoes' AND COALESCE(NEW.ativa, false) AND (TG_OP = 'INSERT' OR COALESCE(OLD.ativa, false) = false) THEN
    v_title := 'Participação em promoção';
    v_message := v_provider_name || ' confirmou participação em uma promoção.';
    v_module := 'promocoes'; v_action := 'prestador_promocao_ativada';
  ELSIF TG_TABLE_NAME = 'prestador_agendamentos' AND TG_OP = 'INSERT' THEN
    v_title := 'Novo agendamento do prestador';
    v_message := v_provider_name || ' criou um agendamento.';
    v_module := 'servicos'; v_action := 'manual';
  ELSIF TG_TABLE_NAME = 'prestador_agendamentos' AND TG_OP = 'UPDATE' AND OLD.status IS DISTINCT FROM NEW.status AND NEW.status = 'concluido' THEN
    v_title := 'Agendamento concluído';
    v_message := v_provider_name || ' concluiu um agendamento.';
    v_module := 'servicos'; v_action := 'manual';
  ELSIF TG_TABLE_NAME = 'prestador_documentos' AND TG_OP = 'UPDATE' AND OLD.status IS DISTINCT FROM NEW.status AND NEW.status = 'em_analise' THEN
    v_title := 'Documento de prestador enviado';
    v_message := v_provider_name || ' enviou o documento ' || COALESCE(NEW.nome, NEW.id::text) || ' para análise.';
    v_module := 'cadastro'; v_action := 'documento_prestador_enviado';
  ELSIF TG_TABLE_NAME = 'prestador_demandas' AND TG_OP = 'UPDATE' AND OLD.status IS DISTINCT FROM NEW.status THEN
    v_os_id := NEW.os_id;
    IF NEW.status = 'ativa' THEN
      v_title := 'Demanda aceita pelo prestador'; v_action := 'manual';
      v_message := v_provider_name || ' aceitou a demanda.';
    ELSIF NEW.status = 'contraproposta_prestador' THEN
      v_title := 'Contraproposta do prestador'; v_action := 'demanda_contraproposta_prestador';
      v_message := v_provider_name || ' enviou uma contraproposta.';
    ELSIF NEW.status = 'em_analise' THEN
      v_title := 'Demanda entregue pelo prestador'; v_action := 'demanda_entregue'; v_priority := 'alta';
      v_message := v_provider_name || ' entregou a demanda para análise.';
      IF v_os_id IS NOT NULL THEN
        INSERT INTO public.os_notas(os_id, nota)
        VALUES (v_os_id, 'Serviço entregue pelo prestador e enviado para análise.');
      END IF;
    ELSIF NEW.status = 'aguardando_atribuicao' AND OLD.prestador_id = v_provider_id THEN
      v_title := 'Demanda devolvida pelo prestador'; v_action := 'demanda_transferida'; v_priority := 'alta';
      v_message := v_provider_name || ' devolveu a demanda para reatribuição.';
      IF v_os_id IS NOT NULL THEN
        INSERT INTO public.os_notas(os_id, nota)
        VALUES (v_os_id, 'Demanda devolvida pelo prestador para reatribuição.');
      END IF;
    ELSE
      RETURN NEW;
    END IF;
    v_module := 'demandas';
  ELSE
    RETURN CASE WHEN TG_OP = 'DELETE' THEN OLD ELSE NEW END;
  END IF;

  PERFORM public.gsa_provider_insert_admin_notification(
    v_title, v_message, v_module, v_action, v_target_id, v_priority,
    jsonb_build_object('provider_id', v_provider_id, 'source_table', TG_TABLE_NAME)
  );
  PERFORM public.gsa_provider_write_audit(
    upper(TG_OP) || '_' || upper(TG_TABLE_NAME), TG_TABLE_NAME, v_target_id,
    jsonb_build_object('module', v_module, 'action', v_action)
  );

  RETURN CASE WHEN TG_OP = 'DELETE' THEN OLD ELSE NEW END;
END;
$$;

DO $$
DECLARE
  v_table text;
  v_trigger text;
BEGIN
  FOREACH v_table IN ARRAY ARRAY[
    'prestador_saques', 'prestador_vouchers', 'prestador_premios',
    'prestador_promocoes_ativacoes', 'prestador_agendamentos',
    'prestador_documentos', 'prestador_demandas'
  ] LOOP
    v_trigger := 'trg_emit_provider_event_' || v_table;
    EXECUTE format('DROP TRIGGER IF EXISTS %I ON public.%I', v_trigger, v_table);
    EXECUTE format(
      'CREATE TRIGGER %I AFTER INSERT OR UPDATE OR DELETE ON public.%I FOR EACH ROW EXECUTE FUNCTION public.gsa_emit_provider_operational_event()',
      v_trigger, v_table
    );
  END LOOP;
END $$;

CREATE OR REPLACE FUNCTION public.gsa_provider_dashboard_snapshot()
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_context jsonb := public.gsa_provider_context(false);
  v_provider_id uuid := (v_context ->> 'provider_id')::uuid;
  v_active boolean := (v_context ->> 'status') = 'ativo';
BEGIN
  RETURN jsonb_build_object(
    'success', true,
    'saldo', CASE WHEN v_active THEN (
      SELECT COALESCE(SUM(CASE WHEN tipo = 'credito' THEN valor ELSE -valor END), 0)
      FROM public.prestador_transacoes
      WHERE prestador_id = v_provider_id AND status = 'concluido'
    ) ELSE 0 END,
    'demandas_concluidas', (
      SELECT count(*) FROM public.prestador_demandas
      WHERE prestador_id = v_provider_id AND status IN ('concluida', 'finalizada', 'concluida_interna')
    ),
    'agendamentos_concluidos', (
      SELECT count(*) FROM public.prestador_agendamentos
      WHERE prestador_id = v_provider_id AND status = 'concluido'
    ),
    'documentos_aprovados', (
      SELECT count(*) FROM public.prestador_documentos
      WHERE prestador_id = v_provider_id AND status = 'aprovado'
    )
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.gsa_provider_create_ticket(
  p_subject text,
  p_description text,
  p_deduplicate boolean DEFAULT false
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_context jsonb := public.gsa_provider_context(false);
  v_provider_id uuid := (v_context ->> 'provider_id')::uuid;
  v_provider_name text := v_context ->> 'provider_name';
  v_subject text := NULLIF(trim(p_subject), '');
  v_description text := NULLIF(trim(p_description), '');
  v_ticket_id uuid;
BEGIN
  IF v_subject IS NULL OR length(v_subject) > 180 THEN RAISE EXCEPTION 'Assunto inválido'; END IF;
  IF v_description IS NULL OR length(v_description) > 5000 THEN RAISE EXCEPTION 'Descrição inválida'; END IF;

  IF p_deduplicate THEN
    PERFORM pg_advisory_xact_lock(hashtextextended(v_provider_id::text || ':' || lower(v_subject), 517));
    SELECT id INTO v_ticket_id
    FROM public.tickets
    WHERE prestador_id = v_provider_id
      AND assunto = v_subject
      AND status <> 'concluido'
    ORDER BY data_abertura DESC
    LIMIT 1;
    IF v_ticket_id IS NOT NULL THEN
      RETURN jsonb_build_object('success', true, 'ticket_id', v_ticket_id, 'existing', true);
    END IF;
  END IF;

  INSERT INTO public.tickets(prestador_id, assunto, descricao, status)
  VALUES (v_provider_id, v_subject, v_description, 'aberto')
  RETURNING id INTO v_ticket_id;

  PERFORM public.gsa_provider_insert_admin_notification(
    'Novo ticket de prestador',
    v_provider_name || ' abriu o atendimento: ' || v_subject || '.',
    'suporte', 'ticket_aberto_prestador', v_ticket_id, 'normal',
    jsonb_build_object('provider_id', v_provider_id)
  );
  PERFORM public.gsa_provider_write_audit(
    'CREATE_TICKET', 'tickets', v_ticket_id,
    jsonb_build_object('subject', v_subject)
  );

  RETURN jsonb_build_object('success', true, 'ticket_id', v_ticket_id, 'existing', false);
END;
$$;

CREATE OR REPLACE FUNCTION public.gsa_provider_send_ticket_message(
  p_ticket_id uuid,
  p_message text DEFAULT NULL,
  p_attachment_reference text DEFAULT NULL,
  p_attachment_type text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_context jsonb := public.gsa_provider_context(false);
  v_provider_id uuid := (v_context ->> 'provider_id')::uuid;
  v_provider_name text := v_context ->> 'provider_name';
  v_ticket public.tickets%ROWTYPE;
  v_message text := NULLIF(trim(COALESCE(p_message, '')), '');
  v_attachment text := NULLIF(trim(COALESCE(p_attachment_reference, '')), '');
  v_message_id uuid;
BEGIN
  SELECT * INTO v_ticket
  FROM public.tickets
  WHERE id = p_ticket_id AND prestador_id = v_provider_id
  FOR UPDATE;

  IF NOT FOUND THEN RAISE EXCEPTION 'Atendimento não encontrado'; END IF;
  IF v_ticket.status = 'concluido' THEN RAISE EXCEPTION 'Este atendimento já foi concluído'; END IF;
  IF v_message IS NULL AND v_attachment IS NULL THEN RAISE EXCEPTION 'Informe uma mensagem ou anexo'; END IF;
  IF length(COALESCE(v_message, '')) > 5000 THEN RAISE EXCEPTION 'Mensagem muito extensa'; END IF;
  IF v_attachment IS NOT NULL AND v_attachment !~ ('^storage://documentos_prestador/' || v_provider_id::text || '/chat/' || p_ticket_id::text || '/') THEN
    RAISE EXCEPTION 'Referência de anexo inválida';
  END IF;

  INSERT INTO public.ticket_mensagens(
    ticket_id, autor_id, autor_nome, mensagem, anexo_url, anexo_tipo, tipo
  ) VALUES (
    p_ticket_id, v_provider_id, v_provider_name, v_message,
    v_attachment, NULLIF(left(COALESCE(p_attachment_type, ''), 150), ''), 'prestador'
  ) RETURNING id INTO v_message_id;

  UPDATE public.tickets SET updated_at = now() WHERE id = p_ticket_id;

  PERFORM public.gsa_provider_insert_admin_notification(
    'Nova mensagem de prestador',
    'Nova mensagem de ' || v_provider_name || ' no ticket #' || left(p_ticket_id::text, 8) || '.',
    'suporte', 'ticket_mensagem_recebida', p_ticket_id, 'normal',
    jsonb_build_object('provider_id', v_provider_id, 'message_id', v_message_id)
  );
  PERFORM public.gsa_provider_write_audit(
    'SEND_TICKET_MESSAGE', 'ticket_mensagens', v_message_id,
    jsonb_build_object('ticket_id', p_ticket_id, 'has_attachment', v_attachment IS NOT NULL)
  );

  RETURN jsonb_build_object('success', true, 'message_id', v_message_id);
END;
$$;

CREATE OR REPLACE FUNCTION public.gsa_provider_request_profile_change(
  p_field text,
  p_new_value text,
  p_reason text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_context jsonb := public.gsa_provider_context(false);
  v_provider_id uuid := (v_context ->> 'provider_id')::uuid;
  v_field text := lower(trim(COALESCE(p_field, '')));
  v_current text;
  v_label text;
BEGIN
  IF v_field = 'nome_razao' THEN v_label := 'Nome / Razão Social'; SELECT nome_razao INTO v_current FROM public.prestadores WHERE id = v_provider_id;
  ELSIF v_field = 'documento' THEN v_label := 'Documento'; SELECT documento INTO v_current FROM public.prestadores WHERE id = v_provider_id;
  ELSIF v_field = 'email' THEN v_label := 'E-mail'; SELECT email INTO v_current FROM public.prestadores WHERE id = v_provider_id;
  ELSE RAISE EXCEPTION 'Campo cadastral não permitido';
  END IF;

  RETURN public.gsa_provider_create_ticket(
    'Solicitação de alteração: ' || v_label,
    'Valor atual: ' || COALESCE(v_current, '-') || E'\nNovo valor solicitado: ' || left(trim(COALESCE(p_new_value, '')), 1000) || E'\nMotivo: ' || left(trim(COALESCE(p_reason, '')), 2000),
    true
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.gsa_provider_request_demand_support(
  p_demand_id uuid,
  p_message text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_context jsonb := public.gsa_provider_context(true);
  v_provider_id uuid := (v_context ->> 'provider_id')::uuid;
  v_provider_name text := v_context ->> 'provider_name';
  v_title text;
  v_support_id uuid;
BEGIN
  SELECT COALESCE(titulo, id::text) INTO v_title
  FROM public.prestador_demandas
  WHERE id = p_demand_id AND prestador_id = v_provider_id
    AND status IN ('aguardando_aceite', 'aberta', 'em_negociacao', 'contraproposta_prestador', 'contraproposta_admin_final', 'ativa', 'em_analise', 'em_ajuste');
  IF NOT FOUND THEN RAISE EXCEPTION 'Demanda não encontrada para suporte'; END IF;
  IF NULLIF(trim(COALESCE(p_message, '')), '') IS NULL OR length(trim(p_message)) > 5000 THEN RAISE EXCEPTION 'Mensagem de suporte inválida'; END IF;

  INSERT INTO public.prestador_suporte_demandas(demanda_id, prestador_id, mensagem, status)
  VALUES (p_demand_id, v_provider_id, trim(p_message), 'aberto')
  RETURNING id INTO v_support_id;

  PERFORM public.gsa_provider_insert_admin_notification(
    'Suporte solicitado em demanda',
    v_provider_name || ' solicitou suporte na demanda ' || v_title || '.',
    'demandas', 'ticket_aberto_prestador', p_demand_id, 'alta',
    jsonb_build_object('provider_id', v_provider_id, 'support_id', v_support_id)
  );
  PERFORM public.gsa_provider_write_audit(
    'REQUEST_DEMAND_SUPPORT', 'prestador_suporte_demandas', v_support_id,
    jsonb_build_object('demand_id', p_demand_id)
  );

  RETURN jsonb_build_object('success', true, 'support_id', v_support_id);
END;
$$;

CREATE OR REPLACE FUNCTION public.gsa_provider_submit_document(
  p_documento_id uuid,
  p_urls text[]
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_provider_id uuid := public.gsa_assert_current_provider();
  v_old_urls text[];
BEGIN
  IF COALESCE(array_length(p_urls, 1), 0) = 0 OR array_length(p_urls, 1) > 5 THEN
    RAISE EXCEPTION 'Envie de um a cinco arquivos';
  END IF;

  SELECT urls INTO v_old_urls
  FROM public.prestador_documentos
  WHERE id = p_documento_id AND prestador_id = v_provider_id
    AND status IN ('pendente', 'reprovado')
  FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Documento não encontrado ou não disponível para envio'; END IF;

  UPDATE public.prestador_documentos
  SET urls = p_urls, status = 'em_analise', motivo_rejeicao = NULL
  WHERE id = p_documento_id;

  RETURN jsonb_build_object('success', true, 'old_urls', COALESCE(to_jsonb(v_old_urls), '[]'::jsonb));
END;
$$;

-- Storage privado com permissão administrativa por módulo e escopo.
DROP POLICY IF EXISTS provider_private_files_select ON storage.objects;
CREATE POLICY provider_private_files_select
ON storage.objects FOR SELECT TO authenticated
USING (
  bucket_id IN ('documentos_prestador', 'entregas_demandas')
  AND (
    public.gsa_current_actor_type() = 'admin'
    OR (
      public.gsa_current_actor_type() = 'colaborador'
      AND (
        (bucket_id = 'entregas_demandas' AND public.gsa_admin_has_module('operacoes'))
        OR (
          bucket_id = 'documentos_prestador'
          AND (
            ((storage.foldername(name))[2] = 'chat' AND public.gsa_admin_has_module('atendimento'))
            OR ((storage.foldername(name))[2] <> 'chat' AND public.gsa_admin_has_module('cadastro'))
          )
        )
      )
    )
    OR (
      public.gsa_current_actor_type() = 'prestador'
      AND (storage.foldername(name))[1] = public.gsa_current_actor_id()::text
    )
  )
);

DROP POLICY IF EXISTS provider_private_files_insert ON storage.objects;
CREATE POLICY provider_private_files_insert
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (
  bucket_id IN ('documentos_prestador', 'entregas_demandas')
  AND (
    public.gsa_current_actor_type() = 'admin'
    OR (
      public.gsa_current_actor_type() = 'colaborador'
      AND (
        (bucket_id = 'entregas_demandas' AND public.gsa_admin_has_module('operacoes'))
        OR (
          bucket_id = 'documentos_prestador'
          AND (
            ((storage.foldername(name))[2] = 'chat' AND public.gsa_admin_has_module('atendimento'))
            OR ((storage.foldername(name))[2] <> 'chat' AND public.gsa_admin_has_module('cadastro'))
          )
        )
      )
    )
    OR (
      public.gsa_current_actor_type() = 'prestador'
      AND (storage.foldername(name))[1] = public.gsa_current_actor_id()::text
    )
  )
);

DROP POLICY IF EXISTS provider_private_files_update ON storage.objects;
CREATE POLICY provider_private_files_update
ON storage.objects FOR UPDATE TO authenticated
USING (
  bucket_id IN ('documentos_prestador', 'entregas_demandas')
  AND (
    public.gsa_current_actor_type() = 'admin'
    OR (
      public.gsa_current_actor_type() = 'colaborador'
      AND (
        (bucket_id = 'entregas_demandas' AND public.gsa_admin_has_module('operacoes'))
        OR (bucket_id = 'documentos_prestador' AND public.gsa_admin_has_module('cadastro'))
      )
    )
    OR (
      public.gsa_current_actor_type() = 'prestador'
      AND (storage.foldername(name))[1] = public.gsa_current_actor_id()::text
    )
  )
)
WITH CHECK (
  bucket_id IN ('documentos_prestador', 'entregas_demandas')
  AND (
    public.gsa_current_actor_type() = 'admin'
    OR (
      public.gsa_current_actor_type() = 'colaborador'
      AND (
        (bucket_id = 'entregas_demandas' AND public.gsa_admin_has_module('operacoes'))
        OR (bucket_id = 'documentos_prestador' AND public.gsa_admin_has_module('cadastro'))
      )
    )
    OR (
      public.gsa_current_actor_type() = 'prestador'
      AND (storage.foldername(name))[1] = public.gsa_current_actor_id()::text
    )
  )
);

DROP POLICY IF EXISTS provider_private_files_delete ON storage.objects;
CREATE POLICY provider_private_files_delete
ON storage.objects FOR DELETE TO authenticated
USING (
  bucket_id IN ('documentos_prestador', 'entregas_demandas')
  AND (
    public.gsa_current_actor_type() = 'admin'
    OR (
      public.gsa_current_actor_type() = 'colaborador'
      AND (
        (bucket_id = 'entregas_demandas' AND public.gsa_admin_has_module('operacoes'))
        OR (bucket_id = 'documentos_prestador' AND public.gsa_admin_has_module('cadastro'))
      )
    )
    OR (
      public.gsa_current_actor_type() = 'prestador'
      AND (storage.foldername(name))[1] = public.gsa_current_actor_id()::text
    )
  )
);

GRANT EXECUTE ON FUNCTION public.gsa_provider_context(boolean) TO authenticated;
GRANT EXECUTE ON FUNCTION public.gsa_assert_current_provider_active() TO authenticated;
GRANT EXECUTE ON FUNCTION public.gsa_provider_dashboard_snapshot() TO authenticated;
GRANT EXECUTE ON FUNCTION public.gsa_provider_create_ticket(text, text, boolean) TO authenticated;
GRANT EXECUTE ON FUNCTION public.gsa_provider_send_ticket_message(uuid, text, text, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.gsa_provider_request_profile_change(text, text, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.gsa_provider_request_demand_support(uuid, text) TO authenticated;

COMMIT;
