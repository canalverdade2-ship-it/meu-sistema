import { useEffect, useMemo, useState, type ComponentType } from 'react';
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
  Search,
  ShieldCheck,
  SlidersHorizontal,
  SunMedium,
  TrendingUp,
  Users,
} from 'lucide-react';
import {
  FreeToolsTieredCalculatorDialog,
  type FreeToolId,
} from './FreeToolsTieredCalculatorDialog';
import { readInfinitePayReturn } from '../../lib/freeToolsProAccess';
import { PublicHeader } from './final/PublicHeader';

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
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState('Todas');

  useEffect(() => {
    const paymentReturn = readInfinitePayReturn();
    if (paymentReturn) setActiveTool(paymentReturn.tool);
  }, []);

  const categories = useMemo(() => [
    'Todas',
    ...Array.from(new Set(AVAILABLE_TOOLS.map((tool) => tool.category))).sort((a, b) => a.localeCompare(b, 'pt-BR')),
  ], []);

  const filteredTools = useMemo(() => {
    const term = search.trim().toLocaleLowerCase('pt-BR');
    return AVAILABLE_TOOLS.filter((tool) => {
      const matchesCategory = category === 'Todas' || tool.category === category;
      const haystack = [tool.title, tool.description, tool.category, tool.useCase, ...tool.includes]
        .join(' ')
        .toLocaleLowerCase('pt-BR');
      return matchesCategory && (!term || haystack.includes(term));
    });
  }, [category, search]);

  const featuredTools = AVAILABLE_TOOLS.slice(0, 3);

  return (
    <div className="min-h-screen bg-[#eef1ee] text-[#132128]">
      <PublicHeader currentPage="free-tools" onClientLogin={onClientLogin} />
      <main className="overflow-x-clip pt-16">
        <section className="relative overflow-hidden bg-[#071820] text-white">
          <div className="pointer-events-none absolute -right-32 -top-28 h-[34rem] w-[34rem] rounded-full border border-[#65d6ac]/12" />
          <div className="pointer-events-none absolute right-10 top-32 h-64 w-64 rounded-full bg-[#65d6ac]/8 blur-3xl" />
          <div className="mx-auto grid max-w-7xl gap-10 px-4 py-12 sm:px-6 sm:py-16 lg:grid-cols-[1.05fr_0.95fr] lg:items-center lg:px-8 lg:py-20">
            <div>
              <button type="button" onClick={onBack} className="inline-flex min-h-11 items-center gap-2 rounded-lg border border-white/15 bg-white/[0.04] px-4 py-2 text-sm font-black text-white/75 transition hover:border-[#65d6ac]/50 hover:text-white"><ArrowLeft className="h-4 w-4" /> Voltar ao início</button>
              <p className="mt-10 text-[10px] font-black uppercase tracking-[0.25em] text-[#65d6ac]">Laboratório de utilidades GSA</p>
              <h1 className="mt-5 max-w-[13ch] text-4xl font-semibold leading-[1.02] tracking-[-0.05em] sm:text-6xl">Encontre a ferramenta certa antes de preencher qualquer dado.</h1>
              <p className="mt-6 max-w-2xl text-base leading-8 text-white/60 sm:text-lg">Pesquise pelo assunto, filtre por área e abra somente a simulação que ajuda na sua decisão.</p>
              <div className="mt-8 flex flex-wrap gap-4 text-xs font-bold text-white/55">
                <span className="inline-flex items-center gap-2"><CheckCircle2 className="h-4 w-4 text-[#65d6ac]" />Uso Free sem cadastro</span>
                <span className="inline-flex items-center gap-2"><ShieldCheck className="h-4 w-4 text-[#65d6ac]" />Dados permanecem no dispositivo</span>
                <span className="inline-flex items-center gap-2"><Calculator className="h-4 w-4 text-[#65d6ac]" />{AVAILABLE_TOOLS.length} ferramentas ativas</span>
              </div>
            </div>

            <aside className="overflow-hidden rounded-2xl border border-white/12 bg-white/[0.045] shadow-2xl shadow-black/20 backdrop-blur">
              <div className="border-b border-white/10 p-5 sm:p-6">
                <p className="text-[10px] font-black uppercase tracking-[0.2em] text-[#65d6ac]">Busca rápida</p>
                <label className="mt-4 flex min-h-14 items-center gap-3 rounded-xl border border-white/15 bg-[#0d252d] px-4 focus-within:border-[#65d6ac]/65">
                  <Search className="h-5 w-5 text-[#65d6ac]" />
                  <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Ex.: férias, MEI, pensão, juros..." className="min-w-0 flex-1 bg-transparent text-sm text-white outline-none placeholder:text-white/30" />
                  {search && <button type="button" onClick={() => setSearch('')} className="text-xs font-black text-white/45 hover:text-white">Limpar</button>}
                </label>
              </div>
              <div className="grid grid-cols-3 divide-x divide-white/10">
                <div className="p-5"><strong className="block text-2xl font-black text-[#65d6ac]">{AVAILABLE_TOOLS.length}</strong><span className="mt-1 block text-[10px] uppercase tracking-wider text-white/40">Ferramentas</span></div>
                <div className="p-5"><strong className="block text-2xl font-black text-[#65d6ac]">Free</strong><span className="mt-1 block text-[10px] uppercase tracking-wider text-white/40">Entrada simples</span></div>
                <div className="p-5"><strong className="block text-2xl font-black text-[#65d6ac]">Pro</strong><span className="mt-1 block text-[10px] uppercase tracking-wider text-white/40">Análise ampliada</span></div>
              </div>
              <div className="border-t border-white/10 p-5 sm:p-6">
                <p className="text-xs leading-6 text-white/50"><LockKeyhole className="mr-2 inline h-4 w-4 text-[#65d6ac]" />Pagamento, voucher e elegibilidade Pro são confirmados de forma segura no servidor.</p>
              </div>
            </aside>
          </div>
        </section>

        <section className="border-b border-[#d2d9d4] bg-[#f8faf8] py-10">
          <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
            <div className="flex items-center gap-3 text-[10px] font-black uppercase tracking-[0.18em] text-[#42665b]"><SlidersHorizontal className="h-4 w-4" />Filtrar por assunto</div>
            <div className="mt-4 flex gap-2 overflow-x-auto pb-2">
              {categories.map((item) => <button key={item} type="button" onClick={() => setCategory(item)} aria-pressed={category === item} className={`shrink-0 rounded-full border px-4 py-2 text-xs font-black transition ${category === item ? 'border-[#153f38] bg-[#153f38] text-white' : 'border-[#ccd6d0] bg-white text-[#52625d] hover:border-[#6b8d82]'}`}>{item}</button>)}
            </div>
          </div>
        </section>

        {!search && category === 'Todas' && (
          <section className="py-12 sm:py-16">
            <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
              <div className="flex flex-col gap-4 border-b border-[#cfd7d2] pb-6 sm:flex-row sm:items-end sm:justify-between"><div><p className="text-[10px] font-black uppercase tracking-[0.2em] text-[#397866]">Comece por aqui</p><h2 className="mt-2 text-3xl font-black tracking-[-0.04em]">Consultas mais procuradas</h2></div><p className="max-w-md text-sm leading-6 text-[#64716d]">Acesso direto às ferramentas que normalmente iniciam uma decisão trabalhista ou previdenciária.</p></div>
              <div className="mt-6 grid gap-4 lg:grid-cols-3">
                {featuredTools.map(({ id, icon: Icon, number, title, description, category: toolCategory }) => <button key={id} type="button" onClick={() => setActiveTool(id)} className="group grid min-h-48 grid-cols-[52px_minmax(0,1fr)] gap-5 rounded-2xl border border-[#cfd7d2] bg-white p-6 text-left transition hover:-translate-y-0.5 hover:border-[#4f8272] hover:shadow-lg"><span className="flex h-12 w-12 items-center justify-center rounded-xl bg-[#12342f] text-[#65d6ac]"><Icon className="h-5 w-5" /></span><span><span className="text-[10px] font-black tracking-[0.18em] text-[#397866]">{number} · {toolCategory}</span><strong className="mt-3 block text-xl text-[#132128]">{title}</strong><span className="mt-3 block text-sm leading-6 text-[#66736f]">{description}</span><span className="mt-5 inline-flex items-center gap-2 text-xs font-black uppercase tracking-[0.09em] text-[#285f52]">Abrir agora <ArrowRight className="h-4 w-4 transition group-hover:translate-x-1" /></span></span></button>)}
              </div>
            </div>
          </section>
        )}

        <section className="border-y border-[#d3dad6] bg-white py-12 sm:py-16" aria-labelledby="free-tools-title">
          <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
            <div className="grid gap-6 border-b border-[#d3dad6] pb-7 lg:grid-cols-[1fr_auto] lg:items-end">
              <div><p className="text-[10px] font-black uppercase tracking-[0.2em] text-[#397866]">Índice de ferramentas</p><h2 id="free-tools-title" className="mt-3 text-3xl font-black tracking-[-0.04em] sm:text-5xl">{filteredTools.length} {filteredTools.length === 1 ? 'resultado encontrado' : 'resultados encontrados'}</h2><p className="mt-4 max-w-2xl text-sm leading-7 text-[#64716d]">Cada item abre primeiro no modo Free. O aprofundamento Pro permanece dentro da mesma experiência.</p></div>
              <div className="rounded-xl border border-[#cfd7d2] bg-[#f3f7f4] px-4 py-3 text-xs font-bold text-[#49615a]">Categoria: <strong>{category}</strong></div>
            </div>

            <div className="mt-4 divide-y divide-[#d8dfdb] border-y border-[#d8dfdb]">
              {filteredTools.map(({ id, icon: Icon, number, title, description, category: toolCategory, useCase, includes }) => (
                <button key={id} type="button" onClick={() => setActiveTool(id)} className="group grid w-full gap-4 py-6 text-left md:grid-cols-[56px_minmax(0,1fr)_minmax(220px,0.65fr)_auto] md:items-center">
                  <span className="flex h-12 w-12 items-center justify-center rounded-xl border border-[#cbd5cf] bg-[#f5f8f6] text-[#285f52]"><Icon className="h-5 w-5" /></span>
                  <span className="min-w-0"><span className="text-[9px] font-black uppercase tracking-[0.17em] text-[#397866]">{number} · {toolCategory}</span><strong className="mt-1 block text-lg text-[#132128]">{title}</strong><span className="mt-2 block text-xs leading-5 text-[#697672]">{description}</span></span>
                  <span className="hidden border-l border-[#d8dfdb] pl-5 md:block"><span className="text-[9px] font-black uppercase tracking-[0.15em] text-[#7c8984]">Indicado para</span><span className="mt-2 block text-xs leading-5 text-[#586661]">{useCase}</span><span className="mt-3 flex flex-wrap gap-1.5">{includes.slice(0, 2).map((item) => <span key={item} className="rounded-full bg-[#eef3f0] px-2 py-1 text-[9px] font-bold text-[#53645e]">{item}</span>)}</span></span>
                  <span className="inline-flex items-center gap-2 text-xs font-black uppercase tracking-[0.08em] text-[#285f52]">Free + Pro <ArrowRight className="h-4 w-4 transition group-hover:translate-x-1" /></span>
                </button>
              ))}
              {filteredTools.length === 0 && <div className="py-16 text-center"><Search className="mx-auto h-8 w-8 text-[#9eaaa5]" /><h3 className="mt-4 text-lg font-black">Nenhuma ferramenta corresponde à busca</h3><p className="mt-2 text-sm text-[#6b7773]">Tente outro termo ou selecione a categoria “Todas”.</p><button type="button" onClick={() => { setSearch(''); setCategory('Todas'); }} className="mt-5 rounded-lg bg-[#153f38] px-5 py-3 text-sm font-black text-white">Limpar filtros</button></div>}
            </div>
          </div>
        </section>

        <section className="bg-[#10262c] py-14 text-white sm:py-16">
          <div className="mx-auto grid max-w-7xl gap-8 px-4 sm:px-6 lg:grid-cols-[0.8fr_1.2fr] lg:px-8">
            <div><p className="text-[10px] font-black uppercase tracking-[0.2em] text-[#65d6ac]">Princípios da consulta</p><h2 className="mt-4 text-3xl font-semibold tracking-[-0.035em] sm:text-4xl">Resultado útil é resultado explicado.</h2><p className="mt-4 text-sm leading-7 text-white/55">Cada ferramenta informa composição, limites e situações em que uma análise individual é necessária.</p></div>
            <div className="grid gap-px overflow-hidden rounded-2xl border border-white/10 bg-white/10 md:grid-cols-3">{[{ icon: ShieldCheck, title: 'Privacidade preservada', text: 'Os valores digitados não são armazenados pela GSA.' }, { icon: Calculator, title: 'Composição visível', text: 'A consulta mostra como o resultado foi formado.' }, { icon: Info, title: 'Limites informados', text: 'Exceções e hipóteses não consideradas ficam claras.' }].map(({ icon: Icon, title, text }) => <article key={title} className="bg-[#16333a] p-6"><Icon className="h-6 w-6 text-[#65d6ac]" /><h3 className="mt-5 font-black">{title}</h3><p className="mt-3 text-xs leading-5 text-white/55">{text}</p></article>)}</div>
          </div>
        </section>

        <section className="py-14 sm:py-20">
          <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8"><div className="grid overflow-hidden rounded-2xl border border-[#b9c9c1] bg-[#dce7e1] lg:grid-cols-[1fr_340px]"><div className="p-7 sm:p-10 lg:p-12"><p className="text-[10px] font-black uppercase tracking-[0.2em] text-[#285f52]">Quando a simulação não basta</p><h2 className="mt-4 max-w-3xl text-3xl font-black leading-tight tracking-[-0.03em] sm:text-4xl">Documentos, períodos especiais e regras específicas merecem uma análise completa.</h2><p className="mt-4 max-w-2xl text-sm leading-7 text-[#52635d]">Conheça os serviços da GSA quando a situação exigir conferência individual ou acompanhamento.</p></div><div className="flex flex-col justify-center border-t border-[#b9c9c1] bg-[#c9d9d1] p-7 lg:border-l lg:border-t-0"><button type="button" onClick={onServices} className="inline-flex min-h-12 items-center justify-center gap-2 rounded-lg bg-[#12342f] px-5 py-3 text-sm font-black text-white">Conhecer serviços GSA <ArrowRight className="h-4 w-4" /></button><p className="mt-4 text-center text-[11px] leading-5 text-[#52635d]">Atendimento por WhatsApp, e-mail ou Portal do Cliente.</p></div></div><p className="mx-auto mt-8 max-w-3xl text-center text-xs leading-5 text-[#697672]">As ferramentas fornecem estimativas educativas e não comprovam direitos nem substituem cálculos oficiais ou orientação profissional.</p></div>
        </section>

        <FreeToolsTieredCalculatorDialog tool={activeTool} onClose={() => setActiveTool(null)} onToolChange={setActiveTool} onServices={() => { setActiveTool(null); onServices(); }} onClientLogin={onClientLogin} />
      </main>
    </div>
  );
}
