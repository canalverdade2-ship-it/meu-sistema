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
  Sparkles,
  SunMedium,
  Target,
  TrendingUp,
  Users,
  X,
} from 'lucide-react';
import {
  FreeToolsTieredCalculatorDialog,
  type FreeToolId,
} from './FreeToolsTieredCalculatorDialog';
import { readInfinitePayReturn } from '../../lib/freeToolsProAccess';
import { PublicHeader } from './final/PublicHeader';

import { motion } from 'framer-motion';

interface FreeToolsPageProps {
  onBack: () => void;
  onServices: () => void;
  onClientLogin: () => void;
}

const reveal = (delay = 0) => ({
  initial: { opacity: 0, y: 48 },
  whileInView: { opacity: 1, y: 0 },
  viewport: { once: true, amount: 0.18 },
  transition: { duration: 0.85, delay, ease: [0.16, 1, 0.3, 1] as const },
});

interface ToolCard {
  id: FreeToolId;
  icon: ComponentType<{ className?: string }>;
  number: string;
  title: string;
  description: string;
  category: string;
  filterCategory: 'trabalhista' | 'previdenciario' | 'empresarial' | 'financeiro' | 'juridico';
  useCase: string;
  includes: string[];
  available: boolean;
  featured?: boolean;
}

const TOOLS: ToolCard[] = [
  { id: 'termination', icon: BriefcaseBusiness, number: '01', title: 'Rescisão trabalhista', description: 'Estimativa das principais verbas de encerramento de um vínculo CLT.', category: 'Trabalhista', filterCategory: 'trabalhista', useCase: 'Para compreender a composição aproximada da rescisão antes da conferência oficial.', includes: ['Saldo de salário', 'Aviso-prévio', '13º e férias', 'Multa estimada do FGTS'], available: true, featured: true },
  { id: 'retirement', icon: Landmark, number: '02', title: 'Aposentadoria pelo INSS', description: 'Panorama inicial da regra geral e de duas regras de transição consideradas em 2026.', category: 'Previdenciário', filterCategory: 'previdenciario', useCase: 'Para comparar idade e contribuição com critérios previdenciários básicos.', includes: ['Regra geral', 'Regra dos pontos', 'Idade progressiva', 'Pendências por requisito'], available: true, featured: true },
  { id: 'vacation', icon: Palmtree, number: '03', title: 'Cálculo de férias', description: 'Estimativa bruta da remuneração de férias e do adicional constitucional de um terço.', category: 'Trabalhista', filterCategory: 'trabalhista', useCase: 'Para visualizar o valor bruto antes dos descontos e das condições específicas do vínculo.', includes: ['Salário mensal', 'Médias variáveis', 'Adicional de 1/3', 'Total bruto estimado'], available: true, featured: true },
  { id: 'thirteenth', icon: HandCoins, number: '04', title: '13º salário', description: 'Simulação das parcelas e do valor proporcional aos meses trabalhados.', category: 'Trabalhista', filterCategory: 'trabalhista', useCase: 'Para visualizar a formação aproximada do décimo terceiro salário.', includes: ['Meses trabalhados', 'Primeira parcela', 'Segunda parcela', 'Valor proporcional'], available: true },
  { id: 'overtime', icon: Clock3, number: '05', title: 'Horas extras & Noturno', description: 'Cálculo de horas suplementares (50%/100%), hora noturna reduzida e reflexos no DSR.', category: 'Trabalhista', filterCategory: 'trabalhista', useCase: 'Para conferir a remuneração de horas excedentes e adicionais da jornada.', includes: ['Horas 50% e 100%', 'Adicional noturno', 'Hora noturna reduzida', 'Reflexo no DSR'], available: true },
  { id: 'net_salary', icon: Calculator, number: '06', title: 'Salário líquido (CLT x PJ)', description: 'Demonstrativo dos descontos de INSS/IRRF 2026 e comparativo de faturamento PJ equivalente.', category: 'Trabalhista & Fiscal', filterCategory: 'trabalhista', useCase: 'Para comparar a remuneração líquida recebida no bolso com contratação PJ.', includes: ['Tabela INSS 2026', 'Tabela IRRF', 'Salário líquido real', 'Equivalência CLT x PJ'], available: true },
  { id: 'mei_limit', icon: Building2, number: '07', title: 'Limite e excesso do MEI', description: 'Projeção do limite proporcional de faturamento anual do MEI e cálculo de extrapolação.', category: 'Empresarial & MEI', filterCategory: 'empresarial', useCase: 'Para acompanhar a margem de faturamento do MEI e evitar desenquadramento.', includes: ['Limite proporcional', 'Saldo disponível', 'Projeção de vendas', 'Cálculo de excesso'], available: true },
  { id: 'unemployment', icon: HandCoins, number: '08', title: 'Seguro-desemprego', description: 'Simulação da quantidade de parcelas (3 a 5) e cálculo do valor MTE 2026.', category: 'Trabalhista', filterCategory: 'trabalhista', useCase: 'Para verificar a elegibilidade e o valor das parcelas do benefício.', includes: ['Triagem de requisitos', 'Número de parcelas', 'Média dos salários', 'Teto oficial MTE'], available: true },
  { id: 'fator_r', icon: BadgePercent, number: '09', title: 'Fator R do Simples Nacional', description: 'Cálculo do enquadramento nos Anexos III ou V com base na razão folha/faturamento.', category: 'Tributário & Empresa', filterCategory: 'empresarial', useCase: 'Para otimizar impostos reduzindo a alíquota de 15,5% para 6%.', includes: ['Razão Folha/Receita', 'Anexo III vs Anexo V', 'Ajuste de pró-labore', 'Economia tributária'], available: true },
  { id: 'amortization', icon: TrendingUp, number: '10', title: 'Amortização de parcelas', description: 'Simulação de economia em juros e redução de prazo ao amortizar parcelas SAC ou PRICE.', category: 'Financeiro', filterCategory: 'financeiro', useCase: 'Para planejar amortizações antecipadas em financiamentos de imóveis ou veículos.', includes: ['Tabela SAC e PRICE', 'Novo saldo devedor', 'Redução de prazo', 'Economia em juros'], available: true },
  { id: 'internship_termination', icon: GraduationCap, number: '11', title: 'Rescisão de estágio (Lei 11.788)', description: 'Cálculo do recesso remunerado proporcional + 1/3 (Sem aviso prévio ou FGTS).', category: 'Trabalhista', filterCategory: 'trabalhista', useCase: 'Para apurar os valores devidos no encerramento de contrato de estágio.', includes: ['Lei do Estágio 11.788', 'Recesso proporcional', 'Adicional de 1/3', 'Isenção de FGTS/Aviso'], available: true },
  { id: 'prolabore_vs_lucros', icon: Coins, number: '12', title: 'Pró-labore vs Lucros', description: 'Comparativo de economia tributária entre Pró-Labore (INSS/IRRF) e Lucros Isentos.', category: 'Tributário & Empresa', filterCategory: 'empresarial', useCase: 'Para sócios de empresas reduzirem retenções de INSS e IRRF no pro-labore.', includes: ['Teto de INSS 11%', 'Isenção de lucros', 'Matriz de economia', 'Estratégia fiscal'], available: true },
  { id: 'employee_cost', icon: Users, number: '13', title: 'Custo do funcionário', description: 'Cálculo do custo total para a empresa contratar (Salário + Provisões + Encargos).', category: 'Empresarial & RH', filterCategory: 'empresarial', useCase: 'Para planejar contratações e entender o impacto financeiro da folha.', includes: ['INSS Patronal', 'FGTS 8%', 'Provisão 13º e férias', 'Custo total real'], available: true },
  { id: 'night_shift_rural_urban', icon: SunMedium, number: '14', title: 'Adicional noturno urbano vs rural', description: 'Comparativo entre horário noturno urbano (20% + 52m30s) e rural (25%).', category: 'Trabalhista', filterCategory: 'trabalhista', useCase: 'Para apurar adicionais noturnos em atividades urbanas, pecuária ou lavoura.', includes: ['Urbano (22h-5h)', 'Pecuária (20h-4h)', 'Lavoura (21h-5h)', 'Hora reduzida'], available: true },
  { id: 'proportional_salary', icon: CalendarDays, number: '15', title: 'Salário proporcional', description: 'Cálculo por dias trabalhados na admissão, demissão ou mês incompleto.', category: 'Trabalhista', filterCategory: 'trabalhista', useCase: 'Para apurar o salário líquido exato proporcional aos dias de trabalho.', includes: ['Regra base 30 dias', 'Regra dias reais', 'Proporção exata', 'Valor por dia'], available: true },
  { id: 'late_fee_calculator', icon: Percent, number: '16', title: 'Juros e multa por atraso', description: 'Cálculo de multa moratória, juros de mora e atualização SELIC de débitos.', category: 'Financeiro & Fiscal', filterCategory: 'financeiro', useCase: 'Para atualizar boletos, impostos ou contas em atraso.', includes: ['Multa moratória', 'Juros de mora 1% a.m.', 'Atualização SELIC', 'Total atualizado'], available: true },
  { id: 'child_support', icon: Heart, number: '17', title: 'Simulador de pensão alimentícia', description: 'Cálculo da pensão percentual sobre o salário líquido (após INSS e IRRF).', category: 'Familiar & Jurídico', filterCategory: 'juridico', useCase: 'Para estimar o valor da pensão alimentícia judicial ou consensual.', includes: ['Dedução INSS/IRRF', 'Base líquida real', 'Porcentagem aplicada', 'Despesas extra'], available: true },
  { id: 'benefits', icon: Baby, number: '18', title: 'Benefícios do INSS', description: 'Orientação inicial sobre incapacidade, salário-maternidade, pensão e outros benefícios.', category: 'Previdenciário', filterCategory: 'previdenciario', useCase: 'Para identificar as informações necessárias antes de uma análise completa.', includes: ['Tipo de benefício', 'Qualidade de segurado', 'Carência', 'Documentação inicial'], available: true },
  { id: 'bpc', icon: HeartHandshake, number: '19', title: 'BPC / LOAS', description: 'Triagem educativa dos critérios básicos do benefício assistencial.', category: 'Assistencial', filterCategory: 'juridico', useCase: 'Para compreender os pontos normalmente avaliados em um pedido.', includes: ['Renda familiar', 'Grupo familiar', 'Impedimento de longo prazo', 'Cadastro social'], available: true },
];

