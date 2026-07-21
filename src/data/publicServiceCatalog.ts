import type { ComponentType } from 'react';
import { BriefcaseBusiness, CreditCard, Headphones, PackageCheck, ShoppingBag, Sparkles } from 'lucide-react';

export type Audience = 'PF' | 'PJ';
export type PublicPage = 'home' | 'services' | 'systems' | 'partners';

export interface IconItem {
  icon: ComponentType<{ className?: string }>;
  title: string;
  text: string;
}

export interface ServiceItem {
  name: string;
  desc: string;
}

export interface ServicePackage {
  audience: Audience;
  title: string;
  subtitle: string;
  description: string;
  services: ServiceItem[];
}

export function getServicePackageSlug(servicePackage: Pick<ServicePackage, 'title'>): string {
  return servicePackage.title
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
}

export const publicServices: IconItem[] = [
  { icon: BriefcaseBusiness, title: 'Serviços administrativos', text: 'Organização de demandas, contratos, documentos e rotinas para empresas e clientes.' },
  { icon: CreditCard, title: 'Crédito e financeiro', text: 'Soluções para acompanhar faturas, crédito, pagamentos e solicitações em um só lugar.' },
  { icon: Headphones, title: 'Suporte e atendimento', text: 'Abertura de chamados, acompanhamento e histórico para manter tudo rastreável.' },
];

export const publicProducts: IconItem[] = [
  { icon: ShoppingBag, title: 'Produtos GSA', text: 'Itens e ofertas disponíveis para consulta antes da compra.' },
  { icon: PackageCheck, title: 'Assinaturas', text: 'Planos recorrentes e benefícios para quem usa os serviços com frequência.' },
  { icon: Sparkles, title: 'Promoções', text: 'Campanhas e vantagens que podem ser ativadas na área do cliente.' },
];

export const servicePackages: ServicePackage[] = [
  {
    audience: 'PF',
    title: 'Pacote Futuro Garantido',
    subtitle: 'Soluções previdenciárias e benefícios INSS',
    description: 'Planejamento previdenciário, aposentadorias, benefícios por incapacidade, BPC/LOAS, pensão por morte e recursos administrativos.',
    services: [
      { name: 'Planejamento Previdenciário', desc: 'Cálculo de tempo de contribuição, simulação de valores e análise do melhor momento.' },
      { name: 'Aposentadorias', desc: 'Idade, tempo de contribuição, especial, rural e pessoa com deficiência.' },
      { name: 'Benefícios por Incapacidade', desc: 'Auxílio-doença e aposentadoria por invalidez.' },
      { name: 'Benefícios Assistenciais e Pensão', desc: 'BPC/LOAS, pensão por morte e salário-maternidade.' },
      { name: 'Assessoria Administrativa', desc: 'Recursos administrativos, revisão de benefícios e acertos de CNIS.' },
    ],
  },
  {
    audience: 'PF',
    title: 'Pacote Microempreendedor',
    subtitle: 'Serviços para MEI',
    description: 'Gestão completa para o microempreendedor manter a empresa regularizada, emitir documentos e resolver pendências.',
    services: [
      { name: 'Gestão do MEI', desc: 'Abertura, formalização e baixa do registro MEI.' },
      { name: 'Notas Fiscais', desc: 'Emissão de notas fiscais de produtos e serviços.' },
      { name: 'Regularização', desc: 'Declarações anuais, parcelamento de DAS e emissão de guias.' },
    ],
  },
  {
    audience: 'PF',
    title: 'Pacote Direção Livre',
    subtitle: 'Soluções veiculares e CNH',
    description: 'Regularização documental para condutores e veículos, incluindo licenciamento, transferência, renovação e defesa de infrações.',
    services: [
      { name: 'Regularização de Veículos', desc: 'Licenciamento, transferência, emplacamento, gravame, CRV e procurações.' },
      { name: 'Habilitação CNH', desc: 'Renovação, EAR, PID, CNH definitiva e alteração de dados.' },
      { name: 'Defesa de Infrações', desc: 'Indicação de condutor, recursos e defesa de suspensão ou cassação.' },
    ],
  },
];
