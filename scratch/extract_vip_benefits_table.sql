-- Extrair todos os detalhes e beneficios dos niveis VIP cadastrados no banco
SELECT 
    nome_nivel,
    pontos_minimos,
    COALESCE(pontos_maximos::text, 'Sem limite') AS pontos_maximos,
    pontos_por_real AS multiplicador_pontos,
    desconto_porcentagem AS desconto_loja_servicos_pct,
    taxa_saque_transferencia AS taxa_financeira_pct,
    preco AS preco_assinatura_rs,
    visual_style,
    benefits,
    exclusive_benefits
FROM public.client_levels
ORDER BY pontos_minimos ASC;
