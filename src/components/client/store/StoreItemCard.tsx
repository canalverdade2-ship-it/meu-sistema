import React from 'react';
import {
  AlertCircle,
  ArrowRight,
  Calendar,
  CheckCircle2,
  Package,
  Scissors,
  ShieldCheck,
  ShoppingBag,
  Sparkles,
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
  const isFeatured = Boolean(item?.destaque || item?.mais_vendido || item?.mais_procurado);
  const isNew = Boolean(item?.novo || item?.lancamento);

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
      className="group relative flex h-full cursor-pointer flex-col overflow-hidden rounded-[22px] border border-slate-200/90 bg-white text-left shadow-[0_12px_34px_rgba(15,23,42,0.075)] outline-none transition duration-300 hover:-translate-y-1.5 hover:border-[#d8c49a] hover:shadow-[0_24px_58px_rgba(15,23,42,0.14)] focus-visible:ring-2 focus-visible:ring-[#17345f] focus-visible:ring-offset-2"
    >
      <div className="relative aspect-square overflow-hidden bg-[#f4f5f7] p-2.5 sm:p-3">
        <div className="relative h-full w-full overflow-hidden rounded-[16px] border border-white/80 bg-white shadow-[inset_0_0_0_1px_rgba(15,23,42,0.035)]">
          {item.imagem_url ? (
            <img
              src={item.imagem_url}
              alt={item.nome}
              loading="lazy"
              className={`h-full w-full object-contain p-1 transition duration-500 group-hover:scale-[1.04] ${isOutOfStock ? 'opacity-50 grayscale-[25%]' : ''}`}
            />
          ) : (
            <div className="flex h-full w-full items-center justify-center">
              <ItemPlaceholder tipo={tipo} />
            </div>
          )}

          <div className="pointer-events-none absolute inset-x-0 bottom-0 h-16 bg-gradient-to-t from-slate-950/[0.06] to-transparent" aria-hidden="true" />
        </div>

        <div className="absolute left-4 top-4 flex max-w-[calc(100%-2rem)] flex-wrap gap-1.5">
          {hasDiscount && (
            <span className="rounded-lg bg-[#9b742f] px-2.5 py-1.5 text-[10px] font-black uppercase tracking-[0.08em] text-white shadow-[0_6px_16px_rgba(155,116,47,0.24)]">
              {formatProductDiscountPercentage(item)} off
            </span>
          )}

          {isFeatured && !isOutOfStock && (
            <span className="inline-flex items-center gap-1 rounded-lg border border-white/90 bg-[#17345f]/95 px-2.5 py-1.5 text-[10px] font-extrabold uppercase tracking-[0.07em] text-white shadow-sm">
              <Sparkles className="h-3 w-3" aria-hidden="true" />
              Destaque
            </span>
          )}

          {isNew && !isFeatured && !isOutOfStock && (
            <span className="rounded-lg border border-emerald-200 bg-emerald-50 px-2.5 py-1.5 text-[10px] font-extrabold uppercase tracking-[0.07em] text-emerald-800">
              Novo
            </span>
          )}

          {isLowStock && !isOutOfStock && (
            <span className="rounded-lg border border-amber-200 bg-amber-50 px-2.5 py-1.5 text-[10px] font-bold text-amber-800">
              Últimas {item.estoque_disponivel} unidades
            </span>
          )}

          {isOutOfStock && (
            <span className="inline-flex items-center gap-1 rounded-lg border border-slate-300 bg-white/95 px-2.5 py-1.5 text-[10px] font-extrabold uppercase tracking-[0.08em] text-slate-700 shadow-sm">
              <AlertCircle className="h-3 w-3" aria-hidden="true" />
              Esgotado
            </span>
          )}
        </div>

        <span className="absolute bottom-4 right-4 rounded-lg border border-white/80 bg-white/90 px-2 py-1 text-[9px] font-black uppercase tracking-[0.13em] text-[#17345f] shadow-sm backdrop-blur-sm">
          GSA Store
        </span>
      </div>

      <div className="flex flex-1 flex-col px-3.5 pb-3.5 pt-3 sm:px-4.5 sm:pb-4.5 sm:pt-3.5">
        <div className="mb-2 flex min-w-0 items-center gap-2 text-[10px] font-bold uppercase tracking-[0.12em]">
          <span className="text-[#8b6729]">{getTypeLabel(tipo)}</span>
          {categoryLabel && (
            <>
              <span className="h-1 w-1 shrink-0 rounded-full bg-slate-300" aria-hidden="true" />
              <span className="truncate text-slate-400">{categoryLabel}</span>
            </>
          )}
        </div>

        <h3 className="line-clamp-2 min-h-[42px] text-[15px] font-black leading-[1.32] tracking-[-0.015em] text-slate-950 transition-colors group-hover:text-[#17345f] sm:text-[17px]">
          {item.nome}
        </h3>

        {item.descricao && (
          <p className="mt-2 hidden line-clamp-2 text-xs leading-5 text-slate-500 sm:block">
            {item.descricao}
          </p>
        )}

        {promotionQuantity?.limitadoPorQuantidade && promotionQuantity.quantidadeRestante !== null && (
          <p className="mt-2 inline-flex items-center gap-1.5 text-[11px] font-semibold text-emerald-700">
            <CheckCircle2 className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
            {promotionQuantity.quantidadeRestante} unidades com preço promocional
          </p>
        )}

        <div className="mt-auto pt-4">
          {item.ocultar_valor ? (
            <div className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm font-extrabold text-slate-700">
              Valor sob consulta
            </div>
          ) : (
            <div className="min-h-[55px]">
              {hasDiscount && (
                <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[11px]">
                  <span className="text-slate-400 line-through">{formatCurrency(item.valor)}</span>
                  <span className="font-bold text-emerald-700">
                    Economize {formatCurrency(getProductDiscountAmount(item))}
                  </span>
                </div>
              )}
              <div className="mt-1 flex items-end gap-1.5">
                <span className="text-[23px] font-black leading-none tracking-[-0.045em] text-[#17345f] sm:text-[27px]">
                  {formatCurrency(currentPrice)}
                </span>
                {tipo === 'assinatura' && <span className="pb-0.5 text-[10px] font-bold text-slate-400">/ mês</span>}
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
                className="inline-flex min-h-11 flex-1 items-center justify-center gap-2 rounded-xl bg-[#17345f] px-3 text-xs font-black text-white shadow-[0_8px_18px_rgba(23,52,95,0.16)] transition hover:bg-[#102746] hover:shadow-[0_10px_24px_rgba(23,52,95,0.24)] disabled:cursor-not-allowed disabled:bg-slate-200 disabled:text-slate-500 disabled:shadow-none"
              >
                <ShoppingBag className="h-4 w-4" aria-hidden="true" />
                {isOutOfStock ? 'Indisponível' : 'Adicionar'}
              </button>
            ) : (
              <span className="inline-flex min-h-11 flex-1 items-center justify-center rounded-xl bg-[#17345f] px-3 text-xs font-black text-white shadow-[0_8px_18px_rgba(23,52,95,0.16)]">
                Ver {tipo === 'assinatura' ? 'plano' : 'detalhes'}
              </span>
            )}

            <span className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-[#e2d5bc] bg-[#fbf8f2] text-[#8b6729] transition group-hover:border-[#c8aa6a] group-hover:bg-[#f7f1e5]">
              <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" aria-hidden="true" />
            </span>
          </div>

          <div className="mt-2.5 hidden items-center justify-center gap-1.5 text-[10px] font-semibold text-slate-400 sm:flex">
            <ShieldCheck className="h-3.5 w-3.5 text-[#9b742f]" aria-hidden="true" />
            Pedido acompanhado pelo portal GSA
          </div>
        </div>
      </div>
    </article>
  );
}
