-- ============================================================
-- MIGRATION: 20260812101500_automated_vip_level_upgrade.sql
-- OBJETIVO: Automatização 100% em tempo real do upgrade do Nível VIP
--           quando o cliente acumula pontos_totais.
-- ============================================================

CREATE OR REPLACE FUNCTION public.fn_gsa_auto_check_vip_level()
RETURNS TRIGGER AS $$
DECLARE
    v_target_level_id UUID;
    v_target_level_name TEXT;
    v_target_multiplier NUMERIC;
    v_target_discount NUMERIC;
    v_target_fee NUMERIC;
    v_target_benefits JSONB;
    v_prev_level_id UUID;
    v_msg TEXT;
BEGIN
    -- Se o cliente tiver um ajuste manual ativo (nivel_manual_id NOT NULL),
    -- respeita a decisão administrativa e não altera o nivel_id automaticamente.
    IF NEW.nivel_manual_id IS NOT NULL THEN
        RETURN NEW;
    END IF;

    -- Busca o nível mais alto que o cliente atinge com sua pontuação total
    SELECT id, nome_nivel, pontos_por_real, desconto_porcentagem, taxa_saque_transferencia, benefits
    INTO v_target_level_id, v_target_level_name, v_target_multiplier, v_target_discount, v_target_fee, v_target_benefits
    FROM public.client_levels
    WHERE pontos_minimos <= COALESCE(NEW.pontos_totais, 0)
    ORDER BY pontos_minimos DESC
    LIMIT 1;

    -- Se encontrou um nível e é diferente do nível atual do cliente:
    IF v_target_level_id IS NOT NULL AND (OLD.nivel_id IS NULL OR OLD.nivel_id IS DISTINCT FROM v_target_level_id) THEN
        v_prev_level_id := OLD.nivel_id;
        NEW.nivel_id := v_target_level_id;

        -- 1. Registrar a alteração no histórico oficial de níveis (level_history)
        INSERT INTO public.level_history (cliente_id, nivel_anterior_id, nivel_novo_id, created_at)
        VALUES (NEW.id, v_prev_level_id, v_target_level_id, NOW());

        -- 2. Montar mensagem detalhada dos novos benefícios conquistados
        v_msg := 'Parabéns! Com ' || COALESCE(NEW.pontos_totais, 0) || ' pontos acumulados, você subiu para o Nível VIP ' || COALESCE(v_target_level_name, 'Novo Nível') || '! ' ||
                 'Novas regalias liberadas: Multiplicador de Pontos: ' || COALESCE(v_target_multiplier, 1) || 'x, ' ||
                 'Desconto VIP em Loja/Serviços: ' || COALESCE(v_target_discount, 0) || '%, ' ||
                 'Taxa de Saque/Transferência: apenas ' || COALESCE(v_target_fee, 0) || '%.';

        -- 3. Inserir notificação no sistema para o cliente
        INSERT INTO public.notificacoes (
            cliente_id,
            titulo,
            mensagem,
            modulo,
            tab,
            item_id,
            destinatario_tipo,
            acao_origem,
            contexto
        ) VALUES (
            NEW.id,
            '👑 Upgrade de Nível VIP Confirmado!',
            v_msg,
            'area_vip',
            'Geral',
            v_target_level_id::text,
            'cliente',
            'upgrade_nivel_automatico',
            jsonb_build_object(
                'nivel_nome', v_target_level_name,
                'pontos_totais', NEW.pontos_totais,
                'multiplicador', v_target_multiplier,
                'desconto_porcentagem', v_target_discount,
                'taxa_saque_transferencia', v_target_fee
            )
        );
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Aplica a trigger BEFORE INSERT OR UPDATE na tabela clientes
DROP TRIGGER IF EXISTS trg_gsa_auto_vip_level_upgrade ON public.clientes;
CREATE TRIGGER trg_gsa_auto_vip_level_upgrade
BEFORE INSERT OR UPDATE OF pontos_totais, nivel_manual_id ON public.clientes
FOR EACH ROW
EXECUTE FUNCTION public.fn_gsa_auto_check_vip_level();

-- ============================================================
-- BACKFILL INICIAL: Recalcular o nível orgânico de todos os clientes
-- cujas contas não possuam nivel_manual_id sobrescrito
-- ============================================================
DO $$
DECLARE
    r RECORD;
    v_correct_level_id UUID;
BEGIN
    FOR r IN SELECT id, pontos_totais, nivel_id FROM public.clientes WHERE nivel_manual_id IS NULL LOOP
        SELECT id INTO v_correct_level_id
        FROM public.client_levels
        WHERE pontos_minimos <= COALESCE(r.pontos_totais, 0)
        ORDER BY pontos_minimos DESC
        LIMIT 1;

        IF v_correct_level_id IS NOT NULL AND (r.nivel_id IS NULL OR r.nivel_id IS DISTINCT FROM v_correct_level_id) THEN
            UPDATE public.clientes
            SET nivel_id = v_correct_level_id
            WHERE id = r.id;
        END IF;
    END LOOP;
END;
$$;
