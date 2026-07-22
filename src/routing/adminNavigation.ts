import {
  BarChart3,
  Gift,
  HeartPulse,
  Landmark,
  LayoutDashboard,
  Megaphone,
  Plane,
  Settings,
  ShieldCheck,
  Store,
  Tags,
  Users,
  type LucideIcon,
} from 'lucide-react';
import type { AdminModule } from './adminAccess';

export type AdminPendencyKey =
  | 'moduleDemandas'
  | 'moduleCobranca'
  | 'moduleFiscal'
  | 'moduleFinanceiro'
  | 'moduleSuporte'
  | 'moduleAcessos'
  | 'cadastro_clientes_inativos'
  | 'cadastro_clientes_bloqueados'
  | 'cadastro_clientes_pendentes'
  | 'cadastro_cliente_documentos_analise'
  | 'cadastro_prestadores_pendentes'
  | 'cadastro_prestadores_analise'
  | 'cadastro_documentos_pendentes'
  | 'cadastro_vouchers_pendentes'
  | 'cadastro_premios_pendentes'
  | 'vendas_orcamentos_pendentes'
  | 'vendas_orcamentos_aprovados'
  | 'vendas_demandas_abertas'
  | 'vendas_demandas_prestador'
  | 'vendas_demandas_suporte'
  | 'vendas_os_andamento'
  | 'vendas_assinaturas_pendentes'
  | 'vendas_emprestimos_pendentes'
  | 'vendas_credito_pendentes';

export type AdminNavigationEntry = {
  id: string;
  label: string;
  module: AdminModule;
  permissionModule?: AdminModule;
  tab?: string;
  adminOnly?: boolean;
  badgeKeys?: AdminPendencyKey[];
};

export type AdminNavigationSection = {
  label?: string;
  entries: AdminNavigationEntry[];
};

export type AdminNavigationGroup = {
  id: string;
  label: string;
  icon: LucideIcon;
  sections: AdminNavigationSection[];
};

