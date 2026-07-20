import { createClient, SupabaseClient } from '@supabase/supabase-js';

const PRIVATE_CLIENT_BUCKET = 'documentos_cliente';
const PRIVATE_ADMIN_BUCKET = 'gsa-private-documents';
const LEGACY_LOAN_BUCKET = 'emprestimos';
const PRIVATE_ADMIN_PREFIX = `gsa-private://${PRIVATE_ADMIN_BUCKET}/`;
const CLIENT_SESSION_KEY = '_gsa_session';
const MAX_CLIENT_FILE_SIZE = 20 * 1024 * 1024;
const ALLOWED_CLIENT_FILE_EXTENSIONS = new Set([
  'pdf', 'jpg', 'jpeg', 'png', 'webp', 'doc', 'docx', 'xls', 'xlsx', 'txt',
]);

let supabaseInstance: SupabaseClient | null = null;
let storageProxy: any = null;
let rpcProxy: any = null;
const legacyLoanReferences = new Map<string, string>();

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

  for (let index = window.localStorage.length - 1; index >= 0; index -= 1) {
    const key = window.localStorage.key(index);
    if (key === storageKey || key?.startsWith(`${storageKey}.`)) {
      window.localStorage.removeItem(key);
    }
  }
}

function normalizeStoragePath(path: string): string {
  const normalized = String(path || '').replace(/^\/+/, '').replace(/\\/g, '/');
  if (!normalized || normalized.includes('..') || normalized.includes('//')) {
    throw new Error('Caminho de arquivo inválido.');
  }
  return normalized;
}

function sanitizeFileName(fileName: string) {
  return String(fileName || 'arquivo')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zA-Z0-9._-]/g, '_')
    .replace(/_+/g, '_')
    .replace(/^[_\.]+|[_\.]+$/g, '')
    .slice(-160) || 'arquivo';
}

function privateReference(path: string) {
  return `${PRIVATE_ADMIN_PREFIX}${normalizeStoragePath(path)}`;
}

function privateReferencePath(reference?: string | null) {
  if (!reference?.startsWith(PRIVATE_ADMIN_PREFIX)) return null;
  return normalizeStoragePath(reference.slice(PRIVATE_ADMIN_PREFIX.length));
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

async function uploadLegacyLoanContract(
  client: SupabaseClient,
  originalPath: string,
  body: unknown,
  options?: unknown,
) {
  const normalized = normalizeStoragePath(originalPath);
  const match = /^contratos\/([0-9a-f-]{36})\/(.+)$/i.exec(normalized);
  if (!match) return null;

  const loanId = match[1];
  const originalName = match[2].split('/').pop() || 'contrato.pdf';
  const { data: loan, error: loanError } = await client
    .from('emprestimos')
    .select('cliente_id')
    .eq('id', loanId)
    .maybeSingle();

  if (loanError) throw loanError;
  if (!loan?.cliente_id) throw new Error('O empréstimo não possui cliente associado.');

  const privatePath = `emprestimos/${loan.cliente_id}/contratos/${loanId}/${crypto.randomUUID()}-${sanitizeFileName(originalName)}`;
  const privateApi = client.storage.from(PRIVATE_ADMIN_BUCKET);
  const result = await privateApi.upload(privatePath, body as any, options as any);
  if (result.error) return result;

  legacyLoanReferences.set(normalized, privateReference(privatePath));
  return {
    ...result,
    data: result.data ? { ...result.data, path: privatePath } : result.data,
  };
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

        if (bucket === LEGACY_LOAN_BUCKET) {
          return new Proxy(bucketApi, {
            get(bucketTarget, bucketProperty) {
              if (bucketProperty === 'upload') {
                return async (path: string, body: unknown, options?: unknown) => {
                  const redirected = await uploadLegacyLoanContract(client, path, body, options);
                  if (redirected) return redirected;
                  return bucketTarget.upload(normalizeStoragePath(path), body, options);
                };
              }

              if (bucketProperty === 'getPublicUrl') {
                return (path: string) => {
                  const normalized = normalizeStoragePath(path);
                  const reference = legacyLoanReferences.get(normalized);
                  if (reference) return { data: { publicUrl: reference } };
                  return bucketTarget.getPublicUrl(normalized);
                };
              }

              if (bucketProperty === 'remove') {
                return async (paths: string[]) => {
                  const legacyPaths: string[] = [];
                  const privatePaths: string[] = [];
                  for (const path of paths) {
                    const normalized = normalizeStoragePath(path);
                    const reference = legacyLoanReferences.get(normalized);
                    const privatePath = privateReferencePath(reference);
                    if (privatePath) privatePaths.push(privatePath);
                    else legacyPaths.push(normalized);
                  }

                  const privateResult = privatePaths.length > 0
                    ? await client.storage.from(PRIVATE_ADMIN_BUCKET).remove(privatePaths)
                    : { data: [], error: null };
                  if (privateResult.error) return privateResult;
                  return legacyPaths.length > 0
                    ? bucketTarget.remove(legacyPaths)
                    : privateResult;
                };
              }

              const value = bucketTarget[bucketProperty];
              return typeof value === 'function' ? value.bind(bucketTarget) : value;
            },
          });
        }

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

function getRpcProxy(client: SupabaseClient) {
  if (rpcProxy) return rpcProxy;
  const originalRpc = (client as any).rpc.bind(client);

  rpcProxy = async (functionName: string, args?: Record<string, unknown>, options?: unknown) => {
    const result = await originalRpc(functionName, args, options);

    if (
      functionName === 'gsa_admin_emprestimo_enviar_contrato'
      && result?.error
      && typeof args?.p_contrato_url === 'string'
    ) {
      const path = privateReferencePath(args.p_contrato_url);
      if (path) {
        await client.storage.from(PRIVATE_ADMIN_BUCKET).remove([path]).catch(() => undefined);
      }
    }

    return result;
  };
  return rpcProxy;
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

// Proxy de inicialização preguiçosa. O Storage do cliente recebe uma camada
// adicional para impedir caminhos alheios e para nunca gerar URLs públicas.
// O upload legado de contratos de empréstimo também é redirecionado para o
// bucket administrativo privado enquanto o módulo antigo é gradualmente
// migrado para uploadPrivateDocument.
export const supabase = new Proxy({} as SupabaseClient, {
  get: (_target, property) => {
    const client = getSupabase();
    if (property === 'storage') return getStorageProxy(client);
    if (property === 'rpc') return getRpcProxy(client);
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
