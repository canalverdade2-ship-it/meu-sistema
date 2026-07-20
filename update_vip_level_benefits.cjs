require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.VITE_SUPABASE_ANON_KEY
);

const basico = [
  'Acesso inicial ao programa VIP',
  'Acompanhamento da evolução de nível',
  'Visualização dos próximos benefícios',
  'Acúmulo inicial de pontos',
  'Taxa de saque e transferência: 5%',
];

const bronze = [
  'Suporte prioritário básico',
  'Acesso a promoções selecionadas',
  'Acesso a descontos iniciais',
  'Multiplicador de pontos: 1x',
  'Taxa de saque e transferência reduzida: 4%',
];

const prata = [
  'Promoções exclusivas Prata',
  'Descontos melhores em campanhas',
  'Vouchers selecionados',
  'Multiplicador de pontos: 2x',
  'Taxa de saque e transferência reduzida: 3%',
];

const ouro = [
  'Suporte premium',
  'Acesso antecipado a promoções',
  'Vouchers exclusivos',
  'Descontos VIP',
  'Multiplicador de pontos: 3x',
  'Taxa de saque e transferência reduzida: 2%',
];

const diamante = [
  'Campanhas especiais exclusivas',
  'Vouchers especiais',
  'Desconto automático em fatura, se configurado',
  'Categoria Elite do programa VIP',
  'Multiplicador de pontos: 4x',
  'Taxa de saque e transferência reduzida: 1%',
];

const black = [
  'Nível máximo do programa VIP',
  'Maior multiplicador de pontos: 5x',
  'Campanhas exclusivas Black',
  'Vouchers premium',
  'Serviços selecionados com 100% OFF, se configurado',
  'Isenção total de taxas de saque e transferência: 0%',
];

const levels = [
  { names: ['Básico', 'Basico'], benefits: basico, exclusiveBenefits: basico, multiplier: 0.5, fee: 5 },
  { names: ['Bronze'], benefits: [...basico, ...bronze], exclusiveBenefits: bronze, multiplier: 1, fee: 4 },
  { names: ['Prata'], benefits: [...basico, ...bronze, ...prata], exclusiveBenefits: prata, multiplier: 2, fee: 3 },
  { names: ['Ouro'], benefits: [...basico, ...bronze, ...prata, ...ouro], exclusiveBenefits: ouro, multiplier: 3, fee: 2 },
  { names: ['Diamante'], benefits: [...basico, ...bronze, ...prata, ...ouro, ...diamante], exclusiveBenefits: diamante, multiplier: 4, fee: 1 },
  { names: ['Black'], benefits: [...basico, ...bronze, ...prata, ...ouro, ...diamante, ...black], exclusiveBenefits: black, multiplier: 5, fee: 0 },
];

async function run() {
  for (const level of levels) {
    const { error } = await supabase
      .from('client_levels')
      .update({
        benefits: level.benefits,
        exclusive_benefits: level.exclusiveBenefits,
        pontos_por_real: level.multiplier,
        taxa_saque_transferencia: level.fee,
      })
      .in('nome_nivel', level.names);

    if (error) {
      console.error(`Erro ao atualizar ${level.names.join('/')}:`, error);
      process.exit(1);
    }
  }

  const { data, error } = await supabase
    .from('client_levels')
    .select('nome_nivel, exclusive_benefits')
    .order('pontos_minimos', { ascending: true });

  if (error) {
    console.error('Atualizou, mas não conseguiu validar:', error);
    process.exit(1);
  }

  console.log(JSON.stringify(data, null, 2));
}

run();
