export type AdminActorType = 'admin' | 'colaborador';

const MODULE_ALIASES: Record<string, string[]> = {
  dashboard: [],
  cadastro: ['cadastro', 'prestadores'],
  catalogo: ['cadastro'],
  operacoes: ['vendas'],
  vendas: ['vendas'],
  loja: ['vendas'],
  classificados: ['vendas'],
  viagens: ['vendas'],
  saude: ['vendas'],
  seguros: ['vendas'],
  demandas: ['demandas'],
  financeiro: ['financeiro'],
  cobranca: ['cobranca'],
  fiscal: ['fiscal'],
  fidelidade: ['cadastro', 'area_vip', 'promocoes'],
  area_vip: ['area_vip'],
  promocoes: ['promocoes', 'area_vip', 'vendas'],
  atendimento: ['tickets'],
  tickets: ['tickets'],
  relatorios: ['relatorios'],
  configuracoes: ['configuracoes'],
  acessos: ['acessos'],
  sistema: ['sistema'],
};

export function normalizeCollaboratorModules(modules: unknown): string[] {
  if (!Array.isArray(modules)) return [];
  return [...new Set(modules.filter((value): value is string => typeof value === 'string' && value.trim().length > 0))].sort();
}

export function hasAdminModuleAccess(
  module: string | undefined,
  adminType: AdminActorType | undefined,
  collaboratorModules: string[] = [],
  submodule?: string,
): boolean {
  if (adminType === 'admin') return true;
  if (adminType !== 'colaborador') return false;

  const modules = normalizeCollaboratorModules(collaboratorModules);
  const normalized = normalizeAdminModule(module || 'dashboard');

  if (normalized === 'dashboard') return true;

  if (normalized === 'cadastro' && submodule === 'prestadores') {
    return modules.includes('cadastro') || modules.includes('prestadores');
  }

  const required = MODULE_ALIASES[normalized] || [normalized];
  return required.some((permission) => modules.includes(permission));
}

export function normalizeAdminModule(module: string): string {
  if (module === 'suporte' || module === 'tickets') return 'atendimento';
  if (module === 'vendas' || module === 'orcamentos' || module === 'servicos' || module === 'produtos' || module === 'assinaturas') return 'operacoes';
  if (module === 'prestadores' || module === 'clientes') return 'cadastro';
  if (module === 'emprestimos' || module === 'credito_loja') return 'financeiro';
  if (module === 'vouchers' || module === 'premios' || module === 'indique-ganhe') return 'fidelidade';
  return module;
}

export function defaultAdminPath(adminType: AdminActorType | undefined, modules: string[] = []): string {
  if (adminType === 'admin') return '/admin/dashboard';
  const normalized = normalizeCollaboratorModules(modules);
  const ordered: Array<[string, string]> = [
    ['demandas', '/admin/demandas'],
    ['cadastro', '/admin/cadastros/clientes'],
    ['prestadores', '/admin/cadastros/prestadores'],
    ['vendas', '/admin/operacoes/orcamentos'],
    ['financeiro', '/admin/financeiro'],
    ['cobranca', '/admin/cobranca'],
    ['fiscal', '/admin/fiscal'],
    ['tickets', '/admin/atendimento'],
    ['relatorios', '/admin/relatorios'],
    ['configuracoes', '/admin/configuracoes'],
    ['acessos', '/admin/acessos'],
    ['sistema', '/admin/sistema'],
  ];
  return ordered.find(([permission]) => normalized.includes(permission))?.[1] || '/admin/dashboard';
}

export function adminPathFor(module: string, tab?: string, itemId?: string): string {
  const original = module;
  const normalized = normalizeAdminModule(module);
  const suffix = (parts: Array<string | undefined>) => parts.filter(Boolean).map(encodeURIComponent).join('/');

  if (original === 'cobranca') return `/${suffix(['admin', 'cobranca', tab, itemId])}`;
  if (original === 'fiscal') return `/${suffix(['admin', 'fiscal', tab, itemId])}`;
  if (original === 'prestadores') return `/${suffix(['admin', 'cadastros', 'prestadores', itemId])}`;
  if (original === 'clientes') return `/${suffix(['admin', 'cadastros', 'clientes', itemId])}`;
  if (original === 'emprestimos') return `/${suffix(['admin', 'financeiro', 'emprestimos', itemId])}`;
  if (original === 'credito_loja') return `/${suffix(['admin', 'financeiro', 'credito', itemId])}`;
  if (original === 'orcamentos') return `/${suffix(['admin', 'operacoes', 'orcamentos', itemId])}`;

  switch (normalized) {
    case 'dashboard': return '/admin/dashboard';
    case 'cadastro': return `/${suffix(['admin', 'cadastros', tab || 'clientes', itemId])}`;
    case 'catalogo': return `/${suffix(['admin', 'catalogo', tab || 'produtos', itemId])}`;
    case 'operacoes': return `/${suffix(['admin', 'operacoes', tab || 'orcamentos', itemId])}`;
    case 'demandas': return `/${suffix(['admin', 'demandas', tab, itemId])}`;
    case 'loja': return `/${suffix(['admin', 'loja', tab, itemId])}`;
    case 'classificados': return `/${suffix(['admin', 'classificados', tab, itemId])}`;
    case 'viagens': return `/${suffix(['admin', 'viagens', tab, itemId])}`;
    case 'saude': return `/${suffix(['admin', 'saude', tab, itemId])}`;
    case 'seguros': return `/${suffix(['admin', 'seguros', tab, itemId])}`;
    case 'financeiro': return `/${suffix(['admin', 'financeiro', tab, itemId])}`;
    case 'fidelidade': return `/${suffix(['admin', 'fidelidade', tab, itemId])}`;
    case 'atendimento': return `/${suffix(['admin', 'atendimento', tab, itemId])}`;
    case 'relatorios': return '/admin/relatorios';
    case 'configuracoes': return '/admin/configuracoes';
    case 'acessos': return '/admin/acessos';
    case 'sistema': return '/admin/sistema';
    case 'promocoes': return `/${suffix(['admin', 'promocoes', tab, itemId])}`;
    case 'area_vip': return `/${suffix(['admin', 'area_vip', tab, itemId])}`;
    default: return '/admin/dashboard';
  }
}
