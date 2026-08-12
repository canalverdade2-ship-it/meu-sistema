-- Testar se o upgrade de nível VIP acontece 100% automaticamente no banco de dados
DO $$
DECLARE
    v_test_client_id UUID;
    v_level_name TEXT;
    v_notif_count INT;
    v_history_count INT;
BEGIN
    -- Seleciona um cliente aleatório para teste ou insere um temporário
    SELECT id INTO v_test_client_id FROM public.clientes WHERE nivel_manual_id IS NULL LIMIT 1;

    IF v_test_client_id IS NOT NULL THEN
        RAISE NOTICE 'Testando upgrade automático no cliente %', v_test_client_id;
        
        -- Atualiza pontos_totais para 2500 (Faixa Diamante: 2000-2999)
        UPDATE public.clientes 
        SET pontos_totais = 2500 
        WHERE id = v_test_client_id;

        -- Verifica qual nível ficou gravado no cliente
        SELECT cl.nome_nivel INTO v_level_name
        FROM public.clientes c
        JOIN public.client_levels cl ON cl.id = c.nivel_id
        WHERE c.id = v_test_client_id;

        -- Verifica se criou registro em level_history
        SELECT COUNT(*) INTO v_history_count
        FROM public.level_history
        WHERE cliente_id = v_test_client_id;

        -- Verifica se criou notificação
        SELECT COUNT(*) INTO v_notif_count
        FROM public.notificacoes
        WHERE cliente_id = v_test_client_id AND modulo = 'area_vip';

        RAISE NOTICE 'RESULTADO DO TESTE: Nivel=% | HistoryCount=% | NotifCount=%', v_level_name, v_history_count, v_notif_count;
    END IF;
END;
$$;
