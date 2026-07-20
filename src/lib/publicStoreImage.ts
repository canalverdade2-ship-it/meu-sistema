import { supabase } from './supabase';
import { generateUUID } from './utils';

const STORE_IMAGE_BUCKET = 'gsa-store-images';
const MAX_STORE_IMAGE_SIZE = 5 * 1024 * 1024;
const ALLOWED_STORE_IMAGE_TYPES = new Set([
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/gif',
]);

export function validatePublicStoreImage(file: File) {
  if (!ALLOWED_STORE_IMAGE_TYPES.has(file.type)) {
    throw new Error('Formato não permitido. Use JPG, PNG, WEBP ou GIF.');
  }
  if (file.size <= 0 || file.size > MAX_STORE_IMAGE_SIZE) {
    throw new Error('A imagem deve ter no máximo 5 MB.');
  }
}

export async function uploadPublicStoreImage(file: File, prefix: string) {
  validatePublicStoreImage(file);
  const extension = file.name.split('.').pop()?.toLowerCase().replace(/[^a-z0-9]/g, '') || 'img';
  const path = `${prefix}/${generateUUID()}.${extension}`;
  const { error } = await supabase.storage.from(STORE_IMAGE_BUCKET).upload(path, file, {
    upsert: false,
    contentType: file.type,
    cacheControl: '31536000',
  });
  if (error) throw error;
  const { data } = supabase.storage.from(STORE_IMAGE_BUCKET).getPublicUrl(path);
  return data.publicUrl;
}

export function getPublicStoreImagePath(reference?: string | null) {
  if (!reference) return null;
  const marker = `/storage/v1/object/public/${STORE_IMAGE_BUCKET}/`;
  const index = reference.indexOf(marker);
  if (index < 0) return null;
  return decodeURIComponent(reference.slice(index + marker.length));
}

export async function removePublicStoreImage(reference?: string | null) {
  const path = getPublicStoreImagePath(reference);
  if (!path) return;
  const { error } = await supabase.storage.from(STORE_IMAGE_BUCKET).remove([path]);
  if (error) throw error;
}

export async function removeUnusedPublicStoreImages(before: string[], after: string[]) {
  const retained = new Set(after.filter(Boolean));
  const removed = before.filter((item) => item && !retained.has(item));
  await Promise.allSettled(removed.map((item) => removePublicStoreImage(item)));
}
