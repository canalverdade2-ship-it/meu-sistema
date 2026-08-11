import React, { useState, useEffect } from 'react';
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
  Gift
} from 'lucide-react';
import { supabase } from '../../../lib/supabase';
import { formatCurrency } from '../../../lib/utils';
import { navigate } from '../../../routing/navigationService';
import { routes } from '../../../routing/routeCatalog';
import { EcommerceHeader } from './EcommerceHeader';
import { ProductShareModal } from './ProductShareModal';
import { GroupBuyModal } from './GroupBuyModal';
import { getProductEffectivePrice, getProductDiscountPercentage, hasActiveProductDiscount } from '../../../lib/productPricing';
import { Eye } from 'lucide-react';
import { useSEO } from '../../../hooks/useSEO';

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

  useEffect(() => {
    const fetchProduct = async () => {
      setLoading(true);
      try {
        const { data, error } = await supabase
          .from('produtos')
          .select(`*, categorias:categoria_id(nome)`)
          .eq('id', productId)
          .single();
        
        if (data && !error) {
          setProduct(data);
        }
      } catch (err) {
        console.error('Erro ao buscar produto:', err);
      } finally {
        setLoading(false);
      }
    };
    if (productId) fetchProduct();
  }, [productId]);

  useSEO({
    title: product ? `${product.nome} - Loja GSA Store` : 'Carregando... - Loja GSA Store',
    description: product?.descricao ? product.descricao.substring(0, 160) : `Compre ${product?.nome} na GSA Store com os melhores preços.`,
    image: product?.imagem_url,
    type: 'product'
  });

  useEffect(() => {
    if (clientId) {
      const fetchCart = async () => {
        try {
          const { data, error } = await supabase
            .from('loja_carrinhos')
            .select('quantidade')
            .eq('cliente_id', clientId);
          if (data && !error) {
            setCartCount(data.reduce((acc, curr) => acc + (curr.quantidade || 1), 0));
          }
        } catch (err) {}
      };
      fetchCart();
    }
  }, [clientId]);

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#f8f9fa]">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-[#17345f] border-t-transparent" />
      </div>
    );
  }

  if (!product) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center bg-[#f8f9fa]">
        <h2 className="text-2xl font-bold text-neutral-800">Produto não encontrado</h2>
        <button 
          onClick={() => navigate(routes.marketplace.store.products())}
          className="mt-4 rounded-xl bg-[#17345f] px-6 py-3 font-bold text-white"
        >
          Voltar para Loja
        </button>
      </div>
    );
  }

  const images = [
    product.imagem_url,
    product.imagem_url_2,
    product.imagem_url_3,
    product.imagem_url_4,
    product.imagem_url_5
  ].filter(Boolean);

  const hasDiscount = hasActiveProductDiscount(product);
  const currentPrice = hasDiscount ? getProductEffectivePrice(product) : Number(product.valor || 0);
  const pontosGanhos = Math.floor(currentPrice / 10);
  const categoryName = product.categorias?.nome || product.categoria_nome || 'Produto';

  // Seed aleatória baseada no ID do produto para prova social (Fase 3.1)
  const viewersCount = React.useMemo(() => {
    let hash = 0;
    for (let i = 0; i < (productId || '').length; i++) {
      hash = (productId || '').charCodeAt(i) + ((hash << 5) - hash);
    }
    return Math.abs(hash % 70) + 15; // Entre 15 e 84 pessoas
  }, [productId]);

  const handleAddToCart = () => {
    // Integração futura com o carrinho
    navigate(routes.marketplace.store.products() + '?modal=carrinho');
  };

  return (
    <div className="min-h-screen bg-[#f8f9fa]">
      <EcommerceHeader 
        clientId={clientId}
        cartItemCount={cartCount}
        onOpenCart={() => navigate(routes.marketplace.store.products() + '?modal=carrinho')}
        onRequireAuth={onRequireAuth}
      />

      <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        
        {/* Breadcrumb */}
        <nav className="mb-6 flex items-center gap-2 text-xs font-medium text-neutral-500">
          <button onClick={() => navigate(routes.marketplace.root())} className="hover:text-[#17345f]">Home</button>
          <ChevronRight className="h-3 w-3" />
          <button onClick={() => navigate(routes.marketplace.store.products())} className="hover:text-[#17345f]">Loja</button>
          <ChevronRight className="h-3 w-3" />
          <span className="text-neutral-900">{categoryName}</span>
        </nav>

        <div className="grid grid-cols-1 gap-12 lg:grid-cols-2">
          
          {/* Coluna Esquerda - Galeria */}
          <div className="flex flex-col-reverse gap-4 md:flex-row">
            {/* Thumbnails */}
            {images.length > 1 && (
              <div className="flex gap-3 md:flex-col">
                {images.map((img, idx) => (
                  <button
                    key={idx}
                    onClick={() => setActiveImage(idx)}
                    className={`h-20 w-20 flex-shrink-0 overflow-hidden rounded-xl border-2 transition-all ${activeImage === idx ? 'border-[#17345f]' : 'border-transparent hover:border-neutral-300'}`}
                  >
                    <img src={img} alt={`Thumbnail ${idx + 1}`} className="h-full w-full object-cover" />
                  </button>
                ))}
              </div>
            )}
            
            {/* Imagem Principal */}
            <div className="group relative aspect-square flex-1 overflow-hidden rounded-3xl bg-white p-8 shadow-sm">
              <img 
                src={images[activeImage]} 
                alt={product.nome} 
                className="h-full w-full object-contain transition-transform duration-500 group-hover:scale-110" 
              />
              <button className="absolute right-4 top-4 flex h-10 w-10 items-center justify-center rounded-full bg-white text-neutral-400 shadow-md transition-colors hover:text-red-500 hover:scale-110">
                <Heart className="h-5 w-5" />
              </button>
              {hasDiscount && (
                <span className="absolute left-4 top-4 rounded-lg bg-[#a77a2c] px-3 py-1.5 text-xs font-black uppercase tracking-wider text-white shadow-md">
                  {getProductDiscountPercentage(product)}% OFF
                </span>
              )}
            </div>
          </div>

          {/* Coluna Direita - Informações */}
          <div className="flex flex-col">
            <h1 className="text-3xl font-black leading-tight text-[#17345f] sm:text-4xl">
              {product.nome}
            </h1>
            
            <div className="mt-4 flex items-center gap-4">
              <div className="flex items-center gap-1 text-amber-400">
                <Star className="h-4 w-4 fill-current" />
                <Star className="h-4 w-4 fill-current" />
                <Star className="h-4 w-4 fill-current" />
                <Star className="h-4 w-4 fill-current" />
                <Star className="h-4 w-4 fill-current opacity-40" />
                <span className="ml-2 text-sm font-medium text-neutral-500">(42 avaliações)</span>
              </div>
              <div className="h-4 w-px bg-neutral-300" />
              <span className="text-sm font-medium text-emerald-600">Em estoque</span>
            </div>

            {/* Prova Social (Fase 3.1) */}
            <div className="mt-3 flex items-center gap-2 text-xs font-bold text-rose-600 bg-rose-50 w-fit px-3 py-1.5 rounded-lg border border-rose-100">
              <Eye className="w-4 h-4" />
              {viewersCount} pessoas estão vendo este produto hoje
            </div>

            <div className="mt-8 border-b border-neutral-100 pb-8">
              {hasDiscount && (
                <span className="text-lg font-medium text-neutral-400 line-through">
                  {formatCurrency(product.valor)}
                </span>
              )}
              <div className="flex items-end gap-3">
                <span className="text-4xl font-black text-[#17345f]">
                  {formatCurrency(currentPrice)}
                </span>
                <span className="mb-1 text-sm font-bold text-neutral-500">à vista</span>
              </div>
              
              <div className="mt-2 inline-flex items-center gap-2 rounded-lg bg-[#d8bd73]/10 px-3 py-1.5 text-sm font-bold text-[#b89547]">
                <span>💎 Ganhe + {pontosGanhos} pontos GSA</span>
              </div>
            </div>

            <div className="mt-8">
              <div className="flex items-center gap-4">
                <span className="text-sm font-bold text-neutral-700">Quantidade:</span>
                <div className="flex items-center rounded-xl border border-neutral-200 bg-white">
                  <button 
                    onClick={() => setQuantity(Math.max(1, quantity - 1))}
                    className="flex h-10 w-10 items-center justify-center text-neutral-500 transition-colors hover:text-[#17345f]"
                  >
                    <Minus className="h-4 w-4" />
                  </button>
                  <span className="w-12 text-center font-bold text-neutral-900">{quantity}</span>
                  <button 
                    onClick={() => setQuantity(quantity + 1)}
                    className="flex h-10 w-10 items-center justify-center text-neutral-500 transition-colors hover:text-[#17345f]"
                  >
                    <Plus className="h-4 w-4" />
                  </button>
                </div>
              </div>

              <div className="mt-6 flex flex-col gap-3 sm:flex-row">
                <button 
                  onClick={handleAddToCart}
                  className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-[#17345f] px-8 py-4 text-sm font-black text-white transition-all hover:bg-[#0c2340] hover:-translate-y-1 hover:shadow-lg"
                >
                  <ShoppingCart className="h-5 w-5" />
                  Comprar Agora
                </button>
                <button 
                  onClick={() => setIsShareModalOpen(true)}
                  className="flex items-center justify-center gap-2 rounded-xl border border-neutral-200 bg-white px-6 py-4 text-sm font-bold text-neutral-700 transition-all hover:border-[#17345f] hover:text-[#17345f]"
                >
                  <Share2 className="h-5 w-5" />
                  <span className="hidden sm:inline">Compartilhar</span>
                </button>
              </div>
            </div>

            {/* Benefícios */}
            <div className="mt-10 grid grid-cols-2 gap-4 rounded-2xl bg-white p-6 shadow-sm border border-neutral-100">
              <div className="flex items-center gap-3">
                <ShieldCheck className="h-6 w-6 text-[#17345f]" />
                <div className="text-xs">
                  <span className="block font-bold text-neutral-900">Compra Segura</span>
                  <span className="text-neutral-500">Garantia GSA</span>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <Truck className="h-6 w-6 text-[#17345f]" />
                <div className="text-xs">
                  <span className="block font-bold text-neutral-900">Entrega Rápida</span>
                  <span className="text-neutral-500">Para todo Brasil</span>
                </div>
              </div>
            </div>

            {/* Compra em Grupo / Vaquinha (Fase 4.3) */}
            <div className="mt-4">
              <button 
                onClick={() => setIsGroupBuyModalOpen(true)}
                className="w-full flex items-center justify-between p-4 rounded-2xl bg-gradient-to-r from-purple-50 to-indigo-50 border border-purple-100 hover:shadow-md transition-all group"
              >
                <div className="flex items-center gap-3">
                  <div className="h-10 w-10 rounded-full bg-white flex items-center justify-center text-purple-600 shadow-sm group-hover:scale-110 transition-transform">
                    <Gift className="h-5 w-5" />
                  </div>
                  <div className="text-left">
                    <span className="block font-black text-purple-900 text-sm">Vaquinha de Presente</span>
                    <span className="block text-xs text-purple-700">Divida com os amigos pelo WhatsApp</span>
                  </div>
                </div>
                <ChevronRight className="h-5 w-5 text-purple-400 group-hover:translate-x-1 transition-transform" />
              </button>
            </div>

          </div>
        </div>
        
        {/* Descrição Detalhada */}
        <div className="mt-16 rounded-3xl bg-white p-8 shadow-sm lg:p-12">
          <h3 className="mb-6 text-2xl font-black text-[#17345f]">Descrição do Produto</h3>
          <div className="prose prose-neutral max-w-none text-neutral-600">
            {product.descricao_detalhada ? (
              <div dangerouslySetInnerHTML={{ __html: product.descricao_detalhada.replace(/\n/g, '<br/>') }} />
            ) : (
              <p>{product.descricao || 'Nenhuma descrição detalhada disponível para este produto.'}</p>
            )}
          </div>
        </div>

      </main>

      {/* Compartilhamento Modal (Fase 4.2) */}
      <ProductShareModal 
        isOpen={isShareModalOpen} 
        onClose={() => setIsShareModalOpen(false)} 
        product={product} 
        productUrl={window.location.href}
      />

      {/* Vaquinha Modal (Fase 4.3) */}
      <GroupBuyModal 
        isOpen={isGroupBuyModalOpen}
        onClose={() => setIsGroupBuyModalOpen(false)}
        product={product}
        productUrl={window.location.href}
      />
    </div>
  );
}

export default ProductPage;
