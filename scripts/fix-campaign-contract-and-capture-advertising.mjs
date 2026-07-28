import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { execFileSync, spawnSync } from 'node:child_process';

const BRANCH = 'audit/full-system-remediation-20260727';
const SCRIPT_PATH = 'scripts/fix-campaign-contract-and-capture-advertising.mjs';
const PACKAGE_PATH = 'package.json';
const CAMPAIGN_CONTRACT_PATH = 'scripts/check-site-campaign-contracts.ts';
const OLD_REPORT = 'audit-control/focused-failures.json';
const REPORT_PATH = 'audit-control/advertising-tests.json';
const TESTS = [
  'supabase/functions/gsa-ad-delivery/index_test.ts',
  'supabase/functions/gsa-advertiser-admin/index_test.ts',
  'supabase/functions/gsa-advertising-scheduler/index_test.ts',
  'supabase/functions/gsa-advertising-webhook/index_test.ts',
  'supabase/functions/gsa-public-advertising/index_test.ts',
];

if (process.env.GITHUB_ACTIONS !== 'true' || process.env.GITHUB_HEAD_REF !== BRANCH) {
  console.log('[focused-fix] Fora do PR de auditoria; nenhuma escrita realizada.');
  process.exit(0);
}

const git = (...args) => execFileSync('git', args, { stdio: 'inherit' });
git('fetch', 'origin', BRANCH);
git('checkout', '-B', BRANCH, `origin/${BRANCH}`);

let contractSource = readFileSync(CAMPAIGN_CONTRACT_PATH, 'utf8');
const oldToken = `  "import { SiteCampaignAdminPage } from '../components/admin/SiteCampaignAdminPage';",`;
const lazyToken = `  "const SiteCampaignAdminPage = lazy(() => import('../components/admin/SiteCampaignAdminPage')",`;
if (!contractSource.includes(lazyToken)) {
  if (!contractSource.includes(oldToken)) {
    throw new Error('[focused-fix] Contrato antigo da página de campanhas não encontrado.');
  }
  contractSource = contractSource.replace(oldToken, lazyToken);
  writeFileSync(CAMPAIGN_CONTRACT_PATH, contractSource, 'utf8');
}

const result = spawnSync('npx', ['-y', 'deno', 'test', '-A', ...TESTS], {
  encoding: 'utf8',
  maxBuffer: 30 * 1024 * 1024,
  env: process.env,
});
mkdirSync('audit-control', { recursive: true });
writeFileSync(REPORT_PATH, `${JSON.stringify({
  generated_at: new Date().toISOString(),
  command: ['npx', '-y', 'deno', 'test', '-A', ...TESTS].join(' '),
  status: result.status,
  signal: result.signal,
  stdout: result.stdout || '',
  stderr: result.stderr || '',
  error: result.error ? String(result.error.stack || result.error) : null,
}, null, 2)}\n`, 'utf8');

const packageJson = JSON.parse(readFileSync(PACKAGE_PATH, 'utf8'));
packageJson.scripts.lint = 'tsc --noEmit && node scripts/audit-production-real.mjs --enforce';
writeFileSync(PACKAGE_PATH, `${JSON.stringify(packageJson, null, 2)}\n`, 'utf8');
if (existsSync(OLD_REPORT)) rmSync(OLD_REPORT);
if (existsSync(SCRIPT_PATH)) rmSync(SCRIPT_PATH);

git('diff', '--check');
git('config', 'user.name', 'github-actions[bot]');
git('config', 'user.email', '41898282+github-actions[bot]@users.noreply.github.com');
git('add', CAMPAIGN_CONTRACT_PATH, REPORT_PATH, OLD_REPORT, PACKAGE_PATH, SCRIPT_PATH);

try {
  execFileSync('git', ['diff', '--cached', '--quiet']);
  console.log('[focused-fix] Alterações já incorporadas.');
  process.exit(0);
} catch {
  // Há alterações staged.
}

git('commit', '-m', 'fix(audit): alinhar contrato lazy e registrar testes de anúncios');
for (let attempt = 1; attempt <= 5; attempt += 1) {
  try {
    git('fetch', 'origin', BRANCH);
    git('rebase', `origin/${BRANCH}`);
    git('push', 'origin', `HEAD:${BRANCH}`);
    console.log('[focused-fix] Correção e relatório persistidos.');
    process.exit(0);
  } catch (error) {
    console.error(`[focused-fix] Tentativa ${attempt} de 5 não concluiu o push.`);
    try { git('rebase', '--abort'); } catch { /* sem rebase ativo */ }
    if (attempt === 5) throw error;
  }
}
