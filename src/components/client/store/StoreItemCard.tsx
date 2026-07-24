import React from 'react';
import {
  AlertCircle,
  ArrowRight,
  Calendar,
  Package,
  Scissors,
  ShoppingBag,
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
      onClick();
    }
  };

  return (
    <article
      role="link"
      tabIndex={0}
      onClick={onClick}
      onKeyDown={handleCardKeyDown}
      aria-label={`Ver detalhes de ${item.nome}`}
      className="group flex h-full cursor-pointer flex-col overflow-hidden rounded-[20px] border border-slate-200 bg-white text-left shadow-[0_10px_28px_rgba(15,23,42,0.06)] outline-none transition duration-300 hover:-translate-y-1 hover:border-slate-300 hover:shadow-[0_18px_42px_rgba(15,23,42,0.11)] focus-visible:ring-2 focus-visible:ring-[#17345f] focus-visible:ring-offset-2"
    >
      <div className="relative aspect-[4/3] overflow-hidden bg-[#f4f6f8]">
        {item.imagem_url ? (
          <img
            src={item.imagem_url}
            alt={item.nome}
            loading="lazy"
            className={`h-full w-full object-contain transition duration-500 group-hover:scale-[1.025] ${isOutOfStock ? 'opacity-55 grayscale-[20%]' : ''}`}
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center">
            <ItemPlaceholder tipo={tipo} />
          </div>
        )}

        <div className="absolute left-3 top-3 flex max-w-[calc(100%-1.5rem)] flex-wrap gap-1.5">
          {hasDiscount && (
            <span className="rounded-md bg-[#a77a2c] px-2 py-1 text-[10px] font-extrabold uppercase tracking-[0.08em] text-white shadow-sm">
              {formatProductDiscountPercentage(item)} off
            </span>
          )}

          {isLowStock && !isOutOfStock && (
            <span className="rounded-md border border-amber-200 bg-amber-50 px-2 py-1 text-[10px] font-bold text-amber-800">
              Últimas {item.estoque_disponivel} unidades
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

      <div className="flex flex-1 flex-col px-3.5 pb-3.5 pt-3 sm:px-4 sm:pb-4 sm:pt-3.5">
        <div className="mb-2 flex min-w-0 items-center gap-2 text-[10px] font-bold uppercase tracking-[0.12em]">
          <span className="text-[#17345f]">{getTypeLabel(tipo)}</span>
          {categoryLabel && (
            <>
              <span className="h-1 w-1 shrink-0 rounded-full bg-slate-300" aria-hidden="true" />
              <span className="truncate text-slate-400">{categoryLabel}</span>
            </>
          )}
        </div>

        <h3 className="line-clamp-2 min-h-[40px] text-[15px] font-extrabold leading-5 text-slate-950 transition-colors group-hover:text-[#17345f] sm:text-base">
          {item.nome}
        </h3>

        {item.descricao && (
          <p className="mt-1.5 hidden line-clamp-2 text-xs leading-5 text-slate-500 sm:block">
            {item.descricao}
          </p>
        )}

        {promotionQuantity?.limitadoPorQuantidade && promotionQuantity.quantidadeRestante !== null && (
          <p className="mt-2 text-[11px] font-semibold text-emerald-700">
            {promotionQuantity.quantidadeRestante} unidades com preço promocional
          </p>
        )}

        <div className="mt-auto pt-4">
          {item.ocultar_valor ? (
            <div className="text-sm font-bold text-slate-700">Valor sob consulta</div>
          ) : (
            <div className="min-h-[48px]">
              {hasDiscount && (
                <div className="flex items-center gap-2 text-xs">
                  <span className="text-slate-400 line-through">{formatCurrency(item.valor)}</span>
                  <span className="font-semibold text-emerald-700">
                    Economize {formatCurrency(getProductDiscountAmount(item))}
                  </span>
                </div>
              )}
              <div className="mt-0.5 text-[22px] font-black leading-none tracking-[-0.03em] text-[#17345f] sm:text-2xl">
                {formatCurrency(currentPrice)}
              </div>
            </div>
          )}

          <div className="mt-3 flex items-center gap-2 border-t border-slate-100 pt-3">
            {isProduct ? (
              <button
                type="button"
                disabled={isOutOfStock}
                onClick={(event) => {
                  event.stopPropagation();
                  onAdd();
                }}
                className="inline-flex min-h-10 flex-1 items-center justify-center gap-2 rounded-xl bg-[#17345f] px-3 text-xs font-extrabold text-white transition hover:bg-[#102746] disabled:cursor-not-allowed disabled:bg-slate-200 disabled:text-slate-500"
              >
                <ShoppingBag className="h-4 w-4" aria-hidden="true" />
                {isOutOfStock ? 'Indisponível' : 'Adicionar'}
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