export const ADMIN_NAVIGATION_GROUPS: AdminNavigationGroup[] = [
  {
    id: 'visao-geral',
    label: 'Visão Geral',
    icon: LayoutDashboard,
    sections: [{ entries: [
      { id: 'dashboard', label: 'Dashboard', module: 'dashboard' },
      { id: 'demandas', label: 'Minhas Demandas', module: 'demandas', badgeKeys: ['moduleDemandas'] },
    ] }],
  },
  {
    id: 'cadastros-rede',
    label: 'Cadastros e Rede',
    icon: Users,
    sections: [{ entries: [
      {
        id: 'clientes',
        label: 'Clientes',
        module: 'cadastro',
        tab: 'clientes',
        badgeKeys: ['cadastro_clientes_inativos', 'cadastro_clientes_bloqueados', 'cadastro_clientes_pendentes', 'cadastro_cliente_documentos_analise'],
      },
      {
        id: 'prestadores',
        label: 'Prestadores',
        module: 'cadastro',
        permissionModule: 'prestadores',
        tab: 'prestadores',
        badgeKeys: ['cadastro_prestadores_pendentes', 'cadastro_prestadores_analise', 'cadastro_documentos_pendentes'],
      },
      { id: 'parceiros', label: 'Parceiros', module: 'parceiros' },
    ] }],
  },
  {
    id: 'loja-gsa',
    label: 'Loja GSA',
    icon: Store,
    sections: [
      { label: 'Catálogo', entries: [
        { id: 'central-loja', label: 'Catálogo e Loja', module: 'loja' },
      ] },
      { label: 'Vendas', entries: [
        {
          id: 'operacoes',
          label: 'Vendas e Operações',
          module: 'operacoes',
          badgeKeys: [
            'vendas_orcamentos_pendentes',
            'vendas_orcamentos_aprovados',
            'vendas_demandas_abertas',
            'vendas_demandas_prestador',
            'vendas_demandas_suporte',
            'vendas_os_andamento',
            'vendas_assinaturas_pendentes',
          ],
        },
        { id: 'credito-loja', label: 'Crédito da Loja', module: 'credito_loja', badgeKeys: ['vendas_credito_pendentes'] },
      ] },
      { label: 'Gestão', entries: [
        { id: 'fornecedores', label: 'Fornecedores e Suprimentos', module: 'fornecedores' },
        { id: 'promocoes-quantidade', label: 'Promoções por Quantidade', module: 'promocoes' },
      ] },
    ],
  },
  {
    id: 'classificados-gsa',
    label: 'Classificados GSA',
    icon: Tags,
    sections: [{ entries: [
      { id: 'classificados-anuncios', label: 'Anúncios', module: 'classificados', tab: 'anuncios' },
      { id: 'classificados-mensagens', label: 'Mensagens', module: 'classificados', tab: 'mensagens' },
      { id: 'classificados-financeiro', label: 'Transações e Comissões', module: 'classificados', tab: 'financeiro' },
    ] }],
  },
  {
    id: 'gsa-anuncios',
    label: 'GSA Anúncios',
    icon: Megaphone,
    sections: [{ entries: [
      { id: 'anuncios-solicitacoes', label: 'Solicitações', module: 'anuncios', tab: 'requests' },
      { id: 'anuncios-propostas', label: 'Propostas', module: 'anuncios', tab: 'proposals' },
      { id: 'anuncios-campanhas', label: 'Campanhas', module: 'anuncios', tab: 'campaigns' },
      { id: 'anuncios-criativos', label: 'Criativos', module: 'anuncios', tab: 'creatives' },
      { id: 'anuncios-pagamentos', label: 'Pagamentos', module: 'anuncios', tab: 'payments' },
      { id: 'anuncios-inventario', label: 'Inventário', module: 'anuncios', tab: 'inventory' },
    ] }],
  },
  {
    id: 'gsa-viagens',
    label: 'GSA Viagens',
    icon: Plane,
    sections: [{ entries: [
      { id: 'viagens-orcamentos', label: 'Orçamentos', module: 'viagens', tab: 'solicitacoes' },
      { id: 'viagens-pacotes', label: 'Pacotes', module: 'viagens', tab: 'pacotes' },
      { id: 'viagens-propostas', label: 'Propostas', module: 'viagens', tab: 'propostas' },
      { id: 'viagens-transacoes', label: 'Reservas e Transações', module: 'viagens', tab: 'transacoes' },
    ] }],
  },
  {
    id: 'gsa-saude',
    label: 'GSA Saúde',
    icon: HeartPulse,
    sections: [{ entries: [
      { id: 'saude-dashboard', label: 'Visão Geral', module: 'saude', tab: 'dashboard' },
      { id: 'saude-parceiros', label: 'Parceiros', module: 'saude', tab: 'parceiros' },
      { id: 'saude-produtos', label: 'Catálogo', module: 'saude', tab: 'produtos' },
      { id: 'saude-cotacoes', label: 'Cotações', module: 'saude', tab: 'cotacoes' },
      { id: 'saude-propostas', label: 'Propostas', module: 'saude', tab: 'propostas' },
      { id: 'saude-contratos', label: 'Contratações', module: 'saude', tab: 'contratos' },
      { id: 'saude-assessorias', label: 'Assessorias', module: 'saude', tab: 'assessorias' },
      { id: 'saude-comissoes', label: 'Comissões', module: 'saude', tab: 'comissoes' },
      { id: 'saude-documentos', label: 'Documentos', module: 'saude', tab: 'documentos' },
      { id: 'saude-atendimentos', label: 'Atendimentos', module: 'saude', tab: 'atendimentos' },
    ] }],
  },
  {
    id: 'gsa-seguros',
    label: 'GSA Seguros',
    icon: ShieldCheck,
    sections: [{ entries: [
      { id: 'seguros-dashboard', label: 'Visão Geral', module: 'seguros', tab: 'dashboard' },
      { id: 'seguros-parceiros', label: 'Parceiros', module: 'seguros', tab: 'parceiros' },
      { id: 'seguros-produtos', label: 'Catálogo', module: 'seguros', tab: 'produtos' },
      { id: 'seguros-cotacoes', label: 'Cotações', module: 'seguros', tab: 'cotacoes' },
      { id: 'seguros-propostas', label: 'Propostas', module: 'seguros', tab: 'propostas' },
      { id: 'seguros-contratos', label: 'Apólices', module: 'seguros', tab: 'contratos' },
      { id: 'seguros-assessorias', label: 'Assessorias', module: 'seguros', tab: 'assessorias' },
      { id: 'seguros-comissoes', label: 'Comissões', module: 'seguros', tab: 'comissoes' },
      { id: 'seguros-assistencias', label: 'Assistências', module: 'seguros', tab: 'assistencias' },
      { id: 'seguros-sinistros', label: 'Sinistros', module: 'seguros', tab: 'sinistros' },
      { id: 'seguros-documentos', label: 'Documentos', module: 'seguros', tab: 'documentos' },
      { id: 'seguros-atendimentos', label: 'Atendimentos', module: 'seguros', tab: 'atendimentos' },
    ] }],
  },
  {
    id: 'financeiro',
    label: 'Financeiro',
    icon: Landmark,
    sections: [{ entries: [
      { id: 'financeiro-geral', label: 'Central Financeira', module: 'financeiro', badgeKeys: ['moduleFinanceiro'] },
      { id: 'cobranca', label: 'Cobrança', module: 'cobranca', badgeKeys: ['moduleCobranca'] },
      { id: 'fiscal', label: 'Fiscal', module: 'fiscal', badgeKeys: ['moduleFiscal'] },
      { id: 'emprestimos', label: 'Empréstimos', module: 'emprestimos', badgeKeys: ['vendas_emprestimos_pendentes'] },
    ] }],
  },
  {
    id: 'fidelidade-relacionamento',
    label: 'Fidelidade e Relacionamento',
    icon: Gift,
    sections: [{ entries: [
      {
        id: 'fidelidade',
        label: 'Fidelidade',
        module: 'fidelidade',
        badgeKeys: ['cadastro_vouchers_pendentes', 'cadastro_premios_pendentes'],
      },
      { id: 'area-vip', label: 'Área VIP', module: 'area_vip' },
      { id: 'atendimento', label: 'Atendimento', module: 'atendimento', badgeKeys: ['moduleSuporte'] },
    ] }],
  },
  {
    id: 'relatorios-inteligencia',
    label: 'Relatórios e Inteligência',
    icon: BarChart3,
    sections: [{ entries: [
      { id: 'relatorios', label: 'Central de Relatórios', module: 'relatorios' },
    ] }],
  },
  {
    id: 'administracao-sistema',
    label: 'Administração do Sistema',
    icon: Settings,
    sections: [{ entries: [
      { id: 'configuracoes', label: 'Configurações Gerais', module: 'configuracoes' },
      { id: 'acessos', label: 'Gestão de Acessos', module: 'acessos', adminOnly: true, badgeKeys: ['moduleAcessos'] },
      { id: 'sistema', label: 'Saúde do Sistema', module: 'sistema' },
    ] }],
  },
];

