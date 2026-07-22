import React, { useRef } from 'react';
import { motion, useInView, AnimatePresence } from 'framer-motion';
import {
  ArrowLeft, ShoppingBag, Plane, Tags,
  ArrowRight, CheckCircle2, Clock, Sparkles,
  Star, TrendingUp, Shield, Zap, Package, Globe,
  ChevronRight, Crown, ShoppingCart, MessageCircle, Mail, HeartPulse, ShieldCheck
} from 'lucide-react';
import { LogoGSA } from '../../ui/LogoGSA';
import { navigate } from '../../../routing/navigationService';
import { routes } from '../../../routing/routeCatalog';
import { AdvertisingSlot } from '../../ads/AdvertisingSlot';

interface MarketplaceHomeProps {
  onSelectModule: (moduleName: 'produtos-assinaturas' | 'pacotes-viagem' | 'classificados' | 'saude' | 'seguros') => void;
  onBackToSite?: () => void;
  isPublic?: boolean;
}

type MarketplaceModuleKey = 'produtos-assinaturas' | 'pacotes-viagem' | 'classificados' | 'saude' | 'seguros';

interface MarketplaceModuleConfig {
  key: MarketplaceModuleKey;
  icon: React.ElementType;
  label: string;
  headline: string;
  available: boolean;
  btnLabel: string;
  gradient: string;
  accentColor: string;
  iconBg: string;
  image?: string;
  imageAlt?: string;
  categoryLabel?: string;
  description?: string;
}

const modules: MarketplaceModuleConfig[] = [
  {
    key: 'produtos-assinaturas' as const,
    icon: ShoppingBag,
    label: 'Produtos e Assinaturas',
    headline: 'Sua loja exclusiva',
    available: true,
    btnLabel: 'Acessar loja',
    gradient: 'from-[#1a1a2e] via-[#16213e] to-[#0f3460]',
    accentColor: '#d8bd73',
    iconBg: 'bg-[#d8bd73]',
    image: '/images/marketplace/produtos-assinaturas-hero.jpg',
    imageAlt: 'Caixa de assinatura com produtos selecionados e gestão recorrente pelo celular',
    categoryLabel: 'Loja e recorrência',
    description: 'Produtos selecionados, ofertas e assinaturas reunidos em uma experiência de compra segura.',
  },
  {
    key: 'pacotes-viagem' as const,
    icon: Plane,
    label: 'GSA Viagens',
    headline: 'Destinos exclusivos',
    available: true,
    btnLabel: 'Explorar destinos',
    gradient: 'from-[#0c1821] via-[#1b3a4b] to-[#065a82]',
    accentColor: '#4dc9f6',
    iconBg: 'bg-[#4dc9f6]',
    image: 'https://images.unsplash.com/photo-1436491865332-7a61a109cc05?auto=format&fit=crop&w=1200&q=85',
    imageAlt: 'Avião preparado para uma nova viagem',
    categoryLabel: 'Destinos e experiências',
    description: 'Pacotes selecionados, roteiros personalizados e acompanhamento para organizar sua viagem.',
  },
  {
    key: 'classificados' as const,
    icon: Tags,
    label: 'GSA Classificados',
    headline: 'Oportunidades reais',
    available: true,
    btnLabel: 'Acessar classificados',
    gradient: 'from-[#1a1a1a] via-[#2d2d2d] to-[#3d3027]',
    accentColor: '#e8a838',
    iconBg: 'bg-[#e8a838]',
    image: '/images/marketplace/gsa-classificados-hero.jpg',
    imageAlt: 'Marketplace de classificados com anúncios de veículo, imóvel, eletrônico e mobiliário',
    categoryLabel: 'Compra e venda',
    description: 'Encontre veículos, imóveis e oportunidades selecionadas em um só ambiente.',
  },
  {
    key: 'saude' as const,
    icon: HeartPulse,
    label: 'GSA Saúde',
    headline: 'Cuidado e orientação',
    available: true,
    btnLabel: 'Conhecer planos',
    gradient: 'from-[#082f31] via-[#0c5653] to-[#16a394]',
    accentColor: '#74ead8',
    iconBg: 'bg-[#74ead8]',
    image: '/images/marketplace/gsa-saude-hero.webp',
    imageAlt: 'Profissional de saúde prestando atendimento e orientação',
    categoryLabel: 'Planos e cuidado',
    description: 'Compare planos e receba orientação durante toda a contratação.',
  },
  {
    key: 'seguros' as const,
    icon: ShieldCheck,
    label: 'GSA Seguros',
    headline: 'Proteção sob medida',
    available: true,
    btnLabel: 'Conhecer seguros',
    gradient: 'from-[#0d1f46] via-[#173d86] to-[#3569e8]',
    accentColor: '#a7c5ff',
    iconBg: 'bg-[#a7c5ff]',
    image: '/images/marketplace/gsa-seguros-hero.webp',
    imageAlt: 'Família protegida por soluções de seguros',
    categoryLabel: 'Proteção e assistência',
    description: 'Encontre proteção para veículos, residência, vida, viagem e empresa.',
  },
];

