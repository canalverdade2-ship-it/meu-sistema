-- Every transition to paid emits one durable client notification, regardless of
-- whether the settlement came from the client, dashboard, webhook or admin flow.

CREATE OR REPLACE FUNCTION public.gsa_notify_invoice_paid()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.status = 'pago' AND OLD.status IS DISTINCT FROM 'pago' THEN
    IF NOT EXISTS (
      SELECT 1 FROM public.notificacoes n
      WHERE n.cliente_id = NEW.cliente_id
        AND n.item_id = NEW.id::text
        AND n.acao_origem = 'pagamento_confirmado'
    ) THEN
      INSERT INTO public.notificacoes(
        cliente_id, titulo, mensagem, modulo, tab, item_id, lida, tipo,
        destinatario_tipo, prioridade, acao_origem, contexto
      ) VALUES (
        NEW.cliente_id,
        'Pagamento confirmado',
        'O pagamento da fatura ' || coalesce(NEW.codigo_fatura, NEW.id::text)
          || ' no valor de R$ ' || to_char(coalesce(NEW.valor_total, 0), 'FM999999999990D00')
          || ' foi confirmado.',
        'financeiro',
        'faturas',
        NEW.id::text,
        false,
        'sistema',
        'cliente',
        'normal',
        'pagamento_confirmado',
        jsonb_build_object(
          'fatura_id', NEW.id,
          'valor', NEW.valor_total,
          'metodo', NEW.forma_pagamento_escolhida
        )
      );
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_gsa_notify_invoice_paid ON public.faturas;
CREATE TRIGGER trg_gsa_notify_invoice_paid
AFTER UPDATE OF status ON public.faturas
FOR EACH ROW
EXECUTE FUNCTION public.gsa_notify_invoice_paid();

