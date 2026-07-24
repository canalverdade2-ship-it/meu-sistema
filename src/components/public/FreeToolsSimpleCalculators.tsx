import { useMemo, useState } from 'react';
import { ArrowUpRight, BriefcaseBusiness, CheckCircle2, Clock3, Landmark, Palmtree } from 'lucide-react';
import {
  calculateTerminationEstimate,
  calculateVacationEstimate,
  evaluateRetirement2026,
  type TerminationReason,
} from '../../lib/freeToolsCalculations';
import type { ProToolId } from '../../lib/freeToolsProAccess';

const currency = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' });

function numeric(value: string) {
  const parsed = Number(value.replace(',', '.'));
  return Number.isFinite(parsed) ? Math.max(0, parsed) : 0;
}

function Field({ label, value, onChange, prefix, suffix, max }: { label: string; value: string; onChange: (value: string) => void; prefix?: string; suffix?: string; max?: number }) {
  return <label className="block"><span className="text-sm font-black text-[#26313a]">{label}</span><span className="relative mt-2 block">{prefix && <span className="absolute inset-y-0 left-4 flex items-center text-sm font-bold text-[#727c84]">{prefix}</span>}<input type="number" min={0} max={max} inputMode="decimal" value={value} onChange={(event) => onChange(event.target.value)} className={`min-h-12 w-full rounded-lg border border-[#d5cfc5] bg-white py-3 text-sm font-bold text-[#111820] outline-none transition focus:border-[#91722f] focus:ring-4 focus:ring-[#91722f]/10 ${prefix ? 'pl-12' : 'pl-4'} ${suffix ? 'pr-16' : 'pr-4'}`} />{suffix && <span className="absolute inset-y-0 right-4 flex items-center text-xs font-bold text-[#727c84]">{suffix}</span>}</span></label>;
}

