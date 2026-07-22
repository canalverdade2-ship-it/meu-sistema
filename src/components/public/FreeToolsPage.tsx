import { useMemo, useState, type ComponentType, type ReactNode } from 'react';
import {
  ArrowLeft,
  ArrowRight,
  Baby,
  BriefcaseBusiness,
  Calculator,
  CheckCircle2,
  Clock3,
  HandCoins,
  HeartHandshake,
  Info,
  Landmark,
  Palmtree,
  RotateCcw,
  ShieldCheck,
  Sparkles,
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
  title: string;
  description: string;
  category: string;
  available: boolean;
}

const TOOLS: ToolCard[] = [
  {
    id: 'termination',
    icon: BriefcaseBusiness,
    title: 'Rescisão trabalhista',
    description: 'Estime saldo de salário, aviso-prévio, 13º, férias e multa do FGTS.',
    category: 'Trabalhista',
    available: true,
  },
  {
    id: 'retirement',
    icon: Landmark,
    title: 'Aposentadoria INSS',
    description: 'Compare sua situação com as regras geral e de transição de 2026.',
    category: 'Previdenciário',
    available: true,
  },
  {
    id: 'vacation',
    icon: Palmtree,
    title: 'Cálculo de férias',
    description: 'Veja o valor bruto das férias e do adicional constitucional de 1/3.',
    category: 'Trabalhista',
    available: true,
  },
  {
    id: 'thirteenth',
    icon: HandCoins,
    title: '13º salário',
    description: 'Simulação das parcelas e do valor proporcional aos meses trabalhados.',
    category: 'Trabalhista',
    available: false,
  },
  {
    id: 'benefits',
    icon: Baby,
    title: 'Benefícios do INSS',
    description: 'Orientação inicial sobre incapacidade, salário-maternidade e pensão.',
    category: 'Previdenciário',
    available: false,
  },
  {
    id: 'bpc',
    icon: HeartHandshake,
    title: 'BPC / LOAS',
    description: 'Triagem educativa dos critérios básicos do benefício assistencial.',
    category: 'Assistencial',
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
      <span className="text-sm font-black text-neutral-800">{label}</span>
      <span className="relative mt-2 block">
        {prefix && <span className="pointer-events-none absolute inset-y-0 left-4 flex items-center text-sm font-bold text-neutral-400">{prefix}</span>}
        <input
          id={id}
          type="number"
          inputMode="decimal"
          min={min}
          max={max}
          step={step}
          value={value}
          onChange={(event) => onChange(event.target.value)}
          className={`w-full rounded-xl border border-neutral-200 bg-white py-3 text-sm font-bold text-neutral-950 outline-none transition focus:border-[#b69747] focus:ring-4 focus:ring-[#d8bd73]/15 ${prefix ? 'pl-12' : 'pl-4'} ${suffix ? 'pr-16' : 'pr-4'}`}
        />
        {suffix && <span className="pointer-events-none absolute inset-y-0 right-4 flex items-center text-xs font-bold text-neutral-400">{suffix}</span>}
      </span>
      {help && <span className="mt-1.5 block text-xs leading-5 text-neutral-500">{help}</span>}
    </label>
  );
}

