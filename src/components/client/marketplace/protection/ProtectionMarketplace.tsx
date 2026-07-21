import React, { useEffect, useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import {
  Activity, ArrowLeft, ArrowRight, BriefcaseBusiness, Building2, CalendarDays,
  Car, CheckCircle2, ChevronRight, ClipboardCheck, FileText, HeartPulse,
  HelpCircle, Home, Loader2, MessageCircle, RefreshCw, Search, ShieldCheck,
  Sparkles, Stethoscope, Umbrella, Upload, Users, WalletCards, Plus, X
} from 'lucide-react';
import { supabase } from '../../../../lib/supabase';
import { callClientRpc } from '../../../../lib/clientRpc';
import { navigate } from '../../../../routing/navigationService';
import { routes } from '../../../../routing/routeCatalog';
import { MarketplaceSubmoduleCard } from '../MarketplaceSubmoduleCard';

export type ProtectionDomain = 'saude' | 'seguros';

type ProtectionMarketplaceProps = {
  domain: ProtectionDomain;
  submodule?: string;
  itemId?: string;
  clientId?: string;
  onBackToMarketplace: () => void;
  onRequireAuth?: () => void;
};

type PublicOffer = {
  id: string;
  slug: string;
  nome: string;
  categoria: string;
  resumo?: string;
  imagem_url?: string;
  preco_referencia?: number;
  parceiro_nome?: string;
  detalhes?: Record<string, unknown>;
};

type HealthCatalogPlan = {
  id: string;
  slug: string;
  nome: string;
  descricao?: string;
  categoria: string;
  abrangencia?: string;
  estado?: string;
  acomodacao?: string;
  coparticipacao?: boolean;
  coparticipacao_descricao?: string;
  rede_destaque?: unknown;
  carencias?: unknown;
  registro_ans?: string;
  preco_estimado_min?: number;
  preco_estimado_max?: number;
  avisos?: unknown;
  operadora_nome?: string;
};

type HealthCatalogResponse = {
  success?: boolean;
  error?: string;
  planos?: HealthCatalogPlan[];
};

type DomainConfig = {
  label: string;
  eyebrow: string;
  description: string;
  accent: string;
  accentSoft: string;
  dark: string;
  icon: React.ElementType;
  publicView: string;
  heroImage: string;
  categories: {
    key: string;
    label: string;
    description: string;
    icon: React.ElementType;
    categoryLabel: string;
    image: string;
    imageAlt: string;
  }[];
};

const configs: Record<ProtectionDomain, DomainConfig> = {
  saude: {
    label: 'GSA Saúde',
    eyebrow: 'Cuidado com orientação humana',
    description: 'Compare opções de operadoras parceiras e receba acompanhamento da GSA durante a contratação.',
    accent: '#16a394', accentSoft: '#e7f8f4', dark: '#092f32', icon: HeartPulse,
    publicView: 'saude_planos_publicos',
    heroImage: '/images/marketplace/gsa-saude-hero.webp',
    categories: [
      { key: 'individual-familiar', label: 'Individual e Familiar', description: 'Proteção para você e sua família.', icon: Users, categoryLabel: 'Saúde familiar', image: '/images/marketplace/submodules/health/individual-familiar.jpg', imageAlt: 'Família reunida em um ambiente acolhedor' },
      { key: 'empresarial', label: 'Empresarial', description: 'Soluções para empresas e equipes.', icon: BriefcaseBusiness, categoryLabel: 'Empresas', image: '/images/marketplace/submodules/health/empresarial.jpg', imageAlt: 'Equipe participando de uma orientação de saúde corporativa' },
      { key: 'odontologico', label: 'Odontológico', description: 'Cuidados odontológicos acessíveis.', icon: Stethoscope, categoryLabel: 'Odontologia', image: '/images/marketplace/submodules/health/odontologico.jpg', imageAlt: 'Consulta odontológica preventiva em ambiente moderno' },
    ]
  },
  seguros: {
    label: 'GSA Seguros',
    eyebrow: 'Proteção para cada momento',
    description: 'Encontre coberturas de seguradoras parceiras com apoio da GSA da cotação ao pós-venda.',
    accent: '#3569e8', accentSoft: '#edf3ff', dark: '#0d1f46', icon: ShieldCheck,
    publicView: 'seguros_ofertas_publicas',
    heroImage: '/images/marketplace/gsa-seguros-hero.webp',
    categories: [
      { key: 'auto', label: 'Seguro Auto', description: 'Proteção para seu veículo e sua rotina.', icon: Car, categoryLabel: 'Automóvel', image: '/images/marketplace/submodules/insurance/auto.jpg', imageAlt: 'Veículo protegido em ambiente residencial' },
      { key: 'residencial', label: 'Residencial', description: 'Coberturas para sua casa.', icon: Home, categoryLabel: 'Residência', image: '/images/marketplace/submodules/insurance/residencial.jpg', imageAlt: 'Residência acolhedora e protegida ao entardecer' },
      { key: 'vida', label: 'Vida', description: 'Segurança para quem importa.', icon: Umbrella, categoryLabel: 'Família', image: '/images/marketplace/submodules/insurance/vida.jpg', imageAlt: 'Família reunida em um momento de cuidado e proteção' },
      { key: 'empresarial', label: 'Empresarial', description: 'Proteção para seu negócio.', icon: Building2, categoryLabel: 'Negócios', image: '/images/marketplace/submodules/insurance/empresarial.jpg', imageAlt: 'Empresário cuidando de seu estabelecimento' },
      { key: 'viagem', label: 'Viagem', description: 'Assistência para viajar tranquilo.', icon: CalendarDays, categoryLabel: 'Viagens', image: '/images/marketplace/submodules/insurance/viagem.jpg', imageAlt: 'Viajante preparado para embarcar com tranquilidade' },
      { key: 'outros', label: 'Outros Seguros', description: 'Converse com nossa assessoria.', icon: Sparkles, categoryLabel: 'Assessoria', image: '/images/marketplace/submodules/insurance/outros.jpg', imageAlt: 'Consultoria para escolha de proteção personalizada' },
    ]
  }
};

function money(value?: number) {
  if (value == null) return null;
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);
}

function healthCategoryForDatabase(category?: string) {
  return category ? category.replaceAll('-', '_') : null;
}

