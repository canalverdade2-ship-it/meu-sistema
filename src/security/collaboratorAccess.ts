import {
  adminModulePath,
  canAccessAdminModule,
  normalizeAdminModule as normalizeSharedAdminModule,
  type AdminActorType,
} from '../routing/adminAccess';

export type AdminType = AdminActorType;

export function normalizeCollaboratorModules(modules: unknown): string[] {
  if (!Array.isArray(modules)) return [];
  return [...new Set(modules.filter((module): module is string => typeof module === 'string' && module.trim().length > 0))];
}

export function normalizeAdminModule(module?: string): string {
  return normalizeSharedAdminModule(module);
}

export function hasAdminModuleAccess(
  module: string | undefined,
  adminType: AdminType | undefined,
  modules: string[],
  submodule?: string,
): boolean {
  return canAccessAdminModule(adminType, normalizeCollaboratorModules(modules), module, submodule);
}

export function adminPathFor(module: string, tab?: string, itemId?: string): string {
  return adminModulePath(module, tab, itemId);
}

export function defaultAdminPath(adminType: AdminType | undefined, modules: string[]): string {
  if (adminType === 'admin') return '/admin/dashboard';
  const normalized = normalizeCollaboratorModules(modules);
  if (normalized.length === 0) return '/admin/dashboard';

  const priority = [
    'demandas',
    'cadastro',
    'prestadores',
    'parceiros',
    'anuncios',
    'operacoes',
    'financeiro',
    'cobranca',
    'fiscal',
    'atendimento',
    'catalogo',
    'loja',
    'classificados',
    'viagens',
    'saude',
    'seguros',
    'fidelidade',
    'emprestimos',
    'credito_loja',
    'promocoes',
    'area_vip',
    'relatorios',
    'configuracoes',
    'acessos',
    'sistema',
  ];
  const first = priority.find((module) => hasAdminModuleAccess(module, adminType, normalized));
  return first ? adminModulePath(first) : '/admin/dashboard';
}
