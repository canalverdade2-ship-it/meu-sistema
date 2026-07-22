import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  calculateTerminationEstimate,
  calculateVacationEstimate,
  evaluateRetirement2026,
} from '../src/lib/freeToolsCalculations';
import { matchRoute } from '../src/routing/routeMatcher';

const closeTo = (actual: number, expected: number) => assert.ok(Math.abs(actual - expected) < 0.001, `${actual} deve ser aproximadamente ${expected}`);

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

const page = readFileSync('src/components/public/FreeToolsPage.tsx', 'utf8');
assert.match(page, /estimativas educativas/i);
assert.match(page, /não são armazenados pela GSA/i);
assert.match(page, /Conferir no Meu INSS/i);

console.log('Contratos e cálculos dos serviços gratuitos validados com sucesso.');
