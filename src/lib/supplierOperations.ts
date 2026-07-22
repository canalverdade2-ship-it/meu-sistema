import { supabase } from './supabase';
import { callAdminRpc } from './adminRpc';
import type { AdminSupplierSnapshot, SupplierSnapshot } from '../types/supplier';

const SUPPLIER_BUCKET = 'documentos_fornecedor';
const SUPPLIER_PREFIX = `storage://${SUPPLIER_BUCKET}/`;
const ALLOWED_EXTENSIONS = new Set(['pdf', 'xml']);

export async function getSupplierSnapshot() {
  const { data, error } = await supabase.rpc('gsa_supplier_dashboard_snapshot');
  if (error) throw error;
  return data as SupplierSnapshot;
}

export async function requestSupplierProduct(payload: Record<string, unknown>) {
  const { data, error } = await supabase.rpc('gsa_supplier_request_product', { p_payload: payload });
  if (error) throw error;
  return data as any;
}

export async function markSupplierOrderSeen(orderId: string) {
  const { data, error } = await supabase.rpc('gsa_supplier_mark_order_seen', { p_order_id: orderId });
  if (error) throw error;
  return data as any;
}

export async function submitSupplierDelivery(requestId: string, orderId: string, payload: Record<string, unknown>) {
  const { data, error } = await supabase.rpc('gsa_supplier_submit_delivery', {
    p_request_id: requestId,
    p_order_id: orderId,
    p_payload: payload,
  });
  if (error) throw error;
  return data as any;
}

export async function uploadSupplierInvoice(file: File, supplierId: string, orderId: string) {
  const extension = file.name.split('.').pop()?.toLowerCase() || '';
  if (!ALLOWED_EXTENSIONS.has(extension)) throw new Error('Envie somente arquivos XML ou PDF.');
  if (!file.size || file.size > 10 * 1024 * 1024) throw new Error('O arquivo deve possuir no máximo 10 MB.');
  const safeName = file.name.normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-zA-Z0-9._-]/g, '_').slice(-140);
  const path = `${supplierId}/notas-fiscais/${orderId}/${crypto.randomUUID()}-${safeName}`;
  const { error } = await supabase.storage.from(SUPPLIER_BUCKET).upload(path, file, {
    cacheControl: '3600',
    contentType: file.type || (extension === 'xml' ? 'application/xml' : 'application/pdf'),
    upsert: false,
  });
  if (error) throw error;
  return `${SUPPLIER_PREFIX}${path}`;
}

export async function resolveSupplierDocument(reference: string, expiresInSeconds = 300) {
  if (!reference.startsWith(SUPPLIER_PREFIX)) throw new Error('Referência de documento inválida.');
  const path = reference.slice(SUPPLIER_PREFIX.length);
  const { data, error } = await supabase.storage.from(SUPPLIER_BUCKET).createSignedUrl(path, expiresInSeconds);
  if (error || !data?.signedUrl) throw error || new Error('Não foi possível abrir o documento.');
  return data.signedUrl;
}

export async function getAdminSupplierSnapshot() {
  return callAdminRpc<AdminSupplierSnapshot>('gsa_admin_supplier_snapshot');
}

export async function setAdminSupplierStatus(supplierId: string, status: string, reason?: string, pin?: string) {
  return callAdminRpc('gsa_admin_supplier_set_status', {
    p_supplier_id: supplierId,
    p_status: status,
    p_reason: reason || null,
    p_pin: pin || null,
  });
}

export async function reviewAdminSupplierProduct(requestId: string, action: string, reason?: string, productPayload: Record<string, unknown> = {}) {
  return callAdminRpc('gsa_admin_review_supplier_product', {
    p_request_id: requestId,
    p_action: action,
    p_reason: reason || null,
    p_product_payload: productPayload,
  });
}

export async function createAdminSupplierOrder(requestId: string, supplierId: string, payload: Record<string, unknown>) {
  return callAdminRpc('gsa_admin_create_supplier_order', {
    p_request_id: requestId,
    p_supplier_id: supplierId,
    p_payload: payload,
  });
}

export async function reviewAdminSupplierDelivery(deliveryId: string, action: string, reason?: string) {
  return callAdminRpc('gsa_admin_review_supplier_delivery', {
    p_delivery_id: deliveryId,
    p_action: action,
    p_reason: reason || null,
  });
}

export async function updateAdminSupplierPayable(payableId: string, action: string, payload: Record<string, unknown> = {}) {
  return callAdminRpc('gsa_admin_update_supplier_payable', {
    p_payable_id: payableId,
    p_action: action,
    p_payload: payload,
  });
}
