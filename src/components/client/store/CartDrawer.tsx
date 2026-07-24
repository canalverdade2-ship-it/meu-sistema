import React, { useEffect, useMemo, useState } from 'react';
import {
  AlertCircle,
  ArrowRight,
  CheckCircle2,
  Gift,
  Minus,
  Package,
  Plus,
  ShieldCheck,
  ShoppingBag,
  Tag,
  Trash2,
  X,
} from 'lucide-react';
import { formatCurrency } from '../../../lib/utils';
import type { Produto } from '../../../types';
import type { PromoResult } from '../../../lib/promocaoQuantidadeEngine';
import {
  getProductQuantityPriceBreakdown,
  hasActiveProductDiscount,
} from '../../../lib/productPricing';

type CartItem = {
  id: string;
  item_id: string;
  tipo: 'produto' | 'servico' | 'assinatura';
  quantidade: number;
  item_detalhes?: Produto | any;
  prazo_meses?: number;
};

interface CartDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  cartItems: CartItem[];
  promosAplicadas?: PromoResult[];
  isGuest?: boolean;
  cupomDesconto?: any;
  cupomEntrega?: any;
  cupomDescInput?: string;
  cupomEntInput?: string;
  onCupomDescInputChange?: (value: string) => void;
  onCupomEntInputChange?: (value: string) => void;
  onApplyCoupon?: (code: string, type: 'desconto' | 'entrega') => void;
  onRemoveCoupon?: (type: 'desconto' | 'entrega') => void;
  onUpdateQuantity: (cartId: string, quantity: number, item: any) => void;
  onRemove: (cartId: string) => void;
  onCheckout: () => void;
}

function itemSubtotal(item: CartItem): number {
  if (item.tipo === 'produto') {
    return getProductQuantityPriceBreakdown(item.item_detalhes, item.quantidade).subtotalFinal;
  }
  return Number(item.item_detalhes?.valor || 0) * Number(item.quantidade || 1);
}

function itemTypeLabel(type: CartItem['tipo']) {
  if (type === 'assinatura') return 'Assinatura';
  if (type === 'servico') return 'Serviço';
  return 'Produto';
}

