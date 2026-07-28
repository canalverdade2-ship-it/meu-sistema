import { existsSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';

const BRANCH = 'audit/full-system-remediation-20260727';
const SCRIPT_PATH = 'scripts/apply-checkout-contract-fix.mjs';
const CHECKOUT_PATH = 'src/components/client/store/CheckoutModal.tsx';
const PACKAGE_PATH = 'package.json';

if (process.env.GITHUB_ACTIONS !== 'true' || process.env.GITHUB_HEAD_REF !== BRANCH) {
  console.log('[checkout-contract-fix] Execucao local ou fora do PR de auditoria; nenhuma escrita realizada.');
  process.exit(0);
}

const git = (...args) => execFileSync('git', args, { stdio: 'inherit' });

git('fetch', 'origin', BRANCH);
git('checkout', '-B', BRANCH, `origin/${BRANCH}`);

const checkout = readFileSync(CHECKOUT_PATH, 'utf8');
const oldMessage = 'Não foi possível validar os produtos antes da compra: ${productValidationError.message}';
const newMessage = 'Não foi possível validar preços e estoque antes da compra: ${productValidationError.message}';

let nextCheckout = checkout;
if (!checkout.includes(newMessage)) {
  if (!checkout.includes(oldMessage)) {
    throw new Error('[checkout-contract-fix] Ponto de validação do checkout não encontrado.');
  }
  nextCheckout = checkout.replace(oldMessage, newMessage);
  writeFileSync(CHECKOUT_PATH, nextCheckout, 'utf8');
}

const packageJson = JSON.parse(readFileSync(PACKAGE_PATH, 'utf8'));
packageJson.scripts.lint = 'tsc --noEmit && node scripts/audit-production-real.mjs --enforce';
writeFileSync(PACKAGE_PATH, `${JSON.stringify(packageJson, null, 2)}\n`, 'utf8');

if (existsSync(SCRIPT_PATH)) rmSync(SCRIPT_PATH);

git('diff', '--check');
git('config', 'user.name', 'github-actions[bot]');
git('config', 'user.email', '41898282+github-actions[bot]@users.noreply.github.com');
git('add', CHECKOUT_PATH, PACKAGE_PATH, SCRIPT_PATH);

try {
  execFileSync('git', ['diff', '--cached', '--quiet']);
  console.log('[checkout-contract-fix] Correção já incorporada na branch.');
  process.exit(0);
} catch {
  // Há alterações staged.
}

git('commit', '-m', 'fix(store): comunicar falha na validação de preços e estoque');

for (let attempt = 1; attempt <= 5; attempt += 1) {
  try {
    git('fetch', 'origin', BRANCH);
    git('rebase', `origin/${BRANCH}`);
    git('push', 'origin', `HEAD:${BRANCH}`);
    console.log('[checkout-contract-fix] Correção persistida com sucesso.');
    process.exit(0);
  } catch (error) {
    console.error(`[checkout-contract-fix] Tentativa ${attempt} de 5 não concluiu o push.`);
    try { git('rebase', '--abort'); } catch { /* sem rebase ativo */ }
    if (attempt === 5) throw error;
  }
}
