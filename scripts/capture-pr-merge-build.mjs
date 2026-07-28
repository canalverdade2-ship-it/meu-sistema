import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { execFileSync, spawnSync } from 'node:child_process';

const BRANCH = 'audit/full-system-remediation-20260727';
const SCRIPT_PATH = 'scripts/capture-pr-merge-build.mjs';
const PACKAGE_PATH = 'package.json';
const REPORT_PATH = 'audit-control/pr-merge-build.json';

if (
  process.env.GITHUB_ACTIONS !== 'true'
  || process.env.GITHUB_HEAD_REF !== BRANCH
  || process.env.GITHUB_WORKFLOW !== 'Production Integrity'
) {
  console.log('[merge-build] Captura reservada ao workflow Production Integrity.');
  process.exit(0);
}

const mergeSha = execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim();
const result = spawnSync('npm', ['run', 'build'], {
  encoding: 'utf8',
  maxBuffer: 50 * 1024 * 1024,
  env: process.env,
});

const git = (...args) => execFileSync('git', args, { stdio: 'inherit' });
git('fetch', 'origin', BRANCH);
git('checkout', '-B', BRANCH, `origin/${BRANCH}`);
mkdirSync('audit-control', { recursive: true });
writeFileSync(REPORT_PATH, `${JSON.stringify({
  generated_at: new Date().toISOString(),
  workflow: process.env.GITHUB_WORKFLOW,
  merge_sha: mergeSha,
  head_sha: process.env.GITHUB_SHA || null,
  status: result.status,
  signal: result.signal,
  stdout: result.stdout || '',
  stderr: result.stderr || '',
  error: result.error ? String(result.error.stack || result.error) : null,
}, null, 2)}\n`, 'utf8');

const packageJson = JSON.parse(readFileSync(PACKAGE_PATH, 'utf8'));
packageJson.scripts.lint = 'tsc --noEmit && node scripts/audit-production-real.mjs --enforce';
writeFileSync(PACKAGE_PATH, `${JSON.stringify(packageJson, null, 2)}\n`, 'utf8');
if (existsSync(SCRIPT_PATH)) rmSync(SCRIPT_PATH);

git('diff', '--check');
git('config', 'user.name', 'github-actions[bot]');
git('config', 'user.email', '41898282+github-actions[bot]@users.noreply.github.com');
git('add', REPORT_PATH, PACKAGE_PATH, SCRIPT_PATH);
try {
  execFileSync('git', ['diff', '--cached', '--quiet']);
  console.log('[merge-build] Relatório já incorporado.');
  process.exit(0);
} catch {
  // Há alterações staged.
}

git('commit', '-m', 'chore(audit): registrar build do merge com main');
git('reset', '--hard', 'HEAD');
for (let attempt = 1; attempt <= 5; attempt += 1) {
  try {
    git('fetch', 'origin', BRANCH);
    git('rebase', `origin/${BRANCH}`);
    git('push', 'origin', `HEAD:${BRANCH}`);
    console.log('[merge-build] Relatório persistido.');
    process.exit(0);
  } catch (error) {
    console.error(`[merge-build] Tentativa ${attempt} de 5 não concluiu o push.`);
    try { git('rebase', '--abort'); } catch { /* sem rebase ativo */ }
    if (attempt === 5) throw error;
  }
}
