import { supabase } from './supabase';

export const CLASSIFIEDS_MEDIA_BUCKET = 'classificados-midias';
export const CLASSIFIEDS_MAX_IMAGES = 10;
export const CLASSIFIEDS_MAX_IMAGE_SIZE_MB = 8;

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const ALLOWED_MIME_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp']);
const ALLOWED_EXTENSIONS = new Set(['jpg', 'jpeg', 'png', 'webp']);

export interface UploadedClassifiedMedia {
  url: string;
  path: string;
  tipo: 'image';
  ordem: number;
  nome: string;
  tamanho: number;
}

function safeExtension(file: File) {
  const extension = file.name.split('.').pop()?.toLowerCase().replace(/[^a-z0-9]/g, '');
  return extension || '';
}

function normalizeStoragePath(path: string) {
  const normalized = String(path || '').replace(/^\/+/, '').replace(/\\/g, '/');
  if (!normalized || normalized.includes('..') || normalized.includes('//')) return null;
  return normalized;
}

export function validateClassifiedImage(file: File) {
  const extension = safeExtension(file);

  if (!file.name || file.name.includes('\0') || file.size <= 0) {
    throw new Error('A imagem selecionada é inválida ou está vazia.');
  }
  if (file.size > CLASSIFIEDS_MAX_IMAGE_SIZE_MB * 1024 * 1024) {
    throw new Error(`A imagem ${file.name} ultrapassa ${CLASSIFIEDS_MAX_IMAGE_SIZE_MB} MB.`);
  }
  if (!file.type || !ALLOWED_MIME_TYPES.has(file.type) || !ALLOWED_EXTENSIONS.has(extension)) {
    throw new Error(`O arquivo ${file.name} não é uma imagem JPG, PNG ou WEBP válida.`);
  }
}

export async function uploadClassifiedImage(input: {
  clientId: string;
  draftId: string;
  file: File;
  order: number;
}): Promise<UploadedClassifiedMedia> {
  validateClassifiedImage(input.file);

  const clientId = input.clientId.trim().toLowerCase();
  const draftId = input.draftId.trim().toLowerCase();
  if (!UUID_PATTERN.test(clientId) || !UUID_PATTERN.test(draftId)) {
    throw new Error('Identidade inválida para o upload da imagem.');
  }

  const extension = safeExtension(input.file);
  const path = normalizeStoragePath(`${clientId}/${draftId}/${Date.now()}_${crypto.randomUUID()}.${extension}`);
  if (!path) throw new Error('Não foi possível gerar o caminho seguro da imagem.');

  const { error } = await supabase.storage.from(CLASSIFIEDS_MEDIA_BUCKET).upload(path, input.file, {
    upsert: false,
    contentType: input.file.type,
    cacheControl: '31536000',
  });
  if (error) throw error;

  const { data } = supabase.storage.from(CLASSIFIEDS_MEDIA_BUCKET).getPublicUrl(path);
  if (!data?.publicUrl) {
    await supabase.storage.from(CLASSIFIEDS_MEDIA_BUCKET).remove([path]);
    throw new Error('Não foi possível obter a URL pública da imagem.');
  }

  return {
    url: data.publicUrl,
    path,
    tipo: 'image',
    ordem: input.order,
    nome: input.file.name,
    tamanho: input.file.size,
  };
}

export async function removeClassifiedImage(path: string) {
  const normalized = normalizeStoragePath(path);
  if (!normalized) throw new Error('Caminho de imagem inválido.');
  const { error } = await supabase.storage.from(CLASSIFIEDS_MEDIA_BUCKET).remove([normalized]);
  if (error) throw error;
}

export async function removeClassifiedImages(paths: string[]) {
  const normalized = paths.map(normalizeStoragePath).filter((path): path is string => Boolean(path));
  if (normalized.length === 0) return;
  const { error } = await supabase.storage.from(CLASSIFIEDS_MEDIA_BUCKET).remove(normalized);
  if (error) throw error;
}
