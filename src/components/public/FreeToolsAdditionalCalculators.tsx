import { useMemo, useState, type ReactNode } from 'react';
import {
  AlertTriangle,
  Baby,
  BadgeCheck,
  Check,
  CheckCircle2,
  ClipboardCheck,
  ExternalLink,
  FileCheck2,
  HandCoins,
  HeartHandshake,
  Info,
  Landmark,
  RotateCcw,
  ShieldCheck,
  Users,
  XCircle,
} from 'lucide-react';
import {
  BPC_INCOME_LIMIT_2026,
  MINIMUM_WAGE_2026,
  calculateThirteenthSalary,
  evaluateBpcScreening,
  evaluateInssBenefitScreening,
  type BpcApplicantType,
  type InssBenefitType,
  type ScreeningRequirement,
} from '../../lib/freeToolsAdditionalCalculations';

const currency = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' });
const decimal = new Intl.NumberFormat('pt-BR', { maximumFractionDigits: 2 });

function numeric(value: string) {
  const parsed = Number(value.trim().replace(',', '.'));
  return Number.isFinite(parsed) ? Math.max(0, parsed) : 0;
}

function Field({ label, value, onChange, prefix, suffix, max, step = 'any', help }: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  prefix?: string;
  suffix?: string;
  max?: number;
  step?: number | 'any';
  help?: string;
}) {
  return (
    <label className="block">
      <span className="text-sm font-black text-[#26313a]">{label}</span>
      <span className="relative mt-2 block">
        {prefix && <span className="absolute inset-y-0 left-4 flex items-center text-sm font-bold text-[#727c84]">{prefix}</span>}
        <input
          type="number"
          inputMode="decimal"
          min={0}
          max={max}
          step={step}
          value={value}
          onChange={(event) => onChange(event.target.value)}
          className={`min-h-12 w-full rounded-lg border border-[#d5cfc5] bg-white py-3 text-sm font-bold text-[#111820] outline-none transition hover:border-[#bbb1a1] focus:border-[#91722f] focus:ring-4 focus:ring-[#91722f]/10 ${prefix ? 'pl-12' : 'pl-4'} ${suffix ? 'pr-20' : 'pr-4'}`}
        />
        {suffix && <span className="absolute inset-y-0 right-4 flex items-center text-xs font-bold text-[#727c84]">{suffix}</span>}
      </span>
      {help && <span className="mt-1.5 block text-xs leading-5 text-[#68727a]">{help}</span>}
    </label>
  );
}

function Toggle({ checked, onChange, label, help }: { checked: boolean; onChange: (checked: boolean) => void; label: string; help?: string }) {
  return (
    <label className="flex min-h-12 cursor-pointer items-start gap-3 rounded-lg border border-[#d5cfc5] bg-[#faf8f3] p-4 text-sm font-bold text-[#26313a]">
      <input type="checkbox" checked={checked} onChange={(event) => onChange(event.target.checked)} className="mt-0.5 h-4 w-4 accent-[#8a6e2f]" />
      <span>{label}{help && <small className="mt-1 block font-medium leading-5 text-[#69727a]">{help}</small>}</span>
    </label>
  );
}

function Select({ label, value, onChange, options }: { label: string; value: string; onChange: (value: string) => void; options: Array<[string, string]> }) {
  return (
    <label className="block">
      <span className="text-sm font-black text-[#26313a]">{label}</span>
      <select value={value} onChange={(event) => onChange(event.target.value)} className="mt-2 min-h-12 w-full rounded-lg border border-[#d5cfc5] bg-white px-4 py-3 text-sm font-bold text-[#111820] outline-none focus:border-[#91722f] focus:ring-4 focus:ring-[#91722f]/10">
        {options.map(([optionValue, optionLabel]) => <option key={optionValue} value={optionValue}>{optionLabel}</option>)}
      </select>
    </label>
  );
}

