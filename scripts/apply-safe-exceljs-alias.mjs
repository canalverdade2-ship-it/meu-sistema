import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { execFileSync, spawnSync } from 'node:child_process';

const BRANCH = 'audit/full-system-remediation-20260727';
const SCRIPT_PATH = 'scripts/apply-safe-exceljs-alias.mjs';
const PACKAGE_PATH = 'package.json';
const MARKER_PATH = 'audit-control/validate-cors-campaign.txt';
const REPORT_PATH = 'audit-control/npm-audit-exceljs-alias.json';
const SAFE_ALIAS = 'exceljs@npm:@protobi/exceljs@4.4.0-protobi.9';

if (process.env.GITHUB_ACTIONS !== 'true' || process.env.GITHUB_HEAD_REF !== BRANCH) {
  console.log('[exceljs-alias] Fora do PR de auditoria; nenhuma escrita realizada.');
  process.exit(0);
}

const git = (...args) => execFileSync('git', args, { stdio: 'inherit' });
git('fetch', 'origin', BRANCH);
git('checkout', '-B', BRANCH, `origin/${BRANCH}`);

execFileSync('npm', ['install', SAFE_ALIAS, '--save', '--ignore-scripts'], { stdio: 'inherit' });

const audit = spawnSync('npm', ['audit', '--audit-level=high', '--json'], {
  encoding: 'utf8',
  maxBuffer: 30 * 1024 * 1024,
});
let auditPayload;
try {
  auditPayload = JSON.parse(audit.stdout || '{}');
} catch {
  auditPayload = {
    parse_error: true,
    exit_code: audit.status,
    stdout: audit.stdout || '',
    stderr: audit.stderr || '',
  };
}
mkdirSync('audit-control', { recursive: true });
writeFileSync(REPORT_PATH, `${JSON.stringify({
  validated_at: new Date().toISOString(),
  package_alias: SAFE_ALIAS,
  audit_exit_code: audit.status,
  result: auditPayload,
}, null, 2)}\n`, 'utf8');

const packageJson = JSON.parse(readFileSync(PACKAGE_PATH, 'utf8'));
packageJson.scripts.lint = 'tsc --noEmit && node scripts/audit-production-real.mjs --enforce';
writeFileSync(PACKAGE_PATH, `${JSON.stringify(packageJson, null, 2)}\n`, 'utf8');

if (existsSync(MARKER_PATH)) rmSync(MARKER_PATH);
if (existsSync(SCRIPT_PATH)) rmSync(SCRIPT_PATH);

git('diff', '--check');
git('config', 'user.name', 'github-actions[bot]');
git('config', 'user.email', '41898282+github-actions[bot]@users.noreply.github.com');
git('add', PACKAGE_PATH, 'package-lock.json', REPORT_PATH, MARKER_PATH, SCRIPT_PATH);

try {
  execFileSync('git', ['diff', '--cached', '--quiet']);
  console.log('[exceljs-alias] Alias seguro já incorporado.');
  process.exit(0);
} catch {
  // Há alterações staged.
}

git('commit', '-m', 'fix(security): restaurar Excel institucional com pacote compatível seguro');
git('reset', '--hard', 'HEAD');

for (let attempt = 1; attempt <= 5; attempt += 1) {
  try {
    git('fetch', 'origin', BRANCH);
    git('rebase', `origin/${BRANCH}`);
    git('push', 'origin', `HEAD:${BRANCH}`);
    console.log('[exceljs-alias] Alias e evidência persistidos.');
    process.exit(0);
  } catch (error) {
    console.error(`[exceljs-alias] Tentativa ${attempt} de 5 não concluiu o push.`);
    try { git('rebase', '--abort'); } catch { /* sem rebase ativo */ }
    if (attempt === 5) throw error;
  }
}
