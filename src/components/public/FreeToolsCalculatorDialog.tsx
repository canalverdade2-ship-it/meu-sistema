import { useMemo, useState, type ComponentType, type ReactNode } from 'react';
import {
  ArrowRight,
  BriefcaseBusiness,
  Calculator,
  CheckCircle2,
  Clock3,
  ExternalLink,
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
}

const currencyFormatter = new Intl.NumberFormat('pt-BR', {
  style: 'currency',
  currency: 'BRL',
});

const decimalFormatter = new Intl.NumberFormat('pt-BR', {
  minimumFractionDigits: 0,
  maximumFractionDigits: 1,
});

const TOOL_PRESENTATION: Record<FreeToolId, {
  icon: ComponentType<{ className?: string }>;
  category: string;
  title: string;
  description: string;
}> = {
  termination: {
    icon: BriefcaseBusiness,
    category: 'Ferramenta trabalhista',
    title: 'Estimativa de rescisão CLT',
    description: 'Organize os principais dados do vínculo e consulte uma estimativa bruta das verbas rescisórias consideradas pela ferramenta.',
  },
  retirement: {
    icon: Landmark,
    category: 'Ferramenta previdenciária · regras de 2026',
    title: 'Panorama de aposentadoria pelo INSS',
    description: 'Compare idade e tempo de contribuição com critérios básicos da regra geral e de duas regras de transição.',
  },
  vacation: {
    icon: Palmtree,
    category: 'Ferramenta trabalhista',
    title: 'Estimativa bruta de férias',
    description: 'Visualize a remuneração de 30 dias de férias e o adicional constitucional de um terço antes dos descontos aplicáveis.',
  },
};

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
          className={`min-h-12 w-full rounded-lg border border-[#d8d2c8] bg-white py-3 text-sm font-bold text-[#111820] outline-none transition focus:border-[#9d7c34] focus:ring-4 focus:ring-[#9d7c34]/10 ${prefix ? 'pl-12' : 'pl-4'} ${suffix ? 'pr-16' : 'pr-4'}`}
        />
        {suffix && <span className="pointer-events-none absolute inset-y-0 right-4 flex items-center text-xs font-bold text-[#727c84]">{suffix}</span>}
      </span>
      {help && <span className="mt-1.5 block text-xs leading-5 text-[#68727a]">{help}</span>}
    </label>
  );
}

