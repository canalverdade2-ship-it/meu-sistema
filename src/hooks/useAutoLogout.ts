import { useEffect, useRef } from 'react';
import { sessionService } from '../lib/sessionService';
import { supabase } from '../lib/supabase';

// 10 minutes in milliseconds
const TIMEOUT_MS = 10 * 60 * 1000;

export function useAutoLogout(onLogout: () => void, isSessionActive: boolean) {
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);

  const performLogout = () => {
    onLogout();
  };

  const resetTimer = () => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }
    
    // Set local timeout to kick user out
    timeoutRef.current = setTimeout(performLogout, TIMEOUT_MS);
    
    // Periodically update database (debounce 1 minute so we dont hammer the DB)
    const lastPing = localStorage.getItem('lastPing');
    const now = Date.now();
    if (!lastPing || (now - parseInt(lastPing)) > 60000) {
      localStorage.setItem('lastPing', now.toString());
      sessionService.pingSession();
    }
  };

  useEffect(() => {
    if (!isSessionActive) {
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
      return;
    }

    const events = ['mousedown', 'mousemove', 'keydown', 'scroll', 'touchstart'];
    
    let throttleTimeout: NodeJS.Timeout | null = null;
    const handleActivity = () => {
      if (!throttleTimeout) {
        throttleTimeout = setTimeout(() => {
          resetTimer();
          throttleTimeout = null;
        }, 1000);
      }
    };

    // Initial setup
    resetTimer();
    const handleRemoteRevocation = () => performLogout();
    window.addEventListener('gsa-session-revoked', handleRemoteRevocation);

    // Add listeners
    events.forEach(event => {
      window.addEventListener(event, handleActivity);
    });

    // Realtime subscription to enforce single-session remotely
    const sessaoId = localStorage.getItem('sessaoId');
    let channel: ReturnType<typeof supabase.channel> | null = null;

    if (sessaoId) {
      channel = supabase.channel(`sessao-check-${sessaoId}`)
        .on('postgres_changes', {
          event: 'UPDATE',
          schema: 'public',
          table: 'sistema_sessoes',
          filter: `id=eq.${sessaoId}`
        }, (payload) => {
          if (payload.new && payload.new.status === 'encerrado') {
            // Se foi encerrado remotamente (por outro login), forçar logout
            performLogout();
          }
        })
        .subscribe();
    }

    return () => {
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
      if (throttleTimeout) clearTimeout(throttleTimeout);
      events.forEach(event => {
        window.removeEventListener(event, handleActivity);
      });
      window.removeEventListener('gsa-session-revoked', handleRemoteRevocation);
      if (channel) {
        supabase.removeChannel(channel);
      }
    };
  }, [isSessionActive, onLogout]);
}
