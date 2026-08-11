import React from 'react';
import {
  AlertCircle,
  ArrowRight,
  Calendar,
  Package,
  Heart,
  Star,
  Zap,
  Eye,
  Timer,
  Scissors,
  ShoppingBag
} from 'lucide-react';
import { formatCurrency } from '../../../lib/utils';
import {
  formatProductDiscountPercentage,
  getProductDiscountAmount,
  getProductEffectivePrice,
  getProductPromotionQuantityInfo,
  hasActiveProductDiscount,
} from '../../../lib/productPricing';

type ItemType = 'produto' | 'servico' | 'assinatura';

interface StoreItemCardProps {
  item: any;
  tipo: ItemType;
  onAdd: () => any;
  onClick: () => any;
}

function getCategoryLabel(item: any): string {
  if (typeof item?.categoria === 'string') return item.categoria;
  if (typeof item?.categorias?.nome === 'string') return item.categorias.nome;
  if (typeof item?.categoria_nome === 'string') return item.categoria_nome;
  return '';
}

function getTypeLabel(tipo: ItemType): string {
  if (tipo === 'assinatura') return 'Plano';
  if (tipo === 'servico') return 'Serviço';
  return 'Produto';
}

function ItemPlaceholder({ tipo }: { tipo: ItemType }) {
  const iconClass = 'h-12 w-12 text-slate-300 sm:h-14 sm:w-14';

  if (tipo === 'assinatura') return <Calendar className={iconClass} aria-hidden="true" />;
  if (tipo === 'servico') return <Scissors className={iconClass} aria-hidden="true" />;
  return <Package className={iconClass} aria-hidden="true" />;
}

