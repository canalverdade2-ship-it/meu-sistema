import React, { useState, useEffect } from 'react';
import { supabase } from '../../../lib/supabase';
import { EcommerceHeader } from './EcommerceHeader';
import { HeroBannerCarousel } from './HeroBannerCarousel';
import StoreItemCard from './StoreItemCard';
import { Loader2, TrendingUp, Zap, Clock, Star, ArrowRight, ShieldCheck, Truck, CreditCard, Award, Flame, Sparkles } from 'lucide-react';
import { navigate } from '../../../routing/navigationService';
import { routes } from '../../../routing/routeCatalog';
import { useSEO } from '../../../hooks/useSEO';

interface EcommerceHomeProps {
  clientId?: string;
  onRequireAuth?: () => void;
  onOpenCart?: () => void;
  cartItemCount?: number;
}

export function EcommerceHome({
  clientId,
  onRequireAuth,
  onOpenCart = () => {},
  cartItemCount = 0
}: EcommerceHomeProps) {
  const [loading, setLoading] = useState(true);
  const [produtos, setProdutos] = useState<any[]>([]);
  const [maisVendidos, setMaisVendidos] = useState<any[]>([]);
  const [novidades, setNovidades] = useState<any[]>([]);
  const [ofertas, setOfertas] = useState<any[]>([]);
  const [recomendados, setRecomendados] = useState<any[]>([]);
  const [localCartCount, setLocalCartCount] = useState(cartItemCount);

  useEffect(() => {
    setLocalCartCount(cartItemCount);
  }, [cartItemCount]);

  useSEO({
    title: 'GSA Store - O Seu Marketplace Completo',
    description: 'Encontre os melhores produtos, assinaturas, viagens e serviços na GSA Store com frete grátis e preços imperdíveis.',
    type: 'website'
  });

  useEffect(() => {
    if (clientId && cartItemCount === 0) {
      const fetchCart = async () => {
        try {
          const { data, error } = await supabase
            .from('loja_carrinhos')
            .select('quantidade')
            .eq('cliente_id', clientId);
          
          if (data && !error) {
            const count = data.reduce((acc, curr) => acc + (curr.quantidade || 1), 0);
            setLocalCartCount(count);
          }
        } catch (err) {
          console.error('Erro ao buscar carrinho:', err);
        }
      };
      fetchCart();
    }
  }, [clientId, cartItemCount]);

  useEffect(() => {
    const fetchHomeData = async () => {
      setLoading(true);
      try {
        const { data, error } = await supabase
          .from('produtos')
          .select('*')
          .eq('status', 'ativo')
          .eq('visivel_na_loja', true)
          .order('created_at', { ascending: false })
          .limit(50);

        if (data && !error) {
          setProdutos(data);
          setNovidades(data.slice(0, 8));
          
          const shuffled = [...data].sort(() => 0.5 - Math.random());
          setMaisVendidos(shuffled.slice(0, 8));
          
          const comDesconto = data.filter(p => p.valor_promocional && p.valor_promocional < p.valor);
          setOfertas(comDesconto.length >= 4 ? comDesconto.slice(0, 8) : data.slice(5, 13));

          const shuffledRec = [...data].sort(() => 0.5 - Math.random());
          setRecomendados(shuffledRec.slice(0, 4));
        }
      } catch (error) {
        console.error('Erro ao carregar dados da home:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchHomeData();
  }, []);

  const ShelfHeader = ({ title, icon: Icon, subtitle, actionText, onAction, tag }: any) => (
    <div className="mb-6 flex flex-col sm:flex-row sm:items-end justify-between gap-4 border-b border-slate-200/80 pb-4">
      <div>
        <div className="flex items-center gap-2.5 text-[#17345f]">
          {Icon && <Icon className="h-6 w-6 text-[#17345f]" strokeWidth={2.5} />}
          <h2 className="text-2xl sm:text-3xl font-black tracking-tight text-slate-900">{title}</h2>
          {tag && (
            <span className="rounded-full bg-rose-100 px-2.5 py-0.5 text-xs font-black text-rose-600 uppercase tracking-wider">
              {tag}
            </span>
          )}
        </div>
        {subtitle && <p className="mt-1 text-sm font-medium text-slate-500">{subtitle}</p>}
      </div>
      {actionText && (
        <button 
          onClick={onAction}
          className="group flex items-center gap-1.5 text-sm font-extrabold text-[#a77a2c] transition-colors hover:text-[#8b6729] cursor-pointer"
        >
          {actionText}
          <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
        </button>
      )}
    </div>
  );

  const ProductGrid = ({ items, showRanking }: { items: any[]; showRanking?: boolean }) => (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:gap-5">
      {items.map((item, idx) => (
        <div key={item.id} className="relative">
          {showRanking && (
            <div className="absolute -left-2 -top-2 z-20 flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-amber-400 to-amber-600 text-sm font-black text-slate-950 shadow-lg ring-2 ring-white">
              #{idx + 1}
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
  );

  // Categorias estilo Shopee / Magalu (Bubbles Circulares)
  const categoryBubbles = [
    { name: 'Eletrônicos', icon: '💻', color: 'from-blue-500 to-indigo-600', filter: 'eletronicos' },
    { name: 'Casa & Eletro', icon: '🏠', color: 'from-amber-500 to-orange-600', filter: 'casa' },
    { name: 'Moda & Estilo', icon: '👕', color: 'from-pink-500 to-rose-600', filter: 'moda' },
    { name: 'Beleza & Saúde', icon: '✨', color: 'from-purple-500 to-indigo-600', filter: 'beleza' },
    { name: 'Viagens', icon: '✈️', color: 'from-cyan-500 to-blue-600', route: routes.marketplace.travelPackages.root() },
    { name: 'Serviços', icon: '🔧', color: 'from-emerald-500 to-teal-600', route: routes.public.services() },
    { name: 'Classificados', icon: '🚗', color: 'from-[#17345f] to-slate-900', route: routes.marketplace.classifieds.root() },
    { name: 'Clube VIP', icon: '💎', color: 'from-amber-400 to-[#a77a2c]', route: routes.marketplace.store.vip() },
  ];

  return (
    <div className="min-h-screen bg-[#f8fafc]">
      <EcommerceHeader 
        clientId={clientId}
        cartItemCount={localCartCount}
        onOpenCart={onOpenCart}
        onRequireAuth={onRequireAuth}
      />
      
      <main className="pb-24">
        {/* Banner Hero Carrossel */}
        <section className="mb-8">
          <HeroBannerCarousel />
        </section>

        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 space-y-12">
          
          {/* Ticker de Garantias & Benefícios Rápidos */}
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 rounded-2xl bg-white p-4 shadow-sm border border-slate-200">
            {[
              { title: 'Pagamento Seguro', desc: 'Ambiente 100% protegido', icon: ShieldCheck },
              { title: 'Pontos GSA', desc: 'Ganhe em todas as compras', icon: Award },
              { title: 'Entrega Expressa', desc: 'Receba mais rápido', icon: Truck },
              { title: 'Atendimento 24h', desc: 'Suporte especializado', icon: Clock },
            ].map((b, i) => (
              <div key={i} className="flex items-center gap-3 p-2">
                <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-[#17345f]/10 text-[#17345f]">
                  <b.icon className="h-5 w-5" />
                </div>
                <div>
                  <h3 className="text-xs font-bold text-slate-900 sm:text-sm">{b.title}</h3>
                  <p className="text-[11px] font-medium text-slate-500">{b.desc}</p>
                </div>
              </div>
            ))}
          </div>

          {/* Grid de Bolhas de Categorias (Shopee / Magalu Style) */}
          <section className="rounded-3xl bg-white p-6 shadow-sm border border-slate-200/80">
            <h2 className="mb-4 text-xs font-black uppercase tracking-widest text-slate-400">
              Navegue por Categorias em Destaque
            </h2>
            <div className="grid grid-cols-4 gap-4 sm:grid-cols-8">
              {categoryBubbles.map((cat, i) => (
                <div
                  key={i}
                  onClick={() => {
                    if (cat.route) navigate(cat.route);
                    else navigate(routes.marketplace.store.products());
                  }}
                  className="gsa-category-bubble flex cursor-pointer flex-col items-center gap-2 group"
                >
                  <div className={`flex h-16 w-16 sm:h-20 sm:w-20 items-center justify-center rounded-2xl bg-gradient-to-br ${cat.color} text-2xl sm:text-3xl text-white shadow-md shadow-slate-200 transition-all group-hover:shadow-lg`}>
                    {cat.icon}
                  </div>
                  <span className="text-center text-xs font-bold text-slate-700 group-hover:text-[#17345f] line-clamp-1">
                    {cat.name}
                  </span>
                </div>
              ))}
            </div>
          </section>

          {loading ? (
            <div className="flex h-64 items-center justify-center">
              <Loader2 className="h-8 w-8 animate-spin text-[#17345f]" />
            </div>
          ) : (
            <>
              {/* Prateleira Inteligente: Recomendados para Você */}
              {recomendados.length > 0 && (
                <section className="relative rounded-3xl bg-gradient-to-br from-indigo-50/70 via-white to-slate-50 p-6 shadow-sm ring-1 ring-slate-200 sm:p-8">
                  <ShelfHeader 
                    title="Recomendados para Você" 
                    icon={Star} 
                    subtitle="Baseado no seu histórico e preferências de compra" 
                    actionText="Ver recomendados"
                    onAction={() => navigate(routes.marketplace.store.products() + '?filtro=recomendados')}
                  />
                  <div className="relative z-10">
                    <ProductGrid items={recomendados} />
                  </div>
                </section>
              )}

              {/* Prateleira 1: Ofertas Relâmpago */}
              <section className="rounded-3xl bg-white p-6 shadow-sm border border-slate-200/80 sm:p-8">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-4">
                  <ShelfHeader 
                    title="Ofertas Relâmpago" 
                    icon={Zap} 
                    subtitle="Preços imperdíveis por tempo limitado" 
                    actionText="Ver todas as ofertas"
                    onAction={() => navigate(routes.marketplace.store.products() + '?filtro=ofertas')}
                    tag="HOJE"
                  />
                  <div className="flex items-center gap-2 bg-rose-50 text-rose-700 px-4 py-2 rounded-xl border border-rose-200 w-fit">
                    <Flame className="w-4 h-4 text-rose-600 animate-pulse" />
                    <span className="text-xs font-extrabold uppercase tracking-wider">Termina em:</span>
                    <div className="flex gap-1 text-sm font-black font-mono">
                      <span className="bg-white px-1.5 py-0.5 rounded border border-rose-200 text-rose-800">03</span>:
                      <span className="bg-white px-1.5 py-0.5 rounded border border-rose-200 text-rose-800">45</span>:
                      <span className="bg-white px-1.5 py-0.5 rounded border border-rose-200 text-rose-800">12</span>
                    </div>
                  </div>
                </div>
                <ProductGrid items={ofertas} />
              </section>

              {/* Banner Promocional Intermediário */}
              <section className="relative overflow-hidden rounded-3xl bg-[#17345f] shadow-lg">
                <div className="absolute inset-0 bg-gradient-to-r from-[#0f2342] via-[#17345f]/90 to-transparent z-10" />
                <img 
                  src="https://images.unsplash.com/photo-1556740738-b6a63e27c4df?auto=format&fit=crop&w=1200&q=80" 
                  alt="Banner promocional" 
                  className="absolute inset-0 h-full w-full object-cover opacity-40"
                />
                <div className="relative z-20 flex flex-col items-start justify-center p-8 sm:p-12 md:w-3/5">
                  <span className="mb-3 rounded-full bg-[#d8bd73] px-3.5 py-1 text-xs font-black uppercase tracking-wider text-slate-950 shadow-sm">
                    Programa VIP GSA
                  </span>
                  <h3 className="text-3xl sm:text-4xl font-black text-white leading-tight">
                    Preços Exclusivos e Cashback em Todas as Compras
                  </h3>
                  <p className="mt-3 text-white/90 font-medium leading-relaxed">
                    Faça parte do nosso programa de fidelidade e garanta descontos adicionais e pontos acumulativos.
                  </p>
                  <button 
                    onClick={() => navigate(routes.marketplace.store.vip())}
                    className="mt-6 rounded-xl bg-white px-7 py-3.5 text-sm font-extrabold text-[#17345f] transition-all hover:bg-slate-100 shadow-xl cursor-pointer hover:scale-105 active:scale-95"
                  >
                    Conhecer o Programa VIP
                  </button>
                </div>
              </section>

              {/* Prateleira 2: Mais Vendidos */}
              <section className="rounded-3xl bg-white p-6 shadow-sm border border-slate-200/80 sm:p-8">
                <ShelfHeader 
                  title="Mais Vendidos" 
                  icon={TrendingUp} 
                  subtitle="Os favoritos e mais comprados da nossa comunidade" 
                  actionText="Ver mais vendidos"
                  onAction={() => navigate(routes.marketplace.store.products() + '?filtro=mais-vendidos')}
                />
                <ProductGrid items={maisVendidos} showRanking />
              </section>

              {/* Prateleira 3: Novidades */}
              <section className="rounded-3xl bg-white p-6 shadow-sm border border-slate-200/80 sm:p-8">
                <ShelfHeader 
                  title="Novidades & Lançamentos" 
                  icon={Sparkles} 
                  subtitle="Acabaram de chegar no nosso catálogo" 
                  actionText="Ver lançamentos"
                  onAction={() => navigate(routes.marketplace.store.products() + '?filtro=novidades')}
                />
                <ProductGrid items={novidades} />
              </section>

              {/* Footer Trust & Formas de Pagamento (Mercado Livre Standard) */}
              <section className="rounded-3xl bg-white p-8 shadow-sm border border-slate-200">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                  <div className="flex items-start gap-4">
                    <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-indigo-50 text-[#17345f]">
                      <CreditCard className="h-6 w-6" />
                    </div>
                    <div>
                      <h4 className="text-base font-black text-slate-900">Pagamento Facilitado</h4>
                      <p className="mt-1 text-xs text-slate-500 leading-relaxed">
                        Pague com Pix instantâneo, Cartão de Crédito em até 10x sem juros ou Crédito GSA.
                      </p>
                    </div>
                  </div>

                  <div className="flex items-start gap-4">
                    <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-emerald-50 text-emerald-600">
                      <Truck className="h-6 w-6" />
                    </div>
                    <div>
                      <h4 className="text-base font-black text-slate-900">Envio Seguro e Rápido</h4>
                      <p className="mt-1 text-xs text-slate-500 leading-relaxed">
                        Rastreamento em tempo real do seu pedido desde a confirmação até a entrega final.
                      </p>
                    </div>
                  </div>

                  <div className="flex items-start gap-4">
                    <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-amber-50 text-[#a77a2c]">
                      <ShieldCheck className="h-6 w-6" />
                    </div>
                    <div>
                      <h4 className="text-base font-black text-slate-900">Garantia GSA Store</h4>
                      <p className="mt-1 text-xs text-slate-500 leading-relaxed">
                        Seu dinheiro protegido. Garantia de troca ou devolução simplificada.
                      </p>
                    </div>
                  </div>
                </div>
              </section>

            </>
          )}
        </div>
      </main>
    </div>
  );
}

export default EcommerceHome;