export const ADMIN_PERMISSION_GROUPS = [
  { label: 'Visão Geral', options: [
    ['demandas', 'Demandas internas'],
  ] },
  { label: 'Cadastros e Rede', options: [
    ['cadastro', 'Cadastros (clientes e prestadores)'],
    ['prestadores', 'Prestadores (sem acesso a clientes)'],
  ] },
  { label: 'Loja GSA', options: [
    ['loja', 'Catálogo e Loja GSA'],
    ['operacoes', 'Vendas e operações'],
    ['fornecedores', 'Fornecedores e suprimentos'],
    ['promocoes', 'Promoções por quantidade'],
    ['credito_loja', 'Crédito da Loja'],
  ] },
  { label: 'Negócios GSA', options: [
    ['classificados', 'Classificados GSA'],
    ['viagens', 'GSA Viagens'],
    ['saude', 'GSA Saúde'],
    ['seguros', 'GSA Seguros'],
  ] },
  { label: 'Financeiro', options: [
    ['financeiro', 'Central Financeira'],
    ['cobranca', 'Cobrança'],
    ['fiscal', 'Fiscal'],
    ['emprestimos', 'Empréstimos'],
  ] },
  { label: 'Relacionamento', options: [
    ['trabalhe-conosco', 'Trabalhe Conosco'],
    ['fidelidade', 'Fidelidade'],
    ['area_vip', 'Área VIP'],
    ['atendimento', 'Atendimento'],
  ] },
  { label: 'Gestão', options: [
    ['relatorios', 'Relatórios'],
    ['configuracoes', 'Configurações'],
    ['sistema', 'Saúde do Sistema'],
  ] },
] as const satisfies ReadonlyArray<{
  label: string;
  options: ReadonlyArray<readonly [Exclude<AdminModule, 'dashboard' | 'acessos' | 'catalogo' | 'parceiros' | 'anuncios' | 'careers'>, string]>;
}>;

export function flattenAdminNavigation(groups: AdminNavigationGroup[] = ADMIN_NAVIGATION_GROUPS) {
  return groups.flatMap((group) => group.sections.flatMap((section) => section.entries.map((entry) => ({ group, section, entry }))));
}
