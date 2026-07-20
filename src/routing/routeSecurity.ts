import { AppArea } from './types';
import { hasAdminModuleAccess } from '../security/collaboratorAccess';

interface SessionState {
  clientId?: string;
  adminAuth?: boolean;
  adminType?: 'admin' | 'colaborador';
  colaboradorModulos?: string[];
  prestadorId?: string;
}

export function isRouteAllowed(
  area: AppArea,
  session: SessionState,
  module?: string,
  submodule?: string,
): boolean {
  if (area === 'client') return Boolean(session.clientId);
  if (area === 'provider') return Boolean(session.prestadorId);
  if (area === 'admin') {
    if (!session.adminAuth) return false;
    return hasAdminModuleAccess(module, session.adminType || 'admin', session.colaboradorModulos || [], submodule);
  }
  return true;
}
