-- Organiza os benefícios VIP:
-- benefits = lista acumulada exibida como pacote completo do nível
-- exclusive_benefits = somente benefícios que nascem naquele nível

update public.client_levels
set
  benefits = '[
    "Acesso inicial ao programa VIP",
    "Acompanhamento da evolução de nível",
    "Visualização dos próximos benefícios",
    "Acúmulo inicial de pontos",
    "Taxa de saque e transferência: 5%"
  ]'::jsonb,
  exclusive_benefits = '[
    "Acesso inicial ao programa VIP",
    "Acompanhamento da evolução de nível",
    "Visualização dos próximos benefícios",
    "Acúmulo inicial de pontos",
    "Taxa de saque e transferência: 5%"
  ]'::jsonb,
  pontos_por_real = 0.5,
  taxa_saque_transferencia = 5
where nome_nivel in ('Básico', 'Basico');

update public.client_levels
set
  benefits = '[
    "Acesso inicial ao programa VIP",
    "Acompanhamento da evolução de nível",
    "Visualização dos próximos benefícios",
    "Acúmulo inicial de pontos",
    "Taxa de saque e transferência: 5%",
    "Suporte prioritário básico",
    "Acesso a promoções selecionadas",
    "Acesso a descontos iniciais",
    "Multiplicador de pontos: 1x",
    "Taxa de saque e transferência reduzida: 4%"
  ]'::jsonb,
  exclusive_benefits = '[
    "Suporte prioritário básico",
    "Acesso a promoções selecionadas",
    "Acesso a descontos iniciais",
    "Multiplicador de pontos: 1x",
    "Taxa de saque e transferência reduzida: 4%"
  ]'::jsonb,
  pontos_por_real = 1,
  taxa_saque_transferencia = 4
where nome_nivel = 'Bronze';

update public.client_levels
set
  benefits = '[
    "Acesso inicial ao programa VIP",
    "Acompanhamento da evolução de nível",
    "Visualização dos próximos benefícios",
    "Acúmulo inicial de pontos",
    "Taxa de saque e transferência: 5%",
    "Suporte prioritário básico",
    "Acesso a promoções selecionadas",
    "Acesso a descontos iniciais",
    "Multiplicador de pontos: 1x",
    "Taxa de saque e transferência reduzida: 4%",
    "Promoções exclusivas Prata",
    "Descontos melhores em campanhas",
    "Vouchers selecionados",
    "Multiplicador de pontos: 2x",
    "Taxa de saque e transferência reduzida: 3%"
  ]'::jsonb,
  exclusive_benefits = '[
    "Promoções exclusivas Prata",
    "Descontos melhores em campanhas",
    "Vouchers selecionados",
    "Multiplicador de pontos: 2x",
    "Taxa de saque e transferência reduzida: 3%"
  ]'::jsonb,
  pontos_por_real = 2,
  taxa_saque_transferencia = 3
where nome_nivel = 'Prata';

update public.client_levels
set
  benefits = '[
    "Acesso inicial ao programa VIP",
    "Acompanhamento da evolução de nível",
    "Visualização dos próximos benefícios",
    "Acúmulo inicial de pontos",
    "Taxa de saque e transferência: 5%",
    "Suporte prioritário básico",
    "Acesso a promoções selecionadas",
    "Acesso a descontos iniciais",
    "Multiplicador de pontos: 1x",
    "Taxa de saque e transferência reduzida: 4%",
    "Promoções exclusivas Prata",
    "Descontos melhores em campanhas",
    "Vouchers selecionados",
    "Multiplicador de pontos: 2x",
    "Taxa de saque e transferência reduzida: 3%",
    "Suporte premium",
    "Acesso antecipado a promoções",
    "Vouchers exclusivos",
    "Descontos VIP",
    "Multiplicador de pontos: 3x",
    "Taxa de saque e transferência reduzida: 2%"
  ]'::jsonb,
  exclusive_benefits = '[
    "Suporte premium",
    "Acesso antecipado a promoções",
    "Vouchers exclusivos",
    "Descontos VIP",
    "Multiplicador de pontos: 3x",
    "Taxa de saque e transferência reduzida: 2%"
  ]'::jsonb,
  pontos_por_real = 3,
  taxa_saque_transferencia = 2
