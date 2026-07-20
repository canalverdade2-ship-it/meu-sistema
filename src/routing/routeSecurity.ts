import { AppArea } from './types';

interface SessionState {
  clientId?: string;
  adminAuth?: boolean;
  prestadorId?: string;
}

export function isRouteAllowed(area: AppArea, session: SessionState): boolean {
  if (area === 'client' && !session.clientId) {
    return false;
  }
  if (area === 'admin' && !session.adminAuth) {
    return false;
  }
  if (area === 'provider' && !session.prestadorId) {
    return false;
  }
  return true;
}
