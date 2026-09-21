import { useMemo, useState } from 'react';
import {
  Accessibility,
  ArrowLeft,
  ArrowRight,
  BadgeDollarSign,
  BriefcaseBusiness,
  Building2,
  Car,
  Check,
  CheckCircle2,
  CircleCheck,
  CreditCard,
  FileCheck2,
  Headphones,
  Layers3,
  LayoutGrid,
  List,
  Percent,
  Receipt,
  Search,
  ShieldCheck,
  Sparkles,
  Store,
  TrendingUp,
  Users,
  X,
} from 'lucide-react';
import type { Audience, IconItem, ServicePackage } from '../../../data/publicServiceCatalog';

import { motion } from 'framer-motion';

interface PublicServicesPageProps {
  audience: Audience;
  setAudience: (audience: Audience) => void;
  packages: ServicePackage[];
  publicServices?: IconItem[];
  onBack: () => void;
  onSelect: (item: ServicePackage) => void;
}

const reveal = (delay = 0) => ({
  initial: { opacity: 0, y: 48 },
  whileInView: { opacity: 1, y: 0 },
  viewport: { once: true, amount: 0.18 },
  transition: { duration: 0.85, delay, ease: [0.16, 1, 0.3, 1] as const },
});

const journey = [
  {
    icon: Layers3,
    number: '01',
    title: 'Escolha o perfil',
    text: 'Alterne entre Pessoa Física e Empresas para ver os pacotes dedicados.',
  },
  {
    icon: CheckCircle2,
    number: '02',
    title: 'Entenda o escopo',
    text: 'Abra cada pacote para conhecer a lista completa de serviços e coberturas.',
  },
  {
    icon: Headphones,
    number: '03',
    title: 'Solicite atendimento',
    text: 'Siga direto pelo WhatsApp, e-mail ou Portal do Cliente em poucos cliques.',
  },
];

function getPackageIcon(title: string, audience: Audience) {
  const norm = title.toLowerCase();
  if (norm.includes('futuro') || norm.includes('previdenci')) return ShieldCheck;
  if (norm.includes('microempreendedor') || norm.includes('mei')) return Store;
  if (norm.includes('direção') || norm.includes('direcao') || norm.includes('veicular') || norm.includes('cnh')) return Car;
  if (norm.includes('pcd') || norm.includes('direitos')) return Accessibility;
  if (norm.includes('vida em dia') || norm.includes('finanças') || norm.includes('financas')) return Sparkles;
  if (norm.includes('financeira') || norm.includes('bpo')) return BadgeDollarSign;
  if (norm.includes('faturamento') || norm.includes('fiscal')) return Receipt;
  if (norm.includes('crédito') || norm.includes('credito') || norm.includes('cobrança') || norm.includes('cobranca')) return TrendingUp;
  if (norm.includes('administrativa') || norm.includes('compras')) return Building2;
  if (norm.includes('comiss') || norm.includes('vendas')) return Percent;
  if (norm.includes('reembolso') || norm.includes('despesas')) return CreditCard;
  if (norm.includes('compliance') || norm.includes('regularidade')) return FileCheck2;
  return audience === 'PF' ? Users : BriefcaseBusiness;
}

const CATEGORY_CHIPS: Record<Audience, Array<{ id: string; label: string; keywords: string[] }>> = {
  PF: [
    { id: 'all', label: 'Todos', keywords: [] },
    { id: 'inss', label: 'INSS & Previdência', keywords: ['futuro', 'previdenci', 'inss', 'aposentadoria'] },
    { id: 'mei', label: 'MEI', keywords: ['microempreendedor', 'mei'] },
    { id: 'cnh', label: 'CNH & Veicular', keywords: ['direção', 'direcao', 'veicular', 'cnh', 'veículo'] },
    { id: 'pcd', label: 'Direitos PcD', keywords: ['pcd', 'isenções', 'isencoes'] },
    { id: 'financas', label: 'Finanças & CPF', keywords: ['vida em dia', 'finanças', 'financas', 'cpf', 'renda'] },
  ],
  PJ: [
    { id: 'all', label: 'Todos', keywords: [] },
    { id: 'bpo', label: 'BPO Financeiro', keywords: ['financeira', 'bpo', 'contas a pagar'] },
    { id: 'fiscal', label: 'Fiscal & Notas', keywords: ['faturamento', 'fiscal', 'notas fiscais'] },
    { id: 'cobranca', label: 'Cobrança', keywords: ['crédito', 'credito', 'cobrança', 'cobranca', 'inadimplência'] },
    { id: 'compras', label: 'Facilities & Compras', keywords: ['administrativa', 'compras', 'fornecedores'] },
    { id: 'comissoes', label: 'Comissões', keywords: ['comiss', 'vendas'] },
    { id: 'reembolso', label: 'Reembolsos & Cartão', keywords: ['reembolso', 'despesas', 'rdv'] },
    { id: 'compliance', label: 'Compliance & CNDs', keywords: ['compliance', 'regularidade', 'cnd'] },
  ],
};

