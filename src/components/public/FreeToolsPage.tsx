import { useEffect, useState, type ComponentType } from 'react';
import {
  ArrowLeft,
  ArrowRight,
  Baby,
  BadgePercent,
  BriefcaseBusiness,
  Building2,
  Calculator,
  CalendarDays,
  Check,
  CheckCircle2,
  Clock3,
  Coins,
  GraduationCap,
  HandCoins,
  Heart,
  HeartHandshake,
  Info,
  Landmark,
  LockKeyhole,
  Palmtree,
  Percent,
  ShieldCheck,
  SunMedium,
  TrendingUp,
  Users,
} from 'lucide-react';
import {
  FreeToolsTieredCalculatorDialog,
  type FreeToolId,
} from './FreeToolsTieredCalculatorDialog';
import { readInfinitePayReturn } from '../../lib/freeToolsProAccess';

interface FreeToolsPageProps {
  onBack: () => void;
  onServices: () => void;
  onClientLogin: () => void;
}

interface ToolCard {
  id: FreeToolId;
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
  { id: 'termination', icon: BriefcaseBusiness, number: '01', title: 'Rescisão trabalhista', description: 'Estimativa das principais verbas de encerramento de um vínculo CLT.', category: 'Trabalhista', useCase: 'Para compreender a composição aproximada da rescisão antes da conferência oficial.', includes: ['Saldo de salário', 'Aviso-prévio', '13º e férias', 'Multa estimada do FGTS'], available: true },
  { id: 'retirement', icon: Landmark, number: '02', title: 'Aposentadoria pelo INSS', description: 'Panorama inicial da regra geral e de duas regras de transição consideradas em 2026.', category: 'Previdenciário', useCase: 'Para comparar idade e contribuição com critérios previdenciários básicos.', includes: ['Regra geral', 'Regra dos pontos', 'Idade progressiva', 'Pendências por requisito'], available: true },
  { id: 'vacation', icon: Palmtree, number: '03', title: 'Cálculo de férias', description: 'Estimativa bruta da remuneração de férias e do adicional constitucional de um terço.', category: 'Trabalhista', useCase: 'Para visualizar o valor bruto antes dos descontos e das condições específicas do vínculo.', includes: ['Salário mensal', 'Médias variáveis', 'Adicional de 1/3', 'Total bruto estimado'], available: true },
  { id: 'thirteenth', icon: HandCoins, number: '04', title: '13º salário', description: 'Simulação das parcelas e do valor proporcional aos meses trabalhados.', category: 'Trabalhista', useCase: 'Para visualizar a formação aproximada do décimo terceiro salário.', includes: ['Meses trabalhados', 'Primeira parcela', 'Segunda parcela', 'Valor proporcional'], available: true },
  { id: 'overtime', icon: Clock3, number: '05', title: 'Horas extras & Noturno', description: 'Cálculo de horas suplementares (50%/100%), hora noturna reduzida e reflexos no DSR.', category: 'Trabalhista', useCase: 'Para conferir a remuneração de horas excedentes e adicionais da jornada.', includes: ['Horas 50% e 100%', 'Adicional noturno', 'Hora noturna reduzida', 'Reflexo no DSR'], available: true },
  { id: 'net_salary', icon: Calculator, number: '06', title: 'Salário líquido (CLT x PJ)', description: 'Demonstrativo dos descontos de INSS/IRRF 2026 e comparativo de faturamento PJ equivalente.', category: 'Trabalhista & Fiscal', useCase: 'Para comparar a remuneração líquida recebida no bolso com contratação PJ.', includes: ['Tabela INSS 2026', 'Tabela IRRF', 'Salário líquido real', 'Equivalência CLT x PJ'], available: true },
  { id: 'mei_limit', icon: Building2, number: '07', title: 'Limite e excesso do MEI', description: 'Projeção do limite proporcional de faturamento anual do MEI e cálculo de extrapolação.', category: 'Empresarial & MEI', useCase: 'Para acompanhar a margem de faturamento do MEI e evitar desenquadramento.', includes: ['Limite proporcional', 'Saldo disponível', 'Projeção de vendas', 'Cálculo de excesso'], available: true },
  { id: 'unemployment', icon: HandCoins, number: '08', title: 'Seguro-desemprego', description: 'Simulação da quantidade de parcelas (3 a 5) e cálculo do valor MTE 2026.', category: 'Trabalhista', useCase: 'Para verificar a elegibilidade e o valor das parcelas do benefício.', includes: ['Triagem de requisitos', 'Número de parcelas', 'Média dos salários', 'Teto oficial MTE'], available: true },
  { id: 'fator_r', icon: BadgePercent, number: '09', title: 'Fator R do Simples Nacional', description: 'Cálculo do enquadramento nos Anexos III ou V com base na razão folha/faturamento.', category: 'Tributário & Empresa', useCase: 'Para otimizar impostos reduzindo a alíquota de 15,5% para 6%.', includes: ['Razão Folha/Receita', 'Anexo III vs Anexo V', 'Ajuste de pró-labore', 'Economia tributária'], available: true },
  { id: 'amortization', icon: TrendingUp, number: '10', title: 'Amortização de parcelas', description: 'Simulação de economia em juros e redução de prazo ao amortizar parcelas SAC ou PRICE.', category: 'Financeiro', useCase: 'Para planejar amortizações antecipadas em financiamentos de imóveis ou veículos.', includes: ['Tabela SAC e PRICE', 'Novo saldo devedor', 'Redução de prazo', 'Economia em juros'], available: true },
  { id: 'internship_termination', icon: GraduationCap, number: '11', title: 'Rescisão de estágio (Lei 11.788)', description: 'Cálculo do recesso remunerado proporcional + 1/3 (Sem aviso prévio ou FGTS).', category: 'Trabalhista', useCase: 'Para apurar os valores devidos no encerramento de contrato de estágio.', includes: ['Lei do Estágio 11.788', 'Recesso proporcional', 'Adicional de 1/3', 'Isenção de FGTS/Aviso'], available: true },
  { id: 'prolabore_vs_lucros', icon: Coins, number: '12', title: 'Pró-labore vs Lucros', description: 'Comparativo de economia tributária entre Pró-Labore (INSS/IRRF) e Lucros Isentos.', category: 'Tributário & Empresa', useCase: 'Para sócios de empresas reduzirem retenções de INSS e IRRF no pro-labore.', includes: ['Teto de INSS 11%', 'Isenção de lucros', 'Matriz de economia', 'Estratégia fiscal'], available: true },
  { id: 'employee_cost', icon: Users, number: '13', title: 'Custo do funcionário', description: 'Cálculo do custo total para a empresa contratar (Salário + Provisões + Encargos).', category: 'Empresarial & RH', useCase: 'Para planejar contratações e entender o impacto financeiro da folha.', includes: ['INSS Patronal', 'FGTS 8%', 'Provisão 13º e férias', 'Custo total real'], available: true },
  { id: 'night_shift_rural_urban', icon: SunMedium, number: '14', title: 'Adicional noturno urbano vs rural', description: 'Comparativo entre horário noturno urbano (20% + 52m30s) e rural (25%).', category: 'Trabalhista', useCase: 'Para apurar adicionais noturnos em atividades urbanas, pecuária ou lavoura.', includes: ['Urbano (22h-5h)', 'Pecuária (20h-4h)', 'Lavoura (21h-5h)', 'Hora reduzida'], available: true },
  { id: 'proportional_salary', icon: CalendarDays, number: '15', title: 'Salário proporcional', description: 'Cálculo por dias trabalhados na admissão, demissão ou mês incompleto.', category: 'Trabalhista', useCase: 'Para apurar o salário líquido exato proporcional aos dias de trabalho.', includes: ['Regra base 30 dias', 'Regra dias reais', 'Proporção exata', 'Valor por dia'], available: true },
  { id: 'late_fee_calculator', icon: Percent, number: '16', title: 'Juros e multa por atraso', description: 'Cálculo de multa moratória, juros de mora e atualização SELIC de débitos.', category: 'Financeiro & Fiscal', useCase: 'Para atualizar boletos, impostos ou contas em atraso.', includes: ['Multa moratória', 'Juros de mora 1% a.m.', 'Atualização SELIC', 'Total atualizado'], available: true },
  { id: 'child_support', icon: Heart, number: '17', title: 'Simulador de pensão alimentícia', description: 'Cálculo da pensão percentual sobre o salário líquido (após INSS e IRRF).', category: 'Familiar & Jurídico', useCase: 'Para estimar o valor da pensão alimentícia judicial ou consensual.', includes: ['Dedução INSS/IRRF', 'Base líquida real', 'Porcentagem aplicada', 'Despesas extra'], available: true },
  { id: 'benefits', icon: Baby, number: '18', title: 'Benefícios do INSS', description: 'Orientação inicial sobre incapacidade, salário-maternidade, pensão e outros benefícios.', category: 'Previdenciário', useCase: 'Para identificar as informações necessárias antes de uma análise completa.', includes: ['Tipo de benefício', 'Qualidade de segurado', 'Carência', 'Documentação inicial'], available: true },
  { id: 'bpc', icon: HeartHandshake, number: '19', title: 'BPC / LOAS', description: 'Triagem educativa dos critérios básicos do benefício assistencial.', category: 'Assistencial', useCase: 'Para compreender os pontos normalmente avaliados em um pedido.', includes: ['Renda familiar', 'Grupo familiar', 'Impedimento de longo prazo', 'Cadastro social'], available: true },
];

