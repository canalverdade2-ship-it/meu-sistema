import { AppArea } from './types';
import { hasAdminModuleAccess } from '../security/collaboratorAccess';

interface SessionState {
  clientId?: string;
  clientPersonType?: 'pf' | 'pj';
  adminAuth?: boolean;
  adminType?: 'admin' | 'colaborador';
  colaboradorModulos?: string[];
  prestadorId?: string;
  fornecedorId?: string;
}

function isAffiliatePublicAccessRoute() {
  if (typeof window === 'undefined') return false;
  const path = window.location.pathname.replace(/\/+$/, '') || '/';
  return ['/afiliados', '/afiliados/login', '/afiliados/acesso', '/afiliados/cadastro'].includes(path);
}

export function isRouteAllowed(
  area: AppArea,
  session: SessionState,
  module?: string,
  submodule?: string,
): boolean {
  if (area === 'client') return Boolean(session.clientId) && session.clientPersonType !== 'pj';
  if (area === 'business') return Boolean(session.clientId) && session.clientPersonType === 'pj';
  if (area === 'provider') return module === 'home' || Boolean(session.prestadorId);
  if (area === 'supplier') return ['home', 'login', 'access'].includes(module || '') || Boolean(session.fornecedorId);
  if (area === 'public' && module === 'affiliates') {
    return isAffiliatePublicAccessRoute() || Boolean(session.clientId);
  }
  // O portal do anunciante valida o Supabase Auth e o vínculo da empresa no próprio módulo.
  // Requer autenticação mínima: cliente logado ou admin (não permite acesso completamente anônimo).
  if (area === 'advertiser') return Boolean(session.clientId) || Boolean(session.adminAuth);
  if (area === 'admin') {
    if (!session.adminAuth) return false;
    return hasAdminModuleAccess(module, session.adminType || 'admin', session.colaboradorModulos || [], submodule);
  }
  return true;
}