function mapHealthPlan(plan: HealthCatalogPlan): PublicOffer {
  const details = Object.fromEntries(Object.entries({
    abrangencia: plan.abrangencia,
    estado: plan.estado,
    acomodacao: plan.acomodacao,
    coparticipacao: plan.coparticipacao,
    coparticipacao_descricao: plan.coparticipacao_descricao,
    rede_destaque: plan.rede_destaque,
    carencias: plan.carencias,
    registro_ans: plan.registro_ans,
    preco_estimado_max: plan.preco_estimado_max,
    avisos: plan.avisos,
  }).filter(([, value]) => value != null && value !== ''));

  return {
    id: plan.id,
    slug: plan.slug,
    nome: plan.nome,
    categoria: plan.categoria === 'individual_familiar' ? 'individual-familiar' : plan.categoria,
    resumo: plan.descricao,
    preco_referencia: plan.preco_estimado_min,
    parceiro_nome: plan.operadora_nome,
    detalhes: details,
  };
}

function domainPath(domain: ProtectionDomain, page: string, id?: string) {
  if (domain === 'saude') {
    const health = routes.marketplace.saude;
    const map: Record<string, () => string> = {
      home: health.root, catalogo: health.planos, cotacao: health.cotacao,
      cotacoes: health.minhasCotacoes, propostas: health.minhasPropostas,
      contratos: health.meusPlanos, dependentes: health.dependentes,
      documentos: health.documentos, suporte: health.suporte,
    };
    if (page === 'oferta' && id) return health.plano(id);
    if (page === 'categoria' && id) return id === 'individual-familiar' ? health.individualFamiliar() : id === 'empresarial' ? health.empresarial() : health.odontologico();
    if (page === 'cotacao-detalhe' && id) return health.minhaCotacao(id);
    if (page === 'proposta-detalhe' && id) return health.minhaProposta(id);
    if (page === 'contrato-detalhe' && id) return health.meuPlano(id);
    if (page === 'documento-detalhe' && id) return health.documento(id);
    if (page === 'suporte-detalhe' && id) return health.ticket(id);
    return map[page]?.() || health.root();
  }
  const insurance = routes.marketplace.seguros;
  const map: Record<string, () => string> = {
    home: insurance.root, catalogo: insurance.modalidades, cotacao: insurance.cotacao,
    cotacoes: insurance.minhasCotacoes, propostas: insurance.minhasPropostas,
    contratos: insurance.minhasApolices, assistencias: insurance.assistencias,
    sinistros: insurance.sinistros, documentos: insurance.documentos, suporte: insurance.suporte,
  };
  if (page === 'oferta' && id) return insurance.oferta(id);
  if (page === 'categoria' && id) return insurance.modalidade(id);
  if (page === 'cotacao-detalhe' && id) return insurance.minhaCotacao(id);
  if (page === 'proposta-detalhe' && id) return insurance.minhaProposta(id);
  if (page === 'contrato-detalhe' && id) return insurance.minhaApolice(id);
  if (page === 'sinistro-detalhe' && id) return insurance.sinistro(id);
  if (page === 'suporte-detalhe' && id) return insurance.ticket(id);
  return map[page]?.() || insurance.root();
}

function Header({ domain, onBack }: { domain: ProtectionDomain; onBack: () => void }) {
  const c = configs[domain];
  const Icon = c.icon;
  return (
    <header className="sticky top-0 z-40 border-b border-black/5 bg-[#f8f7f3]/90 backdrop-blur-xl">
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6">
        <button onClick={onBack} className="flex items-center gap-2 rounded-full px-3 py-2 text-sm font-bold text-neutral-600 hover:bg-black/5">
          <ArrowLeft className="h-4 w-4" /> <span className="hidden sm:inline">Marketplace</span>
        </button>
        <button onClick={() => navigate(domainPath(domain, 'home'))} className="flex items-center gap-2 font-black" style={{ color: c.dark }}>
          <span className="flex h-9 w-9 items-center justify-center rounded-xl text-white" style={{ background: c.dark }}><Icon className="h-5 w-5" /></span>
          {c.label}
        </button>
        <button onClick={() => navigate(domainPath(domain, 'suporte'))} className="rounded-full border border-black/10 p-2.5 text-neutral-600 hover:bg-white" aria-label="Suporte"><MessageCircle className="h-4 w-4" /></button>
      </div>
    </header>
  );
}

function PageShell({ domain, onBack, children }: { domain: ProtectionDomain; onBack: () => void; children: React.ReactNode }) {
  return <div className="min-h-screen bg-[#f8f7f3] text-neutral-900"><Header domain={domain} onBack={onBack} />{children}</div>;
}

function StatePanel({ type, message, onRetry }: { type: 'loading' | 'empty' | 'error'; message: string; onRetry?: () => void }) {
  const Icon = type === 'loading' ? Loader2 : type === 'error' ? HelpCircle : Search;
  return (
    <div className="rounded-[2rem] border border-black/5 bg-white px-6 py-16 text-center shadow-sm">
      <Icon className={`mx-auto mb-4 h-10 w-10 text-neutral-300 ${type === 'loading' ? 'animate-spin' : ''}`} />
      <p className="mx-auto max-w-md font-bold text-neutral-700">{message}</p>
      {onRetry && <button onClick={onRetry} className="mt-5 inline-flex items-center gap-2 rounded-full bg-neutral-900 px-5 py-2.5 text-sm font-black text-white"><RefreshCw className="h-4 w-4" /> Tentar novamente</button>}
    </div>
  );
}

function AuthGate({ domain, onRequireAuth }: { domain: ProtectionDomain; onRequireAuth?: () => void }) {
  useEffect(() => { onRequireAuth?.(); }, [onRequireAuth]);
  return (
    <main className="mx-auto max-w-xl px-5 py-20 text-center">
      <div className="rounded-[2rem] bg-white p-10 shadow-xl shadow-black/5">
        <ShieldCheck className="mx-auto mb-5 h-12 w-12" style={{ color: configs[domain].accent }} />
        <h1 className="text-2xl font-black">Entre para continuar</h1>
        <p className="mt-3 text-neutral-500">Esta área contém informações pessoais e precisa de acesso autenticado.</p>
        <button onClick={onRequireAuth} className="mt-7 rounded-full px-7 py-3 font-black text-white" style={{ background: configs[domain].dark }}>Entrar ou cadastrar</button>
      </div>
    </main>
  );
}

