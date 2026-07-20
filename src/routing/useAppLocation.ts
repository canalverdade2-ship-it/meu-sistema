import { useState, useEffect } from 'react';
import { RouteState } from './types';
import { matchRoute } from './routeMatcher';
import { navigationService } from './navigationService';

export function useAppLocation(): RouteState {
  const [currentLoc, setCurrentLoc] = useState(() => {
    if (typeof window !== 'undefined') {
      return {
        pathname: window.location.pathname,
        search: window.location.search,
        hash: window.location.hash
      };
    }
    return { pathname: '/', search: '', hash: '' };
  });

  useEffect(() => {
    const handleRoute = (loc: { pathname: string; search: string; hash: string }) => {
      setCurrentLoc(loc);
    };

    const unsubscribe = navigationService.subscribe(handleRoute);
    return () => {
      unsubscribe();
    };
  }, []);

  return matchRoute(currentLoc.pathname, currentLoc.search, currentLoc.hash);
}
export default useAppLocation;
