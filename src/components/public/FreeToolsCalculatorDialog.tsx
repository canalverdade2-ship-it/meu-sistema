import { useMemo, useState, type ComponentType, type ReactNode } from 'react';
import {
  ArrowRight,
  BadgeCheck,
  BriefcaseBusiness,
  Calculator,
  CheckCircle2,
  Clock3,
  ExternalLink,
  FileCheck2,
  Info,
  Landmark,
  LockKeyhole,
  Palmtree,
  RotateCcw,
  Scale,
  ShieldCheck,
  X,
} from 'lucide-react';
import { AccessibleDialog } from '../ui/AccessibleDialog';
import {
  calculateTerminationEstimate,
  calculateVacationEstimate,
  evaluateRetirement2026,
  type TerminationReason,
} from '../../lib/freeToolsCalculations';

export type FreeToolId = 'termination' | 'retirement' | 'vacation';

interface FreeToolsCalculatorDialogProps {
  tool: FreeToolId | null;
  onClose: () => void;
  onToolChange: (tool: FreeToolId) => void;
  onServices: () => void;
}

interface ToolPresentation {
  icon: ComponentType<{ className?: string }>;
  code: string;
  shortTitle: string;
  category: string;
  title: string;
  description: string;
  scope: string;
}

const currencyFormatter = new Intl.NumberFormat('pt-BR', {
  style: 'currency',
  currency: 'BRL',
});

const decimalFormatter = new Intl.NumberFormat('pt-BR', {
  minimumFractionDigits: 0,
  maximumFractionDigits: 1,
});

const TOOL_ORDER: FreeToolId[] = ['termination', 'retirement', 'vacation'];

const TOOL_PRESENTATION: Record<FreeToolId, ToolPresentation> = {
  termination: {
    icon: BriefcaseBusiness,
    code: 'FT-01',
    shortTitle: 'Rescisão',
    category: 'Ferramenta trabalhista',
    title: 'Estimativa de rescisão CLT',
    description: 'Organize os principais dados do vínculo e consulte uma estimativa bruta das verbas rescisórias consideradas pela ferramenta.',
    scope: 'Saldo de salário, aviso-prévio, décimo terceiro, férias e multa estimada do FGTS.',
  },
  retirement: {
    icon: Landmark,
    code: 'FT-02',
    shortTitle: 'Aposentadoria',
    category: 'Ferramenta previdenciária · regras de 2026',
    title: 'Panorama de aposentadoria pelo INSS',
    description: 'Compare idade e tempo de contribuição com critérios básicos da regra geral e de duas regras de transição.',
    scope: 'Regra geral, regra dos pontos, idade progressiva e requisitos ainda pendentes.',
  },
  vacation: {
    icon: Palmtree,
    code: 'FT-03',
    shortTitle: 'Férias',
    category: 'Ferramenta trabalhista',
    title: 'Estimativa bruta de férias',
    description: 'Visualize a remuneração de 30 dias de férias e o adicional constitucional de um terço antes dos descontos aplicáveis.',
    scope: 'Salário mensal, médias habituais, adicional constitucional e total bruto estimado.',
  },
};

const TRUST_ITEMS: Array<{
  icon: ComponentType<{ className?: string }>;
  title: string;
  text: string;
}> = [
  { icon: LockKeyhole, title: 'Sem cadastro', text: 'Nenhuma identificação pessoal é solicitada.' },
  { icon: ShieldCheck, title: 'Dados no aparelho', text: 'Os valores informados não são enviados à GSA.' },
  { icon: Scale, title: 'Uso educativo', text: 'O resultado orienta, mas não comprova direitos.' },
];

