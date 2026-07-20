BEGIN;

-- Compatibilidade segura para fluxos legados ainda existentes no frontend:
-- identidade é sempre derivada do JWT e notificações diretas são descartadas.
CREATE OR REPLACE FUNCTION public.gsa_guard_provider_direct_insert()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_provider_id uuid;
  v_provider_name text;
  v_ticket_status text;
BEGIN
  IF public.gsa_current_actor_type() <> 'prestador'
     OR COALESCE(current_setting('gsa.provider_internal_write', true), 'off') = 'on' THEN
    RETURN NEW;
  END IF;

  IF TG_TABLE_NAME = 'notificacoes' THEN
    -- Operações do prestador já geram a notificação autoritativa dentro da RPC/trigger.
    RETURN NULL;
  ELSIF TG_TABLE_NAME = 'tickets' THEN
    v_provider_id := public.gsa_assert_current_provider_any_status();
    IF length(trim(COALESCE(NEW.assunto, ''))) < 3 OR length(trim(COALESCE(NEW.assunto, ''))) > 180 THEN
      RAISE EXCEPTION 'Assunto inválido';
    END IF;
    IF length(trim(COALESCE(NEW.descricao, ''))) < 3 OR length(trim(COALESCE(NEW.descricao, ''))) > 4000 THEN
      RAISE EXCEPTION 'Descrição inválida';
    END IF;
    NEW.prestador_id := v_provider_id;
    NEW.assunto := trim(NEW.assunto);
    NEW.descricao := trim(NEW.descricao);
    NEW.status := 'aberto';
  ELSIF TG_TABLE_NAME = 'ticket_mensagens' THEN
    v_provider_id := public.gsa_assert_current_provider_any_status();
    SELECT t.status INTO v_ticket_status
    FROM public.tickets t
    WHERE t.id = NEW.ticket_id AND t.prestador_id = v_provider_id;
    IF NOT FOUND OR v_ticket_status = 'concluido' THEN
      RAISE EXCEPTION 'Atendimento não encontrado ou concluído';
    END IF;
    IF length(COALESCE(NEW.mensagem, '')) > 4000 THEN RAISE EXCEPTION 'Mensagem acima do tamanho permitido'; END IF;
    IF COALESCE(NEW.anexo_url, '') <> ''
       AND NEW.anexo_url !~ ('^storage://documentos_prestador/' || v_provider_id::text || '/chat/' || NEW.ticket_id::text || '/') THEN
      RAISE EXCEPTION 'Referência de anexo inválida';
    END IF;
    SELECT nome_razao INTO v_provider_name FROM public.prestadores WHERE id = v_provider_id;
    NEW.autor_id := v_provider_id;
    NEW.autor_nome := COALESCE(v_provider_name, 'Prestador');
    NEW.tipo := 'prestador';
  ELSIF TG_TABLE_NAME = 'prestador_suporte_demandas' THEN
    v_provider_id := public.gsa_assert_current_provider();
    IF NOT EXISTS (
      SELECT 1 FROM public.prestador_demandas d
      WHERE d.id = NEW.demanda_id AND d.prestador_id = v_provider_id
    ) THEN
      RAISE EXCEPTION 'Demanda não encontrada para este prestador';
    END IF;
    IF length(trim(COALESCE(NEW.mensagem, ''))) < 3 OR length(trim(COALESCE(NEW.mensagem, ''))) > 3000 THEN
      RAISE EXCEPTION 'Mensagem de suporte inválida';
    END IF;
    NEW.prestador_id := v_provider_id;
    NEW.mensagem := trim(NEW.mensagem);
    NEW.status := 'aberto';
  END IF;

  RETURN NEW;
END;
$$;

-- Fluxos legados seguros recebem auditoria e notificação na mesma transação.
CREATE OR REPLACE FUNCTION public.gsa_provider_legacy_insert_event()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_provider_id uuid;
  v_target_id uuid;
