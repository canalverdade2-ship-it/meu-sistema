import fs from 'node:fs';
const root = String.raw`C:\Users\Adriano Farias\Downloads\remix-9.10_-grupo-gsa---gestão-de-serviços - Copia (4)\supabase\functions`;
const origins = "['http://10.0.2.189:3000', 'http://localhost:3000', 'http://127.0.0.1:3000', 'http://localhost:5173', 'http://127.0.0.1:5173', 'https://gsahub.pages.dev', 'https://gsa-hub.pages.dev', 'https://sistema.grupogsaservicos.com.br', 'https://grupo-gsa.com.br', 'https://www.grupo-gsa.com.br']";
for (const rel of ['gsa-ads-public/index.ts','gsa-ads-admin/index.ts']) {
  const p = `${root}\\${rel.replaceAll('/', '\\')}`;
  let s = fs.readFileSync(p,'utf8').replace(/\r\n/g,'\n');
  s = s.replace(/const DEFAULT_ALLOWED_ORIGINS = \[[^\n]+\];/, `const DEFAULT_ALLOWED_ORIGINS = ${origins};`);
  fs.writeFileSync(p,s,'utf8');
  console.log(rel);
}