function ResultLine({ label, value, emphasized = false }: { label: string; value: string; emphasized?: boolean }) {
  return (
    <div className={`flex items-center justify-between gap-4 border-b border-white/10 py-3 last:border-0 ${emphasized ? 'text-[#efd991]' : 'text-white/75'}`}>
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
    <section id={id} className="scroll-mt-24 border-t border-neutral-200 bg-white py-16 sm:py-20">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <button type="button" onClick={onClose} className="mb-8 inline-flex items-center gap-2 text-sm font-black text-neutral-500 transition hover:text-neutral-950 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#b69747]">
          <ArrowLeft className="h-4 w-4" /> Ver todas as ferramentas
        </button>
        <div className="mb-8 flex max-w-3xl items-start gap-4">
          <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-[#f1e7c8] text-[#7b642c]"><Icon className="h-6 w-6" /></span>
          <div>
            <p className="text-xs font-black uppercase tracking-[0.2em] text-[#94762f]">{eyebrow}</p>
            <h2 className="mt-2 text-3xl font-black tracking-tight text-neutral-950 sm:text-4xl">{title}</h2>
            <p className="mt-3 text-sm leading-7 text-neutral-600 sm:text-base">{description}</p>
          </div>
        </div>
        {children}
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

  const result = useMemo(() => {
    return calculateTerminationEstimate({
      salary: asNumber(salary),
      reason,
      daysWorked: asNumber(daysWorked),
      thirteenthMonths: asNumber(thirteenthMonths),
      vacationMonths: asNumber(vacationMonths),
      expiredVacation,
      completedYears: asNumber(completedYears),
      fgtsBalance: asNumber(fgtsBalance),
    });
  }, [completedYears, daysWorked, expiredVacation, fgtsBalance, reason, salary, thirteenthMonths, vacationMonths]);

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
      eyebrow="Calculadora trabalhista"
      title="Estimativa de rescisão CLT"
      description="Informe os dados básicos do vínculo para obter uma estimativa bruta das principais verbas. A conta não considera descontos, médias, convenções coletivas ou situações especiais."
      onClose={onClose}
    >
      <div className="grid overflow-hidden rounded-2xl border border-neutral-200 bg-[#faf9f6] shadow-[0_24px_70px_rgba(26,26,26,0.08)] lg:grid-cols-[1.05fr_0.95fr]">
        <form className="grid gap-5 p-5 sm:grid-cols-2 sm:p-8" onSubmit={(event) => event.preventDefault()}>
          <NumberField id="termination-salary" label="Salário bruto mensal" value={salary} onChange={setSalary} prefix="R$" />
          <label htmlFor="termination-reason" className="block">
            <span className="text-sm font-black text-neutral-800">Motivo do desligamento</span>
            <select id="termination-reason" value={reason} onChange={(event) => setReason(event.target.value as typeof reason)} className="mt-2 w-full rounded-xl border border-neutral-200 bg-white px-4 py-3 text-sm font-bold text-neutral-950 outline-none transition focus:border-[#b69747] focus:ring-4 focus:ring-[#d8bd73]/15">
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
          <label className="flex min-h-12 cursor-pointer items-center gap-3 self-end rounded-xl border border-neutral-200 bg-white px-4 py-3 text-sm font-bold text-neutral-700">
            <input type="checkbox" checked={expiredVacation} onChange={(event) => setExpiredVacation(event.target.checked)} className="h-4 w-4 accent-[#9b7c33]" />
            Possui 1 período de férias vencidas
          </label>
          <button type="button" onClick={reset} className="inline-flex w-fit items-center gap-2 text-sm font-black text-neutral-500 transition hover:text-neutral-950 sm:col-span-2"><RotateCcw className="h-4 w-4" /> Restaurar exemplo</button>
        </form>

        <aside className="bg-neutral-950 p-5 text-white sm:p-8" aria-live="polite">
          <div className="flex items-center justify-between gap-4">
            <div>
              <p className="text-xs font-black uppercase tracking-[0.18em] text-[#d8bd73]">Resultado estimado</p>
              <p className="mt-2 text-3xl font-black sm:text-4xl">{currencyFormatter.format(result.total)}</p>
            </div>
            <Calculator className="h-8 w-8 text-white/20" />
          </div>
          <div className="mt-6">
            <ResultLine label="Saldo de salário" value={currencyFormatter.format(result.salaryBalance)} />
            {result.notice > 0 && <ResultLine label={`Aviso-prévio (${decimalFormatter.format(result.noticeDays)} dias${reason === 'agreement' ? ', pela metade' : ''})`} value={currencyFormatter.format(result.notice)} />}
            <ResultLine label="13º proporcional" value={currencyFormatter.format(result.thirteenthValue)} />
            <ResultLine label="Férias proporcionais + 1/3" value={currencyFormatter.format(result.proportionalVacation)} />
            {expiredVacation && <ResultLine label="Férias vencidas + 1/3" value={currencyFormatter.format(result.expiredVacationValue)} />}
            <ResultLine label="Multa estimada do FGTS" value={currencyFormatter.format(result.fgtsPenalty)} />
          </div>
          <p className="mt-6 flex gap-2 rounded-xl border border-white/10 bg-white/5 p-4 text-xs leading-5 text-white/55"><Info className="mt-0.5 h-4 w-4 shrink-0 text-[#d8bd73]" /> O saldo existente do FGTS não entra no total acima. A possibilidade de saque depende da modalidade e da situação do trabalhador.</p>
        </aside>
      </div>
    </CalculatorShell>
  );
}

function RequirementCard({ title, eligible, lines }: { title: string; eligible: boolean; lines: string[] }) {
  return (
    <article className={`rounded-xl border p-5 ${eligible ? 'border-emerald-300 bg-emerald-50' : 'border-white/10 bg-white/5'}`}>
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

  const result = useMemo(() => {
    return evaluateRetirement2026({
      gender,
      age: asNumber(age),
      contributionYears: asNumber(contribution),
      contributedBeforeReform: beforeReform,
    });
  }, [age, beforeReform, contribution, gender]);

  const missing = (current: number, target: number, label: string) => current >= target
    ? `${label}: requisito atingido`
    : `${label}: faltam ${decimalFormatter.format(target - current)} ano(s)`;

  return (
    <CalculatorShell
      id="calculadora-retirement"
      icon={Landmark}
      eyebrow="Simulador previdenciário · regras de 2026"
      title="Panorama de aposentadoria pelo INSS"
      description="Compare os dados informados com a regra geral e com duas regras de transição de 2026. O histórico completo do CNIS pode alterar o resultado oficial."
      onClose={onClose}
    >
      <div className="grid overflow-hidden rounded-2xl border border-neutral-200 bg-[#faf9f6] shadow-[0_24px_70px_rgba(26,26,26,0.08)] lg:grid-cols-[0.8fr_1.2fr]">
        <form className="grid content-start gap-5 p-5 sm:p-8" onSubmit={(event) => event.preventDefault()}>
          <fieldset>
            <legend className="text-sm font-black text-neutral-800">Sexo considerado nas regras do INSS</legend>
            <div className="mt-2 grid grid-cols-2 rounded-xl bg-neutral-100 p-1">
              {([['woman', 'Mulher'], ['man', 'Homem']] as const).map(([value, label]) => (
                <button key={value} type="button" onClick={() => setGender(value)} aria-pressed={gender === value} className={`rounded-lg px-4 py-2.5 text-sm font-black transition ${gender === value ? 'bg-white text-neutral-950 shadow-sm' : 'text-neutral-500 hover:text-neutral-800'}`}>{label}</button>
              ))}
            </div>
          </fieldset>
          <NumberField id="retirement-age" label="Idade atual" value={age} onChange={setAge} suffix="anos" max={100} step={0.5} />
          <NumberField id="retirement-contribution" label="Tempo total de contribuição" value={contribution} onChange={setContribution} suffix="anos" max={60} step={0.5} help="Considere vínculos e contribuições reconhecidos no CNIS." />
          <label className="flex cursor-pointer items-start gap-3 rounded-xl border border-neutral-200 bg-white p-4 text-sm font-bold text-neutral-700">
            <input type="checkbox" checked={beforeReform} onChange={(event) => setBeforeReform(event.target.checked)} className="mt-0.5 h-4 w-4 accent-[#9b7c33]" />
            <span>Já contribuía para o INSS antes de 13/11/2019 <small className="mt-1 block font-medium leading-5 text-neutral-500">Essa informação habilita as regras de transição.</small></span>
          </label>
        </form>

        <aside className="bg-neutral-950 p-5 text-white sm:p-8" aria-live="polite">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <p className="text-xs font-black uppercase tracking-[0.18em] text-[#d8bd73]">Seu panorama em 2026</p>
              <p className="mt-2 text-2xl font-black sm:text-3xl">{result.anyEligible ? 'Há uma regra possível' : 'Continue acompanhando'}</p>
              <p className="mt-2 text-sm text-white/55">{decimalFormatter.format(result.currentAge)} anos de idade · {decimalFormatter.format(result.contributionYears)} anos de contribuição · {decimalFormatter.format(result.points)} pontos</p>
            </div>
            <Landmark className="h-8 w-8 text-white/20" />
          </div>
          <div className="mt-7 grid gap-3 xl:grid-cols-3">
            <RequirementCard
              title="Regra geral"
              eligible={result.generalEligible}
              lines={[
                missing(result.currentAge, result.generalAge, 'Idade'),
                missing(result.contributionYears, result.generalContribution, 'Contribuição'),
              ]}
            />
            {beforeReform && <RequirementCard
              title="Regra dos pontos"
              eligible={result.pointsEligible}
              lines={[
                missing(result.points, result.transitionPoints, 'Pontuação'),
                missing(result.contributionYears, result.transitionContribution, 'Contribuição'),
              ]}
            />}
            {beforeReform && <RequirementCard
              title="Idade progressiva"
              eligible={result.progressiveEligible}
              lines={[
                missing(result.currentAge, result.progressiveAge, 'Idade'),
                missing(result.contributionYears, result.transitionContribution, 'Contribuição'),
              ]}
            />}
          </div>
          <p className="mt-6 flex gap-2 rounded-xl border border-white/10 bg-white/5 p-4 text-xs leading-5 text-white/55"><Info className="mt-0.5 h-4 w-4 shrink-0 text-[#d8bd73]" /> Pedágios, atividade especial, magistério, trabalho rural, deficiência e direito adquirido exigem uma análise própria e não estão incluídos.</p>
          <a href="https://meu.inss.gov.br/" target="_blank" rel="noopener noreferrer" className="mt-4 inline-flex items-center gap-2 text-sm font-black text-[#efd991] hover:text-white">Conferir no Meu INSS <ArrowRight className="h-4 w-4" /></a>
        </aside>
      </div>
    </CalculatorShell>
  );
}

function VacationCalculator({ onClose }: { onClose: () => void }) {
  const [salary, setSalary] = useState('3500');
  const [averages, setAverages] = useState('0');

  const result = useMemo(() => {
    return calculateVacationEstimate(asNumber(salary), asNumber(averages));
  }, [averages, salary]);

  return (
    <CalculatorShell
      id="calculadora-vacation"
      icon={Palmtree}
      eyebrow="Calculadora trabalhista"
      title="Estimativa bruta de férias"
      description="Calcule a remuneração de 30 dias de férias com o adicional constitucional de 1/3, antes dos descontos aplicáveis."
      onClose={onClose}
    >
      <div className="grid overflow-hidden rounded-2xl border border-neutral-200 bg-[#faf9f6] shadow-[0_24px_70px_rgba(26,26,26,0.08)] lg:grid-cols-2">
        <form className="grid content-start gap-5 p-5 sm:p-8" onSubmit={(event) => event.preventDefault()}>
          <NumberField id="vacation-salary" label="Salário bruto mensal" value={salary} onChange={setSalary} prefix="R$" />
          <NumberField id="vacation-averages" label="Média de adicionais e variáveis" value={averages} onChange={setAverages} prefix="R$" help="Ex.: horas extras, adicional noturno e comissões habituais. Se não houver, deixe zero." />
          <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-xs leading-5 text-amber-900">
            Esta versão considera 30 dias de férias e não inclui venda de 10 dias, adiantamento do 13º, faltas injustificadas ou férias em dobro.
          </div>
        </form>
        <aside className="bg-neutral-950 p-5 text-white sm:p-8" aria-live="polite">
          <p className="text-xs font-black uppercase tracking-[0.18em] text-[#d8bd73]">Total bruto estimado</p>
          <p className="mt-2 text-3xl font-black sm:text-4xl">{currencyFormatter.format(result.total)}</p>
          <div className="mt-7">
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
    <main className="bg-[#f4f1ea] pt-[73px]">
      <section className="relative overflow-hidden bg-neutral-950 text-white">
        <div className="absolute inset-0 opacity-30 [background-image:radial-gradient(circle_at_20%_20%,rgba(216,189,115,0.34),transparent_34%),radial-gradient(circle_at_85%_65%,rgba(67,111,105,0.28),transparent_30%)]" />
        <div className="relative mx-auto max-w-7xl px-4 py-16 sm:px-6 sm:py-20 lg:px-8 lg:py-24">
          <button type="button" onClick={onBack} className="inline-flex items-center gap-2 text-sm font-black text-white/60 transition hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#d8bd73]"><ArrowLeft className="h-4 w-4" /> Voltar ao início</button>
          <div className="mt-10 grid items-end gap-10 lg:grid-cols-[1fr_0.65fr]">
            <div>
              <span className="inline-flex items-center gap-2 rounded-full border border-[#d8bd73]/30 bg-[#d8bd73]/10 px-4 py-2 text-xs font-black uppercase tracking-[0.18em] text-[#efd991]"><Sparkles className="h-4 w-4" /> 100% grátis · sem cadastro</span>
              <h1 className="mt-6 max-w-4xl text-4xl font-black leading-[1.06] tracking-tight sm:text-6xl lg:text-7xl">Informação útil para decisões mais <span className="font-serif font-medium italic text-[#d8bd73]">seguras.</span></h1>
              <p className="mt-6 max-w-2xl text-base leading-8 text-white/65 sm:text-lg">Calculadoras e simuladores gratuitos para orientar dúvidas trabalhistas, previdenciárias e financeiras em poucos minutos.</p>
            </div>
            <div className="grid grid-cols-3 gap-3 border-t border-white/10 pt-6 lg:border-l lg:border-t-0 lg:pl-8 lg:pt-0">
              {[['3', 'ferramentas ativas'], ['0', 'dados enviados'], ['24h', 'disponíveis']].map(([value, label]) => (
                <div key={label}><strong className="block text-2xl font-black text-[#efd991] sm:text-3xl">{value}</strong><span className="mt-1 block text-[11px] leading-4 text-white/45 sm:text-xs">{label}</span></div>
              ))}
            </div>
          </div>
        </div>
      </section>

      <section className="py-16 sm:py-20" aria-labelledby="free-tools-title">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="max-w-2xl">
            <p className="text-xs font-black uppercase tracking-[0.2em] text-[#94762f]">Escolha uma ferramenta</p>
            <h2 id="free-tools-title" className="mt-3 text-3xl font-black tracking-tight text-neutral-950 sm:text-5xl">Comece sua simulação</h2>
            <p className="mt-4 leading-7 text-neutral-600">Os cálculos acontecem somente no seu navegador. Não pedimos CPF, nome, telefone ou criação de conta.</p>
          </div>

          <div className="mt-10 grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {TOOLS.map(({ id, icon: Icon, title, description, category, available }) => {
              const content = (
                <>
                  <div className="flex items-start justify-between gap-4">
                    <span className={`flex h-12 w-12 items-center justify-center rounded-xl ${available ? 'bg-[#f1e7c8] text-[#7b642c]' : 'bg-neutral-100 text-neutral-400'}`}><Icon className="h-6 w-6" /></span>
                    <span className={`rounded-full px-3 py-1 text-[10px] font-black uppercase tracking-wider ${available ? 'bg-emerald-50 text-emerald-700' : 'bg-neutral-100 text-neutral-500'}`}>{available ? 'Disponível' : 'Em breve'}</span>
                  </div>
                  <p className="mt-6 text-xs font-black uppercase tracking-[0.16em] text-neutral-400">{category}</p>
                  <h3 className="mt-2 text-xl font-black text-neutral-950">{title}</h3>
                  <p className="mt-3 min-h-14 text-sm leading-6 text-neutral-600">{description}</p>
                  <span className={`mt-6 inline-flex items-center gap-2 text-sm font-black ${available ? 'text-[#816626]' : 'text-neutral-400'}`}>{available ? <>Calcular agora <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" /></> : 'Estamos preparando'}</span>
                </>
              );

              return available ? (
                <button key={id} type="button" onClick={() => openTool(id as ToolId)} className="group rounded-2xl border border-neutral-200 bg-white p-6 text-left shadow-[0_12px_36px_rgba(26,26,26,0.05)] transition hover:-translate-y-1 hover:border-[#d8bd73] hover:shadow-[0_18px_42px_rgba(26,26,26,0.09)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#b69747]">{content}</button>
              ) : (
                <article key={id} className="rounded-2xl border border-neutral-200/80 bg-white/55 p-6">{content}</article>
              );
            })}
          </div>
        </div>
      </section>

      {activeTool === 'termination' && <TerminationCalculator onClose={() => setActiveTool(null)} />}
      {activeTool === 'retirement' && <RetirementCalculator onClose={() => setActiveTool(null)} />}
      {activeTool === 'vacation' && <VacationCalculator onClose={() => setActiveTool(null)} />}

      <section className="border-y border-neutral-200 bg-white py-14">
        <div className="mx-auto grid max-w-7xl gap-6 px-4 sm:px-6 md:grid-cols-3 lg:px-8">
          {[
            { icon: ShieldCheck, title: 'Privacidade desde o início', text: 'Os valores digitados ficam no dispositivo e não são armazenados pela GSA.' },
            { icon: Calculator, title: 'Memória de cálculo clara', text: 'Você vê as parcelas consideradas e entende como a estimativa foi formada.' },
            { icon: Info, title: 'Orientação responsável', text: 'Resultados educativos, com limites visíveis e indicação de quando buscar análise.' },
          ].map(({ icon: Icon, title, text }) => (
            <article key={title} className="flex gap-4"><Icon className="mt-0.5 h-6 w-6 shrink-0 text-[#9b7c33]" /><div><h2 className="font-black text-neutral-950">{title}</h2><p className="mt-2 text-sm leading-6 text-neutral-600">{text}</p></div></article>
          ))}
        </div>
      </section>

      <section className="py-16 sm:py-20">
        <div className="mx-auto max-w-5xl px-4 sm:px-6 lg:px-8">
          <div className="rounded-2xl bg-[#18322f] px-6 py-10 text-white shadow-xl sm:px-10 lg:flex lg:items-center lg:justify-between lg:gap-10">
            <div className="max-w-2xl">
              <p className="text-xs font-black uppercase tracking-[0.18em] text-[#d8bd73]">Quando a simulação não basta</p>
              <h2 className="mt-3 text-2xl font-black sm:text-3xl">Precisa de uma análise completa?</h2>
              <p className="mt-3 text-sm leading-6 text-white/65">Situações com documentos, períodos especiais, médias salariais ou regras específicas merecem atendimento individual.</p>
            </div>
            <button type="button" onClick={onServices} className="mt-6 inline-flex shrink-0 items-center gap-2 rounded-xl bg-[#d8bd73] px-5 py-3 text-sm font-black text-neutral-950 transition hover:bg-[#efd991] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white lg:mt-0">Conhecer os serviços GSA <ArrowRight className="h-4 w-4" /></button>
          </div>
          <p className="mx-auto mt-8 max-w-3xl text-center text-xs leading-5 text-neutral-500">As ferramentas fornecem estimativas educativas e não comprovam direitos, não substituem o cálculo oficial dos órgãos competentes nem a orientação de profissional habilitado.</p>
        </div>
      </section>
    </main>
  );
}