export function PublicServicesPage({ audience, setAudience, packages, onBack, onSelect }: PublicServicesPageProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [activeCategory, setActiveCategory] = useState('all');
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');

  const audienceTitle = audience === 'PF' ? 'Soluções para sua vida e rotina' : 'Soluções para a operação da sua empresa';
  const audienceDescription = audience === 'PF'
    ? 'Pacotes organizados para necessidades pessoais, previdenciárias, documentais e financeiras.'
    : 'Pacotes para terceirização de rotinas financeiras, fiscais, compras, comissões e compliance.';

  // Filtragem dos pacotes por busca textual e chip de categoria
  const filteredPackages = useMemo(() => {
    let result = packages;

    if (activeCategory !== 'all') {
      const chip = CATEGORY_CHIPS[audience]?.find((c) => c.id === activeCategory);
      if (chip && chip.keywords.length > 0) {
        result = result.filter((pkg) => {
          const haystack = `${pkg.title} ${pkg.subtitle} ${pkg.description} ${pkg.services.map((s) => s.name).join(' ')}`.toLowerCase();
          return chip.keywords.some((kw) => haystack.includes(kw.toLowerCase()));
        });
      }
    }

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      result = result.filter((pkg) => {
        const inTitle = pkg.title.toLowerCase().includes(q);
        const inSubtitle = pkg.subtitle.toLowerCase().includes(q);
        const inDesc = pkg.description.toLowerCase().includes(q);
        const inServices = pkg.services.some((s) => s.name.toLowerCase().includes(q) || s.desc.toLowerCase().includes(q));
        return inTitle || inSubtitle || inDesc || inServices;
      });
    }

    return result;
  }, [packages, activeCategory, searchQuery, audience]);

  const handleAudienceSwitch = (newAudience: Audience) => {
    setAudience(newAudience);
    setActiveCategory('all');
    setSearchQuery('');
  };

  return (
    <main className="min-h-screen bg-[#eee8dc] pt-[58px] sm:pt-[73px] text-[#17202a]">
      {/* 1. HERO SECTION */}
      <section className="relative overflow-hidden border-b border-[#d8cfbf] bg-[linear-gradient(135deg,#faf7f0_0%,#f2ecdf_54%,#e8decc_100%)]">
        <div className="pointer-events-none absolute -right-40 -top-48 h-[30rem] sm:h-[34rem] w-[30rem] sm:w-[34rem] rounded-full border border-[#b8903e]/15" />
        <div className="pointer-events-none absolute right-4 top-10 h-44 w-44 sm:h-56 sm:w-56 rounded-full bg-[#d8bd73]/15 blur-3xl" />

        <div className="relative mx-auto max-w-7xl px-4 py-6 sm:px-6 sm:py-12 lg:px-8 lg:py-16">
          {/* TOPO COM BREADCRUMB E CONTAGEM */}
          <div className="flex items-center justify-between gap-3">
            <button
              type="button"
              onClick={onBack}
              className="group inline-flex min-h-9 sm:min-h-10 items-center gap-2 rounded-full border border-[#cfc5b5] bg-white/80 px-3.5 py-1.5 text-xs sm:text-sm font-black text-[#44505b] shadow-2xs backdrop-blur-sm transition-all hover:border-[#9f8140] hover:bg-white hover:text-[#17202a] active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#9f8140]"
            >
              <ArrowLeft className="h-3.5 w-3.5 sm:h-4 sm:w-4 text-[#806128] transition-transform duration-200 group-hover:-translate-x-1" />
              <span>Voltar ao início</span>
            </button>

            <span className="inline-flex items-center gap-1.5 rounded-full border border-[#d8bd73]/40 bg-[#faf6ec] px-3 py-1 text-[10px] sm:text-xs font-black text-[#6d5727] shadow-2xs">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-600 animate-pulse" />
              {packages.length} {packages.length === 1 ? 'pacote' : 'pacotes'} no perfil
            </span>
          </div>

          <div className="mt-5 sm:mt-8 grid items-end gap-6 sm:gap-10 lg:grid-cols-[1.08fr_0.92fr] lg:gap-16">
            {/* APRESENTAÇÃO E TÍTULO */}
            <div className="border-l-2 border-[#c7a458] pl-3.5 sm:pl-6">
              <p className="flex items-center gap-2.5 text-[10px] sm:text-xs font-black uppercase tracking-[0.22em] text-[#806128]">
                <span className="h-px w-5 sm:w-8 bg-[#b8903e]" />
                Serviços e assinaturas GSA
              </p>

              <h1 className="mt-2.5 sm:mt-4 text-2xl sm:text-4xl lg:text-[3.6rem] font-black leading-[1.12] sm:leading-[1.03] tracking-tight text-[#111820]">
                Soluções organizadas para pessoas e empresas.
              </h1>

              <p className="mt-2.5 sm:mt-5 text-xs sm:text-base leading-relaxed text-[#59636d]">
                Escolha o perfil, compare os pacotes e conheça com clareza o que está incluído antes de solicitar atendimento.
              </p>

            </div>

            {/* SELETOR DE PERFIL MOBILE */}
            <div className="block lg:hidden mt-2">
              <div className="overflow-hidden rounded-2xl border border-[#d8bd73]/40 bg-[linear-gradient(180deg,#142536_0%,#0b1723_100%)] p-2.5 text-white shadow-[0_12px_30px_rgba(18,27,36,0.18)]">
                <div className="flex items-center justify-between px-2 pt-1 pb-2">
                  <div>
                    <span className="text-[9px] font-black uppercase tracking-[0.2em] text-[#d8bd73]">
                      Para quem é o atendimento?
                    </span>
                    <p className="text-xs font-bold text-white/80">Toque para alternar o catálogo:</p>
                  </div>
                  <span className="rounded-full bg-white/10 px-2 py-0.5 text-[10px] font-mono font-bold text-[#d8bd73]">
                    {audience === 'PF' ? 'PF Ativo' : 'PJ Ativo'}
                  </span>
                </div>

                <div className="grid grid-cols-2 gap-2" role="group" aria-label="Selecione o perfil mobile">
                  <button
                    type="button"
                    onClick={() => handleAudienceSwitch('PF')}
                    aria-pressed={audience === 'PF'}
                    className={`relative flex flex-col items-center justify-center gap-1.5 rounded-xl p-3 text-center transition-all duration-300 active:scale-95 ${
                      audience === 'PF'
                        ? 'border border-[#d8bd73] bg-gradient-to-b from-[#fbf8f1] to-[#f2ead6] text-[#17202a] shadow-[0_4px_20px_rgba(216,189,115,0.15)] ring-1 ring-[#d8bd73]/50'
                        : 'border border-white/10 bg-white/[0.03] text-white/75 hover:bg-white/[0.06] hover:border-[#d8bd73]/30'
                    }`}
                  >
                    {audience === 'PF' && (
                      <div className="absolute top-2 right-2 flex h-4 w-4 items-center justify-center rounded-full bg-[#8a6b2f] text-white shadow-xs">
                        <Check className="h-2.5 w-2.5" strokeWidth={3} />
                      </div>
                    )}
                    <Users className={`h-5 w-5 ${audience === 'PF' ? 'text-[#8a6b2f]' : 'text-white/40'}`} />
                    <span className={`text-[11px] sm:text-xs font-black tracking-tight ${audience === 'PF' ? 'text-[#17202a]' : 'text-white'}`}>Pessoa Física</span>
                    <span className={`text-[9px] leading-tight ${audience === 'PF' ? 'text-[#68717a]' : 'text-white/40'}`}>Para você e família</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => handleAudienceSwitch('PJ')}
                    aria-pressed={audience === 'PJ'}
                    className={`relative flex flex-col items-center justify-center gap-1.5 rounded-xl p-3 text-center transition-all duration-300 active:scale-95 ${
                      audience === 'PJ'
                        ? 'border border-[#d8bd73] bg-gradient-to-b from-[#fbf8f1] to-[#f2ead6] text-[#17202a] shadow-[0_4px_20px_rgba(216,189,115,0.15)] ring-1 ring-[#d8bd73]/50'
                        : 'border border-white/10 bg-white/[0.03] text-white/75 hover:bg-white/[0.06] hover:border-[#d8bd73]/30'
                    }`}
                  >
                    {audience === 'PJ' && (
                      <div className="absolute top-2 right-2 flex h-4 w-4 items-center justify-center rounded-full bg-[#8a6b2f] text-white shadow-xs">
                        <Check className="h-2.5 w-2.5" strokeWidth={3} />
                      </div>
                    )}
                    <BriefcaseBusiness className={`h-5 w-5 ${audience === 'PJ' ? 'text-[#8a6b2f]' : 'text-white/40'}`} />
                    <span className={`text-[11px] sm:text-xs font-black tracking-tight ${audience === 'PJ' ? 'text-[#17202a]' : 'text-white'}`}>Empresas (PJ)</span>
                    <span className={`text-[9px] leading-tight ${audience === 'PJ' ? 'text-[#68717a]' : 'text-white/40'}`}>Rotinas corporativas</span>
                  </button>
                </div>
              </div>
            </div>

            {/* SELETOR DE PERFIL DESKTOP */}
            <aside className="hidden lg:block overflow-hidden rounded-2xl border border-[#d8bd73]/35 bg-[linear-gradient(180deg,#142536_0%,#0b1723_100%)] text-white shadow-[inset_0_3px_0_#d8bd73,0_30px_70px_rgba(18,27,36,0.22)]">
              <div className="border-b border-white/10 px-6 py-6">
                <p className="text-[10px] font-black uppercase tracking-[0.2em] text-[#d8bd73]">Para quem é o atendimento?</p>
                <h2 className="mt-2 text-2xl font-black leading-tight">Selecione seu perfil</h2>
                <p className="mt-2 text-sm leading-6 text-white/60">O catálogo será ajustado sem perder sua posição na página.</p>
              </div>

              <div className="grid gap-3.5 p-4 sm:grid-cols-2" role="group" aria-label="Perfil do catálogo">
                <button
                  type="button"
                  onClick={() => handleAudienceSwitch('PF')}
                  aria-pressed={audience === 'PF'}
                  className={`group relative flex min-h-[120px] flex-col rounded-xl border p-5 text-left transition-all duration-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#d8bd73] ${
                    audience === 'PF'
                      ? 'border-[#d8bd73] bg-gradient-to-br from-[#fbf8f1] to-[#f2ead6] text-[#17202a] shadow-[0_8px_30px_rgba(216,189,115,0.18)] scale-[1.02] ring-1 ring-[#d8bd73]/50'
                      : 'border-white/10 bg-white/[0.03] text-white hover:-translate-y-1 hover:border-[#d8bd73]/40 hover:bg-white/[0.06] hover:shadow-[0_8px_20px_rgba(0,0,0,0.2)]'
                  }`}
                >
                  <div className="flex w-full items-center justify-between">
                    <span className={`flex h-10 w-10 items-center justify-center rounded-lg transition-colors duration-300 ${audience === 'PF' ? 'bg-[#142536] text-[#d8bd73] shadow-xs' : 'bg-white/5 text-[#8a949f] group-hover:bg-[#d8bd73]/20 group-hover:text-[#d8bd73]'}`}>
                      <Users className="h-5 w-5" />
                    </span>
                    <div className={`flex h-5 w-5 items-center justify-center rounded-full border transition-all duration-300 ${audience === 'PF' ? 'border-[#8a6b2f] bg-[#8a6b2f] text-white' : 'border-white/20 bg-transparent text-transparent group-hover:border-[#d8bd73]/50'}`}>
                      <Check className="h-3 w-3" strokeWidth={3} />
                    </div>
                  </div>
                  <strong className={`mt-5 block text-base font-black tracking-tight ${audience === 'PF' ? 'text-[#17202a]' : 'text-white'}`}>Pessoa física</strong>
                  <span className={`mt-1.5 block text-[11px] sm:text-xs leading-relaxed ${audience === 'PF' ? 'text-[#68717a]' : 'text-white/50'}`}>Necessidades pessoais e familiares.</span>
                </button>

                <button
                  type="button"
                  onClick={() => handleAudienceSwitch('PJ')}
                  aria-pressed={audience === 'PJ'}
                  className={`group relative flex min-h-[120px] flex-col rounded-xl border p-5 text-left transition-all duration-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#d8bd73] ${
                    audience === 'PJ'
                      ? 'border-[#d8bd73] bg-gradient-to-br from-[#fbf8f1] to-[#f2ead6] text-[#17202a] shadow-[0_8px_30px_rgba(216,189,115,0.18)] scale-[1.02] ring-1 ring-[#d8bd73]/50'
                      : 'border-white/10 bg-white/[0.03] text-white hover:-translate-y-1 hover:border-[#d8bd73]/40 hover:bg-white/[0.06] hover:shadow-[0_8px_20px_rgba(0,0,0,0.2)]'
                  }`}
                >
                  <div className="flex w-full items-center justify-between">
                    <span className={`flex h-10 w-10 items-center justify-center rounded-lg transition-colors duration-300 ${audience === 'PJ' ? 'bg-[#142536] text-[#d8bd73] shadow-xs' : 'bg-white/5 text-[#8a949f] group-hover:bg-[#d8bd73]/20 group-hover:text-[#d8bd73]'}`}>
                      <BriefcaseBusiness className="h-5 w-5" />
                    </span>
                    <div className={`flex h-5 w-5 items-center justify-center rounded-full border transition-all duration-300 ${audience === 'PJ' ? 'border-[#8a6b2f] bg-[#8a6b2f] text-white' : 'border-white/20 bg-transparent text-transparent group-hover:border-[#d8bd73]/50'}`}>
                      <Check className="h-3 w-3" strokeWidth={3} />
                    </div>
                  </div>
                  <strong className={`mt-5 block text-base font-black tracking-tight ${audience === 'PJ' ? 'text-[#17202a]' : 'text-white'}`}>Empresas</strong>
                  <span className={`mt-1.5 block text-[11px] sm:text-xs leading-relaxed ${audience === 'PJ' ? 'text-[#68717a]' : 'text-white/50'}`}>Rotinas e demandas empresariais.</span>
                </button>
              </div>
            </aside>
          </div>
        </div>
      </section>

      {/* 2. BARRA DE CONTROLE STICKY */}
      <div className="sticky top-[56px] sm:top-[68px] z-30 border-b border-[#d4ccbe]/90 bg-[#eee8dc]/95 px-3 py-2 sm:px-6 sm:py-3 shadow-xs backdrop-blur-md transition-all">
        <div className="mx-auto flex max-w-7xl items-center justify-end gap-2 sm:gap-4">
          <div className="flex items-center gap-2">
            <span className="hidden md:inline-flex items-center gap-1 text-xs font-bold text-[#626d77]">
              <strong>{filteredPackages.length}</strong> de {packages.length} pacotes
            </span>

            <div className="inline-flex rounded-lg border border-[#cfc5b5] bg-white/90 p-0.5 shadow-2xs">
              <button
                type="button"
                onClick={() => setViewMode('grid')}
                title="Visualização em Cards"
                className={`flex h-7 w-7 items-center justify-center rounded-md text-xs transition-colors ${
                  viewMode === 'grid'
                    ? 'bg-[#142332] text-[#d8bd73]'
                    : 'text-[#59636d] hover:text-[#17202a]'
                }`}
              >
                <LayoutGrid className="h-3.5 w-3.5" />
              </button>
              <button
                type="button"
                onClick={() => setViewMode('list')}
                title="Visualização em Lista Compacta"
                className={`flex h-7 w-7 items-center justify-center rounded-md text-xs transition-colors ${
                  viewMode === 'list'
                    ? 'bg-[#142332] text-[#d8bd73]'
                    : 'text-[#59636d] hover:text-[#17202a]'
                }`}
              >
                <List className="h-3.5 w-3.5" />
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* 3. SEÇÃO PRINCIPAL DE PACOTES */}
      <section className="py-6 sm:py-12" aria-labelledby="service-packages-title">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="flex flex-col gap-4 border-b border-[#d4ccbe] pb-5 sm:pb-6 lg:flex-row lg:items-end lg:justify-between">
            <div className="max-w-2xl">
              <div className="flex items-center gap-2">
                <span className="h-1.5 w-1.5 rounded-full bg-[#806128]" />
                <p className="text-[10px] sm:text-xs font-black uppercase tracking-[0.2em] text-[#806128]">
                  Catálogo selecionado · {audience === 'PF' ? 'Pessoa Física' : 'Corporativo'}
                </p>
              </div>
              <h2 id="service-packages-title" className="mt-1.5 text-xl sm:text-3xl font-black tracking-tight text-[#111820]">
                {audienceTitle}
              </h2>
              <p className="mt-1 text-xs sm:text-sm leading-relaxed text-[#626b74]">
                {audienceDescription}
              </p>
            </div>

            {/* BUSCA INSTANTÂNEA */}
            <div className="relative w-full lg:w-80">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#806128]" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Buscar pacote ou serviço..."
                className="w-full rounded-xl border border-[#cfc5b5] bg-white/90 py-2 pl-9 pr-9 text-xs sm:text-sm text-[#111820] placeholder-[#8a949f] shadow-2xs outline-none transition focus:border-[#806128] focus:bg-white focus:ring-2 focus:ring-[#d8bd73]/30"
              />
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => setSearchQuery('')}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 rounded-full p-1 text-[#626b74] hover:bg-neutral-100"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              )}
            </div>
          </div>

          {/* CHIPS DE CATEGORIAS */}
          <div className="mt-3 flex items-center gap-1.5 overflow-x-auto pb-2 scrollbar-none [-webkit-overflow-scrolling:touch]">
            {CATEGORY_CHIPS[audience]?.map((chip) => {
              const isSelected = activeCategory === chip.id;
              return (
                <button
                  key={chip.id}
                  type="button"
                  onClick={() => setActiveCategory(chip.id)}
                  className={`shrink-0 rounded-full px-3 py-1.5 text-[11px] sm:text-xs font-black transition-all active:scale-95 ${
                    isSelected
                      ? 'bg-[#142332] text-[#d8bd73] shadow-xs ring-1 ring-[#d8bd73]'
                      : 'border border-[#d8d0c3] bg-white/80 text-[#59636d] hover:border-[#806128] hover:text-[#17202a]'
                  }`}
                >
                  {chip.label}
                </button>
              );
            })}
          </div>

          {(searchQuery || activeCategory !== 'all') && (
            <div className="mt-3 flex items-center justify-between text-xs font-bold text-[#626d77]">
              <span>
                Mostrando {filteredPackages.length} de {packages.length} pacotes
              </span>
              <button
                type="button"
                onClick={() => { setSearchQuery(''); setActiveCategory('all'); }}
                className="text-[#806128] underline underline-offset-2 hover:text-[#111820]"
              >
                Limpar filtros
              </button>
            </div>
          )}

          {/* MODO 1: GRID DE CARDS */}
          {viewMode === 'grid' && (
            <div className="mt-6 grid gap-4 sm:gap-6 md:grid-cols-2 xl:grid-cols-3">
              {filteredPackages.map((item, index) => {
                const PackageIcon = getPackageIcon(item.title, audience);
                const remainingCount = item.services.length - 3;

                return (
                  <motion.button
                    key={item.id || item.title}
                    {...reveal(index * 0.15)}
                    type="button"
                    onClick={() => onSelect(item)}
                    className="group relative flex flex-col justify-between overflow-hidden rounded-2xl sm:rounded-3xl border border-[#dcd3c5] bg-white p-4 sm:p-7 text-left shadow-[0_6px_24px_rgba(20,30,42,0.04)] transition-all duration-300 hover:-translate-y-1.5 hover:border-[#c5a25d] hover:shadow-[0_20px_45px_rgba(20,30,42,0.11)] active:scale-[0.99] touch-manipulation focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#9f8140]"
                  >
                    <span className="absolute inset-x-0 top-0 h-1 sm:h-1.5 bg-gradient-to-r from-[#8a6b2f] via-[#d8bd73] to-[#8a6b2f] opacity-85 transition-all duration-300 group-hover:h-2 group-hover:opacity-100" />
                    <div className="pointer-events-none absolute -right-6 -top-6 h-32 w-32 rounded-full bg-[#d8bd73]/10 blur-xl transition-all duration-300 group-hover:bg-[#d8bd73]/20" />
                    
                    {/* Hover corner fill */}
                    <div className="pointer-events-none absolute bottom-0 right-0 h-16 w-16 border-l border-t border-[#806128]/10 opacity-0 transition-all duration-500 ease-out group-hover:h-full group-hover:w-full group-hover:border-transparent group-hover:bg-[#806128]/[0.02] group-hover:opacity-100" />

                    <div className="relative z-10">
                      <div className="flex items-center justify-between gap-3">
                        <div className="flex items-center gap-2.5">
                          <span className="flex h-10 w-10 sm:h-12 sm:w-12 shrink-0 items-center justify-center rounded-xl sm:rounded-2xl bg-[#142332] text-[#d8bd73] shadow-xs transition-all duration-400 ease-[cubic-bezier(0.34,1.56,0.64,1)] group-hover:scale-110 group-hover:-rotate-6 group-hover:rounded-full group-hover:bg-[#806128] group-hover:text-white">
                            <PackageIcon className="h-5 w-5 sm:h-6 sm:w-6" />
                          </span>
                          <span className="font-mono text-[11px] sm:text-xs font-black tracking-widest text-[#9b7c33] transition-transform duration-400 group-hover:translate-x-1">
                            #{String(index + 1).padStart(2, '0')}
                          </span>
                        </div>

                        <span className="inline-flex items-center gap-1.5 rounded-full border border-[#d8bd73]/50 bg-[#faf6ec] px-2.5 py-0.5 text-[9px] sm:text-[10px] font-black uppercase tracking-[0.14em] text-[#6d5727] shadow-2xs">
                          <span className="h-1.5 w-1.5 rounded-full bg-emerald-600" />
                          {audience === 'PF' ? 'Para você' : 'Empresarial'}
                        </span>
                      </div>

                      <div className="mt-4 sm:mt-5">
                        <span className="inline-block rounded-md border border-[#e6ddc9] bg-[#faf6ec] px-2 py-0.5 text-[9px] sm:text-[10px] font-black uppercase tracking-[0.14em] text-[#806128]">
                          {item.subtitle}
                        </span>
                        <h3 className="mt-2 text-lg sm:text-2xl font-black leading-snug tracking-tight text-[#111820] transition-colors duration-200 group-hover:text-[#806128]">
                          {item.title}
                        </h3>
                        <p className="mt-1.5 text-xs sm:text-sm leading-relaxed text-[#5a6570] font-normal line-clamp-2">
                          {item.description}
                        </p>
                      </div>

                      <div className="mt-4 sm:mt-5 rounded-xl sm:rounded-2xl border border-[#e8e0d1] bg-[#faf8f3] p-3 sm:p-4 transition-colors duration-200 group-hover:bg-[#f7f3ea]">
                        <p className="flex items-center gap-1.5 text-[9px] sm:text-[10px] font-black uppercase tracking-[0.14em] text-[#806128]">
                          <Sparkles className="h-3 w-3 sm:h-3.5 sm:w-3.5 text-[#d8bd73]" />
                          Destaques inclusos:
                        </p>
                        <ul className="mt-2 space-y-1.5" aria-label={`Serviços inclusos no pacote ${item.title}`}>
                          {item.services.slice(0, 3).map((service) => (
                            <li key={service.name} className="flex items-center gap-2 text-xs font-bold text-[#2a3642]">
                              <span className="flex h-3.5 w-3.5 shrink-0 items-center justify-center rounded-full bg-[#142332] text-[#d8bd73] shadow-2xs group-hover:bg-[#806128] group-hover:text-white transition-colors">
                                <Check className="h-2 w-2" strokeWidth={3} />
                              </span>
                              <span className="truncate">{service.name}</span>
                            </li>
                          ))}
                        </ul>

                        {remainingCount > 0 && (
                          <p className="mt-2 text-right text-[10px] sm:text-[11px] font-black text-[#806128]">
                            + {remainingCount} {remainingCount === 1 ? 'outro serviço no escopo' : 'outros serviços no escopo'}
                          </p>
                        )}
                      </div>
                    </div>

                    <div className="mt-4 sm:mt-6 flex items-center justify-between gap-2 border-t border-[#e8e1d4] pt-3 sm:pt-4">
                      <span className="inline-flex items-center gap-1.5 text-xs font-bold text-[#626d77]">
                        <Layers3 className="h-3.5 w-3.5 text-[#8a6b2f]" />
                        <strong>{item.services.length}</strong> {item.services.length === 1 ? 'serviço' : 'serviços'}
                      </span>

                      <span className="inline-flex min-h-[38px] sm:min-h-[42px] items-center gap-1.5 sm:gap-2 rounded-xl bg-[#142332] px-3.5 sm:px-4 py-2 text-xs font-black text-white shadow-xs transition-all duration-200 group-hover:bg-[#806128] group-hover:shadow-md group-hover:translate-x-0.5">
                        <span>Ver detalhes</span>
                        <ArrowRight className="h-3.5 w-3.5 transition-transform duration-200 group-hover:translate-x-1" />
                      </span>
                    </div>
                  </motion.button>
                );
              })}
            </div>
          )}

          {/* MODO 2: LISTA COMPACTA */}
          {viewMode === 'list' && (
            <div className="mt-5 space-y-3">
              {filteredPackages.map((item, index) => {
                const PackageIcon = getPackageIcon(item.title, audience);
                return (
                  <motion.button
                    key={item.id || item.title}
                    {...reveal(index * 0.15)}
                    type="button"
                    onClick={() => onSelect(item)}
                    className="group relative flex w-full items-center justify-between gap-3 overflow-hidden rounded-2xl border border-[#dcd3c5] bg-white p-3.5 sm:p-5 text-left shadow-2xs transition-all duration-300 hover:border-[#c5a25d] hover:shadow-md active:scale-[0.99]"
                  >
                    <span className="absolute inset-y-0 left-0 w-1.5 bg-[#806128]" />
                    <div className="pointer-events-none absolute bottom-0 right-0 h-16 w-16 border-l border-t border-[#806128]/10 opacity-0 transition-all duration-500 ease-out group-hover:h-full group-hover:w-full group-hover:border-transparent group-hover:bg-[#806128]/[0.02] group-hover:opacity-100" />
                    <div className="relative z-10 flex items-center gap-3 min-w-0 pl-1">
                      <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[#142332] text-[#d8bd73] shadow-xs transition-all duration-400 ease-[cubic-bezier(0.34,1.56,0.64,1)] group-hover:scale-110 group-hover:-rotate-6 group-hover:rounded-full group-hover:bg-[#806128] group-hover:text-white">
                        <PackageIcon className="h-5 w-5" />
                      </span>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <span className="text-[10px] font-black uppercase text-[#806128]">{item.subtitle}</span>
                          <span className="text-[10px] font-mono text-[#9b7c33] transition-transform duration-400 group-hover:translate-x-1">#{String(index + 1).padStart(2, '0')}</span>
                        </div>
                        <h3 className="text-sm sm:text-base font-black text-[#111820] truncate">{item.title}</h3>
                        <p className="text-xs text-[#626d77] line-clamp-1">{item.description}</p>
                      </div>
                    </div>

                    <div className="flex shrink-0 items-center gap-2">
                      <span className="hidden sm:inline-flex items-center gap-1 text-xs font-bold text-[#626d77]">
                        {item.services.length} serviços
                      </span>
                      <span className="inline-flex h-8 w-8 sm:h-9 sm:w-auto items-center justify-center sm:px-3 rounded-lg bg-[#142332] text-xs font-black text-white group-hover:bg-[#806128] transition-colors">
                        <span className="hidden sm:inline mr-1">Ver</span>
                        <ArrowRight className="h-3.5 w-3.5" />
                      </span>
                    </div>
                  </motion.button>
                );
              })}
            </div>
          )}

          {/* ESTADO VAZIO */}
          {filteredPackages.length === 0 && (
            <div className="mt-8 rounded-2xl sm:rounded-3xl border border-dashed border-[#c8bda9] bg-white/70 p-8 sm:p-12 text-center shadow-xs">
              <BriefcaseBusiness className="mx-auto h-8 w-8 sm:h-10 sm:w-10 text-[#9b7c33]" />
              <h3 className="mt-3 text-lg sm:text-xl font-black text-[#17202a]">
                Nenhum pacote encontrado
              </h3>
              <p className="mx-auto mt-1 max-w-md text-xs sm:text-sm leading-relaxed text-[#68717a]">
                {searchQuery
                  ? `Não encontramos resultados para "${searchQuery}". Tente outro termo ou limpe os filtros.`
                  : 'O catálogo para este filtro será atualizado em breve.'}
              </p>
              {(searchQuery || activeCategory !== 'all') && (
                <button
                  type="button"
                  onClick={() => { setSearchQuery(''); setActiveCategory('all'); }}
                  className="mt-4 inline-flex items-center gap-1.5 rounded-xl bg-[#142332] px-4 py-2 text-xs font-black text-white hover:bg-[#806128]"
                >
                  <X className="h-3.5 w-3.5" />
                  Limpar busca e filtros
                </button>
              )}
            </div>
          )}
        </div>
      </section>

      {/* 4. SEÇÃO "COMO FUNCIONA" */}
      <section className="border-y border-[#d6cfc3] bg-[#f8f5ee] py-8 sm:py-14">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="mb-6 text-center">
            <span className="text-[10px] font-black uppercase tracking-[0.2em] text-[#806128]">
              Processo simplificado
            </span>
            <h2 className="mt-1 text-xl sm:text-2xl font-black text-[#111820]">
              Como contratar seu pacote
            </h2>
          </div>

          <div className="grid gap-3 sm:gap-px overflow-hidden rounded-2xl border border-[#d6cfc3] bg-transparent sm:bg-[#d6cfc3] sm:grid-cols-3">
            {journey.map(({ icon: Icon, number, title, text }) => (
              <article key={number} className="rounded-xl sm:rounded-none border sm:border-0 border-[#d6cfc3] bg-white p-4 sm:p-6 shadow-2xs sm:shadow-none">
                <div className="flex items-center justify-between gap-4">
                  <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-[#142231] text-[#d8bd73] shadow-xs">
                    <Icon className="h-4 w-4" />
                  </span>
                  <span className="font-mono text-xs font-black tracking-widest text-[#9b7c33]">
                    PASSO {number}
                  </span>
                </div>
                <h3 className="mt-3 text-base sm:text-lg font-black text-[#111820]">{title}</h3>
                <p className="mt-1 text-xs sm:text-sm leading-relaxed text-[#626b74]">{text}</p>
              </article>
            ))}
          </div>
        </div>
      </section>

      {/* 5. BANNER DE CONTATO RÁPIDO & WHATSAPP */}
      <section className="border-b border-[#d6cfc3] bg-white py-8 sm:py-12 pb-24 sm:pb-16">
        <div className="mx-auto max-w-4xl px-4 text-center">
          <span className="inline-flex items-center gap-1.5 rounded-full border border-[#d8bd73]/40 bg-[#faf6ec] px-3 py-1 text-[10px] sm:text-xs font-black text-[#6d5727]">
            <Headphones className="h-3.5 w-3.5 text-[#806128]" />
            Atendimento Personalizado
          </span>
          <h2 className="mt-3 text-xl sm:text-3xl font-black text-[#111820]">
            Não encontrou exatamente o que precisa?
          </h2>
          <p className="mx-auto mt-2 max-w-xl text-xs sm:text-sm leading-relaxed text-[#59636d]">
            Montamos pacotes sob medida para demandas específicas. Fale diretamente com nossa equipe e receba uma orientação sem compromisso.
          </p>
          <div className="mt-5 flex flex-wrap items-center justify-center gap-3">
            <button
              type="button"
              onClick={onBack}
              className="inline-flex min-h-11 items-center gap-2 rounded-xl border border-[#cfc5b5] bg-[#faf8f3] px-5 py-2.5 text-xs sm:text-sm font-black text-[#17202a] shadow-xs transition hover:border-[#806128] hover:bg-white"
            >
              <ArrowLeft className="h-4 w-4" />
              Explorar outras áreas do GSA
            </button>
          </div>
        </div>
      </section>
    </main>
  );
}

