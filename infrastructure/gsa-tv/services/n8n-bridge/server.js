const http = require('node:http');

const LISTEN_HOST = process.env.LISTEN_HOST || '172.30.250.1';
const PORT = Number(process.env.PORT || 19202);
const ALLOWED_CLIENT = process.env.ALLOWED_CLIENT || '172.30.250.2';
const TARGET = process.env.CONTROL_PLANE_URL || 'http://127.0.0.1:9202';
const INTERNAL_API_TOKEN = String(process.env.INTERNAL_API_TOKEN || '').trim();

if (INTERNAL_API_TOKEN.length < 32) {
  throw new Error('INTERNAL_API_TOKEN ausente ou inválido.');
}

function remoteIp(req) {
  return String(req.socket.remoteAddress || '').replace(/^::ffff:/, '');
}

function allowedRoute(method, pathname) {
  if (method === 'GET' && pathname === '/automation/snapshot') return true;
  if (method === 'POST' && ['/automation/jobs', '/automation/report'].includes(pathname)) return true;
  return method === 'POST' && /^\/automation\/ai\/projects\/[0-9a-f-]{36}\/run$/i.test(pathname);
}
async function readBody(req) {
  const chunks = [];
  let size = 0;
  for await (const chunk of req) {
    size += chunk.length;
    if (size > 128 * 1024) throw Object.assign(new Error('Payload grande demais.'), { statusCode: 413 });
    chunks.push(chunk);
  }
  return Buffer.concat(chunks);
}

function send(res, status, body, contentType = 'application/json') {
  res.writeHead(status, {
    'content-type': contentType,
    'cache-control': 'no-store',
  });
  res.end(body);
}

const server = http.createServer(async (req, res) => {
  if (req.method === 'GET' && req.url === '/health') {
    return send(res, 200, JSON.stringify({ status: 'ok', service: 'gsa-tv-n8n-bridge' }));
  }
  try {
    if (remoteIp(req) !== ALLOWED_CLIENT) return send(res, 403, JSON.stringify({ error: 'Origem não autorizada.' }));
    const url = new URL(req.url, `http://${LISTEN_HOST}:${PORT}`);
    if (!allowedRoute(req.method, url.pathname)) return send(res, 404, JSON.stringify({ error: 'Rota não disponível.' }));
    const body = await readBody(req);
    const upstream = await fetch(`${TARGET}${url.pathname}${url.search}`, {
      method: req.method,
      headers: {
        authorization: `Bearer ${INTERNAL_API_TOKEN}`,
        ...(body.length ? { 'content-type': req.headers['content-type'] || 'application/json' } : {}),
      },
      body: body.length ? body : undefined,
      signal: AbortSignal.timeout(30000),
    });
    const responseBody = Buffer.from(await upstream.arrayBuffer());
    return send(res, upstream.status, responseBody, upstream.headers.get('content-type') || 'application/json');
  } catch (error) {
    return send(res, error.statusCode || 502, JSON.stringify({ error: error.message || 'Falha na ponte de automação.' }));
  }
});

server.listen(PORT, LISTEN_HOST, () => {
  console.log(JSON.stringify({ level: 'info', event: 'n8n_bridge_started', host: LISTEN_HOST, port: PORT, allowed_client: ALLOWED_CLIENT }));
});
