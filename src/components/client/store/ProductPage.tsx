import React, { useState, useEffect, useMemo } from 'react';
import { 
  ArrowLeft, 
  ShoppingCart, 
  Heart, 
  Star, 
  ShieldCheck, 
  Truck, 
  Share2,
  ChevronRight,
  Minus,
  Plus,
  Gift,
  Eye,
  Package,
  Check,
  MessageCircle,
  ArrowRight,
  CreditCard,
  QrCode,
  RotateCcw
} from 'lucide-react';
import { supabase } from '../../../lib/supabase';
import { formatCurrency } from '../../../lib/utils';
import { navigate } from '../../../routing/navigationService';
import { routes } from '../../../routing/routeCatalog';
import { EcommerceHeader } from './EcommerceHeader';
import { ProductShareModal } from './ProductShareModal';
import { GroupBuyModal } from './GroupBuyModal';
import { ProductReviews } from './ProductReviews';
import { calculateProductRating } from '../../../lib/productRatings';
import { getProductEffectivePrice, getProductDiscountPercentage, hasActiveProductDiscount } from '../../../lib/productPricing';
import { useSEO } from '../../../hooks/useSEO';
import { clientOperationalWrite } from '../../../lib/clientOperationalWrite';
import { isInWishlist, toggleWishlist } from '../../../lib/wishlistStorage';
import { toast } from 'react-hot-toast';

interface ProductPageProps {
  productId: string;
  clientId?: string;
  onRequireAuth?: () => void;
}