function FormSection({ title, description, children }: { title: string; description?: string; children: ReactNode }) {
  return (
    <section className="border-b border-[#e2ddd4] pb-7 last:border-0 last:pb-0">
      <div className="mb-5">
        <h3 className="text-sm font-black text-[#111820]">{title}</h3>
        {description && <p className="mt-1 text-xs leading-5 text-[#6b747c]">{description}</p>}
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
    <aside className="bg-[linear-gradient(180deg,#172635_0%,#0b1722_100%)] p-5 text-white sm:p-7 lg:sticky lg:top-0 lg:self-start" aria-live="polite">
      <div className="flex items-start justify-between gap-5 border-b border-white/10 pb-6">
        <div>
          <p className="text-[10px] font-black uppercase tracking-[0.18em] text-[#d8bd73]">{eyebrow}</p>
          <p className="mt-2 text-3xl font-black leading-tight tracking-[-0.03em] sm:text-4xl">{headline}</p>
          {summary && <p className="mt-3 text-sm leading-6 text-white/55">{summary}</p>}
        </div>
        <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-white/10 bg-white/[0.04] text-[#d8bd73]"><Icon className="h-5 w-5" /></span>
      </div>
      <div className="mt-3">{children}</div>
      {note && <div className="mt-6 flex gap-3 border-t border-white/10 pt-5 text-xs leading-5 text-white/55"><Info className="mt-0.5 h-4 w-4 shrink-0 text-[#d8bd73]" />{note}</div>}
      {action && <div className="mt-5">{action}</div>}
    </aside>
  );
}

function Workbench({ children }: { children: ReactNode }) {
  return (
    <div className="grid overflow-hidden rounded-2xl border border-[#d6cfc4] bg-white shadow-[0_24px_65px_rgba(29,36,42,0.1)] lg:grid-cols-[1.06fr_0.94fr]">
      {children}
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

  return (
    <Workbench>
      <form className="space-y-7 p-5 sm:p-7 lg:p-8" onSubmit={(event) => event.preventDefault()}>
        <FormSection title="Dados do vínculo" description="Informe os dados principais usados na estimativa.">
          <div className="grid gap-5 sm:grid-cols-2">
            <NumberField id="termination-salary" label="Salário bruto mensal" value={salary} onChange={setSalary} prefix="R$" />
            <label htmlFor="termination-reason" className="block">
              <span className="text-sm font-black text-[#26313a]">Motivo do desligamento</span>
              <select id="termination-reason" value={reason} onChange={(event) => setReason(event.target.value as TerminationReason)} className="mt-2 min-h-12 w-full rounded-lg border border-[#d8d2c8] bg-white px-4 py-3 text-sm font-bold text-[#111820] outline-none transition focus:border-[#9d7c34] focus:ring-4 focus:ring-[#9d7c34]/10">
                <option value="without_cause">Demissão sem justa causa</option>
                <option value="agreement">Acordo entre as partes</option>
                <option value="resignation">Pedido de demissão</option>
                <option value="just_cause">Demissão por justa causa</option>
              </select>
            </label>
          </div>
        </FormSection>

        <FormSection title="Períodos considerados" description="Use números aproximados quando ainda não tiver o cálculo oficial.">
          <div className="grid gap-5 sm:grid-cols-2">
            <NumberField id="termination-days" label="Dias trabalhados no mês" value={daysWorked} onChange={setDaysWorked} suffix="dias" max={30} step={1} />
            <NumberField id="termination-years" label="Anos completos na empresa" value={completedYears} onChange={setCompletedYears} suffix="anos" max={20} step={1} help="Usado na estimativa do aviso-prévio." />
            <NumberField id="termination-thirteenth" label="Avos de 13º no ano" value={thirteenthMonths} onChange={setThirteenthMonths} suffix="/ 12" max={12} step={1} help="Conte meses com 15 dias ou mais trabalhados." />
            <NumberField id="termination-vacation" label="Avos de férias atuais" value={vacationMonths} onChange={setVacationMonths} suffix="/ 12" max={12} step={1} />
          </div>
        </FormSection>

        <FormSection title="FGTS e férias vencidas">
          <div className="grid gap-5 sm:grid-cols-2">
            <NumberField id="termination-fgts" label="Saldo aproximado do FGTS" value={fgtsBalance} onChange={setFgtsBalance} prefix="R$" help="A multa é estimada sobre o saldo informado." />
            <label className="flex min-h-12 cursor-pointer items-center gap-3 self-end rounded-lg border border-[#d8d2c8] bg-[#faf8f3] px-4 py-3 text-sm font-bold text-[#39444e]">
              <input type="checkbox" checked={expiredVacation} onChange={(event) => setExpiredVacation(event.target.checked)} className="h-4 w-4 accent-[#8a6e2f]" />
              Possui um período de férias vencidas
            </label>
          </div>
        </FormSection>

        <button type="button" onClick={reset} className="inline-flex min-h-11 items-center gap-2 rounded-lg border border-[#d5cec3] bg-white px-4 py-2 text-sm font-black text-[#59646d] transition hover:border-[#9d7c34] hover:text-[#111820] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#9d7c34]">
          <RotateCcw className="h-4 w-4" /> Restaurar dados de exemplo
        </button>
      </form>

      <ResultPanel
        eyebrow="Resultado estimado"
        headline={currencyFormatter.format(result.total)}
        summary="Total bruto aproximado das parcelas consideradas abaixo."
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
    </Workbench>
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

  return (
    <Workbench>
      <form className="space-y-7 p-5 sm:p-7 lg:p-8" onSubmit={(event) => event.preventDefault()}>
        <FormSection title="Perfil considerado" description="As regras previdenciárias usam critérios diferentes conforme o sexo informado.">
          <fieldset>
            <legend className="sr-only">Sexo considerado nas regras do INSS</legend>
            <div className="grid grid-cols-2 rounded-lg bg-[#ece9e2] p-1">
              {([['woman', 'Mulher'], ['man', 'Homem']] as const).map(([value, label]) => (
                <button key={value} type="button" onClick={() => setGender(value)} aria-pressed={gender === value} className={`min-h-11 rounded-md px-4 py-2.5 text-sm font-black transition ${gender === value ? 'bg-white text-[#111820] shadow-sm' : 'text-[#69727a] hover:text-[#25313b]'}`}>{label}</button>
              ))}
            </div>
          </fieldset>
        </FormSection>

        <FormSection title="Dados previdenciários" description="Considere apenas vínculos e contribuições reconhecidos no CNIS.">
          <div className="grid gap-5 sm:grid-cols-2">
            <NumberField id="retirement-age" label="Idade atual" value={age} onChange={setAge} suffix="anos" max={100} step={0.5} />
            <NumberField id="retirement-contribution" label="Tempo total de contribuição" value={contribution} onChange={setContribution} suffix="anos" max={60} step={0.5} />
          </div>
        </FormSection>

        <FormSection title="Regras de transição">
          <label className="flex cursor-pointer items-start gap-3 rounded-lg border border-[#d8d2c8] bg-[#faf8f3] p-4 text-sm font-bold text-[#39444e]">
            <input type="checkbox" checked={beforeReform} onChange={(event) => setBeforeReform(event.target.checked)} className="mt-0.5 h-4 w-4 accent-[#8a6e2f]" />
            <span>Já contribuía para o INSS antes de 13/11/2019 <small className="mt-1 block font-medium leading-5 text-[#69727a]">Essa informação habilita as regras de transição avaliadas pela ferramenta.</small></span>
          </label>
        </FormSection>

        <div className="border-l-2 border-[#c7a458] bg-[#f8f3e8] p-4 text-xs leading-5 text-[#65532e]">
          O resultado oficial depende do histórico completo de contribuições, vínculos, salários e eventuais períodos especiais.
        </div>
      </form>

      <ResultPanel
        eyebrow="Panorama informado"
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

  return (
    <Workbench>
      <form className="space-y-7 p-5 sm:p-7 lg:p-8" onSubmit={(event) => event.preventDefault()}>
        <FormSection title="Remuneração considerada" description="Informe o salário e, quando houver, médias habituais de adicionais e variáveis.">
          <div className="grid gap-5 sm:grid-cols-2">
            <NumberField id="vacation-salary" label="Salário bruto mensal" value={salary} onChange={setSalary} prefix="R$" />
            <NumberField id="vacation-averages" label="Média de adicionais e variáveis" value={averages} onChange={setAverages} prefix="R$" help="Ex.: horas extras, adicional noturno e comissões habituais." />
          </div>
        </FormSection>

        <div className="border-l-2 border-[#c8aa64] bg-[#f7f2e6] p-4 text-xs leading-5 text-[#624f29]">
          Esta versão considera 30 dias de férias. Não inclui venda de 10 dias, adiantamento do 13º, faltas injustificadas ou férias em dobro.
        </div>

        <button type="button" onClick={reset} className="inline-flex min-h-11 items-center gap-2 rounded-lg border border-[#d5cec3] bg-white px-4 py-2 text-sm font-black text-[#59646d] transition hover:border-[#9d7c34] hover:text-[#111820] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#9d7c34]">
          <RotateCcw className="h-4 w-4" /> Restaurar dados de exemplo
        </button>
      </form>

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
    </Workbench>
  );
}

export function FreeToolsCalculatorDialog({ tool, onClose }: FreeToolsCalculatorDialogProps) {
  const presentation = tool ? TOOL_PRESENTATION[tool] : null;
  const Icon = presentation?.icon ?? Calculator;

  return (
    <AccessibleDialog
      isOpen={Boolean(tool)}
      onClose={onClose}
      ariaLabel={presentation ? `Calculadora gratuita — ${presentation.title}` : 'Calculadora gratuita'}
      panelClassName="max-w-[1180px] overflow-hidden rounded-2xl border border-[#c9c1b5] bg-[#f5f1e9] shadow-[0_35px_100px_rgba(4,12,18,0.42)]"
      overlayClassName="items-center justify-center overflow-y-auto bg-[#07101b]/85 p-1.5 backdrop-blur-sm sm:p-5"
      zIndexClassName="z-[130]"
    >
      <div className="flex max-h-[calc(100dvh-0.75rem)] min-h-0 flex-col sm:max-h-[calc(100dvh-2.5rem)]">
        <header className="sticky top-0 z-20 flex items-start justify-between gap-4 border-b border-[#d7d0c5] bg-[#f9f6ef]/96 px-4 py-4 backdrop-blur sm:px-6 sm:py-5">
          <div className="flex min-w-0 items-start gap-3 sm:gap-4">
            <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-[#172433] text-[#d8bd73]"><Icon className="h-5 w-5" /></span>
            <div className="min-w-0">
              <p className="text-[9px] font-black uppercase tracking-[0.18em] text-[#806128] sm:text-[10px]">{presentation?.category}</p>
              <h2 className="mt-1 text-xl font-black leading-tight tracking-[-0.025em] text-[#111820] sm:text-2xl">{presentation?.title}</h2>
            </div>
          </div>
          <button type="button" onClick={onClose} aria-label="Fechar calculadora" className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full border border-[#d1c9bd] bg-white text-[#5c6670] transition hover:border-[#9d7c34] hover:text-[#111820] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#9d7c34]">
            <X className="h-5 w-5" />
          </button>
        </header>

        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain">
          <section className="border-b border-[#ddd6cb] bg-[#eee8dd] px-4 py-5 sm:px-6">
            <div className="grid gap-5 lg:grid-cols-[1fr_auto] lg:items-center">
              <p className="max-w-3xl text-sm leading-6 text-[#59646d] sm:text-base">{presentation?.description}</p>
              <div className="grid grid-cols-3 overflow-hidden rounded-xl border border-[#d5cec2] bg-white/65 text-center">
                {[
                  [LockKeyhole, 'Sem cadastro'],
                  [ShieldCheck, 'Dados no aparelho'],
                  [Scale, 'Estimativa educativa'],
                ].map(([TrustIcon, label], index) => {
                  const Trust = TrustIcon as ComponentType<{ className?: string }>;
                  return <div key={label as string} className={`px-3 py-3 ${index > 0 ? 'border-l border-[#ddd6cb]' : ''}`}><Trust className="mx-auto h-4 w-4 text-[#8a6e2f]" /><span className="mt-1.5 block text-[9px] font-black uppercase tracking-[0.08em] text-[#5c6670]">{label as string}</span></div>;
                })}
              </div>
            </div>
          </section>

          <main className="p-3 sm:p-6">
            {tool === 'termination' && <TerminationCalculator />}
            {tool === 'retirement' && <RetirementCalculator />}
            {tool === 'vacation' && <VacationCalculator />}
          </main>
        </div>

        <footer className="flex flex-col gap-3 border-t border-[#d7d0c5] bg-[#f9f6ef] px-4 py-3 sm:flex-row sm:items-center sm:justify-between sm:px-6">
          <p className="text-[11px] leading-5 text-[#69727a]">A ferramenta não comprova direitos nem substitui documentos, cálculo oficial ou orientação profissional.</p>
          <button type="button" onClick={onClose} className="inline-flex min-h-11 shrink-0 items-center justify-center gap-2 rounded-lg bg-[#172433] px-5 py-2.5 text-sm font-black text-white transition hover:bg-[#22364a] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#9d7c34]">
            Concluir consulta <ArrowRight className="h-4 w-4" />
          </button>
        </footer>
      </div>
    </AccessibleDialog>
  );
}
