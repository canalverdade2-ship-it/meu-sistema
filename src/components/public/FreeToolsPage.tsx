import { useMemo, useState, type ComponentType, type ReactNode } from 'react';
import {
  ArrowLeft,
  ArrowRight,
  Baby,
  BriefcaseBusiness,
  Calculator,
  Check,
  CheckCircle2,
  Clock3,
  HandCoins,
  HeartHandshake,
  Info,
  Landmark,
  Palmtree,
  RotateCcw,
  ShieldCheck,
} from 'lucide-react';
import {
  calculateTerminationEstimate,
  calculateVacationEstimate,
  evaluateRetirement2026,
  type TerminationReason,
} from '../../lib/freeToolsCalculations';

type ToolId = 'termination' | 'retirement' | 'vacation';

interface FreeToolsPageProps {
  onBack: () => void;
  onServices: () => void;
}

interface ToolCard {
  id: ToolId | 'thirteenth' | 'benefits' | 'bpc';
  icon: ComponentType<{ className?: string }>;
  number: string;
  title: string;
  description: string;
  category: string;
  useCase: string;
  includes: string[];
  available: boolean;
}

const TOOLS: ToolCard[] = [
  {
    id: 'termination',
    icon: BriefcaseBusiness,
    number: '01',
    title: 'Rescisão trabalhista',
    description: 'Uma estimativa organizada das principais verbas de encerramento do vínculo CLT.',
    category: 'Trabalhista',
    useCase: 'Para compreender a composição aproximada de uma rescisão antes da conferência oficial.',
    includes: ['Saldo de salário', 'Aviso-prévio', '13º e férias', 'Multa estimada do FGTS'],
    available: true,
  },
  {
    id: 'retirement',
    icon: Landmark,
    number: '02',
    title: 'Aposentadoria pelo INSS',
    description: 'Um panorama inicial das regras geral e de transição consideradas para 2026.',
    category: 'Previdenciário',
    useCase: 'Para comparar idade e contribuição informadas com critérios previdenciários básicos.',
    includes: ['Regra geral', 'Regra dos pontos', 'Idade progressiva', 'Pendências por requisito'],
    available: true,
  },
  {
    id: 'vacation',
    icon: Palmtree,
    number: '03',
    title: 'Cálculo de férias',
    description: 'Uma estimativa bruta da remuneração de férias e do adicional constitucional de um terço.',
    category: 'Trabalhista',
    useCase: 'Para entender o valor bruto antes de descontos e condições específicas do vínculo.',
    includes: ['Salário mensal', 'Médias variáveis', 'Adicional de 1/3', 'Total bruto estimado'],
    available: true,
  },
  {
    id: 'thirteenth',
    icon: HandCoins,
    number: '04',
    title: '13º salário',
    description: 'Simulação das parcelas e do valor proporcional aos meses trabalhados no ano.',
    category: 'Trabalhista',
    useCase: 'Para visualizar a formação aproximada do décimo terceiro salário.',
    includes: ['Meses trabalhados', 'Primeira parcela', 'Segunda parcela', 'Valor proporcional'],
    available: false,
  },
  {
    id: 'benefits',
    icon: Baby,
    number: '05',
    title: 'Benefícios do INSS',
    description: 'Orientação inicial sobre incapacidade, salário-maternidade, pensão e outros benefícios.',
    category: 'Previdenciário',
    useCase: 'Para identificar quais informações precisam ser reunidas antes de uma análise completa.',
    includes: ['Tipo de benefício', 'Qualidade de segurado', 'Carência', 'Documentação inicial'],
    available: false,
  },
  {
    id: 'bpc',
    icon: HeartHandshake,
    number: '06',
    title: 'BPC / LOAS',
    description: 'Triagem educativa dos critérios básicos do benefício assistencial.',
    category: 'Assistencial',
    useCase: 'Para compreender os pontos que normalmente precisam ser avaliados no pedido.',
    includes: ['Renda familiar', 'Grupo familiar', 'Impedimento de longo prazo', 'Cadastro social'],
    available: false,
  },
];

const currencyFormatter = new Intl.NumberFormat('pt-BR', {
  style: 'currency',
  currency: 'BRL',
});

const decimalFormatter = new Intl.NumberFormat('pt-BR', {
  minimumFractionDigits: 0,
  maximumFractionDigits: 1,
});

