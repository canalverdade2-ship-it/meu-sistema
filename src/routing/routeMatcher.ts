import type { RouteState } from './types';
import { matchRoute as legacyMatchRoute, parseQueryString } from './routeMatcherLegacy';

export { parseQueryString };

export const PUBLIC_ROUTE_CONTRACTS = ['empresa-do-zero-ao-digital'] as const;

export function matchRoute(pathname: string, search: string, hash: string): RouteState {
  const normalizedPath = pathname.replace(/\/+$/, '') || '/';
  const segments = normalizedPath.split('/').filter(Boolean);

  if (segments[0] === 'empresa') {
    return {
      pathname,
      search,
      hash,
      area: 'client',
      module: segments[1] || 'dashboard',
      submodule: segments[2],
      itemId: segments[3],
      query: parseQueryString(search),
    };
  }

  return legacyMatchRoute(pathname, search, hash);
}
