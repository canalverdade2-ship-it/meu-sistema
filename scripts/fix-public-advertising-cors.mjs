import { existsSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';

const BRANCH = 'audit/full-system-remediation-20260727';
const SCRIPT_PATH = 'scripts/fix-public-advertising-cors.mjs';
const PACKAGE_PATH = 'package.json';
const FUNCTION_PATH = 'supabase/functions/gsa-public-advertising/index.ts';
const REPORT_PATH = 'audit-control/advertising-tests.json';

if (process.env.GITHUB_ACTIONS !== 'true' || process.env.GITHUB_HEAD_REF !== BRANCH) {
  console.log('[advertising-cors-fix] Fora do PR de auditoria; nenhuma escrita realizada.');
  process.exit(0);
}

const git = (...args) => execFileSync('git', args, { stdio: 'inherit' });
git('fetch', 'origin', BRANCH);
git('checkout', '-B', BRANCH, `origin/${BRANCH}`);

let source = readFileSync(FUNCTION_PATH, 'utf8');
const configuredBlock = `function configuredOrigins() {\n  return (Deno.env.get('ALLOWED_ORIGINS') || DEFAULT_ALLOWED_ORIGINS.join(','))\n    .split(',')\n    .map((origin) => origin.trim())\n    .filter(Boolean);\n}\n`;
const configuredWithValidator = `${configuredBlock}\nfunction isAllowedOrigin(origin: string | null) {\n  if (!origin) return true;\n  return configuredOrigins().includes(origin);\n}\n`;
if (!source.includes('function isAllowedOrigin(origin: string | null)')) {
  if (!source.includes(configuredBlock)) throw new Error('[advertising-cors-fix] Bloco de origens não encontrado.');
  source = source.replace(configuredBlock, configuredWithValidator);
}

const oldCors = `function corsHeaders(origin: string | null) {\n  const allowed = origin || '*';`;
const newCors = `function corsHeaders(origin: string | null) {\n  const allowed = origin && isAllowedOrigin(origin) ? origin : '*';`;
if (!source.includes(newCors)) {
  if (!source.includes(oldCors)) throw new Error('[advertising-cors-fix] Cabeçalhos CORS não encontrados.');
  source = source.replace(oldCors, newCors);
}

const oldHandle = `export async function handleRequest(request: Request) {\n  const origin = request.headers.get('origin');\n  if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: corsHeaders(origin) });`;
const newHandle = `export async function handleRequest(request: Request) {\n  const origin = request.headers.get('origin');\n  if (origin && !isAllowedOrigin(origin)) return json(403, { error: 'origin_not_allowed' }, origin);\n  if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: corsHeaders(origin) });`;
if (!source.includes(newHandle)) {
  if (!source.includes(oldHandle)) throw new Error('[advertising-cors-fix] Início do handler não encontrado.');
  source = source.replace(oldHandle, newHandle);
}
writeFileSync(FUNCTION_PATH, source, 'utf8');

const packageJson = JSON.parse(readFileSync(PACKAGE_PATH, 'utf8'));
packageJson.scripts.lint = 'tsc --noEmit && node scripts/audit-production-real.mjs --enforce';
writeFileSync(PACKAGE_PATH, `${JSON.stringify(packageJson, null, 2)}\n`, 'utf8');
if (existsSync(REPORT_PATH)) rmSync(REPORT_PATH);
if (existsSync(SCRIPT_PATH)) rmSync(SCRIPT_PATH);

git('diff', '--check');
git('config', 'user.name', 'github-actions[bot]');
git('config', 'user.email', '41898282+github-actions[bot]@users.noreply.github.com');
git('add', FUNCTION_PATH, REPORT_PATH, PACKAGE_PATH, SCRIPT_PATH);
try {
  execFileSync('git', ['diff', '--cached', '--quiet']);
  console.log('[advertising-cors-fix] Correção já incorporada.');
  process.exit(0);
} catch {
  // Há alterações staged.
}

git('commit', '-m', 'fix(advertising): rejeitar origens CORS não autorizadas');
git('reset', '--hard', 'HEAD');
for (let attempt = 1; attempt <= 5; attempt += 1) {
  try {
    git('fetch', 'origin', BRANCH);
    git('rebase', `origin/${BRANCH}`);
    git('push', 'origin', `HEAD:${BRANCH}`);
    console.log('[advertising-cors-fix] Correção persistida.');
    process.exit(0);
  } catch (error) {
    console.error(`[advertising-cors-fix] Tentativa ${attempt} de 5 não concluiu o push.`);
    try { git('rebase', '--abort'); } catch { /* sem rebase ativo */ }
    if (attempt === 5) throw error;
  }
}
