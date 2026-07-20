BEGIN;

CREATE OR REPLACE FUNCTION public.gsa_provider_operation_event()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_provider_id uuid;
  v_action text;
  v_notification_action text := 'manual';
  v_title text;
  v_message text;
  v_module text;
  v_item_id uuid;
  v_priority text := 'normal';
BEGIN
  IF public.gsa_current_actor_type() <> 'prestador' THEN
    IF TG_OP = 'DELETE' THEN RETURN OLD; END IF;
    RETURN NEW;
  END IF;

  IF TG_TABLE_NAME = 'prestador_saques' THEN
    v_provider_id := CASE WHEN TG_OP = 'DELETE' THEN OLD.prestador_id ELSE NEW.prestador_id END;
    v_item_id := CASE WHEN TG_OP = 'DELETE' THEN OLD.id ELSE NEW.id END;
    IF TG_OP = 'INSERT' THEN
      v_action := 'WITHDRAWAL_REQUESTED';
      v_notification_action := 'prestador_saque_solicitado';
      v_title := 'Novo saque solicitado';
      v_message := 'Um prestador solicitou saque de R$ ' || NEW.valor::text || '.';
      v_module := 'financeiro';
    ELSIF TG_OP = 'UPDATE' AND NEW.status IS DISTINCT FROM OLD.status AND NEW.status = 'cancelado' THEN
      v_action := 'WITHDRAWAL_CANCELLED';
      v_notification_action := 'manual';
      v_title := 'Saque cancelado pelo prestador';
      v_message := 'O prestador cancelou uma solicitação de saque.';
      v_module := 'financeiro';
    ELSE
      RETURN NEW;
    END IF;

  ELSIF TG_TABLE_NAME = 'prestador_vouchers'
        AND TG_OP = 'UPDATE'
        AND NEW.status IS DISTINCT FROM OLD.status
        AND NEW.status = 'pago' THEN
    v_provider_id := NEW.prestador_id;
    v_item_id := NEW.id;
    v_action := 'VOUCHER_REDEEMED';
    v_notification_action := 'voucher_resgate_solicitado';
    v_title := 'Voucher resgatado pelo prestador';
    v_message := 'Voucher ' || COALESCE(NEW.codigo, NEW.id::text) || ' resgatado e creditado.';
    v_module := 'vouchers';

  ELSIF TG_TABLE_NAME = 'prestador_premios'
        AND TG_OP = 'UPDATE'
        AND NEW.status IS DISTINCT FROM OLD.status
        AND NEW.status = 'resgatado' THEN
    v_provider_id := NEW.prestador_id;
    v_item_id := NEW.id;
    v_action := 'PRIZE_REDEEMED';
    v_notification_action := 'premio_resgate_solicitado';
    v_title := 'Prêmio resgatado pelo prestador';
    v_message := 'O prêmio "' || COALESCE(NEW.titulo, NEW.id::text) || '" foi resgatado.';
    v_module := 'premios';

  ELSIF TG_TABLE_NAME = 'prestador_promocoes_ativacoes'
        AND (TG_OP = 'INSERT' OR (TG_OP = 'UPDATE' AND NEW.ativa IS DISTINCT FROM OLD.ativa))
        AND NEW.ativa THEN
    v_provider_id := NEW.prestador_id;
    v_item_id := NEW.promocao_id;
    v_action := 'PROMOTION_ACTIVATED';
    v_notification_action := 'prestador_promocao_ativada';
    v_title := 'Participação em promoção';
    v_message := 'Um prestador confirmou participação em uma promoção.';
    v_module := 'promocoes';

  ELSIF TG_TABLE_NAME = 'prestador_agendamentos' THEN
    IF TG_OP = 'DELETE' THEN
      v_provider_id := OLD.prestador_id;
      v_item_id := OLD.id;
      v_action := 'SCHEDULE_DELETED';
      v_title := 'Agendamento removido';
      v_message := 'Um agendamento foi removido pelo prestador.';
    ELSE
      v_provider_id := NEW.prestador_id;
      v_item_id := NEW.id;
      IF TG_OP = 'INSERT' THEN
        v_action := 'SCHEDULE_CREATED';
        v_title := 'Novo agendamento do prestador';
        v_message := 'Um novo agendamento foi criado.';
      ELSIF TG_OP = 'UPDATE' AND NEW.status IS DISTINCT FROM OLD.status AND NEW.status = 'concluido' THEN
        v_action := 'SCHEDULE_COMPLETED';
        v_title := 'Agendamento concluído';
        v_message := 'Um agendamento foi concluído pelo prestador.';
      ELSE
        RETURN NEW;
      END IF;
    END IF;
    v_notification_action := 'manual';
    v_module := 'servicos';

  ELSIF TG_TABLE_NAME = 'prestador_documentos'
        AND TG_OP = 'UPDATE'
        AND NEW.status IS DISTINCT FROM OLD.status
        AND NEW.status = 'em_analise' THEN
    v_provider_id := NEW.prestador_id;
    v_item_id := NEW.id;
    v_action := 'DOCUMENT_SUBMITTED';
    v_notification_action := 'documento_prestador_enviado';
    v_title := 'Documento de prestador enviado';
    v_message := 'O prestador enviou o documento "' || COALESCE(NEW.nome, NEW.id::text) || '" para análise.';
    v_module := 'cadastro';

  ELSIF TG_TABLE_NAME = 'prestador_demandas'
        AND TG_OP = 'UPDATE'
        AND NEW.status IS DISTINCT FROM OLD.status THEN
    v_provider_id := OLD.prestador_id;
    v_item_id := NEW.id;
    v_module := 'demandas';

    IF NEW.status = 'ativa' THEN
      v_action := 'DEMAND_ACCEPTED';
      v_notification_action := 'manual';
      v_title := 'Demanda aceita pelo prestador';
      v_message := 'Uma demanda foi aceita e iniciada.';

    ELSIF NEW.status = 'contraproposta_prestador' THEN
      v_action := 'DEMAND_COUNTEROFFERED';
      v_notification_action := 'demanda_contraproposta_prestador';
      v_title := 'Contraproposta do prestador';
      v_message := 'O prestador enviou uma contraproposta.';

    ELSIF NEW.status = 'em_analise' THEN
      v_action := 'DEMAND_DELIVERED';
      v_notification_action := 'demanda_entregue';
      v_title := 'Demanda entregue pelo prestador';
      v_message := 'A demanda foi entregue e aguarda análise.';
      v_priority := 'alta';
      IF NEW.os_id IS NOT NULL THEN
        INSERT INTO public.os_notas(os_id, nota)
        VALUES (NEW.os_id, 'Serviço entregue pelo prestador e enviado para análise.');
      END IF;

    ELSIF NEW.status = 'aguardando_atribuicao' AND NEW.prestador_id IS NULL THEN
      IF OLD.status IN ('aguardando_aceite', 'aberta', 'em_negociacao', 'contraproposta_admin_final') THEN
        v_action := 'DEMAND_REJECTED';
        v_notification_action := 'demanda_recusada';
        v_title := 'Demanda recusada pelo prestador';
        v_message := 'Uma demanda foi recusada pelo prestador.';
      ELSE
        v_action := 'DEMAND_RETURNED';
        v_notification_action := 'demanda_transferida';
        v_title := 'Demanda devolvida pelo prestador';
        v_message := 'Uma demanda foi devolvida para reatribuição.';
        v_priority := 'alta';
        IF NEW.os_id IS NOT NULL THEN
          INSERT INTO public.os_notas(os_id, nota)
          VALUES (NEW.os_id, 'Demanda devolvida pelo prestador para reatribuição.');
        END IF;
      END IF;
    ELSE
      RETURN NEW;
    END IF;
  ELSE
    IF TG_OP = 'DELETE' THEN RETURN OLD; END IF;
    RETURN NEW;
  END IF;

  IF v_provider_id IS NOT NULL THEN
    PERFORM public.gsa_provider_write_audit(
      v_provider_id,
      v_action,
      TG_TABLE_NAME,
      v_item_id,
      jsonb_build_object('operation', TG_OP)
    );
    PERFORM public.gsa_provider_notify_admin(
      v_title,
      v_message,
      v_module,
      v_notification_action,
      v_item_id,
      v_priority,
      jsonb_build_object('prestador_id', v_provider_id)
    );
  END IF;

  IF TG_OP = 'DELETE' THEN RETURN OLD; END IF;
  RETURN NEW;
