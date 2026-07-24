import { useMemo, useState, type ReactNode } from 'react';
import { BadgeCheck, Calculator, CheckCircle2, Clock3, ExternalLink, Info, Landmark, Palmtree, RotateCcw } from 'lucide-react';
import {
  calculateTerminationEstimate,
  calculateVacationEstimate,
  evaluateRetirement2026,
  type TerminationReason,
} from '../../lib/freeToolsCalculations';
import type { ProToolId } from '../../lib/freeToolsProAccess';

const currency = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' });
const decimal = new Intl.NumberFormat('pt-BR', { maximumFractionDigits: 1 });

function numeric(value: string) {
  const parsed = Number(value.trim().replace(',', '.'));
  return Number.isFinite(parsed) ? Math.max(0, parsed) : 0;
}

function Field({ label, value, onChange, prefix, suffix, help, max, step = 'any' }: { label: string; value: string; onChange: (value: string) => void; prefix?: string; suffix?: string; help?: string; max?: number; step?: number | 'any' }) {
  return <label className="block"><span className="text-sm font-black text-[#26313a]">{label}</span><span className="relative mt-2 block">{prefix && <span className="absolute inset-y-0 left-4 flex items-center text-sm font-bold text-[#727c84]">{prefix}</span>}<input type="number" inputMode="decimal" min={0} max={max} step={step} value={value} onChange={(event) => onChange(event.target.value)} className={`min-h-12 w-full rounded-lg border border-[#d5cfc5] bg-white py-3 text-sm font-bold text-[#111820] outline-none transition hover:border-[#bbb1a1] focus:border-[#91722f] focus:ring-4 focus:ring-[#91722f]/10 ${prefix ? 'pl-12' : 'pl-4'} ${suffix ? 'pr-16' : 'pr-4'}`} />{suffix && <span className="absolute inset-y-0 right-4 flex items-center text-xs font-bold text-[#727c84]">{suffix}</span>}</span>{help && <span className="mt-1.5 block text-xs leading-5 text-[#68727a]">{help}</span>}</label>;
}

