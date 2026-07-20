-- Persist the administrative payment notification in the same database event
-- that records the chosen payment method. This replaces the browser insert.

CREATE OR REPLACE FUNCTION public.gsa_notify_invoice_payment_started()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_cliente_nome text;
BEGIN
  IF OLD.data_escolha_pagamento IS NULL
     AND NEW.data_escolha_pagamento IS NOT NULL THEN
    SELECT nome INTO v_cliente_nome
    FROM public.clientes
    WHERE id = NEW.cliente_id;

    IF NOT EXISTS (
      SELECT 1 FROM public.notificacoes n
      WHERE n.destinatario_tipo = 'admin'
        AND n.item_id = NEW.id::text
        AND n.acao_origem = 'pagamento_fatura_iniciado'
    ) THEN
      INSERT INTO public.notificacoes(
        titulo, mensagem, modulo, tab, item_id, lida, tipo,
        destinatario_tipo, prioridade, acao_origem, contexto
      ) VALUES (
        'Pagamento de fatura iniciado',
        coalesce(v_cliente_nome, 'Um cliente') || ' iniciou o pagamento da fatura '
          || coalesce(NEW.codigo_fatura, NEW.id::text) || '. Status: ' || NEW.status || '.',
        'financeiro',
        'faturas',
        NEW.id::text,
        false,
        'sistema',
        'admin',
        CASE WHEN NEW.status = 'pago' THEN 'normal' ELSE 'alta' END,
        'pagamento_fatura_iniciado',
        jsonb_build_object('fatura_id', NEW.id, 'cliente_id', NEW.cliente_id, 'status', NEW.status)
      );
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_gsa_notify_invoice_payment_started ON public.faturas;
CREATE TRIGGER trg_gsa_notify_invoice_payment_started
AFTER UPDATE OF data_escolha_pagamento ON public.faturas
FOR EACH ROW
EXECUTE FUNCTION public.gsa_notify_invoice_payment_started();