export default function StoreItemCard({ item, tipo, onAdd, onClick }: StoreItemCardProps) {
  const isProduct = tipo === 'produto';
  const isOutOfStock = isProduct && item.controle_estoque && Number(item.estoque_disponivel || 0) <= 0;
  const isLowStock = isProduct
    && item.controle_estoque
    && Number(item.estoque_disponivel || 0) > 0
    && Number(item.estoque_disponivel || 0) <= 5;
  const hasDiscount = isProduct && hasActiveProductDiscount(item) && !isOutOfStock;
  const categoryLabel = getCategoryLabel(item);
  const currentPrice = hasDiscount ? getProductEffectivePrice(item) : Number(item.valor || 0);
  const promotionQuantity = hasDiscount ? getProductPromotionQuantityInfo(item) : null;

  const handleCardKeyDown = (event: React.KeyboardEvent<HTMLElement>) => {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      if (item.link_afiliado) {
        window.open(item.link_afiliado, '_blank', 'noopener,noreferrer');
      } else {
        onClick();
      }
    }
  };

  // Simulação de prova social
  const viewCount = React.useMemo(() => Math.floor(Math.random() * 50) + 10, [item.id]);

  // Simulação de pontos GSA (10% do valor convertido)
  const pontosGanhos = Math.floor(currentPrice / 10);
  
  // Simulação de estrelas (random entre 4 e 5)
  const renderStars = () => {
    return (
      <div className="flex items-center gap-0.5 text-amber-400">
        <Star className="h-3 w-3 fill-current" />
        <Star className="h-3 w-3 fill-current" />
        <Star className="h-3 w-3 fill-current" />
        <Star className="h-3 w-3 fill-current" />
        <Star className="h-3 w-3 fill-current opacity-40" />
        <span className="ml-1 text-[10px] text-slate-400">(42)</span>
      </div>
    );
  };

  return (
    <article
      role="link"
      tabIndex={0}
      onClick={() => {
        if (item.link_afiliado) {
          window.open(item.link_afiliado, '_blank', 'noopener,noreferrer');
        } else {
          onClick();
        }
      }}
      onKeyDown={handleCardKeyDown}
      aria-label={`Ver detalhes de ${item.nome}`}
      className="group flex w-full h-full cursor-pointer flex-col overflow-hidden rounded-[20px] border border-slate-200 bg-white text-left shadow-[0_10px_28px_rgba(15,23,42,0.06)] outline-none transition duration-300 hover:-translate-y-1 hover:border-slate-300 hover:shadow-[0_18px_42px_rgba(15,23,42,0.11)] focus-visible:ring-2 focus-visible:ring-[#17345f] focus-visible:ring-offset-2"
    >
      <div className="relative aspect-[4/3] w-full shrink-0 overflow-hidden bg-[#f4f6f8]">
        {item.imagem_url ? (
          <img
            src={item.imagem_url}
            alt={item.nome}
            loading="lazy"
            className={`h-full w-full object-cover transition duration-500 group-hover:scale-110 ${isOutOfStock ? 'opacity-55 grayscale-[20%]' : ''}`}
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center">
            <ItemPlaceholder tipo={tipo} />
          </div>
        )}
        
        {/* Wishlist Button */}
        <button 
          className="absolute right-3 top-3 flex h-8 w-8 items-center justify-center rounded-full bg-white/80 text-slate-400 backdrop-blur-sm transition-all hover:bg-white hover:text-red-500 hover:scale-110 shadow-sm z-10"
          onClick={(e) => {
            e.stopPropagation();
            // Lógica de wishlist futura
          }}
          aria-label="Adicionar aos favoritos"
        >
          <Heart className="h-4 w-4" />
        </button>

        <div className="absolute left-3 top-3 flex max-w-[calc(100%-1.5rem)] flex-wrap gap-1.5">
          {hasDiscount && (
            <span className="inline-flex items-center gap-1 rounded-md bg-[#a77a2c] px-2 py-1 text-[10px] font-extrabold uppercase tracking-[0.08em] text-white shadow-sm">
              <Timer className="h-3 w-3" />
              {formatProductDiscountPercentage(item)}
            </span>
          )}

          {isLowStock && !isOutOfStock && (
            <span className="inline-flex items-center gap-1 rounded-md border border-amber-200 bg-amber-50 px-2 py-1 text-[10px] font-bold text-amber-800">
              <AlertCircle className="h-3 w-3" />
              Restam {item.estoque_disponivel}
            </span>
          )}

          {/* Dinâmico: Se tiver destaque */}
          {item.destaque && (
            <span className="inline-flex items-center gap-1 rounded-md bg-[#17345f] px-2 py-1 text-[10px] font-extrabold uppercase tracking-[0.08em] text-white shadow-sm">
              <Zap className="h-3 w-3 text-[#d8bd73]" />
              Destaque
            </span>
          )}

          {/* Prova social apenas visível se houver desconto ou se for destaque */}
          {(hasDiscount || item.destaque) && (
             <span className="inline-flex items-center gap-1 rounded-md bg-white/90 backdrop-blur-sm px-2 py-1 text-[9px] font-bold text-neutral-600 shadow-sm">
               <Eye className="h-3 w-3 text-neutral-400" />
               {viewCount} viram hoje
             </span>
          )}

          {isOutOfStock && (
            <span className="inline-flex items-center gap-1 rounded-md border border-slate-300 bg-white/95 px-2 py-1 text-[10px] font-extrabold uppercase tracking-[0.08em] text-slate-700 shadow-sm">
              <AlertCircle className="h-3 w-3" aria-hidden="true" />
              Esgotado
            </span>
          )}
        </div>
      </div>

      <div className="flex flex-1 flex-col justify-between px-3.5 pb-3.5 pt-3 sm:px-4 sm:pb-4 sm:pt-3.5">
        <div>
          <div className="mb-1.5 flex items-center justify-between">
            <div className="flex min-w-0 items-center gap-2 text-[10px] font-bold uppercase tracking-[0.12em]">
              <span className="text-[#17345f]">{getTypeLabel(tipo)}</span>
              {categoryLabel && (
                <>
                  <span className="h-1 w-1 shrink-0 rounded-full bg-slate-300" aria-hidden="true" />
                  <span className="truncate text-slate-400">{categoryLabel}</span>
                </>
              )}
            </div>
            {isProduct && renderStars()}
          </div>

          <h3
            style={{
              display: '-webkit-box',
              WebkitLineClamp: 2,
              WebkitBoxOrient: 'vertical',
              overflow: 'hidden'
            }}
            className="h-[40px] text-[15px] font-extrabold leading-5 text-slate-950 transition-colors group-hover:text-[#17345f] sm:text-base"
          >
            {item.nome}
          </h3>

          <p
            style={{
              display: '-webkit-box',
              WebkitLineClamp: 3,
              WebkitBoxOrient: 'vertical',
              overflow: 'hidden'
            }}
            className="mt-1.5 h-[60px] text-xs leading-5 text-slate-500"
          >
            {item.descricao || 'Produto de alta qualidade disponível na GSA Store.'}
          </p>

          {promotionQuantity?.limitadoPorQuantidade && promotionQuantity.quantidadeRestante !== null && (
            <p className="mt-2 text-[11px] font-semibold text-emerald-700">
              {promotionQuantity.quantidadeRestante} {promotionQuantity.quantidadeRestante === 1 ? 'unidade promocional' : 'unidades promocionais'}
            </p>
          )}
        </div>

        <div className="mt-3 pt-2">
          {item.ocultar_valor ? (
            <div className="text-sm font-bold text-slate-700">Valor sob consulta</div>
          ) : (
            <div>
              {hasDiscount && (
                <div className="mb-1 flex flex-col gap-0.5 text-xs sm:flex-row sm:items-center sm:gap-2">
                  <span className="text-slate-400 line-through">{formatCurrency(item.valor)}</span>
                  <span className="font-semibold text-emerald-700">
                    Economize {formatCurrency(getProductDiscountAmount(item))}
                  </span>
                </div>
              )}
              <div className="text-[22px] font-black leading-none tracking-[-0.03em] text-[#17345f] sm:text-2xl flex items-baseline gap-2">
                {formatCurrency(currentPrice)}
              </div>
              <div className="mt-1 flex items-center gap-1 text-[10px] font-bold text-[#d8bd73]">
                <span>+ {pontosGanhos} pontos GSA</span>
              </div>
            </div>
          )}

          <div className="mt-2.5 flex items-center gap-2 border-t border-slate-100 pt-2.5">
            {isProduct ? (
              <button
                type="button"
                disabled={isOutOfStock && !item.link_afiliado}
                onClick={(event) => {
                  event.stopPropagation();
                  if (item.link_afiliado) {
                    window.open(item.link_afiliado, '_blank', 'noopener,noreferrer');
                  } else {
                    onAdd();
                  }
                }}
                className="inline-flex min-h-10 flex-1 items-center justify-center gap-2 rounded-xl bg-[#17345f] px-3 text-xs font-extrabold text-white transition hover:bg-[#102746] disabled:cursor-not-allowed disabled:bg-slate-200 disabled:text-slate-500"
              >
                {item.link_afiliado ? <ArrowRight className="h-4 w-4" aria-hidden="true" /> : <ShoppingBag className="h-4 w-4" aria-hidden="true" />}
                {item.link_afiliado ? 'Comprar no Parceiro' : (isOutOfStock ? 'Indisponível' : 'Adicionar')}
              </button>
            ) : (
              <span className="inline-flex min-h-10 flex-1 items-center justify-center rounded-xl bg-[#17345f] px-3 text-xs font-extrabold text-white">
                Ver {tipo === 'assinatura' ? 'plano' : 'detalhes'}
              </span>
            )}

            <span className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-slate-200 text-slate-500 transition group-hover:border-[#d7c39a] group-hover:text-[#8b6729]">
              <ArrowRight className="h-4 w-4" aria-hidden="true" />
            </span>
          </div>
        </div>
      </div>
    </article>
  );
}