where nome_nivel = 'Ouro';

update public.client_levels
set
  benefits = '[
    "Acesso inicial ao programa VIP",
    "Acompanhamento da evolução de nível",
    "Visualização dos próximos benefícios",
    "Acúmulo inicial de pontos",
    "Taxa de saque e transferência: 5%",
    "Suporte prioritário básico",
    "Acesso a promoções selecionadas",
    "Acesso a descontos iniciais",
    "Multiplicador de pontos: 1x",
    "Taxa de saque e transferência reduzida: 4%",
    "Promoções exclusivas Prata",
    "Descontos melhores em campanhas",
    "Vouchers selecionados",
    "Multiplicador de pontos: 2x",
    "Taxa de saque e transferência reduzida: 3%",
    "Suporte premium",
    "Acesso antecipado a promoções",
    "Vouchers exclusivos",
    "Descontos VIP",
    "Multiplicador de pontos: 3x",
    "Taxa de saque e transferência reduzida: 2%",
    "Campanhas especiais exclusivas",
    "Vouchers especiais",
    "Desconto automático em fatura, se configurado",
    "Categoria Elite do programa VIP",
    "Multiplicador de pontos: 4x",
    "Taxa de saque e transferência reduzida: 1%"
  ]'::jsonb,
  exclusive_benefits = '[
    "Campanhas especiais exclusivas",
    "Vouchers especiais",
    "Desconto automático em fatura, se configurado",
    "Categoria Elite do programa VIP",
    "Multiplicador de pontos: 4x",
    "Taxa de saque e transferência reduzida: 1%"
  ]'::jsonb,
  pontos_por_real = 4,
  taxa_saque_transferencia = 1
where nome_nivel = 'Diamante';

update public.client_levels
set
  benefits = '[
    "Acesso inicial ao programa VIP",
    "Acompanhamento da evolução de nível",
    "Visualização dos próximos benefícios",
    "Acúmulo inicial de pontos",
    "Taxa de saque e transferência: 5%",
    "Suporte prioritário básico",
    "Acesso a promoções selecionadas",
    "Acesso a descontos iniciais",
    "Multiplicador de pontos: 1x",
    "Taxa de saque e transferência reduzida: 4%",
    "Promoções exclusivas Prata",
    "Descontos melhores em campanhas",
    "Vouchers selecionados",
    "Multiplicador de pontos: 2x",
    "Taxa de saque e transferência reduzida: 3%",
    "Suporte premium",
    "Acesso antecipado a promoções",
    "Vouchers exclusivos",
    "Descontos VIP",
    "Multiplicador de pontos: 3x",
    "Taxa de saque e transferência reduzida: 2%",
    "Campanhas especiais exclusivas",
    "Vouchers especiais",
    "Desconto automático em fatura, se configurado",
    "Categoria Elite do programa VIP",
    "Multiplicador de pontos: 4x",
    "Taxa de saque e transferência reduzida: 1%",
    "Nível máximo do programa VIP",
    "Maior multiplicador de pontos: 5x",
    "Campanhas exclusivas Black",
    "Vouchers premium",
    "Serviços selecionados com 100% OFF, se configurado",
    "Isenção total de taxas de saque e transferência: 0%"
  ]'::jsonb,
  exclusive_benefits = '[
    "Nível máximo do programa VIP",
    "Maior multiplicador de pontos: 5x",
    "Campanhas exclusivas Black",
    "Vouchers premium",
    "Serviços selecionados com 100% OFF, se configurado",
    "Isenção total de taxas de saque e transferência: 0%"
  ]'::jsonb,
  pontos_por_real = 5,
  taxa_saque_transferencia = 0
where nome_nivel = 'Black';
