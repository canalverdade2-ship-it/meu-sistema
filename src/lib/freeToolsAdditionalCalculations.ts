export const MINIMUM_WAGE_2026 = 1621;
export const BPC_INCOME_LIMIT_2026 = MINIMUM_WAGE_2026 / 4;

function positive(value: number) {
  return Number.isFinite(value) ? Math.max(0, value) : 0;
}

function clamp(value: number, minimum: number, maximum: number) {
  return Math.min(maximum, Math.max(minimum, positive(value)));
}

export interface ThirteenthSalaryInput {
  salary: number;
  variableAverage?: number;
  eligibleMonths: number;
  firstInstallmentPaid?: number;
  inssDeduction?: number;
  incomeTaxDeduction?: number;
  otherDeductions?: number;
}

export function calculateThirteenthSalary(input: ThirteenthSalaryInput) {
  const baseRemuneration = positive(input.salary) + positive(input.variableAverage || 0);
  const eligibleMonths = Math.round(clamp(input.eligibleMonths, 0, 12));
  const grossValue = (baseRemuneration / 12) * eligibleMonths;
  const referenceFirstInstallment = grossValue / 2;
  const firstInstallmentPaid = Math.min(grossValue, positive(input.firstInstallmentPaid ?? referenceFirstInstallment));
  const secondInstallmentBeforeDeductions = Math.max(0, grossValue - firstInstallmentPaid);
  const inssDeduction = positive(input.inssDeduction || 0);
  const incomeTaxDeduction = positive(input.incomeTaxDeduction || 0);
  const otherDeductions = positive(input.otherDeductions || 0);
  const totalDeductions = inssDeduction + incomeTaxDeduction + otherDeductions;
  const secondInstallmentNet = Math.max(0, secondInstallmentBeforeDeductions - totalDeductions);
  const estimatedTotalNet = firstInstallmentPaid + secondInstallmentNet;

  return {
    baseRemuneration,
    eligibleMonths,
    grossValue,
    referenceFirstInstallment,
    firstInstallmentPaid,
    secondInstallmentBeforeDeductions,
    inssDeduction,
    incomeTaxDeduction,
    otherDeductions,
    totalDeductions,
    secondInstallmentNet,
    estimatedTotalNet,
  };
}

export type InssBenefitType = 'temporary_incapacity' | 'maternity' | 'death_pension' | 'accident_assistance';

export interface InssBenefitScreeningInput {
  benefitType: InssBenefitType;
  hasInsuredStatus: boolean;
  contributionMonths?: number;
  incapacityDays?: number;
  carencyExempt?: boolean;
  hasMedicalEvidence?: boolean;
  maternityEventDocumented?: boolean;
  deceasedHadCoverage?: boolean;
  isEligibleDependent?: boolean;
  hasDependencyEvidence?: boolean;
  accidentCategoryEligible?: boolean;
  hasPermanentSequela?: boolean;
  capacityReduced?: boolean;
}

export interface ScreeningRequirement {
  label: string;
  met: boolean;
  detail: string;
}

const BENEFIT_DOCUMENTS: Record<InssBenefitType, string[]> = {
  temporary_incapacity: [
    'Documento de identificação e CPF',
    'Atestado, laudo ou relatório médico legível',
    'Data de início do afastamento e prazo estimado',
    'Documentos de vínculo e contribuições quando solicitados',
  ],
  maternity: [
    'Documento de identificação e CPF',
    'Certidão de nascimento ou documento do evento',
    'Termo de guarda para adoção, quando aplicável',
    'Documentos das relações previdenciárias quando solicitados',
  ],
  death_pension: [
    'Certidão de óbito ou documento de morte presumida',
    'Documentos do segurado falecido',
    'Provas da condição de dependente',
    'Documentos de vínculos e contribuições do falecido',
  ],
  accident_assistance: [
    'Documento de identificação e CPF',
    'Laudos, exames e relatórios da sequela',
    'Documentos do acidente e da atividade exercida',
    'Comunicação de Acidente de Trabalho, quando existente',
  ],
};