END;
$$;

-- Recria os triggers para garantir que todos apontem para o contrato final acima.
DROP TRIGGER IF EXISTS trg_provider_saque_event ON public.prestador_saques;
CREATE TRIGGER trg_provider_saque_event
AFTER INSERT OR UPDATE ON public.prestador_saques
FOR EACH ROW EXECUTE FUNCTION public.gsa_provider_operation_event();

DROP TRIGGER IF EXISTS trg_provider_voucher_event ON public.prestador_vouchers;
CREATE TRIGGER trg_provider_voucher_event
AFTER UPDATE ON public.prestador_vouchers
FOR EACH ROW EXECUTE FUNCTION public.gsa_provider_operation_event();

DROP TRIGGER IF EXISTS trg_provider_prize_event ON public.prestador_premios;
CREATE TRIGGER trg_provider_prize_event
AFTER UPDATE ON public.prestador_premios
FOR EACH ROW EXECUTE FUNCTION public.gsa_provider_operation_event();

DROP TRIGGER IF EXISTS trg_provider_promotion_event ON public.prestador_promocoes_ativacoes;
CREATE TRIGGER trg_provider_promotion_event
AFTER INSERT OR UPDATE ON public.prestador_promocoes_ativacoes
FOR EACH ROW EXECUTE FUNCTION public.gsa_provider_operation_event();

DROP TRIGGER IF EXISTS trg_provider_schedule_event ON public.prestador_agendamentos;
CREATE TRIGGER trg_provider_schedule_event
AFTER INSERT OR UPDATE OR DELETE ON public.prestador_agendamentos
FOR EACH ROW EXECUTE FUNCTION public.gsa_provider_operation_event();

DROP TRIGGER IF EXISTS trg_provider_document_event ON public.prestador_documentos;
CREATE TRIGGER trg_provider_document_event
AFTER UPDATE ON public.prestador_documentos
FOR EACH ROW EXECUTE FUNCTION public.gsa_provider_operation_event();

DROP TRIGGER IF EXISTS trg_provider_demand_event ON public.prestador_demandas;
CREATE TRIGGER trg_provider_demand_event
AFTER UPDATE ON public.prestador_demandas
FOR EACH ROW EXECUTE FUNCTION public.gsa_provider_operation_event();

REVOKE ALL ON FUNCTION public.gsa_provider_operation_event() FROM PUBLIC, anon, authenticated;

COMMIT;