function Hub({ domain, clientId }: { domain: ProtectionDomain; clientId?: string }) {
  const c = configs[domain];
  const Icon = c.icon;
  const imageRoot = domain === 'saude'
    ? '/images/marketplace/submodules/health'
    : '/images/marketplace/submodules/insurance';
  const actions = [
    { title: domain === 'saude' ? 'Conhecer planos' : 'Conhecer seguros', text: 'Veja as opções publicadas por parceiros.', page: 'catalogo', icon: Search, public: true, categoryLabel: 'Catálogo', image: `${imageRoot}/catalogo.jpg`, imageAlt: domain === 'saude' ? 'Especialista apresentando opções de planos de saúde' : 'Especialista apresentando opções de seguros' },
    { title: 'Solicitar cotação', text: 'Conte o que precisa e receba propostas.', page: 'cotacao', icon: ClipboardCheck, public: true, categoryLabel: 'Solicitação', image: `${imageRoot}/cotacao.jpg`, imageAlt: domain === 'saude' ? 'Consultoria para cotação de plano de saúde' : 'Consultoria para cotação de seguro' },
    { title: 'Minhas cotações', text: 'Acompanhe cada solicitação enviada.', page: 'cotacoes', icon: FileText, categoryLabel: 'Acompanhamento', image: `${imageRoot}/minhas-cotacoes.jpg`, imageAlt: 'Solicitações de cotação organizadas para acompanhamento' },
    { title: 'Minhas propostas', text: 'Compare condições antes de aceitar.', page: 'propostas', icon: WalletCards, categoryLabel: 'Comparação', image: `${imageRoot}/minhas-propostas.jpg`, imageAlt: 'Propostas organizadas para análise e comparação' },
    { title: domain === 'saude' ? 'Meus planos' : 'Minhas apólices', text: 'Consulte contratações e documentos.', page: 'contratos', icon: ShieldCheck, categoryLabel: 'Contratos', image: domain === 'saude' ? `${imageRoot}/meus-planos.jpg` : `${imageRoot}/apolices.jpg`, imageAlt: domain === 'saude' ? 'Documentos de um plano de saúde ativo' : 'Documentos de apólices de seguro ativas' },
    { title: 'Assessoria e suporte', text: 'Fale com a equipe GSA durante a jornada.', page: 'suporte', icon: MessageCircle, categoryLabel: 'Atendimento', image: `${imageRoot}/suporte.jpg`, imageAlt: domain === 'saude' ? 'Assessoria especializada em planos de saúde' : 'Assessoria especializada em seguros' },
  ];
  return (
    <main>
      <section className="relative isolate min-h-[540px] overflow-hidden px-5 py-16 sm:min-h-[570px] sm:py-24" style={{ backgroundColor: c.dark }}>
        <img src={c.heroImage} alt="" className="absolute inset-0 -z-30 h-full w-full object-cover object-[66%_center] sm:object-center" />
        <div className="absolute inset-0 -z-20 bg-black/20" />
        <div className="absolute inset-0 -z-10 bg-gradient-to-r from-black/95 via-black/75 to-black/15 sm:from-black/90 sm:via-black/65 sm:to-transparent" />
        <div className="absolute inset-0 -z-10 bg-gradient-to-t from-black/55 via-transparent to-black/20" />
        <div className="absolute -left-32 top-1/2 -z-10 h-96 w-96 -translate-y-1/2 rounded-full blur-3xl" style={{ background: `${c.accent}35` }} />
        <motion.div initial={{ opacity: 0, y: 25 }} animate={{ opacity: 1, y: 0 }} className="relative mx-auto max-w-7xl">
          <span className="inline-flex items-center gap-2 rounded-full bg-white/10 px-4 py-2 text-xs font-black uppercase tracking-[.18em] text-white/80"><Icon className="h-4 w-4" /> {c.eyebrow}</span>
          <h1 className="mt-6 max-w-4xl text-4xl font-black tracking-tight text-white sm:text-6xl">Escolhas importantes merecem clareza e acompanhamento.</h1>
          <p className="mt-5 max-w-2xl text-base font-medium leading-7 text-white/80 drop-shadow sm:text-lg">{c.description}</p>
          <div className="mt-8 flex flex-wrap gap-3">
            <button onClick={() => document.getElementById('categorias')?.scrollIntoView({ behavior: 'smooth' })} className="rounded-full bg-white px-6 py-3 font-black" style={{ color: c.dark }}>Explorar opções</button>
            <button onClick={() => navigate(domainPath(domain, 'cotacao'))} className="rounded-full border border-white/30 px-6 py-3 font-black text-white hover:bg-white/10">Pedir cotação</button>
          </div>
        </motion.div>
      </section>
      <section id="categorias" className="mx-auto max-w-7xl scroll-mt-20 px-5 py-10 sm:py-16">
        <div className="mb-8 sm:mb-12">
          <p className="text-xs font-black uppercase tracking-[.2em]" style={{ color: c.accent }}>
            {domain === 'saude' ? 'Tipos de planos' : 'Modalidades de seguros'}
          </p>
          <h2 className="mt-2 text-3xl font-black sm:text-4xl">Explore nossas categorias</h2>
          <p className="mt-3 max-w-2xl text-neutral-500">
            {domain === 'saude'
              ? 'Escolha o tipo de plano que melhor atende você, sua família ou sua empresa.'
              : 'Encontre a proteção adequada para cada momento da sua vida e do seu patrimônio.'}
          </p>
        </div>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 sm:gap-5 lg:grid-cols-3">
          {c.categories.map((category, index) => (
            <MarketplaceSubmoduleCard
              key={category.key}
              icon={category.icon}
              title={category.label}
              description={category.description}
              actionLabel="Ver opções"
              image={category.image}
              imageAlt={category.imageAlt}
              categoryLabel={category.categoryLabel}
              onClick={() => navigate(domainPath(domain, 'categoria', category.key))}
              accentColor={c.accent}
              index={index}
            />
          ))}
        </div>
      </section>
      {clientId && (
      <section className="mx-auto max-w-7xl px-5 py-10 sm:py-16">
        <div className="mb-8">
          <p className="text-xs font-black uppercase tracking-[.2em]" style={{ color: c.accent }}>Sua área GSA</p>
          <h2 className="mt-2 text-3xl font-black">Serviços e acompanhamento</h2>
        </div>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 sm:gap-5 lg:grid-cols-3">
          {actions.map((action, index) => (
            <MarketplaceSubmoduleCard
              key={action.page}
              icon={action.icon}
              title={action.title}
              description={action.text}
              actionLabel="Acessar"
              image={action.image}
              imageAlt={action.imageAlt}
              categoryLabel={action.categoryLabel}
              onClick={() => navigate(domainPath(domain, action.page))}
              accentColor={c.accent}
              index={index}
            />
          ))}
        </div>
        <p className="mt-8 rounded-2xl border border-black/5 bg-white/70 p-4 text-center text-xs font-semibold leading-5 text-neutral-500">
          A GSA atua na divulgação, orientação e assessoria. A contratação final é realizada com a operadora ou seguradora parceira. Mensalidades e prêmios são pagos diretamente à parceira e não constituem receita da GSA.
        </p>
      </section>
      )}
    </main>
  );
}

