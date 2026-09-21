import { handleRequest as authSessionHandler } from './gsa-auth-session.ts';
import { handleRequest as adsPublicHandler } from './gsa-ads-public.ts';
import { handleRequest as adsAdminHandler } from './gsa-ads-admin.ts';
import { handleRequest as paymentsHandler } from './gsa-payments.ts';

export async function handleRequest(request: Request) {
  const url = new URL(request.url);
  const path = url.pathname;
  console.log('[Router] Received request for ' + path);

  if (path === '/' || path === '/gsa-auth-session') {
    return await authSessionHandler(request);
  }
  if (path === '/gsa-ads-public') {
    return await adsPublicHandler(request);
  }
  if (path === '/gsa-ads-admin') {
    return await adsAdminHandler(request);
  }
  if (path === '/gsa-payments') {
    return await paymentsHandler(request);
  }
  
  return new Response('Not Found in Deno Router: ' + path, { status: 404 });
}

if (import.meta.main) {
  Deno.serve(handleRequest);
}

