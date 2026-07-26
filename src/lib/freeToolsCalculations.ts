export type TerminationReason = 'without_cause' | 'agreement' | 'resignation' | 'just_cause';
export type RetirementGender = 'woman' | 'man';
export type NoticeType = 'indemnified_employer' | 'worked_employer' | 'indemnified_employee' | 'waived';
export type InsalubrityLevel = 'none' | 'minimum_10' | 'medium_20' | 'maximum_40';

export const MINIMUM_WAGE_2026 = 1621;

function positiveNumber(value: number) {
  return Number.isFinite(value) ? Math.max(0, value) : 0;
}

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, positiveNumber(value)));
}

// ==========================================
// TABELAS OFICIAIS 2026 (INSS & IRRF)
// ==========================================

export interface InssBracket {
  limit: number;
  rate: number;
}

// Tabela progressiva do INSS 2026 (Estimada/Vigente com base no Salário Mínimo R$ 1.621)
export const INSS_BRACKETS_2026: InssBracket[] = [
  { limit: 1621.00, rate: 0.075 },
  { limit: 2792.16, rate: 0.09 },
  { limit: 4188.24, rate: 0.12 },
  { limit: 8157.41, rate: 0.14 }, // Teto INSS 2026 aproximado
];

// Tabela progressiva do IRRF 2026 (Com dedução por dependente de R$ 189,59)
export const IRRF_DEPENDENT_DEDUCTION_2026 = 189.59;
export const IRRF_SIMPLIFIED_DISCOUNT_2026 = 564.80; // Desconto simplificado opcional

export interface IrrfBracket {
  limit: number;
  rate: number;
  deduction: number;
}

export const IRRF_BRACKETS_2026: IrrfBracket[] = [
  { limit: 2259.20, rate: 0, deduction: 0 },
  { limit: 2826.65, rate: 0.075, deduction: 169.44 },
  { limit: 3751.05, rate: 0.15, deduction: 381.44 },
  { limit: 4664.68, rate: 0.225, deduction: 662.77 },
  { limit: Infinity, rate: 0.275, deduction: 896.00 },
];

/**
 * Calcula a contribuição previdenciária (INSS) progressiva.
 */
export function calculateInssDeduction(baseSalary: number): { inss: number; effectiveRate: number } {
  const base = positiveNumber(baseSalary);
  if (base <= 0) return { inss: 0, effectiveRate: 0 };

  let totalInss = 0;
  let previousLimit = 0;

  for (const bracket of INSS_BRACKETS_2026) {
    if (base > previousLimit) {
      const taxableChunk = Math.min(base, bracket.limit) - previousLimit;
      totalInss += taxableChunk * bracket.rate;
      previousLimit = bracket.limit;
    } else {
      break;
    }
  }

  const inss = Math.min(totalInss, 1050.00); // Teto de desconto aproximado
  const effectiveRate = base > 0 ? (inss / base) * 100 : 0;
  return { inss: roundCurrency(inss), effectiveRate: roundCurrency(effectiveRate) };
}

/**
 * Calcula o Imposto de Renda Retido na Fonte (IRRF).
 */
export function calculateIrrfDeduction(grossBase: number, inssDeduction: number, dependents = 0): { irrf: number; baseUsed: number } {
  const gross = positiveNumber(grossBase);
  const inss = positiveNumber(inssDeduction);
  const depDeduction = clamp(dependents, 0, 20) * IRRF_DEPENDENT_DEDUCTION_2026;

  // Opção 1: Dedução legal (INSS + Dependentes)
  const baseLegal = Math.max(0, gross - inss - depDeduction);
  // Opção 2: Desconto simplificado
  const baseSimplified = Math.max(0, gross - IRRF_SIMPLIFIED_DISCOUNT_2026);

  // Usa a base que for mais benéfica para o contribuinte (menor imposto)
  const baseUsed = Math.min(baseLegal, baseSimplified);

  let irrf = 0;
  for (const bracket of IRRF_BRACKETS_2026) {
    if (baseUsed <= bracket.limit) {
      irrf = (baseUsed * bracket.rate) - bracket.deduction;
      break;
    }
  }

  return { irrf: roundCurrency(Math.max(0, irrf)), baseUsed: roundCurrency(baseUsed) };
}

