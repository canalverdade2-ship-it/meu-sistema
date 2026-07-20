import { createClient, SupabaseClient } from '@supabase/supabase-js';

const PRIVATE_CLIENT_BUCKET = 'documentos_cliente';
const CLIENT_SESSION_KEY = '_gsa_session';
const MAX_CLIENT_FILE_SIZE = 20 * 1024 * 1024;
const ALLOWED_CLIENT_FILE_EXTENSIONS = new Set([
  'pdf', 'jpg', 'jpeg', 'png', 'webp', 'doc', 'docx', 'xls', 'xlsx', 'txt',
]);

let supabaseInstance: SupabaseClient | null = null;
let storageProxy: any = null;

function normalizeStoragePath(path: string): string {
  const normalized = String(path || '').replace(/^\/+/, '').replace(/\\/g, '/');
  if (!normalized || normalized.includes('..') || normalized.includes('//')) {
    throw new Error('Caminho de arquivo inválido.');
  }
  return normalized;
}

function getStoredActor(): { atorTipo?: string; atorId?: string } | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = window.sessionStorage.getItem(CLIENT_SESSION_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

function validateClientStoragePath(bucket: string, path: string): string {
  const normalized = normalizeStoragePath(path);
  if (bucket !== PRIVATE_CLIENT_BUCKET) return normalized;

  const actor = getStoredActor();
  if (actor?.atorTipo === 'cliente' && actor.atorId) {
    const segments = normalized.split('/');
    if (!segments.includes(actor.atorId)) {
      throw new Error('O arquivo não pertence ao cliente autenticado.');
    }
  }

  return normalized;
}

function validateClientUpload(bucket: string, path: string, body: unknown): string {
  const normalized = validateClientStoragePath(bucket, path);
  if (bucket !== PRIVATE_CLIENT_BUCKET) return normalized;

  const actor = getStoredActor();
  if (actor?.atorTipo !== 'cliente') return normalized;

  const blob = body instanceof Blob ? body : null;
  if (!blob || blob.size <= 0 || blob.size > MAX_CLIENT_FILE_SIZE) {
    throw new Error('O arquivo deve possuir no máximo 20 MB.');
  }

  const extension = normalized.split('.').pop()?.toLowerCase() || '';
  if (!ALLOWED_CLIENT_FILE_EXTENSIONS.has(extension)) {
    throw new Error('Formato de arquivo não permitido.');
  }

  return normalized;
}

function getStorageProxy(client: SupabaseClient): any {
  if (storageProxy) return storageProxy;

  const storage = (client as any).storage;
  storageProxy = new Proxy(storage, {
    get(target, property) {
      if (property !== 'from') {
        const value = target[property];
        return typeof value === 'function' ? value.bind(target) : value;
      }

      return (bucket: string) => {
        const bucketApi = target.from(bucket);
        if (bucket !== PRIVATE_CLIENT_BUCKET) return bucketApi;

        return new Proxy(bucketApi, {
          get(bucketTarget, bucketProperty) {
            if (bucketProperty === 'getPublicUrl') {
              return (path: string) => {
                const normalized = validateClientStoragePath(bucket, path);
                return {
                  data: {
                    publicUrl: `storage://${bucket}/${normalized}`,
                  },
                };
              };
            }

            if (bucketProperty === 'upload' || bucketProperty === 'update') {
              return (path: string, body: unknown, options?: unknown) => {
                const normalized = validateClientUpload(bucket, path, body);
                return bucketTarget[bucketProperty](normalized, body, options);
              };
            }

            if (bucketProperty === 'remove') {
              return (paths: string[]) => {
                const normalizedPaths = paths.map((path) => validateClientStoragePath(bucket, path));
                return bucketTarget.remove(normalizedPaths);
              };
            }

            if (bucketProperty === 'move' || bucketProperty === 'copy') {
              return (fromPath: string, toPath: string, options?: unknown) => {
                const normalizedFrom = validateClientStoragePath(bucket, fromPath);
                const normalizedTo = validateClientStoragePath(bucket, toPath);
                return bucketTarget[bucketProperty](normalizedFrom, normalizedTo, options);
              };
            }

            const value = bucketTarget[bucketProperty];
            return typeof value === 'function' ? value.bind(bucketTarget) : value;
          },
        });
      };
    },
  });

  return storageProxy;
}

export const getSupabase = (): SupabaseClient => {
  if (!supabaseInstance) {
    const meta = import.meta as any;
    const processEnv = (typeof process !== 'undefined' ? process.env : {}) as any;

    const supabaseUrl = meta.env?.VITE_SUPABASE_URL || processEnv.VITE_SUPABASE_URL;
    const supabaseAnonKey = meta.env?.VITE_SUPABASE_ANON_KEY || processEnv.VITE_SUPABASE_ANON_KEY;

    if (!supabaseUrl || !supabaseAnonKey) {
      throw new Error(
        'Erro Crítico: Credenciais do Supabase não encontradas. Configure VITE_SUPABASE_URL e VITE_SUPABASE_ANON_KEY para ativar o banco de dados real.',
      );
    }

    supabaseInstance = createClient(supabaseUrl, supabaseAnonKey, {
      realtime: {
        params: {
          eventsPerSecond: 10,
        },
      },
    });
  }
  return supabaseInstance;
};

// Proxy de inicialização preguiçosa. O Storage do cliente recebe uma camada
// adicional para impedir caminhos alheios e para nunca gerar URLs públicas.
export const supabase = new Proxy({} as SupabaseClient, {
  get: (_target, property) => {
    const client = getSupabase();
    if (property === 'storage') return getStorageProxy(client);
    const value = (client as any)[property];
    return typeof value === 'function' ? value.bind(client) : value;
  },
  set: (_target, property, value) => {
    const client = getSupabase();
    (client as any)[property] = value;
    return true;
  },
  has: (_target, property) => property in getSupabase(),
  ownKeys: () => Reflect.ownKeys(getSupabase()),
  getOwnPropertyDescriptor: (_target, property) => Object.getOwnPropertyDescriptor(getSupabase(), property),
  getPrototypeOf: () => Object.getPrototypeOf(getSupabase()),
});