const CALCULATOR_DIALOG_STYLES = `
  [role="dialog"][aria-label^="Calculadora gratuita"] {
    isolation: isolate;
  }

  [role="dialog"][aria-label^="Calculadora gratuita"] input,
  [role="dialog"][aria-label^="Calculadora gratuita"] select,
  [role="dialog"][aria-label^="Calculadora gratuita"] button,
  [role="dialog"][aria-label^="Calculadora gratuita"] a {
    -webkit-tap-highlight-color: transparent;
  }

  .gsa-calculator-tool-nav {
    scrollbar-width: none;
    -webkit-overflow-scrolling: touch;
  }

  .gsa-calculator-tool-nav::-webkit-scrollbar {
    display: none;
  }

  @media (max-width: 767px) {
    [role="dialog"][aria-label^="Calculadora gratuita"] {
      width: 100vw !important;
      max-width: 100vw !important;
      height: 100dvh !important;
      max-height: 100dvh !important;
      margin: 0 !important;
      border: 0 !important;
      border-radius: 0 !important;
    }

    [role="dialog"][aria-label^="Calculadora gratuita"] > div {
      height: 100dvh !important;
      max-height: 100dvh !important;
    }

    [role="dialog"][aria-label^="Calculadora gratuita"] footer {
      padding-bottom: max(0.75rem, env(safe-area-inset-bottom)) !important;
    }

    .gsa-calculator-tool-nav > button {
      min-width: 148px;
      scroll-snap-align: start;
    }

    .gsa-calculator-workbench {
      border-radius: 0.85rem;
    }
  }
`;

function asNumber(value: string) {
  const normalized = value.trim().replace(/\./g, '').replace(',', '.');
  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? Math.max(0, parsed) : 0;
}

function NumberField({
  id,
  label,
  value,
  onChange,
  prefix,
  suffix,
  help,
  min = 0,
  max,
  step = 'any',
}: {
  id: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
  prefix?: string;
  suffix?: string;
  help?: string;
  min?: number;
  max?: number;
  step?: number | 'any';
}) {
  return (
    <label htmlFor={id} className="block">
      <span className="text-sm font-black text-[#26313a]">{label}</span>
      <span className="relative mt-2 block">
        {prefix && <span className="pointer-events-none absolute inset-y-0 left-4 flex items-center text-sm font-bold text-[#727c84]">{prefix}</span>}
        <input
          id={id}
          type="number"
          inputMode="decimal"
          min={min}
          max={max}
          step={step}
          value={value}
          onChange={(event) => onChange(event.target.value)}
          className={`min-h-12 w-full rounded-lg border border-[#d5cfc5] bg-white py-3 text-sm font-bold text-[#111820] outline-none transition placeholder:text-[#9aa0a4] hover:border-[#bbb1a1] focus:border-[#91722f] focus:ring-4 focus:ring-[#91722f]/10 ${prefix ? 'pl-12' : 'pl-4'} ${suffix ? 'pr-16' : 'pr-4'}`}
        />
        {suffix && <span className="pointer-events-none absolute inset-y-0 right-4 flex items-center text-xs font-bold text-[#727c84]">{suffix}</span>}
      </span>
      {help && <span className="mt-1.5 block text-xs leading-5 text-[#68727a]">{help}</span>}
    </label>
  );
}