function roundCurrency(val: number): number {
  return Math.round(positiveNumber(val) * 100) / 100;
}

// ==========================================
// RESCISÃO TRABALHISTA CLT
// ==========================================

export interface TerminationEstimateInput {
  salary: number;
  reason: TerminationReason;
  daysWorked: number;
  thirteenthMonths: number;
  vacationMonths: number;
  expiredVacation: boolean;
  completedYears: number;
  fgtsBalance: number;
  insalubrity?: InsalubrityLevel;
  perilousness?: boolean;
  variableAverages?: number;
  noticeType?: NoticeType;
  dependents?: number;
}

export interface TerminationScenarioComparison {
  reason: TerminationReason;
  label: string;
  grossTotal: number;
  netTotal: number;
  fgtsPenalty: number;
  canWithdrawFgts: boolean;
  unemploymentInsuranceEligible: boolean;
}

export function calculateTerminationEstimate(input: TerminationEstimateInput) {
  const baseSalaryInput = positiveNumber(input.salary);
  const variableAverages = positiveNumber(input.variableAverages || 0);

  // Adicionais do Contrato
  let insalubrityBonus = 0;
  if (input.insalubrity === 'minimum_10') insalubrityBonus = MINIMUM_WAGE_2026 * 0.10;
  if (input.insalubrity === 'medium_20') insalubrityBonus = MINIMUM_WAGE_2026 * 0.20;
  if (input.insalubrity === 'maximum_40') insalubrityBonus = MINIMUM_WAGE_2026 * 0.40;

  const perilousnessBonus = input.perilousness ? baseSalaryInput * 0.30 : 0;
  const effectiveBaseSalary = baseSalaryInput + insalubrityBonus + perilousnessBonus + variableAverages;

  const days = clamp(input.daysWorked, 0, 30);
  const thirteenth = clamp(input.thirteenthMonths, 0, 12);
  const vacation = clamp(input.vacationMonths, 0, 12);
  const years = clamp(Math.floor(input.completedYears), 0, 40);
  const isJustCause = input.reason === 'just_cause';

  // Aviso prévio proporcional (Lei 12.506/2011: 30 dias + 3 dias por ano completo, máx 90)
  const noticeDays = Math.min(90, 30 + (years * 3));

  let noticeFactor = 0;
  if (input.reason === 'without_cause') noticeFactor = 1;
  else if (input.reason === 'agreement') noticeFactor = 0.5;
  else if (input.reason === 'resignation' && input.noticeType === 'indemnified_employee') noticeFactor = -1; // Desconto do aviso prévio

  const salaryBalance = (effectiveBaseSalary / 30) * days;
  const notice = (effectiveBaseSalary / 30) * noticeDays * noticeFactor;
  const thirteenthValue = isJustCause ? 0 : (effectiveBaseSalary / 12) * thirteenth;
  const proportionalVacation = isJustCause ? 0 : ((effectiveBaseSalary / 12) * vacation) * (4 / 3);
  const expiredVacationValue = input.expiredVacation ? effectiveBaseSalary * (4 / 3) : 0;

  const fgtsPenaltyRate = input.reason === 'without_cause' ? 0.4 : input.reason === 'agreement' ? 0.2 : 0;
  const fgtsPenalty = positiveNumber(input.fgtsBalance) * fgtsPenaltyRate;

  // Verbas rescisórias tributáveis
  const grossSalaryAndNotice = Math.max(0, salaryBalance + (notice > 0 ? notice : 0));
  const inssOnSalary = calculateInssDeduction(grossSalaryAndNotice).inss;
  const irrfOnSalary = calculateIrrfDeduction(grossSalaryAndNotice, inssOnSalary, input.dependents || 0).irrf;

  const inssOnThirteenth = isJustCause ? 0 : calculateInssDeduction(thirteenthValue).inss;
  const irrfOnThirteenth = isJustCause ? 0 : calculateIrrfDeduction(thirteenthValue, inssOnThirteenth, input.dependents || 0).irrf;

  const totalDeductions = inssOnSalary + irrfOnSalary + inssOnThirteenth + irrfOnThirteenth + (notice < 0 ? Math.abs(notice) : 0);

  const totalGross = Math.max(0, salaryBalance + (notice > 0 ? notice : 0) + thirteenthValue + proportionalVacation + expiredVacationValue + fgtsPenalty);
  const totalNet = Math.max(0, totalGross - totalDeductions);

  // Cenários Comparativos (Lado a lado)
  const scenarios: TerminationScenarioComparison[] = [
    {
      reason: 'without_cause',
      label: 'Demissão sem Justa Causa',
      grossTotal: roundCurrency(salaryBalance + ((effectiveBaseSalary / 30) * noticeDays) + thirteenthValue + proportionalVacation + expiredVacationValue + (positiveNumber(input.fgtsBalance) * 0.4)),
      netTotal: roundCurrency((salaryBalance + ((effectiveBaseSalary / 30) * noticeDays) + thirteenthValue + proportionalVacation + expiredVacationValue + (positiveNumber(input.fgtsBalance) * 0.4)) - totalDeductions),
      fgtsPenalty: roundCurrency(positiveNumber(input.fgtsBalance) * 0.4),
      canWithdrawFgts: true,
      unemploymentInsuranceEligible: true,
    },
    {
      reason: 'agreement',
      label: 'Acordo Mútuo (Art. 484-A)',
      grossTotal: roundCurrency(salaryBalance + ((effectiveBaseSalary / 30) * noticeDays * 0.5) + thirteenthValue + proportionalVacation + expiredVacationValue + (positiveNumber(input.fgtsBalance) * 0.2)),
      netTotal: roundCurrency((salaryBalance + ((effectiveBaseSalary / 30) * noticeDays * 0.5) + thirteenthValue + proportionalVacation + expiredVacationValue + (positiveNumber(input.fgtsBalance) * 0.2)) - totalDeductions),
      fgtsPenalty: roundCurrency(positiveNumber(input.fgtsBalance) * 0.2),
      canWithdrawFgts: true, // Saque até 80% do saldo
      unemploymentInsuranceEligible: false,
    },
    {
      reason: 'resignation',
      label: 'Pedido de Demissão',
      grossTotal: roundCurrency(salaryBalance + thirteenthValue + proportionalVacation + expiredVacationValue),
      netTotal: roundCurrency((salaryBalance + thirteenthValue + proportionalVacation + expiredVacationValue) - (inssOnSalary + irrfOnSalary + inssOnThirteenth + irrfOnThirteenth)),
      fgtsPenalty: 0,
      canWithdrawFgts: false,
      unemploymentInsuranceEligible: false,
    },
  ];

  return {
    effectiveBaseSalary: roundCurrency(effectiveBaseSalary),
    salaryBalance: roundCurrency(salaryBalance),
    notice: roundCurrency(notice),
    noticeDays,
    thirteenthValue: roundCurrency(thirteenthValue),
    proportionalVacation: roundCurrency(proportionalVacation),
    expiredVacationValue: roundCurrency(expiredVacationValue),
    fgtsPenalty: roundCurrency(fgtsPenalty),
    inssOnSalary: roundCurrency(inssOnSalary),
    irrfOnSalary: roundCurrency(irrfOnSalary),
    inssOnThirteenth: roundCurrency(inssOnThirteenth),
    irrfOnThirteenth: roundCurrency(irrfOnThirteenth),
    totalDeductions: roundCurrency(totalDeductions),
    total: roundCurrency(totalGross),
    netTotal: roundCurrency(totalNet),
    scenarios,
  };
}

