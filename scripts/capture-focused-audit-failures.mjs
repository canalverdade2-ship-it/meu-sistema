import { existsSync, mkdirSync, readFileSync, readdirSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { execFileSync, spawnSync } from 'node:child_process';
import { join } from 'node:path';

const BRANCH = 'audit/full-system-remediation-20260727';
const SCRIPT_PATH = 'scripts/capture-focused-audit-failures.mjs';
const PACKAGE_PATH = 'package.json';
const REPORT_PATH = 'audit-control/focused-failures.json';

if (process.env.GITHUB_ACTIONS !== 'true' || process.env.GITHUB_HEAD_REF !== BRANCH) {
  console.log('[focused-audit] Fora do PR de auditoria; nenhuma escrita realizada.');
  process.exit(0);
}

const git = (...args) => execFileSync('git', args, { stdio: 'inherit' });
git('fetch', 'origin', BRANCH);
git('checkout', '-B', BRANCH, `origin/${BRANCH}`);

function run(command, args, env = {}) {
  const result = spawnSync(command, args, {
    encoding: 'utf8',
    env: { ...process.env, ...env },
    maxBuffer: 30 * 1024 * 1024,
  });
  return {
    command: [command, ...args].join(' '),
    status: result.status,
    signal: result.signal,
    stdout: result.stdout || '',
    stderr: result.stderr || '',
    error: result.error ? String(result.error.stack || result.error) : null,
  };
}

function collectTests(root) {
  const found = [];
  for (const entry of readdirSync(root)) {
    const path = join(root, entry);
    const stat = statSync(path);
    if (stat.isDirectory()) found.push(...collectTests(path));
    else if (/index_test\.ts$/.test(entry) && /(advertis|gsa-ad-)/i.test(path)) found.push(path.replaceAll('\\', '/'));
  }
  return found.sort();
}

const advertisingTests = collectTests('supabase/functions');
const report = {
  generated_at: new Date().toISOString(),
  site_campaign_contracts: run('npx', ['tsx', 'scripts/check-site-campaign-contracts.ts']),
  site_campaign_runtime: run('node', ['scripts/check-site-campaign-migrations-runtime.cjs'], {
    PGHOST: process.env.PGHOST || '127.0.0.1',
    PGPORT: process.env.PGPORT || '5432',
    PGUSER: process.env.PGUSER || 'postgres',
    PGPASSWORD: process.env.PGPASSWORD || 'postgres',
  }),
  advertising_test_files: advertisingTests,
  advertising_tests: advertisingTests.length
    ? run('deno', ['test', '-A', ...advertisingTests])
    : { command: null, status: null, stdout: '', stderr: 'Nenhum teste de publicidade encontrado.', error: null },
};
mkdirSync('audit-control', { recursive: true });
writeFileSync(REPORT_PATH, `${JSON.stringify(report, null, 2)}\n`, 'utf8');

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
  console.log('[focused-audit] Relatório já incorporado.');
  process.exit(0);
} catch {
  // Alterações staged.
}

git('commit', '-m', 'chore(audit): registrar falhas focadas de campanhas e anúncios');
for (let attempt = 1; attempt <= 5; attempt += 1) {
  try {
    git('fetch', 'origin', BRANCH);
    git('rebase', `origin/${BRANCH}`);
    git('push', 'origin', `HEAD:${BRANCH}`);
    console.log('[focused-audit] Relatório persistido.');
    process.exit(0);
  } catch (error) {
    console.error(`[focused-audit] Tentativa ${attempt} de 5 não concluiu o push.`);
    try { git('rebase', '--abort'); } catch { /* sem rebase ativo */ }
    if (attempt === 5) throw error;
  }
}