function Section({ number, title, description, children }: { number: string; title: string; description?: string; children: ReactNode }) {
  return <section className="border-b border-[#e3ddd4] pb-7 last:border-0 last:pb-0"><div className="mb-5 flex items-start gap-3"><span className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full border border-[#c9b57f] bg-[#f7f0dc] text-[9px] font-black text-[#765b25]">{number}</span><div><h3 className="text-sm font-black text-[#111820]">{title}</h3>{description && <p className="mt-1 text-xs leading-5 text-[#6b747c]">{description}</p>}</div></div>{children}</section>;
}

function ResultLine({ label, value, emphasized }: { label: string; value: string; emphasized?: boolean }) {
  return <div className={`flex items-start justify-between gap-5 border-b border-white/10 py-3.5 last:border-0 ${emphasized ? 'text-[#f0d98f]' : 'text-white/76'}`}><span className="text-sm leading-5">{label}</span><strong className="shrink-0 text-right text-sm font-black sm:text-base">{value}</strong></div>;
}

function Result({ eyebrow, headline, summary, icon, children, note, action }: { eyebrow: string; headline: string; summary: string; icon: ReactNode; children: ReactNode; note: string; action?: ReactNode }) {
  return <aside className="bg-[#132231] p-5 text-white sm:p-7 lg:sticky lg:top-0 lg:self-start"><div className="flex items-center justify-between gap-3 border-b border-white/10 pb-4"><span className="inline-flex items-center gap-2 text-[9px] font-black uppercase tracking-[0.13em] text-[#d8bd73]"><span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />Resultado Pro atualizado</span><BadgeCheck className="h-5 w-5 text-white/25" /></div><div className="flex items-start justify-between gap-5 border-b border-white/10 py-6"><div><p className="text-[10px] font-black uppercase tracking-[0.18em] text-[#d8bd73]">{eyebrow}</p><p className="mt-2 text-3xl font-black leading-tight tracking-[-0.03em] sm:text-4xl">{headline}</p><p className="mt-3 max-w-md text-sm leading-6 text-white/55">{summary}</p></div><span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-white/10 bg-white/[0.04] text-[#d8bd73]">{icon}</span></div><div className="mt-3">{children}</div><div className="mt-6 flex gap-3 border-t border-white/10 pt-5 text-xs leading-5 text-white/55"><Info className="mt-0.5 h-4 w-4 shrink-0 text-[#d8bd73]" />{note}</div>{action && <div className="mt-5">{action}</div>}</aside>;
}

function Workbench({ title, description, children, result }: { title: string; description: string; children: ReactNode; result: ReactNode }) {
  return <div className="grid overflow-hidden rounded-2xl border border-[#d4cdc2] bg-white shadow-[0_24px_65px_rgba(29,36,42,0.11)] lg:grid-cols-[1.06fr_0.94fr]"><section className="min-w-0 bg-[#fffdfa]"><div className="border-b border-[#e2dcd2] bg-[#faf7f1] px-5 py-5 sm:px-7"><p className="text-[9px] font-black uppercase tracking-[0.16em] text-[#806128]">Modo Pro · cálculo avançado</p><h3 className="mt-2 text-xl font-black tracking-[-0.025em] text-[#111820]">{title}</h3><p className="mt-2 text-xs leading-5 text-[#68727a]">{description}</p></div><div className="space-y-7 p-5 sm:p-7 lg:p-8">{children}</div></section>{result}</div>;
}

function TerminationPro() {
  const [salary, setSalary] = useState('3500');
  const [reason, setReason] = useState<TerminationReason>('without_cause');
  const [days, setDays] = useState('15');
  const [years, setYears] = useState('2');
  const [thirteenth, setThirteenth] = useState('7');
  const [vacation, setVacation] = useState('7');
  const [fgts, setFgts] = useState('10000');
  const [expired, setExpired] = useState(false);
  const result = useMemo(() => calculateTerminationEstimate({ salary: numeric(salary), reason, daysWorked: numeric(days), thirteenthMonths: numeric(thirteenth), vacationMonths: numeric(vacation), expiredVacation: expired, completedYears: numeric(years), fgtsBalance: numeric(fgts) }), [salary, reason, days, years, thirteenth, vacation, fgts, expired]);
  const reset = () => { setSalary('3500'); setReason('without_cause'); setDays('15'); setYears('2'); setThirteenth('7'); setVacation('7'); setFgts('10000'); setExpired(false); };
  return <Workbench title="Memória avançada da rescisão" description="Preencha períodos, FGTS e condições do vínculo para detalhar as parcelas consideradas." result={<Result eyebrow="Total bruto aproximado" headline={currency.format(result.total)} summary="Soma das parcelas estimadas antes de descontos e situações especiais." icon={<Calculator className="h-5 w-5" />} note="O saldo do FGTS não integra o total. O saque depende da modalidade e da situação do trabalhador."><ResultLine label="Saldo de salário" value={currency.format(result.salaryBalance)} />{result.notice > 0 && <ResultLine label={`Aviso-prévio (${decimal.format(result.noticeDays)} dias)`} value={currency.format(result.notice)} />}<ResultLine label="13º proporcional" value={currency.format(result.thirteenthValue)} /><ResultLine label="Férias proporcionais + 1/3" value={currency.format(result.proportionalVacation)} />{expired && <ResultLine label="Férias vencidas + 1/3" value={currency.format(result.expiredVacationValue)} />}<ResultLine label="Multa estimada do FGTS" value={currency.format(result.fgtsPenalty)} emphasized /></Result>}>
    <Section number="01" title="Dados principais"><div className="grid gap-5 sm:grid-cols-2"><Field label="Salário bruto mensal" value={salary} onChange={setSalary} prefix="R$" /><label className="block"><span className="text-sm font-black text-[#26313a]">Motivo do desligamento</span><select value={reason} onChange={(event) => setReason(event.target.value as TerminationReason)} className="mt-2 min-h-12 w-full rounded-lg border border-[#d5cfc5] bg-white px-4 py-3 text-sm font-bold outline-none focus:border-[#91722f] focus:ring-4 focus:ring-[#91722f]/10"><option value="without_cause">Demissão sem justa causa</option><option value="agreement">Acordo entre as partes</option><option value="resignation">Pedido de demissão</option><option value="just_cause">Demissão por justa causa</option></select></label></div></Section>
    <Section number="02" title="Períodos considerados"><div className="grid gap-5 sm:grid-cols-2"><Field label="Dias trabalhados no mês" value={days} onChange={setDays} suffix="dias" max={30} step={1} /><Field label="Anos completos na empresa" value={years} onChange={setYears} suffix="anos" max={20} step={1} /><Field label="Avos de 13º no ano" value={thirteenth} onChange={setThirteenth} suffix="/ 12" max={12} step={1} /><Field label="Avos de férias atuais" value={vacation} onChange={setVacation} suffix="/ 12" max={12} step={1} /></div></Section>
    <Section number="03" title="FGTS e férias vencidas"><div className="grid gap-5 sm:grid-cols-2"><Field label="Saldo aproximado do FGTS" value={fgts} onChange={setFgts} prefix="R$" /><label className="flex min-h-12 cursor-pointer items-center gap-3 self-end rounded-lg border border-[#d5cfc5] bg-[#faf8f3] px-4 py-3 text-sm font-bold"><input type="checkbox" checked={expired} onChange={(event) => setExpired(event.target.checked)} className="h-4 w-4 accent-[#8a6e2f]" />Possui férias vencidas</label></div></Section>
    <button type="button" onClick={reset} className="inline-flex min-h-11 items-center gap-2 rounded-lg border border-[#d5cec3] bg-white px-4 text-sm font-black text-[#59646d]"><RotateCcw className="h-4 w-4" />Restaurar exemplo</button>
  </Workbench>;
}

function Requirement({ title, eligible, lines }: { title: string; eligible: boolean; lines: string[] }) {
  return <article className={`rounded-xl border p-4 ${eligible ? 'border-emerald-300 bg-emerald-50 text-emerald-950' : 'border-white/10 bg-white/[0.04] text-white'}`}><div className="flex items-center gap-2">{eligible ? <CheckCircle2 className="h-5 w-5 text-emerald-600" /> : <Clock3 className="h-5 w-5 text-[#d8bd73]" />}<h4 className="text-sm font-black">{title}</h4></div><p className={`mt-3 text-xs font-black ${eligible ? 'text-emerald-700' : 'text-[#efd991]'}`}>{eligible ? 'Requisitos atingidos' : 'Requisitos pendentes'}</p><ul className={`mt-3 space-y-1.5 text-xs leading-5 ${eligible ? 'text-emerald-800' : 'text-white/60'}`}>{lines.map((line) => <li key={line}>• {line}</li>)}</ul></article>;
}

function RetirementPro() {
  const [gender, setGender] = useState<'woman' | 'man'>('woman');
  const [age, setAge] = useState('57');
  const [contribution, setContribution] = useState('29');
  const [beforeReform, setBeforeReform] = useState(true);
  const result = useMemo(() => evaluateRetirement2026({ gender, age: numeric(age), contributionYears: numeric(contribution), contributedBeforeReform: beforeReform }), [gender, age, contribution, beforeReform]);
  const missing = (current: number, target: number, label: string) => current >= target ? `${label}: atingido` : `${label}: faltam ${decimal.format(target - current)} ano(s)`;
  return <Workbench title="Comparação avançada das regras" description="Considere apenas vínculos e contribuições reconhecidos no CNIS." result={<Result eyebrow="Panorama informado" headline={result.anyEligible ? 'Há uma regra possível' : 'Continue acompanhando'} summary={`${decimal.format(result.currentAge)} anos · ${decimal.format(result.contributionYears)} anos de contribuição · ${decimal.format(result.points)} pontos`} icon={<Landmark className="h-5 w-5" />} note="Pedágios, atividade especial, magistério, trabalho rural, deficiência e direito adquirido exigem análise própria." action={<a href="https://meu.inss.gov.br/" target="_blank" rel="noopener noreferrer" className="inline-flex min-h-11 items-center gap-2 rounded-lg border border-[#d8bd73]/40 px-4 text-sm font-black text-[#efd991]">Conferir no Meu INSS <ExternalLink className="h-4 w-4" /></a>}><div className="grid gap-3 py-4 xl:grid-cols-3"><Requirement title="Regra geral" eligible={result.generalEligible} lines={[missing(result.currentAge, result.generalAge, 'Idade'), missing(result.contributionYears, result.generalContribution, 'Contribuição')]} />{beforeReform && <Requirement title="Regra dos pontos" eligible={result.pointsEligible} lines={[missing(result.points, result.transitionPoints, 'Pontuação'), missing(result.contributionYears, result.transitionContribution, 'Contribuição')]} />}{beforeReform && <Requirement title="Idade progressiva" eligible={result.progressiveEligible} lines={[missing(result.currentAge, result.progressiveAge, 'Idade'), missing(result.contributionYears, result.transitionContribution, 'Contribuição')]} />}</div></Result>}>
    <Section number="01" title="Perfil considerado"><div className="grid grid-cols-2 rounded-lg bg-[#ece9e2] p-1">{([['woman','Mulher'],['man','Homem']] as const).map(([value,label]) => <button key={value} type="button" onClick={() => setGender(value)} className={`min-h-11 rounded-md text-sm font-black ${gender === value ? 'bg-white shadow-sm' : 'text-[#69727a]'}`}>{label}</button>)}</div></Section>
    <Section number="02" title="Dados previdenciários"><div className="grid gap-5 sm:grid-cols-2"><Field label="Idade atual" value={age} onChange={setAge} suffix="anos" max={100} step={0.5} /><Field label="Tempo total de contribuição" value={contribution} onChange={setContribution} suffix="anos" max={60} step={0.5} /></div></Section>
    <Section number="03" title="Regras de transição"><label className="flex cursor-pointer items-start gap-3 rounded-lg border border-[#d5cfc5] bg-[#faf8f3] p-4 text-sm font-bold"><input type="checkbox" checked={beforeReform} onChange={(event) => setBeforeReform(event.target.checked)} className="mt-0.5 h-4 w-4 accent-[#8a6e2f]" /><span>Já contribuía antes de 13/11/2019<small className="mt-1 block font-medium leading-5 text-[#69727a]">Habilita as regras de transição avaliadas.</small></span></label></Section>
  </Workbench>;
}

function VacationPro() {
  const [salary, setSalary] = useState('3500');
  const [averages, setAverages] = useState('0');
  const result = useMemo(() => calculateVacationEstimate(numeric(salary), numeric(averages)), [salary, averages]);
  return <Workbench title="Composição avançada das férias" description="Inclua médias habituais de adicionais e valores variáveis." result={<Result eyebrow="Total bruto estimado" headline={currency.format(result.total)} summary="Valor antes dos descontos aplicáveis ao pagamento de férias." icon={<Palmtree className="h-5 w-5" />} note="O valor líquido varia conforme INSS, Imposto de Renda, faltas, médias e condições específicas."><ResultLine label="Remuneração de férias" value={currency.format(result.remuneration)} /><ResultLine label="Adicional constitucional de 1/3" value={currency.format(result.constitutionalThird)} /><ResultLine label="Total antes dos descontos" value={currency.format(result.total)} emphasized /></Result>}>
    <Section number="01" title="Remuneração considerada"><div className="grid gap-5 sm:grid-cols-2"><Field label="Salário bruto mensal" value={salary} onChange={setSalary} prefix="R$" /><Field label="Média de adicionais e variáveis" value={averages} onChange={setAverages} prefix="R$" help="Horas extras, adicional noturno e comissões habituais." /></div></Section>
    <Section number="02" title="Condições consideradas"><div className="flex gap-3 border-l-2 border-[#c8aa64] bg-[#f7f2e6] p-4 text-xs leading-5 text-[#624f29]"><Info className="mt-0.5 h-4 w-4 shrink-0" />Esta versão considera 30 dias. Não inclui venda de 10 dias, adiantamento do 13º, faltas ou férias em dobro.</div></Section>
    <button type="button" onClick={() => { setSalary('3500'); setAverages('0'); }} className="inline-flex min-h-11 items-center gap-2 rounded-lg border border-[#d5cec3] bg-white px-4 text-sm font-black text-[#59646d]"><RotateCcw className="h-4 w-4" />Restaurar exemplo</button>
  </Workbench>;
}

export function FreeToolsAdvancedCalculator({ tool }: { tool: ProToolId }) {
  if (tool === 'termination') return <TerminationPro />;
  if (tool === 'retirement') return <RetirementPro />;
  return <VacationPro />;
}
