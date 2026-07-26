import { useMemo, useState, type ReactNode } from 'react';
import {
  AlertCircle,
  BadgeCheck,
  Calculator,
  CheckCircle2,
  Clock3,
  ExternalLink,
  Info,
  Landmark,
  Layers,
  Palmtree,
  RotateCcw,
  Scale,
  ShieldCheck,
  Sparkles,
} from 'lucide-react';
import {
  calculateTerminationEstimate,
  calculateVacationEstimate,
  evaluateRetirement2026,
  type InsalubrityLevel,
  type NoticeType,
  type RetirementGender,
  type TerminationReason,
} from '../../lib/freeToolsCalculations';
import type { CalculatorPdfReport } from '../../lib/freeToolsPdfReport';
import type { ProToolId } from '../../lib/freeToolsProAccess';
import { BenefitsPro, BpcPro, ThirteenthPro } from './FreeToolsAdditionalCalculators';
import { CalculatorPdfReportButton } from './CalculatorPdfReportButton';

const currency = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' });
const decimal = new Intl.NumberFormat('pt-BR', { maximumFractionDigits: 1 });

const TERMINATION_REASON_LABELS: Record<TerminationReason, string> = {
  without_cause: 'Demissão sem justa causa',
  agreement: 'Acordo entre as partes (Art. 484-A)',
  resignation: 'Pedido de demissão',
  just_cause: 'Demissão por justa causa',
};

function numeric(value: string) {
  const parsed = Number(value.trim().replace(',', '.'));
  return Number.isFinite(parsed) ? Math.max(0, parsed) : 0;
}

function yesNo(value: boolean) {
  return value ? 'Sim' : 'Não';
}

function Field({
  label,
  value,
  onChange,
  prefix,
  suffix,
  help,
  max,
  step = 'any',
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  prefix?: string;
  suffix?: string;
  help?: string;
  max?: number;
  step?: number | 'any';
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
          className={`min-h-12 w-full rounded-lg border border-[#d5cfc5] bg-white py-3 text-sm font-bold text-[#111820] outline-none transition hover:border-[#bbb1a1] focus:border-[#91722f] focus:ring-4 focus:ring-[#91722f]/10 ${prefix ? 'pl-12' : 'pl-4'} ${suffix ? 'pr-16' : 'pr-4'}`}
        />
        {suffix && <span className="absolute inset-y-0 right-4 flex items-center text-xs font-bold text-[#727c84]">{suffix}</span>}
      </span>
      {help && <span className="mt-1.5 block text-xs leading-5 text-[#68727a]">{help}</span>}
    </label>
  );
}