function Catalog({ domain, category, selectedSlug }: { domain: ProtectionDomain; category?: string; selectedSlug?: string }) {
  const c = configs[domain];
  const [offers, setOffers] = useState<PublicOffer[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const load = async () => {
    setLoading(true); setError('');

    if (domain === 'saude') {
      const { data, error: queryError } = await supabase.rpc('gsa_public_listar_planos_saude', {
        p_categoria: healthCategoryForDatabase(category),
        p_estado: null,
        p_acomodacao: null,
        p_coparticipacao: null,
        p_preco_min: null,
        p_preco_max: null,
        p_busca: null,
        p_pagina: 1,
        p_por_pagina: 100,
      });
      const result = data as HealthCatalogResponse | null;

      if (queryError || !result?.success) {
        setOffers([]);
        setError('Não foi possível consultar os planos agora. Tente novamente em instantes.');
      } else {
        setOffers((result.planos || []).map(mapHealthPlan));
      }
      setLoading(false);
      return;
    }

    let query = supabase.from(c.publicView).select('*').order('destaque', { ascending: false }).order('nome');
    if (category) query = query.eq('categoria', category);
    const { data, error: queryError } = await query;
    if (queryError) setError('Não foi possível consultar as opções agora. Verifique se as migrações dos módulos foram aplicadas.');
    else setOffers((data || []) as PublicOffer[]);
    setLoading(false);
  };
  useEffect(() => { void load(); }, [domain, category]);

  if (selectedSlug) {
    if (loading) return <main className="mx-auto max-w-5xl px-5 py-12"><StatePanel type="loading" message="Carregando os detalhes..." /></main>;
    if (error) return <main className="mx-auto max-w-5xl px-5 py-12"><StatePanel type="error" message={error} onRetry={load} /></main>;
    const offer = offers.find(item => item.slug === selectedSlug);
    if (!offer) return <main className="mx-auto max-w-5xl px-5 py-12"><StatePanel type="empty" message="Esta opção não está disponível ou deixou de ser publicada." /></main>;
    return <OfferDetail domain={domain} offer={offer} />;
  }

  return (
    <main className="mx-auto max-w-7xl px-5 py-10 sm:py-14">
      <div className="flex flex-col justify-between gap-5 sm:flex-row sm:items-end">
        <div><p className="text-xs font-black uppercase tracking-[.2em]" style={{ color: c.accent }}>Catálogo atualizado</p><h1 className="mt-2 text-3xl font-black sm:text-5xl">{domain === 'saude' ? 'Planos disponíveis' : 'Seguros disponíveis'}</h1><p className="mt-3 max-w-2xl text-neutral-500">Consulte informações iniciais. A disponibilidade e o valor final serão confirmados na cotação.</p></div>
        <button onClick={() => navigate(domainPath(domain, 'cotacao'))} className="rounded-full px-6 py-3 font-black text-white" style={{ background: c.dark }}>Solicitar cotação</button>
      </div>
      {!category && <div className="mt-8 flex gap-2 overflow-x-auto pb-2">{c.categories.map(cat => <button key={cat.key} onClick={() => navigate(domainPath(domain, 'categoria', cat.key))} className="whitespace-nowrap rounded-full border border-black/10 bg-white px-5 py-2.5 text-sm font-bold hover:border-black/30">{cat.label}</button>)}</div>}
      <div className="mt-8">
        {loading ? <StatePanel type="loading" message="Pesquisando opções disponíveis..." /> : error ? <StatePanel type="error" message={error} onRetry={load} /> : offers.length === 0 ? <StatePanel type="empty" message="Nenhuma opção foi cadastrada para esta categoria. Você ainda pode pedir uma cotação personalizada." /> : (
          <div className="grid gap-5 md:grid-cols-2 lg:grid-cols-3">{offers.map(offer => <OfferCard key={offer.id} offer={offer} domain={domain} />)}</div>
        )}
      </div>
    </main>
  );
}

function OfferCard({ domain, offer }: { key?: React.Key; domain: ProtectionDomain; offer: PublicOffer }) {
  const c = configs[domain];
  return <button onClick={() => navigate(domainPath(domain, 'oferta', offer.slug))} className="group overflow-hidden rounded-[1.75rem] border border-black/5 bg-white text-left shadow-sm transition hover:-translate-y-1 hover:shadow-xl">
    <div className="h-44 bg-neutral-100">{offer.imagem_url ? <img src={offer.imagem_url} alt="" className="h-full w-full object-cover transition duration-500 group-hover:scale-105" /> : <div className="flex h-full items-center justify-center" style={{ background: c.accentSoft }}><c.icon className="h-14 w-14 opacity-40" style={{ color: c.accent }} /></div>}</div>
    <div className="p-6"><span className="text-[11px] font-black uppercase tracking-[.18em]" style={{ color: c.accent }}>{offer.categoria.replaceAll('-', ' ')}</span><h2 className="mt-2 text-xl font-black">{offer.nome}</h2><p className="mt-2 line-clamp-2 text-sm leading-6 text-neutral-500">{offer.resumo || 'Consulte condições, elegibilidade e disponibilidade.'}</p>{offer.preco_referencia != null && <p className="mt-4 text-sm font-bold text-neutral-500">Referência a partir de <strong className="text-lg text-neutral-900">{money(offer.preco_referencia)}</strong></p>}<span className="mt-5 flex items-center gap-2 text-sm font-black" style={{ color: c.accent }}>Ver detalhes <ChevronRight className="h-4 w-4" /></span></div>
  </button>;
}

function OfferDetail({ domain, offer }: { domain: ProtectionDomain; offer: PublicOffer }) {
  const c = configs[domain];
  const details = offer.detalhes || {};
  return <main className="mx-auto max-w-6xl px-5 py-10"><button onClick={() => navigate(domainPath(domain, 'catalogo'))} className="mb-6 flex items-center gap-2 text-sm font-bold text-neutral-500"><ArrowLeft className="h-4 w-4" /> Voltar às opções</button><div className="overflow-hidden rounded-[2rem] bg-white shadow-xl shadow-black/5"><div className="grid lg:grid-cols-2"><div className="min-h-72" style={{ background: c.accentSoft }}>{offer.imagem_url ? <img src={offer.imagem_url} alt="" className="h-full w-full object-cover" /> : <div className="flex h-full min-h-72 items-center justify-center"><c.icon className="h-20 w-20" style={{ color: c.accent }} /></div>}</div><div className="p-7 sm:p-10"><span className="text-xs font-black uppercase tracking-[.2em]" style={{ color: c.accent }}>{offer.categoria.replaceAll('-', ' ')}</span><h1 className="mt-3 text-3xl font-black sm:text-4xl">{offer.nome}</h1><p className="mt-5 leading-7 text-neutral-600">{offer.resumo}</p>{offer.parceiro_nome && <p className="mt-5 rounded-xl bg-neutral-50 p-4 text-sm font-bold">Parceira responsável: {offer.parceiro_nome}</p>}<div className="mt-6 space-y-3">{Object.entries(details).slice(0, 6).map(([key, value]) => <div key={key} className="flex gap-3 text-sm"><CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" style={{ color: c.accent }} /><span><strong className="capitalize">{key.replaceAll('_', ' ')}:</strong> {Array.isArray(value) ? value.join(', ') : String(value)}</span></div>)}</div><button onClick={() => navigate(`${domainPath(domain, 'cotacao')}?oferta=${encodeURIComponent(offer.id)}`)} className="mt-8 w-full rounded-full py-3.5 font-black text-white" style={{ background: c.dark }}>Quero uma cotação</button></div></div></div></main>;
}

function QuoteForm({ domain, clientId, offeringSlug }: { domain: ProtectionDomain; clientId?: string; offeringSlug?: string }) {
  const c = configs[domain];
  const params = new URLSearchParams(window.location.search);
  const [step, setStep] = useState(1);
  const [sending, setSending] = useState(false);
  const [success, setSuccess] = useState<{ protocolo: string; id: string } | null>(null);
  const [error, setError] = useState('');
  const draftKey = `gsa-${domain}-cotacao-draft`;
  const [form, setForm] = useState<Record<string, string>>(() => {
    try { const saved = JSON.parse(sessionStorage.getItem(draftKey) || '{}'); return { ...saved, request_id: saved.request_id || crypto.randomUUID() }; } catch { return { request_id: crypto.randomUUID() }; }
  });
  const set = (key: string, value: string) => { setError(''); const next = { ...form, [key]: value }; setForm(next); sessionStorage.setItem(draftKey, JSON.stringify(next)); };

  const isStep1Valid = Boolean(form.categoria && form.localidade?.trim() && form.inicio_desejado);
  const isStep2Valid = domain === 'saude' 
    ? Boolean(form.idades?.trim()) 
    : Boolean(form.objeto_segurado?.trim() && form.valor_risco?.trim());

  const handleNextStep = () => {
    setError('');
    if (step === 1) {
      if (!form.categoria) return setError('Selecione a modalidade ou tipo de plano.');
      if (!form.localidade?.trim()) return setError(domain === 'saude' ? 'Informe a Cidade/UF de atendimento.' : 'Informe a Cidade/UF do risco.');
      if (!form.inicio_desejado) return setError('Informe a data desejada para iniciar.');
    }
    if (step === 2) {
      if (domain === 'saude') {
        if (!form.idades?.trim()) return setError('Informe a idade dos beneficiários.');
      } else {
        if (!form.objeto_segurado?.trim()) return setError('Informe o bem ou pessoa a proteger.');
        if (!form.valor_risco?.trim()) return setError('Informe o valor aproximado do bem ou capital.');
      }
    }
    setStep(step + 1);
  };

  const submit = async () => {
    if (!clientId) { sessionStorage.setItem(draftKey, JSON.stringify(form)); navigate(`${routes.login.root()}?returnTo=${encodeURIComponent(window.location.pathname + window.location.search)}`); return; }
    setSending(true); setError('');
    try {
      const result = await callClientRpc<any>(`gsa_client_${domain}_criar_cotacao`, { p_payload: { ...form, oferta_id: params.get('oferta'), oferta_slug: offeringSlug || null, origem: 'marketplace' }, p_idempotency_key: form.request_id });
      if (!result?.success) throw new Error(result?.error || 'Não foi possível registrar a cotação.');
      sessionStorage.removeItem(draftKey); setSuccess({ protocolo: result.protocolo, id: result.id });
    } catch (e: any) { setError(e.message || 'Não foi possível registrar a cotação.'); }
    finally { setSending(false); }
  };

  if (success) return <main className="mx-auto max-w-2xl px-5 py-16"><div className="rounded-[2rem] bg-white p-10 text-center shadow-xl"><CheckCircle2 className="mx-auto h-14 w-14" style={{ color: c.accent }} /><h1 className="mt-5 text-3xl font-black">Solicitação recebida</h1><p className="mt-3 text-neutral-500">Protocolo <strong>{success.protocolo}</strong>. A equipe GSA analisará seus dados e publicará as propostas nesta área.</p><button onClick={() => navigate(domainPath(domain, 'cotacoes'))} className="mt-7 rounded-full px-7 py-3 font-black text-white" style={{ background: c.dark }}>Acompanhar cotação</button></div></main>;
  return <main className="mx-auto max-w-3xl px-5 py-10 sm:py-14"><p className="text-xs font-black uppercase tracking-[.2em]" style={{ color: c.accent }}>Etapa {step} de 3</p><h1 className="mt-2 text-3xl font-black sm:text-5xl">Solicitar cotação</h1><div className="mt-4 h-2 overflow-hidden rounded-full bg-neutral-200"><div className="h-full transition-all" style={{ width: `${step * 33.33}%`, background: c.accent }} /></div><div className="mt-8 rounded-[2rem] bg-white p-6 shadow-sm sm:p-9">
    {step === 1 && <div className="space-y-5"><h2 className="text-xl font-black">O que você procura?</h2><Field label={domain === 'saude' ? 'Tipo de plano' : 'Modalidade do seguro'} value={form.categoria || ''} onChange={v => set('categoria', v)} options={c.categories.map(x => ({ value: x.key, label: x.label }))} required /><Field label={domain === 'saude' ? 'Cidade/UF de atendimento' : 'Cidade/UF do risco'} value={form.localidade || ''} onChange={v => set('localidade', v)} placeholder="Ex.: São Paulo / SP" required /><Field label="Quando deseja iniciar?" value={form.inicio_desejado || ''} onChange={v => set('inicio_desejado', v)} type="date" required /></div>}
    {step === 2 && <div className="space-y-5"><h2 className="text-xl font-black">Dados para calcular</h2>{domain === 'saude' ? <><Field label="Quantidade de titulares" value={form.titulares || '1'} onChange={v => set('titulares', v)} type="number" required /><Field label="Quantidade de dependentes" value={form.dependentes || '0'} onChange={v => set('dependentes', v)} type="number" /><Field label="Idades dos beneficiários" value={form.idades || ''} onChange={v => set('idades', v)} placeholder="Ex.: 35, 32, 8" required /></> : <><Field label="Bem ou pessoa a proteger" value={form.objeto_segurado || ''} onChange={v => set('objeto_segurado', v)} placeholder="Ex.: Honda Civic 2022 ou Nome da empresa" required /><Field label="Valor aproximado do bem/capital" value={form.valor_risco || ''} onChange={v => set('valor_risco', v)} placeholder="Ex.: R$ 120.000,00" required /><Field label="Uso principal" value={form.uso || ''} onChange={v => set('uso', v)} placeholder="Ex.: Pessoal / Lazer" /></>}</div>}
    {step === 3 && <div className="space-y-5"><h2 className="text-xl font-black">Preferências e autorização</h2><Field label="Observações" value={form.observacoes || ''} onChange={v => set('observacoes', v)} multiline placeholder="Escreva aqui detalhes adicionais ou preferências..." /><label className="flex gap-3 rounded-2xl bg-neutral-50 p-4 text-sm leading-6"><input type="checkbox" checked={form.consentimento === 'sim'} onChange={e => set('consentimento', e.target.checked ? 'sim' : '')} className="mt-1" /><span>Autorizo a GSA a tratar estes dados para buscar e apresentar propostas de parceiros. Entendo que a contratação e a cobrança do {domain === 'saude' ? 'plano' : 'prêmio'} ocorrerão diretamente com a {domain === 'saude' ? 'operadora' : 'seguradora'}. <strong className="text-red-500">*</strong></span></label></div>}

    {error && <p className="mt-5 rounded-2xl bg-red-50 p-4 text-sm font-bold text-red-700 border border-red-200 flex items-center gap-2">⚠️ {error}</p>}

    <div className="mt-8 flex justify-between gap-3"><button disabled={step === 1 || sending} onClick={() => { setError(''); setStep(step - 1); }} className="rounded-full border border-black/10 px-6 py-3 font-bold disabled:opacity-30">Voltar</button>{step < 3 ? <button disabled={(step === 1 && !isStep1Valid) || (step === 2 && !isStep2Valid)} onClick={handleNextStep} className="rounded-full px-7 py-3 font-black text-white disabled:opacity-40 disabled:cursor-not-allowed transition" style={{ background: c.dark }}>Continuar</button> : <button disabled={sending || form.consentimento !== 'sim'} onClick={submit} className="flex items-center gap-2 rounded-full px-7 py-3 font-black text-white disabled:opacity-40 disabled:cursor-not-allowed transition" style={{ background: c.dark }}>{sending && <Loader2 className="h-4 w-4 animate-spin" />} Enviar solicitação</button>}</div>
  </div></main>;
}

function Field({ label, value, onChange, type = 'text', placeholder, options, multiline, required }: { label: string; value: string; onChange: (v: string) => void; type?: string; placeholder?: string; options?: { value: string; label: string }[]; multiline?: boolean; required?: boolean }) {
  const cls = 'mt-2 w-full rounded-2xl border border-black/10 bg-white px-4 py-3 outline-none transition focus:border-black/30 focus:ring-4 focus:ring-black/5';
  return <label className="block text-sm font-bold text-neutral-700">{label}{required && <span className="text-red-500 font-bold ml-1">*</span>}{options ? <select value={value} onChange={e => onChange(e.target.value)} className={cls}><option value="">Selecione</option>{options.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}</select> : multiline ? <textarea value={value} onChange={e => onChange(e.target.value)} placeholder={placeholder} rows={5} className={cls} /> : <input type={type} min={type === 'number' ? 0 : undefined} value={value} onChange={e => onChange(e.target.value)} placeholder={placeholder} className={cls} /></label>;
}

const resourceLabels: Record<string, string> = { cotacoes: 'Minhas cotações', propostas: 'Minhas propostas', contratos: 'Contratações', assessorias: 'Assessoria GSA', dependentes: 'Dependentes', documentos: 'Documentos', assistencias: 'Assistências', sinistros: 'Sinistros', suporte: 'Atendimentos' };

function ClientRecords({ domain, resource, itemId, clientId }: { domain: ProtectionDomain; resource: string; itemId?: string; clientId?: string }) {
  const c = configs[domain];
  const [items, setItems] = useState<any[]>([]); const [loading, setLoading] = useState(true); const [error, setError] = useState('');
  const [working, setWorking] = useState(false); const [termsAccepted, setTermsAccepted] = useState(false);
  const load = async () => { setLoading(true); setError(''); try { const data = await callClientRpc<any[]>(`gsa_client_${domain}_listar`, { p_recurso: resource, p_item_id: itemId || null }); setItems(Array.isArray(data) ? data : []); } catch (e: any) { setError(e.message || 'Não foi possível carregar seus dados.'); } finally { setLoading(false); } };
  useEffect(() => { void load(); }, [domain, resource, itemId]);
  const title = resourceLabels[resource] || 'Acompanhamento';
  const fields = useMemo(() => itemId && items[0] ? Object.entries(items[0]).filter(([key, value]) => !['id', 'cliente_id', 'dados', 'created_at', 'updated_at'].includes(key) && value != null).slice(0, 14) : [], [items, itemId]);
  const acceptProposal = async () => { if (!itemId || !termsAccepted) return; setWorking(true); setError(''); try { await callClientRpc(`gsa_client_${domain}_aceitar_proposta`, { p_proposta_id: itemId, p_termos_versao: '2026-07-18' }); await load(); } catch (e: any) { setError(e.message || 'Não foi possível aceitar a proposta.'); } finally { setWorking(false); } };
  const uploadDocument = async (file?: File) => { if (!file || !clientId) return; setWorking(true); setError(''); try { const safeName = file.name.normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-zA-Z0-9._-]/g, '-'); const path = `${clientId}/${crypto.randomUUID()}/${safeName}`; const bucket = domain === 'saude' ? 'gsa-saude-documentos' : 'gsa-seguros-documentos'; const { error: uploadError } = await supabase.storage.from(bucket).upload(path, file, { upsert: false }); if (uploadError) throw uploadError; await callClientRpc(`gsa_client_${domain}_registrar_documento`, { p_titulo: file.name, p_tipo: 'documento_cliente', p_storage_path: path }); await load(); } catch (e: any) { setError(e.message || 'Não foi possível enviar o documento.'); } finally { setWorking(false); } };
  const detailPage: Record<string, string> = { cotacoes: 'cotacao-detalhe', propostas: 'proposta-detalhe', contratos: 'contrato-detalhe', documentos: 'documento-detalhe', sinistros: 'sinistro-detalhe', suporte: 'suporte-detalhe' };
  return <main className="mx-auto max-w-6xl px-5 py-10"><div className="flex items-end justify-between gap-4"><div><p className="text-xs font-black uppercase tracking-[.2em]" style={{ color: c.accent }}>Área segura</p><h1 className="mt-2 text-3xl font-black sm:text-5xl">{itemId ? 'Detalhes' : title}</h1></div><div className="flex gap-2">{resource === 'cotacoes' && <button onClick={() => navigate(domainPath(domain, 'cotacao'))} className="rounded-full px-5 py-3 text-sm font-black text-white" style={{ background: c.dark }}>Nova cotação</button>}{resource === 'documentos' && <label className="flex cursor-pointer items-center gap-2 rounded-full px-5 py-3 text-sm font-black text-white" style={{ background: c.dark }}><Upload className="h-4 w-4" /> {working ? 'Enviando...' : 'Enviar documento'}<input type="file" accept="application/pdf,image/jpeg,image/png,image/webp" disabled={working} onChange={e => void uploadDocument(e.target.files?.[0])} className="hidden" /></label>}</div></div>{domain === 'seguros' && !itemId && (resource === 'assistencias' || resource === 'sinistros') && <InsuranceOccurrenceForm type={resource === 'assistencias' ? 'assistencia' : 'sinistro'} onSaved={load} color={c.accent} dark={c.dark} />}<div className="mt-8">{loading ? <StatePanel type="loading" message="Carregando seus dados..." /> : error && items.length === 0 ? <StatePanel type="error" message={error} onRetry={load} /> : items.length === 0 ? <StatePanel type="empty" message={`Você ainda não possui registros em ${title.toLowerCase()}.`} /> : itemId ? <div className="rounded-[2rem] bg-white p-7 shadow-sm"><div className="flex items-center justify-between"><h2 className="text-xl font-black">{items[0].protocolo || items[0].numero || items[0].titulo || 'Registro'}</h2><Status value={items[0].status} color={c.accent} /></div><div className="mt-7 grid gap-4 sm:grid-cols-2">{fields.map(([key, value]) => <div key={key} className="rounded-2xl bg-neutral-50 p-4"><p className="text-[10px] font-black uppercase tracking-wider text-neutral-400">{key.replaceAll('_', ' ')}</p><p className="mt-1 font-bold">{typeof value === 'object' ? JSON.stringify(value) : String(value)}</p></div>)}</div>{resource === 'propostas' && ['enviada', 'visualizada'].includes(items[0].status) && <div className="mt-7 rounded-2xl border p-5" style={{ borderColor: `${c.accent}40`, background: `${c.accent}08` }}><label className="flex gap-3 text-sm leading-6"><input type="checkbox" checked={termsAccepted} onChange={e => setTermsAccepted(e.target.checked)} className="mt-1" /><span>Li e aceito as condições desta proposta. Estou ciente de que {domain === 'saude' ? 'a mensalidade será paga diretamente à operadora' : 'o prêmio será pago diretamente à seguradora'} e que uma eventual taxa de assessoria GSA aparece separadamente.</span></label><button disabled={!termsAccepted || working} onClick={acceptProposal} className="mt-5 flex items-center gap-2 rounded-full px-6 py-3 font-black text-white disabled:opacity-40" style={{ background: c.dark }}>{working && <Loader2 className="h-4 w-4 animate-spin" />} Aceitar proposta</button></div>}{error && <p className="mt-5 rounded-xl bg-red-50 p-4 text-sm font-bold text-red-700">{error}</p>}</div> : <div className="grid gap-4">{items.map(item => <button key={item.id} onClick={() => detailPage[resource] && navigate(domainPath(domain, detailPage[resource], item.id))} className="flex items-center justify-between rounded-2xl border border-black/5 bg-white p-5 text-left shadow-sm hover:shadow-md"><div><p className="font-black">{item.protocolo || item.numero || item.titulo || item.nome || `Registro ${String(item.id).slice(0, 8)}`}</p><p className="mt-1 text-sm text-neutral-500">{item.created_at ? new Date(item.created_at).toLocaleDateString('pt-BR') : 'Atualizado recentemente'}</p></div><div className="flex items-center gap-3"><Status value={item.status} color={c.accent} />{detailPage[resource] && <ChevronRight className="h-5 w-5 text-neutral-300" />}</div></button>)}</div>}</div></main>;
}

function Status({ value, color }: { value?: string; color: string }) { return <span className="rounded-full px-3 py-1 text-[10px] font-black uppercase tracking-wider" style={{ background: `${color}16`, color }}>{(value || 'ativo').replaceAll('_', ' ')}</span>; }

function InsuranceOccurrenceForm({ type, onSaved, color, dark }: { type: 'assistencia' | 'sinistro'; onSaved: () => Promise<void>; color: string; dark: string }) {
  const [open, setOpen] = useState(false); const [policies, setPolicies] = useState<any[]>([]); const [policy, setPolicy] = useState(''); const [description, setDescription] = useState(''); const [kind, setKind] = useState(''); const [sending, setSending] = useState(false); const [error, setError] = useState('');
  useEffect(() => { if (open) callClientRpc<any[]>('gsa_client_seguros_listar', { p_recurso: 'contratos', p_item_id: null }).then(setPolicies).catch(e => setError(e.message)); }, [open]);
  const submit = async () => { setSending(true); setError(''); try { await callClientRpc('gsa_client_seguros_criar_ocorrencia', { p_tipo: type, p_apolice_id: policy, p_payload: { tipo: kind, descricao: description, ocorrido_em: new Date().toISOString() } }); setOpen(false); setDescription(''); setKind(''); await onSaved(); } catch (e: any) { setError(e.message || 'Não foi possível registrar a solicitação.'); } finally { setSending(false); } };
  if (!open) return <button onClick={() => setOpen(true)} className="mt-7 flex items-center gap-2 rounded-full px-5 py-3 text-sm font-black text-white" style={{ background: dark }}><Plus className="h-4 w-4" /> {type === 'assistencia' ? 'Solicitar assistência' : 'Comunicar sinistro'}</button>;
  return <div className="mt-7 rounded-[2rem] border border-black/5 bg-white p-6 shadow-sm"><div className="flex items-center justify-between"><h2 className="text-xl font-black">{type === 'assistencia' ? 'Nova assistência' : 'Comunicar sinistro'}</h2><button onClick={() => setOpen(false)}><X className="h-5 w-5" /></button></div><div className="mt-5 grid gap-4 sm:grid-cols-2"><label className="text-sm font-bold">Apólice<select value={policy} onChange={e => setPolicy(e.target.value)} className="mt-2 w-full rounded-xl border border-black/10 px-4 py-3"><option value="">Selecione</option>{policies.filter(p => p.status === 'ativo').map(p => <option key={p.id} value={p.id}>{p.numero || p.titulo}</option>)}</select></label><Field label={type === 'assistencia' ? 'Tipo de assistência' : 'Tipo de ocorrência'} value={kind} onChange={setKind} /><div className="sm:col-span-2"><Field label="Descrição" value={description} onChange={setDescription} multiline /></div></div>{error && <p className="mt-4 rounded-xl bg-red-50 p-3 text-sm font-bold text-red-700">{error}</p>}<button disabled={sending || !policy || !description.trim()} onClick={submit} className="mt-5 flex items-center gap-2 rounded-full px-6 py-3 font-black text-white disabled:opacity-40" style={{ background: color }}>{sending && <Loader2 className="h-4 w-4 animate-spin" />} Registrar</button></div>;
}

function Support({ domain }: { domain: ProtectionDomain }) {
  const c = configs[domain]; const [subject, setSubject] = useState(''); const [message, setMessage] = useState(''); const [sending, setSending] = useState(false); const [done, setDone] = useState(''); const [error, setError] = useState('');
  const send = async () => { setSending(true); setError(''); try { const result = await callClientRpc<any>(`gsa_client_${domain}_abrir_atendimento`, { p_assunto: subject, p_mensagem: message }); if (!result?.success) throw new Error(result?.error); setDone(result.protocolo); setSubject(''); setMessage(''); } catch (e: any) { setError(e.message || 'Não foi possível abrir o atendimento.'); } finally { setSending(false); } };
  return <main className="mx-auto grid max-w-6xl gap-6 px-5 py-10 lg:grid-cols-[1fr_.8fr]"><div className="rounded-[2rem] bg-white p-7 shadow-sm"><p className="text-xs font-black uppercase tracking-[.2em]" style={{ color: c.accent }}>Atendimento GSA</p><h1 className="mt-2 text-3xl font-black">Como podemos ajudar?</h1><div className="mt-7 space-y-5"><Field label="Assunto" value={subject} onChange={setSubject} /><Field label="Mensagem" value={message} onChange={setMessage} multiline />{error && <p className="rounded-xl bg-red-50 p-3 text-sm font-bold text-red-700">{error}</p>}{done && <p className="rounded-xl bg-emerald-50 p-3 text-sm font-bold text-emerald-700">Atendimento aberto. Protocolo: {done}</p>}<button disabled={sending || !subject.trim() || !message.trim()} onClick={send} className="flex items-center gap-2 rounded-full px-7 py-3 font-black text-white disabled:opacity-40" style={{ background: c.dark }}>{sending && <Loader2 className="h-4 w-4 animate-spin" />} Enviar</button></div></div><div className="rounded-[2rem] p-7 text-white" style={{ background: c.dark }}><HelpCircle className="h-10 w-10 opacity-70" /><h2 className="mt-5 text-2xl font-black">Assessoria de verdade</h2><p className="mt-3 leading-7 text-white/70">A GSA acompanha dúvidas, documentos e comunicação com a parceira. Uma eventual taxa de assessoria só será cobrada quando previamente informada e aceita.</p><button onClick={() => navigate(domainPath(domain, 'suporte'))} className="mt-7 rounded-full bg-white/10 px-5 py-3 text-sm font-black hover:bg-white/20">Ver meus atendimentos</button></div></main>;
}

export function ProtectionMarketplace({ domain, submodule = 'home', itemId, clientId, onBackToMarketplace, onRequireAuth }: ProtectionMarketplaceProps) {
  const isPublic = ['home', 'planos', 'modalidades', 'plano-detalhe', 'oferta-detalhe'].includes(submodule) || submodule.startsWith('planos-') || submodule.startsWith('modalidade-') || submodule === 'cotacao';
  let content: React.ReactNode;
  if (!clientId && !isPublic) content = <AuthGate domain={domain} onRequireAuth={onRequireAuth} />;
  else if (submodule === 'home') content = <Hub domain={domain} clientId={clientId} />;
  else if (submodule === 'cotacao') content = <QuoteForm domain={domain} clientId={clientId} offeringSlug={itemId} />;
  else if (submodule === 'planos' || submodule === 'modalidades') content = <Catalog domain={domain} />;
  else if (submodule.startsWith('planos-')) content = <Catalog domain={domain} category={submodule.replace('planos-', '')} />;
  else if (submodule.startsWith('modalidade-')) content = <Catalog domain={domain} category={submodule.replace('modalidade-', '')} />;
  else if ((submodule === 'plano-detalhe' || submodule === 'oferta-detalhe') && itemId) content = <Catalog domain={domain} selectedSlug={itemId} />;
  else if (submodule === 'suporte' && !itemId) content = <><Support domain={domain} /><ClientRecords domain={domain} resource="suporte" clientId={clientId} /></>;
  else {
    const resourceMap: Record<string, string> = { 'minhas-cotacoes': 'cotacoes', 'minhas-propostas': 'propostas', 'meus-planos': 'contratos', 'minhas-apolices': 'contratos', dependentes: 'dependentes', documentos: 'documentos', assistencias: 'assistencias', sinistros: 'sinistros', suporte: 'suporte', assessoria: 'assessorias' };
    content = <ClientRecords domain={domain} resource={resourceMap[submodule] || submodule} itemId={itemId} clientId={clientId} />;
  }
  return <PageShell domain={domain} onBack={onBackToMarketplace}>{content}</PageShell>;
}
