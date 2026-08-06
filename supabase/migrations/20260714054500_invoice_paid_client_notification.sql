-- Every transition to paid emits one durable client notification, regardless of
-- whether the settlement came from the client, dashboard, webhook or admin flow.

CREATE OR REPLACE FUNCTION public.gsa_notify_invoice_paid()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_detalhes TEXT := '';
  v_metodo TEXT := '';
  v_msg TEXT := '';
  v_cupom NUMERIC := COALESCE(NEW.desconto_voucher_aplicado, 0) + COALESCE(NEW.desconto_promocional_aplicado, 0);
  v_carteira NUMERIC := COALESCE(NEW.abatimento_carteira_aplicado, 0);
  v_pontos NUMERIC := COALESCE(NEW.desconto_pontos_aplicado, 0);
  v_desconto_manual NUMERIC := COALESCE(NEW.desconto_manual, 0);
  v_acrescimo_manual NUMERIC := COALESCE(NEW.acrescimo_manual, 0);
BEGIN
  IF NEW.status = 'pago' AND OLD.status IS DISTINCT FROM 'pago' THEN
    IF NOT EXISTS (
      SELECT 1 FROM public.notificacoes n
      WHERE n.cliente_id = NEW.cliente_id
        AND n.item_id = NEW.id::text
        AND n.acao_origem = 'pagamento_confirmado'
    ) THEN
      
      -- Forma de Pagamento amigável
      v_metodo := CASE 
        WHEN LOWER(COALESCE(NEW.forma_pagamento_escolhida, '')) IN ('pix', 'pix_qrcode') THEN 'PIX'
        WHEN LOWER(COALESCE(NEW.forma_pagamento_escolhida, '')) IN ('cartao', 'credit_card', 'infinitepay') THEN 'Cartão de Crédito'
        WHEN LOWER(COALESCE(NEW.forma_pagamento_escolhida, '')) IN ('saldo', 'carteira', 'saldo_carteira') THEN 'Saldo em Carteira GSA'
        WHEN LOWER(COALESCE(NEW.forma_pagamento_escolhida, '')) IN ('credito', 'credito_gsa') THEN 'Crédito GSA'
        WHEN LOWER(COALESCE(NEW.forma_pagamento_escolhida, '')) IN ('dinheiro') THEN 'Dinheiro (Baixa Presencial)'
        WHEN LOWER(COALESCE(NEW.forma_pagamento_escolhida, '')) IN ('transferencia') THEN 'Transferência Bancária / TED / DOC'
        WHEN NEW.forma_pagamento_escolhida IS NOT NULL AND NEW.forma_pagamento_escolhida <> '' THEN UPPER(NEW.forma_pagamento_escolhida)
        ELSE 'Confirmação pelo Sistema / Baixa Administrativa'
      END;

      -- Montar detalhamento de benefícios/descontos utilizados
      IF v_cupom > 0 THEN
        v_detalhes := v_detalhes || chr(10) || '• 🎟️ *Cupom/Voucher:* - R$ ' || to_char(v_cupom, 'FM999999999990D00');
      END IF;
      
      IF v_pontos > 0 THEN
        v_detalhes := v_detalhes || chr(10) || '• ⭐ *Pontos Utilizados:* - R$ ' || to_char(v_pontos, 'FM999999999990D00');
      END IF;

      IF v_carteira > 0 THEN
        v_detalhes := v_detalhes || chr(10) || '• 💳 *Abatimento Carteira GSA:* - R$ ' || to_char(v_carteira, 'FM999999999990D00');
      END IF;

      IF v_desconto_manual > 0 THEN
        v_detalhes := v_detalhes || chr(10) || '• 🏷️ *Desconto Concedido:* - R$ ' || to_char(v_desconto_manual, 'FM999999999990D00');
      END IF;

      IF v_acrescimo_manual > 0 THEN
        v_detalhes := v_detalhes || chr(10) || '• 📈 *Acréscimo:* + R$ ' || to_char(v_acrescimo_manual, 'FM999999999990D00');
      END IF;

      -- Mensagem completa e organizada
      v_msg := 'O pagamento da sua fatura *#' || COALESCE(NEW.codigo_fatura, NEW.id::text) || '* foi *confirmado com sucesso*!'
            || chr(10) || chr(10)
            || '💳 *FORMA DE PAGAMENTO:* ' || v_metodo
            || chr(10)
            || '💰 *VALOR CONFIRMADO:* *R$ ' || to_char(COALESCE(NEW.valor_pago, NEW.valor_total, 0), 'FM999999999990D00') || '*';

      IF v_detalhes <> '' THEN
        v_msg := v_msg || chr(10) || chr(10) || '🎁 *DESCONTOS E BENEFÍCIOS APLICADOS:*' || v_detalhes;
      END IF;

      v_msg := v_msg || chr(10) || chr(10) || '▶️ *STATUS:* Fatura Quitada ✅';

      INSERT INTO public.notificacoes(
        cliente_id, titulo, mensagem, modulo, tab, item_id, lida, tipo,
        destinatario_tipo, prioridade, acao_origem, contexto
      ) VALUES (
        NEW.cliente_id,
        'Pagamento confirmado',
        v_msg,
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
          'valor', COALESCE(NEW.valor_pago, NEW.valor_total),
          'metodo', v_metodo
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

