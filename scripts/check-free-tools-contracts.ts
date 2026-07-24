import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  calculateTerminationEstimate,
  calculateVacationEstimate,
  evaluateRetirement2026,
} from '../src/lib/freeToolsCalculations';
import { matchRoute } from '../src/routing/routeMatcher';

const closeTo = (actual: number, expected: number) => assert.ok(Math.abs(actual - expected) < 0.001, `${actual} deve ser aproximadamente ${expected}`);
const read = (path: string) => readFileSync(path, 'utf8');
const contains = (path: string, expressions: RegExp[]) => {
  const content = read(path);
  for (const expression of expressions) assert.match(content, expression, `${path}: contrato ausente: ${expression}`);
};

const termination = calculateTerminationEstimate({
  salary: 3000,
  reason: 'without_cause',
  daysWorked: 15,
  thirteenthMonths: 6,
  vacationMonths: 6,
  expiredVacation: false,
  completedYears: 2,
  fgtsBalance: 10000,
});
closeTo(termination.salaryBalance, 1500);
closeTo(termination.notice, 3600);
closeTo(termination.thirteenthValue, 1500);
closeTo(termination.proportionalVacation, 2000);
closeTo(termination.fgtsPenalty, 4000);
closeTo(termination.total, 12600);

const agreement = calculateTerminationEstimate({
  salary: 3000,
  reason: 'agreement',
  daysWorked: 15,
  thirteenthMonths: 6,
  vacationMonths: 6,
  expiredVacation: false,
  completedYears: 2,
  fgtsBalance: 10000,
});
closeTo(agreement.notice, 1800);
closeTo(agreement.fgtsPenalty, 2000);

assert.equal(evaluateRetirement2026({ gender: 'woman', age: 60, contributionYears: 33, contributedBeforeReform: true }).pointsEligible, true);
assert.equal(evaluateRetirement2026({ gender: 'woman', age: 60, contributionYears: 33, contributedBeforeReform: true }).progressiveEligible, true);
assert.equal(evaluateRetirement2026({ gender: 'man', age: 65, contributionYears: 19, contributedBeforeReform: false }).generalEligible, false);
assert.equal(evaluateRetirement2026({ gender: 'man', age: 65, contributionYears: 20, contributedBeforeReform: false }).generalEligible, true);

const vacation = calculateVacationEstimate(3000, 300);
closeTo(vacation.remuneration, 3300);
closeTo(vacation.constitutionalThird, 1100);
closeTo(vacation.total, 4400);

const route = matchRoute('/servicos-gratuitos', '', '');
assert.equal(route.area, 'public');
assert.equal(route.module, 'free-tools');

contains('src/components/public/FreeToolsPage.tsx', [
  /FreeToolsTieredCalculatorDialog/,
  /Free simples · Pro avançado/i,
  /pagamento e voucher Pro também podem ser usados sem cadastro/i,
  /não são armazenados pela GSA/i,
]);

contains('src/components/public/FreeToolsTieredCalculatorDialog.tsx', [
  /FreeToolsSimpleCalculator/,
  /FreeToolsAdvancedCalculator/,
  /FreeToolsProUnlockDialog/,
  /freeToolsProAccess\.activate/,
  /readInfinitePayReturn/,
]);

contains('src/components/public/FreeToolsSimpleCalculators.tsx', [
  /Modo Free · consulta básica/i,
  /Regra geral/i,
  /Saldo de salário estimado/i,
]);

contains('src/components/public/FreeToolsAdvancedCalculators.tsx', [
  /Modo Pro · cálculo avançado/i,
  /Conferir no Meu INSS/i,
  /Memória avançada da rescisão/i,
]);

contains('src/components/public/FreeToolsProUnlockDialog.tsx', [
  /Pagar e desbloquear agora/i,
  /Voucher de uso único/i,
  /não exige cadastro/i,
  /cliente ativo, logado e com pelo menos uma fatura paga/i,
]);

contains('src/lib/freeToolsProAccess.ts', [
  /gsa-free-tools-pro/,
  /gsa_free_tools_visitor_token/,
  /verify_payment/,
]);

contains('supabase/functions/gsa-free-tools-pro/index.ts', [
  /https:\/\/api\.checkout\.infinitepay\.io\/links/,
  /https:\/\/api\.checkout\.infinitepay\.io\/payment_check/,
  /client_paid_invoice/,
  /redeem_voucher/,
  /create_checkout/,
  /verify_payment/,
]);

contains('supabase/functions/gsa-free-tools-pro-webhook/index.ts', [
  /payment_check/,
  /gsa_calculator_finalize_payment_internal/,
  /EdgeRuntime/,
]);

contains('supabase/migrations/20260723233000_free_tools_pro_access.sql', [
  /gsa_calculator_pro_products/,
  /gsa_calculator_pro_payments/,
  /gsa_calculator_pro_vouchers/,
  /gsa_calculator_pro_grants/,
  /gsa_calculator_pro_sessions/,
  /gsa_admin_calculator_pro_snapshot/,
  /gsa_admin_create_calculator_pro_voucher/,
  /gsa_admin_grant_calculator_pro/,
  /gsa_calculator_finalize_payment_internal/,
]);

contains('src/components/admin/CalculatorProAdminPanel.tsx', [
  /Calculadoras Pro/,
  /Preço do acesso/,
  /Gerar voucher/,
  /Liberação manual para cliente/,
  /Pagamentos InfinitePay/,
]);

console.log('Contratos Free, Pro, vouchers, gestão e InfinitePay validados com sucesso.');
