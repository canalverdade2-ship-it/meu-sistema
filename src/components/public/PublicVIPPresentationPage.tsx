import { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Crown, Star, ShieldCheck, Zap, ArrowLeft, Sparkles, Trophy, Gift,
  Check, ArrowRight, ChevronDown, Award, Gem, Medal, CheckCircle2,
  UserPlus, LogIn, BadgePercent, Wallet, Headphones, Package,
  BarChart3, Users, TrendingUp, Coins, Flame, Shield, Clock,
  CreditCard, Percent, ShoppingBag, Tag, ChevronRight, HeartHandshake,
  HelpCircle, MessageCircle, Layers, Lock, RefreshCcw, CheckCircle,
  Sliders, Smartphone, Plane, Wrench, Search, Building2, Wifi,
  ExternalLink, Sparkle, ShoppingCart, Award as AwardIcon, CheckSquare
} from 'lucide-react';
import { VIP_LEVELS, VIPLevel } from '../../constants';
import { routes } from '../../routing/routeCatalog';
import { navigate } from '../../routing/navigationService';

interface PublicVIPPresentationPageProps {
  onBack?: () => void;
  clientId?: string;
}

/* ─── Níveis & Configurações Visuais de Alta Fidelidade ───────────────────── */
const LEVEL_CONFIG: Record<string, {
  name: string;
  badge: string;
  color: string;
  borderGlow: string;
  cardBg: string;
  textColor: string;
  accentBg: string;
  accentBorder: string;
  icon: any;
  cardStyle: string;
  gradientText: string;
}> = {
  basico: {
    name: 'Básico',
    badge: 'Adesão Gratuita',
    color: '#94a3b8',
    borderGlow: 'rgba(148, 163, 184, 0.4)',
    cardBg: 'linear-gradient(135deg, #1e293b 0%, #0f172a 100%)',
    textColor: '#f8fafc',
    accentBg: '#f1f5f9',
    accentBorder: '#cbd5e1',
    icon: Medal,
    cardStyle: 'border-slate-600 shadow-slate-900/40',
    gradientText: 'from-slate-300 via-slate-100 to-slate-400',
  },
  bronze: {
    name: 'Bronze',
    badge: 'Iniciante VIP',
    color: '#d97706',
    borderGlow: 'rgba(217, 119, 6, 0.45)',
    cardBg: 'linear-gradient(135deg, #451a03 0%, #291205 60%, #1e0d04 100%)',
    textColor: '#fef3c7',
    accentBg: '#fef3c7',
    accentBorder: '#fcd34d',
    icon: Award,
    cardStyle: 'border-amber-700 shadow-amber-950/50',
    gradientText: 'from-amber-400 via-amber-200 to-amber-500',
  },
  prata: {
    name: 'Prata',
    badge: 'Crescimento',
    color: '#94a3b8',
    borderGlow: 'rgba(203, 213, 225, 0.5)',
    cardBg: 'linear-gradient(135deg, #334155 0%, #1e293b 50%, #0f172a 100%)',
    textColor: '#ffffff',
    accentBg: '#f1f5f9',
    accentBorder: '#94a3b8',
    icon: Star,
    cardStyle: 'border-slate-400 shadow-slate-800/50',
    gradientText: 'from-slate-200 via-white to-slate-300',
  },
  ouro: {
    name: 'Ouro',
    badge: 'Mais Popular',
    color: '#f59e0b',
    borderGlow: 'rgba(245, 158, 11, 0.6)',
    cardBg: 'linear-gradient(135deg, #78350f 0%, #451a03 50%, #1c0a00 100%)',
    textColor: '#fffbeb',
    accentBg: '#fef3c7',
    accentBorder: '#fbbf24',
    icon: Crown,
    cardStyle: 'border-amber-500 shadow-amber-900/60 ring-2 ring-amber-400/30',
    gradientText: 'from-amber-300 via-yellow-200 to-amber-400',
  },
  diamante: {
    name: 'Diamante',
    badge: 'Categoria Elite',
    color: '#0284c7',
    borderGlow: 'rgba(14, 165, 233, 0.6)',
    cardBg: 'linear-gradient(135deg, #0c4a6e 0%, #072e44 60%, #031b28 100%)',
    textColor: '#f0f9ff',
    accentBg: '#e0f2fe',
    accentBorder: '#7dd3fc',
    icon: Gem,
    cardStyle: 'border-sky-400 shadow-sky-950/60 ring-2 ring-sky-400/40',
    gradientText: 'from-sky-300 via-cyan-100 to-sky-400',
  },
  black: {
    name: 'Black VIP',
    badge: 'Nível Supremo & Exclusivo',
    color: '#fbbf24',
    borderGlow: 'rgba(251, 191, 36, 0.7)',
    cardBg: 'linear-gradient(135deg, #09090b 0%, #18181b 40%, #000000 100%)',
    textColor: '#ffffff',
    accentBg: '#18181b',
    accentBorder: '#fbbf24',
    icon: Trophy,
    cardStyle: 'border-amber-400 shadow-2xl shadow-amber-500/20 ring-2 ring-amber-400',
    gradientText: 'from-amber-300 via-yellow-100 to-amber-500',
  },
};

/* ─── Estatísticas em Destaque ───────────────────────────────────────────── */
const HERO_STATS = [
  { value: '6', suffix: 'Níveis', label: 'Evolução progressiva de vantagens' },
  { value: '5×', suffix: 'Pontos', label: 'Por cada R$ 1,00 gasto (Black VIP)' },
  { value: '0%', suffix: 'Taxa', label: 'Isenção total no saque via PIX' },
  { value: '15%', suffix: 'OFF', label: 'Desconto extra direto no carrinho' },
];

/* ─── 8 Grandes Benefícios do Clube VIP ──────────────────────────────────── */
const VIP_PERKS = [
  {
    icon: BadgePercent,
    title: 'Descontos VIP no Marketplace',
    desc: 'Economize de 2% a 15% de desconto adicional acumulativo em milhares de produtos, serviços e viagens.',
    tag: 'Até 15% OFF',
    accent: '#f59e0b',
    bg: '#fffbeb',
    border: '#fde68a',
  },
  {
    icon: Zap,
    title: 'Multiplicador Turbo de Pontos',
    desc: 'Ganhe de 0,5× até 5× pontos a cada compra no ecossistema GSA. Seus pontos nunca perdem a validade.',
    tag: 'Até 5× Pontos',
    accent: '#10b981',
    bg: '#f0fdf4',
    border: '#a7f3d0',
  },
  {
    icon: Wallet,
    title: 'Resgate em Dinheiro via PIX',
    desc: 'Converta seus pontos em dinheiro vivo direto na sua conta bancária sem burocracia e com taxa zero no topo.',
    tag: 'PIX na Conta',
    accent: '#3b82f6',
    bg: '#eff6ff',
    border: '#bfdbfe',
  },
  {
    icon: Package,
    title: 'Frete Reduzido & Despacho Turbo',
    desc: 'Condições especiais de entrega com frete reduzido ou grátis e separação prioritária no centro de distribuição.',
    tag: 'Entrega Ágil',
    accent: '#ec4899',
    bg: '#fdf2f8',
    border: '#fbcfe8',
  },
  {
    icon: Clock,
    title: 'Acesso Antecipado a Ofertas',
    desc: 'Compre 2 horas antes de todo mundo em lançamentos, liquidações de estoque e na Black Friday GSA.',
    tag: '2h de Vantagem',
    accent: '#8b5cf6',
    bg: '#f5f3ff',
    border: '#ddd6fe',
  },
  {
    icon: Headphones,
    title: 'Concierge & Suporte Prioritário',
    desc: 'Fila exclusiva de atendimento no WhatsApp com gerente de conta dedicado para resolução imediata.',
    tag: 'WhatsApp VIP',
    accent: '#06b6d4',
    bg: '#ecfeff',
    border: '#a5f3fc',
  },
  {
    icon: Gift,
    title: 'Presente & Vouchers no Aniversário',
    desc: 'Receba cupons bônus, presentes exclusivos e vouchers de parceiros durante todo o mês do seu aniversário.',
    tag: 'Mimo no Seu Mês',
    accent: '#f97316',
    bg: '#fff7ed',
    border: '#fed7aa',
  },
  {
    icon: RefreshCcw,
    title: 'Garantia & Troca Fácil em 30 Dias',
    desc: 'Logística reversa simplificada sem perguntas, prioridade de reembolso e 30 dias para trocas no marketplace.',
    tag: 'Sem Burocracia',
    accent: '#6366f1',
    bg: '#eef2ff',
    border: '#c7d2fe',
  },
];

/* ─── Showcase de Economia Real no Marketplace ────────────────────────────── */
const MARKETPLACE_DEALS_SHOWCASE = [
  {
    id: 1,
    category: 'Eletrônicos & Tech',
    name: 'Smartphone Pro Max 256GB 5G Câmera Tripla',
    image: 'https://images.unsplash.com/photo-1511707171634-5f897ff02aa9?w=500&auto=format&fit=crop&q=80',
    regularPrice: 4299.00,
    vipDiscountPct: 15,
    pointsGain: 18270,
    tag: 'Mais Vendido',
  },
  {
    id: 2,
    category: 'Viagens & Turismo',
    name: 'Pacote Nordeste 5 Dias Resort All Inclusive + Aéreo',
    image: 'https://images.unsplash.com/photo-1507525428034-b723cf961d3e?w=500&auto=format&fit=crop&q=80',
    regularPrice: 2890.00,
    vipDiscountPct: 15,
    pointsGain: 12282,
    tag: 'Experiência VIP',
  },
  {
    id: 3,
    category: 'Serviços Especializados',
    name: 'Higienização e Manutenção Completa Residencial / Predial',
    image: 'https://images.unsplash.com/photo-1581578731548-c64695cc6952?w=500&auto=format&fit=crop&q=80',
    regularPrice: 480.00,
    vipDiscountPct: 15,
    pointsGain: 2040,
    tag: 'Garantia GSA',
  },
  {
    id: 4,
    category: 'Casa & Smart Living',
    name: 'Smart TV 55" 4K UHD HDR Processador IA Dolby Vision',
    image: 'https://images.unsplash.com/photo-1593359677879-a4bb92f829d1?w=500&auto=format&fit=crop&q=80',
    regularPrice: 2799.00,
    vipDiscountPct: 15,
    pointsGain: 11895,
    tag: 'Oferta Relâmpago',
  },
];

