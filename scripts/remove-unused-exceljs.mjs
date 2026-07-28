import { existsSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';

const BRANCH = 'audit/full-system-remediation-20260727';
const SCRIPT_PATH = 'scripts/remove-unused-exceljs.mjs';
const PACKAGE_PATH = 'package.json';
const AUDIT_PATH = 'audit-control/npm-audit.json';

if (process.env.GITHUB_ACTIONS !== 'true' || process.env.GITHUB_HEAD_REF !== BRANCH) {
  console.log('[exceljs-removal] Fora do PR de auditoria; nenhuma escrita realizada.');
  process.exit(0);
}

const git = (...args) => execFileSync('git', args, { stdio: 'inherit' });
git('fetch', 'origin', BRANCH);
git('checkout', '-B', BRANCH, `origin/${BRANCH}`);

execFileSync('npm', ['uninstall', 'exceljs', '--ignore-scripts'], { stdio: 'inherit' });

const packageJson = JSON.parse(readFileSync(PACKAGE_PATH, 'utf8'));
packageJson.scripts.lint = 'tsc --noEmit && node scripts/audit-production-real.mjs --enforce';
writeFileSync(PACKAGE_PATH, `${JSON.stringify(packageJson, null, 2)}\n`, 'utf8');

if (existsSync(AUDIT_PATH)) rmSync(AUDIT_PATH);
if (existsSync(SCRIPT_PATH)) rmSync(SCRIPT_PATH);

git('diff', '--check');
git('config', 'user.name', 'github-actions[bot]');
git('config', 'user.email', '41898282+github-actions[bot]@users.noreply.github.com');
git('add', PACKAGE_PATH, 'package-lock.json', AUDIT_PATH, SCRIPT_PATH);

try {
  execFileSync('git', ['diff', '--cached', '--quiet']);
  console.log('[exceljs-removal] Dependência já removida.');
  process.exit(0);
} catch {
  // Há alterações staged.
}

git('commit', '-m', 'fix(security): remover dependência ExcelJS vulnerável e não utilizada');

for (let attempt = 1; attempt <= 5; attempt += 1) {
  try {
    git('fetch', 'origin', BRANCH);
    git('rebase', `origin/${BRANCH}`);
    git('push', 'origin', `HEAD:${BRANCH}`);
    console.log('[exceljs-removal] Remoção persistida com sucesso.');
    process.exit(0);
  } catch (error) {
    console.error(`[exceljs-removal] Tentativa ${attempt} de 5 não concluiu o push.`);
    try { git('rebase', '--abort'); } catch { /* sem rebase ativo */ }
    if (attempt === 5) throw error;
  }
}
