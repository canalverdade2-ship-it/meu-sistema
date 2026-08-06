import { uploadPublicStoreImageR2, removeFromR2, getR2PathFromUrl } from './r2Storage';
import { generateUUID } from './utils';

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
  return await uploadPublicStoreImageR2(file, prefix);
}

export function getPublicStoreImagePath(reference?: string | null) {
  return getR2PathFromUrl(reference);
}

export async function removePublicStoreImage(reference?: string | null) {
  const path = getPublicStoreImagePath(reference);
  if (!path) return;
  await removeFromR2(path);
}

export async function removeUnusedPublicStoreImages(before: string[], after: string[]) {
  const retained = new Set(after.filter(Boolean));
  const removed = before.filter((item) => item && !retained.has(item));
  await Promise.allSettled(removed.map((item) => removePublicStoreImage(item)));
}
