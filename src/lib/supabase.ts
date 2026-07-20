import { createClient, SupabaseClient } from '@supabase/supabase-js';

let supabaseInstance: SupabaseClient | null = null;

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

    supabaseInstance = createClient(supabaseUrl, supabaseAnonKey, {
      realtime: {
        params: {
          eventsPerSecond: 10, // Limitar para evitar throttling do servidor
        },
      },
    });
  }
  return supabaseInstance;
};

// Proxy completo para garantir inicialização preguiçosa (lazy) e compatibilidade total com o SDK
// Implementa TODOS os traps necessários para que o Proxy se comporte exatamente como o SupabaseClient
export const supabase = new Proxy({} as SupabaseClient, {
  get: (_target, prop, receiver) => {
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