function asNumber(value: string) {
  const normalized = value.trim().replace(/\./g, '').replace(',', '.');
  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? Math.max(0, parsed) : 0;
}

function scrollToCalculator(id: ToolId) {
  window.requestAnimationFrame(() => {
    document.getElementById(`calculadora-${id}`)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  });
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
      <span className="text-sm font-black text-[#25313b]">{label}</span>
      <span className="relative mt-2 block">
        {prefix && <span className="pointer-events-none absolute inset-y-0 left-4 flex items-center text-sm font-bold text-[#7b838a]">{prefix}</span>}
        <input
          id={id}
          type="number"
          inputMode="decimal"
          min={min}
          max={max}
          step={step}
          value={value}
          onChange={(event) => onChange(event.target.value)}
          className={`min-h-12 w-full rounded-lg border border-[#d7d1c6] bg-white py-3 text-sm font-bold text-[#121a21] outline-none transition focus:border-[#8a6e2f] focus:ring-4 focus:ring-[#8a6e2f]/10 ${prefix ? 'pl-12' : 'pl-4'} ${suffix ? 'pr-16' : 'pr-4'}`}
        />
        {suffix && <span className="pointer-events-none absolute inset-y-0 right-4 flex items-center text-xs font-bold text-[#7b838a]">{suffix}</span>}
      </span>
      {help && <span className="mt-1.5 block text-xs leading-5 text-[#69727a]">{help}</span>}
    </label>
  );
}

function ResultLine({ label, value, emphasized = false }: { label: string; value: string; emphasized?: boolean }) {
  return (
    <div className={`flex items-center justify-between gap-4 border-b border-white/10 py-3.5 last:border-0 ${emphasized ? 'text-[#efd991]' : 'text-white/75'}`}>
      <span className="text-sm">{label}</span>
      <strong className="shrink-0 text-sm font-black sm:text-base">{value}</strong>
    </div>
  );
}