function FreeLayout({ eyebrow, title, description, form, result, proItems }: {
  eyebrow: string;
  title: string;
  description: string;
  form: ReactNode;
  result: ReactNode;
  proItems: string[];
}) {
  return (
    <div className="grid overflow-hidden rounded-2xl border border-[#d4cdc2] bg-white shadow-[0_20px_55px_rgba(29,36,42,0.09)] lg:grid-cols-[1fr_0.88fr]">
      <section className="bg-[#fffdfa] p-5 sm:p-7 lg:p-8">
        <p className="text-[9px] font-black uppercase tracking-[0.16em] text-[#806128]">Modo Free · {eyebrow}</p>
        <h3 className="mt-3 text-2xl font-black tracking-[-0.03em] text-[#111820]">{title}</h3>
        <p className="mt-3 max-w-xl text-sm leading-6 text-[#68727a]">{description}</p>
        <div className="mt-7 space-y-5">{form}</div>
      </section>
      <aside className="bg-[#152433] p-5 text-white sm:p-7 lg:p-8">
        <p className="text-[9px] font-black uppercase tracking-[0.16em] text-[#d8bd73]">Resultado básico</p>
        <div className="mt-5">{result}</div>
        <div className="mt-7 border-t border-white/10 pt-6">
          <p className="flex items-center gap-2 text-xs font-black text-white"><ClipboardCheck className="h-4 w-4 text-[#d8bd73]" />No modo Pro você também recebe</p>
          <ul className="mt-4 space-y-2.5 text-xs leading-5 text-white/58">{proItems.map((item) => <li key={item} className="flex gap-2"><CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-[#d8bd73]" />{item}</li>)}</ul>
        </div>
      </aside>
    </div>
  );
}

function Section({ number, title, description, children }: { number: string; title: string; description?: string; children: ReactNode }) {
  return (
    <section className="border-b border-[#e3ddd4] pb-7 last:border-0 last:pb-0">
      <div className="mb-5 flex items-start gap-3">
        <span className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full border border-[#c9b57f] bg-[#f7f0dc] text-[9px] font-black text-[#765b25]">{number}</span>
        <div><h3 className="text-sm font-black text-[#111820]">{title}</h3>{description && <p className="mt-1 text-xs leading-5 text-[#6b747c]">{description}</p>}</div>
      </div>
      {children}
    </section>
  );
}

function Workbench({ title, description, children, result }: { title: string; description: string; children: ReactNode; result: ReactNode }) {
  return (
    <div className="grid overflow-hidden rounded-2xl border border-[#d4cdc2] bg-white shadow-[0_24px_65px_rgba(29,36,42,0.11)] lg:grid-cols-[1.06fr_0.94fr]">
      <section className="min-w-0 bg-[#fffdfa]">
        <div className="border-b border-[#e2dcd2] bg-[#faf7f1] px-5 py-5 sm:px-7">
          <p className="text-[9px] font-black uppercase tracking-[0.16em] text-[#806128]">Modo Pro · análise avançada</p>
          <h3 className="mt-2 text-xl font-black tracking-[-0.025em] text-[#111820]">{title}</h3>
          <p className="mt-2 text-xs leading-5 text-[#68727a]">{description}</p>
        </div>
        <div className="space-y-7 p-5 sm:p-7 lg:p-8">{children}</div>
      </section>
      {result}
    </div>
  );
}

function ResultPanel({ eyebrow, headline, summary, icon, children, note, action }: { eyebrow: string; headline: string; summary: string; icon: ReactNode; children: ReactNode; note: string; action?: ReactNode }) {
  return (
    <aside className="bg-[#132231] p-5 text-white sm:p-7 lg:sticky lg:top-0 lg:self-start">
      <div className="flex items-center justify-between gap-3 border-b border-white/10 pb-4"><span className="inline-flex items-center gap-2 text-[9px] font-black uppercase tracking-[0.13em] text-[#d8bd73]"><span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />Resultado Pro atualizado</span><BadgeCheck className="h-5 w-5 text-white/25" /></div>
      <div className="flex items-start justify-between gap-5 border-b border-white/10 py-6"><div><p className="text-[10px] font-black uppercase tracking-[0.18em] text-[#d8bd73]">{eyebrow}</p><p className="mt-2 text-3xl font-black leading-tight tracking-[-0.03em] sm:text-4xl">{headline}</p><p className="mt-3 max-w-md text-sm leading-6 text-white/55">{summary}</p></div><span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-white/10 bg-white/[0.04] text-[#d8bd73]">{icon}</span></div>
      <div className="mt-3">{children}</div>
      <div className="mt-6 flex gap-3 border-t border-white/10 pt-5 text-xs leading-5 text-white/55"><Info className="mt-0.5 h-4 w-4 shrink-0 text-[#d8bd73]" />{note}</div>
      {action && <div className="mt-5">{action}</div>}
    </aside>
  );
}

function ResultLine({ label, value, emphasized }: { label: string; value: string; emphasized?: boolean }) {
  return <div className={`flex items-start justify-between gap-5 border-b border-white/10 py-3.5 last:border-0 ${emphasized ? 'text-[#f0d98f]' : 'text-white/76'}`}><span className="text-sm leading-5">{label}</span><strong className="shrink-0 text-right text-sm font-black sm:text-base">{value}</strong></div>;
}

function RequirementList({ requirements }: { requirements: ScreeningRequirement[] }) {
  return <div className="space-y-2.5">{requirements.map((requirement) => <div key={requirement.label} className={`rounded-xl border p-4 ${requirement.met ? 'border-emerald-400/25 bg-emerald-400/10' : 'border-amber-300/20 bg-white/[0.04]'}`}><div className="flex items-start gap-3">{requirement.met ? <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-emerald-300" /> : <XCircle className="mt-0.5 h-5 w-5 shrink-0 text-amber-300" />}<div><p className="text-sm font-black text-white">{requirement.label}</p><p className="mt-1 text-xs leading-5 text-white/55">{requirement.detail}</p></div></div></div>)}</div>;
}

export function ThirteenthFree() {
  const [salary, setSalary] = useState('3500');
  const [months, setMonths] = useState('12');
  const result = useMemo(() => calculateThirteenthSalary({ salary: numeric(salary), eligibleMonths: numeric(months) }), [salary, months]);

  return <FreeLayout eyebrow="simulação trabalhista" title="Estimativa proporcional do 13º salário" description="Informe a remuneração mensal e a quantidade de meses com pelo menos 15 dias trabalhados." form={<><Field label="Salário bruto mensal" value={salary} onChange={setSalary} prefix="R$" /><Field label="Meses computados no ano" value={months} onChange={setMonths} suffix="de 12" max={12} step={1} /></>} result={<><HandCoins className="h-7 w-7 text-[#d8bd73]" /><p className="mt-5 text-4xl font-black tracking-[-0.04em]">{currency.format(result.grossValue)}</p><p className="mt-2 text-sm leading-6 text-white/55">Valor bruto proporcional estimado.</p><div className="mt-5 space-y-2 text-sm text-white/65"><p>1ª parcela de referência: {currency.format(result.referenceFirstInstallment)}</p><p>Saldo bruto da 2ª parcela: {currency.format(result.secondInstallmentBeforeDeductions)}</p></div></>} proItems={['média de valores variáveis', 'primeira parcela já recebida', 'descontos informados separadamente', 'estimativa líquida da segunda parcela']} />;
}

const BENEFIT_OPTIONS: Array<[InssBenefitType, string]> = [
  ['temporary_incapacity', 'Incapacidade temporária'],
  ['maternity', 'Salário-maternidade'],
  ['death_pension', 'Pensão por morte'],
  ['accident_assistance', 'Auxílio-acidente'],
];

function BenefitsFields({ type, insured, setInsured, contributions, setContributions, incapacityDays, setIncapacityDays, exempt, setExempt, medical, setMedical, eventDocumented, setEventDocumented, deceasedCoverage, setDeceasedCoverage, dependent, setDependent, dependencyEvidence, setDependencyEvidence, eligibleCategory, setEligibleCategory, permanentSequela, setPermanentSequela, reducedCapacity, setReducedCapacity }: any) {
  if (type === 'temporary_incapacity') return <><Toggle checked={insured} onChange={setInsured} label="Possui qualidade de segurado" /><div className="grid gap-5 sm:grid-cols-2"><Field label="Contribuições mensais" value={contributions} onChange={setContributions} suffix="meses" max={600} step={1} /><Field label="Dias de incapacidade" value={incapacityDays} onChange={setIncapacityDays} suffix="dias" max={3650} step={1} /></div><Toggle checked={exempt} onChange={setExempt} label="Acidente ou hipótese legal de isenção de carência" /><Toggle checked={medical} onChange={setMedical} label="Possui atestado, laudo ou relatório médico" /></>;
  if (type === 'maternity') return <><Toggle checked={insured} onChange={setInsured} label="Possui qualidade de segurado" /><Toggle checked={eventDocumented} onChange={setEventDocumented} label="Possui documento do parto, adoção ou guarda" /><div className="rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-xs leading-5 text-emerald-900"><CheckCircle2 className="mr-2 inline h-4 w-4" />A carência está dispensada para todas as categorias; a qualidade de segurado continua sendo analisada.</div></>;
  if (type === 'death_pension') return <><Toggle checked={deceasedCoverage} onChange={setDeceasedCoverage} label="O falecido possuía cobertura do INSS" help="Qualidade de segurado, benefício em manutenção ou direito adquirido." /><Toggle checked={dependent} onChange={setDependent} label="O requerente pertence a uma classe de dependentes" /><Toggle checked={dependencyEvidence} onChange={setDependencyEvidence} label="Possui documentos que comprovam o vínculo ou dependência" /></>;
  return <><Toggle checked={insured} onChange={setInsured} label="Possuía qualidade de segurado na data do acidente" /><Toggle checked={eligibleCategory} onChange={setEligibleCategory} label="Era empregado, doméstico, avulso ou segurado especial" /><Toggle checked={permanentSequela} onChange={setPermanentSequela} label="O acidente deixou sequela permanente" /><Toggle checked={reducedCapacity} onChange={setReducedCapacity} label="A sequela reduziu a capacidade para o trabalho habitual" /></>;
}

function useBenefitScreening() {
  const [type, setType] = useState<InssBenefitType>('temporary_incapacity');
  const [insured, setInsured] = useState(true);
  const [contributions, setContributions] = useState('12');
  const [incapacityDays, setIncapacityDays] = useState('20');
  const [exempt, setExempt] = useState(false);
  const [medical, setMedical] = useState(true);
  const [eventDocumented, setEventDocumented] = useState(true);
  const [deceasedCoverage, setDeceasedCoverage] = useState(true);
  const [dependent, setDependent] = useState(true);
  const [dependencyEvidence, setDependencyEvidence] = useState(true);
  const [eligibleCategory, setEligibleCategory] = useState(true);
  const [permanentSequela, setPermanentSequela] = useState(true);
  const [reducedCapacity, setReducedCapacity] = useState(true);
  const result = useMemo(() => evaluateInssBenefitScreening({ benefitType: type, hasInsuredStatus: insured, contributionMonths: numeric(contributions), incapacityDays: numeric(incapacityDays), carencyExempt: exempt, hasMedicalEvidence: medical, maternityEventDocumented: eventDocumented, deceasedHadCoverage: deceasedCoverage, isEligibleDependent: dependent, hasDependencyEvidence: dependencyEvidence, accidentCategoryEligible: eligibleCategory, hasPermanentSequela: permanentSequela, capacityReduced: reducedCapacity }), [type, insured, contributions, incapacityDays, exempt, medical, eventDocumented, deceasedCoverage, dependent, dependencyEvidence, eligibleCategory, permanentSequela, reducedCapacity]);
  return { type, setType, insured, setInsured, contributions, setContributions, incapacityDays, setIncapacityDays, exempt, setExempt, medical, setMedical, eventDocumented, setEventDocumented, deceasedCoverage, setDeceasedCoverage, dependent, setDependent, dependencyEvidence, setDependencyEvidence, eligibleCategory, setEligibleCategory, permanentSequela, setPermanentSequela, reducedCapacity, setReducedCapacity, result };
}

export function BenefitsFree() {
  const state = useBenefitScreening();
  return <FreeLayout eyebrow="triagem previdenciária" title="Verificação inicial de benefício do INSS" description="Escolha o benefício e responda aos requisitos essenciais. O resultado não substitui a análise do INSS." form={<><Select label="Benefício consultado" value={state.type} onChange={(value) => state.setType(value as InssBenefitType)} options={BENEFIT_OPTIONS} /><BenefitsFields {...state} /></>} result={<><Baby className="h-7 w-7 text-[#d8bd73]" /><p className="mt-5 text-2xl font-black">{state.result.allMet ? 'Requisitos básicos presentes' : 'Existem pontos pendentes'}</p><p className="mt-2 text-sm leading-6 text-white/55">{state.result.metCount} de {state.result.totalRequirements} critérios informados foram atendidos.</p><div className="mt-5 space-y-2">{state.result.requirements.map((item) => <p key={item.label} className={`flex gap-2 text-xs leading-5 ${item.met ? 'text-emerald-300' : 'text-amber-200'}`}>{item.met ? <Check className="mt-0.5 h-4 w-4 shrink-0" /> : <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />}{item.label}</p>)}</div></>} proItems={['explicação individual de cada requisito', 'lista inicial de documentos', 'alertas sobre carência e categoria', 'orientação do próximo passo']} />;
}

function useBpcScreening() {
  const [applicantType, setApplicantType] = useState<BpcApplicantType>('elderly');
  const [age, setAge] = useState('67');
  const [income, setIncome] = useState('1200');
  const [members, setMembers] = useState('4');
  const [longTerm, setLongTerm] = useState(true);
  const [cadUnico, setCadUnico] = useState(true);
  const [cpfs, setCpfs] = useState(true);
  const [otherBenefit, setOtherBenefit] = useState(false);
  const [biometric, setBiometric] = useState(true);
  const result = useMemo(() => evaluateBpcScreening({ applicantType, age: numeric(age), familyGrossIncome: numeric(income), familyMembers: numeric(members), longTermImpairment: longTerm, cadUnicoUpdated: cadUnico, allFamilyCpfRegistered: cpfs, receivesIncompatibleBenefit: otherBenefit, biometricRegistered: biometric }), [applicantType, age, income, members, longTerm, cadUnico, cpfs, otherBenefit, biometric]);
  return { applicantType, setApplicantType, age, setAge, income, setIncome, members, setMembers, longTerm, setLongTerm, cadUnico, setCadUnico, cpfs, setCpfs, otherBenefit, setOtherBenefit, biometric, setBiometric, result };
}

export function BpcFree() {
  const state = useBpcScreening();
  return <FreeLayout eyebrow="triagem assistencial" title="Renda por pessoa para o BPC / LOAS" description="Calcule a renda familiar por pessoa e compare com o limite objetivo de 2026." form={<><Select label="Modalidade consultada" value={state.applicantType} onChange={(value) => state.setApplicantType(value as BpcApplicantType)} options={[["elderly", "Pessoa idosa"], ["disabled", "Pessoa com deficiência"]]} /><div className="grid gap-5 sm:grid-cols-2"><Field label="Renda bruta mensal da família" value={state.income} onChange={state.setIncome} prefix="R$" /><Field label="Pessoas do grupo familiar" value={state.members} onChange={state.setMembers} suffix="pessoas" max={30} step={1} /></div>{state.applicantType === 'elderly' ? <Field label="Idade da pessoa" value={state.age} onChange={state.setAge} suffix="anos" max={120} step={1} /> : <Toggle checked={state.longTerm} onChange={state.setLongTerm} label="Existe impedimento com efeitos por pelo menos dois anos" />}</>} result={<><HeartHandshake className="h-7 w-7 text-[#d8bd73]" /><p className="mt-5 text-4xl font-black tracking-[-0.04em]">{currency.format(state.result.incomePerPerson)}</p><p className="mt-2 text-sm leading-6 text-white/55">Renda bruta mensal por integrante.</p><div className={`mt-5 rounded-xl border p-4 text-sm ${state.result.incomeWithinObjectiveLimit ? 'border-emerald-400/30 bg-emerald-400/10 text-emerald-200' : 'border-amber-300/30 bg-amber-300/10 text-amber-100'}`}>{state.result.incomeWithinObjectiveLimit ? <CheckCircle2 className="mr-2 inline h-5 w-5" /> : <AlertTriangle className="mr-2 inline h-5 w-5" />}Limite objetivo de 2026: {currency.format(BPC_INCOME_LIMIT_2026)} por pessoa.</div></>} proItems={['idade ou impedimento de longo prazo', 'CadÚnico e CPF dos integrantes', 'cadastro biométrico', 'benefícios incompatíveis e pendências']} />;
}

export function ThirteenthPro() {
  const [salary, setSalary] = useState('3500');
  const [averages, setAverages] = useState('300');
  const [months, setMonths] = useState('12');
  const [firstPaid, setFirstPaid] = useState('1900');
  const [inss, setInss] = useState('0');
  const [irrf, setIrrf] = useState('0');
  const [others, setOthers] = useState('0');
  const result = useMemo(() => calculateThirteenthSalary({ salary: numeric(salary), variableAverage: numeric(averages), eligibleMonths: numeric(months), firstInstallmentPaid: numeric(firstPaid), inssDeduction: numeric(inss), incomeTaxDeduction: numeric(irrf), otherDeductions: numeric(others) }), [salary, averages, months, firstPaid, inss, irrf, others]);
  const reset = () => { setSalary('3500'); setAverages('300'); setMonths('12'); setFirstPaid('1900'); setInss('0'); setIrrf('0'); setOthers('0'); };

  return <Workbench title="Memória avançada do 13º salário" description="Organize remuneração, avos, adiantamento e descontos já apurados no contracheque." result={<ResultPanel eyebrow="Segunda parcela líquida estimada" headline={currency.format(result.secondInstallmentNet)} summary={`13º bruto de ${currency.format(result.grossValue)} para ${result.eligibleMonths} mês(es) computados.`} icon={<HandCoins className="h-5 w-5" />} note="INSS e Imposto de Renda devem ser informados conforme a folha ou cálculo oficial. A ferramenta não substitui o contracheque."><ResultLine label="Remuneração considerada" value={currency.format(result.baseRemuneration)} /><ResultLine label="13º bruto proporcional" value={currency.format(result.grossValue)} /><ResultLine label="1ª parcela informada" value={currency.format(result.firstInstallmentPaid)} /><ResultLine label="2ª parcela antes dos descontos" value={currency.format(result.secondInstallmentBeforeDeductions)} /><ResultLine label="Descontos informados" value={currency.format(result.totalDeductions)} /><ResultLine label="2ª parcela líquida estimada" value={currency.format(result.secondInstallmentNet)} emphasized /></ResultPanel>}>
    <Section number="01" title="Remuneração e avos"><div className="grid gap-5 sm:grid-cols-2"><Field label="Salário bruto mensal" value={salary} onChange={setSalary} prefix="R$" /><Field label="Média de comissões e adicionais" value={averages} onChange={setAverages} prefix="R$" /><Field label="Meses com 15 dias ou mais" value={months} onChange={setMonths} suffix="de 12" max={12} step={1} /><Field label="Primeira parcela já paga" value={firstPaid} onChange={setFirstPaid} prefix="R$" /></div></Section>
    <Section number="02" title="Descontos da segunda parcela" description="Copie os valores do demonstrativo da folha quando disponíveis."><div className="grid gap-5 sm:grid-cols-3"><Field label="INSS" value={inss} onChange={setInss} prefix="R$" /><Field label="Imposto de Renda" value={irrf} onChange={setIrrf} prefix="R$" /><Field label="Outros descontos" value={others} onChange={setOthers} prefix="R$" /></div></Section>
    <button type="button" onClick={reset} className="inline-flex min-h-11 items-center gap-2 rounded-lg border border-[#d5cec3] bg-white px-4 text-sm font-black text-[#59646d]"><RotateCcw className="h-4 w-4" />Restaurar exemplo</button>
  </Workbench>;
}

export function BenefitsPro() {
  const state = useBenefitScreening();
  const headline = state.result.allMet ? 'Triagem favorável' : state.result.status === 'attention' ? 'Revisar pendências' : 'Critérios insuficientes';
  return <Workbench title="Triagem detalhada de benefícios do INSS" description="Avalie os requisitos objetivos e organize a documentação inicial antes do requerimento." result={<ResultPanel eyebrow="Panorama da triagem" headline={headline} summary={`${state.result.metCount} de ${state.result.totalRequirements} requisitos básicos atendidos.`} icon={<Landmark className="h-5 w-5" />} note="A concessão depende da análise do INSS, dos sistemas previdenciários, da documentação e, quando aplicável, de perícia médica." action={<a href="https://meu.inss.gov.br/" target="_blank" rel="noopener noreferrer" className="inline-flex min-h-11 items-center gap-2 rounded-lg border border-[#d8bd73]/40 px-4 text-sm font-black text-[#efd991]">Acessar o Meu INSS <ExternalLink className="h-4 w-4" /></a>}><RequirementList requirements={state.result.requirements} /><div className="mt-6 border-t border-white/10 pt-5"><p className="text-xs font-black text-[#efd991]">Documentos para separar</p><ul className="mt-3 space-y-2 text-xs leading-5 text-white/60">{state.result.documents.map((document) => <li key={document} className="flex gap-2"><FileCheck2 className="mt-0.5 h-4 w-4 shrink-0 text-[#d8bd73]" />{document}</li>)}</ul></div></ResultPanel>}>
    <Section number="01" title="Benefício consultado"><Select label="Tipo de benefício" value={state.type} onChange={(value) => state.setType(value as InssBenefitType)} options={BENEFIT_OPTIONS} /></Section>
    <Section number="02" title="Requisitos informados"><div className="space-y-4"><BenefitsFields {...state} /></div></Section>
    <Section number="03" title="Limite da triagem"><div className="flex gap-3 rounded-xl border border-amber-200 bg-amber-50 p-4 text-xs leading-5 text-amber-900"><AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />Esta ferramenta não calcula o valor final do benefício nem confirma direito. Ela organiza os requisitos iniciais conforme o benefício escolhido.</div></Section>
  </Workbench>;
}

export function BpcPro() {
  const state = useBpcScreening();
  const headline = state.result.allObjectiveCriteriaMet ? 'Critérios objetivos presentes' : 'Existem pendências';
  return <Workbench title="Triagem completa do BPC / LOAS" description="Compare renda, perfil, Cadastro Único, biometria e impedimentos objetivos do requerimento." result={<ResultPanel eyebrow="Renda familiar por pessoa" headline={currency.format(state.result.incomePerPerson)} summary={`${currency.format(state.result.familyGrossIncome)} divididos por ${state.result.familyMembers} integrante(s).`} icon={<HeartHandshake className="h-5 w-5" />} note="A vulnerabilidade social e as exclusões de renda dependem da análise administrativa. A ferramenta usa o limite objetivo de um quarto do salário mínimo de 2026." action={<a href="https://meu.inss.gov.br/" target="_blank" rel="noopener noreferrer" className="inline-flex min-h-11 items-center gap-2 rounded-lg border border-[#d8bd73]/40 px-4 text-sm font-black text-[#efd991]">Solicitar pelo Meu INSS <ExternalLink className="h-4 w-4" /></a>}><ResultLine label="Salário mínimo de referência" value={currency.format(MINIMUM_WAGE_2026)} /><ResultLine label="Limite objetivo por pessoa" value={currency.format(state.result.incomeLimit)} emphasized /><div className="mt-5"><RequirementList requirements={state.result.requirements} /></div><div className="mt-5 rounded-xl border border-white/10 bg-white/[0.04] p-4 text-xs leading-5 text-white/60"><Info className="mr-2 inline h-4 w-4 text-[#d8bd73]" />O BPC tem valor mensal de um salário mínimo, não paga 13º salário e não gera pensão por morte.</div></ResultPanel>}>
    <Section number="01" title="Perfil do requerente"><div className="grid gap-5 sm:grid-cols-2"><Select label="Modalidade" value={state.applicantType} onChange={(value) => state.setApplicantType(value as BpcApplicantType)} options={[["elderly", "Pessoa idosa"], ["disabled", "Pessoa com deficiência"]]} />{state.applicantType === 'elderly' ? <Field label="Idade" value={state.age} onChange={state.setAge} suffix="anos" max={120} step={1} /> : <Toggle checked={state.longTerm} onChange={state.setLongTerm} label="Impedimento com efeitos por pelo menos dois anos" />}</div></Section>
    <Section number="02" title="Grupo familiar e renda"><div className="grid gap-5 sm:grid-cols-2"><Field label="Renda bruta mensal do grupo" value={state.income} onChange={state.setIncome} prefix="R$" /><Field label="Quantidade de integrantes" value={state.members} onChange={state.setMembers} suffix="pessoas" max={30} step={1} /></div><div className="mt-4 rounded-xl border border-[#d6c9a8] bg-[#f7f2e6] p-4 text-xs leading-5 text-[#66532e]"><Users className="mr-2 inline h-4 w-4" />Resultado atual: {currency.format(state.result.incomePerPerson)} por pessoa. Limite objetivo: {currency.format(BPC_INCOME_LIMIT_2026)}.</div></Section>
    <Section number="03" title="Cadastros e impedimentos"><div className="grid gap-4 sm:grid-cols-2"><Toggle checked={state.cadUnico} onChange={state.setCadUnico} label="CadÚnico atualizado há menos de dois anos" /><Toggle checked={state.cpfs} onChange={state.setCpfs} label="CPF de todos os integrantes informado" /><Toggle checked={state.biometric} onChange={state.setBiometric} label="Cadastro biométrico disponível" /><Toggle checked={state.otherBenefit} onChange={state.setOtherBenefit} label="Recebe outro benefício possivelmente incompatível" /></div></Section>
    <div className="flex gap-3 rounded-xl border border-[#d5cfc5] bg-[#faf8f3] p-4 text-xs leading-5 text-[#626c74]"><ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-[#8a6e2f]" />Os dados são processados somente no navegador e não são enviados para o banco da GSA.</div>
  </Workbench>;
}