export default function CartDrawer({
  isOpen,
  onClose,
  cartItems,
  promosAplicadas = [],
  isGuest = false,
  cupomDesconto,
  cupomEntrega,
  cupomDescInput = '',
  cupomEntInput = '',
  onCupomDescInputChange,
  onCupomEntInputChange,
  onApplyCoupon,
  onRemoveCoupon,
  onUpdateQuantity,
  onRemove,
  onCheckout,
}: CartDrawerProps) {
  const [showCoupons, setShowCoupons] = useState(Boolean(cupomDesconto || cupomEntrega));

  useEffect(() => {
    if (cupomDesconto || cupomEntrega) setShowCoupons(true);
  }, [cupomDesconto, cupomEntrega]);

  const subtotal = useMemo(
    () => cartItems.reduce((total, item) => total + itemSubtotal(item), 0),
    [cartItems],
  );

  const promotionDiscount = useMemo(
    () => promosAplicadas.reduce((total: number, promotion: PromoResult) => {
      if (promotion.status === 'ativa' && promotion.desconto_aplicado) {
        return total + Number(promotion.desconto_aplicado.valor_desconto || 0);
      }
      return total;
    }, 0),
    [promosAplicadas],
  );

  const couponDiscount = useMemo(() => {
    if (!isGuest || !cupomDesconto) return 0;

    let calculationBase = subtotal;
    if (cupomDesconto.produto_id) {
      const selectedItem = cartItems.find((item) => item.item_id === cupomDesconto.produto_id);
      if (!selectedItem) return 0;
      calculationBase = itemSubtotal(selectedItem);
    }

    const calculated = cupomDesconto.tipo_desconto === 'porcentagem'
      ? calculationBase * (Number(cupomDesconto.valor_desconto || 0) / 100)
      : Number(cupomDesconto.valor_desconto || 0);

    return Math.min(calculated, Math.max(0, subtotal - promotionDiscount));
  }, [cartItems, cupomDesconto, isGuest, promotionDiscount, subtotal]);

  const totalDiscount = promotionDiscount + couponDiscount;
  const total = Math.max(0, subtotal - totalDiscount);
  const hasOutOfStockItems = cartItems.some((item) => (
    item.tipo === 'produto'
    && item.item_detalhes?.controle_estoque
    && Number(item.item_detalhes?.estoque_disponivel || 0) <= 0
  ));

  if (!isOpen) return null;

  const activeGifts = promosAplicadas.filter((promotion) => promotion.status === 'ativa' && promotion.item_brinde);

  return (
    <div
      className="fixed inset-0 z-[120] flex items-end justify-center bg-[#07111f]/72 backdrop-blur-md md:items-stretch md:justify-end"
      role="presentation"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <aside
        role="dialog"
        aria-modal="true"
        aria-labelledby="gsa-cart-title"
        className="flex h-[95dvh] w-full flex-col overflow-hidden rounded-t-[24px] border border-slate-200 bg-[#f6f7f9] shadow-[0_-28px_80px_rgba(7,17,31,0.34)] md:h-full md:max-w-[500px] md:rounded-none md:border-y-0 md:border-r-0"
      >
        <header className="relative overflow-hidden bg-[#0e2746] px-5 pb-5 pt-4 text-white sm:px-6">
          <div className="pointer-events-none absolute -right-16 -top-20 h-48 w-48 rounded-full border border-white/10" aria-hidden="true" />
          <div className="pointer-events-none absolute -right-4 -top-10 h-32 w-32 rounded-full bg-[#9b742f]/20 blur-2xl" aria-hidden="true" />

          <div className="relative flex items-center justify-between gap-3">
            <div className="flex min-w-0 items-center gap-3">
              <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-white/15 bg-white/10 text-[#ddc28d] shadow-inner">
                <ShoppingBag className="h-5 w-5" aria-hidden="true" />
              </div>
              <div className="min-w-0">
                <p className="text-[10px] font-black uppercase tracking-[0.18em] text-[#ddc28d]">GSA Store</p>
                <h2 id="gsa-cart-title" className="mt-0.5 text-xl font-black tracking-[-0.03em] text-white">Seu carrinho</h2>
                <p className="mt-0.5 text-xs text-white/60">{cartItems.length} {cartItems.length === 1 ? 'item selecionado' : 'itens selecionados'}</p>
              </div>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="flex h-10 w-10 items-center justify-center rounded-xl border border-white/15 bg-white/10 text-white/75 transition hover:bg-white/15 hover:text-white"
              aria-label="Fechar carrinho"
            >
              <X className="h-5 w-5" aria-hidden="true" />
            </button>
          </div>

          <div className="relative mt-4 grid grid-cols-3 gap-2 rounded-[14px] border border-white/10 bg-white/[0.06] p-2.5">
            {[
              'Itens revisados',
              'Valores claros',
              'Compra protegida',
            ].map((label) => (
              <div key={label} className="flex items-center justify-center gap-1.5 text-center text-[9px] font-bold leading-4 text-white/70">
                <CheckCircle2 className="h-3.5 w-3.5 shrink-0 text-[#ddc28d]" aria-hidden="true" />
                <span>{label}</span>
              </div>
            ))}
          </div>
        </header>

        <div className="flex-1 overflow-y-auto px-4 py-5 sm:px-5">
          {cartItems.length === 0 ? (
            <div className="flex min-h-[430px] flex-col items-center justify-center rounded-[22px] border border-slate-200 bg-white px-6 text-center shadow-[0_12px_32px_rgba(15,23,42,0.05)]">
              <div className="flex h-20 w-20 items-center justify-center rounded-[20px] border border-[#e2d5bc] bg-[#fbf8f2] text-[#9b742f]">
                <ShoppingBag className="h-9 w-9" aria-hidden="true" />
              </div>
              <p className="mt-5 text-[10px] font-black uppercase tracking-[0.16em] text-[#8b6729]">Sua seleção</p>
              <h3 className="mt-2 text-xl font-black tracking-[-0.03em] text-slate-950">Seu carrinho está vazio</h3>
              <p className="mt-2 max-w-[290px] text-sm leading-6 text-slate-500">
                Continue navegando e escolha os produtos ou planos ideais para você.
              </p>
              <button
                type="button"
                onClick={onClose}
                className="mt-6 inline-flex min-h-12 items-center justify-center gap-2 rounded-xl bg-[#17345f] px-5 text-sm font-black text-white shadow-[0_10px_24px_rgba(23,52,95,0.18)]"
              >
                Explorar a loja
                <ArrowRight className="h-4 w-4" aria-hidden="true" />
              </button>
            </div>
          ) : (
            <div className="space-y-3.5">
              {cartItems.map((item) => {
                const isProduct = item.tipo === 'produto';
                const outOfStock = isProduct
                  && item.item_detalhes?.controle_estoque
                  && Number(item.item_detalhes?.estoque_disponivel || 0) <= 0;
                const subtotalForItem = itemSubtotal(item);
                const originalSubtotal = Number(item.item_detalhes?.valor || 0) * Number(item.quantidade || 1);
                const hasDiscount = isProduct && hasActiveProductDiscount(item.item_detalhes) && subtotalForItem < originalSubtotal;

                return (
                  <article
                    key={item.id}
                    className={`relative overflow-hidden rounded-[18px] border bg-white p-3.5 shadow-[0_10px_28px_rgba(15,23,42,0.055)] ${
                      outOfStock ? 'border-red-200' : 'border-slate-200'
                    }`}
                  >
                    <div className={`absolute inset-y-0 left-0 w-1 ${outOfStock ? 'bg-red-400' : 'bg-[#9b742f]'}`} aria-hidden="true" />
                    <div className="flex gap-3.5 pl-1.5">
                      <div className="flex h-22 w-22 shrink-0 items-center justify-center overflow-hidden rounded-[14px] border border-slate-200 bg-[#f5f6f8] p-1.5">
                        {item.item_detalhes?.imagem_url ? (
                          <img
                            src={item.item_detalhes.imagem_url}
                            alt={item.item_detalhes?.nome || ''}
                            className={`h-full w-full object-contain ${outOfStock ? 'opacity-50 grayscale' : ''}`}
                          />
                        ) : (
                          <Package className="h-8 w-8 text-slate-300" aria-hidden="true" />
                        )}
                      </div>

                      <div className="min-w-0 flex-1 pr-8">
                        <div className="flex flex-wrap items-center gap-1.5">
                          <p className="text-[9px] font-black uppercase tracking-[0.13em] text-[#8b6729]">
                            {itemTypeLabel(item.tipo)}
                          </p>
                          <span className="h-1 w-1 rounded-full bg-slate-300" aria-hidden="true" />
                          <span className="text-[9px] font-bold uppercase tracking-[0.08em] text-slate-400">GSA Store</span>
                        </div>
                        <h3 className="mt-1.5 line-clamp-2 text-sm font-black leading-5 tracking-[-0.015em] text-slate-950">
                          {item.item_detalhes?.nome || 'Item da GSA Store'}
                        </h3>
                        {item.prazo_meses && (
                          <p className="mt-1 text-xs font-semibold text-slate-500">
                            Período: {item.prazo_meses} {item.prazo_meses === 1 ? 'mês' : 'meses'}
                          </p>
                        )}

                        {outOfStock ? (
                          <div className="mt-3 inline-flex items-center gap-1.5 rounded-lg border border-red-200 bg-red-50 px-2.5 py-1.5 text-xs font-bold text-red-700">
                            <AlertCircle className="h-4 w-4" aria-hidden="true" />
                            Item indisponível
                          </div>
                        ) : (
                          <div className="mt-3 flex flex-wrap items-end justify-between gap-3">
                            <div>
                              {hasDiscount && (
                                <p className="text-[11px] text-slate-400 line-through">{formatCurrency(originalSubtotal)}</p>
                              )}
                              <p className="text-lg font-black tracking-[-0.03em] text-[#17345f]">{formatCurrency(subtotalForItem)}</p>
                            </div>

                            {isProduct && (
                              <div className="flex items-center rounded-xl border border-slate-200 bg-slate-50 p-1 shadow-inner">
                                <button
                                  type="button"
                                  onClick={() => item.quantidade === 1 ? onRemove(item.id) : onUpdateQuantity(item.id, item.quantidade - 1, item.item_detalhes)}
                                  className="flex h-8 w-8 items-center justify-center rounded-lg text-slate-600 transition hover:bg-white hover:shadow-sm"
                                  aria-label={item.quantidade === 1 ? 'Remover item' : 'Diminuir quantidade'}
                                >
                                  {item.quantidade === 1 ? <Trash2 className="h-3.5 w-3.5" /> : <Minus className="h-3.5 w-3.5" />}
                                </button>
                                <span className="w-8 text-center text-xs font-black tabular-nums text-slate-900">{item.quantidade}</span>
                                <button
                                  type="button"
                                  onClick={() => onUpdateQuantity(item.id, item.quantidade + 1, item.item_detalhes)}
                                  className="flex h-8 w-8 items-center justify-center rounded-lg text-slate-600 transition hover:bg-white hover:shadow-sm"
                                  aria-label="Aumentar quantidade"
                                >
                                  <Plus className="h-3.5 w-3.5" />
                                </button>
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={() => onRemove(item.id)}
                      className="absolute right-3 top-3 flex h-8 w-8 items-center justify-center rounded-lg text-slate-400 transition hover:bg-red-50 hover:text-red-600"
                      aria-label={`Remover ${item.item_detalhes?.nome || 'item'}`}
                    >
                      <Trash2 className="h-4 w-4" aria-hidden="true" />
                    </button>
                  </article>
                );
              })}

              {activeGifts.map((promotion: PromoResult, index: number) => (
                <div key={`${promotion.promocao_id}-${index}`} className="flex items-center gap-3 rounded-[18px] border border-[#dfd1b4] bg-[#fbf8f2] p-4 shadow-[0_8px_22px_rgba(155,116,47,0.07)]">
                  <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl border border-[#e7dcc4] bg-white text-[#9b742f]">
                    <Gift className="h-5 w-5" aria-hidden="true" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-[10px] font-black uppercase tracking-[0.12em] text-[#8b6729]">Benefício incluído</p>
                    <p className="mt-0.5 truncate text-sm font-bold text-slate-900">{promotion.item_brinde?.produto_nome}</p>
                  </div>
                  <span className="rounded-lg bg-emerald-50 px-2.5 py-1.5 text-xs font-black text-emerald-700">Grátis</span>
                </div>
              ))}

              {isGuest && (
                <section className="rounded-[18px] border border-slate-200 bg-white p-4 shadow-[0_8px_22px_rgba(15,23,42,0.04)]">
                  <button
                    type="button"
                    onClick={() => setShowCoupons((current) => !current)}
                    className="flex w-full items-center justify-between text-left"
                    aria-expanded={showCoupons}
                  >
                    <span className="flex items-center gap-2.5 text-sm font-black text-slate-900">
                      <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-[#fbf8f2] text-[#9b742f]">
                        <Tag className="h-4 w-4" aria-hidden="true" />
                      </span>
                      Cupons e benefícios
                    </span>
                    <span className="rounded-lg bg-[#edf2f7] px-2.5 py-1.5 text-xs font-black text-[#17345f]">{showCoupons ? 'Ocultar' : 'Adicionar'}</span>
                  </button>

                  {showCoupons && (
                    <div className="mt-4 space-y-3 border-t border-slate-100 pt-4">
                      <div className="flex gap-2">
                        <input
                          type="text"
                          value={cupomDescInput}
                          onChange={(event) => onCupomDescInputChange?.(event.target.value.toUpperCase())}
                          placeholder="Cupom de desconto"
                          className="h-11 min-w-0 flex-1 rounded-xl border border-slate-200 bg-slate-50 px-3 text-sm font-semibold uppercase outline-none transition focus:border-[#17345f] focus:bg-white focus:ring-4 focus:ring-[#17345f]/10"
                        />
                        <button
                          type="button"
                          onClick={() => onApplyCoupon?.(cupomDescInput, 'desconto')}
                          className="rounded-xl bg-[#17345f] px-3 text-xs font-black text-white transition hover:bg-[#102746]"
                        >
                          Aplicar
                        </button>
                      </div>
                      <div className="flex gap-2">
                        <input
                          type="text"
                          value={cupomEntInput}
                          onChange={(event) => onCupomEntInputChange?.(event.target.value.toUpperCase())}
                          placeholder="Benefício de entrega"
                          className="h-11 min-w-0 flex-1 rounded-xl border border-slate-200 bg-slate-50 px-3 text-sm font-semibold uppercase outline-none transition focus:border-[#17345f] focus:bg-white focus:ring-4 focus:ring-[#17345f]/10"
                        />
                        <button
                          type="button"
                          onClick={() => onApplyCoupon?.(cupomEntInput, 'entrega')}
                          className="rounded-xl border border-[#17345f] bg-white px-3 text-xs font-black text-[#17345f] transition hover:bg-[#edf2f7]"
                        >
                          Aplicar
                        </button>
                      </div>

                      {(cupomDesconto || cupomEntrega) && (
                        <div className="space-y-2">
                          {cupomDesconto && (
                            <div className="flex items-center justify-between rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs">
                              <span className="inline-flex items-center gap-1.5 font-bold text-emerald-800">
                                <CheckCircle2 className="h-3.5 w-3.5" aria-hidden="true" />
                                {cupomDesconto.codigo_cupom}
                              </span>
                              <button type="button" onClick={() => onRemoveCoupon?.('desconto')} className="font-bold text-emerald-700">Remover</button>
                            </div>
                          )}
                          {cupomEntrega && (
                            <div className="flex items-center justify-between rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs">
                              <span className="inline-flex items-center gap-1.5 font-bold text-emerald-800">
                                <CheckCircle2 className="h-3.5 w-3.5" aria-hidden="true" />
                                {cupomEntrega.codigo_cupom}
                              </span>
                              <button type="button" onClick={() => onRemoveCoupon?.('entrega')} className="font-bold text-emerald-700">Remover</button>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  )}
                </section>
              )}
            </div>
          )}
        </div>

        {cartItems.length > 0 && (
          <footer className="border-t border-slate-200 bg-white px-5 pb-[max(1rem,env(safe-area-inset-bottom))] pt-4 shadow-[0_-14px_36px_rgba(15,23,42,0.08)] sm:px-6">
            <div className="rounded-[18px] border border-[#dfd1b4] bg-[#fbf8f2] p-4 shadow-[inset_4px_0_0_#9b742f]">
              <div className="space-y-2 text-sm">
                <div className="flex items-center justify-between text-slate-600">
                  <span>Subtotal</span>
                  <span className="font-bold text-slate-900">{formatCurrency(subtotal)}</span>
                </div>
                {totalDiscount > 0 && (
                  <div className="flex items-center justify-between text-emerald-700">
                    <span>Descontos aplicados</span>
                    <span className="font-black">− {formatCurrency(totalDiscount)}</span>
                  </div>
                )}
                <div className="flex items-end justify-between border-t border-[#e7dcc4] pt-3">
                  <div>
                    <p className="text-[10px] font-black uppercase tracking-[0.13em] text-[#8b6729]">Total dos itens</p>
                    <p className="mt-1 text-[30px] font-black leading-none tracking-[-0.05em] text-[#17345f]">{formatCurrency(total)}</p>
                  </div>
                  <span className="max-w-[130px] text-right text-[10px] leading-4 text-slate-500">Frete e condições finais no checkout</span>
                </div>
              </div>
            </div>

            {hasOutOfStockItems && (
              <div className="mt-3 flex items-start gap-2 rounded-xl border border-red-200 bg-red-50 px-3 py-2.5 text-xs font-semibold leading-5 text-red-700">
                <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
                Remova os itens indisponíveis para continuar.
              </div>
            )}

            <button
              type="button"
              onClick={onCheckout}
              disabled={hasOutOfStockItems}
              className="mt-4 inline-flex min-h-[56px] w-full items-center justify-center gap-2 rounded-xl bg-[#17345f] px-5 py-4 text-sm font-black text-white shadow-[0_14px_30px_rgba(23,52,95,0.22)] transition hover:bg-[#102746] hover:shadow-[0_18px_38px_rgba(23,52,95,0.3)] disabled:cursor-not-allowed disabled:bg-slate-200 disabled:text-slate-500 disabled:shadow-none"
            >
              Ir para o checkout
              <ArrowRight className="h-4 w-4" aria-hidden="true" />
            </button>

            <div className="mt-3 flex items-center justify-center gap-2 text-[11px] font-semibold text-slate-500">
              <ShieldCheck className="h-4 w-4 text-[#9b742f]" aria-hidden="true" />
              Preços e estoque serão validados antes da confirmação.
            </div>
          </footer>
        )}
      </aside>
    </div>
  );
}
