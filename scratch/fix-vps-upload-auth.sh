set -e
node <<'JS'
const fs = require('fs');
const file = '/home/opc/gsa-upload-service/server.cjs';
let source = fs.readFileSync(file, 'utf8');
const start = source.indexOf('function validateAuth(req) {');
const end = source.indexOf('\nconst server =', start);
if (start < 0 || end < 0 || !source.includes("if (url.pathname === '/delete' && req.method === 'DELETE') {")) throw Error('Unexpected source');
fs.copyFileSync(file, file + '.before-auth-fix-20260913', fs.constants.COPYFILE_EXCL);
const auth = `async function validateAuth(req) {
  const auth = String(req.headers['authorization'] || '');
  const sessId = String(req.headers['x-gsa-session-id'] || '');
  const sessToken = String(req.headers['x-gsa-session-token'] || '');
  if (sessId && sessToken && /^[0-9a-f-]{36}$/i.test(sessId)) {
    try {
      const valid = psql(\`SELECT is_valid FROM public.gsa_validate_session('\${sessId.replace(/'/g, "''")}', '\${sessToken.replace(/'/g, "''")}');\`);
      if (valid === 't' || valid === 'true') return true;
    } catch { /* Try a verified JWT, otherwise deny. */ }
  }
  if (auth.startsWith('Bearer ') && auth.slice(7).trim()) {
    try {
      const response = await fetch('http://127.0.0.1:9999/user', {
        headers: { Authorization: auth },
        signal: AbortSignal.timeout(5000),
      });
      if (!response.ok) return false;
      const user = await response.json();
      return typeof user.id === 'string' && user.id.length > 0;
    } catch { return false; }
  }
  return false;
}
`;
source = source.slice(0,start) + auth + source.slice(end);
source = source.replace('http.createServer((req, res) => {','http.createServer(async (req, res) => {');
source = source.replace('if (!validateAuth(req)) {','if (!(await validateAuth(req))) {');
source = source.replace("if (url.pathname === '/delete' && req.method === 'DELETE') {", `if (url.pathname === '/delete' && req.method === 'DELETE') {
    if (!(await validateAuth(req))) {
      res.writeHead(401, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ success: false, error: 'Sessão inválida.' }));
      return;
    }`);
fs.writeFileSync(file,source);
JS
node --check /home/opc/gsa-upload-service/server.cjs
pm2 restart gsa-upload >/dev/null