/* ─── Depoimentos de Membros Reais ────────────────────────────────────────── */
const TESTIMONIALS = [
  {
    name: 'Marcelo Silveira',
    role: 'Empresário no Ramo de Tecnologia',
    city: 'São Paulo - SP',
    avatar: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=150&auto=format&fit=crop&q=80',
    level: 'Black VIP',
    levelColor: '#fbbf24',
    rating: 5,
    headline: 'Já resgatei mais de R$ 2.400 direto no PIX!',
    quote: 'Uso o marketplace da GSA para compras da empresa e serviços de escritório. O multiplicador de 5× do nível Black acumula pontos absurdamente rápido. O resgate no PIX cai no mesmo dia.',
    savings: 'R$ 4.850,00 economizados no ano',
  },
  {
    name: 'Camila Rodrigues',
    role: 'Arquiteta & Designer de Interiores',
    city: 'Curitiba - PR',
    avatar: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=150&auto=format&fit=crop&q=80',
    level: 'Diamante VIP',
    levelColor: '#38bdf8',
    rating: 5,
    headline: 'Os descontos acumulativos nos pacotes de viagem são imbatíveis.',
    quote: 'Comprei duas viagens em família e renovei equipamentos com 10% de desconto exclusivo e frete grátis. O atendimento VIP no WhatsApp resolve qualquer dúvida em 2 minutos.',
    savings: 'R$ 3.290,00 economizados no ano',
  },
  {
    name: 'Eduardo Guimarães',
    role: 'Gestor Comercial & Consultor',
    city: 'Belo Horizonte - MG',
    avatar: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=150&auto=format&fit=crop&q=80',
    level: 'Ouro VIP',
    levelColor: '#f59e0b',
    rating: 5,
    headline: 'Comecei no gratuito e em 2 meses já estava no Ouro.',
    quote: 'Não tem pegadinha nem taxa oculta. Você vai comprando o que já precisava, acumula pontos que nunca expiram e vê o saldo crescer no painel. É o programa mais transparente do Brasil.',
    savings: 'R$ 1.940,00 economizados no ano',
  },
];

/* ─── Perguntas Frequentes ────────────────────────────────────────────────── */
const FAQS = [
  {
    category: 'geral',
    q: 'O cadastro no Programa VIP GSA é realmente gratuito?',
    a: 'Sim, 100% gratuito! Ao criar sua conta no ecossistema GSA você já inicia automaticamente no nível Básico com direito ao acúmulo de pontos, acompanhamento de evolução e acesso a ofertas exclusivas. Não há nenhuma taxa de anuidade ou mensalidade obrigatória.',
  },
  {
    category: 'pontos',
    q: 'Como funcionam os pontos e os multiplicadores?',
    a: 'A cada R$ 1,00 gasto em compras de produtos no marketplace, pacotes de viagens ou contratações de serviços, você recebe pontos multiplicados de acordo com o seu nível atual (de 0,5× no Básico até 5× no Black VIP). Seus pontos nunca expiram e ficam salvos na sua carteira digital.',
  },
  {
    category: 'pix',
    q: 'Como funciona o resgate de pontos em dinheiro via PIX?',
    a: 'Você pode converter seus pontos acumulados em saldo em reais diretamente no seu Painel VIP. Basta cadastrar sua chave PIX e solicitar a transferência. A taxa de saque é progressivamente reduzida de 5% no nível Básico até 0% (totalmente isento) no nível Black VIP.',
  },
  {
    category: 'niveis',
    q: 'Como faço para subir de nível no Programa VIP?',
    a: 'Seu nível sobe automaticamente à medida que você acumula pontos pelas suas compras e atividades no GSA HUB. Você também pode utilizar seus próprios pontos acumulados para adquirir um upgrade instantâneo para o próximo nível a qualquer momento pelo painel.',
  },
  {
    category: 'descontos',
    q: 'Os descontos VIP são aplicados na hora da compra?',
    a: 'Sim! Ao fazer login na loja com sua conta de membro VIP, os preços com desconto exclusivo do seu nível (até 15% OFF) já são refletidos diretamente na listagem e no carrinho, de forma 100% automática.',
  },
  {
    category: 'seguranca',
    q: 'Existe algum período de fidelidade ou contrato de permanência?',
    a: 'Não! O Programa VIP GSA é livre de fidelidade e multas. Você aproveita todas as vantagens pelo tempo que desejar e seus pontos acumulados continuam sendo seu patrimônio vitalício no ecossistema GSA.',
  },
];

