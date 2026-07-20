export type AdminActorType = 'admin' | 'colaborador';

export type AdminModule =
  | 'dashboard'
  | 'cadastro'
  | 'catalogo'
  | 'operacoes'
  | 'loja'
  | 'classificados'
  | 'viagens'
  | 'saude'
  | 'seguros'
  | 'fidelidade'
  | 'atendimento'
  | 'vendas'
  | 'financeiro'
  | 'cobranca'
  | 'fiscal'
  | 'tickets'
  | 'relatorios'
  | 'configuracoes'
  | 'area_vip'
  | 'prestadores'
  | 'acessos'
  | 'demandas'
  | 'sistema'
  | 'promocoes';

const MODULE_ACCESS_ALIASES: Record<string, string[]> = {
  dashboard: [],
  cadastro: ['cadastro', 'prestadores', 'clientes'],
  catalogo: ['catalogo', 'cadastro'],
  operacoes: ['operacoes', 'vendas', 'demandas'],
  loja: ['loja', 'cadastro', 'vendas'],
  classificados: ['classificados', 'loja', 'vendas'],
  viagens: ['viagens', 'loja', 'vendas'],
  saude: ['saude', 'loja', 'vendas'],
  seguros: ['seguros', 'loja', 'vendas'],
  fidelidade: ['fidelidade', 'cadastro', 'area_vip', 'promocoes'],
  atendimento: ['atendimento', 'tickets', 'suporte'],
  vendas: ['vendas', 'operacoes'],
  financeiro: ['financeiro', 'cobranca', 'fiscal', 'emprestimos', 'credito_loja'],
  cobranca: ['cobranca', 'financeiro'],
  fiscal: ['fiscal', 'financeiro'],
  tickets: ['tickets', 'atendimento'],
  relatorios: ['relatorios'],
  configuracoes: ['configuracoes'],
  area_vip: ['area_vip', 'fidelidade'],
  prestadores: ['prestadores', 'cadastro'],
  acessos: ['acessos'],
  demandas: ['demandas', 'operacoes'],
  sistema: ['sistema'],
  promocoes: ['promocoes', 'fidelidade', 'vendas'],
};

export function normalizeAdminModule(module?: string | null): AdminModule {
  const value = module || 'dashboard';
  if (value === 'suporte' || value === 'tickets') return 'atendimento';
  if (value === 'cobranca' || value === 'fiscal') return 'financeiro';
  if (['orcamentos', 'servicos', 'produtos', 'assinaturas', 'os'].includes(value)) return 'operacoes';
  if (value === 'prestadores' || value === 'clientes' || value === 'cadastros') return 'cadastro';
  if (value === 'emprestimos' || value === 'credito_loja') return 'financeiro';
  if (['vouchers', 'premios', 'promocoes', 'indique-ganhe', 'area_vip'].includes(value)) return 'fidelidade';
  return value as AdminModule;
}

export function canAccessAdminModule(
  actorType: AdminActorType,
  modules: string[] | null | undefined,
  requestedModule?: string | null,
): boolean {
  if (actorType === 'admin') return true;
  const normalized = normalizeAdminModule(requestedModule);
  if (normalized === 'dashboard' || normalized === 'demandas') return true;
  const granted = new Set((modules || []).map((item) => String(item).trim()).filter(Boolean));
  const aliases = MODULE_ACCESS_ALIASES[normalized] || [normalized];
  return aliases.some((alias) => granted.has(alias));
}

export function adminModulePath(module: string, tab?: string, itemId?: string): string {
  const normalized = normalizeAdminModule(module);
  const suffix = [tab, itemId].filter(Boolean).map(encodeURIComponent).join('/');
  const baseByModule: Record<string, string> = {
    dashboard: '/admin/dashboard',
    cadastro: '/admin/cadastros',
    catalogo: '/admin/catalogo',
    operacoes: '/admin/operacoes',
    loja: '/admin/loja',
    classificados: '/admin/classificados',
    viagens: '/admin/viagens',
    saude: '/admin/saude',
    seguros: '/admin/seguros',
    fidelidade: '/admin/fidelidade',
    atendimento: '/admin/atendimento',
    vendas: '/admin/operacoes',
    financeiro: '/admin/financeiro',
    relatorios: '/admin/relatorios',
    configuracoes: '/admin/configuracoes',
    acessos: '/admin/acessos',
    demandas: '/admin/demandas',
    sistema: '/admin/sistema',
    promocoes: '/admin/fidelidade/promocoes',
  };
  const base = baseByModule[normalized] || '/admin/dashboard';
  return suffix ? `${base}/${suffix}` : base;
}
