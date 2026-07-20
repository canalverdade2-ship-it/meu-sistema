-- RPC para criar um anúncio e suas mídias de forma atômica
CREATE OR REPLACE FUNCTION public.rpc_criar_anuncio_classificado(
    p_cliente_id UUID,
    p_categoria VARCHAR,
    p_titulo VARCHAR,
    p_descricao TEXT,
    p_preco DECIMAL,
    p_cidade VARCHAR,
    p_estado VARCHAR,
    p_bairro VARCHAR,
    p_detalhes JSONB,
    p_comissao_aceita DECIMAL,
    p_midias JSONB -- Array de objetos com {url, tipo, ordem}
) RETURNS JSONB AS $$
DECLARE
    v_anuncio_id UUID;
    v_slug VARCHAR;
    v_midia JSONB;
BEGIN
    -- Gera um slug básico
    v_slug := lower(regexp_replace(p_titulo, '[^a-zA-Z0-9]+', '-', 'g')) || '-' || floor(random() * 100000)::text;

    INSERT INTO public.classificados_anuncios (
        cliente_id, categoria, slug, titulo, descricao, preco, 
        cidade, estado, bairro, detalhes, status, comissao_aceita_percentual
    ) VALUES (
        p_cliente_id, p_categoria, v_slug, p_titulo, p_descricao, p_preco,
        p_cidade, p_estado, p_bairro, p_detalhes, 'aguardando_revisao', p_comissao_aceita
    ) RETURNING id INTO v_anuncio_id;

    -- Inserir Mídias
    IF jsonb_typeof(p_midias) = 'array' THEN
        FOR v_midia IN SELECT * FROM jsonb_array_elements(p_midias)
        LOOP
            INSERT INTO public.classificados_anuncio_midias (
                anuncio_id, url, tipo, ordem
            ) VALUES (
                v_anuncio_id, 
                v_midia->>'url', 
                v_midia->>'tipo', 
                COALESCE((v_midia->>'ordem')::int, 0)
            );
        END LOOP;
    END IF;

    RETURN jsonb_build_object('success', true, 'anuncio_id', v_anuncio_id, 'slug', v_slug);
EXCEPTION WHEN OTHERS THEN
    RETURN jsonb_build_object('success', false, 'error', SQLERRM);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- RPC para enviar uma proposta e a primeira mensagem
CREATE OR REPLACE FUNCTION public.rpc_enviar_proposta_classificado(
    p_anuncio_id UUID,
    p_comprador_id UUID,
    p_valor_proposta DECIMAL,
    p_mensagem_inicial TEXT
) RETURNS JSONB AS $$
DECLARE
    v_vendedor_id UUID;
    v_proposta_id UUID;
BEGIN
    -- Busca vendedor
    SELECT cliente_id INTO v_vendedor_id FROM public.classificados_anuncios WHERE id = p_anuncio_id;

    IF v_vendedor_id IS NULL THEN
        RETURN jsonb_build_object('success', false, 'error', 'Anúncio não encontrado.');
    END IF;
    
    IF v_vendedor_id = p_comprador_id THEN
        RETURN jsonb_build_object('success', false, 'error', 'Você não pode enviar uma proposta para si mesmo.');
    END IF;

    -- Cria proposta
    INSERT INTO public.classificados_propostas (
        anuncio_id, comprador_id, vendedor_id, valor_proposta, mensagem_inicial, status
    ) VALUES (
        p_anuncio_id, p_comprador_id, v_vendedor_id, p_valor_proposta, p_mensagem_inicial, 'em_analise_gsa'
    ) RETURNING id INTO v_proposta_id;

    -- Cria primeira mensagem pendente de moderação
    IF p_mensagem_inicial IS NOT NULL AND trim(p_mensagem_inicial) <> '' THEN
        INSERT INTO public.classificados_mensagens (
            proposta_id, remetente_id, destinatario_id, conteudo, status
        ) VALUES (
            v_proposta_id, p_comprador_id, v_vendedor_id, p_mensagem_inicial, 'pending_moderation'
        );
    END IF;

    RETURN jsonb_build_object('success', true, 'proposta_id', v_proposta_id);
