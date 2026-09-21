const fs = require('node:fs');
const path = require('node:path');
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const quote = value => String(value).replace(/'/g, "''");

async function actorFor(req, psql) {
  const id = req.headers['x-gsa-session-id'];
  const token = req.headers['x-gsa-session-token'];
  if (typeof id === 'string' && uuid.test(id) && typeof token === 'string' && token) {
    const result = psql(`SELECT row_to_json(v)::text FROM public.gsa_validate_session('${quote(id)}','${quote(token)}') v WHERE is_valid;`);
    if (result) return JSON.parse(result);
  }
  const authorization = req.headers.authorization;
  if (typeof authorization !== 'string' || !authorization.startsWith('Bearer ')) return null;
  const response = await fetch('http://127.0.0.1:9999/user', { headers: { Authorization: authorization }, signal: AbortSignal.timeout(5000) });
  if (!response.ok) return null;
  const user = await response.json();
  // Bind the verified JWT to a current GSA session and server-owned identity.
  if (!uuid.test(user.id || '') || !uuid.test(user.app_metadata?.gsa_session_id || '')) return null;
  const result = psql(`SELECT json_build_object('ator_tipo',s.ator_tipo,'ator_id',s.ator_id)::text FROM public.sistema_sessoes s JOIN public.gsa_auth_identities i ON i.ator_id=s.ator_id AND i.ator_tipo=s.ator_tipo WHERE i.auth_user_id='${user.id}' AND s.id='${user.app_metadata.gsa_session_id}' AND s.status='ativo';`);
  return result ? JSON.parse(result) : null;
}

function mayRead(actor, key) {
  if (!actor) return false;
  if (actor.ator_tipo === 'admin') return true;
  const parts = key.split('/');
  const scope = parts[1] === 'documents' ? parts[2] : parts[1];
  const owner = parts[1] === 'documents' ? parts[3] : parts[2];
  const types = { 'client-docs': 'cliente', loans: 'cliente', clientes: 'cliente', emprestimos: 'cliente', fiscal: 'cliente', 'provider-docs': 'prestador', prestadores: 'prestador' };
  return types[scope] === actor.ator_tipo && uuid.test(owner || '') && owner.toLowerCase() === String(actor.ator_id).toLowerCase();
}

function createPrivateHandler({ root, psql }) {
  return async function serve(req, res, pathname) {
    const reply = status => { res.writeHead(status, { 'Cache-Control': 'no-store' }); res.end(); };
    try {
      const key = decodeURIComponent(pathname.slice('/uploads/'.length));
      if (!key.startsWith('private/') || key.includes('\\') || key.split('/').some(p => !p || p === '.' || p === '..') || key.includes('\0')) return reply(400);
      const actor = await actorFor(req, psql);
      if (!actor) return reply(401);
      if (!mayRead(actor, key)) return reply(403);
      const filename = path.resolve(root, key);
      let real;
      try { real = fs.realpathSync(filename); } catch { return reply(404); }
      const privateRoot = fs.realpathSync(path.join(root, 'private')) + path.sep;
      if (!real.startsWith(privateRoot)) return reply(403);
      const stat = fs.statSync(real);
      if (!stat.isFile()) return reply(404);
      const mime = { '.pdf': 'application/pdf', '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.webp': 'image/webp' }[path.extname(real).toLowerCase()] || 'application/octet-stream';
      res.writeHead(200, { 'Content-Type': mime, 'Content-Length': stat.size, 'Cache-Control': 'private, no-store', 'X-Content-Type-Options': 'nosniff', 'Content-Security-Policy': "sandbox; default-src 'none'" });
      if (req.method === 'HEAD') return res.end();
      fs.createReadStream(real).on('error', () => res.destroy()).pipe(res);
    } catch { reply(503); }
  };
}
module.exports = { createPrivateHandler, mayRead, actorFor };
