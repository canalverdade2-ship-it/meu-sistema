import { afterEach, describe, expect, it, vi } from 'vitest';
vi.mock('../lib/supabase', () => ({ supabase: { auth: { getSession: async () => ({ data: { session: null } }) } } }));
vi.mock('../lib/sessionService', () => ({ sessionService: { getCurrentSession: () => null } }));
import { removeFromR2 } from '../lib/r2Storage';

afterEach(() => vi.unstubAllGlobals());
describe('storage deletion confirmation', () => {
  it('requires confirmation from both stores, including filenames resembling examples', async () => {
    const fetcher = vi.fn().mockResolvedValue(new Response(JSON.stringify({ success: true })));
    fetcher.mockImplementation(async () => new Response(JSON.stringify({ success: true })));
    vi.stubGlobal('fetch', fetcher);
    await removeFromR2('private/documents/doc_cliente_1024-real.pdf');
    expect(fetcher).toHaveBeenCalledTimes(2);
    expect(JSON.parse(fetcher.mock.calls[0][1].body).paths).toEqual(['private/documents/doc_cliente_1024-real.pdf']);
  });
  it.each([401, 403, 500])('rejects partial deletion when one store returns %s', async (status) => {
    const fetcher = vi.fn()
      .mockResolvedValueOnce(new Response(JSON.stringify({ success: true })))
      .mockResolvedValueOnce(new Response(JSON.stringify({ error: 'failed' }), { status }));
    vi.stubGlobal('fetch', fetcher);
    await expect(removeFromR2('private/documents/a.pdf')).rejects.toThrow('todos os armazenamentos');
  });
  it('rejects network failure', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('offline')));
    await expect(removeFromR2('private/documents/a.pdf')).rejects.toThrow();
  });
  it('rejects an unconfirmed successful HTTP response', async () => {
    vi.stubGlobal('fetch', vi.fn().mockImplementation(async () => new Response('{}')));
    await expect(removeFromR2('private/documents/a.pdf')).rejects.toThrow();
  });
});
