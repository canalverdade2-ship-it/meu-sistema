import React, { useState, useEffect, useRef, useCallback } from 'react';
import { supabase } from '../../../lib/supabase';
import { EcommerceHeader } from './EcommerceHeader';
import { HeroBannerCarousel } from './HeroBannerCarousel';
import StoreItemCard from './StoreItemCard';
import {
  Loader2, TrendingUp, Zap, Clock, Star, ArrowRight,
  ShieldCheck, Truck, CreditCard, Award, Flame,
  Sparkles, ChevronRight, Tag, Package, Users,
  Laptop, Home, Shirt, FlaskConical, Plane, Wrench,
  Car, Gem, BadgePercent, MapPin, PhoneCall, RefreshCw,
  BarChart2
} from 'lucide-react';
import { navigate } from '../../../routing/navigationService';
import { routes } from '../../../routing/routeCatalog';
import { useSEO } from '../../../hooks/useSEO';

interface EcommerceHomeProps {
  clientId?: string;
  onRequireAuth?: () => void;
  onOpenCart?: () => void;
  cartItemCount?: number;
}

/* ─── Flash Sale Countdown Hook ─── */
function useCountdown(targetHour = 23) {
  const getTimeLeft = useCallback(() => {
    const now = new Date();
    const end = new Date();
    end.setHours(targetHour, 59, 59, 0);
    if (now > end) end.setDate(end.getDate() + 1);
    const diff = Math.max(0, end.getTime() - now.getTime());
    return {
      h: String(Math.floor(diff / 3600000)).padStart(2, '0'),
      m: String(Math.floor((diff % 3600000) / 60000)).padStart(2, '0'),
      s: String(Math.floor((diff % 60000) / 1000)).padStart(2, '0'),
    };
  }, [targetHour]);

  const [time, setTime] = useState(getTimeLeft());
  useEffect(() => {
    const id = setInterval(() => setTime(getTimeLeft()), 1000);
    return () => clearInterval(id);
  }, [getTimeLeft]);
  return time;
}

/* ─── Category definitions (SVG icons, NO emojis) ─── */
const CATEGORIES = [
  { name: 'Eletrônicos', Icon: Laptop,      color: '#2563eb', bg: '#eff6ff', filter: 'eletronicos' },
  { name: 'Casa & Eletro', Icon: Home,       color: '#d97706', bg: '#fffbeb', filter: 'casa' },
  { name: 'Moda & Estilo', Icon: Shirt,      color: '#db2777', bg: '#fdf2f8', filter: 'moda' },
  { name: 'Beleza & Saúde', Icon: FlaskConical, color: '#7c3aed', bg: '#f5f3ff', filter: 'beleza' },
  { name: 'Viagens', Icon: Plane,           color: '#0891b2', bg: '#ecfeff', route: 'travel' },
  { name: 'Serviços', Icon: Wrench,         color: '#16a34a', bg: '#f0fdf4', route: 'services' },
  { name: 'Classificados', Icon: Car,        color: '#1e293b', bg: '#f8fafc', route: 'classifieds' },
  { name: 'Clube VIP', Icon: Gem,           color: '#b45309', bg: '#fffbeb', route: 'vip' },
];

const TRUST_BADGES = [
  { Icon: ShieldCheck, title: 'Compra 100% Segura', sub: 'Ambiente criptografado SSL', color: '#2563eb' },
  { Icon: BadgePercent, title: 'Pontos GSA', sub: 'Ganhe em toda compra', color: '#d97706' },
  { Icon: Truck, title: 'Entrega Expressa', sub: 'Rastreamento em tempo real', color: '#16a34a' },
  { Icon: PhoneCall, title: 'Suporte 24 horas', sub: 'Atendimento especializado', color: '#7c3aed' },
];

