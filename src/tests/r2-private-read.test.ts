import { afterEach, expect, it, vi } from 'vitest';
vi.mock('../lib/supabase', () => ({ supabase: { auth: { getSession: async () => ({ data: { session: null } }) } } }));
vi.mock('../lib/sessionService', () => ({ sessionService: { getCurrentSession: () => ({ sessaoId: 'test-session', sessionToken: 'secret-for-test' }) } }));
import { getPrivateR2Url, privateBucketPath, privatePathFromLegacyUrl, VPS_API_URL } from '../lib/r2Storage';
afterEach(() => { vi.unstubAllGlobals(); vi.restoreAllMocks(); });
it('sends credentials only in headers and exposes a local blob URL', async () => {
  const fetcher = vi.fn().mockResolvedValue(new Response('document'));
  vi.stubGlobal('fetch', fetcher);
  vi.stubGlobal('window', { setTimeout: vi.fn() });
  vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:local-document');
  expect(await getPrivateR2Url('private/client-docs/owner/a.pdf')).toBe('blob:local-document');
  expect(fetcher.mock.calls[0][0]).not.toContain('secret-for-test');
  expect(fetcher.mock.calls[0][1].headers['x-gsa-session-token']).toBe('secret-for-test');
});
it('does not bypass an authorization denial by trying another backend', async () => {
  const fetcher = vi.fn().mockResolvedValue(new Response('', { status: 403 }));
  vi.stubGlobal('fetch', fetcher);
  await expect(getPrivateR2Url('private/client-docs/other/a.pdf')).rejects.toThrow();
  expect(fetcher).toHaveBeenCalledTimes(1);
});
it('rejects traversal before sending credentials', async () => {
  const fetcher = vi.fn();
  vi.stubGlobal('fetch', fetcher);
  await expect(getPrivateR2Url('private/../a.pdf')).rejects.toThrow();
  expect(fetcher).not.toHaveBeenCalled();
});
it('recognizes private URLs only from the configured storage host', () => {
  expect(privatePathFromLegacyUrl(`${VPS_API_URL}/uploads/private/client-docs/id/a.pdf?token=old`)).toBe('private/client-docs/id/a.pdf');
  expect(privatePathFromLegacyUrl('https://unrelated.example/uploads/private/client-docs/id/a.pdf')).toBeNull();
  expect(privatePathFromLegacyUrl(`${VPS_API_URL}/uploads/store-images/a.jpg`)).toBeNull();
});
it('maps legacy bucket-relative paths without duplicating the private prefix', () => {
  expect(privateBucketPath('documentos_cliente', 'id/a.pdf')).toBe('private/client-docs/id/a.pdf');
  expect(privateBucketPath('documentos_prestador', 'private/provider-docs/id/a.pdf')).toBe('private/provider-docs/id/a.pdf');
  expect(() => privateBucketPath('documentos_cliente', 'private/provider-docs/id/a.pdf')).toThrow();
});