// ==========================================
// APOSENTADORIA PELO INSS (2026)
// ==========================================

export interface Retirement2026Input {
  gender: RetirementGender;
  age: number;
  contributionYears: number;
  contributedBeforeReform: boolean;
  contributionMonthsBeforeReform?: number; // Meses de contribuição acumulados até 13/11/2019
  averageSalary?: number; // Média salarial contributiva estimada
}

export function evaluateRetirement2026(input: Retirement2026Input) {
  const currentAge = clamp(input.age, 0, 100);
  const contributionYears = clamp(input.contributionYears, 0, 60);
  const isWoman = input.gender === 'woman';

  // Regra Geral em 2026
  const generalAge = isWoman ? 62 : 65;
  const generalContribution = isWoman ? 15 : input.contributedBeforeReform ? 15 : 20;

  // Regra dos Pontos em 2026
  const transitionContribution = isWoman ? 30 : 35;
  const transitionPoints = isWoman ? 93 : 103;

  // Regra da Idade Progressiva em 2026
  const progressiveAge = isWoman ? 59.5 : 64.5;

  // Pedágio 50% (Exige que faltasse <= 2 anos em 13/11/2019: 28F / 33H anos em 13/11/2019)
  const yearsBeforeReform = (input.contributionMonthsBeforeReform || 0) / 12;
  const missingIn2019For50 = transitionContribution - yearsBeforeReform;
  const eligibleForToll50 = input.contributedBeforeReform && missingIn2019For50 > 0 && missingIn2019For50 <= 2;
  const toll50RequiredTime = transitionContribution + (missingIn2019For50 * 0.5);
  const toll50Eligible = eligibleForToll50 && contributionYears >= toll50RequiredTime;

  // Pedágio 100% (Exige 57F / 60H anos de idade + 100% do tempo que faltava em 13/11/2019)
  const toll100AgeRequired = isWoman ? 57 : 60;
  const missingIn2019For100 = Math.max(0, transitionContribution - yearsBeforeReform);
  const toll100RequiredTime = transitionContribution + missingIn2019For100;
  const toll100Eligible = input.contributedBeforeReform && currentAge >= toll100AgeRequired && contributionYears >= toll100RequiredTime;

  const points = currentAge + contributionYears;

  const generalEligible = currentAge >= generalAge && contributionYears >= generalContribution;
  const pointsEligible = input.contributedBeforeReform && contributionYears >= transitionContribution && points >= transitionPoints;
  const progressiveEligible = input.contributedBeforeReform && contributionYears >= transitionContribution && currentAge >= progressiveAge;

  // Estimativa de Renda Mensal Inicial (RMI)
  const baseAverage = positiveNumber(input.averageSalary || 3000);
  const baseRate = 0.60;
  const excessYears = isWoman ? Math.max(0, contributionYears - 15) : Math.max(0, contributionYears - 20);
  const totalRate = Math.min(1.00, baseRate + (excessYears * 0.02));
  const estimatedRmi = roundCurrency(baseAverage * totalRate);

  // Cálculo da projeção de anos/meses faltantes para cada regra
  const missingGeneralAge = Math.max(0, generalAge - currentAge);
  const missingGeneralContrib = Math.max(0, generalContribution - contributionYears);
  const yearsToGeneral = Math.max(missingGeneralAge, missingGeneralContrib);

  const missingPoints = Math.max(0, transitionPoints - points);
  const yearsToPoints = input.contributedBeforeReform ? Math.max(Math.max(0, transitionContribution - contributionYears), missingPoints / 2) : Infinity;

  const currentYear = new Date().getFullYear();
  const projectedRetirementYear = currentYear + Math.round(Math.min(yearsToGeneral, yearsToPoints === Infinity ? yearsToGeneral : yearsToPoints));

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
    toll50Eligible,
    toll100Eligible,
    toll50RequiredTime: roundCurrency(toll50RequiredTime),
    toll100RequiredTime: roundCurrency(toll100RequiredTime),
    toll100AgeRequired,
    anyEligible: generalEligible || pointsEligible || progressiveEligible || toll50Eligible || toll100Eligible,
    estimatedRmi,
    benefitRatePercentage: Math.round(totalRate * 100),
    projectedRetirementYear,
    yearsToGeneral: roundCurrency(yearsToGeneral),
  };
}

