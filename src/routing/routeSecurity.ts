import { AppArea } from './types';
import { hasAdminModuleAccess } from '../security/collaboratorAccess';

interface SessionState {
  clientId?: string;
  adminAuth?: boolean;
  adminType?: 'admin' | 'colaborador';
  colaboradorModulos?: string[];
  prestadorId?: string;
  fornecedorId?: string;
}

export function isRouteAllowed(
  area: AppArea,
  session: SessionState,
  module?: string,
  submodule?: string,
): boolean {
  if (area === 'client') return Boolean(session.clientId);
  if (area === 'provider') return Boolean(session.prestadorId);
  if (area === 'supplier') return module === 'access' || Boolean(session.fornecedorId);
  // O portal do anunciante valida o Supabase Auth e o vínculo da empresa no próprio módulo.
  if (area === 'advertiser') return true;
  if (area === 'admin') {
    if (!session.adminAuth) return false;
    return hasAdminModuleAccess(module, session.adminType || 'admin', session.colaboradorModulos || [], submodule);
  }
  return true;
}
