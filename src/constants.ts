export interface VIPLevel {
  id: string;
  name: string;
  minPoints: number;
  maxPoints: number | null;
  multiplier: number;
  color: string;
  secondaryColor?: string;
  textColor: string;
  benefits: string[];
  exclusiveBenefits: string[];
  visualStyle: 'clean' | 'copper' | 'silver' | 'gold-black' | 'diamond' | 'black-luxury';
  discountPercentage?: number;
  feePercentage: number;
  price: number;
  dbId?: string;
}

const BASICO_BENEFITS = [
  'Acesso inicial ao programa VIP',
  'Acompanhamento da evolução de nível',
  'Visualização dos próximos benefícios',
  'Acúmulo inicial de pontos',
  'Taxa de saque e transferência: 5%',
];

const BRONZE_BENEFITS = [
  'Suporte prioritário básico',
  'Acesso a promoções selecionadas',
  'Acesso a descontos iniciais',
  'Multiplicador de pontos: 1x',
  'Taxa de saque e transferência reduzida: 4%',
];

const PRATA_BENEFITS = [
  'Promoções exclusivas Prata',
  'Descontos melhores em campanhas',
  'Vouchers selecionados',
  'Multiplicador de pontos: 2x',
  'Taxa de saque e transferência reduzida: 3%',
];

const OURO_BENEFITS = [
  'Suporte premium',
  'Acesso antecipado a promoções',
  'Vouchers exclusivos',
  'Descontos VIP',
  'Multiplicador de pontos: 3x',
  'Taxa de saque e transferência reduzida: 2%',
];

const DIAMANTE_BENEFITS = [
  'Campanhas especiais exclusivas',
  'Vouchers especiais',
  'Desconto automático em fatura, se configurado',
  'Categoria Elite do programa VIP',
  'Multiplicador de pontos: 4x',
  'Taxa de saque e transferência reduzida: 1%',
];

const BLACK_BENEFITS = [
  'Nível máximo do programa VIP',
  'Maior multiplicador de pontos: 5x',
  'Campanhas exclusivas Black',
  'Vouchers premium',
  'Serviços selecionados com 100% OFF, se configurado',
  'Isenção total de taxas de saque e transferência: 0%',
];

export const VIP_LEVELS: VIPLevel[] = [
  {
    id: 'basico',
    name: 'Básico',
    minPoints: 0,
    maxPoints: 199,
    multiplier: 0.5,
    color: '#f5f5f5',
    textColor: '#1a1a1a',
    visualStyle: 'clean',
    feePercentage: 5,
    price: 0,
    benefits: [...BASICO_BENEFITS],
    exclusiveBenefits: [...BASICO_BENEFITS],
  },
  {
    id: 'bronze',
    name: 'Bronze',
    minPoints: 200,
    maxPoints: 499,
    multiplier: 1,
    color: '#cd7f32',
    textColor: '#ffffff',
    visualStyle: 'copper',
    feePercentage: 4,
    price: 100,
    benefits: [...BASICO_BENEFITS, ...BRONZE_BENEFITS],
    exclusiveBenefits: [...BRONZE_BENEFITS],
  },
  {
    id: 'prata',
    name: 'Prata',
    minPoints: 500,
    maxPoints: 899,
    multiplier: 2,
    color: '#c0c0c0',
    textColor: '#1a1a1a',
    visualStyle: 'silver',
    feePercentage: 3,
    price: 300,
    benefits: [...BASICO_BENEFITS, ...BRONZE_BENEFITS, ...PRATA_BENEFITS],
    exclusiveBenefits: [...PRATA_BENEFITS],
  },
  {
    id: 'ouro',
    name: 'Ouro',
    minPoints: 900,
    maxPoints: 1499,
    multiplier: 3,
    color: '#ffd700',
    textColor: '#000000',
    visualStyle: 'gold-black',
    feePercentage: 2,
    price: 600,
    benefits: [...BASICO_BENEFITS, ...BRONZE_BENEFITS, ...PRATA_BENEFITS, ...OURO_BENEFITS],
    exclusiveBenefits: [...OURO_BENEFITS],
  },
  {
    id: 'diamante',
    name: 'Diamante',
    minPoints: 1500,
    maxPoints: 2999,
    multiplier: 4,
    color: '#b9f2ff',
    textColor: '#000000',
    visualStyle: 'diamond',
    discountPercentage: 10,
    feePercentage: 1,
    price: 800,
    benefits: [...BASICO_BENEFITS, ...BRONZE_BENEFITS, ...PRATA_BENEFITS, ...OURO_BENEFITS, ...DIAMANTE_BENEFITS],
    exclusiveBenefits: [...DIAMANTE_BENEFITS],
  },
  {
    id: 'black',
    name: 'Black',
    minPoints: 3000,
    maxPoints: null,
    multiplier: 5,
    color: '#000000',
    textColor: '#ffffff',
    visualStyle: 'black-luxury',
    discountPercentage: 15,
    feePercentage: 0,
    price: 1000,
    benefits: [...BASICO_BENEFITS, ...BRONZE_BENEFITS, ...PRATA_BENEFITS, ...OURO_BENEFITS, ...DIAMANTE_BENEFITS, ...BLACK_BENEFITS],
    exclusiveBenefits: [...BLACK_BENEFITS],
  },
];
