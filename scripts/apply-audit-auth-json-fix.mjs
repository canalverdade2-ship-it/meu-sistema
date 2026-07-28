import { readFileSync, writeFileSync } from 'node:fs';

const path = 'supabase/functions/gsa-auth-session/index.ts';
const source = readFileSync(path, 'utf8');
const before = `        return json(\n          denied ? 400 : 500,\n          { error: denied ? 'invalid_or_expired_challenge' : 'identity_completion_failed' },\n          allowedOrigin,\n        );`;
const after = `        return json(\n          { error: denied ? 'invalid_or_expired_challenge' : 'identity_completion_failed' },\n          denied ? 400 : 500,\n          allowedOrigin,\n        );`;

if (source.includes(after)) {
  console.log('Correção da resposta de autenticação já aplicada.');
  process.exit(0);
}

if (!source.includes(before)) {
  throw new Error('Chamada invertida de json não encontrada na Edge Function.');
}

writeFileSync(path, source.replace(before, after), 'utf8');
console.log('Ordem body/status da resposta de autenticação corrigida.');
