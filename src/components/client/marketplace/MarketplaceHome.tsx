import React, { useRef } from 'react';
import { motion, useInView } from 'framer-motion';
import {
  ArrowLeft, ShoppingBag, Plane, Tags,
  ArrowRight, HeartPulse, ShieldCheck,
  MessageCircle, Mail, ShoppingCart,
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
  accentColor: string;
  image?: string;
  imageAlt?: string;
  categoryLabel?: string;
  description?: string;
}

const modules: MarketplaceModuleConfig[] = [
  {
    key: 'produtos-assinaturas',
    icon: ShoppingBag,
    label: 'Produtos e Assinaturas',
    headline: 'Loja & Recorrência',
    available: true,
    btnLabel: 'Acessar loja',
    accentColor: '#d8bd73',
    image: '/images/marketplace/produtos-assinaturas-hero.jpg',
    imageAlt: 'Caixa de assinatura com produtos selecionados',
    categoryLabel: 'Loja e recorrência',
    description: 'Produtos selecionados, ofertas e assinaturas reunidos em uma experiência de compra segura.',
  },
  {
    key: 'pacotes-viagem',
    icon: Plane,
    label: 'GSA Viagens',
    headline: 'Destinos & Experiências',
    available: true,
    btnLabel: 'Explorar destinos',
    accentColor: '#4dc9f6',
    image: 'https://images.unsplash.com/photo-1436491865332-7a61a109cc05?auto=format&fit=crop&w=1200&q=85',
    imageAlt: 'Avião preparado para uma nova viagem',
    categoryLabel: 'Destinos e experiências',
    description: 'Pacotes selecionados, roteiros personalizados e acompanhamento para organizar sua viagem.',
  },
  {
    key: 'classificados',
    icon: Tags,
    label: 'GSA Classificados',
    headline: 'Compra & Venda',
    available: true,
    btnLabel: 'Acessar classificados',
    accentColor: '#e8a838',
    image: '/images/marketplace/gsa-classificados-hero.jpg',
    imageAlt: 'Marketplace de classificados com anúncios variados',
    categoryLabel: 'Compra e venda',
    description: 'Encontre veículos, imóveis e oportunidades selecionadas em um só ambiente.',
  },
  {
    key: 'saude',
    icon: HeartPulse,
    label: 'GSA Saúde',
    headline: 'Planos & Cuidado',
    available: true,
    btnLabel: 'Conhecer planos',
    accentColor: '#74ead8',
    image: '/images/marketplace/gsa-saude-hero.webp',
    imageAlt: 'Profissional de saúde prestando atendimento',
    categoryLabel: 'Planos e cuidado',
    description: 'Compare planos e receba orientação durante toda a contratação.',
  },
  {
    key: 'seguros',
    icon: ShieldCheck,
    label: 'GSA Seguros',
    headline: 'Proteção & Assistência',
    available: true,
    btnLabel: 'Conhecer seguros',
    accentColor: '#a7c5ff',
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
  mod: MarketplaceModuleConfig;
  index: number;
  onSelect: () => void;
}) {
  const ref = useRef(null);
  const inView = useInView(ref, { once: true, margin: '-40px' });
  const Icon = mod.icon;

  return (
    <motion.div
      ref={ref}
      initial={{ opacity: 0, y: 28 }}
      animate={inView ? { opacity: 1, y: 0 } : {}}
      transition={{ duration: 0.5, delay: index * 0.07, ease: [0.16, 1, 0.3, 1] }}
      className="h-full"
    >
      <button
        onClick={onSelect}
        aria-label={`Abrir ${mod.label}`}
        className="group relative flex h-full w-full flex-col overflow-hidden rounded-2xl border border-neutral-200/60 bg-white text-left shadow-[0_4px_24px_rgba(0,0,0,0.06)] transition-all duration-300 hover:-translate-y-1.5 hover:border-neutral-300 hover:shadow-[0_16px_40px_rgba(0,0,0,0.12)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0c2340] focus-visible:ring-offset-2"
      >
        {/* Image area */}
        <div className="relative h-44 overflow-hidden bg-neutral-100 lg:h-52">
          {mod.image && (
            <img
              src={mod.image}
              alt={mod.imageAlt || ''}
              className="h-full w-full object-cover transition-transform duration-700 group-hover:scale-[1.06]"
            />
          )}
          {/* Gradient overlay */}
          <div className="absolute inset-0 bg-gradient-to-t from-black/40 via-transparent to-transparent" />

          {/* Icon pill badge at top left */}
          <div className="absolute left-3.5 top-3.5 flex items-center gap-2 rounded-full border border-white/20 bg-black/60 px-3 py-1.5 backdrop-blur-md shadow-md">
            <Icon className="h-3.5 w-3.5" style={{ color: mod.accentColor }} strokeWidth={2} />
            <span className="text-[10px] font-bold text-white/90">{mod.headline}</span>
          </div>
        </div>

        {/* Content area */}
        <div className="flex flex-1 flex-col justify-between p-5">
          <div>
            <h2 className="text-base font-black leading-tight text-neutral-950 sm:text-lg">
              {mod.label}
            </h2>
            <p className="mt-2 text-xs leading-relaxed text-neutral-500 sm:text-sm">
              {mod.description}
            </p>
          </div>

          {/* CTA footer */}
          <div className="mt-5 flex items-center justify-between border-t border-neutral-100 pt-4">
            <span className="text-[11px] font-black uppercase tracking-[0.12em] text-neutral-700 transition-colors group-hover:text-neutral-950">
              {mod.btnLabel}
            </span>
            <div
              className="flex h-8 w-8 items-center justify-center rounded-lg transition-all duration-300 group-hover:scale-110"
              style={{ backgroundColor: mod.accentColor }}
            >
              <ArrowRight className="h-4 w-4 text-neutral-900" strokeWidth={2.5} />
            </div>
          </div>
        </div>

        {/* Bottom accent line */}
        <div
          className="absolute inset-x-0 bottom-0 h-[3px] origin-left scale-x-0 transition-transform duration-500 group-hover:scale-x-100"
          style={{ backgroundColor: mod.accentColor }}
        />
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
    <div className="min-h-screen bg-[#f5f3ee]">

      {/* ─── NAVBAR ───────────────────────────────── */}
      <nav className="sticky top-0 z-50 border-b border-black/[0.06] bg-[#f5f3ee]/90 backdrop-blur-xl">
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-5">
          <div className="flex items-center gap-4">
            {isPublic && onBackToSite && (
              <button
                onClick={onBackToSite}
                className="flex items-center gap-2 text-sm font-semibold text-neutral-500 transition-colors hover:text-neutral-900"
              >
                <ArrowLeft className="h-4 w-4" />
                <span className="hidden sm:inline">Voltar</span>
              </button>
            )}
            {isPublic && onBackToSite && <div className="h-5 w-px bg-black/10" />}
            <div className="flex items-center gap-2.5">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-neutral-950">
                <ShoppingCart className="h-4 w-4 text-[#d8bd73]" strokeWidth={1.8} />
              </div>
              <div>
                <span className="block text-[10px] font-black uppercase tracking-[0.2em] text-neutral-400">GSA HUB</span>
                <span className="block text-sm font-black leading-none tracking-tight text-neutral-950">Marketplace</span>
              </div>
            </div>
          </div>
        </div>
      </nav>

      {/* ─── HERO ─────────────────────────────────── */}
      <section className="relative overflow-hidden bg-neutral-950">
        <img
          src="https://images.unsplash.com/photo-1441986300917-64674bd600d8?auto=format&fit=crop&w=2200&q=80"
          alt=""
          className="absolute inset-0 h-full w-full object-cover opacity-20 mix-blend-luminosity"
        />
        <div className="absolute inset-0 bg-gradient-to-b from-neutral-950/70 via-neutral-950/85 to-neutral-950" />

        {/* Gold ambient glow */}
        <div className="pointer-events-none absolute left-1/4 top-0 h-[500px] w-[600px] -translate-x-1/2 rounded-full bg-[#d8bd73]/10 blur-[120px]" />

        <div className="relative mx-auto max-w-7xl px-5 pb-14 pt-12 sm:pb-20 sm:pt-16">
          <motion.div
            ref={headerRef}
            initial={{ opacity: 0, y: 24 }}
            animate={headerInView ? { opacity: 1, y: 0 } : {}}
            transition={{ duration: 0.7, ease: [0.16, 1, 0.3, 1] }}
          >
            {/* Eyebrow */}
            <p className="mb-4 text-xs font-black uppercase tracking-[0.3em] text-[#d8bd73]/70">
              GSA HUB · Soluções Digitais
            </p>

            {/* Title */}
            <h1 className="max-w-3xl text-5xl font-black leading-[0.95] tracking-tight text-white sm:text-7xl lg:text-8xl">
              Market<span className="text-[#d8bd73]">place</span>
            </h1>

            {/* Divider */}
            <div className="mt-5 flex items-center gap-4">
              <div className="h-px flex-1 max-w-xs bg-gradient-to-r from-[#d8bd73]/60 to-transparent" />
            </div>

            {/* Subtitle */}
            <p className="mt-5 max-w-xl text-base leading-relaxed text-white/55 sm:text-lg">
              Produtos, viagens, classificados, saúde e seguros reunidos em uma plataforma integrada e segura.
            </p>

            {/* Stats row */}
            <div className="mt-10 flex flex-wrap gap-x-10 gap-y-4">
              {[
                ['5', 'Ambientes'],
                ['100%', 'Seguro'],
                ['24h', 'Disponível'],
              ].map(([value, label]) => (
                <div key={label}>
                  <strong className="block text-2xl font-black text-[#d8bd73] sm:text-3xl">{value}</strong>
                  <span className="mt-0.5 block text-xs font-semibold uppercase tracking-wider text-white/35">{label}</span>
                </div>
              ))}
            </div>
          </motion.div>
        </div>
      </section>

      {/* ─── SECTION TITLE ──────────────────────────── */}
      <div className="mx-auto max-w-7xl px-5 pt-12 pb-4">
        <div className="flex items-end justify-between">
          <div>
            <p className="text-[11px] font-black uppercase tracking-[0.25em] text-neutral-400">Categorias disponíveis</p>
            <h2 className="mt-1.5 text-2xl font-black tracking-tight text-neutral-950 sm:text-3xl">
              Escolha onde explorar
            </h2>
          </div>
        </div>
      </div>

      {/* ─── ADVERTISING SLOT ───────────────────────── */}
      <div className="mx-auto max-w-7xl px-5 pb-4">
        <AdvertisingSlot placementCode="MARKETPLACE_SPONSORED_CARD" variant="card" className="h-full" />
      </div>

      {/* ─── MODULE CARDS ───────────────────────────── */}
      <div className="mx-auto max-w-7xl px-5 pb-16">
        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
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

      {/* ─── FOOTER ─────────────────────────────────── */}
      {isPublic ? (
        <footer className="border-t border-white/10 bg-neutral-950 py-14 text-white">
          <div className="mx-auto max-w-7xl px-5">
            <div className="grid gap-10 lg:grid-cols-[1.4fr_0.9fr_1fr]">
              <div>
                <LogoGSA size="xl" variant="light" />
                <p className="mt-6 max-w-md text-sm leading-7 text-white/50">
                  Produtos, serviços, assinaturas e tecnologia em uma experiência digital privada, elegante e conectada.
                </p>
              </div>
              <div>
                <h4 className="mb-5 text-xs font-black uppercase tracking-[0.22em] text-white/35">Ambientes</h4>
                <ul className="space-y-3 text-sm font-semibold text-white/60">
                  <li><button onClick={() => navigate(routes.public.services())} className="transition-colors hover:text-[#d8bd73]">Serviços e Assinaturas</button></li>
                  <li><button onClick={() => navigate(routes.marketplace.store.root())} className="transition-colors hover:text-[#d8bd73]">Loja GSA Store</button></li>
                  <li><button onClick={() => navigate(routes.public.systems())} className="transition-colors hover:text-[#d8bd73]">Criação de Site e Sistemas</button></li>
                  <li><button onClick={() => navigate(routes.login.root())} className="transition-colors hover:text-[#d8bd73]">Login</button></li>
                </ul>
              </div>
              <div>
                <h4 className="mb-5 text-xs font-black uppercase tracking-[0.22em] text-white/35">Contato</h4>
                <div className="space-y-3">
                  <a href={`https://wa.me/${WHATSAPP_NUMBER}?text=${encodeURIComponent('Olá! Vim pelo site da GSA e gostaria de atendimento.')}`} target="_blank" rel="noopener noreferrer" className="flex items-center gap-3 text-sm font-semibold text-white/60 transition-colors hover:text-[#d8bd73]">
                    <MessageCircle className="h-5 w-5" /> WhatsApp
                  </a>
                  <a href={`mailto:${CONTACT_EMAIL}`} className="flex items-center gap-3 text-sm font-semibold text-white/60 transition-colors hover:text-[#d8bd73]">
                    <Mail className="h-5 w-5" /> {CONTACT_EMAIL}
                  </a>
                </div>
              </div>
            </div>
            <div className="mt-10 flex flex-col items-center justify-between gap-4 border-t border-white/10 pt-7 text-xs font-medium text-white/30 sm:flex-row">
              <p>© {new Date().getFullYear()} GSA Enterprise Hub. Todos os direitos reservados.</p>
            </div>
          </div>
        </footer>
      ) : (
        <footer className="border-t border-black/[0.06] bg-white/40 py-10">
          <div className="mx-auto max-w-7xl px-5">
            <div className="flex flex-col items-center justify-between gap-4 sm:flex-row">
              <div className="flex items-center gap-3">
                <div className="flex h-7 w-7 items-center justify-center rounded-md bg-neutral-950">
                  <ShoppingCart className="h-3.5 w-3.5 text-[#d8bd73]" />
                </div>
                <span className="text-xs font-black uppercase tracking-tight text-neutral-400">GSA HUB · Marketplace</span>
              </div>
              <p className="text-[11px] font-medium text-neutral-400">
                © {new Date().getFullYear()} Grupo GSA · Soluções Digitais. Todos os direitos reservados.
              </p>
            </div>
          </div>
        </footer>
      )}
    </div>
  );
}
