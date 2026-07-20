export type AdminActorType = 'admin' | 'colaborador';

const MODULE_ALIASES: Record<string, string[]> = {
  dashboard: [],
  cadastro: ['cadastro'],
  prestadores: ['prestadores', 'cadastro'],
  catalogo: ['catalogo', 'cadastro'],
  operacoes: ['operacoes', 'vendas'],
  vendas: ['vendas'],
  demandas: ['demandas'],
  loja: ['loja', 'vendas'],
  classificados: ['classificados', 'loja', 'vendas'],
  viagens: ['viagens', 'loja', 'vendas'],
  saude: ['saude', 'loja', 'vendas'],
  seguros: ['seguros', 'loja', 'vendas'],
  financeiro: ['financeiro'],
  cobranca: ['cobranca'],
  fiscal: ['fiscal'],
  fidelidade: ['fidelidade', 'cadastro', 'area_vip', 'promocoes'],
  atendimento: ['atendimento', 'tickets', 'suporte'],
  relatorios: ['relatorios'],
  configuracoes: ['configuracoes'],
  acessos: ['acessos'],
  sistema: ['sistema'],
  promocoes: ['promocoes', 'area_vip', 'vendas'],
  area_vip: ['area_vip'],
};

export function normalizeAdminModule(module?: string): string {
  const value = module || 'dashboard';
  if (value === 'tickets' || value === 'suporte') return 'atendimento';
  if (['vendas', 'orcamentos', 'servicos', 'produtos', 'assinaturas'].includes(value)) return 'operacoes';
  if (value === 'clientes') return 'cadastro';
  if (value === 'prestadores') return 'prestadores';
  if (value === 'emprestimos' || value === 'credito_loja') return 'financeiro';
  if (['vouchers', 'premios', 'indique-ganhe'].includes(value)) return 'fidelidade';
  return value;
}

export function canAccessAdminModule(
  actorType: AdminActorType | undefined,
  modules: string[] = [],
  module?: string,
  submodule?: string,
): boolean {
  if (actorType === 'admin') return true;
  if (actorType !== 'colaborador') return false;

  const normalized = normalizeAdminModule(module);
  if (normalized === 'dashboard') return true;

  const granted = new Set(modules.filter(Boolean));
  if (normalized === 'cadastro' && submodule === 'prestadores') {
    return granted.has('cadastro') || granted.has('prestadores');
  }
  if (normalized === 'prestadores') {
    return granted.has('prestadores') || granted.has('cadastro');
  }

  const aliases = MODULE_ALIASES[normalized] || [normalized];
  return aliases.some((alias) => granted.has(alias));
}

export function adminModulePath(module: string, tab?: string, itemId?: string): string {
  const original = module;
  const normalized = normalizeAdminModule(module);
  const parts = (...values: Array<string | undefined>) =>
    `/${values.filter(Boolean).map((value) => encodeURIComponent(value as string)).join('/')}`;

  if (original === 'clientes') return parts('admin', 'cadastros', 'clientes', itemId);
  if (original === 'prestadores') return parts('admin', 'cadastros', 'prestadores', itemId);
  if (original === 'orcamentos') return parts('admin', 'operacoes', 'orcamentos', itemId);
  if (original === 'emprestimos') return parts('admin', 'financeiro', 'emprestimos', itemId);
  if (original === 'credito_loja') return parts('admin', 'financeiro', 'credito', itemId);

  switch (normalized) {
    case 'dashboard': return '/admin/dashboard';
    case 'cadastro': return parts('admin', 'cadastros', tab || 'clientes', itemId);
    case 'prestadores': return parts('admin', 'cadastros', 'prestadores', itemId);
    case 'catalogo': return parts('admin', 'catalogo', tab || 'produtos', itemId);
    case 'operacoes': return parts('admin', 'operacoes', tab || 'orcamentos', itemId);
    case 'demandas': return parts('admin', 'demandas', tab, itemId);
    case 'loja': return parts('admin', 'loja', tab, itemId);
    case 'classificados': return parts('admin', 'classificados', tab, itemId);
    case 'viagens': return parts('admin', 'viagens', tab, itemId);
    case 'saude': return parts('admin', 'saude', tab, itemId);
    case 'seguros': return parts('admin', 'seguros', tab, itemId);
    case 'financeiro': return parts('admin', 'financeiro', tab, itemId);
    case 'cobranca': return parts('admin', 'cobranca', tab, itemId);
    case 'fiscal': return parts('admin', 'fiscal', tab, itemId);
    case 'fidelidade': return parts('admin', 'fidelidade', tab, itemId);
    case 'atendimento': return parts('admin', 'atendimento', tab, itemId);
    case 'relatorios': return '/admin/relatorios';
    case 'configuracoes': return '/admin/configuracoes';
    case 'acessos': return '/admin/acessos';
    case 'sistema': return '/admin/sistema';
    case 'promocoes': return parts('admin', 'promocoes', tab, itemId);
    case 'area_vip': return parts('admin', 'area_vip', tab, itemId);
    default: return '/admin/dashboard';
  }
}