export function ProductPage({ productId, clientId, onRequireAuth }: ProductPageProps) {
  const [product, setProduct] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [activeImage, setActiveImage] = useState(0);
  const [quantity, setQuantity] = useState(1);
  const [cartCount, setCartCount] = useState(0);
  const [isShareModalOpen, setIsShareModalOpen] = useState(false);
  const [isGroupBuyModalOpen, setIsGroupBuyModalOpen] = useState(false);
  const [relatedProducts, setRelatedProducts] = useState<any[]>([]);
  const [isAddingToCart, setIsAddingToCart] = useState(false);
  const [isWishlisted, setIsWishlisted] = useState(false);

  // Estados de Avaliações Reais e Presença em Tempo Real
  const [displayRating, setDisplayRating] = useState(4.9);
  const [displayRatingCount, setDisplayRatingCount] = useState(0);
  const [realViewersCount, setRealViewersCount] = useState(1);

  useEffect(() => {
    let isMounted = true;

    const fetchProduct = async () => {
      if (!productId) {
        setLoading(false);
        return;
      }

      setLoading(true);
      try {
        let { data, error } = await supabase
          .from('produtos')
          .select('*, loja_categoria:loja_categorias(id, nome)')
          .eq('id', productId)
          .maybeSingle();

        if (!data || error) {
          const fallbackRes = await supabase
            .from('produtos')
            .select('*')
            .eq('id', productId)
            .maybeSingle();
          data = fallbackRes.data;
        }

        if (isMounted) {
          if (data) {
            setProduct(data);
            setIsWishlisted(isInWishlist(data.id, clientId));
            const initialSummary = calculateProductRating(data);
            setDisplayRating(initialSummary.rating);
            setDisplayRatingCount(initialSummary.totalCount);

            try {
              let relatedQuery = supabase
                .from('produtos')
                .select('id, nome, valor, valor_promocional, desconto_ativo, desconto_percentual, imagem_url, status')
                .eq('status', 'ativo')
                .neq('id', productId)
                .limit(6);

              if (data.categoria_id) {
                relatedQuery = relatedQuery.eq('categoria_id', data.categoria_id);
              }

              const { data: relatedData } = await relatedQuery;
              if (relatedData && relatedData.length > 0) {
                setRelatedProducts(relatedData);
              } else {
                const { data: generalData } = await supabase
                  .from('produtos')
                  .select('id, nome, valor, valor_promocional, desconto_ativo, desconto_percentual, imagem_url, status')
                  .eq('status', 'ativo')
                  .neq('id', productId)
                  .limit(6);
                if (generalData) setRelatedProducts(generalData);
              }
            } catch (err) {
              console.warn('[ProductPage] Não foi possível carregar produtos relacionados:', err);
            }
          } else {
            setProduct(null);
          }
        }
      } catch (err) {
        console.error('[ProductPage] Erro ao carregar produto:', err);
      } finally {
        if (isMounted) setLoading(false);
      }
    };

    fetchProduct();

    return () => {
      isMounted = false;
    };
  }, [productId]);

  useSEO({
    title: product?.nome ? `${product.nome} — GSA Store` : 'GSA Store — E-commerce & Marketplace',
    description: product?.descricao 
      ? String(product.descricao).substring(0, 160) 
      : 'Confira os melhores produtos com frete grátis, descontos exclusivos e garantia na GSA Store.',
    image: product?.imagem_url || undefined,
    type: 'product'
  });

  const fetchCart = async () => {
    if (!clientId) {
      try {
        const raw = localStorage.getItem('gsa_pending_store_checkout');
        if (raw) {
          const parsed = JSON.parse(raw);
          const items = Array.isArray(parsed?.items) ? parsed.items : [];
          setCartCount(items.reduce((acc: number, curr: any) => acc + (Number(curr.quantidade) || 1), 0));
        } else {
          setCartCount(0);
        }
      } catch {
        setCartCount(0);
      }
      return;
    }
    try {
      const { data, error } = await supabase
        .from('loja_carrinhos')
        .select('quantidade')
        .eq('cliente_id', clientId);
      if (data && !error) {
        setCartCount(data.reduce((acc, curr) => acc + (Number(curr.quantidade) || 1), 0));
      }
    } catch (err) {
      console.warn('[ProductPage] Erro ao carregar contagem do carrinho:', err);
    }
  };

  useEffect(() => {
    fetchCart();
    const handleCartUpdated = () => fetchCart();
    window.addEventListener('gsa-cart-updated', handleCartUpdated);
    window.addEventListener('storage', handleCartUpdated);
    return () => {
      window.removeEventListener('gsa-cart-updated', handleCartUpdated);
      window.removeEventListener('storage', handleCartUpdated);
    };
  }, [clientId]);

  // Presença em Tempo Real de Visitantes na Página (100% Real via Supabase Realtime Presence)
  useEffect(() => {
    if (!productId) return;
    const presenceKey = clientId || `visitor_${Math.random().toString(36).slice(2, 9)}`;
    const channel = supabase.channel(`presence:product:${productId}`, {
      config: { presence: { key: presenceKey } }
    });

    channel
      .on('presence', { event: 'sync' }, () => {
        const state = channel.presenceState();
        const count = Object.keys(state).length;
        setRealViewersCount(Math.max(1, count));
      })
      .subscribe(async (status) => {
        if (status === 'SUBSCRIBED') {
          await channel.track({
            online_at: new Date().toISOString(),
            user: clientId ? 'client' : 'visitor'
          });
        }
      });

    return () => {
      channel.untrack();
      supabase.removeChannel(channel);
    };
  }, [productId, clientId]);

  if (loading) {
    return (
      <div className="flex min-h-screen flex-col bg-[#f8f9fa]">
        <EcommerceHeader 
          clientId={clientId}
          cartItemCount={cartCount}
          onOpenCart={() => navigate(routes.marketplace.store.products() + '?modal=carrinho')}
          onRequireAuth={onRequireAuth}
        />
        <div className="flex flex-1 flex-col items-center justify-center py-20">
          <div className="h-10 w-10 animate-spin rounded-full border-4 border-[#17345f] border-t-transparent shadow-md" />
          <p className="mt-4 text-sm font-semibold text-neutral-500 animate-pulse">Carregando detalhes do produto...</p>
        </div>
      </div>
    );
  }

  if (!product) {
    return (
      <div className="flex min-h-screen flex-col bg-[#f8f9fa]">
        <EcommerceHeader 
          clientId={clientId}
          cartItemCount={cartCount}
          onOpenCart={() => navigate(routes.marketplace.store.products() + '?modal=carrinho')}
          onRequireAuth={onRequireAuth}
        />
        <main className="mx-auto flex max-w-lg flex-1 flex-col items-center justify-center px-4 py-20 text-center">
          <div className="flex h-20 w-20 items-center justify-center rounded-3xl bg-amber-50 text-amber-600 shadow-inner">
            <Package className="h-10 w-10" />
          </div>
          <h2 className="mt-6 text-2xl font-black text-neutral-800">Produto não encontrado</h2>
          <p className="mt-2 text-sm text-neutral-500">
            O produto que você procura pode ter sido desativado ou o link está incorreto.
          </p>
          <div className="mt-8 flex flex-col gap-3 sm:flex-row">
            <button 
              onClick={() => navigate(routes.marketplace.store.products())}
              className="inline-flex items-center justify-center gap-2 rounded-xl bg-[#17345f] px-6 py-3 text-sm font-bold text-white shadow-lg shadow-[#17345f]/20 transition-all hover:bg-[#0c2340] cursor-pointer"
            >
              <ArrowLeft className="h-4 w-4" />
              Explorar Todos os Produtos
            </button>
            <button 
              onClick={() => navigate(routes.marketplace.root())}
              className="inline-flex items-center justify-center gap-2 rounded-xl border border-neutral-300 bg-white px-6 py-3 text-sm font-bold text-neutral-700 hover:bg-neutral-50 cursor-pointer"
            >
              Ir para o Início
            </button>
          </div>
        </main>
      </div>
    );
  }

  const images = [
    product.imagem_url,
    product.imagem_url_2,
    product.imagem_url_3,
    product.imagem_url_4,
    product.imagem_url_5
  ].filter(Boolean) as string[];

  const currentImage = images[activeImage] || images[0] || product.imagem_url || '';
  const hasDiscount = hasActiveProductDiscount(product);
  const currentPrice = hasDiscount ? getProductEffectivePrice(product) : Number(product.valor || 0);
  const regularPrice = Number(product.valor || 0);
  const discountPct = hasDiscount ? getProductDiscountPercentage(product) : 0;
  const pontosGanhos = Math.floor(currentPrice);
  const categoryName = product.loja_categoria?.nome || product.categorias?.nome || product.categoria_nome || product.categoria || 'Produtos GSA';

  const installmentValue = currentPrice > 0 ? (currentPrice / 12).toFixed(2).replace('.', ',') : '0,00';

  // Controle de estoque (mesma regra do QuantityModal)
  const controlaEstoque = Boolean(product.controle_estoque);
  const estoqueDisponivel = Number(product.estoque_disponivel || 0);
  const semEstoque = controlaEstoque && estoqueDisponivel <= 0;
  const maxQuantity = controlaEstoque ? Math.max(1, estoqueDisponivel) : 99;

  const handleAddToCart = async (openCartAfter = false) => {
    console.log('[ProductPage] handleAddToCart start:', { openCartAfter, clientId, semEstoque, controlaEstoque, quantity, estoqueDisponivel, productId: product?.id });
    try {
      if (semEstoque) {
        console.log('[ProductPage] handleAddToCart early return: semEstoque');
        toast.error('Produto sem estoque disponível no momento.');
        return;
      }
      if (controlaEstoque && quantity > estoqueDisponivel) {
        console.log('[ProductPage] handleAddToCart early return: quantity > estoqueDisponivel');
        toast.error(`Apenas ${estoqueDisponivel} unidade(s) disponível(is) em estoque.`);
        setQuantity(Math.max(1, estoqueDisponivel));
        return;
      }

      setIsAddingToCart(true);

      if (!clientId) {
        console.log('[ProductPage] handleAddToCart early return: !clientId');
        const PENDING_STORE_CHECKOUT_KEY = 'gsa_pending_store_checkout';
        const rawCart = localStorage.getItem(PENDING_STORE_CHECKOUT_KEY);
        let parsed = rawCart ? JSON.parse(rawCart) : { items: [] };
        if (!Array.isArray(parsed?.items)) parsed.items = [];

        const existingIdx = parsed.items.findIndex(
          (c: any) => c.item_id === product.id && c.tipo === 'produto'
        );

        if (existingIdx >= 0) {
          const novaQuantidade = Number(parsed.items[existingIdx].quantidade || 1) + quantity;
          // Nunca deixa a quantidade combinada (existente + nova) ultrapassar o estoque disponível.
          parsed.items[existingIdx].quantidade = controlaEstoque
            ? Math.min(novaQuantidade, estoqueDisponivel)
            : novaQuantidade;
        } else {
          parsed.items.push({
            item_id: product.id,
            tipo: 'produto',
            quantidade: quantity,
          });
        }
        parsed.updatedAt = new Date().toISOString();
        localStorage.setItem(PENDING_STORE_CHECKOUT_KEY, JSON.stringify(parsed));

        window.dispatchEvent(new CustomEvent('gsa-cart-updated'));
        window.dispatchEvent(new Event('storage'));

        fetchCart();
        toast.success(`${quantity}x ${product.nome} adicionado ao carrinho!`);

        if (openCartAfter) {
          navigate(routes.marketplace.store.products() + '?modal=carrinho');
        }
        return;
      }

      const { data: existing } = await supabase
        .from('loja_carrinhos')
        .select('id, quantidade')
        .eq('cliente_id', clientId)
        .eq('item_id', product.id)
        .maybeSingle();

      if (existing) {
        const novaQuantidade = Number(existing.quantidade || 1) + quantity;
        // Nunca deixa a quantidade combinada (existente + nova) ultrapassar o estoque disponível.
        const quantidadeFinal = controlaEstoque ? Math.min(novaQuantidade, estoqueDisponivel) : novaQuantidade;
        await clientOperationalWrite(clientId, 'loja_carrinhos', 'update', {
          quantidade: quantidadeFinal,
          updated_at: new Date().toISOString()
        }, { id: existing.id });
      } else {
        await clientOperationalWrite(clientId, 'loja_carrinhos', 'insert', {
          item_id: product.id,
          tipo: 'produto',
          quantidade: quantity,
          updated_at: new Date().toISOString()
        });
      }

      toast.success(`${quantity}x ${product.nome} adicionado ao carrinho!`);
      await fetchCart();

      if (openCartAfter) {
        navigate(routes.marketplace.store.products() + '?modal=carrinho');
      }
    } catch (err) {
      console.error('[ProductPage] Erro ao adicionar ao carrinho:', err);
      toast.error('Erro ao adicionar produto ao carrinho.');
    } finally {
      setIsAddingToCart(false);
    }
  };

  const handleWhatsAppOrder = () => {
    const message = encodeURIComponent(
      `Olá! Tenho interesse em comprar o produto:\n\n*${product.nome}*\nPreço: ${formatCurrency(currentPrice)}\nQuantidade: ${quantity}\n\nLink: ${window.location.href}`
    );
    window.open(`https://wa.me/5511999999999?text=${message}`, '_blank');
  };

  return (
    <div className="flex min-h-screen flex-col bg-[#f8f9fa] text-neutral-900 selection:bg-[#17345f] selection:text-white">
      <EcommerceHeader 
        clientId={clientId}
        cartItemCount={cartCount}
        onOpenCart={() => navigate(routes.marketplace.store.products() + '?modal=carrinho')}
        onRequireAuth={onRequireAuth}
      />

      <main className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
        
        <nav aria-label="Breadcrumb" className="mb-6 flex flex-wrap items-center gap-2 text-xs font-medium text-neutral-500">
          <button 
            type="button" 
            onClick={() => navigate(routes.marketplace.root())} 
            className="hover:text-[#17345f] transition-colors cursor-pointer"
          >
            Marketplace
          </button>
          <ChevronRight className="h-3 w-3 text-neutral-400" />
          <button 
            type="button" 
            onClick={() => navigate(routes.marketplace.store.products())} 
            className="hover:text-[#17345f] transition-colors cursor-pointer"
          >
            Loja GSA
          </button>
          <ChevronRight className="h-3 w-3 text-neutral-400" />
          <span className="text-neutral-700 font-semibold">{categoryName}</span>
          <ChevronRight className="h-3 w-3 text-neutral-400" />
          <span className="text-neutral-900 font-bold truncate max-w-[200px] sm:max-w-xs">{product.nome}</span>
        </nav>

        <div className="grid grid-cols-1 gap-10 rounded-3xl bg-white p-6 shadow-sm border border-neutral-100 lg:grid-cols-12 lg:p-10">
          
          <div className="flex flex-col-reverse gap-4 md:flex-row lg:col-span-6">
            {images.length > 1 && (
              <div className="flex gap-3 overflow-x-auto pb-2 md:flex-col md:overflow-visible md:pb-0">
                {images.map((img, idx) => (
                  <button
                    key={idx}
                    type="button"
                    onClick={() => setActiveImage(idx)}
                    className={`h-20 w-20 flex-shrink-0 overflow-hidden rounded-2xl border-2 transition-all cursor-pointer ${
                      activeImage === idx 
                        ? 'border-[#17345f] shadow-md ring-2 ring-[#17345f]/20 scale-105' 
                        : 'border-neutral-200 opacity-70 hover:opacity-100 hover:border-neutral-300'
                    }`}
                  >
                    <img src={img} alt={`Miniatura ${idx + 1}`} className="h-full w-full object-cover" />
                  </button>
                ))}
              </div>
            )}
            
            <div className="group relative aspect-square flex-1 overflow-hidden rounded-3xl bg-[#fdfdfd] p-6 shadow-inner border border-neutral-100 flex items-center justify-center">
              {currentImage ? (
                <img 
                  src={currentImage} 
                  alt={product.nome} 
                  className="h-full w-full object-contain transition-transform duration-500 group-hover:scale-105" 
                />
              ) : (
                <div className="flex flex-col items-center justify-center text-neutral-300 gap-2">
                  <Package className="h-20 w-20 stroke-[1.2]" />
                  <span className="text-xs font-semibold text-neutral-400">Imagem não disponível</span>
                </div>
              )}

              <button 
                type="button"
                onClick={() => {
                  const nowFavorited = toggleWishlist(product.id, clientId);
                  setIsWishlisted(nowFavorited);
                  toast.success(nowFavorited ? 'Produto salvo nos seus favoritos!' : 'Removido dos favoritos.');
                }}
                className="absolute right-4 top-4 flex h-11 w-11 items-center justify-center rounded-full bg-white/90 backdrop-blur-sm text-neutral-400 shadow-md transition-all hover:text-red-500 hover:scale-110 cursor-pointer"
                title="Favoritar produto"
              >
                <Heart className={`h-5 w-5 ${isWishlisted ? 'fill-red-500 text-red-500' : ''}`} />
              </button>

              {hasDiscount && discountPct > 0 && (
                <span className="absolute left-4 top-4 rounded-xl bg-gradient-to-r from-rose-600 to-red-500 px-3.5 py-1.5 text-xs font-black uppercase tracking-wider text-white shadow-lg shadow-red-500/20">
                  {discountPct}% OFF
                </span>
              )}
            </div>
          </div>

          <div className="flex flex-col lg:col-span-6">
            
            <div className="flex items-center gap-2">
              <span className="rounded-lg bg-neutral-100 px-3 py-1 text-xs font-bold uppercase tracking-wider text-[#17345f]">
                {categoryName}
              </span>
              {semEstoque ? (
                <span className="inline-flex items-center gap-1 rounded-full bg-red-50 px-2.5 py-0.5 text-xs font-bold text-red-700">
                  Esgotado
                </span>
              ) : (
                <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2.5 py-0.5 text-xs font-bold text-emerald-700">
                  <Check className="h-3 w-3" /> Em Estoque
                  {controlaEstoque && estoqueDisponivel <= 10 ? ` (${estoqueDisponivel} un.)` : ''}
                </span>
              )}
            </div>

            <h1 className="mt-3 text-2xl font-black leading-snug text-neutral-900 sm:text-3xl lg:text-4xl">
              {product.nome}
            </h1>
            
            <div className="mt-3 flex flex-wrap items-center gap-4">
              <div 
                className="flex items-center gap-1 text-amber-400 cursor-pointer hover:opacity-80 transition-opacity"
                onClick={() => {
                  document.getElementById('reviews-section-title')?.scrollIntoView({ behavior: 'smooth' });
                }}
                title="Ver avaliações deste produto"
              >
                {[1, 2, 3, 4, 5].map((s) => (
                  <Star 
                    key={s} 
                    className={`h-4 w-4 ${s <= Math.round(displayRating) ? 'fill-amber-400 text-amber-400' : 'fill-neutral-200 text-neutral-200'}`} 
                  />
                ))}
                <span className="ml-1.5 text-xs font-bold text-neutral-700">{displayRating.toFixed(1)}</span>
                <span className="text-xs text-neutral-400 font-medium">({displayRatingCount} {displayRatingCount === 1 ? 'avaliação' : 'avaliações'})</span>
              </div>
            </div>

            <div className="mt-6 rounded-2xl bg-neutral-50/80 p-5 border border-neutral-100">
              {hasDiscount && regularPrice > currentPrice && (
                <div className="flex items-center gap-2">
                  <span className="text-sm font-semibold text-neutral-400 line-through">
                    {formatCurrency(regularPrice)}
                  </span>
                  <span className="rounded bg-rose-100 px-1.5 py-0.5 text-xs font-black text-rose-700">
                    Economize {formatCurrency(regularPrice - currentPrice)}
                  </span>
                </div>
              )}

              <div className="mt-1 flex items-baseline gap-2">
                <span className="text-3xl font-black text-[#17345f] sm:text-4xl">
                  {formatCurrency(currentPrice)}
                </span>
                <span className="text-xs font-bold text-neutral-400 uppercase">no cartão</span>
              </div>

              <div className="mt-2 flex items-center gap-2 text-xs font-extrabold text-emerald-700">
                <QrCode className="h-4 w-4" />
                <span>Pague à vista via PIX, boleto ou cartão</span>
              </div>

              <div className="mt-1.5 flex items-center gap-2 text-xs font-semibold text-neutral-600">
                <CreditCard className="h-4 w-4 text-neutral-400" />
                <span>ou até 12x de R$ {installmentValue} sem juros</span>
              </div>
              
              <div className="mt-3 flex items-center gap-2 rounded-xl bg-amber-50 p-2.5 text-xs font-bold text-amber-800 border border-amber-200/60">
                <Gift className="h-4 w-4 text-amber-600" />
                <span>Ganhe + {pontosGanhos} pontos GSA Fidelidade nesta compra</span>
              </div>
            </div>

            <div className="mt-6 space-y-4">
              <div className="flex flex-wrap items-center gap-3">
                <span className="text-xs font-bold text-neutral-700 uppercase tracking-wider">Quantidade:</span>
                <div className="flex items-center rounded-xl border border-neutral-300 bg-white shadow-xs">
                  <button 
                    type="button"
                    onClick={() => setQuantity(Math.max(1, quantity - 1))}
                    disabled={quantity <= 1}
                    className="flex h-10 w-10 items-center justify-center text-neutral-500 hover:bg-neutral-100 hover:text-neutral-900 disabled:opacity-30 rounded-l-xl transition-colors cursor-pointer"
                    aria-label="Diminuir quantidade"
                  >
                    <Minus className="h-4 w-4" />
                  </button>
                  <span className="w-10 text-center font-black text-neutral-900">{quantity}</span>
                  <button 
                    type="button"
                    onClick={() => setQuantity(Math.min(maxQuantity, quantity + 1))}
                    disabled={quantity >= maxQuantity}
                    className="flex h-10 w-10 items-center justify-center text-neutral-500 hover:bg-neutral-100 hover:text-neutral-900 disabled:opacity-30 rounded-r-xl transition-colors cursor-pointer"
                    aria-label="Aumentar quantidade"
                  >
                    <Plus className="h-4 w-4" />
                  </button>
                </div>

                {/* Compact Total Display (PIX only + points) - Only shown when quantity > 1 */}
                {quantity > 1 && (
                  <div className="flex items-center gap-2.5 rounded-xl bg-emerald-50/90 px-3.5 py-2 border border-emerald-200/80 text-xs shadow-2xs animate-in fade-in duration-200">
                    <div className="flex items-baseline gap-1 text-emerald-950 font-black">
                      <span className="text-[11px] font-bold text-emerald-800">Total ({quantity} un):</span>
                      <span className="text-sm font-black text-emerald-700">{formatCurrency(currentPrice * quantity)}</span>
                    </div>
                    <span className="text-emerald-300">|</span>
                    <div className="flex items-center gap-1 font-extrabold text-amber-700">
                      <Gift className="h-3.5 w-3.5 text-amber-500" />
                      <span>+ {pontosGanhos * quantity} pts</span>
                    </div>
                  </div>
                )}
              </div>

              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <button 
                  type="button"
                  onClick={() => handleAddToCart(true)}
                  disabled={isAddingToCart || semEstoque}
                  className="flex items-center justify-center gap-2 rounded-2xl bg-[#17345f] px-6 py-4 text-sm font-black text-white shadow-lg shadow-[#17345f]/25 transition-all hover:bg-[#0c2340] hover:-translate-y-0.5 active:translate-y-0 cursor-pointer disabled:opacity-50"
                >
                  <ShoppingCart className="h-5 w-5" />
                  {semEstoque ? 'Produto Esgotado' : isAddingToCart ? 'Processando...' : 'Comprar Agora'}
                </button>

                <button 
                  type="button"
                  onClick={() => handleAddToCart(false)}
                  disabled={isAddingToCart || semEstoque}
                  className="flex items-center justify-center gap-2 rounded-2xl border-2 border-[#17345f] bg-white px-6 py-4 text-sm font-black text-[#17345f] shadow-sm transition-all hover:bg-[#17345f]/5 hover:-translate-y-0.5 active:translate-y-0 cursor-pointer disabled:opacity-50"
                >
                  <Plus className="h-5 w-5" />
                  Adicionar ao Carrinho
                </button>
              </div>

              <div className="flex flex-wrap gap-2.5">
                <button 
                  type="button"
                  onClick={handleWhatsAppOrder}
                  className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-emerald-50 px-4 py-3 text-xs font-bold text-emerald-700 border border-emerald-200 transition-colors hover:bg-emerald-100 cursor-pointer"
                >
                  <MessageCircle className="h-4 w-4 text-emerald-600" />
                  <span>Comprar pelo WhatsApp</span>
                </button>

                <button 
                  type="button"
                  onClick={() => setIsShareModalOpen(true)}
                  className="flex items-center justify-center gap-2 rounded-xl border border-neutral-200 bg-white px-4 py-3 text-xs font-bold text-neutral-700 transition-colors hover:bg-neutral-50 cursor-pointer"
                >
                  <Share2 className="h-4 w-4" />
                  <span>Compartilhar</span>
                </button>
              </div>
            </div>

            <div className="mt-6">
              <button 
                type="button"
                onClick={() => setIsGroupBuyModalOpen(true)}
                className="w-full flex items-center justify-between p-4 rounded-2xl bg-gradient-to-r from-purple-50 to-indigo-50 border border-purple-200/60 hover:shadow-md transition-all group cursor-pointer"
              >
                <div className="flex items-center gap-3">
                  <div className="h-10 w-10 rounded-xl bg-purple-600 flex items-center justify-center text-white shadow-sm group-hover:scale-105 transition-transform">
                    <Gift className="h-5 w-5" />
                  </div>
                  <div className="text-left">
                    <span className="block font-black text-purple-950 text-sm">Fazer Vaquinha de Presente</span>
                    <span className="block text-xs text-purple-700">Divida o valor deste produto com seus amigos</span>
                  </div>
                </div>
                <ChevronRight className="h-5 w-5 text-purple-500 group-hover:translate-x-1 transition-transform" />
              </button>
            </div>

            <div className="mt-8 grid grid-cols-3 gap-3 rounded-2xl bg-neutral-50 p-4 border border-neutral-100 text-center">
              <div className="flex flex-col items-center gap-1">
                <ShieldCheck className="h-5 w-5 text-[#17345f]" />
                <span className="text-[11px] font-bold text-neutral-900">Compra 100% Segura</span>
                <span className="text-[10px] text-neutral-500">Garantia GSA</span>
              </div>
              <div className="flex flex-col items-center gap-1">
                <Truck className="h-5 w-5 text-[#17345f]" />
                <span className="text-[11px] font-bold text-neutral-900">Entrega Expressa</span>
                <span className="text-[10px] text-neutral-500">Todo o Brasil</span>
              </div>
              <div className="flex flex-col items-center gap-1">
                <RotateCcw className="h-5 w-5 text-[#17345f]" />
                <span className="text-[11px] font-bold text-neutral-900">Troca Fácil</span>
                <span className="text-[10px] text-neutral-500">Até 7 dias</span>
              </div>
            </div>

          </div>
        </div>
        
        <div className="mt-12 rounded-3xl bg-white p-8 shadow-sm border border-neutral-100 lg:p-12">
          <h3 className="text-2xl font-black text-[#17345f] border-b border-neutral-100 pb-4">
            Descrição do Produto
          </h3>
          <div className="mt-6 text-neutral-700 leading-relaxed text-sm sm:text-base space-y-4">
            {product.descricao_detalhada ? (
              <div 
                className="prose prose-neutral max-w-none"
                dangerouslySetInnerHTML={{ 
                  __html: String(product.descricao_detalhada).replace(/\n/g, '<br/>') 
                }} 
              />
            ) : product.descricao ? (
              <p className="whitespace-pre-line">{product.descricao}</p>
            ) : (
              <p className="text-neutral-400 italic">Nenhuma descrição detalhada informada para este produto.</p>
            )}
          </div>
        </div>

        <ProductReviews
          productId={productId}
          product={product}
          clientId={clientId}
          onRatingCalculated={(newRating, newTotal) => {
            setDisplayRating(newRating);
            setDisplayRatingCount(newTotal);
          }}
        />

        {relatedProducts.length > 0 && (
          <div className="mt-14">
            <div className="mb-6 flex items-center justify-between">
              <div>
                <h3 className="text-2xl font-black text-[#17345f]">Quem viu este produto também comprou</h3>
                <p className="text-xs text-neutral-500 mt-1">Produtos em destaque que você também pode gostar</p>
              </div>
              <button 
                type="button"
                onClick={() => navigate(routes.marketplace.store.products())}
                className="flex items-center gap-1 text-xs font-bold text-[#17345f] hover:underline cursor-pointer"
              >
                <span>Ver todos</span>
                <ArrowRight className="h-3.5 w-3.5" />
              </button>
            </div>

            <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6">
              {relatedProducts.map((rel) => {
                const isRelPromo = hasActiveProductDiscount(rel);
                const relPrice = isRelPromo ? getProductEffectivePrice(rel) : Number(rel.valor || 0);

                return (
                  <div
                    key={rel.id}
                    onClick={() => {
                      navigate(routes.marketplace.store.product(rel.id));
                      window.scrollTo({ top: 0, behavior: 'smooth' });
                    }}
                    className="group flex flex-col justify-between overflow-hidden rounded-2xl bg-white p-3 shadow-sm border border-neutral-100 transition-all hover:shadow-md hover:-translate-y-1 cursor-pointer"
                  >
                    <div className="relative aspect-square w-full overflow-hidden rounded-xl bg-neutral-50 flex items-center justify-center">
                      {rel.imagem_url ? (
                        <img 
                          src={rel.imagem_url} 
                          alt={rel.nome} 
                          className="h-full w-full object-contain transition-transform duration-300 group-hover:scale-105" 
                        />
                      ) : (
                        <Package className="h-8 w-8 text-neutral-300" />
                      )}
                      {isRelPromo && (
                        <span className="absolute left-2 top-2 rounded bg-rose-600 px-1.5 py-0.5 text-[10px] font-black text-white">
                          {getProductDiscountPercentage(rel)}% OFF
                        </span>
                      )}
                    </div>
                    <div className="mt-3 flex flex-1 flex-col justify-between">
                      <h4 className="line-clamp-2 text-xs font-bold text-neutral-800 group-hover:text-[#17345f] transition-colors">
                        {rel.nome}
                      </h4>
                      <div className="mt-2">
                        <span className="text-sm font-black text-[#17345f]">
                          {formatCurrency(relPrice)}
                        </span>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

      </main>

      {/* Compartilhamento Modal */}
      <ProductShareModal 
        isOpen={isShareModalOpen} 
        onClose={() => setIsShareModalOpen(false)} 
        product={product} 
        productUrl={typeof window !== 'undefined' ? window.location.href : ''}
      />

      {/* Vaquinha Modal */}
      <GroupBuyModal 
        isOpen={isGroupBuyModalOpen}
        onClose={() => setIsGroupBuyModalOpen(false)}
        product={product}
        productUrl={typeof window !== 'undefined' ? window.location.href : ''}
      />
    </div>
  );
}

export default ProductPage;