function FreeLayout({ title, description, form, result, proItems }: { title: string; description: string; form: React.ReactNode; result: React.ReactNode; proItems: string[] }) {
  return <div className="grid overflow-hidden rounded-2xl border border-[#d4cdc2] bg-white shadow-[0_20px_55px_rgba(29,36,42,0.09)] lg:grid-cols-[1fr_0.88fr]">
    <section className="bg-[#fffdfa] p-5 sm:p-7 lg:p-8"><p className="text-[9px] font-black uppercase tracking-[0.16em] text-[#806128]">Modo Free · consulta básica</p><h3 className="mt-3 text-2xl font-black tracking-[-0.03em] text-[#111820]">{title}</h3><p className="mt-3 max-w-xl text-sm leading-6 text-[#68727a]">{description}</p><div className="mt-7 space-y-5">{form}</div></section>
    <aside className="bg-[#152433] p-5 text-white sm:p-7 lg:p-8"><p className="text-[9px] font-black uppercase tracking-[0.16em] text-[#d8bd73]">Resultado básico</p><div className="mt-5">{result}</div><div className="mt-7 border-t border-white/10 pt-6"><p className="flex items-center gap-2 text-xs font-black text-white"><ArrowUpRight className="h-4 w-4 text-[#d8bd73]" />No modo Pro você também recebe</p><ul className="mt-4 space-y-2.5 text-xs leading-5 text-white/58">{proItems.map((item) => <li key={item} className="flex gap-2"><CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-[#d8bd73]" />{item}</li>)}</ul></div></aside>
  </div>;
}

function TerminationFree() {
  const [salary, setSalary] = useState('3500');
  const [reason, setReason] = useState<TerminationReason>('without_cause');
  const [days, setDays] = useState('15');
  const result = useMemo(() => calculateTerminationEstimate({ salary: numeric(salary), reason, daysWorked: numeric(days), thirteenthMonths: 0, vacationMonths: 0, expiredVacation: false, completedYears: 0, fgtsBalance: 0 }), [salary, reason, days]);
  return <FreeLayout title="Estimativa inicial da rescisão" description="Informe somente salário, motivo e dias trabalhados para visualizar o saldo de salário e uma referência inicial." form={<><Field label="Salário bruto mensal" value={salary} onChange={setSalary} prefix="R$" /><label className="block"><span className="text-sm font-black text-[#26313a]">Motivo do desligamento</span><select value={reason} onChange={(event) => setReason(event.target.value as TerminationReason)} className="mt-2 min-h-12 w-full rounded-lg border border-[#d5cfc5] bg-white px-4 py-3 text-sm font-bold text-[#111820] outline-none focus:border-[#91722f] focus:ring-4 focus:ring-[#91722f]/10"><option value="without_cause">Demissão sem justa causa</option><option value="agreement">Acordo entre as partes</option><option value="resignation">Pedido de demissão</option><option value="just_cause">Demissão por justa causa</option></select></label><Field label="Dias trabalhados no mês" value={days} onChange={setDays} suffix="dias" max={30} /></>} result={<><BriefcaseBusiness className="h-7 w-7 text-[#d8bd73]" /><p className="mt-5 text-4xl font-black tracking-[-0.04em]">{currency.format(result.salaryBalance)}</p><p className="mt-2 text-sm leading-6 text-white/55">Saldo de salário estimado. Outras verbas dependem de períodos e informações adicionais.</p></>} proItems={['aviso-prévio conforme tempo de empresa', '13º e férias proporcionais', 'férias vencidas e multa do FGTS', 'memória detalhada das parcelas']} />;
}

function RetirementFree() {
  const [gender, setGender] = useState<'woman' | 'man'>('woman');
  const [age, setAge] = useState('57');
  const [contribution, setContribution] = useState('29');
  const result = useMemo(() => evaluateRetirement2026({ gender, age: numeric(age), contributionYears: numeric(contribution), contributedBeforeReform: false }), [gender, age, contribution]);
  const missingAge = Math.max(0, result.generalAge - result.currentAge);
  const missingContribution = Math.max(0, result.generalContribution - result.contributionYears);
  return <FreeLayout title="Verificação básica da regra geral" description="Compare idade e contribuição com a regra geral, sem avaliar regras de transição ou situações especiais." form={<><div className="grid grid-cols-2 rounded-lg bg-[#ece9e2] p-1">{([['woman','Mulher'],['man','Homem']] as const).map(([value,label]) => <button key={value} type="button" onClick={() => setGender(value)} className={`min-h-11 rounded-md px-4 py-2.5 text-sm font-black ${gender === value ? 'bg-white text-[#111820] shadow-sm' : 'text-[#69727a]'}`}>{label}</button>)}</div><Field label="Idade atual" value={age} onChange={setAge} suffix="anos" max={100} /><Field label="Tempo de contribuição" value={contribution} onChange={setContribution} suffix="anos" max={60} /></>} result={<><Landmark className="h-7 w-7 text-[#d8bd73]" /><p className="mt-5 text-2xl font-black">{result.generalEligible ? 'Requisitos básicos atingidos' : 'Ainda existem requisitos pendentes'}</p><div className="mt-5 space-y-3">{result.generalEligible ? <p className="flex gap-2 text-sm text-emerald-300"><CheckCircle2 className="h-5 w-5" />Idade e contribuição informadas atendem à regra geral básica.</p> : <><p className="flex gap-2 text-sm text-white/65"><Clock3 className="h-5 w-5 text-[#d8bd73]" />Idade: faltam {missingAge.toFixed(1).replace('.0','')} ano(s)</p><p className="flex gap-2 text-sm text-white/65"><Clock3 className="h-5 w-5 text-[#d8bd73]" />Contribuição: faltam {missingContribution.toFixed(1).replace('.0','')} ano(s)</p></>}</div></>} proItems={['regra dos pontos de 2026', 'idade mínima progressiva', 'comparação entre regras', 'pendências detalhadas por critério']} />;
}

function VacationFree() {
  const [salary, setSalary] = useState('3500');
  const result = useMemo(() => calculateVacationEstimate(numeric(salary), 0), [salary]);
  return <FreeLayout title="Estimativa simples de 30 dias de férias" description="Informe apenas o salário mensal para visualizar a remuneração e o adicional constitucional de um terço." form={<Field label="Salário bruto mensal" value={salary} onChange={setSalary} prefix="R$" />} result={<><Palmtree className="h-7 w-7 text-[#d8bd73]" /><p className="mt-5 text-4xl font-black tracking-[-0.04em]">{currency.format(result.total)}</p><div className="mt-5 space-y-2 text-sm text-white/62"><p>Remuneração: {currency.format(result.remuneration)}</p><p>Adicional de 1/3: {currency.format(result.constitutionalThird)}</p></div></>} proItems={['médias de horas extras e adicionais', 'composição detalhada do total', 'cenários e condições consideradas', 'resultado avançado para conferência']} />;
}

export function FreeToolsSimpleCalculator({ tool }: { tool: ProToolId }) {
  if (tool === 'termination') return <TerminationFree />;
  if (tool === 'retirement') return <RetirementFree />;
  return <VacationFree />;
}