function FormSection({
  number,
  title,
  description,
  children,
}: {
  number: string;
  title: string;
  description?: string;
  children: ReactNode;
}) {
  return (
    <section className="border-b border-[#e3ddd4] pb-7 last:border-0 last:pb-0">
      <div className="mb-5 flex items-start gap-3">
        <span className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full border border-[#c9b57f] bg-[#f7f0dc] text-[9px] font-black tracking-[0.08em] text-[#765b25]">{number}</span>
        <div>
          <h3 className="text-sm font-black text-[#111820]">{title}</h3>
          {description && <p className="mt-1 text-xs leading-5 text-[#6b747c]">{description}</p>}
        </div>
      </div>
      {children}
    </section>
  );
}

function ResultLine({ label, value, emphasized = false }: { label: string; value: string; emphasized?: boolean }) {
  return (
    <div className={`flex items-start justify-between gap-5 border-b border-white/10 py-3.5 last:border-0 ${emphasized ? 'text-[#f0d98f]' : 'text-white/76'}`}>
      <span className="text-sm leading-5">{label}</span>
      <strong className="shrink-0 text-right text-sm font-black sm:text-base">{value}</strong>
    </div>
  );
}

function ResultPanel({
  eyebrow,
  headline,
  summary,
  icon: Icon,
  children,
  note,
  action,
}: {
  eyebrow: string;
  headline: string;
  summary?: string;
  icon: ComponentType<{ className?: string }>;
  children: ReactNode;
  note?: ReactNode;
  action?: ReactNode;
}) {
  return (
    <aside className="bg-[#132231] p-5 text-white sm:p-7 lg:sticky lg:top-0 lg:self-start" aria-live="polite">
      <div className="flex items-center justify-between gap-3 border-b border-white/10 pb-4">
        <span className="inline-flex items-center gap-2 text-[9px] font-black uppercase tracking-[0.13em] text-[#d8bd73]"><span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />Resultado atualizado automaticamente</span>
        <BadgeCheck className="h-5 w-5 text-white/25" />
      </div>

      <div className="flex items-start justify-between gap-5 border-b border-white/10 py-6">
        <div>
          <p className="text-[10px] font-black uppercase tracking-[0.18em] text-[#d8bd73]">{eyebrow}</p>
          <p className="mt-2 text-3xl font-black leading-tight tracking-[-0.03em] sm:text-4xl">{headline}</p>
          {summary && <p className="mt-3 max-w-md text-sm leading-6 text-white/55">{summary}</p>}
        </div>
        <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-white/10 bg-white/[0.04] text-[#d8bd73]"><Icon className="h-5 w-5" /></span>
      </div>

      <div className="mt-3">{children}</div>
      {note && <div className="mt-6 flex gap-3 border-t border-white/10 pt-5 text-xs leading-5 text-white/55"><Info className="mt-0.5 h-4 w-4 shrink-0 text-[#d8bd73]" />{note}</div>}
      {action && <div className="mt-5">{action}</div>}
    </aside>
  );
}

function Workbench({
  title,
  description,
  children,
  result,
}: {
  title: string;
  description: string;
  children: ReactNode;
  result: ReactNode;
}) {
  return (
    <div className="gsa-calculator-workbench grid overflow-hidden rounded-2xl border border-[#d4cdc2] bg-white shadow-[0_24px_65px_rgba(29,36,42,0.11)] lg:grid-cols-[1.06fr_0.94fr]">
      <section className="min-w-0 bg-[#fffdfa]">
        <div className="border-b border-[#e2dcd2] bg-[#faf7f1] px-5 py-5 sm:px-7">
          <p className="text-[9px] font-black uppercase tracking-[0.16em] text-[#806128]">Dados para a simulação</p>
          <h3 className="mt-2 text-xl font-black tracking-[-0.025em] text-[#111820]">{title}</h3>
          <p className="mt-2 text-xs leading-5 text-[#68727a]">{description}</p>
        </div>
        <div className="space-y-7 p-5 sm:p-7 lg:p-8">{children}</div>
      </section>
      {result}
    </div>
  );
}

function TerminationCalculator() {
  const [salary, setSalary] = useState('3500');
  const [reason, setReason] = useState<TerminationReason>('without_cause');
  const [daysWorked, setDaysWorked] = useState('15');
  const [thirteenthMonths, setThirteenthMonths] = useState('7');
  const [vacationMonths, setVacationMonths] = useState('7');
  const [expiredVacation, setExpiredVacation] = useState(false);
  const [completedYears, setCompletedYears] = useState('2');
  const [fgtsBalance, setFgtsBalance] = useState('10000');

  const result = useMemo(() => calculateTerminationEstimate({
    salary: asNumber(salary),
    reason,
    daysWorked: asNumber(daysWorked),
    thirteenthMonths: asNumber(thirteenthMonths),
    vacationMonths: asNumber(vacationMonths),
    expiredVacation,
    completedYears: asNumber(completedYears),
    fgtsBalance: asNumber(fgtsBalance),
  }), [completedYears, daysWorked, expiredVacation, fgtsBalance, reason, salary, thirteenthMonths, vacationMonths]);

  const reset = () => {
    setSalary('3500');
    setReason('without_cause');
    setDaysWorked('15');
    setThirteenthMonths('7');
    setVacationMonths('7');
    setExpiredVacation(false);
    setCompletedYears('2');
    setFgtsBalance('10000');
  };

  const resultPanel = (
    <ResultPanel
      eyebrow="Total bruto aproximado"
      headline={currencyFormatter.format(result.total)}
      summary="Soma das parcelas consideradas com os dados informados. Descontos e situações especiais não estão incluídos."
      icon={Calculator}
      note="O saldo existente do FGTS não entra no total. A possibilidade de saque depende da modalidade e da situação do trabalhador."
    >
      <ResultLine label="Saldo de salário" value={currencyFormatter.format(result.salaryBalance)} />
      {result.notice > 0 && <ResultLine label={`Aviso-prévio (${decimalFormatter.format(result.noticeDays)} dias${reason === 'agreement' ? ', pela metade' : ''})`} value={currencyFormatter.format(result.notice)} />}
      <ResultLine label="13º proporcional" value={currencyFormatter.format(result.thirteenthValue)} />
      <ResultLine label="Férias proporcionais + 1/3" value={currencyFormatter.format(result.proportionalVacation)} />
      {expiredVacation && <ResultLine label="Férias vencidas + 1/3" value={currencyFormatter.format(result.expiredVacationValue)} />}
      <ResultLine label="Multa estimada do FGTS" value={currencyFormatter.format(result.fgtsPenalty)} />
    </ResultPanel>
  );

  return (
    <Workbench
      title="Preencha os dados do vínculo"
      description="O resultado é recalculado automaticamente sempre que um campo for alterado."
      result={resultPanel}
    >
      <FormSection number="01" title="Dados do vínculo" description="Informe o salário e o motivo do encerramento.">
        <div className="grid gap-5 sm:grid-cols-2">
          <NumberField id="termination-salary" label="Salário bruto mensal" value={salary} onChange={setSalary} prefix="R$" />
          <label htmlFor="termination-reason" className="block">
            <span className="text-sm font-black text-[#26313a]">Motivo do desligamento</span>
            <select id="termination-reason" value={reason} onChange={(event) => setReason(event.target.value as TerminationReason)} className="mt-2 min-h-12 w-full rounded-lg border border-[#d5cfc5] bg-white px-4 py-3 text-sm font-bold text-[#111820] outline-none transition hover:border-[#bbb1a1] focus:border-[#91722f] focus:ring-4 focus:ring-[#91722f]/10">
              <option value="without_cause">Demissão sem justa causa</option>
              <option value="agreement">Acordo entre as partes</option>
              <option value="resignation">Pedido de demissão</option>
              <option value="just_cause">Demissão por justa causa</option>
            </select>
          </label>
        </div>
      </FormSection>

      <FormSection number="02" title="Períodos considerados" description="Use números aproximados quando ainda não tiver o cálculo oficial.">
        <div className="grid gap-5 sm:grid-cols-2">
          <NumberField id="termination-days" label="Dias trabalhados no mês" value={daysWorked} onChange={setDaysWorked} suffix="dias" max={30} step={1} />
          <NumberField id="termination-years" label="Anos completos na empresa" value={completedYears} onChange={setCompletedYears} suffix="anos" max={20} step={1} help="Usado na estimativa do aviso-prévio." />
          <NumberField id="termination-thirteenth" label="Avos de 13º no ano" value={thirteenthMonths} onChange={setThirteenthMonths} suffix="/ 12" max={12} step={1} help="Conte meses com 15 dias ou mais trabalhados." />
          <NumberField id="termination-vacation" label="Avos de férias atuais" value={vacationMonths} onChange={setVacationMonths} suffix="/ 12" max={12} step={1} />
        </div>
      </FormSection>

      <FormSection number="03" title="FGTS e férias vencidas">
        <div className="grid gap-5 sm:grid-cols-2">
          <NumberField id="termination-fgts" label="Saldo aproximado do FGTS" value={fgtsBalance} onChange={setFgtsBalance} prefix="R$" help="A multa é estimada sobre o saldo informado." />
          <label className="flex min-h-12 cursor-pointer items-center gap-3 self-end rounded-lg border border-[#d5cfc5] bg-[#faf8f3] px-4 py-3 text-sm font-bold text-[#39444e] transition hover:border-[#bdb2a2]">
            <input type="checkbox" checked={expiredVacation} onChange={(event) => setExpiredVacation(event.target.checked)} className="h-4 w-4 accent-[#8a6e2f]" />
            Possui um período de férias vencidas
          </label>
        </div>
      </FormSection>

      <button type="button" onClick={reset} className="inline-flex min-h-11 items-center gap-2 rounded-lg border border-[#d5cec3] bg-white px-4 py-2 text-sm font-black text-[#59646d] transition hover:border-[#9d7c34] hover:text-[#111820] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#9d7c34]">
        <RotateCcw className="h-4 w-4" /> Restaurar dados de exemplo
      </button>
    </Workbench>
  );
}

function RequirementCard({ title, eligible, lines }: { title: string; eligible: boolean; lines: string[] }) {
  return (
    <article className={`rounded-xl border p-4 ${eligible ? 'border-emerald-300 bg-emerald-50' : 'border-white/10 bg-white/[0.04]'}`}>
      <div className="flex items-center gap-2">
        {eligible ? <CheckCircle2 className="h-5 w-5 text-emerald-600" /> : <Clock3 className="h-5 w-5 text-[#d8bd73]" />}
        <h3 className={`text-sm font-black ${eligible ? 'text-emerald-950' : 'text-white'}`}>{title}</h3>
      </div>
      <p className={`mt-3 text-xs font-black ${eligible ? 'text-emerald-700' : 'text-[#efd991]'}`}>{eligible ? 'Requisitos informados atingidos' : 'Ainda há requisitos pendentes'}</p>
      <ul className={`mt-3 space-y-1.5 text-xs leading-5 ${eligible ? 'text-emerald-800' : 'text-white/60'}`}>
        {lines.map((line) => <li key={line}>• {line}</li>)}
      </ul>
    </article>
  );
}

function RetirementCalculator() {
  const [gender, setGender] = useState<'woman' | 'man'>('woman');
  const [age, setAge] = useState('57');
  const [contribution, setContribution] = useState('29');
  const [beforeReform, setBeforeReform] = useState(true);

  const result = useMemo(() => evaluateRetirement2026({
    gender,
    age: asNumber(age),
    contributionYears: asNumber(contribution),
    contributedBeforeReform: beforeReform,
  }), [age, beforeReform, contribution, gender]);

  const missing = (current: number, target: number, label: string) => current >= target
    ? `${label}: requisito atingido`
    : `${label}: faltam ${decimalFormatter.format(target - current)} ano(s)`;

  const resultPanel = (
    <ResultPanel
      eyebrow="Panorama previdenciário"
      headline={result.anyEligible ? 'Há uma regra possível' : 'Continue acompanhando'}
      summary={`${decimalFormatter.format(result.currentAge)} anos de idade · ${decimalFormatter.format(result.contributionYears)} anos de contribuição · ${decimalFormatter.format(result.points)} pontos`}
      icon={Landmark}
      note="Pedágios, atividade especial, magistério, trabalho rural, deficiência e direito adquirido exigem análise própria e não estão incluídos."
      action={<a href="https://meu.inss.gov.br/" target="_blank" rel="noopener noreferrer" className="inline-flex min-h-11 items-center gap-2 rounded-lg border border-[#d8bd73]/40 px-4 py-2 text-sm font-black text-[#efd991] transition hover:bg-white/5 hover:text-white">Conferir no Meu INSS <ExternalLink className="h-4 w-4" /></a>}
    >
      <div className="grid gap-3 py-4 xl:grid-cols-3">
        <RequirementCard title="Regra geral" eligible={result.generalEligible} lines={[missing(result.currentAge, result.generalAge, 'Idade'), missing(result.contributionYears, result.generalContribution, 'Contribuição')]} />
        {beforeReform && <RequirementCard title="Regra dos pontos" eligible={result.pointsEligible} lines={[missing(result.points, result.transitionPoints, 'Pontuação'), missing(result.contributionYears, result.transitionContribution, 'Contribuição')]} />}
        {beforeReform && <RequirementCard title="Idade progressiva" eligible={result.progressiveEligible} lines={[missing(result.currentAge, result.progressiveAge, 'Idade'), missing(result.contributionYears, result.transitionContribution, 'Contribuição')]} />}
      </div>
    </ResultPanel>
  );

  return (
    <Workbench
      title="Informe seu panorama previdenciário"
      description="A ferramenta compara os dados informados com critérios básicos considerados para 2026."
      result={resultPanel}
    >
      <FormSection number="01" title="Perfil considerado" description="As regras usam critérios diferentes conforme o sexo informado.">
        <fieldset>
          <legend className="sr-only">Sexo considerado nas regras do INSS</legend>
          <div className="grid grid-cols-2 rounded-lg border border-[#ddd7ce] bg-[#ece9e2] p-1">
            {([['woman', 'Mulher'], ['man', 'Homem']] as const).map(([value, label]) => (
              <button key={value} type="button" onClick={() => setGender(value)} aria-pressed={gender === value} className={`min-h-11 rounded-md px-4 py-2.5 text-sm font-black transition ${gender === value ? 'bg-white text-[#111820] shadow-sm' : 'text-[#69727a] hover:text-[#25313b]'}`}>{label}</button>
            ))}
          </div>
        </fieldset>
      </FormSection>

      <FormSection number="02" title="Dados previdenciários" description="Considere vínculos e contribuições reconhecidos no CNIS.">
        <div className="grid gap-5 sm:grid-cols-2">
          <NumberField id="retirement-age" label="Idade atual" value={age} onChange={setAge} suffix="anos" max={100} step={0.5} />
          <NumberField id="retirement-contribution" label="Tempo total de contribuição" value={contribution} onChange={setContribution} suffix="anos" max={60} step={0.5} />
        </div>
      </FormSection>

      <FormSection number="03" title="Regras de transição">
        <label className="flex cursor-pointer items-start gap-3 rounded-lg border border-[#d5cfc5] bg-[#faf8f3] p-4 text-sm font-bold text-[#39444e] transition hover:border-[#bdb2a2]">
          <input type="checkbox" checked={beforeReform} onChange={(event) => setBeforeReform(event.target.checked)} className="mt-0.5 h-4 w-4 accent-[#8a6e2f]" />
          <span>Já contribuía para o INSS antes de 13/11/2019 <small className="mt-1 block font-medium leading-5 text-[#69727a]">Essa informação habilita as regras de transição avaliadas pela ferramenta.</small></span>
        </label>
      </FormSection>

      <div className="flex gap-3 border-l-2 border-[#c7a458] bg-[#f8f3e8] p-4 text-xs leading-5 text-[#65532e]">
        <FileCheck2 className="mt-0.5 h-4 w-4 shrink-0" />
        O resultado oficial depende do histórico completo de contribuições, vínculos, salários e eventuais períodos especiais.
      </div>
    </Workbench>
  );
}

function VacationCalculator() {
  const [salary, setSalary] = useState('3500');
  const [averages, setAverages] = useState('0');

  const result = useMemo(() => calculateVacationEstimate(asNumber(salary), asNumber(averages)), [averages, salary]);

  const reset = () => {
    setSalary('3500');
    setAverages('0');
  };

  const resultPanel = (
    <ResultPanel
      eyebrow="Total bruto estimado"
      headline={currencyFormatter.format(result.total)}
      summary="Valor antes dos descontos aplicáveis ao pagamento de férias."
      icon={Palmtree}
      note="O valor líquido pode variar conforme INSS, Imposto de Renda, faltas, médias e condições específicas do vínculo."
    >
      <ResultLine label="Remuneração de férias" value={currencyFormatter.format(result.remuneration)} />
      <ResultLine label="Adicional constitucional de 1/3" value={currencyFormatter.format(result.constitutionalThird)} />
      <ResultLine label="Total antes dos descontos" value={currencyFormatter.format(result.total)} emphasized />
    </ResultPanel>
  );

  return (
    <Workbench
      title="Informe a remuneração considerada"
      description="O total é atualizado automaticamente conforme os valores preenchidos."
      result={resultPanel}
    >
      <FormSection number="01" title="Remuneração mensal" description="Informe o salário e, quando houver, médias habituais de adicionais e variáveis.">
        <div className="grid gap-5 sm:grid-cols-2">
          <NumberField id="vacation-salary" label="Salário bruto mensal" value={salary} onChange={setSalary} prefix="R$" />
          <NumberField id="vacation-averages" label="Média de adicionais e variáveis" value={averages} onChange={setAverages} prefix="R$" help="Ex.: horas extras, adicional noturno e comissões habituais." />
        </div>
      </FormSection>

      <FormSection number="02" title="Condições consideradas">
        <div className="flex gap-3 border-l-2 border-[#c8aa64] bg-[#f7f2e6] p-4 text-xs leading-5 text-[#624f29]">
          <Info className="mt-0.5 h-4 w-4 shrink-0" />
          Esta versão considera 30 dias de férias. Não inclui venda de 10 dias, adiantamento do 13º, faltas injustificadas ou férias em dobro.
        </div>
      </FormSection>

      <button type="button" onClick={reset} className="inline-flex min-h-11 items-center gap-2 rounded-lg border border-[#d5cec3] bg-white px-4 py-2 text-sm font-black text-[#59646d] transition hover:border-[#9d7c34] hover:text-[#111820] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#9d7c34]">
        <RotateCcw className="h-4 w-4" /> Restaurar dados de exemplo
      </button>
    </Workbench>
  );
}

export function FreeToolsCalculatorDialog({ tool, onClose, onToolChange, onServices }: FreeToolsCalculatorDialogProps) {
  const presentation = tool ? TOOL_PRESENTATION[tool] : null;
  const Icon = presentation?.icon ?? Calculator;

  return (
    <>
      <style>{CALCULATOR_DIALOG_STYLES}</style>
      <AccessibleDialog
        isOpen={Boolean(tool)}
        onClose={onClose}
        ariaLabel={presentation ? `Calculadora gratuita — ${presentation.title}` : 'Calculadora gratuita'}
        panelClassName="max-w-[1240px] overflow-hidden rounded-2xl border border-[#beb5a7] bg-[#f4efe6] shadow-[0_38px_110px_rgba(4,12,18,0.48)]"
        overlayClassName="items-center justify-center overflow-y-auto bg-[#07101b]/88 p-0 backdrop-blur-sm sm:p-5"
        zIndexClassName="z-[130]"
      >
        <div className="flex max-h-[calc(100dvh-0.75rem)] min-h-0 flex-col sm:max-h-[calc(100dvh-2.5rem)]">
          <div className="flex min-h-9 items-center justify-between gap-4 bg-[#111e2a] px-4 py-2 text-white sm:px-6">
            <div className="flex items-center gap-3">
              <strong className="text-[10px] font-black tracking-[0.18em] text-[#d8bd73]">GSA HUB</strong>
              <span className="h-3 w-px bg-white/20" />
              <span className="text-[9px] font-bold uppercase tracking-[0.14em] text-white/50">Centro de ferramentas públicas</span>
            </div>
            <span className="hidden items-center gap-2 text-[9px] font-black uppercase tracking-[0.12em] text-white/45 sm:inline-flex"><span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />Acesso público</span>
          </div>

          <header className="sticky top-0 z-30 flex items-start justify-between gap-4 border-b border-[#d6cec2] bg-[#faf7f0]/97 px-4 py-4 backdrop-blur sm:px-6 sm:py-5">
            <div className="flex min-w-0 items-start gap-3 sm:gap-4">
              <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-[#172433] text-[#d8bd73] shadow-[inset_0_0_0_1px_rgba(216,189,115,0.22)]"><Icon className="h-5 w-5" /></span>
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                  <p className="text-[9px] font-black uppercase tracking-[0.18em] text-[#806128] sm:text-[10px]">{presentation?.category}</p>
                  <span className="text-[9px] font-black tracking-[0.16em] text-[#989084]">{presentation?.code}</span>
                </div>
                <h2 className="mt-1 text-xl font-black leading-tight tracking-[-0.025em] text-[#111820] sm:text-2xl">{presentation?.title}</h2>
              </div>
            </div>
            <button type="button" onClick={onClose} aria-label="Fechar calculadora" className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full border border-[#d1c9bd] bg-white text-[#5c6670] transition hover:border-[#9d7c34] hover:text-[#111820] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#9d7c34]">
              <X className="h-5 w-5" />
            </button>
          </header>

          <nav className="gsa-calculator-tool-nav flex shrink-0 snap-x gap-2 overflow-x-auto border-b border-[#d9d2c7] bg-[#f2ede4] px-3 py-3 sm:px-6" aria-label="Escolher calculadora">
            {TOOL_ORDER.map((toolId) => {
              const item = TOOL_PRESENTATION[toolId];
              const ItemIcon = item.icon;
              const selected = tool === toolId;
              return (
                <button
                  key={toolId}
                  type="button"
                  onClick={() => onToolChange(toolId)}
                  aria-pressed={selected}
                  className={`flex min-h-12 snap-start items-center gap-3 rounded-lg border px-4 py-2 text-left transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#91722f] ${selected ? 'border-[#172433] bg-[#172433] text-white shadow-sm' : 'border-[#d5cec2] bg-white/70 text-[#4d5962] hover:border-[#a9915d] hover:bg-white'}`}
                >
                  <ItemIcon className={`h-4 w-4 shrink-0 ${selected ? 'text-[#d8bd73]' : 'text-[#8a6e2f]'}`} />
                  <span>
                    <strong className="block text-xs">{item.shortTitle}</strong>
                    <span className={`mt-0.5 block text-[9px] font-bold tracking-[0.1em] ${selected ? 'text-white/45' : 'text-[#969089]'}`}>{item.code}</span>
                  </span>
                </button>
              );
            })}
          </nav>

          <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain">
            <section className="border-b border-[#ddd6cb] bg-[#eee8dd] px-4 py-5 sm:px-6">
              <div className="grid gap-5 xl:grid-cols-[1fr_560px] xl:items-center">
                <div>
                  <p className="max-w-3xl text-sm leading-6 text-[#59646d] sm:text-base">{presentation?.description}</p>
                  <p className="mt-3 flex gap-2 text-xs leading-5 text-[#756a58]"><FileCheck2 className="mt-0.5 h-4 w-4 shrink-0 text-[#8a6e2f]" /><span><strong className="text-[#4f4536]">Escopo desta consulta:</strong> {presentation?.scope}</span></p>
                </div>
                <div className="grid overflow-hidden rounded-xl border border-[#d4cdc1] bg-white/65 sm:grid-cols-3">
                  {TRUST_ITEMS.map(({ icon: TrustIcon, title, text }, index) => (
                    <div key={title} className={`flex gap-3 px-4 py-3 ${index > 0 ? 'border-t border-[#ddd6cb] sm:border-l sm:border-t-0' : ''}`}>
                      <TrustIcon className="mt-0.5 h-4 w-4 shrink-0 text-[#8a6e2f]" />
                      <span><strong className="block text-[10px] font-black text-[#36414a]">{title}</strong><span className="mt-1 block text-[9px] leading-4 text-[#747c82]">{text}</span></span>
                    </div>
                  ))}
                </div>
              </div>
            </section>

            <main className="p-3 sm:p-6">
              {tool === 'termination' && <TerminationCalculator />}
              {tool === 'retirement' && <RetirementCalculator />}
              {tool === 'vacation' && <VacationCalculator />}
            </main>
          </div>

          <footer className="flex flex-col gap-3 border-t border-[#d7d0c5] bg-[#faf7f0] px-4 py-3 sm:flex-row sm:items-center sm:justify-between sm:px-6">
            <div className="max-w-2xl">
              <p className="text-[11px] font-bold text-[#4f5961]">Resultado informativo e educativo.</p>
              <p className="mt-0.5 text-[10px] leading-4 text-[#7a8288]">Não comprova direitos nem substitui documentos, cálculo oficial ou orientação profissional.</p>
            </div>
            <div className="flex flex-col gap-2 sm:flex-row">
              <button type="button" onClick={onServices} className="inline-flex min-h-11 items-center justify-center gap-2 rounded-lg border border-[#b89a58] bg-[#f5ecd5] px-4 py-2 text-sm font-black text-[#654f20] transition hover:bg-[#eee0bb] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#9d7c34]">Conhecer atendimento GSA <ArrowRight className="h-4 w-4" /></button>
              <button type="button" onClick={onClose} className="inline-flex min-h-11 items-center justify-center rounded-lg bg-[#172433] px-5 py-2.5 text-sm font-black text-white transition hover:bg-[#22364a] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#9d7c34]">Fechar ferramenta</button>
            </div>
          </footer>
        </div>
      </AccessibleDialog>
    </>
  );
}
