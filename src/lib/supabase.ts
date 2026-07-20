import { createClient, SupabaseClient } from '@supabase/supabase-js';

let supabaseInstance: SupabaseClient | null = null;

const sessionStorageAdapter = {
  getItem(key: string) {
    return typeof window === 'undefined' ? null : window.sessionStorage.getItem(key);
  },
  setItem(key: string, value: string) {
    if (typeof window !== 'undefined') window.sessionStorage.setItem(key, value);
  },
  removeItem(key: string) {
    if (typeof window !== 'undefined') window.sessionStorage.removeItem(key);
  },
};

function legacySupabaseStorageKey(supabaseUrl: string) {
  try {
    const hostname = new URL(supabaseUrl).hostname;
    if (!hostname.endsWith('.supabase.co')) return null;
    const projectRef = hostname.split('.')[0];
    return projectRef ? `sb-${projectRef}-auth-token` : null;
  } catch {
    return null;
  }
}

function clearLegacySupabaseLocalStorage(supabaseUrl: string) {
  if (typeof window === 'undefined') return;

  const storageKey = legacySupabaseStorageKey(supabaseUrl);
  if (!storageKey) return;

  // Versões anteriores do cliente persistiam a sessão Auth no localStorage.
  // A limpeza é repetida em cada inicialização para também alcançar abas antigas
  // que ainda possam regravar a chave durante a transição de versão.
  for (let index = window.localStorage.length - 1; index >= 0; index -= 1) {
    const key = window.localStorage.key(index);
    if (key === storageKey || key?.startsWith(`${storageKey}.`)) {
      window.localStorage.removeItem(key);
    }
  }
}

export const getSupabase = (): SupabaseClient => {
  if (!supabaseInstance) {
    const meta = import.meta as any;
    const processEnv = (typeof process !== 'undefined' ? process.env : {}) as any;

    const supabaseUrl = meta.env?.VITE_SUPABASE_URL || processEnv.VITE_SUPABASE_URL;
    const supabaseAnonKey = meta.env?.VITE_SUPABASE_ANON_KEY || processEnv.VITE_SUPABASE_ANON_KEY;

    if (!supabaseUrl || !supabaseAnonKey) {
      throw new Error(
        'Erro Crítico: Credenciais do Supabase não encontradas. Configure VITE_SUPABASE_URL e VITE_SUPABASE_ANON_KEY para ativar o banco de dados real.'
      );
    }

    clearLegacySupabaseLocalStorage(supabaseUrl);

    supabaseInstance = createClient(supabaseUrl, supabaseAnonKey, {
      auth: {
        persistSession: true,
        storage: sessionStorageAdapter,
        autoRefreshToken: true,
        detectSessionInUrl: true,
        flowType: 'pkce',
      },
      realtime: {
        params: {
          eventsPerSecond: 10,
        },
      },
    });
  }
  return supabaseInstance;
};

// Proxy completo para garantir inicialização preguiçosa (lazy) e compatibilidade total com o SDK.
export const supabase = new Proxy({} as SupabaseClient, {
  get: (_target, prop) => {
    const client = getSupabase();
    const value = (client as any)[prop];
    return typeof value === 'function' ? value.bind(client) : value;
  },
  set: (_target, prop, value) => {
    const client = getSupabase();
    (client as any)[prop] = value;
    return true;
  },
  has: (_target, prop) => {
    const client = getSupabase();
    return prop in client;
  },
  ownKeys: () => {
    const client = getSupabase();
    return Reflect.ownKeys(client);
  },
  getOwnPropertyDescriptor: (_target, prop) => {
    const client = getSupabase();
    return Object.getOwnPropertyDescriptor(client, prop);
  },
  getPrototypeOf: () => {
    const client = getSupabase();
    return Object.getPrototypeOf(client);
  },
});