function CalculatorShell({
  id,
  icon: Icon,
  eyebrow,
  title,
  description,
  onClose,
  children,
}: {
  id: string;
  icon: ComponentType<{ className?: string }>;
  eyebrow: string;
  title: string;
  description: string;
  onClose: () => void;
  children: ReactNode;
}) {
  return (
    <section id={id} className="scroll-mt-24 border-t border-[#d7d1c6] bg-[#f8f5ef] py-14 sm:py-20">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="flex flex-col gap-6 border-b border-[#d7d1c6] pb-8 sm:flex-row sm:items-end sm:justify-between">
          <div className="max-w-3xl">
            <button type="button" onClick={onClose} className="inline-flex min-h-11 items-center gap-2 text-sm font-black text-[#66717a] transition hover:text-[#111820] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#8a6e2f]">
              <ArrowLeft className="h-4 w-4" /> Voltar às ferramentas
            </button>
            <div className="mt-7 flex items-start gap-4">
              <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-[#172433] text-[#d8bd73]"><Icon className="h-6 w-6" /></span>
              <div>
                <p className="text-[10px] font-black uppercase tracking-[0.2em] text-[#806128]">{eyebrow}</p>
                <h2 className="mt-2 text-3xl font-black tracking-[-0.035em] text-[#111820] sm:text-4xl">{title}</h2>
                <p className="mt-3 text-sm leading-7 text-[#5f6972] sm:text-base">{description}</p>
              </div>
            </div>
          </div>
          <div className="max-w-sm border-l-2 border-[#c8aa64] pl-4 text-xs leading-5 text-[#69727a]">
            Resultado educativo. Confira documentos, regras aplicáveis e cálculos oficiais antes de tomar uma decisão.
          </div>
        </div>
        <div className="mt-8">{children}</div>
      </div>
    </section>
  );
}

function TerminationCalculator({ onClose }: { onClose: () => void }) {
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

  return (
    <CalculatorShell
      id="calculadora-termination"
      icon={BriefcaseBusiness}
      eyebrow="Ferramenta trabalhista"
      title="Estimativa de rescisão CLT"
      description="Informe os dados básicos do vínculo para obter uma estimativa bruta das principais verbas. A conta não considera descontos, médias, convenções coletivas ou situações especiais."
      onClose={onClose}
    >
      <div className="grid overflow-hidden rounded-2xl border border-[#d7d1c6] bg-white shadow-[0_24px_60px_rgba(30,37,43,0.08)] lg:grid-cols-[1.05fr_0.95fr]">
        <form className="grid gap-5 p-5 sm:grid-cols-2 sm:p-8" onSubmit={(event) => event.preventDefault()}>
          <NumberField id="termination-salary" label="Salário bruto mensal" value={salary} onChange={setSalary} prefix="R$" />
          <label htmlFor="termination-reason" className="block">
            <span className="text-sm font-black text-[#25313b]">Motivo do desligamento</span>
            <select id="termination-reason" value={reason} onChange={(event) => setReason(event.target.value as typeof reason)} className="mt-2 min-h-12 w-full rounded-lg border border-[#d7d1c6] bg-white px-4 py-3 text-sm font-bold text-[#121a21] outline-none transition focus:border-[#8a6e2f] focus:ring-4 focus:ring-[#8a6e2f]/10">
              <option value="without_cause">Demissão sem justa causa</option>
              <option value="agreement">Acordo entre as partes</option>
              <option value="resignation">Pedido de demissão</option>
              <option value="just_cause">Demissão por justa causa</option>
            </select>
          </label>
          <NumberField id="termination-days" label="Dias trabalhados no mês" value={daysWorked} onChange={setDaysWorked} suffix="dias" max={30} step={1} />
          <NumberField id="termination-thirteenth" label="Avos de 13º no ano" value={thirteenthMonths} onChange={setThirteenthMonths} suffix="/ 12" max={12} step={1} help="Conte meses com 15 dias ou mais trabalhados." />
          <NumberField id="termination-vacation" label="Avos de férias atuais" value={vacationMonths} onChange={setVacationMonths} suffix="/ 12" max={12} step={1} />
          <NumberField id="termination-years" label="Anos completos na empresa" value={completedYears} onChange={setCompletedYears} suffix="anos" max={20} step={1} help="Usado apenas na estimativa do aviso-prévio." />
          <NumberField id="termination-fgts" label="Saldo aproximado do FGTS" value={fgtsBalance} onChange={setFgtsBalance} prefix="R$" help="A multa é estimada sobre o saldo informado." />
          <label className="flex min-h-12 cursor-pointer items-center gap-3 self-end rounded-lg border border-[#d7d1c6] bg-[#faf8f3] px-4 py-3 text-sm font-bold text-[#39444e]">
            <input type="checkbox" checked={expiredVacation} onChange={(event) => setExpiredVacation(event.target.checked)} className="h-4 w-4 accent-[#8a6e2f]" />
            Possui 1 período de férias vencidas
          </label>
          <button type="button" onClick={reset} className="inline-flex min-h-11 w-fit items-center gap-2 text-sm font-black text-[#68727a] transition hover:text-[#111820] sm:col-span-2"><RotateCcw className="h-4 w-4" /> Restaurar exemplo</button>
        </form>

        <aside className="bg-[linear-gradient(180deg,#172433_0%,#0d1823_100%)] p-5 text-white sm:p-8" aria-live="polite">
          <div className="flex items-center justify-between gap-4 border-b border-white/10 pb-6">
            <div>
              <p className="text-[10px] font-black uppercase tracking-[0.18em] text-[#d8bd73]">Resultado estimado</p>
              <p className="mt-2 text-3xl font-black sm:text-4xl">{currencyFormatter.format(result.total)}</p>
            </div>
            <Calculator className="h-8 w-8 text-white/20" />
          </div>
          <div className="mt-3">
            <ResultLine label="Saldo de salário" value={currencyFormatter.format(result.salaryBalance)} />
            {result.notice > 0 && <ResultLine label={`Aviso-prévio (${decimalFormatter.format(result.noticeDays)} dias${reason === 'agreement' ? ', pela metade' : ''})`} value={currencyFormatter.format(result.notice)} />}
            <ResultLine label="13º proporcional" value={currencyFormatter.format(result.thirteenthValue)} />
            <ResultLine label="Férias proporcionais + 1/3" value={currencyFormatter.format(result.proportionalVacation)} />
            {expiredVacation && <ResultLine label="Férias vencidas + 1/3" value={currencyFormatter.format(result.expiredVacationValue)} />}
            <ResultLine label="Multa estimada do FGTS" value={currencyFormatter.format(result.fgtsPenalty)} />
          </div>
          <p className="mt-6 flex gap-2 border-t border-white/10 pt-5 text-xs leading-5 text-white/55"><Info className="mt-0.5 h-4 w-4 shrink-0 text-[#d8bd73]" /> O saldo existente do FGTS não entra no total acima. A possibilidade de saque depende da modalidade e da situação do trabalhador.</p>
        </aside>
      </div>
    </CalculatorShell>
  );
}

function RequirementCard({ title, eligible, lines }: { title: string; eligible: boolean; lines: string[] }) {
  return (
    <article className={`rounded-xl border p-5 ${eligible ? 'border-emerald-300 bg-emerald-50' : 'border-white/10 bg-white/[0.04]'}`}>
      <div className="flex items-center gap-2">
        {eligible ? <CheckCircle2 className="h-5 w-5 text-emerald-600" /> : <Clock3 className="h-5 w-5 text-[#d8bd73]" />}
        <h3 className={`font-black ${eligible ? 'text-emerald-950' : 'text-white'}`}>{title}</h3>
      </div>
      <p className={`mt-3 text-sm font-black ${eligible ? 'text-emerald-700' : 'text-[#efd991]'}`}>{eligible ? 'Requisitos informados atingidos' : 'Ainda há requisitos pendentes'}</p>
      <ul className={`mt-3 space-y-1.5 text-xs leading-5 ${eligible ? 'text-emerald-800' : 'text-white/60'}`}>
        {lines.map((line) => <li key={line}>• {line}</li>)}
      </ul>
    </article>
  );
}

function RetirementCalculator({ onClose }: { onClose: () => void }) {
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

  return (
    <CalculatorShell
      id="calculadora-retirement"
      icon={Landmark}
      eyebrow="Ferramenta previdenciária · regras de 2026"
      title="Panorama de aposentadoria pelo INSS"
      description="Compare os dados informados com a regra geral e com duas regras de transição de 2026. O histórico completo do CNIS pode alterar o resultado oficial."
      onClose={onClose}
    >
      <div className="grid overflow-hidden rounded-2xl border border-[#d7d1c6] bg-white shadow-[0_24px_60px_rgba(30,37,43,0.08)] lg:grid-cols-[0.8fr_1.2fr]">
        <form className="grid content-start gap-5 p-5 sm:p-8" onSubmit={(event) => event.preventDefault()}>
          <fieldset>
            <legend className="text-sm font-black text-[#25313b]">Sexo considerado nas regras do INSS</legend>
            <div className="mt-2 grid grid-cols-2 rounded-lg bg-[#ece9e2] p-1">
              {([['woman', 'Mulher'], ['man', 'Homem']] as const).map(([value, label]) => (
                <button key={value} type="button" onClick={() => setGender(value)} aria-pressed={gender === value} className={`min-h-11 rounded-md px-4 py-2.5 text-sm font-black transition ${gender === value ? 'bg-white text-[#111820] shadow-sm' : 'text-[#69727a] hover:text-[#25313b]'}`}>{label}</button>
              ))}
            </div>
          </fieldset>
          <NumberField id="retirement-age" label="Idade atual" value={age} onChange={setAge} suffix="anos" max={100} step={0.5} />
          <NumberField id="retirement-contribution" label="Tempo total de contribuição" value={contribution} onChange={setContribution} suffix="anos" max={60} step={0.5} help="Considere vínculos e contribuições reconhecidos no CNIS." />
          <label className="flex cursor-pointer items-start gap-3 rounded-lg border border-[#d7d1c6] bg-[#faf8f3] p-4 text-sm font-bold text-[#39444e]">
            <input type="checkbox" checked={beforeReform} onChange={(event) => setBeforeReform(event.target.checked)} className="mt-0.5 h-4 w-4 accent-[#8a6e2f]" />
            <span>Já contribuía para o INSS antes de 13/11/2019 <small className="mt-1 block font-medium leading-5 text-[#69727a]">Essa informação habilita as regras de transição.</small></span>
          </label>
        </form>

        <aside className="bg-[linear-gradient(180deg,#172433_0%,#0d1823_100%)] p-5 text-white sm:p-8" aria-live="polite">
          <div className="flex flex-wrap items-start justify-between gap-4 border-b border-white/10 pb-6">
            <div>
              <p className="text-[10px] font-black uppercase tracking-[0.18em] text-[#d8bd73]">Seu panorama em 2026</p>
              <p className="mt-2 text-2xl font-black sm:text-3xl">{result.anyEligible ? 'Há uma regra possível' : 'Continue acompanhando'}</p>
              <p className="mt-2 text-sm text-white/55">{decimalFormatter.format(result.currentAge)} anos de idade · {decimalFormatter.format(result.contributionYears)} anos de contribuição · {decimalFormatter.format(result.points)} pontos</p>
            </div>
            <Landmark className="h-8 w-8 text-white/20" />
          </div>
          <div className="mt-7 grid gap-3 xl:grid-cols-3">
            <RequirementCard title="Regra geral" eligible={result.generalEligible} lines={[missing(result.currentAge, result.generalAge, 'Idade'), missing(result.contributionYears, result.generalContribution, 'Contribuição')]} />
            {beforeReform && <RequirementCard title="Regra dos pontos" eligible={result.pointsEligible} lines={[missing(result.points, result.transitionPoints, 'Pontuação'), missing(result.contributionYears, result.transitionContribution, 'Contribuição')]} />}
            {beforeReform && <RequirementCard title="Idade progressiva" eligible={result.progressiveEligible} lines={[missing(result.currentAge, result.progressiveAge, 'Idade'), missing(result.contributionYears, result.transitionContribution, 'Contribuição')]} />}
          </div>
          <p className="mt-6 flex gap-2 border-t border-white/10 pt-5 text-xs leading-5 text-white/55"><Info className="mt-0.5 h-4 w-4 shrink-0 text-[#d8bd73]" /> Pedágios, atividade especial, magistério, trabalho rural, deficiência e direito adquirido exigem uma análise própria e não estão incluídos.</p>
          <a href="https://meu.inss.gov.br/" target="_blank" rel="noopener noreferrer" className="mt-5 inline-flex min-h-11 items-center gap-2 text-sm font-black text-[#efd991] hover:text-white">Conferir no Meu INSS <ArrowRight className="h-4 w-4" /></a>
        </aside>
      </div>
    </CalculatorShell>
  );
}

function VacationCalculator({ onClose }: { onClose: () => void }) {
  const [salary, setSalary] = useState('3500');
  const [averages, setAverages] = useState('0');

  const result = useMemo(() => calculateVacationEstimate(asNumber(salary), asNumber(averages)), [averages, salary]);

  return (
    <CalculatorShell
      id="calculadora-vacation"
      icon={Palmtree}
      eyebrow="Ferramenta trabalhista"
      title="Estimativa bruta de férias"
      description="Calcule a remuneração de 30 dias de férias com o adicional constitucional de 1/3, antes dos descontos aplicáveis."
      onClose={onClose}
    >
      <div className="grid overflow-hidden rounded-2xl border border-[#d7d1c6] bg-white shadow-[0_24px_60px_rgba(30,37,43,0.08)] lg:grid-cols-2">
        <form className="grid content-start gap-5 p-5 sm:p-8" onSubmit={(event) => event.preventDefault()}>
          <NumberField id="vacation-salary" label="Salário bruto mensal" value={salary} onChange={setSalary} prefix="R$" />
          <NumberField id="vacation-averages" label="Média de adicionais e variáveis" value={averages} onChange={setAverages} prefix="R$" help="Ex.: horas extras, adicional noturno e comissões habituais. Se não houver, deixe zero." />
          <div className="border-l-2 border-[#c8aa64] bg-[#f7f2e6] p-4 text-xs leading-5 text-[#624f29]">
            Esta versão considera 30 dias de férias e não inclui venda de 10 dias, adiantamento do 13º, faltas injustificadas ou férias em dobro.
          </div>
        </form>
        <aside className="bg-[linear-gradient(180deg,#172433_0%,#0d1823_100%)] p-5 text-white sm:p-8" aria-live="polite">
          <p className="text-[10px] font-black uppercase tracking-[0.18em] text-[#d8bd73]">Total bruto estimado</p>
          <p className="mt-2 text-3xl font-black sm:text-4xl">{currencyFormatter.format(result.total)}</p>
          <div className="mt-7 border-t border-white/10 pt-3">
            <ResultLine label="Remuneração de férias" value={currencyFormatter.format(result.remuneration)} />
            <ResultLine label="Adicional constitucional de 1/3" value={currencyFormatter.format(result.constitutionalThird)} />
            <ResultLine label="Total antes dos descontos" value={currencyFormatter.format(result.total)} emphasized />
          </div>
        </aside>
      </div>
    </CalculatorShell>
  );
}

export function FreeToolsPage({ onBack, onServices }: FreeToolsPageProps) {
  const [activeTool, setActiveTool] = useState<ToolId | null>(null);

  const openTool = (tool: ToolId) => {
    setActiveTool(tool);
    scrollToCalculator(tool);
  };

  return (
    <main className="overflow-x-clip bg-[#eee9df] pt-[73px] text-[#17202a]">
      <section className="relative overflow-hidden border-b border-[#d4ccbe] bg-[linear-gradient(135deg,#faf7f0_0%,#f3ede2_56%,#e9dfcf_100%)]">
        <div className="pointer-events-none absolute -right-40 -top-40 h-[34rem] w-[34rem] rounded-full border border-[#b8903e]/15" />
        <div className="pointer-events-none absolute right-10 top-12 h-64 w-64 rounded-full bg-[#d8bd73]/14 blur-3xl" />

        <div className="relative mx-auto max-w-7xl px-4 py-10 sm:px-6 sm:py-16 lg:px-8 lg:py-20">
          <button type="button" onClick={onBack} className="inline-flex min-h-11 items-center gap-2 rounded-lg border border-[#cfc5b5] bg-white/65 px-4 py-2 text-sm font-black text-[#52606a] transition hover:border-[#9f8140] hover:bg-white hover:text-[#17202a] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#9f8140]"><ArrowLeft className="h-4 w-4" /> Voltar ao início</button>

          <div className="mt-10 grid items-stretch gap-10 lg:grid-cols-[1.08fr_0.92fr] lg:gap-16">
            <div className="flex flex-col justify-center border-l-2 border-[#c7a458] pl-5 sm:pl-7">
              <p className="flex items-center gap-3 text-[10px] font-black uppercase tracking-[0.22em] text-[#806128] sm:text-xs"><span className="h-px w-8 bg-[#b8903e]" />Serviços públicos GSA</p>
              <h1 className="mt-5 max-w-[14ch] text-4xl font-black leading-[1.03] tracking-[-0.045em] text-[#111820] sm:text-5xl lg:text-[3.8rem]">
                Ferramentas gratuitas para orientar decisões com mais clareza.
              </h1>
              <p className="mt-6 max-w-2xl text-base leading-8 text-[#5b6570] sm:text-lg">
                Simuladores educativos para questões trabalhistas e previdenciárias, desenvolvidos para apresentar critérios, limites e resultados de forma responsável.
              </p>
              <div className="mt-8 flex flex-wrap gap-x-6 gap-y-3 text-xs font-bold text-[#56616a]">
                {['Sem cadastro', 'Sem envio de dados', 'Acesso imediato'].map((item) => <span key={item} className="inline-flex items-center gap-2"><CheckCircle2 className="h-4 w-4 text-[#8a6e2f]" />{item}</span>)}
              </div>
            </div>

            <aside className="overflow-hidden rounded-2xl border border-[#d8bd73]/30 bg-[linear-gradient(180deg,#172635_0%,#0d1924_100%)] text-white shadow-[inset_0_3px_0_#d8bd73,0_30px_70px_rgba(18,27,36,0.2)]">
              <div className="border-b border-white/10 px-5 py-6 sm:px-7">
                <p className="text-[10px] font-black uppercase tracking-[0.2em] text-[#d8bd73]">Uso responsável</p>
                <h2 className="mt-3 text-2xl font-black leading-tight">Informação inicial, não uma decisão automática.</h2>
                <p className="mt-3 text-sm leading-6 text-white/55">Cada ferramenta apresenta uma estimativa e deixa visível o que não está incluído.</p>
              </div>
              <div className="divide-y divide-white/10 px-5 sm:px-7">
                {[
                  ['01', 'Informe os dados básicos', 'Preencha somente as informações necessárias para a simulação.'],
                  ['02', 'Leia a composição do resultado', 'Entenda as parcelas, critérios e pendências exibidas.'],
                  ['03', 'Confirme nos canais oficiais', 'Use documentos e atendimento especializado quando a situação exigir.'],
                ].map(([number, title, text]) => (
                  <div key={number} className="grid grid-cols-[36px_1fr] gap-3 py-5">
                    <span className="text-[10px] font-black tracking-[0.18em] text-[#d8bd73]">{number}</span>
                    <div><strong className="block text-sm">{title}</strong><span className="mt-1 block text-xs leading-5 text-white/50">{text}</span></div>
                  </div>
                ))}
              </div>
            </aside>
          </div>
        </div>
      </section>

      <section className="py-14 sm:py-20" aria-labelledby="free-tools-title">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="grid gap-8 border-b border-[#d4ccbe] pb-8 lg:grid-cols-[1fr_0.7fr] lg:items-end">
            <div className="max-w-3xl">
              <p className="text-[10px] font-black uppercase tracking-[0.2em] text-[#806128]">Central de ferramentas</p>
              <h2 id="free-tools-title" className="mt-3 text-3xl font-black tracking-[-0.035em] text-[#111820] sm:text-5xl">Escolha a análise que precisa iniciar.</h2>
              <p className="mt-4 max-w-2xl text-sm leading-7 text-[#606a73] sm:text-base">As ferramentas disponíveis realizam o cálculo diretamente no seu navegador. As demais aparecem como parte do desenvolvimento futuro desta área pública.</p>
            </div>
            <div className="border-l-2 border-[#c7a458] pl-5 text-sm leading-6 text-[#626c75]">
              Nenhum CPF, nome, telefone ou documento é solicitado para utilizar as calculadoras.
            </div>
          </div>

          <div className="mt-8 grid gap-5 md:grid-cols-2 xl:grid-cols-3">
            {TOOLS.map(({ id, icon: Icon, number, title, description, category, useCase, includes, available }) => {
              const content = (
                <>
                  <div className="flex items-start justify-between gap-4">
                    <span className={`flex h-11 w-11 items-center justify-center rounded-xl ${available ? 'bg-[#172433] text-[#d8bd73]' : 'bg-[#e7e2d9] text-[#8b8f91]'}`}><Icon className="h-5 w-5" /></span>
                    <span className="text-[10px] font-black tracking-[0.2em] text-[#9b7c33]">{number}</span>
                  </div>
                  <div className="mt-7">
                    <div className="flex items-center justify-between gap-3">
                      <p className="text-[10px] font-black uppercase tracking-[0.17em] text-[#806128]">{category}</p>
                      <span className={`text-[9px] font-black uppercase tracking-[0.13em] ${available ? 'text-emerald-700' : 'text-[#85898c]'}`}>{available ? 'Disponível' : 'Em desenvolvimento'}</span>
                    </div>
                    <h3 className="mt-3 text-2xl font-black leading-tight tracking-[-0.025em] text-[#111820]">{title}</h3>
                    <p className="mt-4 text-sm leading-6 text-[#616b74]">{description}</p>
                  </div>
                  <div className="mt-6 border-t border-[#ddd6ca] pt-5">
                    <p className="text-[10px] font-black uppercase tracking-[0.14em] text-[#7c858c]">Indicado para</p>
                    <p className="mt-2 text-xs leading-5 text-[#4f5a63]">{useCase}</p>
                  </div>
                  <ul className="mt-5 grid grid-cols-2 gap-x-3 gap-y-2 text-[11px] leading-4 text-[#5d6770]">
                    {includes.map((item) => <li key={item} className="flex items-start gap-2"><Check className="mt-0.5 h-3 w-3 shrink-0 text-[#8a6e2f]" strokeWidth={3} />{item}</li>)}
                  </ul>
                  <div className="mt-auto flex items-center justify-between border-t border-[#ddd6ca] pt-5">
                    <span className="text-[10px] font-bold text-[#838a90]">Ferramenta educativa</span>
                    <span className={`inline-flex items-center gap-2 text-xs font-black uppercase tracking-[0.09em] ${available ? 'text-[#765b25]' : 'text-[#8b8f91]'}`}>{available ? <>Abrir ferramenta <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" /></> : 'Em breve'}</span>
                  </div>
                </>
              );

              return available ? (
                <button key={id} type="button" onClick={() => openTool(id as ToolId)} className="group relative flex min-h-[480px] flex-col overflow-hidden rounded-2xl border border-[#d6cfc3] bg-[#faf8f3] p-6 text-left shadow-[0_12px_34px_rgba(24,32,40,0.055)] transition duration-200 hover:-translate-y-1 hover:border-[#b99a4f] hover:bg-white hover:shadow-[0_22px_48px_rgba(24,32,40,0.11)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#9f8140] focus-visible:ring-offset-2 focus-visible:ring-offset-[#eee9df]">
                  <span className="absolute inset-x-0 top-0 h-1 bg-[linear-gradient(90deg,#8a6b2f,#d8bd73,transparent)] opacity-70" />
                  {content}
                </button>
              ) : (
                <article key={id} className="relative flex min-h-[480px] flex-col overflow-hidden rounded-2xl border border-[#d6cfc3] bg-white/45 p-6 opacity-80">
                  <span className="absolute inset-x-0 top-0 h-1 bg-[linear-gradient(90deg,#a9a399,#d4cec4,transparent)]" />
                  {content}
                </article>
              );
            })}
          </div>
        </div>
      </section>

      {activeTool === 'termination' && <TerminationCalculator onClose={() => setActiveTool(null)} />}
      {activeTool === 'retirement' && <RetirementCalculator onClose={() => setActiveTool(null)} />}
      {activeTool === 'vacation' && <VacationCalculator onClose={() => setActiveTool(null)} />}

      <section className="border-y border-white/10 bg-[#111d29] py-14 text-white sm:py-16">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="grid gap-8 lg:grid-cols-[0.75fr_1.25fr] lg:gap-14">
            <div>
              <p className="text-[10px] font-black uppercase tracking-[0.2em] text-[#d8bd73]">Compromisso da plataforma</p>
              <h2 className="mt-4 text-3xl font-black leading-tight tracking-[-0.03em] sm:text-4xl">Clareza antes de qualquer conclusão.</h2>
              <p className="mt-4 text-sm leading-7 text-white/55">A área gratuita foi estruturada para informar sem esconder limites, condições ou situações que exigem análise individual.</p>
            </div>
            <div className="grid gap-px overflow-hidden rounded-2xl border border-white/10 bg-white/10 md:grid-cols-3">
              {[
                { icon: ShieldCheck, title: 'Privacidade preservada', text: 'Os valores digitados permanecem no dispositivo e não são armazenados pela GSA.' },
                { icon: Calculator, title: 'Cálculo explicado', text: 'O resultado apresenta a composição utilizada, não apenas um número isolado.' },
                { icon: Info, title: 'Limites visíveis', text: 'Cada ferramenta informa o que não foi considerado e quando buscar confirmação.' },
              ].map(({ icon: Icon, title, text }) => (
                <article key={title} className="bg-[#172433] p-6">
                  <Icon className="h-6 w-6 text-[#d8bd73]" />
                  <h3 className="mt-5 font-black">{title}</h3>
                  <p className="mt-3 text-xs leading-5 text-white/55">{text}</p>
                </article>
              ))}
            </div>
          </div>
        </div>
      </section>

      <section className="py-14 sm:py-20">
        <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">
          <div className="grid overflow-hidden rounded-2xl border border-[#cbbd9f] bg-[#d8c28d] lg:grid-cols-[1fr_340px]">
            <div className="p-7 sm:p-10 lg:p-12">
              <p className="text-[10px] font-black uppercase tracking-[0.2em] text-[#624d20]">Quando a simulação não basta</p>
              <h2 className="mt-4 max-w-3xl text-3xl font-black leading-tight tracking-[-0.03em] text-[#17202a] sm:text-4xl">Documentos, períodos especiais e regras específicas merecem uma análise completa.</h2>
              <p className="mt-4 max-w-2xl text-sm leading-7 text-[#5c4d31]">Conheça os serviços da GSA quando a situação exigir conferência individual, organização documental ou acompanhamento.</p>
            </div>
            <div className="flex flex-col justify-center border-t border-[#b69e69] bg-[#c8ad70] p-7 lg:border-l lg:border-t-0">
              <button type="button" onClick={onServices} className="inline-flex min-h-12 items-center justify-center gap-2 rounded-lg bg-[#172433] px-5 py-3 text-sm font-black text-white transition hover:bg-[#223449] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white">Conhecer os serviços GSA <ArrowRight className="h-4 w-4" /></button>
              <p className="mt-4 text-center text-[11px] leading-5 text-[#584721]">Atendimento por WhatsApp, e-mail ou Portal do Cliente.</p>
            </div>
          </div>
          <p className="mx-auto mt-8 max-w-3xl text-center text-xs leading-5 text-[#69727a]">As ferramentas fornecem estimativas educativas e não comprovam direitos, não substituem o cálculo oficial dos órgãos competentes nem a orientação de profissional habilitado.</p>
        </div>
      </section>
    </main>
  );
}