const AVAILABLE_TOOLS = TOOLS.filter((tool) => tool.available);

type FilterCategoryKey = 'all' | 'trabalhista' | 'previdenciario' | 'empresarial' | 'financeiro' | 'juridico';

const FILTER_TABS: Array<{ id: FilterCategoryKey; label: string }> = [
  { id: 'all', label: 'Todas as ferramentas' },
  { id: 'trabalhista', label: 'Trabalhista & CLT' },
  { id: 'previdenciario', label: 'Previdenciário & INSS' },
  { id: 'empresarial', label: 'Empresas & MEI' },
  { id: 'financeiro', label: 'Financeiro & Fiscal' },
  { id: 'juridico', label: 'Família & Social' },
];

export function FreeToolsPage({ onBack, onServices, onClientLogin }: FreeToolsPageProps) {
  const [activeTool, setActiveTool] = useState<FreeToolId | null>(null);
  const [selectedCategory, setSelectedCategory] = useState<FilterCategoryKey>('all');
  const [searchTerm, setSearchTerm] = useState('');

  useEffect(() => {
    const paymentReturn = readInfinitePayReturn();
    if (paymentReturn) setActiveTool(paymentReturn.tool);
  }, []);

  const filteredTools = useMemo(() => {
    return AVAILABLE_TOOLS.filter((tool) => {
      const matchesCategory =
        selectedCategory === 'all' || tool.filterCategory === selectedCategory;

      if (!matchesCategory) return false;

      if (!searchTerm.trim()) return true;

      const term = searchTerm.toLowerCase().trim();
      return (
        tool.title.toLowerCase().includes(term) ||
        tool.description.toLowerCase().includes(term) ||
        tool.category.toLowerCase().includes(term) ||
        tool.useCase.toLowerCase().includes(term) ||
        tool.includes.some((inc) => inc.toLowerCase().includes(term))
      );
    });
  }, [selectedCategory, searchTerm]);

  return (
    <div className="min-h-screen bg-[#f5f1e8] text-[#17202a] selection:bg-[#c9a756]/30">
      <PublicHeader currentPage="free-tools" onClientLogin={onClientLogin} />
      <main className="overflow-x-clip pt-16">
        {/* HERO SECTION */}
        <section className="relative overflow-hidden border-b border-[#d8d0c2] bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-[#fbf9f4] via-[#f3ecdf] to-[#e8decb]">
          <div className="pointer-events-none absolute -right-32 -top-32 h-[38rem] w-[38rem] rounded-full border border-[#b8903e]/15 blur-sm" />
          <div className="pointer-events-none absolute right-16 top-10 h-72 w-72 rounded-full bg-[#d8bd73]/20 blur-3xl" />
          <div className="pointer-events-none absolute -left-20 bottom-0 h-64 w-64 rounded-full bg-[#c2a259]/10 blur-2xl" />

          <div className="relative mx-auto max-w-7xl px-4 py-10 sm:px-6 sm:py-16 lg:px-8 lg:py-20">
            <button
              type="button"
              onClick={onBack}
              className="inline-flex min-h-11 items-center gap-2 rounded-xl border border-[#cfc5b5] bg-white/75 px-4 py-2 text-sm font-black text-[#4f5c66] shadow-xs backdrop-blur-sm transition-all duration-200 hover:border-[#9f8140] hover:bg-white hover:text-[#17202a] hover:shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#9f8140]"
            >
              <ArrowLeft className="h-4 w-4 text-[#8a6e2f]" /> Voltar ao início
            </button>

            <div className="mt-10 grid items-stretch gap-10 lg:grid-cols-[1.1fr_0.9fr] lg:gap-16">
              <div className="flex flex-col justify-center border-l-2 border-[#c7a458] pl-5 sm:pl-8">
                <p className="flex items-center gap-3 text-[11px] font-black uppercase tracking-[0.24em] text-[#806128] sm:text-xs">
                  <span className="h-px w-8 bg-[#b8903e]" />
                  Serviços públicos GSA
                </p>
                <h1 className="mt-5 max-w-[15ch] text-4xl font-black leading-[1.05] tracking-[-0.04em] text-[#111820] sm:text-5xl lg:text-[3.85rem]">
                  Ferramentas para orientar decisões com mais clareza.
                </h1>
                <p className="mt-6 max-w-2xl text-base leading-8 text-[#54606b] sm:text-lg">
                  Use o cálculo simples gratuitamente ou avance para o modo Pro quando precisar de mais campos, regras tributárias e detalhamento técnico completo.
                </p>
                <div className="mt-8 flex flex-wrap gap-x-6 gap-y-3 text-xs font-bold text-[#4e5b66]">
                  {['Free sem cadastro', 'Pro com liberação segura', 'Acesso imediato'].map((item) => (
                    <span key={item} className="inline-flex items-center gap-2 rounded-lg bg-white/50 px-3 py-1.5 border border-[#dfd5c5]/70 shadow-2xs">
                      <CheckCircle2 className="h-4 w-4 text-[#8a6e2f]" />
                      {item}
                    </span>
                  ))}
                </div>
              </div>

              <aside className="relative overflow-hidden rounded-3xl border border-[#d8bd73]/35 bg-[linear-gradient(175deg,#182939_0%,#0e1924_100%)] p-1 text-white shadow-[0_24px_50px_rgba(18,27,36,0.22)]">
                <div className="rounded-[22px] bg-gradient-to-b from-white/[0.04] to-transparent p-6 sm:p-8">
                  <div className="border-b border-white/10 pb-6">
                    <span className="inline-flex items-center gap-1.5 rounded-full border border-[#d8bd73]/30 bg-[#d8bd73]/10 px-3 py-1 text-[10px] font-black uppercase tracking-[0.2em] text-[#e8cf89]">
                      <Sparkles className="h-3 w-3" /> Dois níveis de consulta
                    </span>
                    <h2 className="mt-4 text-2xl font-black leading-tight tracking-tight">
                      Comece simples. Aprofunde somente quando precisar.
                    </h2>
                    <p className="mt-3 text-sm leading-relaxed text-white/60">
                      O Free orienta rapidamente com clareza objetiva. O Pro organiza uma análise aprofundada dentro da mesma ferramenta.
                    </p>
                  </div>
                  <div className="divide-y divide-white/10 pt-2">
                    {[
                      ['01', 'Modo Free', 'Poucos campos e resultado imediato, sem necessidade de login.'],
                      ['02', 'Modo Pro', 'Cálculo avançado por pagamento, voucher ou benefício corporativo.'],
                      ['03', 'Confirmação segura', 'Pagamento e elegibilidade são verificados no servidor com total sigilo.'],
                    ].map(([number, title, text]) => (
                      <div key={number} className="grid grid-cols-[38px_1fr] items-start gap-3 py-4">
                        <span className="flex h-7 w-7 items-center justify-center rounded-lg border border-[#d8bd73]/30 bg-[#d8bd73]/10 font-mono text-xs font-black tracking-wider text-[#e8cf89]">
                          {number}
                        </span>
                        <div>
                          <strong className="block text-sm font-bold text-white/95">{title}</strong>
                          <span className="mt-0.5 block text-xs leading-relaxed text-white/55">{text}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </aside>
            </div>
          </div>
        </section>

        {/* TOOLBAR & CARDS SECTION */}
        <section className="py-12 sm:py-20" aria-labelledby="free-tools-title">
          <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
            {/* SECTION HEADER */}
            <div className="grid gap-6 border-b border-[#d8d0c2] pb-8 lg:grid-cols-[1fr_0.75fr] lg:items-end">
              <div className="max-w-3xl">
                <span className="inline-flex items-center gap-1.5 rounded-full border border-[#d6c59e] bg-[#f7eed8] px-3 py-1 text-[10px] font-black uppercase tracking-[0.2em] text-[#806128]">
                  Ferramentas disponíveis
                </span>
                <h2 id="free-tools-title" className="mt-3 text-3xl font-black tracking-[-0.035em] text-[#111820] sm:text-4xl lg:text-[2.65rem]">
                  Escolha a consulta que precisa iniciar.
                </h2>
                <p className="mt-3 max-w-2xl text-sm leading-relaxed text-[#5c6771] sm:text-base">
                  Cada ferramenta abre instantaneamente com o nível Free. A opção Pro fica disponível no mesmo modal caso necessite detalhamento.
                </p>
              </div>

              <div className="rounded-2xl border border-[#d9ceb9] bg-white/70 p-4 shadow-2xs backdrop-blur-xs">
                <div className="flex items-start gap-3 text-sm leading-relaxed text-[#54606b]">
                  <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-[#f7efda] border border-[#d8c28d] text-[#8a6e2f]">
                    <LockKeyhole className="h-4 w-4" />
                  </div>
                  <span>
                    O Free não solicita identificação. <strong className="font-bold text-[#1f2937]">pagamento e voucher Pro também podem ser usados sem cadastro</strong>.
                  </span>
                </div>
              </div>
            </div>

            {/* INTERACTIVE CONTROLS (SEARCH & CATEGORY TABS) */}
            <div className="mt-8 space-y-4">
              <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                {/* CATEGORY FILTER TABS */}
                <div className="flex flex-wrap items-center gap-2 overflow-x-auto pb-1 text-xs">
                  {FILTER_TABS.map((tab) => {
                    const isActive = selectedCategory === tab.id;
                    const count = tab.id === 'all'
                      ? AVAILABLE_TOOLS.length
                      : AVAILABLE_TOOLS.filter((t) => t.filterCategory === tab.id).length;

                    return (
                      <button
                        key={tab.id}
                        type="button"
                        onClick={() => setSelectedCategory(tab.id)}
                        className={`group inline-flex items-center gap-2 rounded-xl px-3.5 py-2.5 font-bold transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#9f8140] ${
                          isActive
                            ? 'bg-[#172534] text-white shadow-sm border border-[#172534]'
                            : 'bg-white/80 text-[#54606b] border border-[#ded5c5] hover:bg-white hover:text-[#111820] hover:border-[#b89b4f]'
                        }`}
                      >
                        <span>{tab.label}</span>
                        <span
                          className={`rounded-full px-2 py-0.5 text-[10px] font-black transition-colors ${
                            isActive
                              ? 'bg-[#e2c781] text-[#142230]'
                              : 'bg-[#ebe3d3] text-[#6b7680] group-hover:bg-[#dfd3bd]'
                          }`}
                        >
                          {count}
                        </span>
                      </button>
                    );
                  })}
                </div>

                {/* SEARCH INPUT */}
                <div className="relative min-w-[260px] md:max-w-xs">
                  <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-[#8c96a0]" />
                  <input
                    type="text"
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    placeholder="Buscar calculadora ou tema..."
                    className="h-11 w-full rounded-xl border border-[#ded5c5] bg-white/90 pl-10 pr-9 text-xs font-medium text-[#111820] placeholder-[#8c96a0] shadow-2xs transition-all focus:border-[#9f8140] focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#9f8140]/25"
                  />
                  {searchTerm && (
                    <button
                      type="button"
                      onClick={() => setSearchTerm('')}
                      className="absolute right-3 top-1/2 -translate-y-1/2 rounded-full p-0.5 text-[#8c96a0] hover:bg-[#eae2d2] hover:text-[#111820]"
                      aria-label="Limpar busca"
                    >
                      <X className="h-3.5 w-3.5" />
                    </button>
                  )}
                </div>
              </div>

              {/* SEARCH STATS INFO */}
              {(searchTerm || selectedCategory !== 'all') && (
                <div className="flex items-center justify-between text-xs text-[#697580] pt-1">
                  <span>
                    Exibindo <strong>{filteredTools.length}</strong> de <strong>{AVAILABLE_TOOLS.length}</strong> ferramentas
                    {searchTerm && ` para "${searchTerm}"`}
                  </span>
                  {(searchTerm || selectedCategory !== 'all') && (
                    <button
                      type="button"
                      onClick={() => {
                        setSelectedCategory('all');
                        setSearchTerm('');
                      }}
                      className="font-bold text-[#8a6e2f] hover:underline"
                    >
                      Redefinir filtros
                    </button>
                  )}
                </div>
              )}
            </div>

            {/* TOOL CARDS GRID */}
            {filteredTools.length > 0 ? (
              <div className="mt-8 grid gap-6 md:grid-cols-2 lg:grid-cols-3">
                {filteredTools.map(({ id, icon: Icon, number, title, description, category, useCase, includes }, index) => (
                  <motion.button
                    key={id}
                    {...reveal(index * 0.15)}
                    type="button"
                    onClick={() => setActiveTool(id as FreeToolId)}
                    className="group relative flex min-h-[440px] flex-col overflow-hidden rounded-3xl border border-[#dfd7c9] bg-gradient-to-b from-white via-[#fcfbfa] to-[#f8f5ee] p-6 text-left shadow-[0_10px_28px_rgba(25,35,48,0.04),0_1px_3px_rgba(25,35,48,0.02)] transition-all duration-300 hover:-translate-y-1.5 hover:border-[#c5a350] hover:bg-white hover:shadow-[0_24px_50px_-10px_rgba(20,30,45,0.13),0_0_0_1px_rgba(197,163,80,0.35)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#9f8140] focus-visible:ring-offset-2 focus-visible:ring-offset-[#eee9df] sm:p-7"
                  >
                    <div className="pointer-events-none absolute bottom-0 right-0 h-16 w-16 border-l border-t border-[#856526]/10 opacity-0 transition-all duration-500 ease-out group-hover:h-full group-hover:w-full group-hover:border-transparent group-hover:bg-[#856526]/[0.02] group-hover:opacity-100" />
                    
                    {/* Top ambient gold accent strip */}
                    <span className="absolute inset-x-0 top-0 h-[3px] bg-[linear-gradient(90deg,#9c7b33,#e5cf8b,transparent)] opacity-90 transition-opacity duration-300 group-hover:opacity-100" />

                    {/* TOP HEADER: ICON + INDEX + BADGE */}
                    <div className="relative z-10 flex items-start justify-between gap-3">
                      <span className="flex h-13 w-13 items-center justify-center rounded-2xl border border-[#d8bd73]/30 bg-gradient-to-br from-[#1c2c3d] to-[#0e1722] text-[#e0c784] shadow-md transition-all duration-400 ease-[cubic-bezier(0.34,1.56,0.64,1)] group-hover:scale-110 group-hover:-rotate-6 group-hover:rounded-full group-hover:border-[#d8bd73]/70 group-hover:shadow-[0_8px_20px_-4px_rgba(216,189,115,0.28)]">
                        <Icon className="h-6 w-6" />
                      </span>

                      <div className="flex flex-col items-end gap-1.5">
                        <span className="rounded-full border border-[#ded0b1] bg-[#f7efde] px-2.5 py-0.5 font-mono text-[10px] font-bold tracking-widest text-[#8c6d26] transition-transform duration-400 group-hover:translate-x-1">
                          {number}
                        </span>
                        <span className="inline-flex items-center gap-1 rounded-full border border-[#d7c499] bg-gradient-to-r from-[#fbf4e2] to-[#f4e7c7] px-2.5 py-0.5 text-[9px] font-black uppercase tracking-[0.14em] text-[#71551a] shadow-2xs">
                          <Sparkles className="h-2.5 w-2.5 text-[#96742a]" /> Free + Pro
                        </span>
                      </div>
                    </div>

                    {/* CATEGORY & TITLE */}
                    <div className="mt-6">
                      <p className="text-[10px] font-black uppercase tracking-[0.2em] text-[#856526]">
                        {category}
                      </p>
                      <h3 className="mt-2 text-xl font-black leading-tight tracking-[-0.03em] text-[#111827] transition-colors duration-200 group-hover:text-[#886925] sm:text-[1.35rem]">
                        {title}
                      </h3>
                      <p className="mt-3 text-xs leading-relaxed text-[#56626d] sm:text-[13px]">
                        {description}
                      </p>
                    </div>

                    {/* "INDICADO PARA" CONTEXT PANEL */}
                    <div className="mt-5 rounded-xl border border-[#e8dfd2] bg-[#f7f3ea]/80 p-3.5 transition-colors duration-200 group-hover:bg-[#f5efe3]">
                      <p className="flex items-center gap-1.5 text-[9px] font-black uppercase tracking-[0.16em] text-[#7a848c]">
                        <Target className="h-3 w-3 text-[#8a6e2f]" /> Indicado para
                      </p>
                      <p className="mt-1.5 text-xs font-medium leading-relaxed text-[#3a464f]">
                        {useCase}
                      </p>
                    </div>

                    {/* CHECKLIST ITEMS */}
                    <ul className="my-5 grid grid-cols-2 gap-x-3 gap-y-2.5 text-[11px] leading-snug text-[#505a63]">
                      {includes.map((item) => (
                        <li key={item} className="flex items-start gap-1.5">
                          <CheckCircle2 className="mt-0.5 h-3.5 w-3.5 shrink-0 text-[#8a6e2f]" />
                          <span>{item}</span>
                        </li>
                      ))}
                    </ul>

                    {/* CARD FOOTER & ACTION */}
                    <div className="mt-auto flex items-center justify-between gap-3 border-t border-[#eae3d7] pt-4.5">
                      <span className="inline-flex items-center gap-1.5 text-[10px] font-bold text-[#717c85]">
                        <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                        Free simples · Pro avançado
                      </span>

                      <span className="inline-flex items-center gap-1.5 rounded-xl bg-[#172534] px-3.5 py-2 text-[11px] font-black uppercase tracking-[0.08em] text-[#f7f0de] shadow-2xs transition-all duration-200 group-hover:bg-[#8a6e2f] group-hover:text-white group-hover:shadow-[0_4px_12px_rgba(138,110,47,0.35)]">
                        Abrir ferramenta
                        <ArrowRight className="h-3.5 w-3.5 transition-transform duration-200 group-hover:translate-x-1" />
                      </span>
                    </div>
                  </motion.button>
                ))}
              </div>
            ) : (
              /* EMPTY STATE */
              <div className="mt-12 rounded-3xl border border-[#d8d0c2] bg-white/80 p-12 text-center shadow-xs">
                <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl border border-[#d8c28d] bg-[#f7efda] text-[#8a6e2f]">
                  <Search className="h-7 w-7" />
                </div>
                <h3 className="mt-4 text-xl font-black text-[#111820]">Nenhuma ferramenta encontrada</h3>
                <p className="mt-2 text-sm text-[#5c6771]">
                  Não encontramos ferramentas para o termo &ldquo;{searchTerm}&rdquo; na categoria selecionada.
                </p>
                <button
                  type="button"
                  onClick={() => {
                    setSelectedCategory('all');
                    setSearchTerm('');
                  }}
                  className="mt-6 inline-flex items-center gap-2 rounded-xl bg-[#172534] px-5 py-2.5 text-xs font-black uppercase tracking-[0.08em] text-white hover:bg-[#253648]"
                >
                  Ver todas as ferramentas
                </button>
              </div>
            )}
          </div>
        </section>

        {/* HIGHLIGHT SIX TOOLS INFO */}
        <section className="border-y border-[#d7d1c6] bg-[#f8f5ef] py-12 sm:py-16">
          <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
            <div className="grid gap-6 rounded-3xl border border-[#d4cdc2] bg-white p-6 shadow-[0_14px_36px_rgba(24,32,40,0.06)] sm:p-8 lg:grid-cols-[1fr_auto] lg:items-center">
              <div>
                <p className="text-[10px] font-black uppercase tracking-[0.2em] text-[#806128]">Área ampliada</p>
                <h2 className="mt-3 text-2xl font-black tracking-[-0.03em] text-[#111820] sm:text-3xl">
                  As seis ferramentas já estão disponíveis.
                </h2>
                <p className="mt-3 max-w-3xl text-sm leading-6 text-[#667078]">
                  13º salário, Benefícios do INSS e BPC / LOAS agora possuem consulta Free e análise Pro, juntamente com Rescisão, Aposentadoria e Férias.
                </p>
              </div>
              <div className="grid grid-cols-3 gap-2 text-center text-[10px] font-black uppercase tracking-[0.1em] text-[#6d5727]">
                {['13º', 'INSS', 'BPC'].map((label) => (
                  <span key={label} className="rounded-xl border border-[#d6c79e] bg-[#f7f0dc] px-4 py-3 font-black shadow-2xs">
                    {label}
                  </span>
                ))}
              </div>
            </div>
          </div>
        </section>

        {/* COMMITMENT & PRIVACY */}
        <section className="border-b border-white/10 bg-[#111d29] py-14 text-white sm:py-16">
          <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
            <div className="grid gap-8 lg:grid-cols-[0.75fr_1.25fr] lg:gap-14">
              <div>
                <p className="text-[10px] font-black uppercase tracking-[0.2em] text-[#d8bd73]">Compromisso da plataforma</p>
                <h2 className="mt-4 text-3xl font-black leading-tight tracking-[-0.03em] sm:text-4xl">
                  Clareza antes de qualquer conclusão.
                </h2>
                <p className="mt-4 text-sm leading-7 text-white/55">
                  A área foi estruturada para informar sem esconder limites, condições ou situações que exigem análise individual.
                </p>
              </div>
              <div className="grid gap-px overflow-hidden rounded-3xl border border-white/10 bg-white/10 md:grid-cols-3">
                {[
                  {
                    icon: ShieldCheck,
                    title: 'Privacidade preservada',
                    text: 'Os valores digitados permanecem no dispositivo e não são armazenados pela GSA.',
                  },
                  {
                    icon: Calculator,
                    title: 'Cálculo explicado',
                    text: 'O resultado apresenta a composição utilizada, não apenas um número isolado.',
                  },
                  {
                    icon: Info,
                    title: 'Limites visíveis',
                    text: 'Cada ferramenta informa o que não foi considerado e quando buscar confirmação.',
                  },
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

        {/* CTA SERVICES */}
        <section className="py-14 sm:py-20">
          <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">
            <div className="grid overflow-hidden rounded-3xl border border-[#cbbd9f] bg-[#d8c28d] shadow-lg lg:grid-cols-[1fr_340px]">
              <div className="p-7 sm:p-10 lg:p-12">
                <p className="text-[10px] font-black uppercase tracking-[0.2em] text-[#624d20]">Quando a simulação não basta</p>
                <h2 className="mt-4 max-w-3xl text-3xl font-black leading-tight tracking-[-0.03em] text-[#17202a] sm:text-4xl">
                  Documentos, períodos especiais e regras específicas merecem uma análise completa.
                </h2>
                <p className="mt-4 max-w-2xl text-sm leading-7 text-[#5c4d31]">
                  Conheça os serviços da GSA quando a situação exigir conferência individual, organização documental ou acompanhamento.
                </p>
              </div>
              <div className="flex flex-col justify-center border-t border-[#b69e69] bg-[#c8ad70] p-7 lg:border-l lg:border-t-0">
                <button
                  type="button"
                  onClick={onServices}
                  className="inline-flex min-h-12 items-center justify-center gap-2 rounded-xl bg-[#172433] px-5 py-3 text-sm font-black text-white shadow-md transition-all hover:bg-[#223449] hover:shadow-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white"
                >
                  Conhecer os serviços GSA <ArrowRight className="h-4 w-4" />
                </button>
                <p className="mt-4 text-center text-[11px] leading-5 text-[#584721]">
                  Atendimento por WhatsApp, e-mail ou Portal do Cliente.
                </p>
              </div>
            </div>
            <p className="mx-auto mt-8 max-w-3xl text-center text-xs leading-5 text-[#69727a]">
              As ferramentas fornecem estimativas educativas e não comprovam direitos, não substituem o cálculo oficial dos órgãos competentes nem a orientação de profissional habilitado.
            </p>
          </div>
        </section>

        <FreeToolsTieredCalculatorDialog
          tool={activeTool}
          onClose={() => setActiveTool(null)}
          onToolChange={setActiveTool}
          onServices={() => {
            setActiveTool(null);
            onServices();
          }}
          onClientLogin={onClientLogin}
        />
      </main>
    </div>
  );
}