BEGIN
  IF public.gsa_current_actor_type() <> 'prestador'
     OR COALESCE(current_setting('gsa.provider_internal_write', true), 'off') = 'on' THEN
    RETURN NEW;
  END IF;

  IF TG_TABLE_NAME = 'tickets' THEN
    v_provider_id := NEW.prestador_id;
    v_target_id := NEW.id;
    PERFORM public.gsa_provider_write_audit(v_provider_id, 'TICKET_CREATED', 'ticket', v_target_id);
    PERFORM public.gsa_provider_notify_admin(
      'Novo ticket de prestador', 'Novo atendimento aberto: ' || left(NEW.assunto, 180) || '.',
      'suporte', 'ticket_aberto_prestador', v_target_id, 'normal', jsonb_build_object('prestador_id', v_provider_id)
    );
  ELSIF TG_TABLE_NAME = 'ticket_mensagens' THEN
    SELECT t.prestador_id INTO v_provider_id FROM public.tickets t WHERE t.id = NEW.ticket_id;
    v_target_id := NEW.ticket_id;
    PERFORM public.gsa_provider_write_audit(v_provider_id, 'TICKET_MESSAGE_SENT', 'ticket', v_target_id,
      jsonb_build_object('message_id', NEW.id, 'has_attachment', COALESCE(NEW.anexo_url, '') <> ''));
    PERFORM public.gsa_provider_notify_admin(
      'Nova mensagem de prestador', 'Nova mensagem no ticket #' || left(NEW.ticket_id::text, 8) || '.',
      'suporte', 'ticket_mensagem_recebida', v_target_id, 'normal', jsonb_build_object('prestador_id', v_provider_id)
    );
  ELSIF TG_TABLE_NAME = 'prestador_suporte_demandas' THEN
    v_provider_id := NEW.prestador_id;
    v_target_id := NEW.demanda_id;
    PERFORM public.gsa_provider_write_audit(v_provider_id, 'DEMAND_SUPPORT_REQUESTED', 'demanda', v_target_id,
      jsonb_build_object('support_id', NEW.id));
    PERFORM public.gsa_provider_notify_admin(
      'Suporte solicitado em demanda', 'Um prestador solicitou suporte em uma demanda.',
      'demandas', 'ticket_aberto_prestador', v_target_id, 'alta',
      jsonb_build_object('prestador_id', v_provider_id, 'support_id', NEW.id)
    );
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_provider_ticket_insert_event ON public.tickets;
CREATE TRIGGER trg_provider_ticket_insert_event
AFTER INSERT ON public.tickets FOR EACH ROW EXECUTE FUNCTION public.gsa_provider_legacy_insert_event();
DROP TRIGGER IF EXISTS trg_provider_ticket_message_insert_event ON public.ticket_mensagens;
CREATE TRIGGER trg_provider_ticket_message_insert_event
AFTER INSERT ON public.ticket_mensagens FOR EACH ROW EXECUTE FUNCTION public.gsa_provider_legacy_insert_event();
DROP TRIGGER IF EXISTS trg_provider_demand_support_insert_event ON public.prestador_suporte_demandas;
CREATE TRIGGER trg_provider_demand_support_insert_event
AFTER INSERT ON public.prestador_suporte_demandas FOR EACH ROW EXECUTE FUNCTION public.gsa_provider_legacy_insert_event();

-- Evita nota duplicada quando uma tela legada tenta repetir a nota já gravada pela RPC.
CREATE OR REPLACE FUNCTION public.gsa_provider_suppress_duplicate_os_note()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  IF public.gsa_current_actor_type() = 'prestador' AND EXISTS (
    SELECT 1 FROM public.os_notas n
    WHERE n.os_id = NEW.os_id AND n.nota = NEW.nota
      AND COALESCE(to_jsonb(n) ->> 'created_at', now()::text)::timestamptz >= now() - interval '2 minutes'
  ) THEN
    RETURN NULL;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_provider_duplicate_os_note ON public.os_notas;
CREATE TRIGGER trg_provider_duplicate_os_note
BEFORE INSERT ON public.os_notas FOR EACH ROW EXECUTE FUNCTION public.gsa_provider_suppress_duplicate_os_note();

-- Retorna o ticket já aberto em vez de duplicar ou falhar.
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
  IF length(trim(COALESCE(p_subject, ''))) < 3 OR length(trim(COALESCE(p_subject, ''))) > 180 THEN RAISE EXCEPTION 'Assunto inválido'; END IF;
  IF length(trim(COALESCE(p_description, ''))) < 3 OR length(trim(COALESCE(p_description, ''))) > 4000 THEN RAISE EXCEPTION 'Descrição inválida'; END IF;

  SELECT id INTO v_ticket_id FROM public.tickets
  WHERE prestador_id = v_provider_id AND assunto = trim(p_subject) AND status <> 'concluido'
  ORDER BY data_abertura DESC LIMIT 1;
  IF v_ticket_id IS NOT NULL THEN
    RETURN jsonb_build_object('success', true, 'ticket_id', v_ticket_id, 'existing', true);
  END IF;

  PERFORM set_config('gsa.provider_internal_write', 'on', true);
  INSERT INTO public.tickets(prestador_id, assunto, descricao, status)
  VALUES (v_provider_id, trim(p_subject), trim(p_description), 'aberto') RETURNING id INTO v_ticket_id;
  PERFORM set_config('gsa.provider_internal_write', 'off', true);

  PERFORM public.gsa_provider_write_audit(v_provider_id, 'TICKET_CREATED', 'ticket', v_ticket_id);
  PERFORM public.gsa_provider_notify_admin(
    'Novo ticket de prestador', 'Novo atendimento aberto: ' || trim(p_subject) || '.',
    'suporte', 'ticket_aberto_prestador', v_ticket_id, 'normal', jsonb_build_object('prestador_id', v_provider_id)
  );
  RETURN jsonb_build_object('success', true, 'ticket_id', v_ticket_id, 'existing', false);
END;
$$;

-- Corrige a política de INSERT para a pasta real "documentos".
DROP POLICY IF EXISTS provider_private_files_insert ON storage.objects;
CREATE POLICY provider_private_files_insert ON storage.objects FOR INSERT TO authenticated
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

REVOKE ALL ON FUNCTION public.gsa_provider_legacy_insert_event() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.gsa_provider_suppress_duplicate_os_note() FROM PUBLIC, anon, authenticated;

COMMIT;