function Section({ number, title, description, children }: { number: string; title: string; description?: string; children: ReactNode }) {
  return (
    <section className="border-b border-[#e3ddd4] pb-7 last:border-0 last:pb-0">
      <div className="mb-5 flex items-start gap-3">
        <span className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full border border-[#c9b57f] bg-[#f7f0dc] text-[9px] font-black text-[#765b25]">{number}</span>
        <div>
          <h3 className="text-sm font-black text-[#111820]">{title}</h3>
          {description && <p className="mt-1 text-xs leading-5 text-[#6b747c]">{description}</p>}
        </div>
      </div>
      {children}
    </section>
  );
}

function ResultLine({ label, value, emphasized, subtext }: { label: string; value: string; emphasized?: boolean; subtext?: string }) {
  return (
    <div className={`flex flex-col border-b border-white/10 py-3 last:border-0 ${emphasized ? 'text-[#f0d98f]' : 'text-white/76'}`}>
      <div className="flex items-start justify-between gap-5">
        <span className="text-xs leading-5 sm:text-sm">{label}</span>
        <strong className="shrink-0 text-right text-xs font-black sm:text-base">{value}</strong>
      </div>
      {subtext && <span className="mt-0.5 text-[11px] text-white/45">{subtext}</span>}
    </div>
  );
}

function Result({
  eyebrow,
  headline,
  summary,
  icon,
  children,
  note,
  report,
  action,
  status,
  onUnlockRequired,
}: {
  eyebrow: string;
  headline: string;
  summary: string;
  icon: ReactNode;
  children: ReactNode;
  note: string;
  report: CalculatorPdfReport;
  action?: ReactNode;
  status?: ProAccessStatus | null;
  onUnlockRequired?: () => void;
}) {
  return (
    <aside className="bg-[#132231] p-5 text-white sm:p-7 lg:sticky lg:top-0 lg:self-start">
      <div className="flex items-center justify-between gap-3 border-b border-white/10 pb-4">
        <span className="inline-flex items-center gap-2 text-[9px] font-black uppercase tracking-[0.13em] text-[#d8bd73]">
          <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
          Resultado Pro com Tributos 2026
        </span>
        <BadgeCheck className="h-5 w-5 text-white/25" />
      </div>
      <div className="flex items-start justify-between gap-5 border-b border-white/10 py-6">
        <div>
          <p className="text-[10px] font-black uppercase tracking-[0.18em] text-[#d8bd73]">{eyebrow}</p>
          <p className="mt-2 text-3xl font-black leading-tight tracking-[-0.03em] sm:text-4xl">{headline}</p>
          <p className="mt-3 max-w-md text-xs leading-5 text-white/60 sm:text-sm">{summary}</p>
        </div>
        <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-white/10 bg-white/[0.04] text-[#d8bd73]">{icon}</span>
      </div>
      <div className="mt-3">{children}</div>
      <div className="mt-6 flex gap-3 border-t border-white/10 pt-5 text-xs leading-5 text-white/55">
        <Info className="mt-0.5 h-4 w-4 shrink-0 text-[#d8bd73]" />
        {note}
      </div>
      <div className="mt-6 border-t border-white/10 pt-5">
        <CalculatorPdfReportButton report={report} mode="pro" status={status} onUnlockRequired={onUnlockRequired} />
      </div>
      {action && <div className="mt-4">{action}</div>}
    </aside>
  );
}

function Workbench({ title, description, children, result }: { title: string; description: string; children: ReactNode; result: ReactNode }) {
  return (
    <div className="grid overflow-hidden rounded-2xl border border-[#d4cdc2] bg-white shadow-[0_24px_65px_rgba(29,36,42,0.11)] lg:grid-cols-[1.06fr_0.94fr]">
      <section className="min-w-0 bg-[#fffdfa]">
        <div className="border-b border-[#e2dcd2] bg-[#faf7f1] px-5 py-5 sm:px-7">
          <p className="text-[9px] font-black uppercase tracking-[0.16em] text-[#806128]">Modo Pro · cálculo avançado 2026</p>
          <h3 className="mt-2 text-xl font-black tracking-[-0.025em] text-[#111820]">{title}</h3>
          <p className="mt-2 text-xs leading-5 text-[#68727a]">{description}</p>
        </div>
        <div className="space-y-7 p-5 sm:p-7 lg:p-8">{children}</div>
      </section>
      {result}
    </div>
  );
}

// ==========================================
// 1. RESCISÃO CLT (PRO AVANÇADA)
// ==========================================

function TerminationPro({ status, onUnlockRequired }: { status?: ProAccessStatus | null; onUnlockRequired?: () => void }) {
  const [salary, setSalary] = useState('3500');
  const [reason, setReason] = useState<TerminationReason>('without_cause');
  const [noticeType, setNoticeType] = useState<NoticeType>('indemnified_employer');
  const [days, setDays] = useState('15');
  const [years, setYears] = useState('2');
  const [thirteenth, setThirteenth] = useState('7');
  const [vacation, setVacation] = useState('7');
  const [fgts, setFgts] = useState('10000');
  const [expired, setExpired] = useState(false);
  const [insalubrity, setInsalubrity] = useState<InsalubrityLevel>('none');
  const [perilousness, setPerilousness] = useState(false);
  const [averages, setAverages] = useState('0');
  const [dependents, setDependents] = useState('0');

  const result = useMemo(
    () =>
      calculateTerminationEstimate({
        salary: numeric(salary),
        reason,
        noticeType,
        daysWorked: numeric(days),
        thirteenthMonths: numeric(thirteenth),
        vacationMonths: numeric(vacation),
        expiredVacation: expired,
        completedYears: numeric(years),
        fgtsBalance: numeric(fgts),
        insalubrity,
        perilousness,
        variableAverages: numeric(averages),
        dependents: numeric(dependents),
      }),
    [salary, reason, noticeType, days, thirteenth, vacation, expired, years, fgts, insalubrity, perilousness, averages, dependents]
  );

  const reset = () => {
    setSalary('3500');
    setReason('without_cause');
    setNoticeType('indemnified_employer');
    setDays('15');
    setYears('2');
    setThirteenth('7');
    setVacation('7');
    setFgts('10000');
    setExpired(false);
    setInsalubrity('none');
    setPerilousness(false);
    setAverages('0');
    setDependents('0');
  };

  const report: CalculatorPdfReport = {
    calculator: 'Calculadora de rescisão trabalhista',
    mode: 'pro',
    headline: `Total líquido estimado: ${currency.format(result.netTotal)} (Bruto: ${currency.format(result.total)})`,
    summary: 'Relatório completo com adicionais contratuais, cálculo de IRRF/INSS 2026 e comparativo de cenários.',
    sections: [
      {
        title: 'Dados do vínculo e parâmetros 2026',
        rows: [
          { label: 'Salário base informado', value: currency.format(numeric(salary)) },
          { label: 'Remuneração base considerada (com adicionais)', value: currency.format(result.effectiveBaseSalary) },
          { label: 'Motivo do desligamento', value: TERMINATION_REASON_LABELS[reason] },
          { label: 'Dias trabalhados no mês', value: `${numeric(days)} dia(s)` },
          { label: 'Anos completos na empresa', value: `${numeric(years)} ano(s)` },
          { label: 'Avos de 13º / Férias', value: `${numeric(thirteenth)}/12 e ${numeric(vacation)}/12` },
          { label: 'Saldo aproximado do FGTS', value: currency.format(numeric(fgts)) },
          { label: 'Dependentes para IRRF', value: `${numeric(dependents)} dependente(s)` },
        ],
      },
      {
        title: 'Memória detalhada de verbas',
        rows: [
          { label: 'Saldo de salário', value: currency.format(result.salaryBalance) },
          { label: `Aviso-prévio (${decimal.format(result.noticeDays)} dias)`, value: currency.format(result.notice) },
          { label: '13º proporcional', value: currency.format(result.thirteenthValue) },
          { label: 'Férias proporcionais + 1/3', value: currency.format(result.proportionalVacation) },
          { label: 'Férias vencidas + 1/3', value: currency.format(result.expiredVacationValue) },
          { label: 'Multa rescisória do FGTS', value: currency.format(result.fgtsPenalty) },
          { label: 'Total Bruto', value: currency.format(result.total) },
        ],
      },
      {
        title: 'Retenções fiscais (Tabelas Oficiais 2026)',
        rows: [
          { label: 'INSS sobre salário e aviso', value: `- ${currency.format(result.inssOnSalary)}` },
          { label: 'IRRF sobre salário e aviso', value: `- ${currency.format(result.irrfOnSalary)}` },
          { label: 'INSS sobre 13º salário', value: `- ${currency.format(result.inssOnThirteenth)}` },
          { label: 'IRRF sobre 13º salário', value: `- ${currency.format(result.irrfOnThirteenth)}` },
          { label: 'Total de Descontos Fiscais', value: `- ${currency.format(result.totalDeductions)}` },
          { label: 'Total Líquido a Receber', value: currency.format(result.netTotal) },
        ],
      },
      {
        title: 'Comparativo de Cenários de Desligamento',
        rows: result.scenarios.map((sc) => ({
          label: sc.label,
          value: `Líquido: ${currency.format(sc.netTotal)} | Multa FGTS: ${currency.format(sc.fgtsPenalty)} | Saque FGTS: ${sc.canWithdrawFgts ? 'Sim' : 'Não'}`,
        })),
      },
    ],
    disclaimer: 'Cálculo de precisão baseado nas tabelas progressivas de INSS e IRRF de 2026. Convenções coletivas e acordos específicos podem alterar adicionais e prazos.',
  };

  return (
    <Workbench
      title="Rescisão CLT Avançada com Impostos 2026"
      description="Cálculo completo com adicionais, tabela progressiva de INSS/IRRF 2026 e matriz comparativa de cenários."
      result={
        <Result
          eyebrow="Total líquido a receber"
          headline={currency.format(result.netTotal)}
          summary={`Total bruto de ${currency.format(result.total)} menos ${currency.format(result.totalDeductions)} em descontos oficiais de INSS e IRRF 2026.`}
          icon={<Calculator className="h-5 w-5" />}
          note="O saldo do FGTS não integra o total líquido. O saque depende da modalidade e da chave de conectividade."
          report={report}
          status={status}
          onUnlockRequired={onUnlockRequired}
        >
          {/* Gráfico/Barra de Distribuição Visual */}
          <div className="my-4 overflow-hidden rounded-lg bg-white/10 p-1">
            <div className="flex h-3 overflow-hidden rounded-md">
              <div style={{ width: `${Math.max(5, (result.netTotal / (result.total || 1)) * 100)}%` }} className="bg-emerald-400" title="Valor Líquido" />
              <div style={{ width: `${Math.min(95, (result.totalDeductions / (result.total || 1)) * 100)}%` }} className="bg-amber-400" title="Impostos/Descontos" />
            </div>
            <div className="mt-2 flex justify-between text-[10px] font-bold text-white/60">
              <span className="flex items-center gap-1.5"><span className="h-2 w-2 rounded-full bg-emerald-400" />Líquido: {currency.format(result.netTotal)}</span>
              <span className="flex items-center gap-1.5"><span className="h-2 w-2 rounded-full bg-amber-400" />Impostos: {currency.format(result.totalDeductions)}</span>
            </div>
          </div>

          <ResultLine label="Saldo de salário" value={currency.format(result.salaryBalance)} />
          {result.notice !== 0 && (
            <ResultLine
              label={`Aviso-prévio (${decimal.format(result.noticeDays)} dias)`}
              value={currency.format(result.notice)}
              subtext={result.notice < 0 ? 'Desconto de aviso prévio não cumprido' : undefined}
            />
          )}
          <ResultLine label="13º proporcional" value={currency.format(result.thirteenthValue)} />
          <ResultLine label="Férias proporcionais + 1/3" value={currency.format(result.proportionalVacation)} />
          {expired && <ResultLine label="Férias vencidas + 1/3" value={currency.format(result.expiredVacationValue)} />}
          <ResultLine label="Multa estimada do FGTS" value={currency.format(result.fgtsPenalty)} />
          <ResultLine label="Total Bruto" value={currency.format(result.total)} />
          <ResultLine label="Retenções INSS + IRRF (2026)" value={`- ${currency.format(result.totalDeductions)}`} subtext={`INSS: ${currency.format(result.inssOnSalary + result.inssOnThirteenth)} | IRRF: ${currency.format(result.irrfOnSalary + result.irrfOnThirteenth)}`} />
          <ResultLine label="Total Líquido Estimado" value={currency.format(result.netTotal)} emphasized />
        </Result>
      }
    >
      <Section number="01" title="Dados principais do contrato">
        <div className="grid gap-5 sm:grid-cols-2">
          <Field label="Salário bruto mensal" value={salary} onChange={setSalary} prefix="R$" />
          <label className="block">
            <span className="text-sm font-black text-[#26313a]">Motivo do desligamento</span>
            <select
              value={reason}
              onChange={(event) => setReason(event.target.value as TerminationReason)}
              className="mt-2 min-h-12 w-full rounded-lg border border-[#d5cfc5] bg-white px-4 py-3 text-sm font-bold outline-none focus:border-[#91722f] focus:ring-4 focus:ring-[#91722f]/10"
            >
              <option value="without_cause">Demissão sem justa causa</option>
              <option value="agreement">Acordo entre as partes (Art. 484-A)</option>
              <option value="resignation">Pedido de demissão</option>
              <option value="just_cause">Demissão por justa causa</option>
            </select>
          </label>
        </div>
      </Section>

      <Section number="02" title="Adicionais & Média Variável">
        <div className="grid gap-5 sm:grid-cols-3">
          <label className="block">
            <span className="text-sm font-black text-[#26313a]">Insalubridade</span>
            <select
              value={insalubrity}
              onChange={(event) => setInsalubrity(event.target.value as InsalubrityLevel)}
              className="mt-2 min-h-12 w-full rounded-lg border border-[#d5cfc5] bg-white px-3 py-3 text-xs font-bold outline-none focus:border-[#91722f]"
            >
              <option value="none">Nenhum grau</option>
              <option value="minimum_10">Grau Mínimo (10%)</option>
              <option value="medium_20">Grau Médio (20%)</option>
              <option value="maximum_40">Grau Máximo (40%)</option>
            </select>
          </label>

          <label className="flex cursor-pointer items-center gap-3 self-end rounded-lg border border-[#d5cfc5] bg-[#faf8f3] p-3 text-xs font-bold text-[#26313a]">
            <input type="checkbox" checked={perilousness} onChange={(event) => setPerilousness(event.target.checked)} className="h-4 w-4 accent-[#8a6e2f]" />
            Adicional Periculosidade (30%)
          </label>

          <Field label="Médias de Horas Extras/Comissões" value={averages} onChange={setAverages} prefix="R$" />
        </div>
      </Section>

      <Section number="03" title="Períodos e tributos 2026">
        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
          <Field label="Dias no mês" value={days} onChange={setDays} suffix="dias" max={30} step={1} />
          <Field label="Anos na empresa" value={years} onChange={setYears} suffix="anos" max={40} step={1} />
          <Field label="Avos de 13º" value={thirteenth} onChange={setThirteenth} suffix="/ 12" max={12} step={1} />
          <Field label="Avos de férias" value={vacation} onChange={setVacation} suffix="/ 12" max={12} step={1} />
        </div>

        <div className="mt-5 grid gap-5 sm:grid-cols-3">
          <Field label="Saldo atual do FGTS" value={fgts} onChange={setFgts} prefix="R$" />
          <Field label="Dependentes para IRRF" value={dependents} onChange={setDependents} suffix="dep." max={10} step={1} />
          <label className="flex cursor-pointer items-center gap-3 self-end rounded-lg border border-[#d5cfc5] bg-[#faf8f3] p-3 text-xs font-bold text-[#26313a]">
            <input type="checkbox" checked={expired} onChange={(event) => setExpired(event.target.checked)} className="h-4 w-4 accent-[#8a6e2f]" />
            Possui férias vencidas (+1/3)
          </label>
        </div>
      </Section>

      {/* Matriz Comparativa de Cenários */}
      <Section number="04" title="Comparador de cenários de desligamento">
        <div className="grid gap-3 sm:grid-cols-3">
          {result.scenarios.map((sc) => (
            <div key={sc.reason} className={`rounded-xl border p-4 transition-all ${sc.reason === reason ? 'border-[#8a6e2f] bg-[#fffcf5] ring-2 ring-[#8a6e2f]/20' : 'border-neutral-200 bg-neutral-50/60'}`}>
              <span className="text-[10px] font-black uppercase text-[#8a6e2f]">{sc.label}</span>
              <p className="mt-2 text-xl font-black text-[#111820]">{currency.format(sc.netTotal)}</p>
              <p className="text-[11px] text-neutral-500">Bruto: {currency.format(sc.grossTotal)}</p>
              <div className="mt-3 space-y-1 border-t border-neutral-200/60 pt-2 text-[11px]">
                <p><strong>Multa FGTS:</strong> {currency.format(sc.fgtsPenalty)}</p>
                <p><strong>Saque FGTS:</strong> {sc.canWithdrawFgts ? '✅ Permitido' : '❌ Não'}</p>
                <p><strong>Seguro-Desemprego:</strong> {sc.unemploymentInsuranceEligible ? '✅ Habilitado' : '❌ Indisponível'}</p>
              </div>
            </div>
          ))}
        </div>
      </Section>

      <button type="button" onClick={reset} className="inline-flex min-h-11 items-center gap-2 rounded-lg border border-[#d5cec3] bg-white px-4 text-sm font-black text-[#59646d]">
        <RotateCcw className="h-4 w-4" />Restaurar exemplo
      </button>
    </Workbench>
  );
}

// ==========================================
// 2. APOSENTADORIA INSS (PRO AVANÇADA)
// ==========================================

function Requirement({ title, eligible, lines }: { title: string; eligible: boolean; lines: string[] }) {
  return (
    <article className={`rounded-xl border p-4 ${eligible ? 'border-emerald-300 bg-emerald-950/40 text-emerald-100' : 'border-white/10 bg-white/[0.04] text-white'}`}>
      <div className="flex items-center gap-2">
        {eligible ? <CheckCircle2 className="h-5 w-5 text-emerald-400" /> : <Clock3 className="h-5 w-5 text-[#d8bd73]" />}
        <h4 className="text-xs font-black sm:text-sm">{title}</h4>
      </div>
      <p className={`mt-2 text-xs font-black ${eligible ? 'text-emerald-300' : 'text-[#efd991]'}`}>{eligible ? 'Requisitos atingidos em 2026' : 'Requisitos pendentes'}</p>
      <ul className={`mt-2 space-y-1 text-[11px] leading-4 ${eligible ? 'text-emerald-200/80' : 'text-white/60'}`}>
        {lines.map((line) => (
          <li key={line}>• {line}</li>
        ))}
      </ul>
    </article>
  );
}

function RetirementPro({ status, onUnlockRequired }: { status?: ProAccessStatus | null; onUnlockRequired?: () => void }) {
  const [gender, setGender] = useState<RetirementGender>('woman');
  const [age, setAge] = useState('57');
  const [contribution, setContribution] = useState('29');
  const [beforeReform, setBeforeReform] = useState(true);
  const [contrib2019, setContrib2019] = useState('324'); // Meses até 13/11/2019 (27 anos)
  const [avgSalary, setAvgSalary] = useState('3500');

  const result = useMemo(
    () =>
      evaluateRetirement2026({
        gender,
        age: numeric(age),
        contributionYears: numeric(contribution),
        contributedBeforeReform: beforeReform,
        contributionMonthsBeforeReform: numeric(contrib2019),
        averageSalary: numeric(avgSalary),
      }),
    [gender, age, contribution, beforeReform, contrib2019, avgSalary]
  );

  const missing = (current: number, target: number, label: string) => (current >= target ? `${label}: atingido` : `${label}: faltam ${decimal.format(target - current)} ano(s)`);

  const report: CalculatorPdfReport = {
    calculator: 'Calculadora aposentadoria INSS',
    mode: 'pro',
    headline: result.anyEligible ? `Aposentadoria possível em 2026 (RMI estimada: ${currency.format(result.estimatedRmi)})` : `Acompanhamento contínuo (Ano projetado: ${result.projectedRetirementYear})`,
    summary: `${decimal.format(result.currentAge)} anos de idade, ${decimal.format(result.contributionYears)} anos de contribuição e ${decimal.format(result.points)} pontos acumulados.`,
    sections: [
      {
        title: 'Dados do segurado e média salarial',
        rows: [
          { label: 'Gênero', value: gender === 'woman' ? 'Mulher' : 'Homem' },
          { label: 'Idade atual', value: `${decimal.format(result.currentAge)} ano(s)` },
          { label: 'Tempo total de contribuição', value: `${decimal.format(result.contributionYears)} ano(s)` },
          { label: 'Já contribuía antes da Reforma (13/11/2019)', value: yesNo(beforeReform) },
          { label: 'Pontuação atual', value: `${decimal.format(result.points)} pontos` },
          { label: 'Média contributiva estimada (80%/100%)', value: currency.format(numeric(avgSalary)) },
          { label: 'Alíquota de benefício calculada (60% + 2%/ano)', value: `${result.benefitRatePercentage}%` },
          { label: 'Renda Mensal Inicial (RMI) Estimada', value: currency.format(result.estimatedRmi) },
        ],
      },
      {
        title: 'Análise detalhada das 5 regras de transição em 2026',
        rows: [
          { label: '1. Regra Geral (Idade)', value: `${result.generalEligible ? 'Atingido' : 'Pendente'} (${missing(result.currentAge, result.generalAge, 'idade')}; ${missing(result.contributionYears, result.generalContribution, 'contribuição')})` },
          ...(beforeReform
            ? [
                { label: '2. Regra dos Pontos (93F / 103H)', value: `${result.pointsEligible ? 'Atingido' : 'Pendente'} (${missing(result.points, result.transitionPoints, 'pontos')}; ${missing(result.contributionYears, result.transitionContribution, 'contribuição')})` },
                { label: '3. Idade Mínima Progressiva (59.5F / 64.5H)', value: `${result.progressiveEligible ? 'Atingido' : 'Pendente'} (${missing(result.currentAge, result.progressiveAge, 'idade')}; ${missing(result.contributionYears, result.transitionContribution, 'contribuição')})` },
                { label: '4. Pedágio de 50%', value: `${result.toll50Eligible ? 'Atingido' : 'Pendente'} (Tempo exigido com pedágio: ${decimal.format(result.toll50RequiredTime)} anos)` },
                { label: '5. Pedágio de 100%', value: `${result.toll100Eligible ? 'Atingido' : 'Pendente'} (Exige ${result.toll100AgeRequired} anos idade e ${decimal.format(result.toll100RequiredTime)} anos contribuição)` },
              ]
            : []),
        ],
      },
    ],
    disclaimer: 'Análise de alta precisão considerando todas as 5 regras de transição da Emenda Constitucional 103/2019 para 2026. Somente contribuições homologadas no CNIS devem ser consideradas.',
  };

  return (
    <Workbench
      title="Simulador de Aposentadoria INSS com Pedágios e RMI"
      description="Avalie as 5 regras de transição vigentes em 2026, projete a Renda Mensal Inicial (RMI) e encontre a regra mais vantajosa."
      result={
        <Result
          eyebrow="Estimativa de Renda Mensal (RMI)"
          headline={currency.format(result.estimatedRmi)}
          summary={`Base de cálculo com taxa de benefício de ${result.benefitRatePercentage}% sobre a média salarial. Ano provável estimado: ${result.projectedRetirementYear}.`}
          icon={<Landmark className="h-5 w-5" />}
          note="Atividade especial, magistério, trabalho rural e direito adquirido exigem simulação documental específica."
          report={report}
          status={status}
          onUnlockRequired={onUnlockRequired}
          action={
            <a
              href="https://meu.inss.gov.br/"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-lg border border-[#d8bd73]/40 px-4 text-xs font-black text-[#efd991]"
            >
              Conferir extrato CNIS no Meu INSS <ExternalLink className="h-4 w-4" />
            </a>
          }
        >
          <div className="grid gap-3 py-4 sm:grid-cols-2">
            <Requirement
              title="1. Regra geral (Idade)"
              eligible={result.generalEligible}
              lines={[missing(result.currentAge, result.generalAge, 'Idade'), missing(result.contributionYears, result.generalContribution, 'Contribuição')]}
            />
            {beforeReform && (
              <>
                <Requirement
                  title="2. Regra dos Pontos"
                  eligible={result.pointsEligible}
                  lines={[missing(result.points, result.transitionPoints, 'Pontos'), missing(result.contributionYears, result.transitionContribution, 'Contribuição')]}
                />
                <Requirement
                  title="3. Idade Progressiva"
                  eligible={result.progressiveEligible}
                  lines={[missing(result.currentAge, result.progressiveAge, 'Idade'), missing(result.contributionYears, result.transitionContribution, 'Contribuição')]}
                />
                <Requirement
                  title="4. Pedágio 50%"
                  eligible={result.toll50Eligible}
                  lines={[`Exige ${decimal.format(result.toll50RequiredTime)} anos totais`, missing(result.contributionYears, result.toll50RequiredTime, 'Contribuição')]}
                />
                <Requirement
                  title="5. Pedágio 100%"
                  eligible={result.toll100Eligible}
                  lines={[missing(result.currentAge, result.toll100AgeRequired, 'Idade'), missing(result.contributionYears, result.toll100RequiredTime, 'Contribuição')]}
                />
              </>
            )}
          </div>
        </Result>
      }
    >
      <Section number="01" title="Perfil considerado">
        <div className="grid grid-cols-2 rounded-lg bg-[#ece9e2] p-1">
          {(
            [
              ['woman', 'Mulher'],
              ['man', 'Homem'],
            ] as const
          ).map(([value, label]) => (
            <button
              key={value}
              type="button"
              onClick={() => setGender(value)}
              className={`min-h-11 rounded-md text-sm font-black ${gender === value ? 'bg-white shadow-sm' : 'text-[#69727a]'}`}
            >
              {label}
            </button>
          ))}
        </div>
      </Section>

      <Section number="02" title="Dados de contribuição e média salarial">
        <div className="grid gap-5 sm:grid-cols-2">
          <Field label="Idade atual" value={age} onChange={setAge} suffix="anos" max={100} step={0.5} />
          <Field label="Tempo de contribuição total" value={contribution} onChange={setContribution} suffix="anos" max={60} step={0.5} />
          <Field label="Média salarial contributiva" value={avgSalary} onChange={setAvgSalary} prefix="R$" help="Média estimada de todos os seus salários de contribuição." />
          <Field label="Meses contribuídos até 13/11/2019" value={contrib2019} onChange={setContrib2019} suffix="meses" help="Necessário para avaliar as regras de pedágio." />
        </div>
      </Section>

      <Section number="03" title="Regras de transição">
        <label className="flex cursor-pointer items-start gap-3 rounded-lg border border-[#d5cfc5] bg-[#faf8f3] p-4 text-sm font-bold">
          <input type="checkbox" checked={beforeReform} onChange={(event) => setBeforeReform(event.target.checked)} className="mt-0.5 h-4 w-4 accent-[#8a6e2f]" />
          <span>
            Já contribuía antes de 13/11/2019
            <small className="mt-1 block font-medium leading-5 text-[#69727a]">Habilita as regras de transição dos Pontos, Idade Progressiva e Pedágios de 50% e 100%.</small>
          </span>
        </label>
      </Section>
    </Workbench>
  );
}

// ==========================================
// 3. FÉRIAS CLT (PRO AVANÇADA)
// ==========================================

function VacationPro({ status, onUnlockRequired }: { status?: ProAccessStatus | null; onUnlockRequired?: () => void }) {
  const [salary, setSalary] = useState('3500');
  const [averages, setAverages] = useState('0');
  const [vacationDays, setVacationDays] = useState('30');
  const [sellDays, setSellDays] = useState(false);
  const [absences, setAbsences] = useState('0');
  const [thirteenthAdvance, setThirteenthAdvance] = useState(false);
  const [isDouble, setIsDouble] = useState(false);
  const [dependents, setDependents] = useState('0');

  const result = useMemo(
    () =>
      calculateVacationEstimate(numeric(salary), numeric(averages), {
        vacationDays: numeric(vacationDays),
        sellDays,
        unexcusedAbsences: numeric(absences),
        thirteenthAdvance,
        isDouble,
        dependents: numeric(dependents),
      }),
    [salary, averages, vacationDays, sellDays, absences, thirteenthAdvance, isDouble, dependents]
  );

  const report: CalculatorPdfReport = {
    calculator: 'Calculadora de férias',
    mode: 'pro',
    headline: `Total líquido a receber: ${currency.format(result.netTotal)} (Bruto: ${currency.format(result.total)})`,
    summary: 'Relatório completo de férias com abono pecuniário (venda de 10 dias), adicionais, tabela Art. 130 CLT e retenções fiscais de 2026.',
    sections: [
      {
        title: 'Parâmetros informados',
        rows: [
          { label: 'Salário bruto mensal', value: currency.format(numeric(salary)) },
          { label: 'Média de adicionais variáveis', value: currency.format(numeric(averages)) },
          { label: 'Dias de férias solicitados', value: `${result.actualVacationDays} dias` },
          { label: 'Venda de férias (Abono pecuniário)', value: sellDays ? 'Sim (10 dias)' : 'Não' },
          { label: 'Faltas injustificadas no ano', value: `${numeric(absences)} falta(s) (Dias de direito: ${result.maxAllowedDays})` },
          { label: 'Adiantamento de 50% do 13º', value: yesNo(thirteenthAdvance) },
          { label: 'Férias em dobro (concessivo vencido)', value: yesNo(isDouble) },
        ],
      },
      {
        title: 'Composição das verbas e isenções',
        rows: [
          { label: `Férias gozadas (${result.actualVacationDays} dias)`, value: currency.format(result.vacationPay) },
          { label: 'Adicional constitucional de 1/3', value: currency.format(result.constitutionalThird) },
          { label: 'Abono pecuniário (10 dias vendidos - Isento)', value: currency.format(result.abonoPay) },
          { label: '1/3 sobre o abono pecuniário (Isento)', value: currency.format(result.abonoThird) },
          { label: 'Adiantamento de 13º salário', value: currency.format(result.thirteenthAdvancePay) },
          { label: 'Total Bruto a Receber', value: currency.format(result.total) },
        ],
      },
      {
        title: 'Retenções Fiscais 2026 (INSS & IRRF)',
        rows: [
          { label: 'INSS sobre férias e 1/3', value: `- ${currency.format(result.inssDeduction)}` },
          { label: 'IRRF sobre férias e 1/3', value: `- ${currency.format(result.irrfDeduction)}` },
          { label: 'Total de Descontos Fiscais', value: `- ${currency.format(result.inssDeduction + result.irrfDeduction)}` },
          { label: 'Total Líquido a Receber', value: currency.format(result.netTotal) },
        ],
      },
    ],
    disclaimer: 'O abono pecuniário (venda de 10 dias) e o seu 1/3 são isentos de INSS e Imposto de Renda. O pagamento das férias deve ocorrer até 2 dias antes do início do gozo.',
  };

  return (
    <Workbench
      title="Cálculo de Férias Completo com Abono e Tributos 2026"
      description="Inclua venda de férias (abono de 10 dias), médias de adicionais, adiantamento do 13º e retenções oficiais de INSS/IRRF."
      result={
        <Result
          eyebrow="Total líquido a receber"
          headline={currency.format(result.netTotal)}
          summary={`Total bruto de ${currency.format(result.total)} menos ${currency.format(result.inssDeduction + result.irrfDeduction)} em tributos. Abono isento: ${currency.format(result.totalAbonoPecuniario)}.`}
          icon={<Palmtree className="h-5 w-5" />}
          note="O pagamento integral das férias e abono deve ser realizado até 2 dias antes do início do período de descanso (Art. 145 CLT)."
          report={report}
          status={status}
          onUnlockRequired={onUnlockRequired}
        >
          <ResultLine label={`Férias gozadas (${result.actualVacationDays} dias)`} value={currency.format(result.vacationPay)} />
          <ResultLine label="Adicional constitucional de 1/3" value={currency.format(result.constitutionalThird)} />
          {result.totalAbonoPecuniario > 0 && <ResultLine label="Abono pecuniário (10 dias + 1/3)" value={currency.format(result.totalAbonoPecuniario)} subtext="Isento de INSS e Imposto de Renda" />}
          {result.thirteenthAdvancePay > 0 && <ResultLine label="Adiantamento de 50% do 13º" value={currency.format(result.thirteenthAdvancePay)} />}
          <ResultLine label="Retenções INSS + IRRF 2026" value={`- ${currency.format(result.inssDeduction + result.irrfDeduction)}`} subtext={`INSS: ${currency.format(result.inssDeduction)} | IRRF: ${currency.format(result.irrfDeduction)}`} />
          <ResultLine label="Total Líquido a Receber" value={currency.format(result.netTotal)} emphasized />
        </Result>
      }
    >
      <Section number="01" title="Remuneração e adicionais">
        <div className="grid gap-5 sm:grid-cols-2">
          <Field label="Salário bruto mensal" value={salary} onChange={setSalary} prefix="R$" />
          <Field label="Média de horas extras/comissões" value={averages} onChange={setAverages} prefix="R$" help="Média habitual de adicionais dos últimos 12 meses." />
        </div>
      </Section>

      <Section number="02" title="Dias de férias e faltas (Art. 130 CLT)">
        <div className="grid gap-5 sm:grid-cols-3">
          <label className="block">
            <span className="text-sm font-black text-[#26313a]">Dias de férias</span>
            <select
              value={vacationDays}
              onChange={(event) => setVacationDays(event.target.value)}
              className="mt-2 min-h-12 w-full rounded-lg border border-[#d5cfc5] bg-white px-4 py-3 text-sm font-bold outline-none focus:border-[#91722f]"
            >
              <option value="30">30 dias</option>
              <option value="20">20 dias</option>
              <option value="15">15 dias</option>
              <option value="10">10 dias</option>
            </select>
          </label>
          <Field label="Faltas injustificadas" value={absences} onChange={setAbsences} suffix="faltas" max={50} step={1} help={`Limite permitido: ${result.maxAllowedDays} dias.`} />
          <Field label="Dependentes para IRRF" value={dependents} onChange={setDependents} suffix="dep." max={10} step={1} />
        </div>
      </Section>

      <Section number="03" title="Opções avançadas de férias">
        <div className="grid gap-4 sm:grid-cols-3">
          <label className="flex cursor-pointer items-start gap-3 rounded-lg border border-[#d5cfc5] bg-[#faf8f3] p-3 text-xs font-bold text-[#26313a]">
            <input type="checkbox" checked={sellDays} onChange={(event) => setSellDays(event.target.checked)} className="h-4 w-4 accent-[#8a6e2f]" />
            <span>Vender 10 dias (Abono pecuniário)</span>
          </label>

          <label className="flex cursor-pointer items-start gap-3 rounded-lg border border-[#d5cfc5] bg-[#faf8f3] p-3 text-xs font-bold text-[#26313a]">
            <input type="checkbox" checked={thirteenthAdvance} onChange={(event) => setThirteenthAdvance(event.target.checked)} className="h-4 w-4 accent-[#8a6e2f]" />
            <span>Adiantar 1ª parcela do 13º</span>
          </label>

          <label className="flex cursor-pointer items-start gap-3 rounded-lg border border-[#d5cfc5] bg-[#faf8f3] p-3 text-xs font-bold text-[#26313a]">
            <input type="checkbox" checked={isDouble} onChange={(event) => setIsDouble(event.target.checked)} className="h-4 w-4 accent-[#8a6e2f]" />
            <span>Férias em dobro (concessivo vencido)</span>
          </label>
        </div>
      </Section>

      <button type="button" onClick={() => { setSalary('3500'); setAverages('0'); setVacationDays('30'); setSellDays(false); setAbsences('0'); setThirteenthAdvance(false); setIsDouble(false); setDependents('0'); }} className="inline-flex min-h-11 items-center gap-2 rounded-lg border border-[#d5cec3] bg-white px-4 text-sm font-black text-[#59646d]">
        <RotateCcw className="h-4 w-4" />Restaurar exemplo
      </button>
    </Workbench>
  );
}

export function FreeToolsAdvancedCalculator({
  tool,
  status,
  onUnlockRequired,
}: {
  tool: ProToolId;
  status?: ProAccessStatus | null;
  onUnlockRequired?: () => void;
}) {
  if (tool === 'termination') return <TerminationPro status={status} onUnlockRequired={onUnlockRequired} />;
  if (tool === 'retirement') return <RetirementPro status={status} onUnlockRequired={onUnlockRequired} />;
  if (tool === 'vacation') return <VacationPro status={status} onUnlockRequired={onUnlockRequired} />;
  if (tool === 'thirteenth') return <ThirteenthPro status={status} onUnlockRequired={onUnlockRequired} />;
  if (tool === 'benefits') return <BenefitsPro status={status} onUnlockRequired={onUnlockRequired} />;
  return <BpcPro status={status} onUnlockRequired={onUnlockRequired} />;
}