/* ─── Horizontal Scroll Shelf ─── */
function HorizontalShelf({ items, showRanking = false }: { items: any[]; showRanking?: boolean }) {
  const ref = useRef<HTMLDivElement>(null);
  const scrollBy = (dir: number) => ref.current?.scrollBy({ left: dir * 280, behavior: 'smooth' });

  if (!items.length) return null;
  return (
    <div className="relative group/shelf">
      {/* Left arrow */}
      <button
        onClick={() => scrollBy(-1)}
        className="absolute -left-4 top-1/2 z-10 -translate-y-1/2 flex h-9 w-9 items-center justify-center rounded-full bg-white shadow-lg border border-gray-200 text-gray-600 opacity-0 group-hover/shelf:opacity-100 transition-opacity hover:bg-gray-50 cursor-pointer"
        aria-label="Rolar para esquerda"
      >
        <ChevronRight size={18} className="rotate-180" />
      </button>

      <div
        ref={ref}
        className="flex gap-3 overflow-x-auto scroll-smooth pb-2 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
      >
        {items.map((item, idx) => (
          <div key={item.id} className="relative w-[170px] sm:w-[200px] shrink-0">
            {showRanking && (
              <div className="absolute -left-1.5 -top-1.5 z-20 flex h-7 w-7 items-center justify-center rounded-full bg-gray-900 text-xs font-black text-white shadow-md ring-2 ring-white">
                {idx + 1}
              </div>
            )}
            <StoreItemCard
              item={item}
              tipo="produto"
              onAdd={() => navigate(routes.marketplace.store.product(item.id) + '?modal=quantidade')}
              onClick={() => navigate(routes.marketplace.store.product(item.id))}
            />
          </div>
        ))}
      </div>

      {/* Right arrow */}
      <button
        onClick={() => scrollBy(1)}
        className="absolute -right-4 top-1/2 z-10 -translate-y-1/2 flex h-9 w-9 items-center justify-center rounded-full bg-white shadow-lg border border-gray-200 text-gray-600 opacity-0 group-hover/shelf:opacity-100 transition-opacity hover:bg-gray-50 cursor-pointer"
        aria-label="Rolar para direita"
      >
        <ChevronRight size={18} />
      </button>
    </div>
  );
}

/* ─── Section Header ─── */
function SectionHeader({
  Icon, title, badge, subtitle, actionLabel, onAction,
}: {
  Icon?: any; title: string; badge?: string; subtitle?: string;
  actionLabel?: string; onAction?: () => void;
}) {
  return (
    <div className="mb-5 flex items-end justify-between">
      <div>
        <div className="flex items-center gap-2.5">
          {Icon && <Icon size={22} className="text-[#17345f] shrink-0" strokeWidth={2} />}
          <h2 className="text-xl font-black text-gray-900 sm:text-2xl tracking-tight">{title}</h2>
          {badge && (
            <span className="rounded-full bg-rose-600 px-2.5 py-0.5 text-[11px] font-black uppercase tracking-widest text-white shadow-sm">
              {badge}
            </span>
          )}
        </div>
        {subtitle && <p className="mt-0.5 text-xs text-gray-500 font-medium">{subtitle}</p>}
      </div>
      {actionLabel && onAction && (
        <button
          onClick={onAction}
          className="group flex items-center gap-1 text-xs font-bold text-[#17345f] hover:text-[#0f2342] transition-colors cursor-pointer shrink-0 ml-4"
        >
          {actionLabel}
          <ArrowRight size={14} className="transition-transform group-hover:translate-x-0.5" />
        </button>
      )}
    </div>
  );
}

