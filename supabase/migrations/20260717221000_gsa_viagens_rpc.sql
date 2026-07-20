-- Migration: GSA Viagens RPCs para Checkout e Moderação
-- Criado para o Hub GSA Viagens

-- Função para o Checkout de Pacotes de Viagem (Isolado da Loja)
CREATE OR REPLACE FUNCTION public.gsa_client_checkout_travel(
    p_payload jsonb
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO public, pg_temp
AS $$
DECLARE
    v_cliente_id uuid;
    v_proposta_id uuid;
    v_forma_pagamento text;
    v_proposta record;
    v_fatura_id uuid;
    v_valor_total numeric(10,2);
    v_saldo_carteira numeric(10,2);
    v_limite_disponivel numeric(10,2);
    v_transacao_id uuid;
    v_passageiros_count int;
BEGIN
    -- 1. Identificar Usuário
    v_cliente_id := (SELECT auth.uid());
    IF v_cliente_id IS NULL THEN
        RAISE EXCEPTION 'Não autenticado.';
    END IF;

    -- 2. Extrair payload
    v_proposta_id := (p_payload->>'proposta_id')::uuid;
    v_forma_pagamento := p_payload->>'forma_pagamento';

    IF v_proposta_id IS NULL THEN
        RAISE EXCEPTION 'Proposta de viagem não informada.';
    END IF;

    -- 3. Validar Proposta
    SELECT * INTO v_proposta FROM public.viagens_propostas
    WHERE id = v_proposta_id AND cliente_id = v_cliente_id;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Proposta não encontrada ou não pertence a este cliente.';
    END IF;

    IF v_proposta.status != 'aceita' THEN
        RAISE EXCEPTION 'A proposta precisa ser aceita antes do pagamento.';
    END IF;

    IF NOW() > v_proposta.prazo_pagamento THEN
        UPDATE public.viagens_propostas SET status = 'expirada' WHERE id = v_proposta_id;
        RAISE EXCEPTION 'O prazo de pagamento desta proposta expirou.';
    END IF;

    -- Verificar se já existe transação
    IF EXISTS (SELECT 1 FROM public.viagens_transacoes WHERE proposta_id = v_proposta_id AND status != 'cancelada') THEN
        RAISE EXCEPTION 'Já existe uma transação em andamento ou concluída para esta proposta.';
    END IF;

    -- 4. Validar Passageiros
    SELECT count(*) INTO v_passageiros_count FROM public.viagens_passageiros WHERE proposta_id = v_proposta_id;
    IF v_passageiros_count = 0 THEN
        RAISE EXCEPTION 'Nenhum passageiro cadastrado para esta viagem.';
    END IF;
    -- (Aqui poderia entrar validação de documentos obrigatórios)

    v_valor_total := v_proposta.valor_total;

    -- 5. Se pagar com Crédito da Loja ou Saldo
    IF v_forma_pagamento = 'credito_loja' THEN
        SELECT saldo_carteira, limite_credito_disponivel INTO v_saldo_carteira, v_limite_disponivel
        FROM public.clientes WHERE id = v_cliente_id;
        
        -- Abater primeiro do saldo da carteira, depois limite (Lógica simplificada para a fatura)
        -- Na prática, faturas pendentes geram o saldo em aberto.
    END IF;

    -- 6. Criar a Fatura para o Financeiro
    INSERT INTO public.faturas (
        cliente_id,
        valor_total,
        status,
        data_vencimento,
        tipo,
        metadata
    ) VALUES (
        v_cliente_id,
        v_valor_total,
        'pendente',
        CURRENT_DATE,
        'compra_viagem',
        jsonb_build_object(
            'proposta_id', v_proposta_id,
            'pacote', v_proposta.snapshot_completo->>'titulo',
            'forma_pagamento', v_forma_pagamento
        )
    ) RETURNING id INTO v_fatura_id;

    -- 7. Criar a Transação da Viagem
    INSERT INTO public.viagens_transacoes (
        proposta_id,
        cliente_id,
        fatura_id,
        valor_pago,
        forma_pagamento,
        status
    ) VALUES (
        v_proposta_id,
        v_cliente_id,
        v_fatura_id,
        v_valor_total,
        v_forma_pagamento,
        'pendente'
    ) RETURNING id INTO v_transacao_id;

    -- Atualiza a proposta
    UPDATE public.viagens_propostas SET status = 'em_processamento' WHERE id = v_proposta_id;

    RETURN jsonb_build_object(
        'success', true,
        'transacao_id', v_transacao_id,
        'fatura_id', v_fatura_id
    );
END;
$$;

REVOKE ALL ON FUNCTION public.gsa_client_checkout_travel(jsonb) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.gsa_client_checkout_travel(jsonb) TO authenticated;