const AVAILABLE_TOOLS = TOOLS.filter((tool) => tool.available);

export function FreeToolsPage({ onBack, onServices, onClientLogin }: FreeToolsPageProps) {
  const [activeTool, setActiveTool] = useState<FreeToolId | null>(null);

  useEffect(() => {
    const paymentReturn = readInfinitePayReturn();
    if (paymentReturn) setActiveTool(paymentReturn.tool);
  }, []);

  return (
    <div className="min-h-screen bg-[#eee9df] text-[#17202a]">
      <PublicHeader currentPage="free-tools" onClientLogin={onClientLogin} />
      <main className="overflow-x-clip pt-16">
      <section className="relative overflow-hidden border-b border-[#d4ccbe] bg-[linear-gradient(135deg,#faf7f0_0%,#f3ede2_56%,#e9dfcf_100%)]">
        <div className="pointer-events-none absolute -right-40 -top-40 h-[34rem] w-[34rem] rounded-full border border-[#b8903e]/15" />
        <div className="pointer-events-none absolute right-10 top-12 h-64 w-64 rounded-full bg-[#d8bd73]/14 blur-3xl" />
        <div className="relative mx-auto max-w-7xl px-4 py-10 sm:px-6 sm:py-16 lg:px-8 lg:py-20">
          <button type="button" onClick={onBack} className="inline-flex min-h-11 items-center gap-2 rounded-lg border border-[#cfc5b5] bg-white/65 px-4 py-2 text-sm font-black text-[#52606a] transition hover:border-[#9f8140] hover:bg-white hover:text-[#17202a] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#9f8140]"><ArrowLeft className="h-4 w-4" /> Voltar ao início</button>
          <div className="mt-10 grid items-stretch gap-10 lg:grid-cols-[1.08fr_0.92fr] lg:gap-16">
            <div className="flex flex-col justify-center border-l-2 border-[#c7a458] pl-5 sm:pl-7">
              <p className="flex items-center gap-3 text-[10px] font-black uppercase tracking-[0.22em] text-[#806128] sm:text-xs"><span className="h-px w-8 bg-[#b8903e]" />Serviços públicos GSA</p>
              <h1 className="mt-5 max-w-[14ch] text-4xl font-black leading-[1.03] tracking-[-0.045em] text-[#111820] sm:text-5xl lg:text-[3.8rem]">Ferramentas para orientar decisões com mais clareza.</h1>
              <p className="mt-6 max-w-2xl text-base leading-8 text-[#5b6570] sm:text-lg">Use o cálculo simples gratuitamente ou avance para o modo Pro quando precisar de mais campos, regras e detalhamento.</p>
              <div className="mt-8 flex flex-wrap gap-x-6 gap-y-3 text-xs font-bold text-[#56616a]">{['Free sem cadastro', 'Pro com liberação segura', 'Acesso imediato'].map((item) => <span key={item} className="inline-flex items-center gap-2"><CheckCircle2 className="h-4 w-4 text-[#8a6e2f]" />{item}</span>)}</div>
            </div>
            <aside className="overflow-hidden rounded-2xl border border-[#d8bd73]/30 bg-[linear-gradient(180deg,#172635_0%,#0d1924_100%)] text-white shadow-[inset_0_3px_0_#d8bd73,0_30px_70px_rgba(18,27,36,0.2)]">
              <div className="border-b border-white/10 px-5 py-6 sm:px-7"><p className="text-[10px] font-black uppercase tracking-[0.2em] text-[#d8bd73]">Dois níveis de consulta</p><h2 className="mt-3 text-2xl font-black leading-tight">Comece simples. Aprofunde somente quando precisar.</h2><p className="mt-3 text-sm leading-6 text-white/55">O Free orienta rapidamente. O Pro organiza uma análise mais detalhada dentro da mesma ferramenta.</p></div>
              <div className="divide-y divide-white/10 px-5 sm:px-7">{[['01','Modo Free','Poucos campos e resultado básico, sem login.'],['02','Modo Pro','Cálculo avançado por pagamento, voucher ou benefício.'],['03','Confirmação segura','Pagamento e elegibilidade são verificados no servidor.']].map(([number,title,text]) => <div key={number} className="grid grid-cols-[36px_1fr] gap-3 py-5"><span className="text-[10px] font-black tracking-[0.18em] text-[#d8bd73]">{number}</span><div><strong className="block text-sm">{title}</strong><span className="mt-1 block text-xs leading-5 text-white/50">{text}</span></div></div>)}</div>
            </aside>
          </div>
        </div>
      </section>

      <section className="py-14 sm:py-20" aria-labelledby="free-tools-title">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="grid gap-8 border-b border-[#d4ccbe] pb-8 lg:grid-cols-[1fr_0.7fr] lg:items-end">
            <div className="max-w-3xl"><p className="text-[10px] font-black uppercase tracking-[0.2em] text-[#806128]">Ferramentas disponíveis</p><h2 id="free-tools-title" className="mt-3 text-3xl font-black tracking-[-0.035em] text-[#111820] sm:text-5xl">Escolha a consulta que precisa iniciar.</h2><p className="mt-4 max-w-2xl text-sm leading-7 text-[#606a73] sm:text-base">Cada ferramenta abre com o nível Free. A opção Pro fica disponível no mesmo modal.</p></div>
            <div className="flex items-start gap-3 border-l-2 border-[#c7a458] pl-5 text-sm leading-6 text-[#626c75]"><LockKeyhole className="mt-0.5 h-5 w-5 shrink-0 text-[#8a6e2f]" />O Free não solicita identificação. Pagamento e voucher Pro também podem ser usados sem cadastro.</div>
          </div>

          <div className="mt-8 grid gap-5 lg:grid-cols-3">
            {AVAILABLE_TOOLS.map(({ id, icon: Icon, number, title, description, category, useCase, includes }) => (
              <button key={id} type="button" onClick={() => setActiveTool(id as FreeToolId)} className="group relative flex min-h-[390px] flex-col overflow-hidden rounded-2xl border border-[#d4cdc2] bg-[#fbf9f4] p-6 text-left shadow-[0_12px_32px_rgba(24,32,40,0.055)] transition duration-200 hover:-translate-y-1 hover:border-[#ad8b42] hover:bg-white hover:shadow-[0_22px_48px_rgba(24,32,40,0.11)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#9f8140] focus-visible:ring-offset-2 focus-visible:ring-offset-[#eee9df] sm:p-7">
                <span className="absolute inset-x-0 top-0 h-1 bg-[linear-gradient(90deg,#8a6b2f,#d8bd73,transparent)] opacity-80" />
                <div className="flex items-start justify-between gap-4"><span className="flex h-12 w-12 items-center justify-center rounded-xl bg-[#172433] text-[#d8bd73]"><Icon className="h-5 w-5" /></span><div className="text-right"><span className="block text-[10px] font-black tracking-[0.2em] text-[#9b7c33]">{number}</span><span className="mt-2 inline-flex rounded-full border border-[#d7c69e] bg-[#f7efd9] px-2.5 py-1 text-[9px] font-black uppercase tracking-[0.1em] text-[#715721]">Free + Pro</span></div></div>
                <p className="mt-7 text-[10px] font-black uppercase tracking-[0.17em] text-[#806128]">{category}</p><h3 className="mt-3 text-2xl font-black leading-tight tracking-[-0.025em] text-[#111820]">{title}</h3><p className="mt-4 text-sm leading-6 text-[#616b74]">{description}</p>
                <div className="mt-6 border-t border-[#ded8ce] pt-5"><p className="text-[9px] font-black uppercase tracking-[0.14em] text-[#858c91]">Indicado para</p><p className="mt-2 text-xs leading-5 text-[#4f5a63]">{useCase}</p></div>
                <ul className="mt-5 grid grid-cols-2 gap-x-3 gap-y-2 text-[11px] leading-4 text-[#5d6770]">{includes.map((item) => <li key={item} className="flex items-start gap-2"><Check className="mt-0.5 h-3 w-3 shrink-0 text-[#8a6e2f]" strokeWidth={3} />{item}</li>)}</ul>
                <div className="mt-auto flex items-center justify-between gap-4 border-t border-[#ded8ce] pt-5"><span className="text-[10px] font-bold text-[#838a90]">Free simples · Pro avançado</span><span className="inline-flex items-center gap-2 text-xs font-black uppercase tracking-[0.09em] text-[#765b25]">Abrir ferramenta <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" /></span></div>
              </button>
            ))}
          </div>
        </div>
      </section>

      <section className="border-y border-[#d7d1c6] bg-[#f8f5ef] py-12 sm:py-16">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
<div className="grid gap-6 rounded-2xl border border-[#d4cdc2] bg-white p-6 shadow-[0_14px_36px_rgba(24,32,40,0.06)] sm:p-8 lg:grid-cols-[1fr_auto] lg:items-center">
  <div>
    <p className="text-[10px] font-black uppercase tracking-[0.2em] text-[#806128]">Área ampliada</p>
    <h2 className="mt-3 text-2xl font-black tracking-[-0.03em] text-[#111820] sm:text-3xl">As seis ferramentas já estão disponíveis.</h2>
    <p className="mt-3 max-w-3xl text-sm leading-6 text-[#667078]">13º salário, Benefícios do INSS e BPC / LOAS agora possuem consulta Free e análise Pro, juntamente com Rescisão, Aposentadoria e Férias.</p>
  </div>
  <div className="grid grid-cols-3 gap-2 text-center text-[10px] font-black uppercase tracking-[0.1em] text-[#6d5727]">
    {['13º', 'INSS', 'BPC'].map((label) => <span key={label} className="rounded-xl border border-[#d6c79e] bg-[#f7f0dc] px-4 py-3">{label}</span>)}
  </div>
</div>
        </div>
      </section>

      <section className="border-b border-white/10 bg-[#111d29] py-14 text-white sm:py-16"><div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8"><div className="grid gap-8 lg:grid-cols-[0.75fr_1.25fr] lg:gap-14"><div><p className="text-[10px] font-black uppercase tracking-[0.2em] text-[#d8bd73]">Compromisso da plataforma</p><h2 className="mt-4 text-3xl font-black leading-tight tracking-[-0.03em] sm:text-4xl">Clareza antes de qualquer conclusão.</h2><p className="mt-4 text-sm leading-7 text-white/55">A área foi estruturada para informar sem esconder limites, condições ou situações que exigem análise individual.</p></div><div className="grid gap-px overflow-hidden rounded-2xl border border-white/10 bg-white/10 md:grid-cols-3">{[{ icon: ShieldCheck, title: 'Privacidade preservada', text: 'Os valores digitados permanecem no dispositivo e não são armazenados pela GSA.' },{ icon: Calculator, title: 'Cálculo explicado', text: 'O resultado apresenta a composição utilizada, não apenas um número isolado.' },{ icon: Info, title: 'Limites visíveis', text: 'Cada ferramenta informa o que não foi considerado e quando buscar confirmação.' }].map(({ icon: Icon, title, text }) => <article key={title} className="bg-[#172433] p-6"><Icon className="h-6 w-6 text-[#d8bd73]" /><h3 className="mt-5 font-black">{title}</h3><p className="mt-3 text-xs leading-5 text-white/55">{text}</p></article>)}</div></div></div></section>

      <section className="py-14 sm:py-20"><div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8"><div className="grid overflow-hidden rounded-2xl border border-[#cbbd9f] bg-[#d8c28d] lg:grid-cols-[1fr_340px]"><div className="p-7 sm:p-10 lg:p-12"><p className="text-[10px] font-black uppercase tracking-[0.2em] text-[#624d20]">Quando a simulação não basta</p><h2 className="mt-4 max-w-3xl text-3xl font-black leading-tight tracking-[-0.03em] text-[#17202a] sm:text-4xl">Documentos, períodos especiais e regras específicas merecem uma análise completa.</h2><p className="mt-4 max-w-2xl text-sm leading-7 text-[#5c4d31]">Conheça os serviços da GSA quando a situação exigir conferência individual, organização documental ou acompanhamento.</p></div><div className="flex flex-col justify-center border-t border-[#b69e69] bg-[#c8ad70] p-7 lg:border-l lg:border-t-0"><button type="button" onClick={onServices} className="inline-flex min-h-12 items-center justify-center gap-2 rounded-lg bg-[#172433] px-5 py-3 text-sm font-black text-white transition hover:bg-[#223449] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white">Conhecer os serviços GSA <ArrowRight className="h-4 w-4" /></button><p className="mt-4 text-center text-[11px] leading-5 text-[#584721]">Atendimento por WhatsApp, e-mail ou Portal do Cliente.</p></div></div><p className="mx-auto mt-8 max-w-3xl text-center text-xs leading-5 text-[#69727a]">As ferramentas fornecem estimativas educativas e não comprovam direitos, não substituem o cálculo oficial dos órgãos competentes nem a orientação de profissional habilitado.</p></div></section>

      <FreeToolsTieredCalculatorDialog tool={activeTool} onClose={() => setActiveTool(null)} onToolChange={setActiveTool} onServices={() => { setActiveTool(null); onServices(); }} onClientLogin={onClientLogin} />
    </main>
  );
}
