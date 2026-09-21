-- Migration: 20260826140000_enable_realtime_full_replica_identity_105_tables.sql
-- Enables REPLICA IDENTITY FULL and adds all system tables to the supabase_realtime publication.
-- Fully idempotent: checks information_schema.tables and pg_publication_tables to prevent duplicate errors.

DO $$
DECLARE
    v_tables text[] := ARRAY[
        'assinaturas',
        'automacao_scraping_configs',
        'blog_posts',
        'carteira_lancamentos',
        'classificados_anuncios',
        'classificados_comissoes',
        'classificados_comissoes_config',
        'classificados_midias',
        'classificados_propostas',
        'classificados_transacoes',
        'client_levels',
        'cliente_cupons',
        'cliente_documentos',
        'cliente_premios',
        'cliente_promocoes',
        'clientes',
        'cobrancas',
        'colaboradores',
        'contratos',
        'cupons_ativados',
        'cupons_loja',
        'demanda_comentarios',
        'documentos_cliente',
        'documentos_prestador',
        'empresa',
        'emprestimo_comentarios',
        'emprestimo_documentos',
        'emprestimo_historico',
        'emprestimo_parcelas',
        'emprestimos',
        'extrato_financeiro',
        'fatura_contestacoes',
        'faturas',
        'fornecedores',
        'gsa_afiliados',
        'gsa_client_operation_requests',
        'gsa_tv_audit_log',
        'gsa_tv_channels',
        'gsa_tv_incidents',
        'gsa_tv_jobs',
        'gsa_tv_media_items',
        'gsa_tv_playlists',
        'gsa_tv_schedule_slots',
        'gsa_whatsapp_ramais',
        'indicacoes',
        'level_history',
        'loja_avaliacoes',
        'loja_carrinhos',
        'loja_categorias',
        'loja_credito_documentos',
        'loja_credito_movimentacoes',
        'loja_credito_solicitacoes',
        'loja_estoque_historico',
        'loja_favoritos',
        'loja_pedido_itens',
        'loja_pedidos',
        'loja_reembolsos',
        'loja_solicitacoes',
        'loja_vaquinha_contribuicoes',
        'notificacao_leituras',
        'notificacoes',
        'orcamentos',
        'ordens_assinatura',
        'ordens_compra',
        'ordens_fiscais',
        'ordens_servico',
        'os_notas',
        'os_suporte_mensagens',
        'pagamentos',
        'parceiros',
        'parceiros_resgates',
        'points_transactions',
        'pontos_movimentacoes',
        'prestador_agendamentos',
        'prestador_demandas',
        'prestador_demandas_historico',
        'prestador_documentos',
        'prestador_faturas',
        'prestador_historico',
        'prestador_premios',
        'prestador_promocoes',
        'prestador_promocoes_ativacoes',
        'prestador_saques',
        'prestador_suporte_demandas',
        'prestador_transacoes',
        'prestador_vouchers',
        'prestadores',
        'produto_fornecedor_config',
        'produto_variacao_grupos',
        'produto_variacao_opcoes',
        'produto_variante_opcoes',
        'produto_variantes',
        'produtos',
        'promocoes',
        'promocoes_quantidade',
        'promocoes_quantidade_ativadas',
        'promocoes_quantidade_uso',
        'saques',
        'saude_contratos',
        'seguros_apolices',
        'servicos',
        'sistema_logs',
        'solicitacoes_exclusao',
        'suporte_mensagens',
        'system_settings',
        'ticket_mensagens',
        'tickets',
        'transferencias',
        'viagens_categorias',
        'viagens_orcamentos',
        'viagens_pacote_imagens',
        'viagens_pacotes',
        'viagens_passageiro_documentos',
        'viagens_passageiros',
        'viagens_propostas',
        'viagens_transacoes',
        'vouchers'
    ];
    t text;
BEGIN
    -- 1. Ensure supabase_realtime publication exists
    IF NOT EXISTS (SELECT 1 FROM pg_publication WHERE pubname = 'supabase_realtime') THEN
        CREATE PUBLICATION supabase_realtime;
    END IF;

    -- 2. Process each table in the array
    FOREACH t IN ARRAY v_tables
    LOOP
        -- Check if the table physically exists in information_schema.tables under schema 'public'
        IF EXISTS (
            SELECT 1 
            FROM information_schema.tables 
            WHERE table_schema = 'public' 
              AND table_name = t
        ) THEN
            -- Set REPLICA IDENTITY to FULL so Realtime payloads carry complete old and new row states
            BEGIN
                EXECUTE format('ALTER TABLE public.%I REPLICA IDENTITY FULL;', t);
            EXCEPTION WHEN OTHERS THEN
                RAISE NOTICE 'Notice: Unable to set REPLICA IDENTITY FULL on public.%: %', t, SQLERRM;
            END;

            -- Add table to publication if it is not already a member
            IF NOT EXISTS (
                SELECT 1 
                FROM pg_publication_tables 
                WHERE pubname = 'supabase_realtime' 
                  AND schemaname = 'public' 
                  AND tablename = t
            ) THEN
                BEGIN
                    EXECUTE format('ALTER PUBLICATION supabase_realtime ADD TABLE public.%I;', t);
                EXCEPTION 
                    WHEN duplicate_object THEN
                        -- Handled idempotently
                        NULL;
                    WHEN OTHERS THEN
                        RAISE NOTICE 'Notice: Unable to add public.% to supabase_realtime: %', t, SQLERRM;
                END;
            END IF;
        END IF;
    END LOOP;
END $$;