function ModuleCard({
  mod,
  index,
  onSelect,
}: {
  key?: string;
  mod: (typeof modules)[number];
  index: number;
  onSelect: () => void;
}) {
  const ref = useRef(null);
  const inView = useInView(ref, { once: true, margin: '-40px' });
  const Icon = mod.icon;

  if (mod.image) {
    return (
      <motion.div
        ref={ref}
        initial={{ opacity: 0, y: 24 }}
        animate={inView ? { opacity: 1, y: 0 } : {}}
        transition={{ duration: 0.5, delay: index * 0.08 }}
        className="h-full"
      >
        <button
          onClick={onSelect}
          aria-label={`Abrir ${mod.label}`}
          className="group grid h-full min-h-[176px] w-full grid-cols-[112px_minmax(0,1fr)] overflow-hidden rounded-lg border border-neutral-200 bg-white text-left shadow-[0_8px_24px_rgba(12,35,64,0.06)] transition-all duration-300 hover:border-[#0c2340]/25 hover:shadow-[0_16px_36px_rgba(12,35,64,0.12)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0c2340] focus-visible:ring-offset-2 md:block md:min-h-[350px]"
        >
          <div className="relative min-h-full overflow-hidden bg-neutral-100 md:h-44 md:min-h-0 lg:h-48">
            <img
              src={mod.image}
              alt={mod.imageAlt || ''}
              className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-[1.04]"
            />
            <span className="absolute left-3 top-3 hidden rounded-md bg-white/95 px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.12em] text-[#0c2340] shadow-sm md:inline-flex">
              {mod.categoryLabel}
            </span>
          </div>

          <div className="flex min-w-0 flex-col justify-between p-4 md:min-h-[174px] md:p-6 lg:min-h-[190px]">
            <div>
              <div className="mb-3 flex items-center gap-2.5">
                <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-[#f1f5f8]">
                  <Icon className="h-4 w-4" style={{ color: mod.accentColor }} strokeWidth={2} />
                </span>
                <span className="text-[10px] font-bold uppercase tracking-[0.12em] text-neutral-500 md:hidden">
                  {mod.categoryLabel}
                </span>
              </div>
              <h2 className="text-base font-black leading-tight text-[#0c2340] sm:text-lg lg:text-xl">{mod.label}</h2>
              <p className="mt-2 text-xs font-medium leading-5 text-neutral-500 md:text-sm">{mod.description}</p>
            </div>

            <div className="mt-3 flex items-center justify-between border-t border-neutral-100 pt-3 md:mt-5 md:pt-4">
              <span className="pr-2 text-[9px] font-black uppercase tracking-[0.1em] text-[#0c2340] md:text-[11px]">
                {mod.btnLabel}
              </span>
              <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-[#0c2340] text-white transition-colors group-hover:bg-[#134e78] md:h-8 md:w-8">
                <ArrowRight className="h-3.5 w-3.5" />
              </span>
            </div>
          </div>
        </button>
      </motion.div>
    );
  }

  return (
    <motion.div
      ref={ref}
      initial={{ opacity: 0, y: 50 }}
      animate={inView ? { opacity: 1, y: 0 } : {}}
      transition={{ duration: 0.7, delay: index * 0.15, ease: [0.16, 1, 0.3, 1] }}
      className="group h-full"
    >
      <button
        onClick={onSelect}
        className={`group/card relative w-full h-full text-left overflow-hidden rounded-[1.25rem] sm:rounded-[2rem] transition-all duration-500 hover:-translate-y-1 sm:hover:-translate-y-3 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/50 focus-visible:ring-offset-4 bg-gradient-to-br ${mod.gradient} p-3.5 sm:p-10 flex flex-col justify-between`}
        style={{
          boxShadow: `0 8px 20px -8px rgba(0,0,0,0.5), inset 0 0 0 1px rgba(255,255,255,0.12), inset 0 2px 15px rgba(255,255,255,0.05)`,
        }}
        aria-label={`Abrir ${mod.label}`}
      >
        {/* Glow effect that reacts to hover */}
        <div 
          className="absolute inset-0 opacity-0 group-hover/card:opacity-100 transition-opacity duration-700 pointer-events-none"
          style={{ boxShadow: `inset 0 0 60px ${mod.accentColor}25` }}
        />

        {/* Textura de fundo sutil (glass noise) */}
        <div className="absolute inset-0 opacity-[0.04] pointer-events-none mix-blend-overlay" style={{ backgroundImage: 'url("data:image/svg+xml,%3Csvg viewBox=\'0 0 200 200\' xmlns=\'http://www.w3.org/2000/svg\'%3E%3Cfilter id=\'noiseFilter\'%3E%3CfeTurbulence type=\'fractalNoise\' baseFrequency=\'0.85\' numOctaves=\'3\' stitchTiles=\'stitch\'/%3E%3C/filter%3E%3Crect width=\'100%25\' height=\'100%25\' filter=\'url(%23noiseFilter)\'/%3E%3C/svg%3E")' }} />
          
        {/* Brilho decorativo - glows */}
        <div className="absolute -top-12 -right-12 sm:-top-24 sm:-right-24 w-32 h-32 sm:w-64 sm:h-64 rounded-full opacity-15 sm:opacity-20 blur-[2rem] sm:blur-[4rem] transition-all duration-700 group-hover/card:opacity-25 sm:group-hover/card:opacity-40 group-hover/card:scale-125" style={{ background: mod.accentColor }} />
        <div className="absolute -bottom-12 -left-12 sm:-bottom-24 sm:-left-24 w-28 h-28 sm:w-56 sm:h-56 rounded-full opacity-5 sm:opacity-10 blur-[2rem] sm:blur-[4rem] transition-all duration-700 group-hover/card:opacity-15 sm:group-hover/card:opacity-30 group-hover/card:scale-110" style={{ background: mod.accentColor }} />
 
        {/* Conteúdo do Card */}
        <div className="w-full relative z-10 flex flex-col h-full justify-between min-h-0 sm:min-h-[320px]">
          {/* Topo: Ícone e Textos lado a lado (Mobile) / Em coluna (Desktop) */}
          <div className="relative flex flex-row sm:flex-col items-center sm:items-start gap-4 sm:gap-8 w-full">
            {/* Ícone com fundo próprio e borda com brilho */}
            <div
              className="absolute left-0 top-1/2 -translate-y-1/2 sm:relative sm:top-0 sm:translate-y-0 flex-shrink-0 flex h-14 w-14 sm:h-20 sm:w-20 items-center justify-center rounded-xl sm:rounded-[1.25rem] bg-white/5 backdrop-blur-xl border border-white/20 transition-all duration-500 group-hover/card:scale-110 group-hover/card:rotate-[-6deg] group-hover/card:border-white/40 group-hover/card:bg-white/10"
              style={{ boxShadow: `0 4px 15px ${mod.accentColor}25, inset 0 0 0 1px rgba(255,255,255,0.15)` }}
            >
              <style dangerouslySetInnerHTML={{__html: `
                @keyframes swing {
                  0%, 100% { transform: rotate(0deg); }
                  20% { transform: rotate(15deg); }
                  40% { transform: rotate(-10deg); }
                  60% { transform: rotate(5deg); }
                  80% { transform: rotate(-5deg); }
                }
                @keyframes fly {
                  0%, 100% { transform: translate(0, 0); }
                  50% { transform: translate(5px, -5px); }
                }
                @keyframes wobble {
                  0%, 100% { transform: translateX(0); }
                  15% { transform: translateX(-3px) rotate(-5deg); }
                  30% { transform: translateX(2px) rotate(3deg); }
                  45% { transform: translateX(-2px) rotate(-3deg); }
                  60% { transform: translateX(1px) rotate(2deg); }
                  75% { transform: translateX(-1px) rotate(-1deg); }
                }
              `}} />
              <Icon 
                className={`h-8 w-8 sm:h-10 sm:w-10 transition-colors duration-500 ${
                  mod.key === 'produtos-assinaturas' ? 'animate-[swing_2s_ease-in-out_infinite]' :
                  mod.key === 'pacotes-viagem' ? 'animate-[fly_3s_ease-in-out_infinite]' :
                  mod.key === 'classificados' ? 'animate-[wobble_2.5s_ease-in-out_infinite]' :
                  mod.key === 'saude' ? 'animate-pulse' : ''
                }`} 
                style={{ color: mod.accentColor }} 
                strokeWidth={1.8} 
              />
            </div>

            {/* Textos maiores e com mais respiro */}
            <div className="flex flex-col gap-0.5 sm:gap-3 pl-[72px] sm:pl-0">
              <p className="text-[9px] sm:text-sm font-black uppercase tracking-[0.2em] sm:tracking-[0.25em] transition-colors duration-300 sm:drop-shadow-md" style={{ color: mod.accentColor }}>
                {mod.headline}
              </p>
              <h2 className="text-2xl sm:text-4xl lg:text-5xl font-black text-white tracking-tight leading-[1.2] sm:leading-[1.1] sm:drop-shadow-md">
                {mod.label}
              </h2>
            </div>
          </div>

          {/* Base: Botão CTA "Pílula" com efeito de luz */}
          <div className="mt-2 sm:mt-14 flex justify-end sm:justify-start">
            <div 
              className="group/btn relative inline-flex items-center justify-center gap-2 sm:gap-4 rounded-full px-4 py-2 sm:px-10 sm:py-5 overflow-hidden transition-all duration-500 hover:scale-[1.03]"
              style={{
                backgroundColor: mod.accentColor,
                boxShadow: `0 6px 20px -8px ${mod.accentColor}, inset 0 -1.5px 4px rgba(0,0,0,0.2), inset 0 1.5px 4px rgba(255,255,255,0.3)`,
              }}
            >
              {/* Faixa de luz que desliza no hover */}
              <div 
                className="absolute inset-0 -translate-x-[150%] bg-gradient-to-r from-transparent via-white/50 sm:via-white/60 to-transparent skew-x-[-20deg] transition-transform duration-700 ease-in-out group-hover/btn:translate-x-[150%]" 
              />
              
              <span className="relative z-10 text-[10px] sm:text-[16px] font-black uppercase tracking-[0.12em] sm:tracking-[0.15em] text-[#1a1a1a] sm:drop-shadow-sm">
                {mod.btnLabel}
              </span>
              
              <div className="relative z-10 flex h-5 w-5 sm:h-10 sm:w-10 items-center justify-center rounded-full bg-black/15 backdrop-blur-md transition-transform duration-300 sm:group-hover/btn:translate-x-1.5 shadow-inner">
                <ArrowRight className="h-2.5 w-2.5 sm:h-5 sm:w-5 text-[#1a1a1a]" strokeWidth={3} />
              </div>
            </div>
          </div>
        </div>
      </button>
    </motion.div>
  );
}

const WHATSAPP_NUMBER = '5511920857756';
const CONTACT_EMAIL = 'gsa.doc.adm@gmail.com';

export function MarketplaceHome({
  onSelectModule,
  onBackToSite,
  isPublic = false,
}: MarketplaceHomeProps) {
  const headerRef = useRef(null);
  const headerInView = useInView(headerRef, { once: true });

  return (
    <div className="bg-[#f4f1ea]">
      {/* ─── TELA PRINCIPAL (100dvh) ──────────────── */}
      <div className="min-h-[100dvh] flex flex-col">
      {/* ─── NAVBAR MARKETPLACE ────────────────── */}
      <nav className="sticky top-0 z-50 border-b border-black/[0.06] bg-[#f4f1ea]/80 backdrop-blur-xl">
        <div className="max-w-7xl mx-auto px-5 flex items-center justify-between h-16">
          <div className="flex items-center gap-4">
            {isPublic && onBackToSite && (
              <button
                onClick={onBackToSite}
                className="flex items-center gap-2 text-sm font-medium text-neutral-500 hover:text-[#1a1a1a] transition-colors"
              >
                <ArrowLeft className="h-4 w-4" />
                <span className="hidden sm:inline">Voltar</span>
              </button>
            )}
            {isPublic && onBackToSite && <div className="h-5 w-px bg-black/10" />}
            <div className="flex items-center gap-2">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-[#1a1a1a]">
                <ShoppingBag className="h-4 w-4 text-[#d8bd73]" />
              </div>
              <span className="text-sm font-black tracking-tight text-[#1a1a1a]">
                GSA HUB
              </span>
            </div>
          </div>
          <div className="flex items-center gap-3">
          </div>
        </div>
      </nav>

      <div className="flex-1 flex flex-col justify-start sm:justify-center">
        {/* ─── HERO SECTION ──────────────────────── */}
        <section className="relative overflow-hidden bg-[#0a0a0a] shrink-0">
          {/* Background image overlay */}
          <div className="absolute inset-0">
            <img
              src="https://images.unsplash.com/photo-1441986300917-64674bd600d8?auto=format&fit=crop&w=2200&q=80"
              alt=""
              className="h-full w-full object-cover opacity-25"
            />
            <div className="absolute inset-0 bg-gradient-to-r from-[#0a0a0a] via-[#0a0a0a]/85 to-[#0a0a0a]/70" />
            <div className="absolute inset-0 bg-gradient-to-t from-[#0a0a0a] via-transparent to-transparent" />
          </div>

          <div className="relative max-w-7xl mx-auto px-5 pt-6 pb-8 md:pt-12 md:pb-14">
            <motion.div
              ref={headerRef}
              initial={{ opacity: 0, y: 30 }}
              animate={headerInView ? { opacity: 1, y: 0 } : {}}
              transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
              className="max-w-3xl"
            >
              {/* Marca principal */}
              <div className="mb-4 sm:mb-6 inline-flex flex-col w-full">
                <h1 
                  className="text-5xl sm:text-7xl md:text-8xl tracking-widest leading-[0.95] mb-1.5 sm:mb-2"
                  style={{ fontFamily: '"Cinzel", serif', fontWeight: 700 }}
                >
                  <span className="text-transparent bg-clip-text bg-gradient-to-r from-[#d8bd73] via-[#f0d88a] to-[#c9a94e]">
                    GSA HUB
                  </span>
                </h1>
                <h1 className="text-4xl sm:text-6xl md:text-8xl font-black text-white tracking-tighter leading-[0.95] flex items-center gap-3 sm:gap-6">
                  <span>Marketplace</span>
                  <ShoppingCart className="h-8 w-8 sm:h-12 sm:w-12 md:h-20 md:w-20 text-[#d8bd73]" strokeWidth={1.5} />
                </h1>

                {/* Linha decorativa */}
                <div className="flex items-center gap-3 w-full mt-3 sm:mt-4">
                  <div className="h-[2px] flex-1 bg-gradient-to-r from-[#d8bd73] to-[#d8bd73]/20" />
                  <div className="h-2 w-2 rounded-full bg-[#d8bd73] shrink-0" />
                </div>
              </div>
            </motion.div>
          </div>
        </section>

        {/* ─── SECTION TITLE ─────────────────────── */}
        <div className="max-w-7xl mx-auto px-5 pt-5 pb-2 w-full shrink-0">
          <div className="flex items-end justify-between mb-3 sm:mb-5">
            <div>
              <h2 className="text-xl sm:text-3xl font-black text-[#1a1a1a] tracking-tight">
                Explore nosso Marketplace:
              </h2>
            </div>
          </div>
        </div>

        {/* ─── MODULE CARDS ──────────────────────── */}
        <div className="max-w-7xl mx-auto px-5 pb-4 sm:pb-16 w-full flex-1 flex flex-col justify-between">
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3 sm:gap-5 flex-1">
            <AdvertisingSlot placementCode="MARKETPLACE_SPONSORED_CARD" variant="card" className="h-full" />
            {modules.map((mod, i) => (
              <ModuleCard
                key={mod.key}
                mod={mod}
                index={i}
                onSelect={() => onSelectModule(mod.key)}
              />
            ))}
          </div>
        </div>
      </div>
      </div>


      {/* ─── FOOTER (Ocupará uma tela inteira no mobile quando rolar, normal no desktop) ────────────────────────────── */}
      {isPublic ? (
        <footer className="border-t border-white/10 bg-[#0a0a0a] min-h-[100dvh] sm:min-h-0 flex flex-col justify-center sm:justify-start text-white py-14">
          <div className="max-w-7xl mx-auto px-5">
            <div className="grid gap-10 lg:grid-cols-[1.4fr_0.9fr_1fr] text-left">
              <div>
                <LogoGSA size="xl" variant="light" />
                <p className="mt-6 max-w-md text-sm leading-7 text-white/60">
                  Produtos, serviços, assinaturas e tecnologia em uma experiência digital privada, elegante e conectada.
                </p>
              </div>
              <div>
                <h4 className="mb-5 text-xs font-black uppercase tracking-[0.22em] text-white/40">Ambientes</h4>
                <ul className="space-y-3 text-sm font-bold text-white/70">
                  <li><button onClick={() => navigate(routes.public.services())} className="hover:text-[#d8bd73] transition-colors">Serviços e Assinaturas</button></li>
                  <li><button onClick={() => navigate(routes.marketplace.store.root())} className="hover:text-[#d8bd73] transition-colors">Loja GSA Store</button></li>
                  <li><button onClick={() => navigate(routes.public.systems())} className="hover:text-[#d8bd73] transition-colors">Criação de Site e Sistemas</button></li>
                  <li><button onClick={() => navigate(routes.login.root())} className="hover:text-[#d8bd73] transition-colors">Login</button></li>
                </ul>
              </div>
              <div>
                <h4 className="mb-5 text-xs font-black uppercase tracking-[0.22em] text-white/40">Contato</h4>
                <div className="space-y-3">
                  <a href={`https://wa.me/${WHATSAPP_NUMBER}?text=${encodeURIComponent('Olá! Vim pelo site da GSA e gostaria de atendimento.')}`} target="_blank" rel="noopener noreferrer" className="flex items-center gap-3 text-sm font-bold text-white/70 hover:text-[#d8bd73] transition-colors">
                    <MessageCircle className="h-5 w-5" />
                    WhatsApp
                  </a>
                  <a href={`mailto:${CONTACT_EMAIL}`} className="flex items-center gap-3 text-sm font-bold text-white/70 hover:text-[#d8bd73] transition-colors">
                    <Mail className="h-5 w-5" />
                    {CONTACT_EMAIL}
                  </a>
                </div>
              </div>
            </div>
            <div className="mt-10 flex flex-col items-center justify-between gap-4 border-t border-white/10 pt-7 sm:flex-row text-xs font-semibold text-white/40">
              <p>
                © {new Date().getFullYear()} GSA Enterprise Hub. Todos os direitos reservados.
              </p>
            </div>
          </div>
        </footer>
      ) : (
        <footer className="border-t border-black/[0.06] bg-white/40 py-10">
          <div className="max-w-7xl mx-auto px-5">
            <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <div className="flex h-7 w-7 items-center justify-center rounded-md bg-[#1a1a1a]">
                  <ShoppingBag className="h-3.5 w-3.5 text-[#d8bd73]" />
                </div>
                <span className="text-xs font-black tracking-tight text-neutral-400 uppercase">GSA HUB · Marketplace</span>
              </div>
              <p className="text-[11px] text-neutral-400 font-medium">
                © {new Date().getFullYear()} Grupo GSA · Soluções Digitais. Todos os direitos reservados.
              </p>
            </div>
          </div>
        </footer>
      )}
    </div>
  );
}