// ==========================================
// CÁLCULO DE FÉRIAS (CLT)
// ==========================================

export interface VacationEstimateInput {
  salary: number;
  variableAverages?: number;
  vacationDays?: number; // 30, 20, 15, 10
  sellDays?: boolean; // Abono pecuniário (venda de 10 dias)
  unexcusedAbsences?: number; // Faltas injustificadas no período aquisitivo (Art. 130 CLT)
  thirteenthAdvance?: boolean; // Adiantamento da 1ª parcela do 13º
  isDouble?: boolean; // Férias vencidas dobradas (Art. 137 CLT)
  dependents?: number;
}

export function calculateVacationEstimate(salaryInput: number, variableAveragesInput = 0, options: Partial<VacationEstimateInput> = {}) {
  const salary = positiveNumber(salaryInput);
  const averages = positiveNumber(variableAveragesInput);
  const totalBaseRemuneration = salary + averages;

  // Tabela de faltas Art. 130 CLT
  const absences = clamp(options.unexcusedAbsences || 0, 0, 100);
  let maxAllowedDays = 30;
  if (absences >= 6 && absences <= 14) maxAllowedDays = 24;
  else if (absences >= 15 && absences <= 23) maxAllowedDays = 18;
  else if (absences >= 24 && absences <= 32) maxAllowedDays = 12;
  else if (absences > 32) maxAllowedDays = 0;

  const requestedDays = clamp(options.vacationDays || 30, 1, maxAllowedDays);

  // Venda de férias (Abono pecuniário de 10 dias)
  const sell10Days = Boolean(options.sellDays) && maxAllowedDays >= 30;
  const actualVacationDays = sell10Days ? 20 : requestedDays;
  const soldDays = sell10Days ? 10 : 0;

  // Multiplicador se forem férias em dobro
  const doubleMultiplier = options.isDouble ? 2 : 1;

  // Remuneração das férias gozadas
  const vacationPay = ((totalBaseRemuneration / 30) * actualVacationDays) * doubleMultiplier;
  const vacationThird = (vacationPay / 3);

  // Abono Pecuniário (10 dias vendidos + 1/3 do abono) - Isentos de INSS/IRRF
  const abonoPay = sell10Days ? (totalBaseRemuneration / 30) * soldDays : 0;
  const abonoThird = sell10Days ? (abonoPay / 3) : 0;
  const totalAbonoPecuniario = abonoPay + abonoThird;

  // Adiantamento do 13º (50% do salário base)
  const thirteenthAdvancePay = options.thirteenthAdvance ? (salary / 2) : 0;

  // Tributação (INSS e IRRF incidem APENAS sobre férias gozadas + 1/3 constitucional)
  const taxableVacationBase = vacationPay + vacationThird;
  const inssDeduction = calculateInssDeduction(taxableVacationBase).inss;
  const irrfDeduction = calculateIrrfDeduction(taxableVacationBase, inssDeduction, options.dependents || 0).irrf;

  const totalGross = vacationPay + vacationThird + totalAbonoPecuniario + thirteenthAdvancePay;
  const totalNet = Math.max(0, totalGross - inssDeduction - irrfDeduction);

  return {
    remuneration: roundCurrency(totalBaseRemuneration),
    actualVacationDays,
    soldDays,
    maxAllowedDays,
    vacationPay: roundCurrency(vacationPay),
    constitutionalThird: roundCurrency(vacationThird),
    abonoPay: roundCurrency(abonoPay),
    abonoThird: roundCurrency(abonoThird),
    totalAbonoPecuniario: roundCurrency(totalAbonoPecuniario),
    thirteenthAdvancePay: roundCurrency(thirteenthAdvancePay),
    inssDeduction: roundCurrency(inssDeduction),
    irrfDeduction: roundCurrency(irrfDeduction),
    total: roundCurrency(totalGross),
    netTotal: roundCurrency(totalNet),
  };
}
