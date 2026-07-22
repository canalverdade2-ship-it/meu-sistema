import { supabase } from './supabase';

const RETRY_DELAYS_MS = [3_000, 5_000, 10_000, 30_000, 60_000] as const;
const patchedChannels = new WeakSet<object>();
const manuallyClosedChannels = new WeakSet<object>();
const retryTimers = new WeakMap<object, ReturnType<typeof setTimeout>>();
let installed = false;

export function nextRealtimeRetryDelay(attempt: number) {
  const normalizedAttempt = Math.max(0, Math.floor(attempt));
  return RETRY_DELAYS_MS[Math.min(normalizedAttempt, RETRY_DELAYS_MS.length - 1)];
}

function clearRetry(channel: object) {
  const timer = retryTimers.get(channel);
  if (timer) clearTimeout(timer);
  retryTimers.delete(channel);
}

function patchChannel(channel: any) {
  if (!channel || patchedChannels.has(channel)) return channel;
  patchedChannels.add(channel);

  const originalSubscribe = channel.subscribe.bind(channel);
  let attempt = 0;
  let lastCallback: ((status: string, error?: Error) => void) | undefined;
  let lastTimeout: number | undefined;

  const subscribeWithResilience = (
    callback?: (status: string, error?: Error) => void,
    timeout?: number,
  ) => {
    lastCallback = callback;
    lastTimeout = timeout;

    const statusHandler = (status: string, error?: Error) => {
      callback?.(status, error);

      if (status === 'SUBSCRIBED') {
        attempt = 0;
        clearRetry(channel);
        return;
      }

      if (!['CHANNEL_ERROR', 'TIMED_OUT', 'CLOSED'].includes(status)) return;
      if (manuallyClosedChannels.has(channel) || retryTimers.has(channel)) return;

      const delay = nextRealtimeRetryDelay(attempt);
      attempt += 1;
      const timer = setTimeout(() => {
        retryTimers.delete(channel);
        if (manuallyClosedChannels.has(channel)) return;
        if (typeof navigator !== 'undefined' && navigator.onLine === false) {
          statusHandler('TIMED_OUT', new Error('Navegador sem conexão.'));
          return;
        }
        originalSubscribe(statusHandler, lastTimeout);
      }, delay);
      retryTimers.set(channel, timer);
    };

    return originalSubscribe(statusHandler, timeout);
  };

  channel.subscribe = subscribeWithResilience;

  // Mantém uma forma explícita de reativar o canal em testes e após eventos de rede.
  channel.gsaReconnect = () => {
    clearRetry(channel);
    manuallyClosedChannels.delete(channel);
    return subscribeWithResilience(lastCallback, lastTimeout);
  };

  return channel;
}

export function installRealtimeResilience() {
  if (installed) return;
  installed = true;

  const client = supabase as any;
  const originalChannel = client.channel.bind(client);
  const originalRemoveChannel = client.removeChannel.bind(client);

  client.channel = (topic: string, params?: unknown) => patchChannel(originalChannel(topic, params));
  client.removeChannel = async (channel: object) => {
    manuallyClosedChannels.add(channel);
    clearRetry(channel);
    return originalRemoveChannel(channel);
  };

  if (typeof window !== 'undefined') {
    window.addEventListener('online', () => {
      // Os canais com timer ativo tentarão novamente no próximo ciclo curto.
      // Os hooks continuam com polling de fallback para garantir atualização imediata.
    });
  }
}

installRealtimeResilience();
