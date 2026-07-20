import { useEffect, useRef } from 'react';
import { supabase } from '../lib/supabase';

// 10 minutos em milissegundos.
const TIMEOUT_MS = 10 * 60 * 1000;

export function useAutoLogout(
  onLogout: () => void | Promise<void>,
  isSessionActive: boolean,
) {
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const performLogout = () => {
    Promise.resolve(onLogout()).catch((error) => {
      console.error('Falha ao encerrar sessão por inatividade:', error);
    });
  };

  const resetTimer = () => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }

    timeoutRef.current = setTimeout(performLogout, TIMEOUT_MS);

    // Atualiza a validade da sessão no máximo uma vez por minuto.
    const lastPing = localStorage.getItem('lastPing');
    const now = Date.now();
    if (!lastPing || now - Number.parseInt(lastPing, 10) > 60_000) {
      localStorage.setItem('lastPing', now.toString());
      void import('../lib/sessionService').then(({ sessionService }) => sessionService.pingSession());
    }
  };

  useEffect(() => {
    if (!isSessionActive) {
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
      return;
    }

    const events = ['mousedown', 'mousemove', 'keydown', 'scroll', 'touchstart'];
    let throttleTimeout: ReturnType<typeof setTimeout> | null = null;

    const handleActivity = () => {
      if (!throttleTimeout) {
        throttleTimeout = setTimeout(() => {
          resetTimer();
          throttleTimeout = null;
        }, 1000);
      }
    };

    resetTimer();
    events.forEach((event) => window.addEventListener(event, handleActivity));

    // Mantém apenas a detecção remota. O encerramento completo é executado uma vez
    // pelo callback central do App, evitando duas chamadas concorrentes a gsa_end_session.
    const sessaoId = localStorage.getItem('sessaoId');
    let channel: ReturnType<typeof supabase.channel> | null = null;

    if (sessaoId) {
      channel = supabase
        .channel(`sessao-check-${sessaoId}`)
        .on(
          'postgres_changes',
          {
            event: 'UPDATE',
            schema: 'public',
            table: 'sistema_sessoes',
            filter: `id=eq.${sessaoId}`,
          },
          (payload) => {
            if (payload.new && payload.new.status === 'encerrado') {
              performLogout();
            }
          },
        )
        .subscribe();
    }

    return () => {
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
      if (throttleTimeout) clearTimeout(throttleTimeout);
      events.forEach((event) => window.removeEventListener(event, handleActivity));
      if (channel) supabase.removeChannel(channel);
    };
  }, [isSessionActive, onLogout]);
}