/* ─── Flash Sale Timer ─── */
function FlashSaleTimer() {
  const { h, m, s } = useCountdown(23);
  return (
    <div className="flex items-center gap-2">
      <Flame size={16} className="text-orange-500 animate-pulse shrink-0" />
      <span className="text-xs font-extrabold text-gray-700 uppercase tracking-wider hidden sm:inline">Termina em</span>
      <div className="flex items-center gap-1 font-mono text-sm font-black text-gray-900">
        <span className="flex h-7 min-w-[30px] items-center justify-center rounded-md bg-gray-900 px-1.5 text-white">{h}</span>
        <span className="text-gray-500">:</span>
        <span className="flex h-7 min-w-[30px] items-center justify-center rounded-md bg-gray-900 px-1.5 text-white">{m}</span>
        <span className="text-gray-500">:</span>
        <span className="flex h-7 min-w-[30px] items-center justify-center rounded-md bg-rose-600 px-1.5 text-white animate-pulse">{s}</span>
      </div>
    </div>
  );
}

/* ─── Main Component ─── */
export function EcommerceHome({
  clientId,
  onRequireAuth,
  onOpenCart = () => {},
  cartItemCount = 0,
}: EcommerceHomeProps) {
  const [loading, setLoading] = useState(true);
  const [maisVendidos, setMaisVendidos] = useState<any[]>([]);
  const [novidades, setNovidades] = useState<any[]>([]);
  const [ofertas, setOfertas] = useState<any[]>([]);
  const [recomendados, setRecomendados] = useState<any[]>([]);
  const [localCartCount, setLocalCartCount] = useState(cartItemCount);

  useEffect(() => { setLocalCartCount(cartItemCount); }, [cartItemCount]);

  useSEO({
    title: 'GSA Store — Marketplace Completo | Produtos, Serviços & Viagens',
    description: 'Encontre os melhores produtos, assinaturas e serviços na GSA Store com Frete Grátis, Pontos GSA e preços imperdíveis.',
    type: 'website',
  });

  /* Cart count from DB */
  useEffect(() => {
    if (clientId && cartItemCount === 0) {
      supabase.from('loja_carrinhos').select('quantidade').eq('cliente_id', clientId)
        .then(({ data }) => {
          if (data) setLocalCartCount(data.reduce((a, c) => a + (c.quantidade || 1), 0));
        });
    }
  }, [clientId, cartItemCount]);

  /* Home data fetch */
  useEffect(() => {
    (async () => {
      setLoading(true);
      try {
        const { data } = await supabase
          .from('produtos')
          .select('*')
          .eq('status', 'ativo')
          .eq('visivel_na_loja', true)
          .order('created_at', { ascending: false })
          .limit(60);

        if (data) {
          setNovidades(data.slice(0, 12));
          setMaisVendidos([...data].sort(() => 0.5 - Math.random()).slice(0, 12));
          const withDiscount = data.filter(p => p.valor_promocional && p.valor_promocional < p.valor);
          setOfertas(withDiscount.length >= 6 ? withDiscount.slice(0, 12) : data.slice(3, 15));
          setRecomendados([...data].sort(() => 0.5 - Math.random()).slice(0, 8));
        }
      } catch (err) {
        console.error('Erro home:', err);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const goCategory = (cat: typeof CATEGORIES[0]) => {
    if (cat.route === 'travel') navigate(routes.marketplace.travelPackages.root());
    else if (cat.route === 'services') navigate(routes.public.services());
    else if (cat.route === 'classifieds') navigate(routes.marketplace.classifieds.root());
    else if (cat.route === 'vip') navigate(routes.marketplace.store.vip());
    else navigate(routes.marketplace.store.products());
  };

  return (
    <div className="min-h-screen bg-[#f4f5f7]">
      <EcommerceHeader
        clientId={clientId}
        cartItemCount={localCartCount}
        onOpenCart={onOpenCart}
        onRequireAuth={onRequireAuth}
      />

      <main>

        {/* ── Hero Carousel ── */}
        <HeroBannerCarousel />

        {/* ── Trust Bar (Amazon/ML style, below fold) ── */}
        <div className="bg-white border-b border-gray-200 shadow-sm">
          <div className="mx-auto grid max-w-7xl grid-cols-2 sm:grid-cols-4 divide-x divide-gray-100 px-4">
            {TRUST_BADGES.map(({ Icon, title, sub, color }, i) => (
              <div key={i} className="flex items-center gap-3 px-4 py-4 sm:py-3">
                <div
                  className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl"
                  style={{ backgroundColor: color + '15', color }}
                >
                  <Icon size={18} strokeWidth={1.75} />
                </div>
                <div className="min-w-0">
                  <p className="truncate text-[11px] font-black text-gray-900 sm:text-xs">{title}</p>
                  <p className="truncate text-[10px] text-gray-400 font-medium">{sub}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8 space-y-8">

          {/* ── Categories Grid (Shopee style with REAL icons) ── */}
          <section className="rounded-2xl bg-white p-5 shadow-sm border border-gray-100">
            <p className="mb-4 text-[11px] font-black uppercase tracking-widest text-gray-400">Departamentos</p>
            <div className="grid grid-cols-4 gap-3 sm:grid-cols-8">
              {CATEGORIES.map((cat, i) => (
                <button
                  key={i}
                  onClick={() => goCategory(cat)}
                  className="group flex cursor-pointer flex-col items-center gap-2 rounded-xl p-2 transition-all hover:bg-gray-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#17345f]"
                >
                  <div
                    className="flex h-14 w-14 sm:h-16 sm:w-16 items-center justify-center rounded-2xl transition-transform group-hover:scale-105 group-hover:shadow-md"
                    style={{ backgroundColor: cat.bg, color: cat.color }}
                  >
                    <cat.Icon size={26} strokeWidth={1.75} />
                  </div>
                  <span className="text-center text-[11px] font-bold text-gray-700 group-hover:text-[#17345f] leading-tight line-clamp-2">
                    {cat.name}
                  </span>
                </button>
              ))}
            </div>
          </section>

          {loading ? (
            <div className="flex h-56 items-center justify-center rounded-2xl bg-white">
              <div className="flex flex-col items-center gap-3">
                <Loader2 className="h-7 w-7 animate-spin text-[#17345f]" />
                <p className="text-xs text-gray-400 font-medium">Carregando produtos...</p>
              </div>
            </div>
          ) : (
            <>

              {/* ── Flash Sale ── */}
              {ofertas.length > 0 && (
                <section className="overflow-hidden rounded-2xl bg-white shadow-sm border border-gray-100">
                  {/* Header com gradiente vermelho sutil */}
                  <div className="flex items-center justify-between border-b border-gray-100 bg-gradient-to-r from-rose-50 to-orange-50 px-5 py-4">
                    <div className="flex items-center gap-3">
                      <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-rose-600 text-white shadow-sm">
                        <Zap size={18} strokeWidth={2.5} />
                      </div>
                      <div>
                        <h2 className="text-base font-black text-gray-900 sm:text-lg leading-none">Oferta Relâmpago</h2>
                        <p className="mt-0.5 text-[11px] text-gray-500 font-medium">Preços imperdíveis por tempo limitado</p>
                      </div>
                      <span className="hidden sm:inline rounded-full bg-rose-600 px-2.5 py-0.5 text-[11px] font-black uppercase tracking-widest text-white">Hoje</span>
                    </div>
                    <div className="flex items-center gap-4">
                      <FlashSaleTimer />
                      <button
                        onClick={() => navigate(routes.marketplace.store.products() + '?filtro=ofertas')}
                        className="hidden sm:flex items-center gap-1 text-xs font-bold text-rose-600 hover:text-rose-700 cursor-pointer"
                      >
                        Ver todas <ArrowRight size={13} />
                      </button>
                    </div>
                  </div>
                  <div className="p-5">
                    <HorizontalShelf items={ofertas} />
                  </div>
                </section>
              )}

              {/* ── Duplo Banner Intermediário (Magazine Luiza / Shopee style) ── */}
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                {/* Banner 1 — VIP */}
                <div
                  onClick={() => navigate(routes.marketplace.store.vip())}
                  className="group relative overflow-hidden rounded-2xl bg-[#17345f] cursor-pointer transition-all hover:shadow-xl hover:scale-[1.01]"
                  style={{ minHeight: '160px' }}
                >
                  <div className="absolute inset-0 bg-gradient-to-br from-[#17345f] via-[#1e4a8a] to-[#0d2240]" />
                  <div className="absolute -right-8 -bottom-8 h-44 w-44 rounded-full bg-white/5 blur-2xl" />
                  <div className="absolute -right-4 -top-4 h-24 w-24 rounded-full bg-amber-400/10" />
                  <div className="relative z-10 flex h-full flex-col justify-between p-6">
                    <div>
                      <span className="rounded-full bg-amber-400/20 border border-amber-400/30 px-3 py-1 text-[10px] font-black uppercase tracking-widest text-amber-400">
                        Clube VIP
                      </span>
                      <h3 className="mt-3 text-xl font-black text-white leading-tight">
                        Economize até <span className="text-amber-400">30%</span> em cada compra
                      </h3>
                      <p className="mt-1.5 text-xs text-white/70 font-medium leading-relaxed">
                        Pontos acumulativos e resgate via PIX
                      </p>
                    </div>
                    <span className="mt-4 inline-flex items-center gap-1.5 text-xs font-black text-amber-400 group-hover:gap-2.5 transition-all">
                      Conhecer o Programa <ArrowRight size={14} />
                    </span>
                  </div>
                </div>

                {/* Banner 2 — Frete Grátis */}
                <div
                  onClick={() => navigate(routes.marketplace.store.products())}
                  className="group relative overflow-hidden rounded-2xl cursor-pointer transition-all hover:shadow-xl hover:scale-[1.01]"
                  style={{ minHeight: '160px', background: 'linear-gradient(135deg, #16a34a 0%, #15803d 100%)' }}
                >
                  <div className="absolute -left-8 -top-8 h-40 w-40 rounded-full bg-white/5 blur-2xl" />
                  <div className="absolute right-4 bottom-4 h-20 w-20 rounded-full bg-white/10" />
                  <div className="relative z-10 flex h-full flex-col justify-between p-6">
                    <div>
                      <span className="rounded-full bg-white/20 px-3 py-1 text-[10px] font-black uppercase tracking-widest text-white">
                        Frete Grátis
                      </span>
                      <h3 className="mt-3 text-xl font-black text-white leading-tight">
                        Grátis em compras <span className="text-emerald-300">acima de R$ 99</span>
                      </h3>
                      <p className="mt-1.5 text-xs text-white/80 font-medium leading-relaxed">
                        Entrega expressa para todo o Brasil
                      </p>
                    </div>
                    <span className="mt-4 inline-flex items-center gap-1.5 text-xs font-black text-white group-hover:gap-2.5 transition-all">
                      Ver produtos elegíveis <ArrowRight size={14} />
                    </span>
                  </div>
                </div>
              </div>

              {/* ── Mais Vendidos ── */}
              {maisVendidos.length > 0 && (
                <section className="overflow-hidden rounded-2xl bg-white shadow-sm border border-gray-100 p-5">
                  <div className="mb-5 flex items-end justify-between">
                    <div className="flex items-center gap-3">
                      <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-[#17345f] text-white shadow-sm">
                        <TrendingUp size={18} strokeWidth={2} />
                      </div>
                      <div>
                        <h2 className="text-base font-black text-gray-900 sm:text-lg leading-none">Mais Vendidos</h2>
                        <p className="mt-0.5 text-[11px] text-gray-500 font-medium">Favoritos da comunidade GSA</p>
                      </div>
                    </div>
                    <button
                      onClick={() => navigate(routes.marketplace.store.products() + '?filtro=mais-vendidos')}
                      className="flex items-center gap-1 text-xs font-bold text-[#17345f] hover:underline cursor-pointer"
                    >
                      Ver todos <ChevronRight size={14} />
                    </button>
                  </div>
                  <HorizontalShelf items={maisVendidos} showRanking />
                </section>
              )}

              {/* ── Banner Único Wide (Shopee / ML style) ── */}
              <div
                onClick={() => navigate(routes.marketplace.store.products())}
                className="group relative overflow-hidden rounded-2xl cursor-pointer transition-all hover:shadow-xl"
                style={{ minHeight: '130px', background: 'linear-gradient(120deg, #1e293b 0%, #17345f 60%, #1e4a8a 100%)' }}
              >
                <div className="absolute right-0 top-0 bottom-0 w-1/3 bg-gradient-to-l from-amber-400/10 to-transparent" />
                <div className="absolute right-8 top-1/2 -translate-y-1/2 opacity-10">
                  <Package size={96} className="text-white" />
                </div>
                <div className="relative z-10 flex h-full items-center justify-between p-6 sm:p-8">
                  <div>
                    <span className="rounded-full bg-amber-400 px-3 py-1 text-[10px] font-black uppercase tracking-widest text-gray-900">
                      Novidade
                    </span>
                    <h3 className="mt-2 text-2xl font-black text-white sm:text-3xl leading-tight">
                      Novidades & Lançamentos
                    </h3>
                    <p className="mt-1 text-sm text-white/70 font-medium">
                      Os produtos que acabaram de chegar no catálogo GSA
                    </p>
                  </div>
                  <button className="hidden sm:flex shrink-0 items-center gap-2 rounded-xl bg-white px-6 py-3 text-xs font-black text-[#17345f] shadow-xl transition-all group-hover:bg-amber-400 group-hover:text-gray-900 cursor-pointer">
                    Ver Lançamentos <ArrowRight size={14} />
                  </button>
                </div>
              </div>

              {/* ── Novidades ── */}
              {novidades.length > 0 && (
                <section className="overflow-hidden rounded-2xl bg-white shadow-sm border border-gray-100 p-5">
                  <div className="mb-5 flex items-end justify-between">
                    <div className="flex items-center gap-3">
                      <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-indigo-600 text-white shadow-sm">
                        <Sparkles size={18} strokeWidth={2} />
                      </div>
                      <div>
                        <h2 className="text-base font-black text-gray-900 sm:text-lg leading-none">Novidades & Lançamentos</h2>
                        <p className="mt-0.5 text-[11px] text-gray-500 font-medium">Chegaram agora no catálogo GSA</p>
                      </div>
                    </div>
                    <button
                      onClick={() => navigate(routes.marketplace.store.products() + '?filtro=novidades')}
                      className="flex items-center gap-1 text-xs font-bold text-[#17345f] hover:underline cursor-pointer"
                    >
                      Ver todas <ChevronRight size={14} />
                    </button>
                  </div>
                  <HorizontalShelf items={novidades} />
                </section>
              )}

              {/* ── Recomendados ── */}
              {recomendados.length > 0 && clientId && (
                <section className="overflow-hidden rounded-2xl bg-gradient-to-br from-indigo-50 to-white shadow-sm border border-indigo-100 p-5">
                  <div className="mb-5 flex items-end justify-between">
                    <div className="flex items-center gap-3">
                      <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-indigo-600 text-white shadow-sm">
                        <Star size={18} strokeWidth={2} />
                      </div>
                      <div>
                        <h2 className="text-base font-black text-gray-900 sm:text-lg leading-none">Recomendados para Você</h2>
                        <p className="mt-0.5 text-[11px] text-gray-500 font-medium">Com base no seu perfil de compras</p>
                      </div>
                    </div>
                    <button
                      onClick={() => navigate(routes.marketplace.store.products())}
                      className="flex items-center gap-1 text-xs font-bold text-[#17345f] hover:underline cursor-pointer"
                    >
                      Ver mais <ChevronRight size={14} />
                    </button>
                  </div>
                  <HorizontalShelf items={recomendados} />
                </section>
              )}

              {/* ── Stats / Prova Social (Magazine Luiza style) ── */}
              <section className="rounded-2xl border border-gray-100 bg-white p-6 shadow-sm sm:p-8">
                <div className="grid grid-cols-1 gap-6 sm:grid-cols-3">
                  {[
                    { Icon: Users,    stat: '+45.000',   label: 'Clientes Ativos',        sub: 'Confiam no ecossistema GSA', color: '#2563eb' },
                    { Icon: Package,  stat: '+12.000',   label: 'Produtos Disponíveis',   sub: 'Catálogo atualizado diariamente', color: '#16a34a' },
                    { Icon: BarChart2, stat: '99,1%',    label: 'Avaliações Positivas',   sub: 'Satisfação dos compradores GSA', color: '#d97706' },
                  ].map(({ Icon: I, stat, label, sub, color }, i) => (
                    <div key={i} className="flex items-center gap-4">
                      <div
                        className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl"
                        style={{ background: color + '15', color }}
                      >
                        <I size={26} strokeWidth={1.75} />
                      </div>
                      <div>
                        <p className="text-2xl font-black text-gray-900 sm:text-3xl">{stat}</p>
                        <p className="text-sm font-bold text-gray-800">{label}</p>
                        <p className="text-xs text-gray-400 font-medium">{sub}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </section>

              {/* ── Pagamento & Garantias Footer Strip ── */}
              <section className="rounded-2xl border border-gray-100 bg-white p-6 shadow-sm">
                <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
                  {[
                    {
                      Icon: CreditCard, color: '#2563eb',
                      title: 'Pagamento Facilitado',
                      desc: 'Pague via Pix instantâneo, Cartão de Crédito em até 10× sem juros ou use seu Crédito GSA.',
                    },
                    {
                      Icon: Truck, color: '#16a34a',
                      title: 'Envio Seguro & Rastreável',
                      desc: 'Rastreamento em tempo real do pedido desde a confirmação do pagamento até a entrega na sua porta.',
                    },
                    {
                      Icon: RefreshCw, color: '#d97706',
                      title: 'Garantia & Devolução GSA',
                      desc: 'Seu dinheiro 100% protegido. Garantia de troca ou reembolso em até 7 dias após o recebimento.',
                    },
                  ].map(({ Icon: I, color, title, desc }, i) => (
                    <div key={i} className="flex items-start gap-4">
                      <div
                        className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl"
                        style={{ background: color + '15', color }}
                      >
                        <I size={22} strokeWidth={1.75} />
                      </div>
                      <div>
                        <h4 className="text-sm font-black text-gray-900">{title}</h4>
                        <p className="mt-1 text-xs text-gray-500 leading-relaxed">{desc}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </section>

            </>
          )}
        </div>
      </main>

      {/* ── Footer Mini ── */}
      <footer className="mt-4 border-t border-gray-200 bg-white py-6 text-center">
        <p className="text-xs text-gray-400">
          © 2026 <strong className="text-gray-600">GSA HUB</strong> — Gestão de Serviços & Tecnologia. Todos os direitos reservados.
        </p>
        <div className="mt-3 flex flex-wrap items-center justify-center gap-4">
          {[
            ['Termos de Uso', '#'],
            ['Política de Privacidade', '#'],
            ['Central de Ajuda', '#'],
            ['Vender no GSA', routes.public.services()],
          ].map(([label, href], i) => (
            <button
              key={i}
              onClick={() => href !== '#' && navigate(href)}
              className="text-xs text-gray-400 hover:text-gray-700 transition-colors cursor-pointer"
            >
              {label}
            </button>
          ))}
        </div>
      </footer>
    </div>
  );
}

export default EcommerceHome;
