import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';

const root = path.resolve('artifacts/gsa-tv/painel-audicao-vozes-2026-09-05');
const types = { '.html': 'text/html; charset=utf-8', '.mp3': 'audio/mpeg', '.json': 'application/json; charset=utf-8' };

http.createServer((request, response) => {
  const requested = decodeURIComponent(new URL(request.url, 'http://127.0.0.1').pathname);
  const relative = requested === '/' ? 'PAINEL_AUDICAO.html' : requested.slice(1);
  const file = path.resolve(root, relative);
  if (!file.startsWith(root + path.sep) && file !== path.join(root, 'PAINEL_AUDICAO.html')) {
    response.writeHead(403).end('Forbidden');
    return;
  }
  fs.readFile(file, (error, data) => {
    if (error) { response.writeHead(404).end('Not found'); return; }
    response.writeHead(200, { 'Content-Type': types[path.extname(file)] || 'application/octet-stream' });
    response.end(data);
  });
}).listen(8765, '127.0.0.1', () => console.log('Painel disponível em http://127.0.0.1:8765/'));