EXCEPTION WHEN OTHERS THEN
    RETURN jsonb_build_object('success', false, 'error', SQLERRM);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- RPC para moderar mensagem
CREATE OR REPLACE FUNCTION public.rpc_admin_moderar_mensagem_classificado(
    p_mensagem_id UUID,
    p_acao VARCHAR, -- 'approve' ou 'reject'
    p_motivo_rejeicao TEXT DEFAULT NULL
) RETURNS JSONB AS $$
DECLARE
    v_status classificados_status_mensagem;
BEGIN
    IF p_acao = 'approve' THEN
        v_status := 'approved';
    ELSIF p_acao = 'reject' THEN
        v_status := 'rejected';
    ELSE
        RETURN jsonb_build_object('success', false, 'error', 'Ação inválida.');
    END IF;

    UPDATE public.classificados_mensagens
    SET 
        status = v_status,
        motivo_rejeicao = p_motivo_rejeicao,
        moderated_at = NOW()
    WHERE id = p_mensagem_id;

    RETURN jsonb_build_object('success', true);
EXCEPTION WHEN OTHERS THEN
    RETURN jsonb_build_object('success', false, 'error', SQLERRM);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- RPC para concluir transação e gerar comissão
CREATE OR REPLACE FUNCTION public.rpc_admin_concluir_transacao_classificado(
    p_transacao_id UUID
) RETURNS JSONB AS $$
DECLARE
    v_transacao RECORD;
    v_fatura_id UUID;
    v_valor_comissao DECIMAL;
BEGIN
    SELECT * INTO v_transacao FROM public.classificados_transacoes WHERE id = p_transacao_id;
    IF NOT FOUND THEN
        RETURN jsonb_build_object('success', false, 'error', 'Transação não encontrada.');
    END IF;

    IF v_transacao.status = 'concluida' THEN
        RETURN jsonb_build_object('success', false, 'error', 'Transação já está concluída.');
    END IF;

    -- Calcular comissão
    v_valor_comissao := v_transacao.valor_final * (v_transacao.comissao_snapshot_percentual / 100.0);

    -- Atualiza status da transação
    UPDATE public.classificados_transacoes SET status = 'concluida' WHERE id = p_transacao_id;

    -- Atualiza status do anúncio para vendido
    UPDATE public.classificados_anuncios SET status = 'vendido' WHERE id = v_transacao.anuncio_id;

    -- Cria Fatura (Usando o sistema financeiro existente: tabela faturas)
    -- Supondo que faturas exige cliente_id, valor, vencimento, status, descricao, etc
    -- As colunas exatas dependem do schema atual, aqui é uma inferência genérica do sistema GSA
    INSERT INTO public.faturas (
        cliente_id, 
        valor, 
        vencimento, 
        status, 
        descricao, 
        origem, 
        data_emissao
    ) VALUES (
        v_transacao.vendedor_id, 
        v_valor_comissao, 
        NOW() + INTERVAL '5 days', 
        'pendente', 
        'Comissão GSA Classificados - Transação ' || left(p_transacao_id::text, 8), 
        'classificados', 
        NOW()
    ) RETURNING id INTO v_fatura_id;

    -- Cria registro de Comissão linkando à Fatura
    INSERT INTO public.classificados_comissoes (
        transacao_id, vendedor_id, valor_comissao, status, fatura_id, data_vencimento
    ) VALUES (
        p_transacao_id, v_transacao.vendedor_id, v_valor_comissao, 'pendente', v_fatura_id, NOW() + INTERVAL '5 days'
    );

    RETURN jsonb_build_object('success', true, 'fatura_id', v_fatura_id, 'valor_comissao', v_valor_comissao);
EXCEPTION WHEN OTHERS THEN
    RETURN jsonb_build_object('success', false, 'error', SQLERRM);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
