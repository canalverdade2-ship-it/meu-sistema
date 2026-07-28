import { existsSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { execFileSync, spawnSync } from 'node:child_process';

const BRANCH = 'audit/full-system-remediation-20260727';
const SCRIPT_PATH = 'scripts/apply-edge-fix-and-capture-audit.mjs';
const EDGE_PATH = 'supabase/functions/gsa-auth-session/index.ts';
const AUDIT_PATH = 'audit-control/npm-audit.json';
const PACKAGE_PATH = 'package.json';

if (process.env.GITHUB_ACTIONS !== 'true' || process.env.GITHUB_HEAD_REF !== BRANCH) {
  console.log('[edge-fix] Fora do PR de auditoria; nenhuma escrita realizada.');
  process.exit(0);
}

const git = (...args) => execFileSync('git', args, { stdio: 'inherit' });
git('fetch', 'origin', BRANCH);
git('checkout', '-B', BRANCH, `origin/${BRANCH}`);

let edgeSource = readFileSync(EDGE_PATH, 'utf8');
const oldBlock = `        return json(\n          denied ? 400 : 500,\n          { error: denied ? 'invalid_or_expired_challenge' : 'identity_completion_failed' },\n          allowedOrigin,\n        );`;
const newBlock = `        return json(\n          { error: denied ? 'invalid_or_expired_challenge' : 'identity_completion_failed' },\n          denied ? 400 : 500,\n          allowedOrigin,\n        );`;

if (!edgeSource.includes(newBlock)) {
  if (!edgeSource.includes(oldBlock)) {
    throw new Error('[edge-fix] Bloco de resposta da conclusão de identidade não encontrado.');
  }
  edgeSource = edgeSource.replace(oldBlock, newBlock);
  writeFileSync(EDGE_PATH, edgeSource, 'utf8');
}

const audit = spawnSync('npm', ['audit', '--json'], {
  encoding: 'utf8',
  maxBuffer: 20 * 1024 * 1024,
});
const auditRaw = audit.stdout?.trim() || audit.stderr?.trim() || '{}';
let auditPayload;
try {
  auditPayload = JSON.parse(auditRaw);
} catch {
  auditPayload = {
    parse_error: true,
    exit_code: audit.status,
    stdout: audit.stdout || '',
    stderr: audit.stderr || '',
  };
}
writeFileSync(AUDIT_PATH, `${JSON.stringify(auditPayload, null, 2)}\n`, 'utf8');

const packageJson = JSON.parse(readFileSync(PACKAGE_PATH, 'utf8'));
packageJson.scripts.lint = 'tsc --noEmit && node scripts/audit-production-real.mjs --enforce';
writeFileSync(PACKAGE_PATH, `${JSON.stringify(packageJson, null, 2)}\n`, 'utf8');
if (existsSync(SCRIPT_PATH)) rmSync(SCRIPT_PATH);

git('diff', '--check');
git('config', 'user.name', 'github-actions[bot]');
git('config', 'user.email', '41898282+github-actions[bot]@users.noreply.github.com');
git('add', EDGE_PATH, AUDIT_PATH, PACKAGE_PATH, SCRIPT_PATH);

try {
  execFileSync('git', ['diff', '--cached', '--quiet']);
  console.log('[edge-fix] Correção e relatório já incorporados.');
  process.exit(0);
} catch {
  // Alterações staged.
}

git('commit', '-m', 'fix(auth): corrigir resposta da Edge Function de sessão');

for (let attempt = 1; attempt <= 5; attempt += 1) {
  try {
    git('fetch', 'origin', BRANCH);
    git('rebase', `origin/${BRANCH}`);
    git('push', 'origin', `HEAD:${BRANCH}`);
    console.log('[edge-fix] Correção persistida e relatório do npm audit capturado.');
    process.exit(0);
  } catch (error) {
    console.error(`[edge-fix] Tentativa ${attempt} de 5 não concluiu o push.`);
    try { git('rebase', '--abort'); } catch { /* sem rebase ativo */ }
    if (attempt === 5) throw error;
  }
}
