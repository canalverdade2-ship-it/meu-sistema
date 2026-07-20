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
  | 'financeiro'
  | 'cobranca'
  | 'fiscal'
  | 'emprestimos'
  | 'credito_loja'
  | 'relatorios'
  | 'configuracoes'
  | 'acessos'
  | 'demandas'
  | 'sistema'
  | 'promocoes';

const VALID_MODULES = new Set<AdminModule>([
  'dashboard',
  'cadastro',
  'catalogo',
  'operacoes',
  'loja',
  'classificados',
  'viagens',
  'saude',
  'seguros',
  'fidelidade',
  'atendimento',
  'financeiro',
  'cobranca',
  'fiscal',
  'emprestimos',
  'credito_loja',
  'relatorios',
  'configuracoes',
  'acessos',
  'demandas',
  'sistema',
  'promocoes',
]);

/**
 * Normaliza somente nomes legados que pertencem ao mesmo domínio funcional.
 * Não existe mais herança entre vendas, loja, classificados, viagens, saúde ou
 * seguros; cada ramo precisa ser concedido explicitamente.
 */
export function normalizeAdminModule(module?: string | null): AdminModule {
  const value = String(module || 'dashboard').trim().toLowerCase();

  if (value === 'suporte' || value === 'tickets') return 'atendimento';
  if (value === 'cadastros' || value === 'clientes' || value === 'prestadores') return 'cadastro';
  if (['orcamentos', 'servicos', 'produtos', 'assinaturas', 'os', 'vendas'].includes(value)) return 'operacoes';
  if (value === 'area_vip') return 'fidelidade';
  if (value === 'promocoes' || value === 'vouchers' || value === 'premios' || value === 'indique-ganhe') return 'promocoes';

  return VALID_MODULES.has(value as AdminModule) ? value as AdminModule : 'dashboard';
}

function normalizeGrantedModule(module: string): AdminModule | null {
  const value = String(module || '').trim().toLowerCase();
  if (!value) return null;

  if (value === 'clientes' || value === 'prestadores' || value === 'cadastros') return 'cadastro';
  if (value === 'vendas') return 'operacoes';
  if (value === 'tickets' || value === 'suporte') return 'atendimento';
  if (value === 'area_vip') return 'fidelidade';
  if (value === 'promocoes' || value === 'vouchers' || value === 'premios') return 'promocoes';

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
  actorType: AdminActorType,
  modules: string[] | null | undefined,
  requestedModule?: string | null,
): boolean {
  if (actorType === 'admin') return true;

  const normalized = normalizeAdminModule(requestedModule);
  if (normalized === 'dashboard') return true;

  const granted = new Set(normalizeGrantedAdminModules(modules));
  return granted.has(normalized);
}

export function adminModulePath(module: string, tab?: string, itemId?: string): string {
  const normalized = normalizeAdminModule(module);
  const suffix = [tab, itemId].filter(Boolean).map((value) => encodeURIComponent(String(value))).join('/');
  const baseByModule: Record<AdminModule, string> = {
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
    financeiro: '/admin/financeiro',
    cobranca: '/admin/cobranca',
    fiscal: '/admin/fiscal',
    emprestimos: '/admin/financeiro/emprestimos',
    credito_loja: '/admin/financeiro/credito',
    relatorios: '/admin/relatorios',
    configuracoes: '/admin/configuracoes',
    acessos: '/admin/acessos',
    demandas: '/admin/demandas',
    sistema: '/admin/sistema',
    promocoes: '/admin/fidelidade/promocoes',
  };
  const base = baseByModule[normalized];
  return suffix ? `${base}/${suffix}` : base;
}
