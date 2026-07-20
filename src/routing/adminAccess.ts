export type AdminActorType = 'admin' | 'colaborador';

export type AdminModule =
  | 'dashboard'
  | 'cadastro'
  | 'prestadores'
  | 'catalogo'
  | 'operacoes'
  | 'demandas'
  | 'loja'
  | 'classificados'
  | 'viagens'
  | 'saude'
  | 'seguros'
  | 'financeiro'
  | 'cobranca'
  | 'fiscal'
  | 'emprestimos'
  | 'credito_loja'
  | 'fidelidade'
  | 'atendimento'
  | 'relatorios'
  | 'configuracoes'
  | 'acessos'
  | 'sistema'
  | 'promocoes'
  | 'area_vip';

const VALID_MODULES = new Set<AdminModule>([
  'dashboard',
  'cadastro',
  'prestadores',
  'catalogo',
  'operacoes',
  'demandas',
  'loja',
  'classificados',
  'viagens',
  'saude',
  'seguros',
  'financeiro',
  'cobranca',
  'fiscal',
  'emprestimos',
  'credito_loja',
  'fidelidade',
  'atendimento',
  'relatorios',
  'configuracoes',
  'acessos',
  'sistema',
  'promocoes',
  'area_vip',
]);

/**
 * Normaliza apenas nomes legados pertencentes ao mesmo domínio funcional.
 * Vendas, Loja, Classificados, Viagens, Saúde e Seguros exigem concessões
 * próprias e nunca herdam acesso uns dos outros.
 */
export function normalizeAdminModule(module?: string | null): AdminModule {
  const value = String(module || 'dashboard').trim().toLowerCase();

  if (value === 'tickets' || value === 'suporte') return 'atendimento';
  if (value === 'cadastros' || value === 'clientes') return 'cadastro';
  if (value === 'prestadores') return 'prestadores';
  if (['vendas', 'orcamentos', 'servicos', 'produtos', 'assinaturas', 'os'].includes(value)) return 'operacoes';
  if (['vouchers', 'premios', 'indique-ganhe'].includes(value)) return 'fidelidade';

  return VALID_MODULES.has(value as AdminModule) ? value as AdminModule : 'dashboard';
}

function normalizeGrantedModule(module: string): AdminModule | null {
  const value = String(module || '').trim().toLowerCase();
  if (!value) return null;

  if (value === 'clientes' || value === 'cadastros') return 'cadastro';
  if (value === 'prestadores') return 'prestadores';
  if (value === 'vendas') return 'operacoes';
  if (value === 'tickets' || value === 'suporte') return 'atendimento';
  if (['vouchers', 'premios', 'indique-ganhe'].includes(value)) return 'fidelidade';

  return VALID_MODULES.has(value as AdminModule) ? value as AdminModule : null;
}

export function normalizeGrantedAdminModules(modules: string[] | null | undefined): AdminModule[] {
  return Array.from(new Set(
    (modules || [])
      .map(normalizeGrantedModule)
      .filter((module): module is AdminModule => Boolean(module)),
  ));
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

  const granted = new Set(normalizeGrantedAdminModules(modules));

  // Cadastro de prestadores pode ser concedido isoladamente sem abrir clientes.
  if (normalized === 'cadastro' && submodule === 'prestadores') {
    return granted.has('cadastro') || granted.has('prestadores');
  }
  if (normalized === 'prestadores') {
    return granted.has('prestadores') || granted.has('cadastro');
  }

  return granted.has(normalized);
}

export function adminModulePath(module: string, tab?: string, itemId?: string): string {
  const original = String(module || 'dashboard').trim().toLowerCase();
  const normalized = normalizeAdminModule(original);
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
    case 'emprestimos': return parts('admin', 'financeiro', 'emprestimos', itemId);
    case 'credito_loja': return parts('admin', 'financeiro', 'credito', itemId);
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
