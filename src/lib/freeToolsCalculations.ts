export type TerminationReason = 'without_cause' | 'agreement' | 'resignation' | 'just_cause';
export type RetirementGender = 'woman' | 'man';

function positiveNumber(value: number) {
  return Number.isFinite(value) ? Math.max(0, value) : 0;
}

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, positiveNumber(value)));
}

export interface TerminationEstimateInput {
  salary: number;
  reason: TerminationReason;
  daysWorked: number;
  thirteenthMonths: number;
  vacationMonths: number;
  expiredVacation: boolean;
  completedYears: number;
  fgtsBalance: number;
}

export function calculateTerminationEstimate(input: TerminationEstimateInput) {
  const baseSalary = positiveNumber(input.salary);
  const days = clamp(input.daysWorked, 0, 30);
  const thirteenth = clamp(input.thirteenthMonths, 0, 12);
  const vacation = clamp(input.vacationMonths, 0, 12);
  const years = clamp(Math.floor(input.completedYears), 0, 20);
  const isJustCause = input.reason === 'just_cause';
  const noticeDays = Math.min(90, 30 + (years * 3));
  const noticeFactor = input.reason === 'without_cause' ? 1 : input.reason === 'agreement' ? 0.5 : 0;
  const salaryBalance = (baseSalary / 30) * days;
  const notice = (baseSalary / 30) * noticeDays * noticeFactor;
  const thirteenthValue = isJustCause ? 0 : (baseSalary / 12) * thirteenth;
  const proportionalVacation = isJustCause ? 0 : ((baseSalary / 12) * vacation) * (4 / 3);
  const expiredVacationValue = input.expiredVacation ? baseSalary * (4 / 3) : 0;
  const fgtsPenaltyRate = input.reason === 'without_cause' ? 0.4 : input.reason === 'agreement' ? 0.2 : 0;
  const fgtsPenalty = positiveNumber(input.fgtsBalance) * fgtsPenaltyRate;
  const total = salaryBalance + notice + thirteenthValue + proportionalVacation + expiredVacationValue + fgtsPenalty;

  return {
    salaryBalance,
    notice,
    noticeDays,
    thirteenthValue,
    proportionalVacation,
    expiredVacationValue,
    fgtsPenalty,
    total,
  };
}

export interface Retirement2026Input {
  gender: RetirementGender;
  age: number;
  contributionYears: number;
  contributedBeforeReform: boolean;
}

export function evaluateRetirement2026(input: Retirement2026Input) {
  const currentAge = clamp(input.age, 0, 100);
  const contributionYears = clamp(input.contributionYears, 0, 60);
  const isWoman = input.gender === 'woman';
  const generalAge = isWoman ? 62 : 65;
  const generalContribution = isWoman ? 15 : input.contributedBeforeReform ? 15 : 20;
  const transitionContribution = isWoman ? 30 : 35;
  const transitionPoints = isWoman ? 93 : 103;
  const progressiveAge = isWoman ? 59.5 : 64.5;
  const points = currentAge + contributionYears;
  const generalEligible = currentAge >= generalAge && contributionYears >= generalContribution;
  const pointsEligible = input.contributedBeforeReform && contributionYears >= transitionContribution && points >= transitionPoints;
  const progressiveEligible = input.contributedBeforeReform && contributionYears >= transitionContribution && currentAge >= progressiveAge;

  return {
    currentAge,
    contributionYears,
    points,
    generalAge,
    generalContribution,
    transitionContribution,
    transitionPoints,
    progressiveAge,
    generalEligible,
    pointsEligible,
    progressiveEligible,
    anyEligible: generalEligible || pointsEligible || progressiveEligible,
  };
}

export function calculateVacationEstimate(salary: number, variableAverages: number) {
  const remuneration = positiveNumber(salary) + positiveNumber(variableAverages);
  const constitutionalThird = remuneration / 3;
  return { remuneration, constitutionalThird, total: remuneration + constitutionalThird };
}