export function PublicVIPPresentationPage({ onBack, clientId }: PublicVIPPresentationPageProps) {
  const [selectedLevel, setSelectedLevel] = useState<string>('ouro');
  const [simulatedSpend, setSimulatedSpend] = useState<number>(2000);
  const [openFaq, setOpenFaq] = useState<number | null>(0);
  const [faqFilter, setFaqFilter] = useState<string>('todos');
  const [faqSearch, setFaqSearch] = useState<string>('');
  const [stickyVisible, setStickyVisible] = useState(false);
  const heroRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const obs = new IntersectionObserver(([e]) => setStickyVisible(!e.isIntersecting), { threshold: 0.1 });
    if (heroRef.current) obs.observe(heroRef.current);
    return () => obs.disconnect();
  }, []);

  const goRegister = () => navigate(`${routes.login.personal()}?mode=register`);
  const goLogin = () => navigate(routes.login.personal());
  const goBack = () => (onBack ? onBack() : navigate(routes.marketplace.root()));
  const goDashboard = () => navigate(routes.client.loyalty.vip());
  const scrollToSection = (id: string) => {
    const el = document.getElementById(id);
    if (el) el.scrollIntoView({ behavior: 'smooth' });
  };

  const currentLevel = VIP_LEVELS.find(l => l.id === selectedLevel) || VIP_LEVELS[3];
  const currentConfig = LEVEL_CONFIG[selectedLevel] || LEVEL_CONFIG.ouro;
  const LevelIcon = currentConfig.icon;

  // Cálculos do simulador
  const pointsMonth = Math.round(simulatedSpend * currentLevel.multiplier);
  const yearlyPts = pointsMonth * 12;
  const yearlyCashGross = yearlyPts / 100;
  const feeDiscount = (yearlyCashGross * (currentLevel.feePercentage / 100));
  const yearlyCashNet = yearlyCashGross - feeDiscount;
  const yearlyDiscountSavings = simulatedSpend * 12 * (currentLevel.discountPercentage / 100);
  const totalAnnualBenefit = yearlyCashNet + yearlyDiscountSavings;

  // Filtragem de FAQ
  const filteredFaqs = FAQS.filter(faq => {
    const matchCategory = faqFilter === 'todos' || faq.category === faqFilter;
    const matchSearch = !faqSearch || faq.q.toLowerCase().includes(faqSearch.toLowerCase()) || faq.a.toLowerCase().includes(faqSearch.toLowerCase());
    return matchCategory && matchSearch;
  });

  return (
    <div className="min-h-screen bg-[#070b14] text-slate-100 font-sans antialiased selection:bg-amber-400 selection:text-slate-950">

      {/* ── TOP ANNOUNCEMENT TICKER ── */}
      <aside aria-label="Aviso de promoção VIP" className="bg-gradient-to-r from-amber-600 via-amber-500 to-yellow-500 px-4 py-2 text-center text-xs font-black text-slate-950 shadow-md">
        <div className="mx-auto flex max-w-7xl items-center justify-center gap-2">
          <Sparkles size={14} className="animate-spin text-slate-950 shrink-0" style={{ animationDuration: '4s' }} />
          <span>
            <strong>BÔNUS EXCLUSIVO DE HOJE:</strong> Cadastre-se gratuitamente agora e ganhe <strong>500 Pontos VIP</strong> de boas-vindas na sua conta!
          </span>
          <button 
            onClick={goRegister}
            className="hidden sm:inline-flex items-center gap-1 underline underline-offset-2 hover:text-white transition-colors cursor-pointer ml-2"
          >
            Garantir bônus agora <ChevronRight size={13} />
          </button>
        </div>
      </aside>

      {/* ── STICKY GLASS NAVBAR ── */}
      <header className="sticky top-0 z-50 border-b border-slate-800/80 bg-[#0a101d]/90 backdrop-blur-md">
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
          
          {/* Back & Logo */}
          <div className="flex items-center gap-4 sm:gap-6">
            <button
              onClick={goBack}
              className="group flex items-center gap-1.5 rounded-xl border border-slate-800 bg-slate-900/80 px-3 py-1.5 text-xs font-semibold text-slate-300 transition-all hover:border-slate-700 hover:bg-slate-800 hover:text-white cursor-pointer"
              title="Retornar à Loja Marketplace"
            >
              <ArrowLeft size={15} className="transition-transform group-hover:-translate-x-0.5 text-amber-400" />
              <span className="hidden md:inline">Voltar ao Marketplace</span>
              <span className="md:hidden">Voltar</span>
            </button>

            <div className="flex items-center gap-3">
              <div className="relative flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-amber-400 via-amber-500 to-yellow-600 p-0.5 shadow-lg shadow-amber-500/20">
                <div className="flex h-full w-full items-center justify-center rounded-[10px] bg-[#0c1427]">
                  <Crown size={20} className="fill-amber-400 text-amber-400" />
                </div>
              </div>
              <div className="leading-tight">
                <div className="flex items-center gap-1.5">
                  <span className="text-base font-black tracking-tight text-white">GSA HUB</span>
                  <span className="rounded-md bg-gradient-to-r from-amber-400 to-yellow-500 px-1.5 py-0.5 text-[10px] font-black uppercase tracking-wider text-slate-950">
                    VIP CLUB
                  </span>
                </div>
                <p className="text-[11px] font-medium text-slate-400 hidden sm:block">Programa de Fidelidade & Cashback</p>
              </div>
            </div>
          </div>

          {/* Quick Nav Links (Desktop) */}
          <nav className="hidden lg:flex items-center gap-6 text-xs font-bold text-slate-300">
            <button onClick={() => scrollToSection('como-funciona')} className="hover:text-amber-400 transition-colors cursor-pointer">
              Como Funciona
            </button>
            <button onClick={() => scrollToSection('beneficios')} className="hover:text-amber-400 transition-colors cursor-pointer">
              Benefícios
            </button>
            <button onClick={() => scrollToSection('ofertas-vip')} className="hover:text-amber-400 transition-colors cursor-pointer flex items-center gap-1">
              <Flame size={13} className="text-amber-400" /> Ofertas VIP
            </button>
            <button onClick={() => scrollToSection('niveis')} className="hover:text-amber-400 transition-colors cursor-pointer">
              Níveis & Comparativo
            </button>
            <button onClick={() => scrollToSection('simulador')} className="hover:text-amber-400 transition-colors cursor-pointer">
              Simulador
            </button>
            <button onClick={() => scrollToSection('faq')} className="hover:text-amber-400 transition-colors cursor-pointer">
              Dúvidas
            </button>
          </nav>

          {/* User CTA Action */}
          <div className="flex items-center gap-2.5">
            {clientId ? (
              <button
                onClick={goDashboard}
                className="group flex items-center gap-2 rounded-xl bg-gradient-to-r from-amber-500 to-yellow-500 px-4 py-2 text-xs font-black text-slate-950 shadow-md shadow-amber-500/20 transition-all hover:brightness-110 active:scale-95 cursor-pointer"
              >
                <Trophy size={14} className="transition-transform group-hover:rotate-12" />
                <span>Acessar Meu Painel VIP</span>
              </button>
            ) : (
              <>
                <button
                  onClick={goLogin}
                  className="hidden sm:flex items-center gap-1.5 rounded-xl border border-slate-700 bg-slate-900/60 px-4 py-2 text-xs font-bold text-slate-200 transition-colors hover:border-slate-500 hover:bg-slate-800 hover:text-white cursor-pointer"
                >
                  <LogIn size={14} className="text-amber-400" />
                  <span>Já Tenho Conta</span>
                </button>
                <button
                  onClick={goRegister}
                  className="relative group overflow-hidden flex items-center gap-2 rounded-xl bg-gradient-to-r from-amber-400 via-amber-500 to-yellow-500 px-4 sm:px-5 py-2 sm:py-2.5 text-xs font-black text-slate-950 shadow-lg shadow-amber-500/25 transition-all hover:scale-[1.03] hover:shadow-amber-500/40 active:scale-95 cursor-pointer"
                >
                  <UserPlus size={14} />
                  <span>Cadastrar Grátis</span>
                  <div className="absolute inset-0 -translate-x-full group-hover:translate-x-full transition-transform duration-1000 bg-gradient-to-r from-transparent via-white/30 to-transparent" />
                </button>
              </>
            )}
          </div>
        </div>
      </header>

      {/* ── HERO SECTION — ULTRA PREMIUM MARKETPLACE STYLE ── */}
      <section
        ref={heroRef}
        className="relative overflow-hidden bg-gradient-to-b from-[#0c1427] via-[#09101f] to-[#070b14] pt-12 pb-20 sm:pt-16 sm:pb-28 border-b border-slate-800"
      >
        {/* Glow ambient meshes */}
        <div className="pointer-events-none absolute -top-40 left-1/4 h-[550px] w-[550px] rounded-full bg-amber-500/10 blur-[130px]" />
        <div className="pointer-events-none absolute top-1/3 -right-40 h-[600px] w-[600px] rounded-full bg-blue-600/10 blur-[140px]" />
        <div className="pointer-events-none absolute inset-0 opacity-[0.03]"
          style={{ backgroundImage: 'radial-gradient(circle at 1px 1px, white 1px, transparent 0)', backgroundSize: '32px 32px' }}
        />

        <div className="relative mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 gap-12 lg:grid-cols-12 lg:items-center">

            {/* Left Hero Content (7 Cols) */}
            <div className="space-y-6 lg:col-span-7">

              {/* Tag pill */}
              <div className="inline-flex items-center gap-2 rounded-full border border-amber-400/40 bg-amber-400/10 px-3.5 py-1.5 shadow-inner">
                <Crown size={14} className="fill-amber-400 text-amber-400 animate-pulse" />
                <span className="text-[11px] font-black uppercase tracking-wider text-amber-400">
                  O Clube de Vantagens Mais Completo do E-commerce
                </span>
              </div>

              {/* Headline */}
              <h1 className="text-3xl sm:text-5xl lg:text-6xl font-black tracking-tight text-white leading-[1.1]">
                Economize mais e ganhe{' '}
                <span className="text-transparent bg-clip-text bg-gradient-to-r from-amber-300 via-amber-400 to-yellow-200">
                  dinheiro de volta
                </span>{' '}
                em toda compra no GSA
              </h1>

              {/* Description */}
              <p className="max-w-xl text-base sm:text-lg text-slate-300 leading-relaxed">
                Transforme cada compra de produtos, viagens e serviços em <strong className="text-amber-400 font-bold">saldo real via PIX</strong>, descontos cumulativos de até <strong className="text-white font-bold">15% OFF</strong> e frete prioritário. Adesão <strong className="text-emerald-400 font-bold">100% gratuita</strong> e sem mensalidades.
              </p>

              {/* Badges pills */}
              <div className="flex flex-wrap gap-2.5 pt-1">
                {[
                  '✓ Adesão 100% Gratuita',
                  '✓ Pontos que Nunca Expiram',
                  '✓ Resgate em PIX na Conta',
                  '✓ Até 15% OFF Extra',
                ].map((item, i) => (
                  <span
                    key={i}
                    className="inline-flex items-center rounded-lg border border-slate-700/80 bg-slate-900/60 px-3 py-1.5 text-xs font-semibold text-slate-200"
                  >
                    {item}
                  </span>
                ))}
              </div>

              {/* CTAs */}
              <div className="flex flex-col sm:flex-row gap-3.5 pt-2">
                <button
                  onClick={goRegister}
                  className="group relative overflow-hidden flex items-center justify-center gap-3 rounded-2xl bg-gradient-to-r from-amber-400 via-amber-500 to-yellow-500 px-8 py-4 text-base font-black text-slate-950 shadow-xl shadow-amber-500/25 transition-all hover:scale-[1.02] hover:shadow-amber-500/40 active:scale-95 cursor-pointer"
                >
                  <span>Cadastrar Gratuitamente Agora</span>
                  <ArrowRight size={18} className="transition-transform group-hover:translate-x-1.5 text-slate-950" />
                  <div className="absolute inset-0 -translate-x-full group-hover:translate-x-full transition-transform duration-1000 bg-gradient-to-r from-transparent via-white/30 to-transparent" />
                </button>
                <button
                  onClick={() => scrollToSection('simulador')}
                  className="flex items-center justify-center gap-2 rounded-2xl border border-slate-700 bg-slate-800/60 px-7 py-4 text-sm font-bold text-white transition-all hover:border-slate-500 hover:bg-slate-800 cursor-pointer"
                >
                  <BarChart3 size={17} className="text-amber-400" />
                  <span>Simular Minha Economia</span>
                </button>
              </div>

              {/* Social Proof Bar */}
              <div className="flex flex-wrap items-center gap-4 pt-4 border-t border-slate-800/80 text-xs text-slate-400">
                <div className="flex -space-x-2 overflow-hidden">
                  <img className="inline-block h-8 w-8 rounded-full ring-2 ring-slate-900 object-cover" src="https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=100&auto=format&fit=crop&q=80" alt="Membro VIP" />
                  <img className="inline-block h-8 w-8 rounded-full ring-2 ring-slate-900 object-cover" src="https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=100&auto=format&fit=crop&q=80" alt="Membro VIP" />
                  <img className="inline-block h-8 w-8 rounded-full ring-2 ring-slate-900 object-cover" src="https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=100&auto=format&fit=crop&q=80" alt="Membro VIP" />
                  <img className="inline-block h-8 w-8 rounded-full ring-2 ring-slate-900 object-cover" src="https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=100&auto=format&fit=crop&q=80" alt="Membro VIP" />
                </div>
                <div>
                  <div className="flex items-center gap-1 text-amber-400">
                    <Star size={13} className="fill-amber-400" />
                    <Star size={13} className="fill-amber-400" />
                    <Star size={13} className="fill-amber-400" />
                    <Star size={13} className="fill-amber-400" />
                    <Star size={13} className="fill-amber-400" />
                    <span className="font-black text-white ml-1">4.9/5</span>
                  </div>
                  <p className="text-[11px] text-slate-400">Mais de <strong>14.800 membros</strong> ativos e economizando</p>
                </div>
                <div className="hidden sm:flex items-center gap-2 pl-2 border-l border-slate-800 text-emerald-400 text-[11px] font-semibold">
                  <span className="relative flex h-2 w-2">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                    <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
                  </span>
                  +128 novos membros aderiram hoje
                </div>
              </div>
            </div>

            {/* Right Hero Content: 3D Holographic Dynamic VIP Card Showcase (5 Cols) */}
            <div className="lg:col-span-5 flex flex-col items-center">
              
              {/* Level Quick Selector Switcher */}
              <div className="w-full max-w-sm mb-4">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-[11px] font-black uppercase tracking-wider text-slate-400">
                    Selecione um nível para testar:
                  </span>
                  <span className="text-[10px] font-bold text-amber-400 bg-amber-400/10 px-2 py-0.5 rounded-full border border-amber-400/20">
                    Interativo
                  </span>
                </div>
                <div className="grid grid-cols-6 gap-1 bg-slate-900/90 p-1 rounded-xl border border-slate-800">
                  {VIP_LEVELS.map((lvl) => {
                    const active = selectedLevel === lvl.id;
                    const conf = LEVEL_CONFIG[lvl.id];
                    return (
                      <button
                        key={lvl.id}
                        onClick={() => setSelectedLevel(lvl.id)}
                        className={`rounded-lg py-1.5 text-[10px] font-black transition-all cursor-pointer ${
                          active
                            ? 'bg-gradient-to-r from-amber-400 to-yellow-500 text-slate-950 shadow-md scale-105'
                            : 'text-slate-400 hover:text-white hover:bg-slate-800/80'
                        }`}
                        title={`Visualizar cartão ${lvl.name}`}
                      >
                        {lvl.name.slice(0, 3)}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* The Physical Card Container */}
              <div className="relative w-full max-w-sm">
                
                {/* Ambient glow behind card */}
                <div
                  className="absolute inset-0 rounded-3xl blur-2xl opacity-50 transition-all duration-500"
                  style={{ backgroundColor: currentConfig.color }}
                />

                {/* Stacked background card effect for depth */}
                <div className="absolute -top-3 left-3 right-3 h-48 rounded-2xl bg-slate-800/40 border border-slate-700/50 backdrop-blur-sm -rotate-2 transform transition-transform" />
                <div className="absolute -top-1 left-1 right-1 h-52 rounded-2xl bg-slate-800/60 border border-slate-700/60 backdrop-blur-sm rotate-1 transform transition-transform" />

                {/* Main Dynamic VIP Holographic Card */}
                <AnimatePresence mode="wait">
                  <motion.div
                    key={selectedLevel}
                    initial={{ opacity: 0, scale: 0.95, y: 10 }}
                    animate={{ opacity: 1, scale: 1, y: 0 }}
                    exit={{ opacity: 0, scale: 0.95, y: -10 }}
                    transition={{ duration: 0.25 }}
                    style={{ background: currentConfig.cardBg }}
                    className={`relative overflow-hidden rounded-2xl border-2 p-6 shadow-2xl transition-all ${currentConfig.cardStyle}`}
                  >
                    {/* Metallic sheen overlay */}
                    <div className="pointer-events-none absolute inset-0 bg-gradient-to-tr from-white/0 via-white/10 to-white/0 opacity-60" />
                    
                    {/* Holographic sparkle top-right */}
                    <div className="absolute -right-8 -top-8 h-28 w-28 rounded-full bg-white/10 blur-xl" />

                    {/* Card Top Row: EMV Chip + Logo */}
                    <div className="flex items-start justify-between">
                      <div className="flex items-center gap-3">
                        {/* Realistic Smart Chip */}
                        <div className="relative flex h-8 w-11 items-center justify-center rounded-md bg-gradient-to-br from-amber-200 via-amber-400 to-yellow-600 shadow-inner border border-amber-300/60">
                          <div className="h-4 w-6 border-y border-amber-800/40 opacity-70" />
                          <div className="absolute h-full w-2 border-x border-amber-800/40 opacity-70" />
                        </div>
                        {/* Contactless waves */}
                        <Wifi size={18} className="text-white/60 -rotate-90" />
                      </div>

                      {/* Level Crest Badge */}
                      <div className="flex items-center gap-1.5 rounded-full border border-white/20 bg-black/40 px-3 py-1 backdrop-blur-md">
                        <LevelIcon size={14} style={{ color: currentConfig.color }} />
                        <span className="text-[11px] font-black uppercase tracking-wider text-white">
                          {currentLevel.name} VIP
                        </span>
                      </div>
                    </div>

                    {/* Card Middle: Cardholder Name & VIP Title */}
                    <div className="mt-8">
                      <p className="text-[9px] font-black uppercase tracking-widest text-white/50">
                        Cartão de Membro Oficial
                      </p>
                      <h2 className="text-xl sm:text-2xl font-black tracking-tight text-white mt-0.5">
                        {clientId ? 'MEMBRO VIP ATIVO' : 'SEU NOME AQUI'}
                      </h2>
                      <p className="text-xs font-mono tracking-widest text-white/60 mt-1">
                        •••• •••• •••• 2026
                      </p>
                    </div>

                    {/* Card Bottom Row: Perks & Multiplier Live Badges */}
                    <div className="mt-6 flex items-end justify-between border-t border-white/15 pt-4">
                      <div>
                        <p className="text-[9px] font-bold uppercase tracking-wider text-white/50">Multiplicador</p>
                        <p className="text-base font-black text-amber-400">
                          {currentLevel.multiplier}× Pontos
                        </p>
                      </div>
                      <div className="text-center">
                        <p className="text-[9px] font-bold uppercase tracking-wider text-white/50">Desconto Extra</p>
                        <p className="text-base font-black text-emerald-400">
                          {currentLevel.discountPercentage}% OFF
                        </p>
                      </div>
                      <div className="text-right">
                        <p className="text-[9px] font-bold uppercase tracking-wider text-white/50">Taxa Saque PIX</p>
                        <p className="text-base font-black text-sky-400">
                          {currentLevel.feePercentage}%
                        </p>
                      </div>
                    </div>
                  </motion.div>
                </AnimatePresence>

                {/* Card footer description */}
                <div className="mt-3 text-center">
                  <p className="text-[11px] text-slate-400">
                    Badge de nível: <strong className="text-amber-400">{currentConfig.badge}</strong> · Sem custos de emissão
                  </p>
                </div>
              </div>
            </div>

          </div>
        </div>
      </section>

      {/* ── BARRA DE DESTAQUES & MÉTRICAS (GRID DE IMPACTO) ── */}
      <section className="relative z-10 -mt-10 mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 sm:gap-5">
          {HERO_STATS.map((stat, i) => (
            <div
              key={i}
              className="group relative overflow-hidden rounded-2xl border border-slate-800 bg-[#0d1629]/90 p-5 shadow-xl backdrop-blur-xl transition-all hover:border-amber-500/50 hover:bg-[#101b33] hover:-translate-y-1"
            >
              <div className="flex items-baseline gap-1">
                <span className="text-3xl sm:text-4xl font-black text-transparent bg-clip-text bg-gradient-to-r from-amber-400 to-yellow-200">
                  {stat.value}
                </span>
                <span className="text-xs font-bold text-amber-400/80">{stat.suffix}</span>
              </div>
              <p className="mt-1 text-xs font-medium text-slate-400 leading-snug">
                {stat.label}
              </p>
              <div className="absolute bottom-0 left-0 right-0 h-1 bg-gradient-to-r from-transparent via-amber-400/30 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
            </div>
          ))}
        </div>
      </section>

      {/* ── COMO FUNCIONA O PROGRAMA VIP (PASSO A PASSO GAMIFICADO) ── */}
      <section id="como-funciona" className="py-20 sm:py-28 bg-[#070b14]">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          
          <div className="text-center max-w-3xl mx-auto mb-16">
            <div className="inline-flex items-center gap-2 rounded-full border border-amber-400/30 bg-amber-400/10 px-3 py-1 mb-3">
              <Sparkles size={12} className="text-amber-400" />
              <span className="text-[10px] font-black uppercase tracking-widest text-amber-400">
                Jornada Simples & Transparente
              </span>
            </div>
            <h2 className="text-3xl sm:text-4xl font-black text-white tracking-tight">
              Como funciona o <span className="text-amber-400">GSA VIP</span> em 4 passos
            </h2>
            <p className="mt-3 text-sm sm:text-base text-slate-400 leading-relaxed">
              Sem burocracia ou termos complicados. Cada compra aproxima você de maiores descontos e mais dinheiro na sua conta.
            </p>
          </div>

          <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4 relative">
            
            {[
              {
                step: '01',
                title: 'Cadastre-se Gratuitamente',
                desc: 'Crie sua conta em menos de 30 segundos. Você já inicia no nível Básico e ganha bônus de boas-vindas.',
                icon: UserPlus,
                accent: '#f59e0b',
              },
              {
                step: '02',
                title: 'Compre no Marketplace',
                desc: 'Adquira produtos, passagens, pacotes de viagens ou contrate serviços profissionais com desconto.',
                icon: ShoppingBag,
                accent: '#10b981',
              },
              {
                step: '03',
                title: 'Multiplique seus Pontos',
                desc: 'Acumule até 5× mais pontos a cada R$ 1,00 gasto. Seus pontos caem na hora e nunca expiram.',
                icon: Coins,
                accent: '#3b82f6',
              },
              {
                step: '04',
                title: 'Resgate em PIX ou Desconto',
                desc: 'Transfira o dinheiro direto para seu banco via PIX ou use o saldo para abater 100% de novas compras.',
                icon: Wallet,
                accent: '#ec4899',
              },
            ].map((st, i) => (
              <div
                key={i}
                className="group relative overflow-hidden rounded-2xl border border-slate-800 bg-[#0d1629] p-6 transition-all hover:border-slate-700 hover:bg-[#101b33] hover:-translate-y-1 shadow-lg"
              >
                <div className="flex items-center justify-between mb-4">
                  <div
                    className="flex h-12 w-12 items-center justify-center rounded-xl border"
                    style={{ backgroundColor: `${st.accent}15`, borderColor: `${st.accent}40`, color: st.accent }}
                  >
                    <st.icon size={22} />
                  </div>
                  <span className="text-3xl font-black text-slate-700 group-hover:text-amber-400 transition-colors">
                    {st.step}
                  </span>
                </div>
                <h3 className="text-base font-black text-white mb-2">{st.title}</h3>
                <p className="text-xs text-slate-400 leading-relaxed">{st.desc}</p>
                <div
                  className="absolute bottom-0 left-0 right-0 h-1 transition-all"
                  style={{ backgroundColor: st.accent }}
                />
              </div>
            ))}
          </div>

          <div className="mt-12 text-center">
            <button
              onClick={goRegister}
              className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-amber-400 to-yellow-500 px-8 py-3.5 text-xs font-black text-slate-950 shadow-lg shadow-amber-500/20 transition-all hover:brightness-110 active:scale-95 cursor-pointer"
            >
              <span>Começar Minha Jornada Grátis</span>
              <ArrowRight size={15} />
            </button>
          </div>
        </div>
      </section>

      {/* ── SHOWCASE DE OFERTAS & ECONOMIA NO MARKETPLACE ── */}
      <section id="ofertas-vip" className="py-20 bg-[#0a101d] border-y border-slate-800">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          
          <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 mb-12">
            <div>
              <div className="inline-flex items-center gap-1.5 text-xs font-black uppercase tracking-wider text-amber-400 mb-2">
                <Flame size={14} className="text-amber-400" />
                Vantagem em Compras Reais
              </div>
              <h2 className="text-2xl sm:text-3xl font-black text-white">
                Veja quanto você economiza como <span className="text-amber-400">Membro VIP</span>
              </h2>
              <p className="text-xs sm:text-sm text-slate-400 mt-1">
                Comparativo de preços reais com desconto exclusivo e pontuação turbinada.
              </p>
            </div>
            <button
              onClick={goBack}
              className="inline-flex items-center gap-1.5 text-xs font-bold text-amber-400 hover:text-amber-300 transition-colors cursor-pointer"
            >
              <span>Explorar todo o marketplace</span>
              <ChevronRight size={14} />
            </button>
          </div>

          <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4">
            {MARKETPLACE_DEALS_SHOWCASE.map((item) => {
              const vipPrice = item.regularPrice * (1 - item.vipDiscountPct / 100);
              const savings = item.regularPrice - vipPrice;

              return (
                <div
                  key={item.id}
                  className="group relative overflow-hidden rounded-2xl border border-slate-800 bg-[#0d1629] p-4 transition-all hover:border-amber-500/40 hover:shadow-xl hover:-translate-y-1"
                >
                  {/* Image & Tag */}
                  <div className="relative h-44 w-full overflow-hidden rounded-xl bg-slate-900 mb-4">
                    <img
                      src={item.image}
                      alt={item.name}
                      className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
                    />
                    <div className="absolute top-2 left-2 rounded-md bg-amber-400 px-2 py-0.5 text-[10px] font-black uppercase tracking-wider text-slate-950 shadow-md">
                      {item.tag}
                    </div>
                    <div className="absolute top-2 right-2 rounded-md bg-black/70 backdrop-blur-md px-2 py-0.5 text-[10px] font-black text-emerald-400 border border-emerald-400/30">
                      -{item.vipDiscountPct}% VIP
                    </div>
                  </div>

                  {/* Category & Title */}
                  <p className="text-[10px] font-bold uppercase tracking-wider text-amber-400/90">{item.category}</p>
                  <h3 className="text-sm font-bold text-white line-clamp-2 mt-1 min-h-[40px]">
                    {item.name}
                  </h3>

                  {/* Price comparison */}
                  <div className="mt-4 rounded-xl bg-slate-950/70 p-3 border border-slate-800/80">
                    <div className="flex items-center justify-between text-[11px] text-slate-400">
                      <span>Preço Comum:</span>
                      <span className="line-through">
                        {item.regularPrice.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                      </span>
                    </div>
                    <div className="mt-1 flex items-baseline justify-between">
                      <span className="text-xs font-black text-amber-400 uppercase">Preço VIP:</span>
                      <span className="text-lg font-black text-white">
                        {vipPrice.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                      </span>
                    </div>
                    <div className="mt-1.5 flex items-center justify-between pt-1.5 border-t border-slate-800/60 text-[10px]">
                      <span className="font-bold text-emerald-400">
                        Economia: {savings.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                      </span>
                      <span className="font-bold text-amber-400 flex items-center gap-0.5">
                        <Coins size={11} /> +{item.pointsGain.toLocaleString('pt-BR')} pts
                      </span>
                    </div>
                  </div>

                  {/* CTA */}
                  <button
                    onClick={goRegister}
                    className="mt-3 w-full rounded-xl bg-slate-800 py-2.5 text-xs font-bold text-slate-200 transition-all hover:bg-amber-400 hover:text-slate-950 cursor-pointer"
                  >
                    Quero Desconto VIP
                  </button>
                </div>
              );
            })}
          </div>

          <div className="mt-8 rounded-2xl bg-gradient-to-r from-amber-500/10 via-amber-500/5 to-transparent p-4 border border-amber-500/20 flex flex-col sm:flex-row items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-amber-400/20 text-amber-400">
                <Gift size={20} />
              </div>
              <p className="text-xs text-slate-300">
                <strong className="text-white">Descontos aplicados automaticamente no carrinho</strong> para todos os clientes cadastrados. Sem necessidade de cupons complicados.
              </p>
            </div>
            <button
              onClick={goRegister}
              className="shrink-0 rounded-xl bg-amber-400 px-5 py-2 text-xs font-black text-slate-950 transition-all hover:bg-amber-300 cursor-pointer"
            >
              Criar Conta Grátis
            </button>
          </div>
        </div>
      </section>

      {/* ── 8 GRANDES BENEFÍCIOS DO CLUBE VIP ── */}
      <section id="beneficios" className="py-20 sm:py-28 bg-[#070b14]">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          
          <div className="text-center max-w-3xl mx-auto mb-16">
            <div className="inline-flex items-center gap-2 rounded-full border border-amber-400/30 bg-amber-400/10 px-3 py-1 mb-3">
              <Crown size={12} className="text-amber-400" />
              <span className="text-[10px] font-black uppercase tracking-widest text-amber-400">
                Vantagens de Grandes Marketplaces
              </span>
            </div>
            <h2 className="text-3xl sm:text-4xl font-black text-white tracking-tight">
              8 Motivos para você fazer parte do <span className="text-amber-400">Clube VIP</span>
            </h2>
            <p className="mt-3 text-sm sm:text-base text-slate-400 leading-relaxed">
              Criado para retribuir sua preferência com benefícios tangíveis e dinheiro no seu bolso.
            </p>
          </div>

          <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4">
            {VIP_PERKS.map((perk, i) => (
              <div
                key={i}
                className="group relative overflow-hidden rounded-2xl border border-slate-800/80 bg-[#0d1629] p-6 transition-all hover:border-slate-700 hover:bg-[#101b33] hover:-translate-y-1 shadow-lg"
              >
                <div className="flex items-center justify-between mb-4">
                  <div
                    className="flex h-12 w-12 items-center justify-center rounded-xl border transition-transform group-hover:scale-110"
                    style={{ backgroundColor: perk.bg, borderColor: perk.border, color: perk.accent }}
                  >
                    <perk.icon size={24} />
                  </div>
                  <span
                    className="rounded-full px-2.5 py-1 text-[10px] font-black uppercase tracking-wider"
                    style={{ backgroundColor: `${perk.accent}20`, color: perk.accent }}
                  >
                    {perk.tag}
                  </span>
                </div>

                <h3 className="text-base font-black text-white mb-2">{perk.title}</h3>
                <p className="text-xs text-slate-400 leading-relaxed">{perk.desc}</p>

                <div
                  className="absolute bottom-0 left-0 right-0 h-1 transition-all"
                  style={{ backgroundColor: perk.accent }}
                />
              </div>
            ))}
          </div>

        </div>
      </section>

      {/* ── NÍVEIS & COMPARATIVO COMPLETO ── */}
      <section id="niveis" className="py-20 sm:py-28 bg-[#0a101d] border-y border-slate-800">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          
          <div className="text-center max-w-3xl mx-auto mb-14">
            <div className="inline-flex items-center gap-2 rounded-full border border-amber-400/30 bg-amber-400/10 px-3 py-1 mb-3">
              <Trophy size={12} className="text-amber-400" />
              <span className="text-[10px] font-black uppercase tracking-widest text-amber-400">
                Evolução & Privilégios
              </span>
            </div>
            <h2 className="text-3xl sm:text-4xl font-black text-white tracking-tight">
              Compare os 6 Níveis do <span className="text-amber-400">Programa VIP</span>
            </h2>
            <p className="mt-3 text-sm sm:text-base text-slate-400 leading-relaxed">
              Você sobe de nível automaticamente ao acumular pontos. Veja o que cada nível destrava.
            </p>
          </div>

          {/* Level Tabs Switcher */}
          <div className="mb-10 flex flex-wrap justify-center gap-2">
            {VIP_LEVELS.map((lvl) => {
              const lm = LEVEL_CONFIG[lvl.id];
              const LIcon = lm.icon;
              const active = selectedLevel === lvl.id;

              return (
                <button
                  key={lvl.id}
                  onClick={() => setSelectedLevel(lvl.id)}
                  className={`flex items-center gap-2 rounded-xl border px-4 py-2.5 text-xs font-black transition-all cursor-pointer ${
                    active
                      ? 'bg-gradient-to-r from-amber-400 to-yellow-500 text-slate-950 shadow-lg shadow-amber-500/20 scale-105 border-amber-300'
                      : 'border-slate-800 bg-[#0d1629] text-slate-300 hover:border-slate-700 hover:text-white'
                  }`}
                >
                  <LIcon size={15} />
                  <span>{lvl.name} VIP</span>
                  {lvl.id === 'ouro' && (
                    <span className={`text-[9px] px-1.5 py-0.2 rounded-full font-bold ${active ? 'bg-slate-950 text-amber-400' : 'bg-amber-400/20 text-amber-400'}`}>
                      Popular
                    </span>
                  )}
                  {lvl.id === 'black' && (
                    <span className={`text-[9px] px-1.5 py-0.2 rounded-full font-bold ${active ? 'bg-slate-950 text-amber-400' : 'bg-purple-400/20 text-purple-300'}`}>
                      Top
                    </span>
                  )}
                </button>
              );
            })}
          </div>

          {/* Selected Level Spotlight Card */}
          <AnimatePresence mode="wait">
            <motion.div
              key={selectedLevel}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.2 }}
              className="mx-auto max-w-4xl overflow-hidden rounded-3xl border border-slate-700/80 bg-[#0d1629] shadow-2xl"
            >
              {/* Header */}
              <div
                style={{ background: currentConfig.cardBg }}
                className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-6 p-6 sm:p-8 border-b border-slate-700"
              >
                <div className="flex items-center gap-4">
                  <div
                    className="flex h-16 w-16 items-center justify-center rounded-2xl border-2 shadow-xl"
                    style={{ backgroundColor: `${currentConfig.color}20`, borderColor: currentConfig.color }}
                  >
                    <LevelIcon size={32} style={{ color: currentConfig.color }} />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-[11px] font-black uppercase tracking-widest text-slate-300">
                        Nível de Membro
                      </span>
                      <span
                        className="rounded-full px-2.5 py-0.5 text-[10px] font-black uppercase"
                        style={{ backgroundColor: `${currentConfig.color}30`, color: currentConfig.color }}
                      >
                        {currentConfig.badge}
                      </span>
                    </div>
                    <h3 className="text-2xl sm:text-3xl font-black text-white mt-1">
                      {currentLevel.name} VIP
                    </h3>
                    <p className="text-xs text-slate-300 mt-0.5">
                      Faixa: <strong>{currentLevel.minPoints.toLocaleString('pt-BR')}</strong> até{' '}
                      <strong>{currentLevel.maxPoints ? currentLevel.maxPoints.toLocaleString('pt-BR') : '∞'} pontos</strong>
                    </p>
                  </div>
                </div>

                <div className="flex gap-4 sm:gap-6 bg-black/40 backdrop-blur-md p-3.5 rounded-2xl border border-white/10">
                  <div className="text-center">
                    <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Multiplicador</p>
                    <p className="text-xl sm:text-2xl font-black text-amber-400">{currentLevel.multiplier}×</p>
                  </div>
                  <div className="text-center border-x border-white/10 px-4">
                    <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Desconto</p>
                    <p className="text-xl sm:text-2xl font-black text-emerald-400">{currentLevel.discountPercentage}%</p>
                  </div>
                  <div className="text-center">
                    <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Taxa Saque</p>
                    <p className="text-xl sm:text-2xl font-black text-sky-400">{currentLevel.feePercentage}%</p>
                  </div>
                </div>
              </div>

              {/* Benefits Grid */}
              <div className="grid grid-cols-1 sm:grid-cols-2 divide-y sm:divide-y-0 sm:divide-x divide-slate-800 bg-[#0d1629]">
                <div className="p-6 sm:p-8">
                  <p className="mb-4 flex items-center gap-2 text-xs font-black uppercase tracking-wider text-slate-300">
                    <CheckCircle2 size={16} className="text-emerald-400" /> Benefícios Inclusos
                  </p>
                  <ul className="space-y-3">
                    {currentLevel.benefits.map((b, i) => (
                      <li key={i} className="flex items-start gap-2.5 text-xs text-slate-300">
                        <Check size={14} className="mt-0.5 shrink-0 text-emerald-400" />
                        <span>{b}</span>
                      </li>
                    ))}
                  </ul>
                </div>

                <div className="p-6 sm:p-8 bg-[#09101f]">
                  <p className="mb-4 flex items-center gap-2 text-xs font-black uppercase tracking-wider text-slate-300">
                    <Sparkles size={16} className="text-amber-400" /> Exclusividades deste Nível
                  </p>
                  <ul className="space-y-3">
                    {currentLevel.exclusiveBenefits.length > 0 ? (
                      currentLevel.exclusiveBenefits.map((b, i) => (
                        <li key={i} className="flex items-start gap-2.5 text-xs font-semibold text-white">
                          <Star size={14} className="mt-0.5 shrink-0 fill-amber-400 text-amber-400" />
                          <span>{b}</span>
                        </li>
                      ))
                    ) : (
                      <li className="text-xs text-slate-500 italic">
                        Inicie sua jornada no nível gratuito e acumule pontos para destravar vantagens exclusivas.
                      </li>
                    )}
                  </ul>
                </div>
              </div>

              {/* Footer CTA */}
              <div className="flex flex-col sm:flex-row items-center justify-between gap-4 bg-slate-950 p-6 border-t border-slate-800">
                <div className="text-center sm:text-left">
                  <p className="text-xs font-bold text-white">Pronto para ser {currentLevel.name} VIP?</p>
                  <p className="text-[11px] text-slate-400">Adesão gratuita com upgrade progressivo por compras.</p>
                </div>
                <button
                  onClick={goRegister}
                  className="w-full sm:w-auto flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-amber-400 to-yellow-500 px-6 py-3 text-xs font-black text-slate-950 shadow-md transition-all hover:brightness-110 active:scale-95 cursor-pointer"
                >
                  <span>Garantir Meu Acesso VIP</span>
                  <ArrowRight size={14} />
                </button>
              </div>
            </motion.div>
          </AnimatePresence>

          {/* Full Side-by-Side Comparison Table */}
          <div className="mt-14 overflow-x-auto rounded-3xl border border-slate-800 bg-[#0d1629] shadow-xl">
            <table className="min-w-full text-xs">
              <thead>
                <tr className="border-b border-slate-800 bg-slate-950/80">
                  <th className="px-6 py-4 text-left font-black uppercase tracking-wider text-slate-400">Nível</th>
                  <th className="px-6 py-4 text-left font-black uppercase tracking-wider text-slate-400">Faixa de Pontos</th>
                  <th className="px-6 py-4 text-left font-black uppercase tracking-wider text-slate-400">Multiplicador</th>
                  <th className="px-6 py-4 text-left font-black uppercase tracking-wider text-slate-400">Desconto Extra</th>
                  <th className="px-6 py-4 text-left font-black uppercase tracking-wider text-slate-400">Taxa Saque PIX</th>
                  <th className="px-6 py-4 text-right font-black uppercase tracking-wider text-slate-400">Ação</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60">
                {VIP_LEVELS.map((lvl) => {
                  const conf = LEVEL_CONFIG[lvl.id];
                  const LIcon = conf.icon;
                  const isSelected = selectedLevel === lvl.id;

                  return (
                    <tr
                      key={lvl.id}
                      onClick={() => setSelectedLevel(lvl.id)}
                      className={`cursor-pointer transition-colors ${
                        isSelected ? 'bg-amber-400/10' : 'hover:bg-slate-800/40'
                      }`}
                    >
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-2.5">
                          <LIcon size={16} style={{ color: conf.color }} />
                          <span className={`font-black text-sm ${isSelected ? 'text-amber-400' : 'text-white'}`}>
                            {lvl.name} VIP
                          </span>
                          {isSelected && (
                            <span className="rounded-full bg-amber-400/20 px-2 py-0.5 text-[10px] font-black text-amber-400">
                              Ativo
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="px-6 py-4 text-slate-300 font-mono">
                        {lvl.minPoints.toLocaleString('pt-BR')} — {lvl.maxPoints ? lvl.maxPoints.toLocaleString('pt-BR') : '∞'} pts
                      </td>
                      <td className="px-6 py-4 font-black text-amber-400 text-sm">
                        {lvl.multiplier}×
                      </td>
                      <td className="px-6 py-4 font-black text-emerald-400 text-sm">
                        {lvl.discountPercentage}% OFF
                      </td>
                      <td className="px-6 py-4 font-black text-sky-400 text-sm">
                        {lvl.feePercentage}%
                      </td>
                      <td className="px-6 py-4 text-right">
                        <button
                          onClick={(e) => { e.stopPropagation(); setSelectedLevel(lvl.id); }}
                          className={`rounded-lg px-3 py-1 text-[11px] font-black transition-all cursor-pointer ${
                            isSelected
                              ? 'bg-amber-400 text-slate-950'
                              : 'bg-slate-800 text-slate-300 hover:bg-slate-700 hover:text-white'
                          }`}
                        >
                          {isSelected ? 'Visualizando' : 'Ver Detalhes'}
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

        </div>
      </section>

      {/* ── CALCULADORA & SIMULADOR DE ECONOMIA EM TEMPO REAL ── */}
      <section id="simulador" className="py-20 sm:py-28 bg-[#070b14]">
        <div className="mx-auto max-w-5xl px-4 sm:px-6 lg:px-8">
          
          <div className="overflow-hidden rounded-3xl border border-slate-700/80 bg-[#0d1629] shadow-2xl">
            
            {/* Header */}
            <div className="border-b border-slate-700 bg-gradient-to-r from-[#0c1427] to-[#101c36] p-6 sm:p-8">
              <div className="flex items-center gap-4">
                <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-amber-400/20 border border-amber-400/40 text-amber-400 shadow-lg">
                  <BarChart3 size={28} />
                </div>
                <div>
                  <div className="inline-flex items-center gap-1.5 text-[10px] font-black uppercase tracking-widest text-amber-400">
                    <Sliders size={12} /> Simulador Financeiro de Retorno
                  </div>
                  <h2 className="text-2xl sm:text-3xl font-black text-white mt-0.5">
                    Calcule quanto você ganha de volta
                  </h2>
                  <p className="text-xs text-slate-400 mt-1">
                    Arraste o valor de compras estimado e escolha o nível para ver a projeção anual de cashback e descontos.
                  </p>
                </div>
              </div>
            </div>

            <div className="p-6 sm:p-8 space-y-8">
              
              {/* Spending Slider */}
              <div>
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-4">
                  <label htmlFor="spending-range" className="text-sm font-bold text-slate-300">
                    Quanto você estima gastar por mês no GSA (Produtos + Serviços + Viagens)?
                  </label>
                  <span className="text-2xl sm:text-3xl font-black text-transparent bg-clip-text bg-gradient-to-r from-amber-300 to-yellow-400">
                    {simulatedSpend.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                  </span>
                </div>
                <input
                  id="spending-range"
                  aria-label="Quanto você estima gastar por mês no GSA"
                  type="range"
                  min={100}
                  max={10000}
                  step={100}
                  value={simulatedSpend}
                  onChange={(e) => setSimulatedSpend(Number(e.target.value))}
                  className="w-full h-3 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-amber-400"
                />
                <div className="flex justify-between text-[11px] font-semibold text-slate-400 mt-2">
                  <span>R$ 100/mês</span>
                  <span>R$ 2.500/mês</span>
                  <span>R$ 5.000/mês</span>
                  <span>R$ 10.000/mês</span>
                </div>
              </div>

              {/* Level Selector Buttons */}
              <div>
                <p className="text-xs font-black uppercase tracking-wider text-slate-400 mb-3">
                  Simular com o nível:
                </p>
                <div className="grid grid-cols-3 sm:grid-cols-6 gap-2">
                  {VIP_LEVELS.map((lvl) => {
                    const active = selectedLevel === lvl.id;
                    const conf = LEVEL_CONFIG[lvl.id];

                    return (
                      <button
                        key={lvl.id}
                        onClick={() => setSelectedLevel(lvl.id)}
                        className={`flex flex-col items-center justify-center p-3 rounded-xl border text-center transition-all cursor-pointer ${
                          active
                            ? 'bg-amber-400 text-slate-950 border-amber-300 shadow-md font-black scale-105'
                            : 'bg-slate-900 border-slate-800 text-slate-300 hover:border-slate-700 hover:text-white font-bold'
                        }`}
                      >
                        <span className="text-xs">{lvl.name}</span>
                        <span className={`text-[10px] ${active ? 'text-slate-900 font-bold' : 'text-amber-400'}`}>
                          {lvl.multiplier}× pts
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Results Grid */}
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 sm:gap-4 pt-2">
                <div className="rounded-2xl border border-slate-800 bg-slate-900/80 p-4">
                  <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Pontos Gerados/Mês</p>
                  <p className="mt-1 text-xl sm:text-2xl font-black text-white">
                    {pointsMonth.toLocaleString('pt-BR')} <span className="text-xs font-normal text-slate-400">pts</span>
                  </p>
                  <p className="mt-1 text-[10px] text-slate-400">{currentLevel.multiplier}× multiplicador</p>
                </div>

                <div className="rounded-2xl border border-amber-500/30 bg-amber-500/10 p-4">
                  <p className="text-[10px] font-bold uppercase tracking-wider text-amber-400">Pontos no Ano</p>
                  <p className="mt-1 text-xl sm:text-2xl font-black text-amber-400">
                    {yearlyPts.toLocaleString('pt-BR')} <span className="text-xs font-normal text-amber-300">pts</span>
                  </p>
                  <p className="mt-1 text-[10px] text-amber-400/80">Pontos vitalícios</p>
                </div>

                <div className="rounded-2xl border border-emerald-500/30 bg-emerald-500/10 p-4">
                  <p className="text-[10px] font-bold uppercase tracking-wider text-emerald-400">Saque PIX Anual</p>
                  <p className="mt-1 text-xl sm:text-2xl font-black text-emerald-400">
                    {yearlyCashNet.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                  </p>
                  <p className="mt-1 text-[10px] text-emerald-400/80">Líquido na sua conta</p>
                </div>

                <div className="rounded-2xl border border-sky-500/30 bg-sky-500/10 p-4">
                  <p className="text-[10px] font-bold uppercase tracking-wider text-sky-400">Economia Descontos</p>
                  <p className="mt-1 text-xl sm:text-2xl font-black text-sky-400">
                    {yearlyDiscountSavings.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                  </p>
                  <p className="mt-1 text-[10px] text-sky-400/80">{currentLevel.discountPercentage}% OFF acumulado</p>
                </div>
              </div>

              {/* Total Benefit Box (Massive Callout) */}
              <div className="rounded-2xl bg-gradient-to-r from-amber-500 via-amber-400 to-yellow-500 p-6 text-slate-950 shadow-xl flex flex-col sm:flex-row items-center justify-between gap-6">
                <div>
                  <span className="rounded-md bg-black/20 px-2.5 py-0.5 text-[10px] font-black uppercase tracking-wider text-slate-950">
                    Retorno Total Anual Estimado
                  </span>
                  <h3 className="text-3xl sm:text-4xl font-black tracking-tight mt-1 text-slate-950">
                    {totalAnnualBenefit.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                  </h3>
                  <p className="text-xs font-semibold text-slate-900 mt-0.5">
                    Soma de dinheiro resgatado no PIX + descontos acumulados no ano como {currentLevel.name} VIP.
                  </p>
                </div>

                <button
                  onClick={goRegister}
                  className="shrink-0 rounded-xl bg-slate-950 px-8 py-4 text-xs font-black text-amber-400 shadow-xl transition-all hover:bg-slate-900 hover:scale-105 active:scale-95 cursor-pointer"
                >
                  Quero Essa Economia Agora
                </button>
              </div>

              <p className="text-[11px] text-slate-400 text-center">
                * Valores simulados com base nas regras vigentes do Programa VIP GSA. O resgate em dinheiro depende da conversão padrão de 100 pontos = R$ 1,00 líquido de taxas conforme o nível ativo.
              </p>
            </div>
          </div>

        </div>
      </section>

      {/* ── DEPOIMENTOS DE MEMBROS (PROVA SOCIAL) ── */}
      <section id="depoimentos" className="py-20 sm:py-28 bg-[#0a101d] border-y border-slate-800">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          
          <div className="text-center max-w-3xl mx-auto mb-16">
            <div className="inline-flex items-center gap-2 rounded-full border border-amber-400/30 bg-amber-400/10 px-3 py-1 mb-3">
              <Star size={12} className="text-amber-400" />
              <span className="text-[10px] font-black uppercase tracking-widest text-amber-400">
                Experiências Reais
              </span>
            </div>
            <h2 className="text-3xl sm:text-4xl font-black text-white tracking-tight">
              O que dizem os membros do <span className="text-amber-400">GSA VIP</span>
            </h2>
            <p className="mt-3 text-sm sm:text-base text-slate-400 leading-relaxed">
              Mais de 14.800 clientes aproveitam os multiplicadores, resgates e descontos todos os dias.
            </p>
          </div>

          <div className="grid grid-cols-1 gap-6 sm:grid-cols-3">
            {TESTIMONIALS.map((t, i) => (
              <div
                key={i}
                className="relative flex flex-col justify-between overflow-hidden rounded-3xl border border-slate-800 bg-[#0d1629] p-7 shadow-xl transition-all hover:border-slate-700 hover:bg-[#101b33]"
              >
                <div>
                  {/* Rating & Badge */}
                  <div className="flex items-center justify-between mb-4">
                    <div className="flex text-amber-400">
                      {[...Array(t.rating)].map((_, idx) => (
                        <Star key={idx} size={15} className="fill-amber-400" />
                      ))}
                    </div>
                    <span
                      className="rounded-full px-2.5 py-0.5 text-[10px] font-black uppercase tracking-wider"
                      style={{ backgroundColor: `${t.levelColor}20`, color: t.levelColor }}
                    >
                      {t.level}
                    </span>
                  </div>

                  <h3 className="text-base font-black text-white mb-2 leading-snug">
                    "{t.headline}"
                  </h3>
                  <p className="text-xs text-slate-300 leading-relaxed">
                    {t.quote}
                  </p>
                </div>

                <div className="mt-6 pt-5 border-t border-slate-800 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <img
                      src={t.avatar}
                      alt={t.name}
                      className="h-10 w-10 rounded-full object-cover ring-2 ring-amber-400/30"
                    />
                    <div>
                      <p className="text-xs font-black text-white">{t.name}</p>
                      <p className="text-[10px] text-slate-400">{t.city}</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <span className="text-[9px] font-bold uppercase tracking-wider text-emerald-400 block">
                      {t.savings}
                    </span>
                  </div>
                </div>
              </div>
            ))}
          </div>

        </div>
      </section>

      {/* ── FAQ INTERATIVO COM BUSCA E ABAS ── */}
      <section id="faq" className="py-20 sm:py-28 bg-[#070b14]">
        <div className="mx-auto max-w-4xl px-4 sm:px-6 lg:px-8">
          
          <div className="text-center max-w-3xl mx-auto mb-12">
            <div className="inline-flex items-center gap-2 rounded-full border border-amber-400/30 bg-amber-400/10 px-3 py-1 mb-3">
              <HelpCircle size={12} className="text-amber-400" />
              <span className="text-[10px] font-black uppercase tracking-widest text-amber-400">
                Tire Todas as Dúvidas
              </span>
            </div>
            <h2 className="text-3xl sm:text-4xl font-black text-white tracking-tight">
              Perguntas Frequentes
            </h2>
            <p className="mt-2 text-sm text-slate-400">
              Tudo o que você precisa saber sobre pontos, resgates em PIX, níveis e vantagens.
            </p>
          </div>

          {/* Search Box */}
          <div className="relative mb-6">
            <Search size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              placeholder="Buscar dúvida (ex: como resgatar, taxa de saque, validade dos pontos)..."
              value={faqSearch}
              onChange={(e) => setFaqSearch(e.target.value)}
              className="w-full rounded-2xl border border-slate-800 bg-[#0d1629] py-3.5 pl-12 pr-4 text-xs font-medium text-white placeholder-slate-500 focus:border-amber-400 focus:outline-none focus:ring-1 focus:ring-amber-400"
            />
          </div>

          {/* Category Pills */}
          <div className="flex flex-wrap gap-2 mb-8 justify-center">
            {[
              { id: 'todos', label: 'Todas as Dúvidas' },
              { id: 'geral', label: 'Geral & Cadastro' },
              { id: 'pontos', label: 'Pontos & Multiplicadores' },
              { id: 'pix', label: 'Resgate PIX' },
              { id: 'niveis', label: 'Níveis & Upgrades' },
              { id: 'descontos', label: 'Descontos no Carrinho' },
            ].map((cat) => (
              <button
                key={cat.id}
                onClick={() => setFaqFilter(cat.id)}
                className={`rounded-xl px-3.5 py-1.5 text-xs font-bold transition-all cursor-pointer ${
                  faqFilter === cat.id
                    ? 'bg-amber-400 text-slate-950 font-black'
                    : 'bg-slate-900 border border-slate-800 text-slate-400 hover:text-white'
                }`}
              >
                {cat.label}
              </button>
            ))}
          </div>

          {/* Accordion List */}
          <div className="space-y-3">
            {filteredFaqs.length > 0 ? (
              filteredFaqs.map((faq, index) => {
                const isOpen = openFaq === index;

                return (
                  <div
                    key={index}
                    className="overflow-hidden rounded-2xl border border-slate-800 bg-[#0d1629] transition-all hover:border-slate-700 shadow-md"
                  >
                    <button
                      onClick={() => setOpenFaq(isOpen ? null : index)}
                      className="flex w-full items-center justify-between p-5 text-left cursor-pointer"
                    >
                      <span className="text-sm font-bold text-white pr-4">{faq.q}</span>
                      <ChevronDown
                        size={18}
                        className={`shrink-0 text-slate-400 transition-transform duration-200 ${
                          isOpen ? 'rotate-180 text-amber-400' : ''
                        }`}
                      />
                    </button>
                    <AnimatePresence>
                      {isOpen && (
                        <motion.div
                          initial={{ height: 0, opacity: 0 }}
                          animate={{ height: 'auto', opacity: 1 }}
                          exit={{ height: 0, opacity: 0 }}
                          transition={{ duration: 0.2 }}
                          className="border-t border-slate-800/80 bg-slate-950/60 p-5 text-xs sm:text-sm leading-relaxed text-slate-300"
                        >
                          {faq.a}
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>
                );
              })
            ) : (
              <div className="text-center py-10 rounded-2xl bg-slate-900/40 border border-slate-800">
                <p className="text-xs text-slate-400">Nenhuma pergunta encontrada com o termo pesquisado.</p>
              </div>
            )}
          </div>

        </div>
      </section>

      {/* ── GRAND FINAL CTA SECTION — LUXURY FINISH ── */}
      <section className="relative overflow-hidden bg-gradient-to-b from-[#0c1427] via-[#09101f] to-[#05080f] py-24 border-t border-slate-800">
        
        {/* Glow ambient */}
        <div className="pointer-events-none absolute -top-24 left-1/2 h-96 w-96 -translate-x-1/2 rounded-full bg-amber-500/15 blur-[120px]" />

        <div className="relative mx-auto max-w-5xl px-4 text-center sm:px-6 lg:px-8">
          
          <div className="mx-auto mb-6 flex h-20 w-20 items-center justify-center rounded-3xl bg-gradient-to-br from-amber-400 via-amber-500 to-yellow-600 p-0.5 shadow-2xl shadow-amber-500/30">
            <div className="flex h-full w-full items-center justify-center rounded-[22px] bg-[#070b14]">
              <Crown size={36} className="fill-amber-400 text-amber-400" />
            </div>
          </div>

          <h2 className="text-3xl sm:text-5xl font-black tracking-tight text-white leading-tight">
            Pronto para transformar suas compras em{' '}
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-amber-300 to-yellow-200">
              dinheiro de volta?
            </span>
          </h2>

          <p className="mx-auto mt-4 max-w-xl text-sm sm:text-base text-slate-300 leading-relaxed">
            Crie sua conta gratuitamente em menos de 1 minuto, ganhe seu bônus de 500 pontos e comece a economizar em todo o marketplace GSA hoje mesmo.
          </p>

          <div className="mt-8 flex flex-col sm:flex-row items-center justify-center gap-4">
            <button
              onClick={goRegister}
              className="group relative overflow-hidden w-full sm:w-auto rounded-2xl bg-gradient-to-r from-amber-400 via-amber-500 to-yellow-500 px-10 py-4 text-sm font-black text-slate-950 shadow-xl shadow-amber-500/30 transition-all hover:scale-105 hover:shadow-amber-500/50 active:scale-95 cursor-pointer"
            >
              <span>Criar Minha Conta VIP Grátis</span>
              <div className="absolute inset-0 -translate-x-full group-hover:translate-x-full transition-transform duration-1000 bg-gradient-to-r from-transparent via-white/30 to-transparent" />
            </button>
            <button
              onClick={goLogin}
              className="w-full sm:w-auto rounded-2xl border border-slate-700 bg-slate-800/60 px-9 py-4 text-sm font-bold text-white transition-all hover:border-slate-500 hover:bg-slate-800 cursor-pointer"
            >
              Fazer Login de Membro
            </button>
          </div>

          {/* Guarantee Badges */}
          <div className="mt-12 grid grid-cols-2 gap-4 sm:grid-cols-4 pt-8 border-t border-slate-800/80 text-xs text-slate-400">
            <div className="flex items-center justify-center gap-2">
              <ShieldCheck size={16} className="text-emerald-400 shrink-0" />
              <span>100% Gratuito</span>
            </div>
            <div className="flex items-center justify-center gap-2">
              <Clock size={16} className="text-amber-400 shrink-0" />
              <span>Pontos Sem Validade</span>
            </div>
            <div className="flex items-center justify-center gap-2">
              <Zap size={16} className="text-sky-400 shrink-0" />
              <span>PIX Instantâneo</span>
            </div>
            <div className="flex items-center justify-center gap-2">
              <Lock size={16} className="text-purple-400 shrink-0" />
              <span>Sem Fidelidade</span>
            </div>
          </div>

        </div>
      </section>

      {/* ── FOOTER — LUXURY DARK ── */}
      <footer className="bg-[#04060c] py-8 text-center text-xs text-slate-400 border-t border-slate-900">
        <div className="mx-auto max-w-7xl px-4 flex flex-col sm:flex-row items-center justify-between gap-4">
          <p>© 2026 GSA HUB — Gestão de Serviços & Tecnologia. Todos os direitos reservados.</p>
          <div className="flex gap-4">
            <button onClick={goBack} className="hover:text-amber-400 transition-colors cursor-pointer">Marketplace</button>
            <button onClick={goRegister} className="hover:text-amber-400 transition-colors cursor-pointer">Cadastro VIP</button>
            <button onClick={goLogin} className="hover:text-amber-400 transition-colors cursor-pointer">Acessar Conta</button>
          </div>
        </div>
      </footer>

      {/* ── STICKY BOTTOM BAR (CONVERSÃO ACELERADA AO ROLAR A PÁGINA) ── */}
      <AnimatePresence>
        {stickyVisible && !clientId && (
          <motion.div
            initial={{ y: 100, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 100, opacity: 0 }}
            className="fixed bottom-0 left-0 right-0 z-50 border-t border-slate-700/80 bg-[#0a101d]/95 backdrop-blur-md px-4 py-3 shadow-2xl"
          >
            <div className="mx-auto flex max-w-7xl items-center justify-between gap-4">
              <div className="hidden sm:flex items-center gap-3">
                <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-amber-400 to-yellow-500 text-slate-950 font-black">
                  <Crown size={18} />
                </div>
                <div>
                  <p className="text-xs font-black text-white">Clube de Vantagens GSA VIP</p>
                  <p className="text-[11px] text-amber-400">Economize até 15% OFF + até 5× pontos em toda compra</p>
                </div>
              </div>

              <div className="flex w-full items-center justify-between sm:justify-end gap-3 sm:w-auto">
                <button
                  onClick={goLogin}
                  className="rounded-xl border border-slate-700 bg-slate-800 px-4 py-2 text-xs font-bold text-slate-200 transition-colors hover:bg-slate-700 cursor-pointer"
                >
                  Já tenho conta
                </button>
                <button
                  onClick={goRegister}
                  className="rounded-xl bg-gradient-to-r from-amber-400 to-yellow-500 px-6 py-2 text-xs font-black text-slate-950 shadow-md transition-all hover:brightness-110 active:scale-95 cursor-pointer"
                >
                  Cadastrar Grátis
                </button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

    </div>
  );
}
