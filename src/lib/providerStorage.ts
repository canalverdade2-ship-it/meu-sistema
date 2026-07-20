import { supabase } from './supabase';

const STORAGE_PREFIX = 'storage://';
const PRIVATE_BUCKETS = new Set(['documentos_prestador', 'entregas_demandas']);
const ALLOWED_EXTENSIONS = new Set(['pdf', 'jpg', 'jpeg', 'png', 'webp', 'txt', 'zip', 'doc', 'docx', 'xls', 'xlsx']);

export function toStorageReference(bucket: string, path: string) {
  return `${STORAGE_PREFIX}${bucket}/${path}`;
}

export function parseStorageReference(reference: string) {
  if (!reference) return null;

  if (reference.startsWith(STORAGE_PREFIX)) {
    const value = reference.slice(STORAGE_PREFIX.length);
    const slashIndex = value.indexOf('/');
    if (slashIndex <= 0) return null;
    return { bucket: value.slice(0, slashIndex), path: value.slice(slashIndex + 1) };
  }

  try {
    const parsedUrl = new URL(reference);
    const markers = ['/storage/v1/object/public/', '/storage/v1/object/sign/'];
    const marker = markers.find((item) => parsedUrl.pathname.includes(item));
    if (!marker) return null;
    const value = decodeURIComponent(parsedUrl.pathname.split(marker)[1] || '');
    const slashIndex = value.indexOf('/');
    if (slashIndex <= 0) return null;
    const bucket = value.slice(0, slashIndex);
    if (!PRIVATE_BUCKETS.has(bucket)) return null;
    return { bucket, path: value.slice(slashIndex + 1) };
  } catch {
    return null;
  }
}

function safeExtension(file: File) {
  const extension = file.name.split('.').pop()?.toLowerCase().replace(/[^a-z0-9]/g, '');
  return extension || '';
}

export function validateProviderFile(file: File, options?: { maxSizeMb?: number; allowedMimeTypes?: string[] }) {
  const maxSizeMb = options?.maxSizeMb ?? 15;
  const allowed = options?.allowedMimeTypes ?? [
    'application/pdf',
    'image/jpeg',
    'image/png',
    'image/webp',
    'text/plain',
    'application/zip',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/vnd.ms-excel',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  ];
  const extension = safeExtension(file);

  if (!file.type || !allowed.includes(file.type) || !ALLOWED_EXTENSIONS.has(extension)) {
    throw new Error(`O tipo do arquivo ${file.name} não é permitido.`);
  }
  if (file.size <= 0) throw new Error(`O arquivo ${file.name} está vazio.`);
  if (file.size > maxSizeMb * 1024 * 1024) {
    throw new Error(`O arquivo ${file.name} ultrapassa ${maxSizeMb} MB.`);
  }
}

export async function uploadProviderPrivateFile(input: {
  bucket: 'documentos_prestador' | 'entregas_demandas';
  providerId: string;
  scope: string;
  file: File;
  maxSizeMb?: number;
}) {
  validateProviderFile(input.file, { maxSizeMb: input.maxSizeMb });
  const extension = safeExtension(input.file);
  const cleanScope = input.scope.replace(/[^a-zA-Z0-9/_-]/g, '-');
  const path = `${input.providerId}/${cleanScope}/${Date.now()}_${crypto.randomUUID()}.${extension}`;
  const { error } = await supabase.storage.from(input.bucket).upload(path, input.file, {
    upsert: false,
    contentType: input.file.type,
  });
  if (error) throw error;
  return toStorageReference(input.bucket, path);
}

export async function resolveProviderFileUrl(reference: string, expiresInSeconds = 300) {
  const parsed = parseStorageReference(reference);
  if (!parsed) return reference;
  const { data, error } = await supabase.storage.from(parsed.bucket).createSignedUrl(parsed.path, expiresInSeconds);
  if (error || !data?.signedUrl) throw error || new Error('Não foi possível abrir o arquivo.');
  return data.signedUrl;
}

export async function removeProviderPrivateFile(reference: string) {
  const parsed = parseStorageReference(reference);
  if (!parsed) return;
  const { error } = await supabase.storage.from(parsed.bucket).remove([parsed.path]);
  if (error) throw error;
}