export function evaluateInssBenefitScreening(input: InssBenefitScreeningInput) {
  const requirements: ScreeningRequirement[] = [];
  const contributions = Math.round(clamp(input.contributionMonths || 0, 0, 600));

  if (input.benefitType === 'temporary_incapacity') {
    requirements.push(
      { label: 'Qualidade de segurado', met: input.hasInsuredStatus, detail: 'É necessário estar coberto pelo INSS ou dentro do período de graça.' },
      { label: 'Incapacidade por mais de 15 dias', met: positive(input.incapacityDays || 0) > 15, detail: 'A incapacidade temporária precisa impedir o trabalho ou a atividade habitual.' },
      { label: 'Carência ou hipótese de isenção', met: Boolean(input.carencyExempt) || contributions >= 12, detail: 'Em regra são exigidas 12 contribuições, salvo acidente e outras hipóteses legais de isenção.' },
      { label: 'Prova médica', met: Boolean(input.hasMedicalEvidence), detail: 'O INSS avaliará os documentos e poderá exigir perícia médica.' },
    );
  }

  if (input.benefitType === 'maternity') {
    requirements.push(
      { label: 'Qualidade de segurado', met: input.hasInsuredStatus, detail: 'A qualidade de segurado deve existir na data do fato gerador.' },
      { label: 'Evento comprovado', met: Boolean(input.maternityEventDocumented), detail: 'Parto, adoção, guarda para adoção ou outra situação legal deve ser documentada.' },
      { label: 'Carência', met: true, detail: 'A carência está dispensada para todas as categorias, permanecendo a exigência de qualidade de segurado.' },
    );
  }

  if (input.benefitType === 'death_pension') {
    requirements.push(
      { label: 'Cobertura do segurado falecido', met: Boolean(input.deceasedHadCoverage), detail: 'O falecido deve ter qualidade de segurado, receber benefício ou possuir direito adquirido.' },
      { label: 'Dependente previsto em lei', met: Boolean(input.isEligibleDependent), detail: 'A prioridade depende da classe do dependente e pode excluir classes posteriores.' },
      { label: 'Prova da dependência', met: Boolean(input.hasDependencyEvidence), detail: 'A documentação varia conforme cônjuge, companheiro, filho, pais ou irmãos.' },
    );
  }

  if (input.benefitType === 'accident_assistance') {
    requirements.push(
      { label: 'Qualidade de segurado no acidente', met: input.hasInsuredStatus, detail: 'A cobertura previdenciária deve existir na data do acidente.' },
      { label: 'Categoria abrangida', met: Boolean(input.accidentCategoryEligible), detail: 'O benefício alcança empregado, doméstico, trabalhador avulso e segurado especial.' },
      { label: 'Sequela permanente', met: Boolean(input.hasPermanentSequela), detail: 'A lesão deve estar consolidada e deixar sequela definitiva.' },
      { label: 'Redução da capacidade de trabalho', met: Boolean(input.capacityReduced), detail: 'A sequela deve reduzir a capacidade para a atividade habitual.' },
    );
  }

  const metCount = requirements.filter((requirement) => requirement.met).length;
  const missing = requirements.filter((requirement) => !requirement.met);
  const allMet = requirements.length > 0 && missing.length === 0;
  const status = allMet ? 'possible' : metCount >= Math.ceil(requirements.length / 2) ? 'attention' : 'not_indicated';

  return {
    benefitType: input.benefitType,
    requirements,
    missing,
    metCount,
    totalRequirements: requirements.length,
    allMet,
    status,
    documents: BENEFIT_DOCUMENTS[input.benefitType],
  };
}

export type BpcApplicantType = 'elderly' | 'disabled';

export interface BpcScreeningInput {
  applicantType: BpcApplicantType;
  age: number;
  familyGrossIncome: number;
  familyMembers: number;
  longTermImpairment?: boolean;
  cadUnicoUpdated?: boolean;
  allFamilyCpfRegistered?: boolean;
  receivesIncompatibleBenefit?: boolean;
  biometricRegistered?: boolean;
}

export function evaluateBpcScreening(input: BpcScreeningInput) {
  const age = clamp(input.age, 0, 120);
  const familyMembers = Math.max(1, Math.round(clamp(input.familyMembers, 1, 30)));
  const familyGrossIncome = positive(input.familyGrossIncome);
  const incomePerPerson = familyGrossIncome / familyMembers;
  const incomeWithinObjectiveLimit = incomePerPerson <= BPC_INCOME_LIMIT_2026;
  const profileMet = input.applicantType === 'elderly'
    ? age >= 65
    : Boolean(input.longTermImpairment);
  const cadUnicoReady = Boolean(input.cadUnicoUpdated && input.allFamilyCpfRegistered);
  const noIncompatibleBenefit = !input.receivesIncompatibleBenefit;
  const biometricReady = Boolean(input.biometricRegistered);
  const allObjectiveCriteriaMet = profileMet
    && incomeWithinObjectiveLimit
    && cadUnicoReady
    && noIncompatibleBenefit
    && biometricReady;

  const requirements: ScreeningRequirement[] = [
    {
      label: input.applicantType === 'elderly' ? 'Idade mínima de 65 anos' : 'Impedimento de longo prazo',
      met: profileMet,
      detail: input.applicantType === 'elderly'
        ? 'A modalidade da pessoa idosa exige 65 anos ou mais.'
        : 'A modalidade da pessoa com deficiência exige impedimento com efeitos por pelo menos dois anos, sujeito a avaliação biopsicossocial.',
    },
    {
      label: 'Renda familiar por pessoa',
      met: incomeWithinObjectiveLimit,
      detail: `O limite objetivo usado nesta triagem é de R$ ${BPC_INCOME_LIMIT_2026.toFixed(2).replace('.', ',')} por pessoa em 2026.`,
    },
    {
      label: 'Cadastro Único e CPF da família',
      met: cadUnicoReady,
      detail: 'O CadÚnico deve estar atualizado há menos de dois anos e conter o CPF de todos os integrantes.',
    },
    {
      label: 'Ausência de benefício incompatível',
      met: noIncompatibleBenefit,
      detail: 'O recebimento de outro benefício pode impedir o BPC, salvo exceções previstas em lei.',
    },
    {
      label: 'Cadastro biométrico',
      met: biometricReady,
      detail: 'O requerimento pode exigir cadastro biométrico do requerente, beneficiário ou responsável legal.',
    },
  ];

  return {
    applicantType: input.applicantType,
    age,
    familyMembers,
    familyGrossIncome,
    incomePerPerson,
    incomeLimit: BPC_INCOME_LIMIT_2026,
    benefitReferenceValue: MINIMUM_WAGE_2026,
    profileMet,
    incomeWithinObjectiveLimit,
    cadUnicoReady,
    noIncompatibleBenefit,
    biometricReady,
    allObjectiveCriteriaMet,
    requirements,
    missing: requirements.filter((requirement) => !requirement.met),
  };
}
