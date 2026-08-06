/**
 * GSA Hub — R2 Upload Worker
 * Responsável por:
 * 1. Validar o token Supabase do usuário
 * 2. Fazer upload de arquivos para o R2
 * 3. Deletar arquivos do R2
 * 4. Servir arquivos privados (auth-gated proxy)
 */

const CORS_HEADERS = (origin) => ({
  'Access-Control-Allow-Origin': origin,
  'Access-Control-Allow-Methods': 'GET, POST, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, x-gsa-session-id, x-gsa-session-token',
  'Access-Control-Max-Age': '86400',
});

function getAllowedOrigin(request, env) {
  const origin = request.headers.get('Origin') || '';
  const allowed = (env.ALLOWED_ORIGINS || 'https://gsa-hub.pages.dev').split(',').map(o => o.trim());
  if (allowed.includes(origin)) return origin;
  // Permitir subdomínios do pages.dev em preview
  if (origin.endsWith('.pages.dev')) return origin;
  return allowed[0];
}

function jsonResp(data, status, corsHeaders) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

async function validateSupabaseToken(token, env) {
  if (!token) return null;
  const resp = await fetch(`${env.SUPABASE_URL}/auth/v1/user`, {
    headers: {
      'Authorization': `Bearer ${token}`,
      'apikey': env.SUPABASE_ANON_KEY,
    },
  });
  if (!resp.ok) return null;
  return resp.json();
}

function normalizePath(raw) {
  const p = String(raw || '').replace(/\\/g, '/').replace(/^\/+/, '').replace(/\/+$/, '');
  if (!p || p.includes('..') || p.includes('//')) return null;
  return p;
}

export default {
  async fetch(request, env) {
    const origin = getAllowedOrigin(request, env);
    const corsHeaders = CORS_HEADERS(origin);

    // Preflight CORS
    if (request.method === 'OPTIONS') {
      return new Response(null, { status: 204, headers: corsHeaders });
    }

    const url = new URL(request.url);
    const pathname = url.pathname;

    // ─── POST /upload ─────────────────────────────────────────────
    if (pathname === '/upload' && request.method === 'POST') {
      const authHeader = request.headers.get('Authorization') || '';
      const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null;
      const user = await validateSupabaseToken(token, env);
      if (!user) return jsonResp({ error: 'Sessão inválida. Faça login novamente.' }, 401, corsHeaders);

      let formData;
      try { formData = await request.formData(); }
      catch { return jsonResp({ error: 'Formato de requisição inválido.' }, 400, corsHeaders); }

      const file = formData.get('file');
      const rawPath = formData.get('path');
      const key = normalizePath(rawPath);

      if (!file || !key) return jsonResp({ error: 'Arquivo ou caminho ausente.' }, 400, corsHeaders);
      if (file.size > 20 * 1024 * 1024) return jsonResp({ error: 'Arquivo maior que 20 MB.' }, 413, corsHeaders);

      try {
        await env.R2.put(key, file.stream(), {
          httpMetadata: {
            contentType: file.type || 'application/octet-stream',
            cacheControl: key.startsWith('private/') ? 'private, no-cache' : 'public, max-age=31536000',
          },
          customMetadata: { uploadedBy: user.id, originalName: file.name },
        });
      } catch (err) {
        return jsonResp({ error: 'Falha ao salvar o arquivo.' }, 500, corsHeaders);
      }

      const isPrivate = key.startsWith('private/');
      const publicUrl = isPrivate ? null : `${env.R2_PUBLIC_URL}/${key}`;

      return jsonResp({ success: true, url: publicUrl, path: key, isPrivate }, 200, corsHeaders);
    }

    // ─── DELETE /delete ────────────────────────────────────────────
    if (pathname === '/delete' && request.method === 'DELETE') {
      const authHeader = request.headers.get('Authorization') || '';
      const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null;
      const user = await validateSupabaseToken(token, env);
      if (!user) return jsonResp({ error: 'Sessão inválida.' }, 401, corsHeaders);

      let body;
      try { body = await request.json(); }
      catch { return jsonResp({ error: 'JSON inválido.' }, 400, corsHeaders); }

      const paths = Array.isArray(body.paths) ? body.paths : (body.path ? [body.path] : []);
      const keys = paths.map(normalizePath).filter(Boolean);
      if (keys.length === 0) return jsonResp({ error: 'Nenhum caminho válido.' }, 400, corsHeaders);
      if (keys.length > 50) return jsonResp({ error: 'Máximo de 50 arquivos por operação.' }, 400, corsHeaders);

      try {
        await Promise.all(keys.map(k => env.R2.delete(k)));
        return jsonResp({ success: true, deleted: keys.length }, 200, corsHeaders);
      } catch {
        return jsonResp({ error: 'Falha ao remover o arquivo.' }, 500, corsHeaders);
      }
    }

    // ─── GET /private/* ────────────────────────────────────────────
    // Serve arquivos privados após validar autenticação
    if (pathname.startsWith('/private/') && request.method === 'GET') {
      const authHeader = request.headers.get('Authorization') || '';
      const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null;
      const user = await validateSupabaseToken(token, env);
      if (!user) return new Response('Não autorizado', { status: 401, headers: corsHeaders });

      const key = normalizePath('private/' + pathname.slice(9));
      if (!key) return new Response('Caminho inválido', { status: 400, headers: corsHeaders });

      const obj = await env.R2.get(key);
      if (!obj) return new Response('Arquivo não encontrado', { status: 404, headers: corsHeaders });

      const headers = new Headers(corsHeaders);
      obj.writeHttpMetadata(headers);
      headers.set('Cache-Control', 'private, max-age=300');
      headers.set('Content-Disposition', 'inline');
      return new Response(obj.body, { headers });
    }

    // ─── GET /health ───────────────────────────────────────────────
    if (pathname === '/health') {
      return jsonResp({ status: 'ok', service: 'gsa-hub-r2-worker' }, 200, corsHeaders);
    }

    return jsonResp({ error: 'Rota não encontrada.' }, 404, corsHeaders);
  },
};
